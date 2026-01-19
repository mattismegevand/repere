import { describe, expect, it } from 'vitest'
import { fillNullPlugin } from '@/lib/operations/plugins/fill-null'
import type { Column } from '@/types/dataset'
import type { FillNullOperation } from '@/types/pipeline'

const mockColumns: Column[] = [
  { name: 'id', type: 'INTEGER', nullable: false },
  { name: 'name', type: 'VARCHAR', nullable: true },
  { name: 'price', type: 'number', nullable: true },
  { name: 'category', type: 'VARCHAR', nullable: true },
]

const mockContext = {
  sourceTableName: 'products',
  sourceColumns: mockColumns,
}

describe('fillNullPlugin', () => {
  describe('validate', () => {
    it('returns valid operation with value strategy', () => {
      const result = fillNullPlugin.validate({ column: 'name', strategy: 'value', value: 'Unknown' }, mockColumns)
      expect(result.valid).toBe(true)
      expect(result.operation).toMatchObject({
        type: 'fillNull',
        column: 'name',
        strategy: 'value',
        value: 'Unknown',
      })
      expect(result.errors).toHaveLength(0)
    })

    it('returns valid operation with forward strategy', () => {
      const result = fillNullPlugin.validate({ column: 'name', strategy: 'forward' }, mockColumns)
      expect(result.valid).toBe(true)
      expect((result.operation as FillNullOperation).strategy).toBe('forward')
    })

    it('returns valid operation with backward strategy', () => {
      const result = fillNullPlugin.validate({ column: 'name', strategy: 'backward' }, mockColumns)
      expect(result.valid).toBe(true)
    })

    it('returns valid operation with mean strategy for numeric column', () => {
      const result = fillNullPlugin.validate({ column: 'price', strategy: 'mean' }, mockColumns)
      expect(result.valid).toBe(true)
    })

    it('returns valid operation with median strategy for numeric column', () => {
      const result = fillNullPlugin.validate({ column: 'price', strategy: 'median' }, mockColumns)
      expect(result.valid).toBe(true)
    })

    it('returns valid operation with mode strategy', () => {
      const result = fillNullPlugin.validate({ column: 'category', strategy: 'mode' }, mockColumns)
      expect(result.valid).toBe(true)
    })

    it('returns error for missing column', () => {
      const result = fillNullPlugin.validate({ strategy: 'value', value: 'x' }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('fillNull requires a column name')
    })

    it('returns error for missing strategy', () => {
      const result = fillNullPlugin.validate({ column: 'name' }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('fillNull requires a strategy')
    })

    it('returns error for non-existent column', () => {
      const result = fillNullPlugin.validate({ column: 'nonexistent', strategy: 'value', value: 'x' }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Column "nonexistent" does not exist')
    })

    it('returns error for invalid strategy', () => {
      const result = fillNullPlugin.validate({ column: 'name', strategy: 'invalid' }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Invalid strategy')
    })

    it('returns error for value strategy without value', () => {
      const result = fillNullPlugin.validate({ column: 'name', strategy: 'value' }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('requires a value')
    })

    it('returns error for mean strategy on non-numeric column', () => {
      const result = fillNullPlugin.validate({ column: 'name', strategy: 'mean' }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('can only be used on numeric columns')
    })

    it('returns error for median strategy on non-numeric column', () => {
      const result = fillNullPlugin.validate({ column: 'name', strategy: 'median' }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('can only be used on numeric columns')
    })
  })

  describe('buildSql', () => {
    it('generates COALESCE for value strategy', () => {
      const op: FillNullOperation = {
        type: 'fillNull',
        column: 'name',
        strategy: 'value',
        value: 'Unknown',
      }
      const sql = fillNullPlugin.buildSql(op, mockContext)
      expect(sql).toContain('COALESCE("name", \'Unknown\')')
      expect(sql).toContain('AS "name"')
    })

    it('generates COALESCE for numeric value', () => {
      const op: FillNullOperation = {
        type: 'fillNull',
        column: 'price',
        strategy: 'value',
        value: 0,
      }
      const sql = fillNullPlugin.buildSql(op, mockContext)
      expect(sql).toContain('COALESCE("price", 0)')
    })

    it('generates window function for forward fill', () => {
      const op: FillNullOperation = {
        type: 'fillNull',
        column: 'name',
        strategy: 'forward',
      }
      const sql = fillNullPlugin.buildSql(op, mockContext)
      expect(sql).toContain('LAST_VALUE')
      expect(sql).toContain('IGNORE NULLS')
      expect(sql).toContain('__row_id')
    })

    it('generates window function for backward fill', () => {
      const op: FillNullOperation = {
        type: 'fillNull',
        column: 'name',
        strategy: 'backward',
      }
      const sql = fillNullPlugin.buildSql(op, mockContext)
      expect(sql).toContain('FIRST_VALUE')
      expect(sql).toContain('IGNORE NULLS')
    })

    it('generates AVG for mean strategy', () => {
      const op: FillNullOperation = {
        type: 'fillNull',
        column: 'price',
        strategy: 'mean',
      }
      const sql = fillNullPlugin.buildSql(op, mockContext)
      expect(sql).toContain('AVG("price") OVER ()')
    })

    it('generates MEDIAN for median strategy', () => {
      const op: FillNullOperation = {
        type: 'fillNull',
        column: 'price',
        strategy: 'median',
      }
      const sql = fillNullPlugin.buildSql(op, mockContext)
      expect(sql).toContain('MEDIAN("price") OVER ()')
    })

    it('generates MODE for mode strategy', () => {
      const op: FillNullOperation = {
        type: 'fillNull',
        column: 'category',
        strategy: 'mode',
      }
      const sql = fillNullPlugin.buildSql(op, mockContext)
      expect(sql).toContain('MODE("category") OVER ()')
    })

    it('preserves other columns', () => {
      const op: FillNullOperation = {
        type: 'fillNull',
        column: 'name',
        strategy: 'value',
        value: 'x',
      }
      const sql = fillNullPlugin.buildSql(op, mockContext)
      expect(sql).toContain('"id"')
      expect(sql).toContain('"price"')
      expect(sql).toContain('"category"')
    })
  })

  describe('getSummary', () => {
    it('returns column = value for value strategy', () => {
      const op: FillNullOperation = {
        type: 'fillNull',
        column: 'name',
        strategy: 'value',
        value: 'Unknown',
      }
      expect(fillNullPlugin.getSummary(op)).toBe('name = Unknown')
    })

    it('returns forward fill summary', () => {
      const op: FillNullOperation = { type: 'fillNull', column: 'name', strategy: 'forward' }
      expect(fillNullPlugin.getSummary(op)).toBe('name (forward fill)')
    })

    it('returns backward fill summary', () => {
      const op: FillNullOperation = { type: 'fillNull', column: 'name', strategy: 'backward' }
      expect(fillNullPlugin.getSummary(op)).toBe('name (backward fill)')
    })

    it('returns mean summary', () => {
      const op: FillNullOperation = { type: 'fillNull', column: 'price', strategy: 'mean' }
      expect(fillNullPlugin.getSummary(op)).toBe('price (mean)')
    })

    it('returns median summary', () => {
      const op: FillNullOperation = { type: 'fillNull', column: 'price', strategy: 'median' }
      expect(fillNullPlugin.getSummary(op)).toBe('price (median)')
    })

    it('returns mode summary', () => {
      const op: FillNullOperation = { type: 'fillNull', column: 'category', strategy: 'mode' }
      expect(fillNullPlugin.getSummary(op)).toBe('category (mode)')
    })
  })

  describe('metadata', () => {
    it('has correct type', () => {
      expect(fillNullPlugin.type).toBe('fillNull')
    })

    it('has correct category', () => {
      expect(fillNullPlugin.category).toBe('cell')
    })

    it('has tool definition with required parameters', () => {
      expect(fillNullPlugin.toolDefinition.name).toBe('fillNull')
      expect(fillNullPlugin.toolDefinition.parameters.required).toContain('column')
      expect(fillNullPlugin.toolDefinition.parameters.required).toContain('strategy')
    })
  })
})
