import { describe, expect, it } from 'vitest'
import { reorderColumnsPlugin } from '@/lib/operations/plugins/reorder-columns'
import type { Column } from '@/types/dataset'
import type { ReorderColumnsOperation } from '@/types/pipeline'

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

describe('reorderColumnsPlugin', () => {
  describe('validate', () => {
    it('returns valid operation with new order', () => {
      const result = reorderColumnsPlugin.validate({ order: ['name', 'email', 'id', 'created_at'] }, mockColumns)
      expect(result.valid).toBe(true)
      expect(result.operation).toMatchObject({
        type: 'reorderColumns',
        order: ['name', 'email', 'id', 'created_at'],
      })
      expect(result.errors).toHaveLength(0)
    })

    it('returns valid operation with same order as original', () => {
      const result = reorderColumnsPlugin.validate({ order: ['id', 'name', 'email', 'created_at'] }, mockColumns)
      expect(result.valid).toBe(true)
    })

    it('returns error for missing order array', () => {
      const result = reorderColumnsPlugin.validate({}, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('reorderColumns requires an order array')
    })

    it('returns error for non-array order', () => {
      const result = reorderColumnsPlugin.validate({ order: 'id' }, mockColumns)
      expect(result.valid).toBe(false)
    })

    it('returns error when column is missing from order', () => {
      const result = reorderColumnsPlugin.validate({ order: ['id', 'name', 'email'] }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Column "created_at" is missing from the order')
    })

    it('returns error when multiple columns are missing', () => {
      const result = reorderColumnsPlugin.validate({ order: ['id', 'name'] }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(2)
    })

    it('returns error for non-existent column in order', () => {
      const result = reorderColumnsPlugin.validate(
        { order: ['id', 'name', 'email', 'created_at', 'nonexistent'] },
        mockColumns
      )
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('"nonexistent" does not exist'))).toBe(true)
    })

    it('returns error for duplicate columns in order', () => {
      // Since the validation checks for missing and non-existent, duplicate would cause missing error
      const result = reorderColumnsPlugin.validate({ order: ['id', 'name', 'name', 'email'] }, mockColumns)
      expect(result.valid).toBe(false)
    })
  })

  describe('buildSql', () => {
    it('generates SELECT with new column order', () => {
      const op: ReorderColumnsOperation = {
        type: 'reorderColumns',
        order: ['name', 'email', 'id', 'created_at'],
      }
      const sql = reorderColumnsPlugin.buildSql(op, mockContext)
      expect(sql).toBe('SELECT "name", "email", "id", "created_at" FROM "users"')
    })

    it('preserves original order when unchanged', () => {
      const op: ReorderColumnsOperation = {
        type: 'reorderColumns',
        order: ['id', 'name', 'email', 'created_at'],
      }
      const sql = reorderColumnsPlugin.buildSql(op, mockContext)
      expect(sql).toBe('SELECT "id", "name", "email", "created_at" FROM "users"')
    })

    it('escapes column names with special characters', () => {
      const op: ReorderColumnsOperation = {
        type: 'reorderColumns',
        order: ['user-id', 'first name'],
      }
      const sql = reorderColumnsPlugin.buildSql(op, {
        ...mockContext,
        sourceColumns: [
          { name: 'user-id', type: 'INTEGER', nullable: false },
          { name: 'first name', type: 'VARCHAR', nullable: true },
        ],
      })
      expect(sql).toBe('SELECT "user-id", "first name" FROM "users"')
    })

    it('escapes table name', () => {
      const op: ReorderColumnsOperation = {
        type: 'reorderColumns',
        order: ['id', 'name', 'email', 'created_at'],
      }
      const sql = reorderColumnsPlugin.buildSql(op, { ...mockContext, sourceTableName: 'my-table' })
      expect(sql).toContain('"my-table"')
    })
  })

  describe('getSummary', () => {
    it('returns fixed message', () => {
      const op: ReorderColumnsOperation = {
        type: 'reorderColumns',
        order: ['a', 'b', 'c'],
      }
      expect(reorderColumnsPlugin.getSummary(op)).toBe('Column order changed')
    })
  })

  describe('metadata', () => {
    it('has correct type', () => {
      expect(reorderColumnsPlugin.type).toBe('reorderColumns')
    })

    it('has correct category', () => {
      expect(reorderColumnsPlugin.category).toBe('column')
    })

    it('has tool definition with required order parameter', () => {
      expect(reorderColumnsPlugin.toolDefinition.name).toBe('reorderColumns')
      expect(reorderColumnsPlugin.toolDefinition.parameters.required).toContain('order')
    })
  })
})
