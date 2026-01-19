import { describe, expect, it } from 'vitest'
import { selectPlugin } from '@/lib/operations/plugins/select'
import type { Column } from '@/types/dataset'
import type { SelectOperation } from '@/types/pipeline'

const mockColumns: Column[] = [
  { name: 'id', type: 'INTEGER', nullable: false },
  { name: 'name', type: 'VARCHAR', nullable: true },
  { name: 'email', type: 'VARCHAR', nullable: true },
  { name: 'created_at', type: 'TIMESTAMP', nullable: true },
]

const mockContext = {
  sourceTableName: 'users',
  sourceColumns: mockColumns,
}

describe('selectPlugin', () => {
  describe('validate', () => {
    it('returns valid operation with single column', () => {
      const result = selectPlugin.validate({ columns: ['id'] }, mockColumns)
      expect(result.valid).toBe(true)
      expect(result.operation).toMatchObject({ type: 'select', columns: ['id'] })
      expect(result.errors).toHaveLength(0)
    })

    it('returns valid operation with multiple columns', () => {
      const result = selectPlugin.validate({ columns: ['id', 'name', 'email'] }, mockColumns)
      expect(result.valid).toBe(true)
      expect(result.operation).toMatchObject({ type: 'select', columns: ['id', 'name', 'email'] })
    })

    it('returns valid operation with all columns', () => {
      const result = selectPlugin.validate({ columns: ['id', 'name', 'email', 'created_at'] }, mockColumns)
      expect(result.valid).toBe(true)
    })

    it('returns error for empty columns array', () => {
      const result = selectPlugin.validate({ columns: [] }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Select requires at least one column')
    })

    it('returns error for missing columns', () => {
      const result = selectPlugin.validate({}, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Select requires at least one column')
    })

    it('returns error for non-array columns', () => {
      const result = selectPlugin.validate({ columns: 'id' }, mockColumns)
      expect(result.valid).toBe(false)
    })

    it('returns error for non-existent column', () => {
      const result = selectPlugin.validate({ columns: ['nonexistent'] }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Column "nonexistent" does not exist')
    })

    it('returns error for multiple non-existent columns', () => {
      const result = selectPlugin.validate({ columns: ['foo', 'bar'] }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(2)
    })

    it('returns error for mixed valid/invalid columns', () => {
      const result = selectPlugin.validate({ columns: ['id', 'invalid'] }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Column "invalid" does not exist')
    })

    it('preserves column order as specified', () => {
      const result = selectPlugin.validate({ columns: ['email', 'id', 'name'] }, mockColumns)
      expect(result.valid).toBe(true)
      expect((result.operation as SelectOperation).columns).toEqual(['email', 'id', 'name'])
    })
  })

  describe('buildSql', () => {
    it('generates SELECT for single column', () => {
      const op: SelectOperation = { type: 'select', columns: ['id'] }
      const sql = selectPlugin.buildSql(op, mockContext)
      expect(sql).toBe('SELECT "id" FROM "users"')
    })

    it('generates SELECT for multiple columns', () => {
      const op: SelectOperation = { type: 'select', columns: ['id', 'name', 'email'] }
      const sql = selectPlugin.buildSql(op, mockContext)
      expect(sql).toBe('SELECT "id", "name", "email" FROM "users"')
    })

    it('preserves column order in SQL', () => {
      const op: SelectOperation = { type: 'select', columns: ['email', 'id'] }
      const sql = selectPlugin.buildSql(op, mockContext)
      expect(sql).toBe('SELECT "email", "id" FROM "users"')
    })

    it('escapes column names with special characters', () => {
      const op: SelectOperation = { type: 'select', columns: ['user-id', 'first name'] }
      const sql = selectPlugin.buildSql(op, mockContext)
      expect(sql).toBe('SELECT "user-id", "first name" FROM "users"')
    })

    it('escapes table names with special characters', () => {
      const op: SelectOperation = { type: 'select', columns: ['id'] }
      const sql = selectPlugin.buildSql(op, { ...mockContext, sourceTableName: 'user-data' })
      expect(sql).toBe('SELECT "id" FROM "user-data"')
    })
  })

  describe('getSummary', () => {
    it('returns column name for single column', () => {
      const op: SelectOperation = { type: 'select', columns: ['id'] }
      expect(selectPlugin.getSummary(op)).toBe('id')
    })

    it('returns comma-separated names for 2 columns', () => {
      const op: SelectOperation = { type: 'select', columns: ['id', 'name'] }
      expect(selectPlugin.getSummary(op)).toBe('id, name')
    })

    it('returns comma-separated names for 3 columns', () => {
      const op: SelectOperation = { type: 'select', columns: ['id', 'name', 'email'] }
      expect(selectPlugin.getSummary(op)).toBe('id, name, email')
    })

    it('returns count for more than 3 columns', () => {
      const op: SelectOperation = { type: 'select', columns: ['a', 'b', 'c', 'd'] }
      expect(selectPlugin.getSummary(op)).toBe('4 columns selected')
    })

    it('returns count for many columns', () => {
      const op: SelectOperation = { type: 'select', columns: ['a', 'b', 'c', 'd', 'e', 'f'] }
      expect(selectPlugin.getSummary(op)).toBe('6 columns selected')
    })
  })

  describe('metadata', () => {
    it('has correct type', () => {
      expect(selectPlugin.type).toBe('select')
    })

    it('has correct category', () => {
      expect(selectPlugin.category).toBe('column')
    })

    it('has tool definition with required columns parameter', () => {
      expect(selectPlugin.toolDefinition.name).toBe('select')
      expect(selectPlugin.toolDefinition.parameters.required).toContain('columns')
    })
  })
})
