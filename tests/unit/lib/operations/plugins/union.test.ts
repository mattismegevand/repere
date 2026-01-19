import { describe, expect, it } from 'vitest'
import { unionPlugin } from '@/lib/operations/plugins/union'
import type { Column } from '@/types/dataset'
import type { Dataset, UnionOperation } from '@/types/pipeline'

const mockColumns: Column[] = [
  { name: 'id', type: 'INTEGER', nullable: false },
  { name: 'name', type: 'VARCHAR', nullable: true },
]

const mockNodes: Record<string, Dataset> = {
  dataset1: {
    id: 'dataset1',
    type: 'dataset',
    name: 'Dataset 1',
    fileName: 'file1.csv',
    fileSize: 1000,
    rowCount: 100,
    columns: mockColumns,
    tableName: 'dataset_1',
    createdAt: new Date(),
    position: { x: 0, y: 0 },
  },
  dataset2: {
    id: 'dataset2',
    type: 'dataset',
    name: 'Dataset 2',
    fileName: 'file2.csv',
    fileSize: 2000,
    rowCount: 200,
    columns: mockColumns,
    tableName: 'dataset_2',
    createdAt: new Date(),
    position: { x: 100, y: 0 },
  },
}

const mockContext = {
  sourceTableName: 'source_table',
  sourceColumns: mockColumns,
  additionalSources: {
    dataset1: { tableName: 'dataset_1', columns: mockColumns },
    dataset2: { tableName: 'dataset_2', columns: mockColumns },
  },
}

describe('unionPlugin', () => {
  describe('validate', () => {
    it('returns valid operation with all mode', () => {
      const result = unionPlugin.validate({ sourceIds: ['dataset1'], mode: 'all' }, mockColumns, mockNodes)
      expect(result.valid).toBe(true)
      expect(result.operation).toMatchObject({
        type: 'union',
        sourceIds: ['dataset1'],
        mode: 'all',
      })
      expect(result.errors).toHaveLength(0)
    })

    it('returns valid operation with distinct mode', () => {
      const result = unionPlugin.validate({ sourceIds: ['dataset1'], mode: 'distinct' }, mockColumns, mockNodes)
      expect(result.valid).toBe(true)
      expect((result.operation as UnionOperation).mode).toBe('distinct')
    })

    it('returns valid operation with multiple sources', () => {
      const result = unionPlugin.validate({ sourceIds: ['dataset1', 'dataset2'], mode: 'all' }, mockColumns, mockNodes)
      expect(result.valid).toBe(true)
      expect((result.operation as UnionOperation).sourceIds).toHaveLength(2)
    })

    it('returns error for empty sourceIds', () => {
      const result = unionPlugin.validate({ sourceIds: [], mode: 'all' }, mockColumns, mockNodes)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('union requires at least one sourceId')
    })

    it('returns error for missing sourceIds', () => {
      const result = unionPlugin.validate({ mode: 'all' }, mockColumns, mockNodes)
      expect(result.valid).toBe(false)
    })

    it('returns error for invalid mode', () => {
      const result = unionPlugin.validate({ sourceIds: ['dataset1'], mode: 'invalid' }, mockColumns, mockNodes)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('mode to be "all" or "distinct"')
    })

    it('returns error for missing mode', () => {
      const result = unionPlugin.validate({ sourceIds: ['dataset1'] }, mockColumns, mockNodes)
      expect(result.valid).toBe(false)
    })

    it('returns error for non-existent source', () => {
      const result = unionPlugin.validate({ sourceIds: ['nonexistent'], mode: 'all' }, mockColumns, mockNodes)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Table with ID "nonexistent" does not exist')
    })

    it('returns error for multiple non-existent sources', () => {
      const result = unionPlugin.validate({ sourceIds: ['foo', 'bar'], mode: 'all' }, mockColumns, mockNodes)
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(2)
    })
  })

  describe('buildSql', () => {
    it('generates UNION ALL for all mode', () => {
      const op: UnionOperation = { type: 'union', sourceIds: ['dataset1'], mode: 'all' }
      const sql = unionPlugin.buildSql(op, mockContext)
      expect(sql).toContain('UNION ALL')
      expect(sql).toContain('"source_table"')
      expect(sql).toContain('"dataset_1"')
    })

    it('generates UNION for distinct mode', () => {
      const op: UnionOperation = { type: 'union', sourceIds: ['dataset1'], mode: 'distinct' }
      const sql = unionPlugin.buildSql(op, mockContext)
      expect(sql).toContain(' UNION ')
      expect(sql).not.toContain('UNION ALL')
    })

    it('generates multiple unions', () => {
      const op: UnionOperation = { type: 'union', sourceIds: ['dataset1', 'dataset2'], mode: 'all' }
      const sql = unionPlugin.buildSql(op, mockContext)
      expect(sql).toContain('"dataset_1"')
      expect(sql).toContain('"dataset_2"')
      expect((sql.match(/UNION ALL/g) || []).length).toBe(2)
    })

    it('throws error without additionalSources', () => {
      const op: UnionOperation = { type: 'union', sourceIds: ['dataset1'], mode: 'all' }
      expect(() => unionPlugin.buildSql(op, { ...mockContext, additionalSources: undefined })).toThrow(
        'Union requires additionalSources'
      )
    })
  })

  describe('getSummary', () => {
    it('returns summary with count and mode', () => {
      const op: UnionOperation = { type: 'union', sourceIds: ['a'], mode: 'all' }
      expect(unionPlugin.getSummary(op)).toBe('Union 1 sources (all)')
    })

    it('returns summary with multiple sources', () => {
      const op: UnionOperation = { type: 'union', sourceIds: ['a', 'b', 'c'], mode: 'distinct' }
      expect(unionPlugin.getSummary(op)).toBe('Union 3 sources (distinct)')
    })
  })

  describe('metadata', () => {
    it('has correct type', () => {
      expect(unionPlugin.type).toBe('union')
    })

    it('has correct category', () => {
      expect(unionPlugin.category).toBe('combine')
    })

    it('has tool definition with required parameters', () => {
      expect(unionPlugin.toolDefinition.name).toBe('union')
      expect(unionPlugin.toolDefinition.parameters.required).toContain('sourceIds')
      expect(unionPlugin.toolDefinition.parameters.required).toContain('mode')
    })
  })
})
