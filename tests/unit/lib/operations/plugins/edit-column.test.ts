import { describe, expect, it } from 'vitest'
import { editColumnPlugin } from '@/lib/operations/plugins/edit-column'
import type { Column } from '@/types/dataset'
import type { EditColumnOperation } from '@/types/pipeline'

const mockColumns: Column[] = [
  { name: 'id', type: 'INTEGER', nullable: false },
  { name: 'email', type: 'VARCHAR', nullable: true },
  { name: 'name', type: 'VARCHAR', nullable: true },
  { name: 'price', type: 'DECIMAL', nullable: true },
]

const mockContext = {
  sourceTableName: 'users',
  sourceColumns: mockColumns,
}

describe('editColumnPlugin', () => {
  describe('validate', () => {
    it('returns valid operation with simple expression', () => {
      const result = editColumnPlugin.validate({ column: 'email', expression: 'LOWER(email)' }, mockColumns)
      expect(result.valid).toBe(true)
      expect(result.operation).toMatchObject({
        type: 'editColumn',
        column: 'email',
        expression: 'LOWER(email)',
      })
      expect(result.errors).toHaveLength(0)
    })

    it('returns valid operation with complex expression', () => {
      const result = editColumnPlugin.validate({ column: 'price', expression: 'price * 1.1' }, mockColumns)
      expect(result.valid).toBe(true)
    })

    it('returns valid operation with TRIM expression', () => {
      const result = editColumnPlugin.validate({ column: 'name', expression: 'TRIM(name)' }, mockColumns)
      expect(result.valid).toBe(true)
    })

    it('returns error for missing column', () => {
      const result = editColumnPlugin.validate({ expression: 'LOWER(email)' }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('editColumn requires a column name')
    })

    it('returns error for missing expression', () => {
      const result = editColumnPlugin.validate({ column: 'email' }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('editColumn requires an expression')
    })

    it('returns error for non-existent column', () => {
      const result = editColumnPlugin.validate({ column: 'nonexistent', expression: 'LOWER(x)' }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Column "nonexistent" does not exist')
    })
  })

  describe('buildSql', () => {
    it('generates SELECT with expression for target column', () => {
      const op: EditColumnOperation = {
        type: 'editColumn',
        column: 'email',
        expression: 'LOWER(email)',
      }
      const sql = editColumnPlugin.buildSql(op, mockContext)
      expect(sql).toContain('(LOWER(email)) AS "email"')
      expect(sql).toContain('FROM "users"')
    })

    it('preserves other columns', () => {
      const op: EditColumnOperation = {
        type: 'editColumn',
        column: 'email',
        expression: 'TRIM(email)',
      }
      const sql = editColumnPlugin.buildSql(op, mockContext)
      expect(sql).toContain('"id"')
      expect(sql).toContain('"name"')
      expect(sql).toContain('"price"')
    })

    it('wraps expression in parentheses', () => {
      const op: EditColumnOperation = {
        type: 'editColumn',
        column: 'price',
        expression: 'price * 1.1',
      }
      const sql = editColumnPlugin.buildSql(op, mockContext)
      expect(sql).toContain('(price * 1.1) AS "price"')
    })

    it('escapes table name', () => {
      const op: EditColumnOperation = {
        type: 'editColumn',
        column: 'email',
        expression: 'LOWER(email)',
      }
      const sql = editColumnPlugin.buildSql(op, { ...mockContext, sourceTableName: 'my-table' })
      expect(sql).toContain('"my-table"')
    })
  })

  describe('getSummary', () => {
    it('returns column: expression for short expression', () => {
      const op: EditColumnOperation = {
        type: 'editColumn',
        column: 'email',
        expression: 'LOWER(email)',
      }
      expect(editColumnPlugin.getSummary(op)).toBe('email: LOWER(email)')
    })

    it('truncates long expression', () => {
      const op: EditColumnOperation = {
        type: 'editColumn',
        column: 'name',
        expression: 'CASE WHEN name IS NULL THEN "Unknown" ELSE UPPER(name) END',
      }
      const summary = editColumnPlugin.getSummary(op)
      expect(summary.length).toBeLessThanOrEqual(45)
      expect(summary.endsWith('...')).toBe(true)
    })

    it('does not truncate short expression', () => {
      const op: EditColumnOperation = {
        type: 'editColumn',
        column: 'x',
        expression: 'x + 1',
      }
      const summary = editColumnPlugin.getSummary(op)
      expect(summary.endsWith('...')).toBe(false)
    })
  })

  describe('metadata', () => {
    it('has correct type', () => {
      expect(editColumnPlugin.type).toBe('editColumn')
    })

    it('has correct category', () => {
      expect(editColumnPlugin.category).toBe('cell')
    })

    it('has tool definition with required parameters', () => {
      expect(editColumnPlugin.toolDefinition.name).toBe('editColumn')
      expect(editColumnPlugin.toolDefinition.parameters.required).toContain('column')
      expect(editColumnPlugin.toolDefinition.parameters.required).toContain('expression')
    })
  })
})
