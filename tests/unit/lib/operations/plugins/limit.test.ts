import { describe, expect, it } from 'vitest'
import { limitPlugin } from '@/lib/operations/plugins/limit'
import type { Column } from '@/types/dataset'
import type { LimitOperation } from '@/types/pipeline'

const mockColumns: Column[] = [
  { name: 'id', type: 'INTEGER', nullable: false },
  { name: 'name', type: 'VARCHAR', nullable: true },
]

const mockContext = {
  sourceTableName: 'test_table',
  sourceColumns: mockColumns,
}

describe('limitPlugin', () => {
  describe('validate', () => {
    it('returns valid operation with limit only', () => {
      const result = limitPlugin.validate({ limit: 100 }, mockColumns)
      expect(result.valid).toBe(true)
      expect(result.operation).toMatchObject({ type: 'limit', limit: 100 })
      expect(result.errors).toHaveLength(0)
    })

    it('returns valid operation with limit and offset', () => {
      const result = limitPlugin.validate({ limit: 50, offset: 10 }, mockColumns)
      expect(result.valid).toBe(true)
      expect(result.operation).toMatchObject({ type: 'limit', limit: 50, offset: 10 })
    })

    it('returns valid operation with zero offset', () => {
      const result = limitPlugin.validate({ limit: 100, offset: 0 }, mockColumns)
      expect(result.valid).toBe(true)
      expect(result.operation).toMatchObject({ type: 'limit', limit: 100, offset: 0 })
    })

    it('returns error for zero limit', () => {
      const result = limitPlugin.validate({ limit: 0 }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Limit must be a positive number')
    })

    it('returns error for negative limit', () => {
      const result = limitPlugin.validate({ limit: -10 }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Limit must be a positive number')
    })

    it('returns error for negative offset', () => {
      const result = limitPlugin.validate({ limit: 100, offset: -5 }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Offset must be a non-negative number')
    })

    it('returns error for non-numeric limit', () => {
      const result = limitPlugin.validate({ limit: 'ten' }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Limit must be a positive number')
    })

    it('returns error for non-numeric offset', () => {
      const result = limitPlugin.validate({ limit: 100, offset: 'five' }, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Offset must be a non-negative number')
    })

    it('returns error for missing limit', () => {
      const result = limitPlugin.validate({}, mockColumns)
      expect(result.valid).toBe(false)
    })
  })

  describe('buildSql', () => {
    it('generates LIMIT clause only', () => {
      const op: LimitOperation = { type: 'limit', limit: 100 }
      const sql = limitPlugin.buildSql(op, mockContext)
      expect(sql).toBe('SELECT * FROM "test_table" LIMIT 100 ')
    })

    it('generates LIMIT with OFFSET clause', () => {
      const op: LimitOperation = { type: 'limit', limit: 50, offset: 10 }
      const sql = limitPlugin.buildSql(op, mockContext)
      expect(sql).toBe('SELECT * FROM "test_table" LIMIT 50 OFFSET 10')
    })

    it('generates LIMIT with zero offset (no OFFSET clause)', () => {
      const op: LimitOperation = { type: 'limit', limit: 100, offset: 0 }
      const sql = limitPlugin.buildSql(op, mockContext)
      expect(sql).toBe('SELECT * FROM "test_table" LIMIT 100 ')
    })

    it('handles large limit values', () => {
      const op: LimitOperation = { type: 'limit', limit: 1000000 }
      const sql = limitPlugin.buildSql(op, mockContext)
      expect(sql).toBe('SELECT * FROM "test_table" LIMIT 1000000 ')
    })

    it('escapes table names', () => {
      const op: LimitOperation = { type: 'limit', limit: 10 }
      const sql = limitPlugin.buildSql(op, { ...mockContext, sourceTableName: 'my-table' })
      expect(sql).toBe('SELECT * FROM "my-table" LIMIT 10 ')
    })
  })

  describe('getSummary', () => {
    it('returns "First N rows" for limit only', () => {
      const op: LimitOperation = { type: 'limit', limit: 100 }
      expect(limitPlugin.getSummary(op)).toBe('First 100 rows')
    })

    it('returns row range for limit with offset', () => {
      const op: LimitOperation = { type: 'limit', limit: 50, offset: 10 }
      expect(limitPlugin.getSummary(op)).toBe('Rows 11-60')
    })

    it('formats large numbers with locale', () => {
      const op: LimitOperation = { type: 'limit', limit: 1000000 }
      expect(limitPlugin.getSummary(op)).toBe('First 1,000,000 rows')
    })

    it('handles offset of 0 as no offset', () => {
      const op: LimitOperation = { type: 'limit', limit: 100, offset: 0 }
      expect(limitPlugin.getSummary(op)).toBe('First 100 rows')
    })
  })

  describe('metadata', () => {
    it('has correct type', () => {
      expect(limitPlugin.type).toBe('limit')
    })

    it('has correct category', () => {
      expect(limitPlugin.category).toBe('query')
    })

    it('has tool definition with required limit parameter', () => {
      expect(limitPlugin.toolDefinition.name).toBe('limit')
      expect(limitPlugin.toolDefinition.parameters.required).toContain('limit')
    })
  })
})
