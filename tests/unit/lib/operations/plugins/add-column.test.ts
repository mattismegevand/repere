import { describe, expect, it } from 'vitest'
import { addColumnPlugin } from '@/lib/operations/plugins/add-column'
import type { Column } from '@/types/dataset'
import type { AddColumnOperation } from '@/types/pipeline'

const mockColumns: Column[] = [
  { name: 'price', type: 'DECIMAL', nullable: true },
  { name: 'quantity', type: 'INTEGER', nullable: false },
  { name: 'name', type: 'VARCHAR', nullable: true },
]

const mockContext = {
  sourceTableName: 'orders',
  sourceColumns: mockColumns,
}

describe('addColumnPlugin', () => {
  describe('validate', () => {
    it('returns valid operation with single column', () => {
      const result = addColumnPlugin.validate(
        { columns: [{ name: 'total', expression: 'price * quantity' }] },
        mockColumns
      )
      expect(result.valid).toBe(true)
      expect(result.operation).toMatchObject({
        type: 'addColumn',
        columns: [{ name: 'total', expression: 'price * quantity' }],
      })
      expect(result.errors).toHaveLength(0)
    })

    it('returns valid operation with multiple columns', () => {
      const result = addColumnPlugin.validate(
        {
          columns: [
            { name: 'total', expression: 'price * quantity' },
            { name: 'upper_name', expression: 'UPPER(name)' },
          ],
        },
        mockColumns
      )
      expect(result.valid).toBe(true)
      expect((result.operation as AddColumnOperation).columns).toHaveLength(2)
    })

    it('returns error for empty columns array', () => {
      const result = addColumnPlugin.validate({ columns: [] }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('addColumn requires at least one column')
    })

    it('returns error for missing columns', () => {
      const result = addColumnPlugin.validate({}, mockColumns)
      expect(result.valid).toBe(false)
    })

    it('returns error for column without name', () => {
      const result = addColumnPlugin.validate({ columns: [{ expression: 'price * 2' }] }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('must have a name')
    })

    it('returns error for column without expression', () => {
      const result = addColumnPlugin.validate({ columns: [{ name: 'total' }] }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('must have an expression')
    })

    it('returns warning when column name conflicts with existing', () => {
      const result = addColumnPlugin.validate({ columns: [{ name: 'price', expression: 'price * 1.1' }] }, mockColumns)
      expect(result.valid).toBe(true)
      expect(result.warnings[0]).toContain('already exists and will be replaced')
    })
  })

  describe('buildSql', () => {
    it('generates SELECT with computed column', () => {
      const op: AddColumnOperation = {
        type: 'addColumn',
        columns: [{ name: 'total', expression: 'price * quantity' }],
      }
      const sql = addColumnPlugin.buildSql(op, mockContext)
      expect(sql).toBe('SELECT *, (price * quantity) AS "total" FROM "orders"')
    })

    it('generates SELECT with multiple computed columns', () => {
      const op: AddColumnOperation = {
        type: 'addColumn',
        columns: [
          { name: 'total', expression: 'price * quantity' },
          { name: 'upper_name', expression: 'UPPER(name)' },
        ],
      }
      const sql = addColumnPlugin.buildSql(op, mockContext)
      expect(sql).toBe('SELECT *, (price * quantity) AS "total", (UPPER(name)) AS "upper_name" FROM "orders"')
    })

    it('escapes column names with special characters', () => {
      const op: AddColumnOperation = {
        type: 'addColumn',
        columns: [{ name: 'total amount', expression: 'price * quantity' }],
      }
      const sql = addColumnPlugin.buildSql(op, mockContext)
      expect(sql).toContain('AS "total amount"')
    })

    it('escapes table name', () => {
      const op: AddColumnOperation = {
        type: 'addColumn',
        columns: [{ name: 'x', expression: '1' }],
      }
      const sql = addColumnPlugin.buildSql(op, { ...mockContext, sourceTableName: 'my-table' })
      expect(sql).toContain('"my-table"')
    })
  })

  describe('getSummary', () => {
    it('returns "+ column" for single column', () => {
      const op: AddColumnOperation = {
        type: 'addColumn',
        columns: [{ name: 'total', expression: 'a * b' }],
      }
      expect(addColumnPlugin.getSummary(op)).toBe('+ total')
    })

    it('returns count for multiple columns', () => {
      const op: AddColumnOperation = {
        type: 'addColumn',
        columns: [
          { name: 'a', expression: '1' },
          { name: 'b', expression: '2' },
        ],
      }
      expect(addColumnPlugin.getSummary(op)).toBe('+ 2 columns')
    })

    it('returns count for many columns', () => {
      const op: AddColumnOperation = {
        type: 'addColumn',
        columns: [
          { name: 'a', expression: '1' },
          { name: 'b', expression: '2' },
          { name: 'c', expression: '3' },
          { name: 'd', expression: '4' },
        ],
      }
      expect(addColumnPlugin.getSummary(op)).toBe('+ 4 columns')
    })
  })

  describe('merge', () => {
    it('merges two add column operations', () => {
      const existing: AddColumnOperation = {
        type: 'addColumn',
        columns: [{ name: 'a', expression: '1' }],
      }
      const incoming: AddColumnOperation = {
        type: 'addColumn',
        columns: [{ name: 'b', expression: '2' }],
      }
      const merged = addColumnPlugin.merge!(existing, incoming)
      expect(merged.columns).toHaveLength(2)
    })

    it('overwrites column with same name', () => {
      const existing: AddColumnOperation = {
        type: 'addColumn',
        columns: [{ name: 'a', expression: '1' }],
      }
      const incoming: AddColumnOperation = {
        type: 'addColumn',
        columns: [{ name: 'a', expression: '2' }],
      }
      const merged = addColumnPlugin.merge!(existing, incoming)
      expect(merged.columns).toHaveLength(1)
      expect(merged.columns[0].expression).toBe('2')
    })

    it('canMerge returns true', () => {
      expect(addColumnPlugin.canMerge!({} as AddColumnOperation, {} as AddColumnOperation)).toBe(true)
    })
  })

  describe('metadata', () => {
    it('has correct type', () => {
      expect(addColumnPlugin.type).toBe('addColumn')
    })

    it('has correct category', () => {
      expect(addColumnPlugin.category).toBe('column')
    })

    it('has tool definition with required columns parameter', () => {
      expect(addColumnPlugin.toolDefinition.name).toBe('addColumn')
      expect(addColumnPlugin.toolDefinition.parameters.required).toContain('columns')
    })
  })
})
