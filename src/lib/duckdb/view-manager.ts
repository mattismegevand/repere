import type { DataView, PipelineNode, SqlQueryOperation, ViewOperation } from '@/types'
import type { NodeRuntime, RuntimeColumn } from '@/types/pipelineRuntime'
import type { DuckDBClient } from './interface'
import {
  buildCreateViewSql,
  buildDropViewSql,
  buildOperationSql,
  escapeIdentifier,
  generateViewName,
  getOperationDisplayName,
  type OperationContext,
} from './sql-builder'

/**
 * Extract the base name from a table name for use in child view names.
 * For datasets: "products_abc12345" → "products"
 * For views: "products_flt_a3bc" → "products"
 */
function extractBaseName(tableName: string): string {
  // Split by underscore and take the first part (before any suffix)
  const parts = tableName.split('_')
  // If the last part looks like a random suffix (4-8 chars alphanumeric), remove it
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1]
    // Check if it's likely a random suffix (4-8 alphanumeric chars)
    if (/^[a-z0-9]{4,8}$/i.test(lastPart)) {
      // Also check second-to-last for operation abbreviation
      if (parts.length > 2) {
        const secondLast = parts[parts.length - 2]
        // If it looks like an operation abbreviation (2-4 chars), remove it too
        if (/^[a-z]{2,4}$/i.test(secondLast)) {
          return parts.slice(0, -2).join('_')
        }
      }
      return parts.slice(0, -1).join('_')
    }
  }
  return tableName
}

export interface ViewSource {
  node: PipelineNode
  runtime: NodeRuntime
}

export interface ViewCreationResult {
  view: DataView
  runtime: NodeRuntime
  parentIds: string[]
}

export interface ViewUpdateResult {
  runtime: NodeRuntime
}

/**
 * Get schema (columns) for a view/table
 */
export async function getViewSchema(client: DuckDBClient, viewName: string): Promise<RuntimeColumn[]> {
  return client.describe(viewName)
}

/**
 * Get row count for a view/table
 */
export async function getViewRowCount(client: DuckDBClient, viewName: string): Promise<number> {
  return client.count(viewName)
}

/**
 * Create a new view from an operation
 */
export async function createView(
  client: DuckDBClient,
  parent: ViewSource,
  operation: ViewOperation,
  additionalSources?: Record<string, ViewSource>
): Promise<ViewCreationResult> {
  const parentTableName = parent.runtime.tableName
  const parentColumns = parent.runtime.columns

  if (!parentTableName || !parentColumns) {
    throw new Error('Missing parent runtime data for view creation')
  }

  const parentBaseName = extractBaseName(parentTableName)
  const viewName = generateViewName(operation.type, parentBaseName)

  // Build context for SQL generation
  const context: OperationContext = {
    sourceTableName: parentTableName,
    sourceColumns: parentColumns,
  }

  // Add additional sources for joins/unions
  if (additionalSources) {
    context.additionalSources = {}
    for (const [id, info] of Object.entries(additionalSources)) {
      if (!info.runtime.tableName || !info.runtime.columns) {
        throw new Error(`Missing runtime data for additional source ${id}`)
      }
      context.additionalSources[id] = {
        tableName: info.runtime.tableName,
        columns: info.runtime.columns,
      }
    }
  }

  // Build and execute CREATE VIEW
  const sql = buildCreateViewSql(viewName, operation, context)

  await client.execute(sql)

  // Get the schema (row count fetched async by caller to avoid blocking)
  const columns = await getViewSchema(client, viewName)

  // Determine parent IDs
  const parentIds = [parent.node.id]
  if (operation.type === 'join') {
    const joinOp = operation as { rightSourceId: string }
    parentIds.push(joinOp.rightSourceId)
  } else if (operation.type === 'union') {
    const unionOp = operation as { sourceIds: string[] }
    parentIds.push(...unionOp.sourceIds)
  }

  // Generate descriptive name
  const operationName = getOperationDisplayName(operation.type)
  const name = `${parent.node.name} → ${operationName}`

  return {
    view: {
      id: viewName,
      type: 'view',
      name,
      createdAt: new Date(),
      operation,
    },
    runtime: {
      tableName: viewName,
      columns,
      rowCount: null, // Fetched async by caller
      viewSql: sql,
    },
    parentIds,
  }
}

/**
 * Update an existing view's definition in place using CREATE OR REPLACE VIEW.
 * This preserves the view name so dependent views continue to work.
 */
export async function updateView(
  client: DuckDBClient,
  existingView: DataView,
  newViewOperation: ViewOperation,
  existingRuntime: NodeRuntime,
  parent: ViewSource,
  additionalSources?: Record<string, ViewSource>
): Promise<ViewUpdateResult> {
  const viewName = existingRuntime.tableName
  const parentTableName = parent.runtime.tableName
  const parentColumns = parent.runtime.columns

  if (!viewName) {
    throw new Error(`Missing runtime tableName for view ${existingView.id}`)
  }
  if (!parentTableName || !parentColumns) {
    throw new Error('Missing parent runtime data for view update')
  }

  // Build context for SQL generation
  const context: OperationContext = {
    sourceTableName: parentTableName,
    sourceColumns: parentColumns,
  }

  // Add additional sources for joins/unions
  if (additionalSources) {
    context.additionalSources = {}
    for (const [id, info] of Object.entries(additionalSources)) {
      if (!info.runtime.tableName || !info.runtime.columns) {
        throw new Error(`Missing runtime data for additional source ${id}`)
      }
      context.additionalSources[id] = {
        tableName: info.runtime.tableName,
        columns: info.runtime.columns,
      }
    }
  }

  // Build and execute CREATE OR REPLACE VIEW
  const selectSql = buildOperationSql(newViewOperation, context)
  const sql = `CREATE OR REPLACE VIEW ${escapeIdentifier(viewName)} AS ${selectSql}`
  await client.execute(sql)

  // Get the updated schema (row count fetched async by caller)
  const columns = await getViewSchema(client, viewName)

  return {
    runtime: {
      tableName: viewName,
      columns,
      rowCount: null,
      viewSql: sql,
    },
  }
}

/**
 * Drop a view
 */
export async function dropView(client: DuckDBClient, viewName: string): Promise<void> {
  const sql = buildDropViewSql(viewName)
  await client.execute(sql)
}

/**
 * Drop multiple views (for cascade delete)
 * Views are dropped in the order provided - caller should ensure correct order
 */
export async function dropViews(client: DuckDBClient, viewNames: string[]): Promise<void> {
  // Drop in reverse order to handle dependencies (children first)
  for (const viewName of [...viewNames].reverse()) {
    await dropView(client, viewName)
  }
}

/**
 * Create a view from a custom SQL query
 * Finds parent nodes by matching table names in the SQL
 */
export async function createSqlQueryView(
  client: DuckDBClient,
  sql: string,
  nodes: Record<string, PipelineNode>,
  runtimeById: Record<string, NodeRuntime>
): Promise<ViewCreationResult> {
  // Extract table names to find parent nodes
  const referencedTables = extractTableNames(sql)
  const parentNodes: PipelineNode[] = []
  for (const node of Object.values(nodes)) {
    const tableName = runtimeById[node.id]?.tableName
    if (tableName && referencedTables.includes(tableName)) {
      parentNodes.push(node)
    }
  }

  // Use first parent's base name for the view name
  const firstParentRuntime = parentNodes.length > 0 ? runtimeById[parentNodes[0].id] : undefined
  const parentBaseName = firstParentRuntime?.tableName ? extractBaseName(firstParentRuntime.tableName) : undefined
  const viewName = generateViewName('sql', parentBaseName)

  // Create the view
  const createSql = `CREATE VIEW ${escapeIdentifier(viewName)} AS ${sql}`
  await client.execute(createSql)

  // Get schema (row count fetched async by caller to avoid blocking)
  const columns = await getViewSchema(client, viewName)

  const operation: SqlQueryOperation = {
    type: 'sql',
    sql,
    referencedTables,
  }

  return {
    view: {
      id: viewName,
      type: 'view',
      name: `SQL Query`,
      createdAt: new Date(),
      operation,
    },
    runtime: {
      tableName: viewName,
      columns,
      rowCount: null,
      viewSql: createSql,
    },
    parentIds: parentNodes.map((n) => n.id),
  }
}

/**
 * Extract table names from SQL query (simple regex-based)
 * Looks for FROM and JOIN clauses
 */
function extractTableNames(sql: string): string[] {
  const tables: string[] = []
  // Match FROM tablename and JOIN tablename patterns
  // Handles both quoted "table" and unquoted table names
  const pattern = /(?:FROM|JOIN)\s+(?:"([^"]+)"|(\w+))/gi
  for (const match of sql.matchAll(pattern)) {
    const tableName = match[1] || match[2]
    if (tableName && !tables.includes(tableName)) {
      tables.push(tableName)
    }
  }
  return tables
}

/**
 * Get all views in DuckDB that match our naming pattern
 */
async function getOrphanedViews(client: DuckDBClient): Promise<string[]> {
  const result = await client.query<{ table_name: string }>(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_type = 'VIEW'
    AND table_name LIKE 'view_%'
  `)

  return result.rows.map((row) => row.table_name)
}

/**
 * Cleanup orphaned views that aren't tracked in the store
 */
export async function cleanupOrphanedViews(client: DuckDBClient, trackedViewNames: Set<string>): Promise<string[]> {
  const orphanedViews = await getOrphanedViews(client)
  const cleaned: string[] = []

  for (const viewName of orphanedViews) {
    if (!trackedViewNames.has(viewName)) {
      await dropView(client, viewName)
      cleaned.push(viewName)
    }
  }

  return cleaned
}
