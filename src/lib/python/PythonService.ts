/**
 * PythonService - Unified Python execution service
 *
 * Automatically detects the platform and uses the appropriate executor:
 * - Web: Pyodide (Python in WebAssembly) - uses JSON for data transfer
 * - Tauri/Desktop: Native Python subprocess - uses Parquet for data transfer
 */

import type { DuckDBClient } from '@/lib/duckdb/interface'
import { isTauri } from '@/lib/platform'
import type { PythonExecutionResult, PythonExecutor, PythonServiceStatus } from './types'

type StatusChangeCallback = (status: PythonServiceStatus, message?: string) => void

export class PythonService {
  private executor: PythonExecutor | null = null
  private duckdbClient: DuckDBClient | null = null
  private statusCallbacks: StatusChangeCallback[] = []
  private currentStatus: PythonServiceStatus = 'unavailable'
  private statusMessage: string | undefined
  private isWeb: boolean = !isTauri()

  async setDuckDBClient(client: DuckDBClient): Promise<void> {
    this.duckdbClient = client
  }

  onStatusChange(callback: StatusChangeCallback): () => void {
    this.statusCallbacks.push(callback)
    // Immediately call with current status
    callback(this.currentStatus, this.statusMessage)
    return () => {
      const index = this.statusCallbacks.indexOf(callback)
      if (index !== -1) {
        this.statusCallbacks.splice(index, 1)
      }
    }
  }

  private notifyStatusChange(status: PythonServiceStatus, message?: string) {
    this.currentStatus = status
    this.statusMessage = message
    for (const callback of this.statusCallbacks) {
      callback(status, message)
    }
  }

  /**
   * Initialize the Python execution environment
   * This is lazy-loaded - only call when user first opens Python panel
   */
  async initialize(): Promise<void> {
    if (this.executor) {
      // Already initialized
      return
    }

    this.notifyStatusChange('loading', 'Initializing Python environment...')

    try {
      if (isTauri()) {
        // Use Tauri native executor
        const { TauriExecutor } = await import('./tauri/TauriExecutor')
        this.executor = new TauriExecutor()
        this.isWeb = false
      } else {
        // Use Pyodide for web
        const { PyodideExecutor } = await import('./pyodide/PyodideExecutor')
        this.executor = new PyodideExecutor()
        this.isWeb = true
      }

      // Subscribe to executor status changes
      if ('onStatusChange' in this.executor) {
        ;(this.executor as { onStatusChange: (cb: StatusChangeCallback) => void }).onStatusChange((status, message) => {
          this.notifyStatusChange(status, message)
        })
      }

      await this.executor.initialize()
      this.notifyStatusChange('ready')
    } catch (error) {
      this.notifyStatusChange('unavailable')
      throw error
    }
  }

  /**
   * Execute Python code on a DataFrame from a DuckDB table
   *
   * @param code Python code to execute. Should set `result` variable to a DataFrame.
   * @param inputTableName DuckDB table/view name to use as input `df`
   * @returns Execution result with output data (JSON for web, Parquet for Tauri)
   */
  async execute(code: string, inputTableName: string): Promise<PythonExecutionResult> {
    if (!this.executor) {
      await this.initialize()
    }

    if (!this.executor) {
      return {
        success: false,
        error: 'Python executor not available',
        stdout: '',
        stderr: '',
        executionTimeMs: 0,
      }
    }

    if (!this.duckdbClient) {
      return {
        success: false,
        error: 'DuckDB client not available',
        stdout: '',
        stderr: '',
        executionTimeMs: 0,
      }
    }

    try {
      if (this.isWeb && this.executor.executeJson) {
        // Web: Use JSON for data transfer
        const inputJson = await this.exportTableAsJson(inputTableName)
        return await this.executor.executeJson(code, inputJson)
      } else if (!this.isWeb && this.executor.executeParquet) {
        // Tauri: Use Parquet for data transfer
        const inputData = await this.duckdbClient.exportToBytes(inputTableName)
        return await this.executor.executeParquet(code, inputData)
      } else {
        return {
          success: false,
          error: 'Executor does not support the required execution method',
          stdout: '',
          stderr: '',
          executionTimeMs: 0,
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stdout: '',
        stderr: '',
        executionTimeMs: 0,
      }
    }
  }

  /**
   * Export a DuckDB table as JSON string
   */
  private async exportTableAsJson(tableName: string): Promise<string> {
    if (!this.duckdbClient) {
      throw new Error('DuckDB client not available')
    }

    // Query all rows and convert to JSON
    const result = await this.duckdbClient.query(`SELECT * FROM "${tableName}"`)
    return JSON.stringify(result.rows)
  }

  /**
   * Import result data as a DuckDB table
   * Handles both JSON (web) and Parquet (Tauri) formats
   */
  async importResultAsTable(result: PythonExecutionResult, tableName: string): Promise<void> {
    if (!this.duckdbClient) {
      throw new Error('DuckDB client not available')
    }

    if (result.outputJson) {
      // Web: Import from JSON
      await this.importJsonAsTable(result.outputJson, tableName)
    } else if (result.outputData) {
      // Tauri: Import from Parquet bytes
      await this.duckdbClient.loadParquetBytes(tableName, result.outputData)
    } else {
      throw new Error('No output data to import')
    }
  }

  /**
   * Import JSON string as a DuckDB table
   */
  private async importJsonAsTable(json: string, tableName: string): Promise<void> {
    if (!this.duckdbClient) {
      throw new Error('DuckDB client not available')
    }

    // Parse JSON and create table with INSERT statements
    const rows = JSON.parse(json) as Record<string, unknown>[]

    if (rows.length === 0) {
      // Create empty table - need to infer schema from somewhere
      // For now, create a minimal placeholder
      await this.duckdbClient.execute(`CREATE TABLE "${tableName}" (empty_result BOOLEAN)`)
      return
    }

    // Get column names from first row
    const columns = Object.keys(rows[0])

    // Create table using first row to infer types
    // DuckDB can infer types from JSON values
    const firstRowValues = columns.map((col) => {
      const val = rows[0][col]
      if (val === null) return 'NULL'
      if (typeof val === 'string') return `'${String(val).replace(/'/g, "''")}'`
      if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE'
      return String(val)
    })

    await this.duckdbClient.execute(`
      CREATE TABLE "${tableName}" AS
      SELECT ${columns.map((col, i) => `${firstRowValues[i]} AS "${col}"`).join(', ')}
      WHERE FALSE
    `)

    // Insert all rows
    if (rows.length > 0) {
      const valueStrings = rows.map((row) => {
        const values = columns.map((col) => {
          const val = row[col]
          if (val === null || val === undefined) return 'NULL'
          if (typeof val === 'string') return `'${String(val).replace(/'/g, "''")}'`
          if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE'
          return String(val)
        })
        return `(${values.join(', ')})`
      })

      // Insert in batches to avoid query size limits
      const batchSize = 1000
      for (let i = 0; i < valueStrings.length; i += batchSize) {
        const batch = valueStrings.slice(i, i + batchSize)
        await this.duckdbClient.execute(`
          INSERT INTO "${tableName}" (${columns.map((c) => `"${c}"`).join(', ')})
          VALUES ${batch.join(', ')}
        `)
      }
    }
  }

  getStatus(): PythonServiceStatus {
    return this.currentStatus
  }

  dispose(): void {
    if (this.executor) {
      this.executor.dispose()
      this.executor = null
    }
    this.notifyStatusChange('unavailable')
  }
}

// Singleton instance
let pythonServiceInstance: PythonService | null = null

export function getPythonService(): PythonService {
  if (!pythonServiceInstance) {
    pythonServiceInstance = new PythonService()
  }
  return pythonServiceInstance
}
