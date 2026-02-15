import * as duckdb from '@duckdb/duckdb-wasm'
import { queryMetrics } from '@/lib/dev'
import type { RuntimeColumn } from '@/types/pipelineRuntime'
import type { ColumnInfo, DuckDBClient, LoadResult, QueryResult } from './interface'
import { DuckDBError } from './interface'
import { mapDuckDBType } from './type-mapper'

/**
 * DuckDB-WASM implementation of DuckDBClient.
 * Wraps the existing WASM-based DuckDB for browser usage.
 */
export class WasmDuckDBClient implements DuckDBClient {
  private db: duckdb.AsyncDuckDB
  private conn: duckdb.AsyncDuckDBConnection
  private ready = false

  private constructor(db: duckdb.AsyncDuckDB, conn: duckdb.AsyncDuckDBConnection) {
    this.db = db
    this.conn = conn
    this.ready = true
  }

  static async create(): Promise<WasmDuckDBClient> {
    // Load DuckDB from jsDelivr CDN to avoid Cloudflare's 25MB file limit
    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles()
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES)

    const workerUrl = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker!}");`], { type: 'text/javascript' })
    )

    const worker = new Worker(workerUrl)
    const logger = import.meta.env.DEV ? new duckdb.ConsoleLogger() : new duckdb.VoidLogger()
    const db = new duckdb.AsyncDuckDB(logger, worker)
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
    URL.revokeObjectURL(workerUrl)

    const conn = await db.connect()
    return new WasmDuckDBClient(db, conn)
  }

  isReady(): boolean {
    return this.ready
  }

  async query<T = Record<string, unknown>>(sql: string): Promise<QueryResult<T>> {
    const start = import.meta.env.DEV ? performance.now() : 0
    try {
      const result = await this.conn.query(sql)
      const rows = result.toArray().map((row) => row.toJSON() as T)

      const columns: ColumnInfo[] = result.schema.fields.map((field) => ({
        name: field.name,
        duckdb_type: field.type.toString(),
      }))

      if (import.meta.env.DEV) {
        const duration = performance.now() - start
        // Categorize based on SQL pattern
        const category = this.categorizeQuery(sql)
        queryMetrics.record(category, duration, rows.length, sql)
      }

      return {
        columns,
        rows,
        row_count: rows.length,
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
      const result = await this.conn.query(sql)
      return result.numRows
    } catch (e) {
      throw new DuckDBError(sql, e instanceof Error ? e.message : String(e))
    }
  }

  async loadFile(tableName: string, source: File | string, fileType?: string): Promise<LoadResult> {
    if (typeof source === 'string') {
      throw new Error('WASM client requires File objects, not paths')
    }

    const file = source
    const ext = fileType || file.name.split('.').pop()?.toLowerCase() || ''

    // Register file in virtual filesystem
    await this.db.registerFileHandle(file.name, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true)

    let sql: string
    switch (ext) {
      case 'csv':
        sql = `CREATE TABLE "${tableName}" AS SELECT * FROM read_csv_auto('${file.name}')`
        break
      case 'json':
      case 'jsonl':
        sql = `CREATE TABLE "${tableName}" AS SELECT * FROM read_json_auto('${file.name}')`
        break
      case 'parquet':
        sql = `CREATE TABLE "${tableName}" AS SELECT * FROM read_parquet('${file.name}')`
        break
      case 'xlsx':
      case 'xls':
        await this.conn.query('INSTALL spatial; LOAD spatial;')
        sql = `CREATE TABLE "${tableName}" AS SELECT * FROM st_read('${file.name}')`
        break
      default:
        throw new Error(`Unsupported file type: ${ext}`)
    }

    await this.conn.query(sql)
    const columns = await this.describe(tableName)
    const rowCount = await this.count(tableName)

    return {
      table_name: tableName,
      columns: columns.map((c) => ({ name: c.name, duckdb_type: c.duckdbType || '' })),
      row_count: rowCount,
    }
  }

  async describe(tableName: string): Promise<RuntimeColumn[]> {
    const result = await this.conn.query(`DESCRIBE "${tableName}"`)
    const rows = result.toArray()

    return rows.map((row) => {
      const obj = row.toJSON() as { column_name: string; column_type: string; null: string }
      return {
        name: obj.column_name,
        type: mapDuckDBType(obj.column_type),
        nullable: obj.null !== 'NO',
        duckdbType: obj.column_type,
      }
    })
  }

  async count(tableName: string): Promise<number> {
    const result = await this.conn.query(`SELECT COUNT(*) as count FROM "${tableName}"`)
    const row = result.toArray()[0]?.toJSON() as { count: number | bigint } | undefined
    return Number(row?.count ?? 0)
  }

  async exportParquet(tableName: string, outputPath: string): Promise<void> {
    await this.conn.query(`COPY "${tableName}" TO '${outputPath}' (FORMAT PARQUET)`)
  }

  async exportToBytes(tableName: string): Promise<Uint8Array> {
    const path = `${tableName}.parquet`
    await this.conn.query(`COPY "${tableName}" TO '${path}' (FORMAT PARQUET)`)
    const buffer = await this.db.copyFileToBuffer(path)
    await this.db.dropFile(path)
    return buffer
  }

  async loadParquetBytes(tableName: string, bytes: Uint8Array): Promise<LoadResult> {
    const path = `${tableName}.parquet`
    await this.db.registerFileBuffer(path, bytes)
    await this.conn.query(`CREATE TABLE "${tableName}" AS SELECT * FROM read_parquet('${path}')`)
    await this.db.dropFile(path)

    const columns = await this.describe(tableName)
    const rowCount = await this.count(tableName)

    return {
      table_name: tableName,
      columns: columns.map((c) => ({ name: c.name, duckdb_type: c.duckdbType || '' })),
      row_count: rowCount,
    }
  }

  async registerFile(name: string, file: File): Promise<void> {
    await this.db.registerFileHandle(name, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true)
  }

  async dropFile(name: string): Promise<void> {
    await this.db.dropFile(name)
  }

  async copyFileToBuffer(path: string): Promise<Uint8Array> {
    return this.db.copyFileToBuffer(path)
  }
}
