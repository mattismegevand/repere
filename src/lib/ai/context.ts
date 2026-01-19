import type { DuckDBClient } from '@/lib/duckdb/interface'
import type { ColumnStats } from '@/lib/profiling'
import type { AgentContext, ColumnStat, NodeContext } from '@/types/ai'
import type { DataView, PipelineNode } from '@/types/pipeline'

/**
 * Maximum number of sample rows to include in context
 */
const SAMPLE_SIZE = 50

/**
 * Fetch a sample of rows from a table for the LLM to understand patterns
 */
async function fetchDataSample(
  client: DuckDBClient,
  tableName: string,
  limit: number = SAMPLE_SIZE
): Promise<Record<string, unknown>[]> {
  try {
    const result = await client.query<Record<string, unknown>>(`SELECT * FROM "${tableName}" LIMIT ${limit}`)
    return result.rows.map((row) => {
      // Convert BigInt to number for JSON serialization
      const obj: Record<string, unknown> = {}
      for (const key in row) {
        obj[key] = typeof row[key] === 'bigint' ? Number(row[key]) : row[key]
      }
      return obj
    })
  } catch {
    return []
  }
}

/**
 * Convert profiler ColumnStats to simplified ColumnStat for LLM context
 */
function convertColumnStats(stats: ColumnStats[]): ColumnStat[] {
  return stats.map((s) => ({
    column: s.column,
    type: s.type,
    nullCount: s.nullCount,
    nullPercent: s.count > 0 ? Math.round((s.nullCount / s.count) * 100) : 0,
    uniqueCount: s.uniqueCount,
    min: s.min,
    max: s.max,
    mean: s.mean,
    outlierCount: s.outlierCount,
  }))
}

/**
 * Build a description of how we got to the current node (operation history)
 */
function buildOperationHistory(
  node: PipelineNode,
  nodes: Record<string, PipelineNode>,
  maxDepth: number = 5
): string[] {
  const history: string[] = []

  function describeOperation(view: DataView): string {
    const op = view.operation
    switch (op.type) {
      case 'filter':
        return `Filtered rows`
      case 'sort':
        return `Sorted by ${op.sorts.map((s) => `${s.column} ${s.direction}`).join(', ')}`
      case 'limit':
        return `Limited to ${op.limit} rows${op.offset ? ` (offset ${op.offset})` : ''}`
      case 'select':
        return `Selected columns: ${op.columns.join(', ')}`
      case 'addColumn':
        return `Added columns: ${op.columns.map((c) => c.name).join(', ')}`
      case 'removeColumns':
        return `Removed columns: ${op.columns.join(', ')}`
      case 'renameColumns':
        return `Renamed: ${op.renames.map((r) => `${r.from} → ${r.to}`).join(', ')}`
      case 'reorderColumns':
        return `Reordered columns`
      case 'castColumn':
        return `Cast ${op.column} to ${op.toType}`
      case 'editCell':
        return `Edited ${op.edits.length} cell(s)`
      case 'editColumn':
        return `Transformed column ${op.column}`
      case 'fillNull':
        return `Filled nulls in ${op.column} using ${op.strategy}`
      case 'replaceValue':
        return `Replaced values in ${op.column}`
      case 'pivot':
        return op.pivotColumn ? `Pivoted on ${op.pivotColumn}` : `Grouped by ${op.rowColumns.join(', ')}`
      case 'unpivot':
        return `Unpivoted ${op.valueColumns.length} columns`
      case 'window':
        return `Added window function ${op.function} as ${op.outputColumn}`
      case 'join':
        return `${op.joinType.toUpperCase()} JOIN with another table`
      case 'union':
        return `Union of ${op.sourceIds.length} tables`
      case 'distinct':
        return op.columns ? `Distinct on ${op.columns.join(', ')}` : 'Removed duplicates'
      case 'sql':
        return 'Custom SQL query'
      default:
        return 'Unknown operation'
    }
  }

  function traverse(currentNode: PipelineNode, depth: number): void {
    if (depth >= maxDepth) return

    if (currentNode.type === 'view') {
      history.unshift(describeOperation(currentNode))
      // Traverse to parent
      const parentId = currentNode.parentIds[0]
      if (parentId && nodes[parentId]) {
        traverse(nodes[parentId], depth + 1)
      }
    } else if (currentNode.type === 'dataset') {
      history.unshift(`Loaded from ${currentNode.fileName}`)
    }
  }

  traverse(node, 0)
  return history
}

/**
 * Build the full agent context from the current pipeline state
 */
export async function buildAgentContext(
  client: DuckDBClient,
  activeNode: PipelineNode,
  nodes: Record<string, PipelineNode>,
  columnStats: ColumnStats[]
): Promise<AgentContext> {
  // Build current node context
  const currentNode: NodeContext = {
    id: activeNode.id,
    name: activeNode.name,
    tableName: activeNode.tableName,
    rowCount: activeNode.rowCount,
    columns: activeNode.columns,
  }

  // Fetch sample data
  const dataSample = await fetchDataSample(client, activeNode.tableName)

  // Build all nodes list with full details
  const allNodes = Object.values(nodes)
    .filter((n) => n.type === 'dataset' || n.type === 'view')
    .map((n) => ({
      id: n.id,
      name: n.name,
      type: n.type,
      columns: n.columns,
      rowCount: n.rowCount,
    }))

  // Build operation history
  const operationHistory = buildOperationHistory(activeNode, nodes)

  return {
    currentNode,
    columnStats: convertColumnStats(columnStats),
    dataSample,
    allNodes,
    operationHistory,
  }
}

/**
 * Serialize context to a compact string for LLM prompt
 */
export function serializeContextForPrompt(context: AgentContext): string {
  const lines: string[] = []

  // Current table info
  lines.push(`## Current Table: ${context.currentNode.name}`)
  lines.push(`Rows: ${context.currentNode.rowCount?.toLocaleString() ?? 'unknown'}`)
  lines.push('')

  // Column schema
  lines.push('### Columns')
  for (const col of context.currentNode.columns) {
    const stat = context.columnStats.find((s) => s.column === col.name)
    let colInfo = `- ${col.name} (${col.type}${col.nullable ? ', nullable' : ''})`
    if (stat) {
      const parts: string[] = []
      if (stat.nullCount > 0) parts.push(`${stat.nullPercent}% null`)
      if (stat.uniqueCount) parts.push(`${stat.uniqueCount} unique`)
      if (stat.mean !== undefined) parts.push(`mean: ${stat.mean.toFixed(2)}`)
      if (stat.outlierCount && stat.outlierCount > 0) parts.push(`${stat.outlierCount} outliers`)
      if (parts.length > 0) colInfo += ` [${parts.join(', ')}]`
    }
    lines.push(colInfo)
  }
  lines.push('')

  // Sample data (first 5 rows for brevity in prompt)
  if (context.dataSample.length > 0) {
    lines.push('### Sample Data (first 5 rows)')
    lines.push('```json')
    lines.push(JSON.stringify(context.dataSample.slice(0, 5), null, 2))
    lines.push('```')
    lines.push('')
  }

  // Operation history
  if (context.operationHistory.length > 0) {
    lines.push('### How we got here')
    for (const op of context.operationHistory) {
      lines.push(`- ${op}`)
    }
    lines.push('')
  }

  // All nodes in the pipeline
  if (context.allNodes.length > 0) {
    lines.push('### All Nodes in Pipeline')
    lines.push('You can target any of these nodes using their ID in the `targetNodeId` parameter.')
    lines.push('')
    for (const node of context.allNodes) {
      const isCurrent = node.id === context.currentNode.id
      const marker = isCurrent ? ' (CURRENT)' : ''
      lines.push(`**${node.name}**${marker}`)
      lines.push(`- ID: \`${node.id}\``)
      lines.push(`- Type: ${node.type}`)
      lines.push(`- Rows: ${node.rowCount?.toLocaleString() ?? 'unknown'}`)
      lines.push(`- Columns: ${node.columns.map((c) => `${c.name} (${c.type})`).join(', ')}`)
      lines.push('')
    }
  }

  return lines.join('\n')
}
