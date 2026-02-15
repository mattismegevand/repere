import type { RuntimeColumn } from '@/types/pipelineRuntime'

export interface ColumnInfo {
  name: string
  duckdb_type: string
}

export interface QueryResult<T = Record<string, unknown>> {
  columns: ColumnInfo[]
  rows: T[]
  row_count: number
}

export interface LoadResult {
  table_name: string
  columns: ColumnInfo[]
  row_count: number
}

/**
 * Unified DuckDB client interface that both WASM and Tauri backends implement.
 */
export interface DuckDBClient {
  /** Execute a query and return rows */
  query<T = Record<string, unknown>>(sql: string): Promise<QueryResult<T>>

  /** Execute a statement without returning rows (CREATE, DROP, INSERT, etc.) */
  execute(sql: string): Promise<number>

  /** Load a file into DuckDB as a table */
  loadFile(tableName: string, source: File | string, fileType?: string): Promise<LoadResult>

  /** Get table/view schema via DESCRIBE */
  describe(tableName: string): Promise<RuntimeColumn[]>

  /** Get row count for a table/view */
  count(tableName: string): Promise<number>

  /** Export a table to Parquet file */
  exportParquet(tableName: string, outputPath: string): Promise<void>

  /** Export a table to Parquet bytes (for session embedding) */
  exportToBytes(tableName: string): Promise<Uint8Array>

  /** Load Parquet bytes into a table (for session restoration) */
  loadParquetBytes(tableName: string, bytes: Uint8Array): Promise<LoadResult>

  /** Check if the client is ready for queries */
  isReady(): boolean

  /** Register a file for WASM virtual filesystem (no-op in Tauri) */
  registerFile?(name: string, file: File): Promise<void>

  /** Drop a file from WASM virtual filesystem (no-op in Tauri) */
  dropFile?(name: string): Promise<void>

  /** Copy file to buffer from WASM virtual filesystem (no-op in Tauri) */
  copyFileToBuffer?(path: string): Promise<Uint8Array>
}

export class DuckDBError extends Error {
  sql: string
  originalError: string

  constructor(sql: string, originalError: string) {
    super(originalError)
    this.name = 'DuckDBError'
    this.sql = sql
    this.originalError = originalError
  }
}
