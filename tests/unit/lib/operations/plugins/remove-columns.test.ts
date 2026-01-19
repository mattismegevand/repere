import { describe, expect, it } from 'vitest'
import { removeColumnsPlugin } from '@/lib/operations/plugins/remove-columns'
import type { Column } from '@/types/dataset'
import type { RemoveColumnsOperation } from '@/types/pipeline'

const mockColumns: Column[] = [
  { name: 'id', type: 'INTEGER', nullable: false },
  { name: 'name', type: 'VARCHAR', nullable: true },
  { name: 'email', type: 'VARCHAR', nullable: true },
  { name: 'password_hash', type: 'VARCHAR', nullable: true },
]

const mockContext = {
  sourceTableName: 'users',
  sourceColumns: mockColumns,
}

describe('removeColumnsPlugin', () => {
  describe('validate', () => {
    it('returns valid operation with single column', () => {
      const result = removeColumnsPlugin.validate({ columns: ['password_hash'] }, mockColumns)
      expect(result.valid).toBe(true)
      expect(result.operation).toMatchObject({
        type: 'removeColumns',
        columns: ['password_hash'],
      })
      expect(result.errors).toHaveLength(0)
    })

    it('returns valid operation with multiple columns', () => {
      const result = removeColumnsPlugin.validate({ columns: ['email', 'password_hash'] }, mockColumns)
      expect(result.valid).toBe(true)
      expect((result.operation as RemoveColumnsOperation).columns).toHaveLength(2)
    })

    it('returns error for empty columns array', () => {
      const result = removeColumnsPlugin.validate({ columns: [] }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('removeColumns requires at least one column')
    })

    it('returns error for missing columns', () => {
      const result = removeColumnsPlugin.validate({}, mockColumns)
      expect(result.valid).toBe(false)
    })

    it('returns error for non-existent column', () => {
      const result = removeColumnsPlugin.validate({ columns: ['nonexistent'] }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Column "nonexistent" does not exist')
    })

    it('returns error for multiple non-existent columns', () => {
      const result = removeColumnsPlugin.validate({ columns: ['foo', 'bar'] }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(2)
    })

    it('returns warning when removing all columns', () => {
      const result = removeColumnsPlugin.validate({ columns: ['id', 'name', 'email', 'password_hash'] }, mockColumns)
      expect(result.valid).toBe(true)
      expect(result.warnings[0]).toContain('remove all columns')
    })

    it('returns warning when removing more columns than exist', () => {
      const result = removeColumnsPlugin.validate(
        { columns: ['id', 'name', 'email', 'password_hash', 'extra'] },
        mockColumns
      )
      // This should error because 'extra' doesn't exist
      expect(result.valid).toBe(false)
    })
  })

  describe('buildSql', () => {
    it('generates SELECT without removed column', () => {
      const op: RemoveColumnsOperation = { type: 'removeColumns', columns: ['password_hash'] }
      const sql = removeColumnsPlugin.buildSql(op, mockContext)
      expect(sql).toBe('SELECT "id", "name", "email" FROM "users"')
    })

    it('generates SELECT without multiple removed columns', () => {
      const op: RemoveColumnsOperation = {
        type: 'removeColumns',
        columns: ['email', 'password_hash'],
      }
      const sql = removeColumnsPlugin.buildSql(op, mockContext)
      expect(sql).toBe('SELECT "id", "name" FROM "users"')
    })

    it('preserves column order of remaining columns', () => {
      const op: RemoveColumnsOperation = { type: 'removeColumns', columns: ['name'] }
      const sql = removeColumnsPlugin.buildSql(op, mockContext)
      expect(sql).toBe('SELECT "id", "email", "password_hash" FROM "users"')
    })

    it('escapes table name', () => {
      const op: RemoveColumnsOperation = { type: 'removeColumns', columns: ['id'] }
      const sql = removeColumnsPlugin.buildSql(op, { ...mockContext, sourceTableName: 'user-data' })
      expect(sql).toContain('"user-data"')
    })
  })

  describe('getSummary', () => {
    it('returns "- column" for single column', () => {
      const op: RemoveColumnsOperation = { type: 'removeColumns', columns: ['password'] }
      expect(removeColumnsPlugin.getSummary(op)).toBe('- password')
    })

    it('returns count for multiple columns', () => {
      const op: RemoveColumnsOperation = { type: 'removeColumns', columns: ['a', 'b'] }
      expect(removeColumnsPlugin.getSummary(op)).toBe('- 2 columns')
    })

    it('returns count for many columns', () => {
      const op: RemoveColumnsOperation = { type: 'removeColumns', columns: ['a', 'b', 'c', 'd', 'e'] }
      expect(removeColumnsPlugin.getSummary(op)).toBe('- 5 columns')
    })
  })

  describe('merge', () => {
    it('merges two remove operations', () => {
      const existing: RemoveColumnsOperation = { type: 'removeColumns', columns: ['a'] }
      const incoming: RemoveColumnsOperation = { type: 'removeColumns', columns: ['b'] }
      const merged = removeColumnsPlugin.merge!(existing, incoming)
      expect(merged.columns).toContain('a')
      expect(merged.columns).toContain('b')
    })

    it('deduplicates when merging same column', () => {
      const existing: RemoveColumnsOperation = { type: 'removeColumns', columns: ['a'] }
      const incoming: RemoveColumnsOperation = { type: 'removeColumns', columns: ['a', 'b'] }
      const merged = removeColumnsPlugin.merge!(existing, incoming)
      expect(merged.columns).toHaveLength(2)
      expect(merged.columns.filter((c) => c === 'a')).toHaveLength(1)
    })

    it('canMerge returns true', () => {
      expect(removeColumnsPlugin.canMerge!({} as RemoveColumnsOperation, {} as RemoveColumnsOperation)).toBe(true)
    })
  })

  describe('metadata', () => {
    it('has correct type', () => {
      expect(removeColumnsPlugin.type).toBe('removeColumns')
    })

    it('has correct category', () => {
      expect(removeColumnsPlugin.category).toBe('column')
    })

    it('has tool definition with required columns parameter', () => {
      expect(removeColumnsPlugin.toolDefinition.name).toBe('removeColumns')
      expect(removeColumnsPlugin.toolDefinition.parameters.required).toContain('columns')
    })
  })
})
