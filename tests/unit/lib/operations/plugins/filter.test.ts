import { describe, expect, it } from 'vitest'
import { filterPlugin } from '@/lib/operations/plugins/filter'
import type { Column } from '@/types/dataset'
import type { FilterOperation } from '@/types/pipeline'

const mockColumns: Column[] = [
  { name: 'id', type: 'INTEGER', nullable: false },
  { name: 'name', type: 'VARCHAR', nullable: true },
  { name: 'status', type: 'VARCHAR', nullable: true },
  { name: 'price', type: 'DECIMAL', nullable: true },
]

const mockContext = {
  sourceTableName: 'orders',
  sourceColumns: mockColumns,
}

describe('filterPlugin', () => {
  describe('validate', () => {
    it('returns valid operation with simple condition', () => {
      const result = filterPlugin.validate(
        {
          expression: {
            type: 'condition',
            filter: { column: 'status', operator: 'eq', value: 'active' },
          },
        },
        mockColumns
      )
      expect(result.valid).toBe(true)
      expect(result.operation).toMatchObject({ type: 'filter' })
      expect(result.errors).toHaveLength(0)
    })

    it('returns valid operation with numeric comparison', () => {
      const result = filterPlugin.validate(
        {
          expression: {
            type: 'condition',
            filter: { column: 'price', operator: 'gt', value: 100 },
          },
        },
        mockColumns
      )
      expect(result.valid).toBe(true)
    })

    it('returns valid operation with null check', () => {
      const result = filterPlugin.validate(
        {
          expression: {
            type: 'condition',
            filter: { column: 'name', operator: 'isNull' },
          },
        },
        mockColumns
      )
      expect(result.valid).toBe(true)
    })

    it('returns valid operation with isNotNull', () => {
      const result = filterPlugin.validate(
        {
          expression: {
            type: 'condition',
            filter: { column: 'name', operator: 'isNotNull' },
          },
        },
        mockColumns
      )
      expect(result.valid).toBe(true)
    })

    it('returns valid operation with group (AND)', () => {
      const result = filterPlugin.validate(
        {
          expression: {
            type: 'group',
            combineMode: 'and',
            children: [
              { type: 'condition', filter: { column: 'status', operator: 'eq', value: 'active' } },
              { type: 'condition', filter: { column: 'price', operator: 'gt', value: 50 } },
            ],
          },
        },
        mockColumns
      )
      expect(result.valid).toBe(true)
    })

    it('returns valid operation with group (OR)', () => {
      const result = filterPlugin.validate(
        {
          expression: {
            type: 'group',
            combineMode: 'or',
            children: [
              { type: 'condition', filter: { column: 'status', operator: 'eq', value: 'pending' } },
              { type: 'condition', filter: { column: 'status', operator: 'eq', value: 'draft' } },
            ],
          },
        },
        mockColumns
      )
      expect(result.valid).toBe(true)
    })

    it('returns valid operation with nested groups', () => {
      const result = filterPlugin.validate(
        {
          expression: {
            type: 'group',
            combineMode: 'and',
            children: [
              { type: 'condition', filter: { column: 'price', operator: 'gt', value: 0 } },
              {
                type: 'group',
                combineMode: 'or',
                children: [
                  { type: 'condition', filter: { column: 'status', operator: 'eq', value: 'a' } },
                  { type: 'condition', filter: { column: 'status', operator: 'eq', value: 'b' } },
                ],
              },
            ],
          },
        },
        mockColumns
      )
      expect(result.valid).toBe(true)
    })

    it('returns error for missing expression', () => {
      const result = filterPlugin.validate({}, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Filter requires an expression')
    })

    it('returns error for expression without type', () => {
      const result = filterPlugin.validate({ expression: { filter: {} } }, mockColumns)
      expect(result.valid).toBe(false)
    })

    it('returns error for non-existent column in condition', () => {
      const result = filterPlugin.validate(
        {
          expression: {
            type: 'condition',
            filter: { column: 'nonexistent', operator: 'eq', value: 'test' },
          },
        },
        mockColumns
      )
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Column "nonexistent" does not exist')
    })

    it('returns error for non-existent column in nested group', () => {
      const result = filterPlugin.validate(
        {
          expression: {
            type: 'group',
            combineMode: 'and',
            children: [{ type: 'condition', filter: { column: 'invalid', operator: 'eq', value: 'x' } }],
          },
        },
        mockColumns
      )
      expect(result.valid).toBe(false)
    })
  })

  describe('buildSql', () => {
    it('generates WHERE for equality condition', () => {
      const op: FilterOperation = {
        type: 'filter',
        expression: {
          type: 'condition',
          filter: { column: 'status', operator: 'eq', value: 'active' },
        },
      }
      const sql = filterPlugin.buildSql(op, mockContext)
      expect(sql).toContain('SELECT * FROM "orders" WHERE')
      expect(sql).toContain('"status"')
      expect(sql).toContain("'active'")
    })

    it('generates WHERE for greater than condition', () => {
      const op: FilterOperation = {
        type: 'filter',
        expression: {
          type: 'condition',
          filter: { column: 'price', operator: 'gt', value: 100 },
        },
      }
      const sql = filterPlugin.buildSql(op, mockContext)
      expect(sql).toContain('SELECT * FROM "orders" WHERE')
      expect(sql).toContain('"price"')
      expect(sql).toContain('> 100')
    })

    it('generates WHERE for IS NULL', () => {
      const op: FilterOperation = {
        type: 'filter',
        expression: {
          type: 'condition',
          filter: { column: 'name', operator: 'isNull' },
        },
      }
      const sql = filterPlugin.buildSql(op, mockContext)
      expect(sql).toContain('"name" IS NULL')
    })

    it('generates WHERE for IS NOT NULL', () => {
      const op: FilterOperation = {
        type: 'filter',
        expression: {
          type: 'condition',
          filter: { column: 'name', operator: 'isNotNull' },
        },
      }
      const sql = filterPlugin.buildSql(op, mockContext)
      expect(sql).toContain('"name" IS NOT NULL')
    })

    it('generates WHERE with AND for groups', () => {
      const op: FilterOperation = {
        type: 'filter',
        expression: {
          type: 'group',
          combineMode: 'and',
          children: [
            { type: 'condition', filter: { column: 'status', operator: 'eq', value: 'active' } },
            { type: 'condition', filter: { column: 'price', operator: 'gt', value: 50 } },
          ],
        },
      }
      const sql = filterPlugin.buildSql(op, mockContext)
      expect(sql).toContain('AND')
    })

    it('generates WHERE with OR for groups', () => {
      const op: FilterOperation = {
        type: 'filter',
        expression: {
          type: 'group',
          combineMode: 'or',
          children: [
            { type: 'condition', filter: { column: 'status', operator: 'eq', value: 'a' } },
            { type: 'condition', filter: { column: 'status', operator: 'eq', value: 'b' } },
          ],
        },
      }
      const sql = filterPlugin.buildSql(op, mockContext)
      expect(sql).toContain('OR')
    })

    it('escapes table name', () => {
      const op: FilterOperation = {
        type: 'filter',
        expression: {
          type: 'condition',
          filter: { column: 'id', operator: 'eq', value: 1 },
        },
      }
      const sql = filterPlugin.buildSql(op, { ...mockContext, sourceTableName: 'my-table' })
      expect(sql).toContain('"my-table"')
    })
  })

  describe('getSummary', () => {
    it('returns SQL-like summary for simple condition', () => {
      const op: FilterOperation = {
        type: 'filter',
        expression: {
          type: 'condition',
          filter: { column: 'status', operator: 'eq', value: 'active' },
        },
      }
      const summary = filterPlugin.getSummary(op)
      expect(summary).toContain('status')
    })

    it('truncates long summary', () => {
      const op: FilterOperation = {
        type: 'filter',
        expression: {
          type: 'group',
          combineMode: 'and',
          children: [
            {
              type: 'condition',
              filter: { column: 'very_long_column_name', operator: 'eq', value: 'some_value' },
            },
            {
              type: 'condition',
              filter: { column: 'another_column', operator: 'gt', value: 100 },
            },
          ],
        },
      }
      const summary = filterPlugin.getSummary(op)
      expect(summary.length).toBeLessThanOrEqual(50)
    })

    it('returns "Custom filter" on error', () => {
      const op: FilterOperation = {
        type: 'filter',
        expression: null as unknown as FilterOperation['expression'],
      }
      const summary = filterPlugin.getSummary(op)
      expect(summary).toBe('Custom filter')
    })
  })

  describe('metadata', () => {
    it('has correct type', () => {
      expect(filterPlugin.type).toBe('filter')
    })

    it('has correct category', () => {
      expect(filterPlugin.category).toBe('query')
    })

    it('has tool definition with required expression parameter', () => {
      expect(filterPlugin.toolDefinition.name).toBe('filter')
      expect(filterPlugin.toolDefinition.parameters.required).toContain('expression')
    })
  })
})
