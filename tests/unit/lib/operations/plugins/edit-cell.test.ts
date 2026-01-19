import { describe, expect, it } from 'vitest'
import { editCellPlugin } from '@/lib/operations/plugins/edit-cell'
import type { Column } from '@/types/dataset'
import type { EditCellOperation } from '@/types/pipeline'

const mockColumns: Column[] = [
  { name: 'id', type: 'INTEGER', nullable: false },
  { name: 'name', type: 'VARCHAR', nullable: true },
  { name: 'price', type: 'DECIMAL', nullable: true },
]

const mockContext = {
  sourceTableName: 'products',
  sourceColumns: mockColumns,
}

describe('editCellPlugin', () => {
  describe('validate', () => {
    it('returns valid operation with single edit', () => {
      const result = editCellPlugin.validate({ edits: [{ rowId: 1, column: 'name', value: 'Updated' }] }, mockColumns)
      expect(result.valid).toBe(true)
      expect(result.operation).toMatchObject({
        type: 'editCell',
        edits: [{ rowId: 1, column: 'name', value: 'Updated' }],
      })
      expect(result.errors).toHaveLength(0)
    })

    it('returns valid operation with multiple edits', () => {
      const result = editCellPlugin.validate(
        {
          edits: [
            { rowId: 1, column: 'name', value: 'A' },
            { rowId: 2, column: 'name', value: 'B' },
          ],
        },
        mockColumns
      )
      expect(result.valid).toBe(true)
      expect((result.operation as EditCellOperation).edits).toHaveLength(2)
    })

    it('returns valid operation with null value', () => {
      const result = editCellPlugin.validate({ edits: [{ rowId: 1, column: 'name', value: null }] }, mockColumns)
      expect(result.valid).toBe(true)
    })

    it('returns valid operation with numeric value', () => {
      const result = editCellPlugin.validate({ edits: [{ rowId: 1, column: 'price', value: 99.99 }] }, mockColumns)
      expect(result.valid).toBe(true)
    })

    it('returns valid operation with boolean value', () => {
      const result = editCellPlugin.validate({ edits: [{ rowId: 1, column: 'name', value: true }] }, mockColumns)
      expect(result.valid).toBe(true)
    })

    it('returns error for empty edits array', () => {
      const result = editCellPlugin.validate({ edits: [] }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('editCell requires at least one edit')
    })

    it('returns error for missing edits', () => {
      const result = editCellPlugin.validate({}, mockColumns)
      expect(result.valid).toBe(false)
    })

    it('returns error for invalid rowId (zero)', () => {
      const result = editCellPlugin.validate({ edits: [{ rowId: 0, column: 'name', value: 'test' }] }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('valid rowId')
    })

    it('returns error for invalid rowId (negative)', () => {
      const result = editCellPlugin.validate({ edits: [{ rowId: -1, column: 'name', value: 'test' }] }, mockColumns)
      expect(result.valid).toBe(false)
    })

    it('returns error for non-existent column', () => {
      const result = editCellPlugin.validate(
        { edits: [{ rowId: 1, column: 'nonexistent', value: 'test' }] },
        mockColumns
      )
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Column "nonexistent" does not exist')
    })
  })

  describe('buildSql', () => {
    it('generates CASE WHEN for single edit', () => {
      const op: EditCellOperation = {
        type: 'editCell',
        edits: [{ rowId: 1, column: 'name', value: 'Updated' }],
      }
      const sql = editCellPlugin.buildSql(op, mockContext)
      expect(sql).toContain('CASE WHEN __row_id = 1 THEN')
      expect(sql).toContain("'Updated'")
      expect(sql).toContain('ELSE "name" END AS "name"')
    })

    it('generates multiple WHEN clauses for same column', () => {
      const op: EditCellOperation = {
        type: 'editCell',
        edits: [
          { rowId: 1, column: 'name', value: 'A' },
          { rowId: 2, column: 'name', value: 'B' },
        ],
      }
      const sql = editCellPlugin.buildSql(op, mockContext)
      expect(sql).toContain('WHEN __row_id = 1')
      expect(sql).toContain('WHEN __row_id = 2')
    })

    it('generates separate CASE for different columns', () => {
      const op: EditCellOperation = {
        type: 'editCell',
        edits: [
          { rowId: 1, column: 'name', value: 'A' },
          { rowId: 1, column: 'price', value: 100 },
        ],
      }
      const sql = editCellPlugin.buildSql(op, mockContext)
      expect(sql).toContain('AS "name"')
      expect(sql).toContain('AS "price"')
    })

    it('includes ROW_NUMBER subquery', () => {
      const op: EditCellOperation = {
        type: 'editCell',
        edits: [{ rowId: 1, column: 'name', value: 'test' }],
      }
      const sql = editCellPlugin.buildSql(op, mockContext)
      expect(sql).toContain('ROW_NUMBER() OVER () AS __row_id')
      expect(sql).toContain('FROM "products"')
    })

    it('preserves unedited columns', () => {
      const op: EditCellOperation = {
        type: 'editCell',
        edits: [{ rowId: 1, column: 'name', value: 'test' }],
      }
      const sql = editCellPlugin.buildSql(op, mockContext)
      expect(sql).toContain('"id"')
      expect(sql).toContain('"price"')
    })
  })

  describe('getSummary', () => {
    it('returns summary for single edit', () => {
      const op: EditCellOperation = {
        type: 'editCell',
        edits: [{ rowId: 5, column: 'name', value: 'test' }],
      }
      expect(editCellPlugin.getSummary(op)).toBe('Cell edit: row 5')
    })

    it('returns count for multiple edits', () => {
      const op: EditCellOperation = {
        type: 'editCell',
        edits: [
          { rowId: 1, column: 'name', value: 'a' },
          { rowId: 2, column: 'name', value: 'b' },
          { rowId: 3, column: 'name', value: 'c' },
        ],
      }
      expect(editCellPlugin.getSummary(op)).toBe('3 cell edits')
    })
  })

  describe('metadata', () => {
    it('has correct type', () => {
      expect(editCellPlugin.type).toBe('editCell')
    })

    it('has correct category', () => {
      expect(editCellPlugin.category).toBe('cell')
    })

    it('has tool definition with required edits parameter', () => {
      expect(editCellPlugin.toolDefinition.name).toBe('editCell')
      expect(editCellPlugin.toolDefinition.parameters.required).toContain('edits')
    })
  })
})
