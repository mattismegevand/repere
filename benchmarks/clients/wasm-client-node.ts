import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { Worker as NodeWorker } from 'node:worker_threads'
import * as duckdb from '@duckdb/duckdb-wasm'
import type { ColumnInfo, LoadResult, QueryResult } from '../../src/lib/duckdb/interface'

/**
 * Wrapper to adapt Node.js Worker to Web Worker-like API that duckdb-wasm expects
 */
class WorkerWrapper {
  private worker: NodeWorker
  private listeners: Map<string, Set<(event: { data: unknown }) => void>> = new Map()

  constructor(scriptPath: string) {
    this.worker = new NodeWorker(scriptPath)

    // Forward messages with Web Worker-like event structure
    this.worker.on('message', (data) => {
      const event = { data }
      const callbacks = this.listeners.get('message')
      if (callbacks) {
        for (const cb of callbacks) {
          cb(event)
        }
      }
    })

    this.worker.on('error', (error) => {
      const event = { data: error }
      const callbacks = this.listeners.get('error')
      if (callbacks) {
        for (const cb of callbacks) {
          cb(event)
        }
      }
    })
  }

  addEventListener(type: string, callback: (event: { data: unknown }) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }
    this.listeners.get(type)!.add(callback)
  }

  removeEventListener(type: string, callback: (event: { data: unknown }) => void): void {
    this.listeners.get(type)?.delete(callback)
  }

  postMessage(data: unknown): void {
    this.worker.postMessage(data)
  }

  terminate(): Promise<number> {
    return this.worker.terminate()
  }
}

/**
 * DuckDB-WASM client adapter for Node.js/Bun benchmarking.
 * Uses the Node.js worker bundles from @duckdb/duckdb-wasm.
 */
export class WasmClientNode {
  private db: duckdb.AsyncDuckDB
  private conn: duckdb.AsyncDuckDBConnection
  private ready = false

  private constructor(db: duckdb.AsyncDuckDB, conn: duckdb.AsyncDuckDBConnection) {
    this.db = db
    this.conn = conn
    this.ready = true
  }

  static async create(): Promise<WasmClientNode> {
    // Locate the duckdb-wasm package
    const require = createRequire(import.meta.url)
    const duckdbPath = path.dirname(require.resolve('@duckdb/duckdb-wasm/package.json'))

    // Use Node.js bundles
    const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
      mvp: {
        mainModule: path.join(duckdbPath, 'dist', 'duckdb-mvp.wasm'),
        mainWorker: path.join(duckdbPath, 'dist', 'duckdb-node-mvp.worker.cjs'),
      },
      eh: {
        mainModule: path.join(duckdbPath, 'dist', 'duckdb-eh.wasm'),
        mainWorker: path.join(duckdbPath, 'dist', 'duckdb-node-eh.worker.cjs'),
      },
    }

    const bundle = await duckdb.selectBundle(MANUAL_BUNDLES)

    const logger = new duckdb.VoidLogger()
    const worker = new WorkerWrapper(bundle.mainWorker!)
    const db = new duckdb.AsyncDuckDB(logger, worker as unknown as Worker)
    await db.instantiate(bundle.mainModule)

    const conn = await db.connect()
    return new WasmClientNode(db, conn)
  }

  isReady(): boolean {
    return this.ready
  }

  async query<T = Record<string, unknown>>(sql: string): Promise<QueryResult<T>> {
    const result = await this.conn.query(sql)
    const rows = result.toArray().map((row) => row.toJSON() as T)

    const columns: ColumnInfo[] = result.schema.fields.map((field) => ({
      name: field.name,
      duckdb_type: field.type.toString(),
    }))

    return {
      columns,
      rows,
      row_count: rows.length,
    }
  }

  async execute(sql: string): Promise<number> {
    const result = await this.conn.query(sql)
    return result.numRows
  }

  /**
   * Load a file from filesystem into DuckDB.
   * For Node/Bun, we read the file into a buffer and register it.
   */
  async loadFile(tableName: string, filePath: string, fileType?: string): Promise<LoadResult> {
    const ext = fileType || path.extname(filePath).slice(1).toLowerCase()
    const fileName = path.basename(filePath)

    // Read file into buffer and register
    const buffer = await readFile(filePath)
    await this.db.registerFileBuffer(fileName, new Uint8Array(buffer))

    let sql: string
    switch (ext) {
      case 'csv':
        sql = `CREATE TABLE "${tableName}" AS SELECT * FROM read_csv_auto('${fileName}')`
        break
      case 'json':
      case 'jsonl':
        sql = `CREATE TABLE "${tableName}" AS SELECT * FROM read_json_auto('${fileName}')`
        break
      case 'parquet':
        sql = `CREATE TABLE "${tableName}" AS SELECT * FROM read_parquet('${fileName}')`
        break
      default:
        throw new Error(`Unsupported file type: ${ext}`)
    }

    await this.conn.query(sql)
    const columns = await this.describe(tableName)
    const rowCount = await this.count(tableName)

    // Clean up registered file
    await this.db.dropFile(fileName)

    return {
      table_name: tableName,
      columns: columns.map((c) => ({ name: c.name, duckdb_type: c.duckdb_type })),
      row_count: rowCount,
    }
  }

  async describe(tableName: string): Promise<ColumnInfo[]> {
    const result = await this.conn.query(`DESCRIBE "${tableName}"`)
    const rows = result.toArray()

    return rows.map((row) => {
      const obj = row.toJSON() as { column_name: string; column_type: string }
      return {
        name: obj.column_name,
        duckdb_type: obj.column_type,
      }
    })
  }

  async count(tableName: string): Promise<number> {
    const result = await this.conn.query(`SELECT COUNT(*) as count FROM "${tableName}"`)
    const row = result.toArray()[0]?.toJSON() as { count: number | bigint } | undefined
    return Number(row?.count ?? 0)
  }

  async dropTable(tableName: string): Promise<void> {
    await this.conn.query(`DROP TABLE IF EXISTS "${tableName}"`)
  }

  async dropView(viewName: string): Promise<void> {
    await this.conn.query(`DROP VIEW IF EXISTS "${viewName}"`)
  }

  async exportToBytes(tableName: string): Promise<Uint8Array> {
    const tempPath = `${tableName}_export.parquet`
    await this.conn.query(`COPY "${tableName}" TO '${tempPath}' (FORMAT PARQUET)`)
    const buffer = await this.db.copyFileToBuffer(tempPath)
    await this.db.dropFile(tempPath)
    return buffer
  }

  async loadParquetBytes(tableName: string, bytes: Uint8Array): Promise<LoadResult> {
    const tempPath = `${tableName}_import.parquet`
    await this.db.registerFileBuffer(tempPath, bytes)
    await this.conn.query(`CREATE TABLE "${tableName}" AS SELECT * FROM read_parquet('${tempPath}')`)
    await this.db.dropFile(tempPath)

    const columns = await this.describe(tableName)
    const rowCount = await this.count(tableName)

    return {
      table_name: tableName,
      columns,
      row_count: rowCount,
    }
  }

  async close(): Promise<void> {
    await this.conn.close()
    await this.db.terminate()
    this.ready = false
  }
}
