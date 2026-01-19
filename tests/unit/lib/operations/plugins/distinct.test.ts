import { describe, expect, it } from 'vitest'
import { distinctPlugin } from '@/lib/operations/plugins/distinct'
import type { Column } from '@/types/dataset'
import type { DistinctOperation } from '@/types/pipeline'

const mockColumns: Column[] = [
  { name: 'id', type: 'INTEGER', nullable: false },
  { name: 'name', type: 'VARCHAR', nullable: true },
  { name: 'category', type: 'VARCHAR', nullable: true },
]

const mockContext = {
  sourceTableName: 'test_table',
  sourceColumns: mockColumns,
}

describe('distinctPlugin', () => {
  describe('validate', () => {
    it('returns valid operation with no columns (all columns distinct)', () => {
      const result = distinctPlugin.validate({}, mockColumns)
      expect(result.valid).toBe(true)
      expect(result.operation).toMatchObject({ type: 'distinct', columns: undefined })
      expect(result.errors).toHaveLength(0)
    })

    it('returns valid operation with specific columns', () => {
      const result = distinctPlugin.validate({ columns: ['name', 'category'] }, mockColumns)
      expect(result.valid).toBe(true)
      expect(result.operation).toMatchObject({ type: 'distinct', columns: ['name', 'category'] })
    })

    it('returns valid operation with single column', () => {
      const result = distinctPlugin.validate({ columns: ['id'] }, mockColumns)
      expect(result.valid).toBe(true)
      expect(result.operation).toMatchObject({ type: 'distinct', columns: ['id'] })
    })

    it('returns error for non-existent column', () => {
      const result = distinctPlugin.validate({ columns: ['nonexistent'] }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Column "nonexistent" does not exist')
    })

    it('returns error for multiple non-existent columns', () => {
      const result = distinctPlugin.validate({ columns: ['foo', 'bar'] }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(2)
    })

    it('returns error for mixed valid/invalid columns', () => {
      const result = distinctPlugin.validate({ columns: ['id', 'invalid'] }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Column "invalid" does not exist')
    })
  })

  describe('buildSql', () => {
    it('generates DISTINCT * for no columns', () => {
      const op: DistinctOperation = { type: 'distinct' }
      const sql = distinctPlugin.buildSql(op, mockContext)
      expect(sql).toBe('SELECT DISTINCT * FROM "test_table"')
    })

    it('generates DISTINCT ON for specific columns', () => {
      const op: DistinctOperation = { type: 'distinct', columns: ['name', 'category'] }
      const sql = distinctPlugin.buildSql(op, mockContext)
      expect(sql).toBe('SELECT DISTINCT ON ("name", "category") * FROM "test_table"')
    })

    it('generates DISTINCT ON for single column', () => {
      const op: DistinctOperation = { type: 'distinct', columns: ['id'] }
      const sql = distinctPlugin.buildSql(op, mockContext)
      expect(sql).toBe('SELECT DISTINCT ON ("id") * FROM "test_table"')
    })

    it('escapes table names with special characters', () => {
      const op: DistinctOperation = { type: 'distinct' }
      const sql = distinctPlugin.buildSql(op, { ...mockContext, sourceTableName: 'my-table' })
      expect(sql).toBe('SELECT DISTINCT * FROM "my-table"')
    })
  })

  describe('getSummary', () => {
    it('returns "All columns" for no specific columns', () => {
      const op: DistinctOperation = { type: 'distinct' }
      expect(distinctPlugin.getSummary(op)).toBe('All columns')
    })

    it('returns column names for few columns', () => {
      const op: DistinctOperation = { type: 'distinct', columns: ['a', 'b'] }
      expect(distinctPlugin.getSummary(op)).toBe('a, b')
    })

    it('returns column names for exactly 3 columns', () => {
      const op: DistinctOperation = { type: 'distinct', columns: ['a', 'b', 'c'] }
      expect(distinctPlugin.getSummary(op)).toBe('a, b, c')
    })

    it('returns count for more than 3 columns', () => {
      const op: DistinctOperation = { type: 'distinct', columns: ['a', 'b', 'c', 'd'] }
      expect(distinctPlugin.getSummary(op)).toBe('4 columns')
    })

    it('returns "All columns" for empty array', () => {
      const op: DistinctOperation = { type: 'distinct', columns: [] }
      expect(distinctPlugin.getSummary(op)).toBe('All columns')
    })
  })

  describe('metadata', () => {
    it('has correct type', () => {
      expect(distinctPlugin.type).toBe('distinct')
    })

    it('has correct category', () => {
      expect(distinctPlugin.category).toBe('query')
    })

    it('has tool definition', () => {
      expect(distinctPlugin.toolDefinition.name).toBe('distinct')
      expect(distinctPlugin.toolDefinition.description).toBeDefined()
    })
  })
})
