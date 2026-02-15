import Layers from 'lucide-react/dist/esm/icons/layers'
import { escapeIdentifier } from '@/lib/duckdb/sql-builder/utils'
import type { ToolDefinition } from '@/types/ai'
import type { Column } from '@/types/dataset'
import type { PipelineNode, UnionOperation } from '@/types/pipeline'
import type { OperationContext, OperationPlugin, OperationUiMeta, ValidationResult } from '../types'

const ui: OperationUiMeta = {
  label: 'Union',
  icon: Layers,
  color: 'orange',
  editable: true,
  editor: { type: 'union' },
}

const toolDefinition: ToolDefinition = {
  name: 'union',
  description: 'Stack multiple tables vertically. Tables must have compatible schemas.',
  parameters: {
    type: 'object',
    properties: {
      sourceIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'IDs of tables to union with the current table',
      },
      mode: {
        type: 'string',
        enum: ['all', 'distinct'],
        description: 'all (keep duplicates) or distinct (remove duplicates)',
      },
    },
    required: ['sourceIds', 'mode'],
  },
}

function validate(
  args: Record<string, unknown>,
  columns: Column[],
  nodes?: Record<string, PipelineNode>
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const sourceIds = args.sourceIds as string[]
  const mode = args.mode as string

  if (!sourceIds || !Array.isArray(sourceIds) || sourceIds.length === 0) {
    errors.push('union requires at least one sourceId')
    return { valid: false, errors, warnings }
  }
  if (!mode || !['all', 'distinct'].includes(mode)) {
    errors.push('union requires mode to be "all" or "distinct"')
    return { valid: false, errors, warnings }
  }

  // Collect all nodes to union (including checking existence)
  const nodesToUnion: PipelineNode[] = []
  for (const id of sourceIds) {
    if (!nodes?.[id]) {
      errors.push(`Table with ID "${id}" does not exist`)
    } else {
      nodesToUnion.push(nodes[id])
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings }
  }

  // Check schema compatibility between current table and union sources
  const currentColumnCount = columns.length
  for (const node of nodesToUnion) {
    const sourceColumns = ((node as { columns?: Column[] }).columns ?? []) as Column[]
    const sourceColumnCount = sourceColumns.length

    // Check column count mismatch
    if (sourceColumnCount !== currentColumnCount) {
      warnings.push(
        `Schema mismatch: "${node.name}" has ${sourceColumnCount} columns, current table has ${currentColumnCount}. ` +
          `Union may fail or produce unexpected results.`
      )
    } else {
      // Check column type compatibility
      for (let i = 0; i < currentColumnCount; i++) {
        const currentCol = columns[i]
        const sourceCol = sourceColumns[i]
        if (currentCol && sourceCol) {
          const currentType = currentCol.type.toLowerCase()
          const sourceType = sourceCol.type.toLowerCase()
          if (currentType !== sourceType) {
            warnings.push(
              `Type mismatch at position ${i + 1}: current "${currentCol.name}" (${currentCol.type}) vs ` +
                `"${node.name}.${sourceCol.name}" (${sourceCol.type}). Types will be coerced.`
            )
          }
        }
      }
    }
  }

  const operation: UnionOperation = {
    type: 'union',
    sourceIds,
    mode: mode as 'all' | 'distinct',
  }

  return { valid: true, operation, errors, warnings }
}

function buildSql(op: UnionOperation, context: OperationContext): string {
  if (!context.additionalSources) {
    throw new Error('Union requires additionalSources')
  }

  const source = escapeIdentifier(context.sourceTableName)
  const unionMode = op.mode === 'all' ? 'UNION ALL' : 'UNION'
  const sources = [source, ...op.sourceIds.map((id) => escapeIdentifier(context.additionalSources![id].tableName))]
  return sources.map((s) => `SELECT * FROM ${s}`).join(` ${unionMode} `)
}

function getSummary(op: UnionOperation): string {
  const count = op.sourceIds.length
  return `Union ${count} sources (${op.mode})`
}

export const unionPlugin: OperationPlugin<UnionOperation> = {
  type: 'union',
  category: 'combine',
  ui,
  toolDefinition,
  validate,
  buildSql,
  getSummary,
}
