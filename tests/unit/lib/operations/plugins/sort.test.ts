import { describe, expect, it } from 'vitest'
import { sortPlugin } from '@/lib/operations/plugins/sort'
import type { Column } from '@/types/dataset'
import type { SortOperation } from '@/types/pipeline'

const mockColumns: Column[] = [
  { name: 'id', type: 'INTEGER', nullable: false },
  { name: 'name', type: 'VARCHAR', nullable: true },
  { name: 'created_at', type: 'TIMESTAMP', nullable: true },
  { name: 'price', type: 'DECIMAL', nullable: true },
]

const mockContext = {
  sourceTableName: 'products',
  sourceColumns: mockColumns,
}

describe('sortPlugin', () => {
  describe('validate', () => {
    it('returns valid operation with single sort ascending', () => {
      const result = sortPlugin.validate({ sorts: [{ column: 'name', direction: 'asc' }] }, mockColumns)
      expect(result.valid).toBe(true)
      expect(result.operation).toMatchObject({
        type: 'sort',
        sorts: [{ column: 'name', direction: 'asc' }],
      })
      expect(result.errors).toHaveLength(0)
    })

    it('returns valid operation with single sort descending', () => {
      const result = sortPlugin.validate({ sorts: [{ column: 'price', direction: 'desc' }] }, mockColumns)
      expect(result.valid).toBe(true)
      expect(result.operation).toMatchObject({
        type: 'sort',
        sorts: [{ column: 'price', direction: 'desc' }],
      })
    })

    it('returns valid operation with multiple sorts', () => {
      const result = sortPlugin.validate(
        {
          sorts: [
            { column: 'name', direction: 'asc' },
            { column: 'id', direction: 'desc' },
          ],
        },
        mockColumns
      )
      expect(result.valid).toBe(true)
      expect((result.operation as SortOperation).sorts).toHaveLength(2)
    })

    it('returns valid operation with nulls first', () => {
      const result = sortPlugin.validate({ sorts: [{ column: 'name', direction: 'asc', nulls: 'first' }] }, mockColumns)
      expect(result.valid).toBe(true)
      expect((result.operation as SortOperation).sorts[0].nulls).toBe('first')
    })

    it('returns valid operation with nulls last', () => {
      const result = sortPlugin.validate({ sorts: [{ column: 'name', direction: 'desc', nulls: 'last' }] }, mockColumns)
      expect(result.valid).toBe(true)
      expect((result.operation as SortOperation).sorts[0].nulls).toBe('last')
    })

    it('returns error for empty sorts array', () => {
      const result = sortPlugin.validate({ sorts: [] }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Sort requires at least one sort specification')
    })

    it('returns error for missing sorts', () => {
      const result = sortPlugin.validate({}, mockColumns)
      expect(result.valid).toBe(false)
    })

    it('returns error for non-existent column', () => {
      const result = sortPlugin.validate({ sorts: [{ column: 'nonexistent', direction: 'asc' }] }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Column "nonexistent" does not exist')
    })

    it('returns error for invalid direction', () => {
      const result = sortPlugin.validate({ sorts: [{ column: 'name', direction: 'ascending' }] }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Invalid sort direction')
    })

    it('returns multiple errors for multiple issues', () => {
      const result = sortPlugin.validate(
        {
          sorts: [
            { column: 'invalid', direction: 'asc' },
            { column: 'name', direction: 'wrong' },
          ],
        },
        mockColumns
      )
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('buildSql', () => {
    it('generates ORDER BY for single ascending sort', () => {
      const op: SortOperation = { type: 'sort', sorts: [{ column: 'name', direction: 'asc' }] }
      const sql = sortPlugin.buildSql(op, mockContext)
      expect(sql).toBe('SELECT * FROM "products" ORDER BY "name" ASC')
    })

    it('generates ORDER BY for single descending sort', () => {
      const op: SortOperation = { type: 'sort', sorts: [{ column: 'price', direction: 'desc' }] }
      const sql = sortPlugin.buildSql(op, mockContext)
      expect(sql).toBe('SELECT * FROM "products" ORDER BY "price" DESC')
    })

    it('generates ORDER BY for multiple sorts', () => {
      const op: SortOperation = {
        type: 'sort',
        sorts: [
          { column: 'name', direction: 'asc' },
          { column: 'id', direction: 'desc' },
        ],
      }
      const sql = sortPlugin.buildSql(op, mockContext)
      expect(sql).toBe('SELECT * FROM "products" ORDER BY "name" ASC, "id" DESC')
    })

    it('generates ORDER BY with NULLS FIRST', () => {
      const op: SortOperation = {
        type: 'sort',
        sorts: [{ column: 'name', direction: 'asc', nulls: 'first' }],
      }
      const sql = sortPlugin.buildSql(op, mockContext)
      expect(sql).toBe('SELECT * FROM "products" ORDER BY "name" ASC NULLS FIRST')
    })

    it('generates ORDER BY with NULLS LAST', () => {
      const op: SortOperation = {
        type: 'sort',
        sorts: [{ column: 'price', direction: 'desc', nulls: 'last' }],
      }
      const sql = sortPlugin.buildSql(op, mockContext)
      expect(sql).toBe('SELECT * FROM "products" ORDER BY "price" DESC NULLS LAST')
    })

    it('escapes column names with special characters', () => {
      const op: SortOperation = { type: 'sort', sorts: [{ column: 'first-name', direction: 'asc' }] }
      const sql = sortPlugin.buildSql(op, mockContext)
      expect(sql).toBe('SELECT * FROM "products" ORDER BY "first-name" ASC')
    })
  })

  describe('getSummary', () => {
    it('returns single sort summary', () => {
      const op: SortOperation = { type: 'sort', sorts: [{ column: 'name', direction: 'asc' }] }
      expect(sortPlugin.getSummary(op)).toBe('name asc')
    })

    it('returns multiple sort summary', () => {
      const op: SortOperation = {
        type: 'sort',
        sorts: [
          { column: 'name', direction: 'asc' },
          { column: 'id', direction: 'desc' },
        ],
      }
      expect(sortPlugin.getSummary(op)).toBe('name asc, id desc')
    })

    it('truncates long summary', () => {
      const op: SortOperation = {
        type: 'sort',
        sorts: [
          { column: 'very_long_column_name', direction: 'asc' },
          { column: 'another_long_name', direction: 'desc' },
          { column: 'third_column', direction: 'asc' },
        ],
      }
      const summary = sortPlugin.getSummary(op)
      expect(summary.length).toBeLessThanOrEqual(50)
      expect(summary.endsWith('...')).toBe(true)
    })

    it('does not truncate short summary', () => {
      const op: SortOperation = { type: 'sort', sorts: [{ column: 'a', direction: 'asc' }] }
      const summary = sortPlugin.getSummary(op)
      expect(summary.endsWith('...')).toBe(false)
    })
  })

  describe('metadata', () => {
    it('has correct type', () => {
      expect(sortPlugin.type).toBe('sort')
    })

    it('has correct category', () => {
      expect(sortPlugin.category).toBe('query')
    })

    it('has tool definition with required sorts parameter', () => {
      expect(sortPlugin.toolDefinition.name).toBe('sort')
      expect(sortPlugin.toolDefinition.parameters.required).toContain('sorts')
    })
  })
})
