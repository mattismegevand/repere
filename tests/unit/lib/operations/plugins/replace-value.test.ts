import { describe, expect, it } from 'vitest'
import { replaceValuePlugin } from '@/lib/operations/plugins/replace-value'
import type { Column } from '@/types/dataset'
import type { ReplaceValueOperation } from '@/types/pipeline'

const mockColumns: Column[] = [
  { name: 'id', type: 'INTEGER', nullable: false },
  { name: 'status', type: 'VARCHAR', nullable: true },
  { name: 'count', type: 'INTEGER', nullable: true },
]

const mockContext = {
  sourceTableName: 'orders',
  sourceColumns: mockColumns,
}

describe('replaceValuePlugin', () => {
  describe('validate', () => {
    it('returns valid operation with string values', () => {
      const result = replaceValuePlugin.validate({ column: 'status', find: 'active', replace: 'enabled' }, mockColumns)
      expect(result.valid).toBe(true)
      expect(result.operation).toMatchObject({
        type: 'replaceValue',
        column: 'status',
        find: 'active',
        replace: 'enabled',
      })
      expect(result.errors).toHaveLength(0)
    })

    it('returns valid operation with numeric values', () => {
      const result = replaceValuePlugin.validate({ column: 'count', find: 0, replace: 1 }, mockColumns)
      expect(result.valid).toBe(true)
    })

    it('returns valid operation with null find value', () => {
      const result = replaceValuePlugin.validate({ column: 'status', find: null, replace: 'unknown' }, mockColumns)
      expect(result.valid).toBe(true)
    })

    it('returns valid operation with null replace value', () => {
      const result = replaceValuePlugin.validate({ column: 'status', find: 'pending', replace: null }, mockColumns)
      expect(result.valid).toBe(true)
    })

    it('returns valid operation with boolean values', () => {
      const result = replaceValuePlugin.validate({ column: 'status', find: true, replace: false }, mockColumns)
      expect(result.valid).toBe(true)
    })

    it('returns valid operation with caseSensitive option', () => {
      const result = replaceValuePlugin.validate(
        { column: 'status', find: 'Active', replace: 'enabled', caseSensitive: false },
        mockColumns
      )
      expect(result.valid).toBe(true)
      expect((result.operation as ReplaceValueOperation).caseSensitive).toBe(false)
    })

    it('returns error for missing column', () => {
      const result = replaceValuePlugin.validate({ find: 'a', replace: 'b' }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('replaceValue requires a column name')
    })

    it('returns error for non-existent column', () => {
      const result = replaceValuePlugin.validate({ column: 'nonexistent', find: 'a', replace: 'b' }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Column "nonexistent" does not exist')
    })

    it('returns error for missing find value', () => {
      const result = replaceValuePlugin.validate({ column: 'status', replace: 'b' }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('requires a find value')
    })

    it('returns error for missing replace value', () => {
      const result = replaceValuePlugin.validate({ column: 'status', find: 'a' }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('requires a replace value')
    })
  })

  describe('buildSql', () => {
    it('generates CASE WHEN for string replacement', () => {
      const op: ReplaceValueOperation = {
        type: 'replaceValue',
        column: 'status',
        find: 'active',
        replace: 'enabled',
      }
      const sql = replaceValuePlugin.buildSql(op, mockContext)
      expect(sql).toContain('CASE WHEN "status" = \'active\' THEN \'enabled\' ELSE "status" END')
      expect(sql).toContain('AS "status"')
    })

    it('generates CASE WHEN for numeric replacement', () => {
      const op: ReplaceValueOperation = {
        type: 'replaceValue',
        column: 'count',
        find: 0,
        replace: 1,
      }
      const sql = replaceValuePlugin.buildSql(op, mockContext)
      expect(sql).toContain('CASE WHEN "count" = 0 THEN 1 ELSE "count" END')
    })

    it('generates CASE WHEN for null find value', () => {
      const op: ReplaceValueOperation = {
        type: 'replaceValue',
        column: 'status',
        find: null,
        replace: 'unknown',
      }
      const sql = replaceValuePlugin.buildSql(op, mockContext)
      expect(sql).toContain('CASE WHEN "status" = NULL THEN')
    })

    it('preserves other columns', () => {
      const op: ReplaceValueOperation = {
        type: 'replaceValue',
        column: 'status',
        find: 'a',
        replace: 'b',
      }
      const sql = replaceValuePlugin.buildSql(op, mockContext)
      expect(sql).toContain('"id"')
      expect(sql).toContain('"count"')
    })

    it('escapes table name', () => {
      const op: ReplaceValueOperation = {
        type: 'replaceValue',
        column: 'status',
        find: 'a',
        replace: 'b',
      }
      const sql = replaceValuePlugin.buildSql(op, { ...mockContext, sourceTableName: 'my-table' })
      expect(sql).toContain('"my-table"')
    })
  })

  describe('getSummary', () => {
    it('returns column: find -> replace format', () => {
      const op: ReplaceValueOperation = {
        type: 'replaceValue',
        column: 'status',
        find: 'active',
        replace: 'enabled',
      }
      expect(replaceValuePlugin.getSummary(op)).toBe('status: active -> enabled')
    })

    it('handles numeric values', () => {
      const op: ReplaceValueOperation = {
        type: 'replaceValue',
        column: 'count',
        find: 0,
        replace: 1,
      }
      expect(replaceValuePlugin.getSummary(op)).toBe('count: 0 -> 1')
    })

    it('handles null values', () => {
      const op: ReplaceValueOperation = {
        type: 'replaceValue',
        column: 'status',
        find: null,
        replace: 'unknown',
      }
      expect(replaceValuePlugin.getSummary(op)).toBe('status: null -> unknown')
    })
  })

  describe('metadata', () => {
    it('has correct type', () => {
      expect(replaceValuePlugin.type).toBe('replaceValue')
    })

    it('has correct category', () => {
      expect(replaceValuePlugin.category).toBe('cell')
    })

    it('has tool definition with required parameters', () => {
      expect(replaceValuePlugin.toolDefinition.name).toBe('replaceValue')
      expect(replaceValuePlugin.toolDefinition.parameters.required).toContain('column')
      expect(replaceValuePlugin.toolDefinition.parameters.required).toContain('find')
      expect(replaceValuePlugin.toolDefinition.parameters.required).toContain('replace')
    })
  })
})
