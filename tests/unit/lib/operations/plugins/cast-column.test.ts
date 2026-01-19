import { describe, expect, it } from 'vitest'
import { castColumnPlugin } from '@/lib/operations/plugins/cast-column'
import type { Column } from '@/types/dataset'
import type { CastColumnOperation } from '@/types/pipeline'

const mockColumns: Column[] = [
  { name: 'id', type: 'INTEGER', nullable: false },
  { name: 'price', type: 'VARCHAR', nullable: true },
  { name: 'created_at', type: 'VARCHAR', nullable: true },
]

const mockContext = {
  sourceTableName: 'products',
  sourceColumns: mockColumns,
}

describe('castColumnPlugin', () => {
  describe('validate', () => {
    it('returns valid operation for standard type', () => {
      const result = castColumnPlugin.validate({ column: 'price', toType: 'DOUBLE' }, mockColumns)
      expect(result.valid).toBe(true)
      expect(result.operation).toMatchObject({
        type: 'castColumn',
        column: 'price',
        toType: 'DOUBLE',
      })
      expect(result.errors).toHaveLength(0)
    })

    it('returns valid operation for INTEGER', () => {
      const result = castColumnPlugin.validate({ column: 'price', toType: 'INTEGER' }, mockColumns)
      expect(result.valid).toBe(true)
    })

    it('returns valid operation for TIMESTAMP', () => {
      const result = castColumnPlugin.validate({ column: 'created_at', toType: 'TIMESTAMP' }, mockColumns)
      expect(result.valid).toBe(true)
    })

    it('returns valid operation for DATE', () => {
      const result = castColumnPlugin.validate({ column: 'created_at', toType: 'DATE' }, mockColumns)
      expect(result.valid).toBe(true)
    })

    it('returns valid operation for BOOLEAN', () => {
      const result = castColumnPlugin.validate({ column: 'price', toType: 'BOOLEAN' }, mockColumns)
      expect(result.valid).toBe(true)
    })

    it('returns error for missing column', () => {
      const result = castColumnPlugin.validate({ toType: 'INTEGER' }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('castColumn requires a column name')
    })

    it('returns error for missing toType', () => {
      const result = castColumnPlugin.validate({ column: 'price' }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('castColumn requires a target type')
    })

    it('returns error for non-existent column', () => {
      const result = castColumnPlugin.validate({ column: 'nonexistent', toType: 'INTEGER' }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Column "nonexistent" does not exist')
    })

    it('returns warning for non-standard type', () => {
      const result = castColumnPlugin.validate({ column: 'price', toType: 'CUSTOM' }, mockColumns)
      expect(result.valid).toBe(true)
      expect(result.warnings[0]).toContain('may not be a standard DuckDB type')
    })

    it('accepts standard types case-insensitively', () => {
      const result = castColumnPlugin.validate({ column: 'price', toType: 'integer' }, mockColumns)
      expect(result.valid).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })
  })

  describe('buildSql', () => {
    it('generates SELECT with CAST for target column', () => {
      const op: CastColumnOperation = { type: 'castColumn', column: 'price', toType: 'DOUBLE' }
      const sql = castColumnPlugin.buildSql(op, mockContext)
      expect(sql).toContain('CAST("price" AS DOUBLE) AS "price"')
      expect(sql).toContain('"id"')
      expect(sql).toContain('"created_at"')
    })

    it('preserves other columns unchanged', () => {
      const op: CastColumnOperation = { type: 'castColumn', column: 'price', toType: 'INTEGER' }
      const sql = castColumnPlugin.buildSql(op, mockContext)
      expect(sql).toBe('SELECT "id", CAST("price" AS INTEGER) AS "price", "created_at" FROM "products"')
    })

    it('handles column with special characters', () => {
      const op: CastColumnOperation = { type: 'castColumn', column: 'unit-price', toType: 'DOUBLE' }
      const contextWithSpecialCol = {
        ...mockContext,
        sourceColumns: [{ name: 'unit-price', type: 'VARCHAR', nullable: true }],
      }
      const sql = castColumnPlugin.buildSql(op, contextWithSpecialCol)
      expect(sql).toContain('CAST("unit-price" AS DOUBLE) AS "unit-price"')
    })

    it('escapes table name', () => {
      const op: CastColumnOperation = { type: 'castColumn', column: 'price', toType: 'DOUBLE' }
      const sql = castColumnPlugin.buildSql(op, { ...mockContext, sourceTableName: 'my-table' })
      expect(sql).toContain('"my-table"')
    })
  })

  describe('getSummary', () => {
    it('returns column -> type format', () => {
      const op: CastColumnOperation = { type: 'castColumn', column: 'price', toType: 'DOUBLE' }
      expect(castColumnPlugin.getSummary(op)).toBe('price -> DOUBLE')
    })

    it('works with various types', () => {
      const op: CastColumnOperation = { type: 'castColumn', column: 'created_at', toType: 'TIMESTAMP' }
      expect(castColumnPlugin.getSummary(op)).toBe('created_at -> TIMESTAMP')
    })
  })

  describe('metadata', () => {
    it('has correct type', () => {
      expect(castColumnPlugin.type).toBe('castColumn')
    })

    it('has correct category', () => {
      expect(castColumnPlugin.category).toBe('column')
    })

    it('has tool definition with required parameters', () => {
      expect(castColumnPlugin.toolDefinition.name).toBe('castColumn')
      expect(castColumnPlugin.toolDefinition.parameters.required).toContain('column')
      expect(castColumnPlugin.toolDefinition.parameters.required).toContain('toType')
    })
  })
})
