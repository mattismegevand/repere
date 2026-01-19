import { invoke } from '@tauri-apps/api/core'
import { queryMetrics } from '@/lib/dev'
import type { Column } from '@/types/dataset'
import type { ColumnInfo, DuckDBClient, LoadResult, QueryResult } from './interface'
import { DuckDBError } from './interface'
import { mapDuckDBType } from './type-mapper'

interface TauriQueryResult {
  columns: ColumnInfo[]
  rows: Record<string, unknown>[]
  row_count: number
}

interface TauriLoadResult {
  table_name: string
  columns: ColumnInfo[]
  row_count: number
}

/**
 * Tauri/native DuckDB implementation of DuckDBClient.
 * Uses IPC to communicate with the Rust backend.
 */
export class TauriDuckDBClient implements DuckDBClient {
  private ready = true

  isReady(): boolean {
    return this.ready
  }

  async query<T = Record<string, unknown>>(sql: string): Promise<QueryResult<T>> {
    const start = import.meta.env.DEV ? performance.now() : 0
    try {
      const result = await invoke<TauriQueryResult>('duckdb_query', { sql })

      if (import.meta.env.DEV) {
        const duration = performance.now() - start
        const category = this.categorizeQuery(sql)
        queryMetrics.record(category, duration, result.row_count, sql)
      }

      return {
        columns: result.columns,
        rows: result.rows as T[],
        row_count: result.row_count,
      }
    } catch (e) {
      throw new DuckDBError(sql, e instanceof Error ? e.message : String(e))
    }
  }

  private categorizeQuery(sql: string): 'grid-rows' | 'row-count' | 'schema' | 'chart-data' | 'other' {
    const upper = sql.toUpperCase().trim()
    if (upper.startsWith('DESCRIBE')) return 'schema'
    if (upper.includes('COUNT(*)') && !upper.includes('GROUP BY')) return 'row-count'
    if (upper.includes('GROUP BY') || upper.includes('SUM(') || upper.includes('AVG(')) return 'chart-data'
    if (upper.includes('LIMIT') || upper.includes('OFFSET')) return 'grid-rows'
    return 'other'
  }

  async execute(sql: string): Promise<number> {
    try {
      return await invoke<number>('duckdb_execute', { sql })
    } catch (e) {
      throw new DuckDBError(sql, e instanceof Error ? e.message : String(e))
    }
  }

  async loadFile(tableName: string, source: File | string, fileType?: string): Promise<LoadResult> {
    if (source instanceof File) {
      throw new Error('Tauri client requires file paths, not File objects')
    }

    const filePath = source
    const ext = fileType || filePath.split('.').pop()?.toLowerCase() || ''

    try {
      const result = await invoke<TauriLoadResult>('duckdb_load_file', {
        tableName,
        filePath,
        fileType: ext,
      })
      return result
    } catch (e) {
      throw new DuckDBError(`LOAD FILE ${filePath}`, e instanceof Error ? e.message : String(e))
    }
  }

  async describe(tableName: string): Promise<Column[]> {
    const columns = await invoke<ColumnInfo[]>('duckdb_describe', { tableName })
    return columns.map((c) => ({
      name: c.name,
      type: mapDuckDBType(c.duckdb_type),
      nullable: true, // DuckDB describe doesn't easily provide this
      duckdbType: c.duckdb_type,
    }))
  }

  async count(tableName: string): Promise<number> {
    return await invoke<number>('duckdb_count', { tableName })
  }

  async exportParquet(tableName: string, outputPath: string): Promise<void> {
    await invoke('duckdb_export_parquet', { tableName, outputPath })
  }

  async exportToBytes(tableName: string): Promise<Uint8Array> {
    const bytes = await invoke<number[]>('duckdb_export_to_bytes', { tableName })
    return new Uint8Array(bytes)
  }

  async loadParquetBytes(tableName: string, bytes: Uint8Array): Promise<LoadResult> {
    const result = await invoke<TauriLoadResult>('duckdb_load_parquet_bytes', {
      tableName,
      bytes: Array.from(bytes),
    })
    return result
  }

  // These methods are no-ops for Tauri since it uses the real filesystem
  async registerFile(_name: string, _file: File): Promise<void> {
    // No-op: Tauri uses filesystem paths directly
  }

  async dropFile(_name: string): Promise<void> {
    // No-op: Tauri uses filesystem paths directly
  }

  async copyFileToBuffer(_path: string): Promise<Uint8Array> {
    throw new Error('copyFileToBuffer not supported in Tauri mode')
  }
}
