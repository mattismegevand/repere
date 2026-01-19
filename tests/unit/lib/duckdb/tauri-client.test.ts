import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('@/lib/duckdb/type-mapper', () => ({
  mapDuckDBType: vi.fn((type: string) => {
    const map: Record<string, string> = {
      VARCHAR: 'string',
      INTEGER: 'integer',
      BIGINT: 'integer',
      DOUBLE: 'number',
      BOOLEAN: 'boolean',
      TIMESTAMP: 'datetime',
    }
    return map[type] || 'string'
  }),
}))

import { invoke } from '@tauri-apps/api/core'
import { DuckDBError } from '@/lib/duckdb/interface'
import { TauriDuckDBClient } from '@/lib/duckdb/tauri-client'

const mockInvoke = vi.mocked(invoke)

describe('TauriDuckDBClient', () => {
  let client: TauriDuckDBClient

  beforeEach(() => {
    vi.clearAllMocks()
    client = new TauriDuckDBClient()
  })

  describe('isReady', () => {
    it('should return true immediately', () => {
      expect(client.isReady()).toBe(true)
    })
  })

  describe('query', () => {
    it('should invoke duckdb_query with correct parameters', async () => {
      const mockResult = {
        columns: [{ name: 'id', duckdb_type: 'INTEGER' }],
        rows: [{ id: 1 }, { id: 2 }],
        row_count: 2,
      }
      mockInvoke.mockResolvedValue(mockResult)

      const result = await client.query('SELECT * FROM test')

      expect(mockInvoke).toHaveBeenCalledWith('duckdb_query', { sql: 'SELECT * FROM test' })
      expect(result).toEqual(mockResult)
    })

    it('should wrap errors in DuckDBError', async () => {
      mockInvoke.mockRejectedValue(new Error('Table not found'))

      await expect(client.query('SELECT * FROM missing')).rejects.toThrow(DuckDBError)
      await expect(client.query('SELECT * FROM missing')).rejects.toThrow('Table not found')
    })

    it('should handle non-Error rejections', async () => {
      mockInvoke.mockRejectedValue('string error')

      await expect(client.query('SELECT 1')).rejects.toThrow(DuckDBError)
    })
  })

  describe('execute', () => {
    it('should invoke duckdb_execute with correct parameters', async () => {
      mockInvoke.mockResolvedValue(1)

      const result = await client.execute('CREATE TABLE foo (id INT)')

      expect(mockInvoke).toHaveBeenCalledWith('duckdb_execute', { sql: 'CREATE TABLE foo (id INT)' })
      expect(result).toBe(1)
    })

    it('should wrap errors in DuckDBError', async () => {
      mockInvoke.mockRejectedValue(new Error('Syntax error'))

      await expect(client.execute('INVALID SQL')).rejects.toThrow(DuckDBError)
    })
  })

  describe('loadFile', () => {
    it('should invoke duckdb_load_file with file path', async () => {
      const mockResult = {
        table_name: 'test_table',
        columns: [{ name: 'col1', duckdb_type: 'VARCHAR' }],
        row_count: 100,
      }
      mockInvoke.mockResolvedValue(mockResult)

      const result = await client.loadFile('test_table', '/path/to/file.csv')

      expect(mockInvoke).toHaveBeenCalledWith('duckdb_load_file', {
        tableName: 'test_table',
        filePath: '/path/to/file.csv',
        fileType: 'csv',
      })
      expect(result).toEqual(mockResult)
    })

    it('should throw error when given File object', async () => {
      const file = new File(['data'], 'test.csv')

      await expect(client.loadFile('test', file)).rejects.toThrow('Tauri client requires file paths, not File objects')
    })

    it('should use provided fileType over extension', async () => {
      mockInvoke.mockResolvedValue({ table_name: 't', columns: [], row_count: 0 })

      await client.loadFile('test', '/path/to/file.txt', 'csv')

      expect(mockInvoke).toHaveBeenCalledWith('duckdb_load_file', {
        tableName: 'test',
        filePath: '/path/to/file.txt',
        fileType: 'csv',
      })
    })

    it('should extract extension from path when fileType not provided', async () => {
      mockInvoke.mockResolvedValue({ table_name: 't', columns: [], row_count: 0 })

      await client.loadFile('test', '/path/to/data.parquet')

      expect(mockInvoke).toHaveBeenCalledWith('duckdb_load_file', {
        tableName: 'test',
        filePath: '/path/to/data.parquet',
        fileType: 'parquet',
      })
    })

    it('should handle different file types', async () => {
      mockInvoke.mockResolvedValue({ table_name: 't', columns: [], row_count: 0 })

      const fileTypes = ['csv', 'json', 'jsonl', 'parquet', 'xlsx']
      for (const ext of fileTypes) {
        await client.loadFile('test', `/path/file.${ext}`)
        expect(mockInvoke).toHaveBeenCalledWith('duckdb_load_file', {
          tableName: 'test',
          filePath: `/path/file.${ext}`,
          fileType: ext,
        })
      }
    })
  })

  describe('describe', () => {
    it('should invoke duckdb_describe and map types', async () => {
      mockInvoke.mockResolvedValue([
        { name: 'id', duckdb_type: 'INTEGER' },
        { name: 'name', duckdb_type: 'VARCHAR' },
        { name: 'created', duckdb_type: 'TIMESTAMP' },
      ])

      const result = await client.describe('my_table')

      expect(mockInvoke).toHaveBeenCalledWith('duckdb_describe', { tableName: 'my_table' })
      expect(result).toEqual([
        { name: 'id', type: 'integer', nullable: true, duckdbType: 'INTEGER' },
        { name: 'name', type: 'string', nullable: true, duckdbType: 'VARCHAR' },
        { name: 'created', type: 'datetime', nullable: true, duckdbType: 'TIMESTAMP' },
      ])
    })
  })

  describe('count', () => {
    it('should invoke duckdb_count', async () => {
      mockInvoke.mockResolvedValue(42)

      const result = await client.count('my_table')

      expect(mockInvoke).toHaveBeenCalledWith('duckdb_count', { tableName: 'my_table' })
      expect(result).toBe(42)
    })
  })

  describe('exportParquet', () => {
    it('should invoke duckdb_export_parquet', async () => {
      mockInvoke.mockResolvedValue(undefined)

      await client.exportParquet('my_table', '/output/data.parquet')

      expect(mockInvoke).toHaveBeenCalledWith('duckdb_export_parquet', {
        tableName: 'my_table',
        outputPath: '/output/data.parquet',
      })
    })
  })

  describe('exportToBytes', () => {
    it('should invoke duckdb_export_to_bytes and return Uint8Array', async () => {
      mockInvoke.mockResolvedValue([80, 65, 82, 49]) // PAR1 magic bytes

      const result = await client.exportToBytes('my_table')

      expect(mockInvoke).toHaveBeenCalledWith('duckdb_export_to_bytes', { tableName: 'my_table' })
      expect(result).toBeInstanceOf(Uint8Array)
      expect(Array.from(result)).toEqual([80, 65, 82, 49])
    })
  })

  describe('loadParquetBytes', () => {
    it('should invoke duckdb_load_parquet_bytes with byte array', async () => {
      const bytes = new Uint8Array([80, 65, 82, 49])
      const mockResult = {
        table_name: 'restored',
        columns: [{ name: 'id', duckdb_type: 'INTEGER' }],
        row_count: 10,
      }
      mockInvoke.mockResolvedValue(mockResult)

      const result = await client.loadParquetBytes('restored', bytes)

      expect(mockInvoke).toHaveBeenCalledWith('duckdb_load_parquet_bytes', {
        tableName: 'restored',
        bytes: [80, 65, 82, 49],
      })
      expect(result).toEqual(mockResult)
    })
  })

  describe('no-op methods', () => {
    it('registerFile should be a no-op', async () => {
      const file = new File(['data'], 'test.csv')
      await expect(client.registerFile('test', file)).resolves.toBeUndefined()
      expect(mockInvoke).not.toHaveBeenCalled()
    })

    it('dropFile should be a no-op', async () => {
      await expect(client.dropFile('test')).resolves.toBeUndefined()
      expect(mockInvoke).not.toHaveBeenCalled()
    })

    it('copyFileToBuffer should throw', async () => {
      await expect(client.copyFileToBuffer('/path/to/file')).rejects.toThrow(
        'copyFileToBuffer not supported in Tauri mode'
      )
    })
  })
})
