import { describe, expect, it } from 'vitest'
import { unpivotPlugin } from '@/lib/operations/plugins/unpivot'
import type { Column } from '@/types/dataset'
import type { UnpivotOperation } from '@/types/pipeline'

const mockColumns: Column[] = [
  { name: 'id', type: 'INTEGER', nullable: false },
  { name: 'q1', type: 'DECIMAL', nullable: true },
  { name: 'q2', type: 'DECIMAL', nullable: true },
  { name: 'q3', type: 'DECIMAL', nullable: true },
  { name: 'q4', type: 'DECIMAL', nullable: true },
]

const mockContext = {
  sourceTableName: 'quarterly_sales',
  sourceColumns: mockColumns,
}

describe('unpivotPlugin', () => {
  describe('validate', () => {
    it('returns valid operation with single value column', () => {
      const result = unpivotPlugin.validate(
        { valueColumns: ['q1'], nameColumn: 'quarter', valueColumn: 'sales' },
        mockColumns
      )
      expect(result.valid).toBe(true)
      expect(result.operation).toMatchObject({
        type: 'unpivot',
        valueColumns: ['q1'],
        nameColumn: 'quarter',
        valueColumn: 'sales',
      })
      expect(result.errors).toHaveLength(0)
    })

    it('returns valid operation with multiple value columns', () => {
      const result = unpivotPlugin.validate(
        { valueColumns: ['q1', 'q2', 'q3', 'q4'], nameColumn: 'quarter', valueColumn: 'sales' },
        mockColumns
      )
      expect(result.valid).toBe(true)
      expect((result.operation as UnpivotOperation).valueColumns).toHaveLength(4)
    })

    it('returns error for empty valueColumns', () => {
      const result = unpivotPlugin.validate(
        { valueColumns: [], nameColumn: 'quarter', valueColumn: 'sales' },
        mockColumns
      )
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('unpivot requires at least one valueColumn')
    })

    it('returns error for missing valueColumns', () => {
      const result = unpivotPlugin.validate({ nameColumn: 'quarter', valueColumn: 'sales' }, mockColumns)
      expect(result.valid).toBe(false)
    })

    it('returns error for missing nameColumn', () => {
      const result = unpivotPlugin.validate({ valueColumns: ['q1'], valueColumn: 'sales' }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('unpivot requires a nameColumn')
    })

    it('returns error for missing valueColumn', () => {
      const result = unpivotPlugin.validate({ valueColumns: ['q1'], nameColumn: 'quarter' }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('unpivot requires a valueColumn')
    })

    it('returns error for non-existent value column', () => {
      const result = unpivotPlugin.validate(
        { valueColumns: ['nonexistent'], nameColumn: 'quarter', valueColumn: 'sales' },
        mockColumns
      )
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Column "nonexistent" does not exist')
    })

    it('returns error for multiple non-existent value columns', () => {
      const result = unpivotPlugin.validate(
        { valueColumns: ['foo', 'bar'], nameColumn: 'quarter', valueColumn: 'sales' },
        mockColumns
      )
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(2)
    })
  })

  describe('buildSql', () => {
    it('generates UNPIVOT SQL', () => {
      const op: UnpivotOperation = {
        type: 'unpivot',
        valueColumns: ['q1', 'q2'],
        nameColumn: 'quarter',
        valueColumn: 'sales',
      }
      const sql = unpivotPlugin.buildSql(op, mockContext)
      expect(sql).toBe('UNPIVOT "quarterly_sales" ON "q1", "q2" INTO NAME "quarter" VALUE "sales"')
    })

    it('generates UNPIVOT with single column', () => {
      const op: UnpivotOperation = {
        type: 'unpivot',
        valueColumns: ['q1'],
        nameColumn: 'quarter',
        valueColumn: 'sales',
      }
      const sql = unpivotPlugin.buildSql(op, mockContext)
      expect(sql).toContain('ON "q1"')
    })

    it('escapes column names with special characters', () => {
      const op: UnpivotOperation = {
        type: 'unpivot',
        valueColumns: ['q-1', 'q-2'],
        nameColumn: 'quarter name',
        valueColumn: 'sales value',
      }
      const sql = unpivotPlugin.buildSql(op, mockContext)
      expect(sql).toContain('"q-1"')
      expect(sql).toContain('"quarter name"')
      expect(sql).toContain('"sales value"')
    })

    it('escapes table name', () => {
      const op: UnpivotOperation = {
        type: 'unpivot',
        valueColumns: ['q1'],
        nameColumn: 'quarter',
        valueColumn: 'sales',
      }
      const sql = unpivotPlugin.buildSql(op, { ...mockContext, sourceTableName: 'my-table' })
      expect(sql).toContain('"my-table"')
    })
  })

  describe('getSummary', () => {
    it('returns column count and output names', () => {
      const op: UnpivotOperation = {
        type: 'unpivot',
        valueColumns: ['q1', 'q2', 'q3', 'q4'],
        nameColumn: 'quarter',
        valueColumn: 'sales',
      }
      expect(unpivotPlugin.getSummary(op)).toBe('4 cols -> quarter/sales')
    })

    it('returns count for single column', () => {
      const op: UnpivotOperation = {
        type: 'unpivot',
        valueColumns: ['q1'],
        nameColumn: 'quarter',
        valueColumn: 'sales',
      }
      expect(unpivotPlugin.getSummary(op)).toBe('1 cols -> quarter/sales')
    })
  })

  describe('metadata', () => {
    it('has correct type', () => {
      expect(unpivotPlugin.type).toBe('unpivot')
    })

    it('has correct category', () => {
      expect(unpivotPlugin.category).toBe('aggregate')
    })

    it('has tool definition with required parameters', () => {
      expect(unpivotPlugin.toolDefinition.name).toBe('unpivot')
      expect(unpivotPlugin.toolDefinition.parameters.required).toContain('valueColumns')
      expect(unpivotPlugin.toolDefinition.parameters.required).toContain('nameColumn')
      expect(unpivotPlugin.toolDefinition.parameters.required).toContain('valueColumn')
    })
  })
})
