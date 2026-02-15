import type { DuckDBClient } from '@/lib/duckdb/interface'
import { generateDatasetTableName } from '@/lib/duckdb/sql-builder'
import { mapColumnTypeToDuckDB, mapDuckDBType } from '@/lib/duckdb/type-mapper'
import {
  cleanupOrphanedViews,
  createView as createDuckDBView,
  dropView,
  dropViews,
  getViewRowCount,
  getViewSchema,
  updateView as updateDuckDBView,
  type ViewCreationResult,
  type ViewSource,
  type ViewUpdateResult,
} from '@/lib/duckdb/view-manager'
import { computeFileHash, getFileExtension } from '@/lib/file-system'
import { getTopologicalOrder } from '@/lib/graph'
import { isNativeRuntime } from '@/lib/runtime'
import type { Dataset, DataView, PipelineNode, ViewOperation } from '@/types'
import type { NodeRuntime, RuntimeColumn } from '@/types/pipelineRuntime'
import type { SessionData } from './persistence'

export interface CreateDatasetResult {
  id: string
  tableName: string
  columns: RuntimeColumn[]
  rowCount: number | null // null = computing in background
  fileHash: string | undefined // undefined = computing in background
}

/**
 * Service class for all DuckDB pipeline operations.
 * Stateless - all state is managed by Zustand store.
 */
export class PipelineService {
  readonly client: DuckDBClient

  constructor(client: DuckDBClient) {
    this.client = client
  }

  // ============================================
  // DATASET OPERATIONS
  // ============================================

  async createDatasetFromFile(file: File): Promise<CreateDatasetResult> {
    const ext = getFileExtension(file.name)
    const tableName = generateDatasetTableName(file.name)
    const id = tableName // Use tableName as id for consistency

    // Register file in virtual filesystem (WASM only, no-op for Tauri)
    if (this.client.registerFile) {
      await this.client.registerFile(file.name, file)
    }

    if (ext === 'csv') {
      await this.client.execute(`CREATE TABLE "${tableName}" AS SELECT * FROM read_csv_auto('${file.name}')`)
    } else if (ext === 'json' || ext === 'jsonl') {
      await this.client.execute(`CREATE TABLE "${tableName}" AS SELECT * FROM read_json_auto('${file.name}')`)
    } else if (ext === 'parquet') {
      await this.client.execute(`CREATE TABLE "${tableName}" AS SELECT * FROM read_parquet('${file.name}')`)
    } else if (ext === 'xlsx') {
      await this.client.execute('INSTALL spatial; LOAD spatial;')
      await this.client.execute(`CREATE TABLE "${tableName}" AS SELECT * FROM st_read('${file.name}')`)
    } else {
      throw new Error(`Unsupported file type: ${ext}`)
    }

    const columns = await this.client.describe(tableName)

    // Return immediately with null rowCount and undefined fileHash
    // These will be computed in background by the caller
    return { id, tableName, columns, rowCount: null, fileHash: undefined }
  }

  /**
   * Compute row count for a table (background task)
   */
  async computeRowCount(tableName: string): Promise<number> {
    return this.client.count(tableName)
  }

  /**
   * Compute file hash (background task)
   */
  async computeFileHash(file: File): Promise<string> {
    return computeFileHash(file)
  }

  async createDatasetFromPath(filePath: string, fileName: string): Promise<CreateDatasetResult> {
    if (!isNativeRuntime()) {
      throw new Error('createDatasetFromPath is only available in Tauri mode')
    }

    const ext = getFileExtension(fileName)
    const tableName = generateDatasetTableName(fileName)
    const id = tableName // Use tableName as id for consistency
    // File hash not available for path-based loading in native mode
    const fileHash = `path:${filePath}`

    const result = await this.client.loadFile(tableName, filePath, ext)

    return {
      id,
      tableName,
      columns: result.columns.map((c) => ({
        name: c.name,
        type: mapDuckDBType(c.duckdb_type),
        nullable: true,
        duckdbType: c.duckdb_type,
      })),
      rowCount: result.row_count,
      fileHash,
    }
  }

  async fillPlaceholderTable(tableName: string, file: File): Promise<void> {
    const ext = getFileExtension(file.name)

    await this.client.execute(`DROP TABLE IF EXISTS "${tableName}"`)

    // Register file in virtual filesystem (WASM only, no-op for Tauri)
    if (this.client.registerFile) {
      await this.client.registerFile(file.name, file)
    }

    if (ext === 'csv') {
      await this.client.execute(`CREATE TABLE "${tableName}" AS SELECT * FROM read_csv_auto('${file.name}')`)
    } else if (ext === 'json' || ext === 'jsonl') {
      await this.client.execute(`CREATE TABLE "${tableName}" AS SELECT * FROM read_json_auto('${file.name}')`)
    } else if (ext === 'parquet') {
      await this.client.execute(`CREATE TABLE "${tableName}" AS SELECT * FROM read_parquet('${file.name}')`)
    } else if (ext === 'xlsx') {
      // XLSX via File objects only works in browser (spatial extension)
      if (isNativeRuntime()) {
        throw new Error('XLSX files must be loaded via file path in desktop mode')
      }
      await this.client.execute('INSTALL spatial; LOAD spatial;')
      await this.client.execute(`CREATE TABLE "${tableName}" AS SELECT * FROM st_read('${file.name}')`)
    } else {
      throw new Error(`Unsupported file type: ${ext}`)
    }

    // Row count and file hash are computed in background by the caller
  }

  async dropDatasetTable(tableName: string): Promise<void> {
    await this.client.execute(`DROP TABLE IF EXISTS "${tableName}"`)
  }

  // ============================================
  // VIEW OPERATIONS
  // ============================================

  async createView(
    parent: ViewSource,
    operation: ViewOperation,
    additionalSources?: Record<string, ViewSource>
  ): Promise<ViewCreationResult> {
    return createDuckDBView(this.client, parent, operation, additionalSources)
  }

  async updateView(
    existingView: DataView,
    existingRuntime: NodeRuntime,
    newOperation: ViewOperation,
    parent: ViewSource,
    additionalSources?: Record<string, ViewSource>
  ): Promise<ViewUpdateResult> {
    return updateDuckDBView(this.client, existingView, newOperation, existingRuntime, parent, additionalSources)
  }

  async dropView(viewName: string): Promise<void> {
    await dropView(this.client, viewName)
  }

  async dropViews(viewNames: string[]): Promise<void> {
    await dropViews(this.client, viewNames)
  }

  async getViewSchema(viewName: string): Promise<RuntimeColumn[]> {
    return getViewSchema(this.client, viewName)
  }

  async getViewRowCount(viewName: string): Promise<number> {
    return getViewRowCount(this.client, viewName)
  }

  // ============================================
  // SESSION OPERATIONS
  // ============================================

  async restoreSession(
    data: SessionData,
    providedFiles: Map<string, File>,
    placeholderIds: Set<string> = new Set()
  ): Promise<Record<string, PipelineNode>> {
    const { nodes: parsedNodes, edges: parsedEdges, embeddedFiles } = data

    const order = getTopologicalOrder(parsedNodes, parsedEdges)

    for (const nodeId of order) {
      const node = parsedNodes[nodeId]

      if (node.type === 'dataset') {
        const dataset = node as Dataset

        if (placeholderIds.has(nodeId)) {
          const columnDefs = dataset.columns
            .map((col) => {
              const colType = col.duckdbType || mapColumnTypeToDuckDB(col.type)
              return `"${col.name}" ${colType}${col.nullable === false ? ' NOT NULL' : ''}`
            })
            .join(', ')
          await this.client.execute(`CREATE TABLE "${dataset.tableName}" (${columnDefs})`)
          ;(parsedNodes[nodeId] as Dataset).isPlaceholder = true
          ;(parsedNodes[nodeId] as Dataset).rowCount = 0
          continue
        }

        // Check for embedded Parquet file first
        const embeddedFile = embeddedFiles.get(nodeId)

        if (embeddedFile) {
          // Embedded data is stored as Parquet
          const bytes = new Uint8Array(await embeddedFile.arrayBuffer())
          await this.client.loadParquetBytes(dataset.tableName, bytes)
        } else {
          // User-provided file for large datasets
          const file = providedFiles.get(nodeId)
          if (!file) throw new Error(`Missing file for dataset: ${dataset.fileName}`)

          // Register file in virtual filesystem (WASM only, no-op for Tauri)
          if (this.client.registerFile) {
            await this.client.registerFile(file.name, file)
          }

          const ext = getFileExtension(file.name)
          if (ext === 'csv') {
            await this.client.execute(
              `CREATE TABLE "${dataset.tableName}" AS SELECT * FROM read_csv_auto('${file.name}')`
            )
          } else if (ext === 'json' || ext === 'jsonl') {
            await this.client.execute(
              `CREATE TABLE "${dataset.tableName}" AS SELECT * FROM read_json_auto('${file.name}')`
            )
          } else if (ext === 'parquet') {
            await this.client.execute(
              `CREATE TABLE "${dataset.tableName}" AS SELECT * FROM read_parquet('${file.name}')`
            )
          } else if (ext === 'xlsx') {
            // XLSX via File objects only works in browser (spatial extension)
            if (isNativeRuntime()) {
              throw new Error('XLSX files must be loaded via file path in desktop mode')
            }
            await this.client.execute('INSTALL spatial; LOAD spatial;')
            await this.client.execute(`CREATE TABLE "${dataset.tableName}" AS SELECT * FROM st_read('${file.name}')`)
          }
        }
      } else if (node.type === 'view') {
        // Only DataView nodes have SQL to execute - chart/export nodes don't create DuckDB views
        const view = node as DataView
        try {
          await this.client.execute(view.viewSql)
          await this.client.query(`SELECT 1 FROM ${view.tableName} LIMIT 0`)
        } catch (err) {
          console.error(`Failed to create view ${view.name}:`, err)
          throw new Error(
            `Failed to create view "${view.name}": ${err instanceof Error ? err.message : 'Unknown error'}`
          )
        }
      }
      // Chart and export nodes don't need DuckDB views - they query parent's table directly
    }

    if (placeholderIds.size > 0) {
      // Fetch row counts for all views in parallel
      const viewNodes = order
        .map((nodeId) => ({ nodeId, node: parsedNodes[nodeId] }))
        .filter((item): item is { nodeId: string; node: DataView } => item.node.type === 'view')

      await Promise.all(
        viewNodes.map(async ({ nodeId, node }) => {
          try {
            const rowCount = await this.getViewRowCount(node.tableName)
            ;(parsedNodes[nodeId] as DataView).rowCount = rowCount
          } catch {
            ;(parsedNodes[nodeId] as DataView).rowCount = 0
          }
        })
      )
    }

    return parsedNodes
  }

  async clearAll(nodes: Record<string, PipelineNode>): Promise<void> {
    const views = Object.values(nodes).filter((n): n is DataView => n.type === 'view')
    for (const view of views) {
      await this.client.execute(`DROP VIEW IF EXISTS "${view.tableName}"`)
    }

    const datasets = Object.values(nodes).filter((n): n is Dataset => n.type === 'dataset')
    for (const dataset of datasets) {
      await this.client.execute(`DROP TABLE IF EXISTS "${dataset.tableName}"`)
    }
  }

  // ============================================
  // SNAPSHOT RESTORATION
  // ============================================

  async recreateView(viewSql: string): Promise<void> {
    await this.client.execute(viewSql)
  }

  // ============================================
  // SCHEMA EXTRACTION
  // ============================================

  async extractFileSchema(file: File): Promise<RuntimeColumn[]> {
    const ext = file.name.split('.').pop()?.toLowerCase()
    const tempTableName = `_schema_temp_${Date.now()}`

    // Register file in virtual filesystem (WASM only, no-op for Tauri)
    if (this.client.registerFile) {
      await this.client.registerFile(file.name, file)
    }

    if (ext === 'csv') {
      await this.client.execute(
        `CREATE TEMP TABLE "${tempTableName}" AS SELECT * FROM read_csv_auto('${file.name}') LIMIT 0`
      )
    } else if (ext === 'json' || ext === 'jsonl') {
      await this.client.execute(
        `CREATE TEMP TABLE "${tempTableName}" AS SELECT * FROM read_json_auto('${file.name}') LIMIT 0`
      )
    } else if (ext === 'parquet') {
      await this.client.execute(
        `CREATE TEMP TABLE "${tempTableName}" AS SELECT * FROM read_parquet('${file.name}') LIMIT 0`
      )
    } else if (ext === 'xlsx') {
      // XLSX via File objects only works in browser (spatial extension)
      if (isNativeRuntime()) {
        throw new Error('XLSX files must be loaded via file path in desktop mode')
      }
      await this.client.execute('INSTALL spatial; LOAD spatial;')
      await this.client.execute(`CREATE TEMP TABLE "${tempTableName}" AS SELECT * FROM st_read('${file.name}') LIMIT 0`)
    } else {
      throw new Error(`Unsupported file type: ${ext}`)
    }

    const columns = await this.client.describe(tempTableName)
    await this.client.execute(`DROP TABLE IF EXISTS "${tempTableName}"`)
    return columns
  }

  // ============================================
  // EXPORT OPERATIONS
  // ============================================

  async exportToParquetBytes(tableName: string): Promise<Uint8Array> {
    return this.client.exportToBytes(tableName)
  }

  // ============================================
  // CLEANUP
  // ============================================

  async cleanupOrphanedViews(trackedViewNames: Set<string>): Promise<string[]> {
    return cleanupOrphanedViews(this.client, trackedViewNames)
  }
}
