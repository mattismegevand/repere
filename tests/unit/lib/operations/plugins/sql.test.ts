import { describe, expect, it } from 'vitest'
import { sqlPlugin } from '@/lib/operations/plugins/sql'
import type { Column } from '@/types/dataset'
import type { SqlQueryOperation } from '@/types/pipeline'

const mockColumns: Column[] = [
  { name: 'id', type: 'INTEGER', nullable: false },
  { name: 'name', type: 'VARCHAR', nullable: true },
]

const mockContext = {
  sourceTableName: 'users',
  sourceColumns: mockColumns,
}

describe('sqlPlugin', () => {
  describe('validate', () => {
    it('returns valid operation with SQL query', () => {
      const result = sqlPlugin.validate({ sql: 'SELECT * FROM users' }, mockColumns)
      expect(result.valid).toBe(true)
      expect(result.operation).toMatchObject({
        type: 'sql',
        sql: 'SELECT * FROM users',
      })
      expect(result.errors).toHaveLength(0)
    })

    it('returns valid operation with complex SQL', () => {
      const sql = `
				SELECT id, name, COUNT(*) as cnt
				FROM users
				GROUP BY id, name
				HAVING COUNT(*) > 1
			`
      const result = sqlPlugin.validate({ sql }, mockColumns)
      expect(result.valid).toBe(true)
    })

    it('returns error for missing SQL', () => {
      const result = sqlPlugin.validate({}, mockColumns)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('sql requires a SQL query string')
    })

    it('returns error for empty SQL', () => {
      const result = sqlPlugin.validate({ sql: '' }, mockColumns)
      expect(result.valid).toBe(false)
    })

    it('returns error for non-string SQL', () => {
      const result = sqlPlugin.validate({ sql: 123 }, mockColumns)
      expect(result.valid).toBe(false)
    })

    it('initializes referencedTables as empty array', () => {
      const result = sqlPlugin.validate({ sql: 'SELECT 1' }, mockColumns)
      expect((result.operation as SqlQueryOperation).referencedTables).toEqual([])
    })
  })

  describe('buildSql', () => {
    it('returns the SQL query as-is', () => {
      const op: SqlQueryOperation = {
        type: 'sql',
        sql: 'SELECT * FROM users WHERE id > 10',
        referencedTables: [],
      }
      const sql = sqlPlugin.buildSql(op, mockContext)
      expect(sql).toBe('SELECT * FROM users WHERE id > 10')
    })

    it('preserves complex queries', () => {
      const complexSql = `
				WITH cte AS (SELECT * FROM users)
				SELECT * FROM cte
			`
      const op: SqlQueryOperation = { type: 'sql', sql: complexSql, referencedTables: [] }
      const sql = sqlPlugin.buildSql(op, mockContext)
      expect(sql).toBe(complexSql)
    })

    it('does not modify the query', () => {
      const originalSql = 'SELECT id, name FROM "users" WHERE name LIKE \'%test%\''
      const op: SqlQueryOperation = { type: 'sql', sql: originalSql, referencedTables: [] }
      const sql = sqlPlugin.buildSql(op, mockContext)
      expect(sql).toBe(originalSql)
    })
  })

  describe('getSummary', () => {
    it('returns first line for short query', () => {
      const op: SqlQueryOperation = {
        type: 'sql',
        sql: 'SELECT * FROM users',
        referencedTables: [],
      }
      expect(sqlPlugin.getSummary(op)).toBe('SELECT * FROM users')
    })

    it('truncates long first line', () => {
      const op: SqlQueryOperation = {
        type: 'sql',
        sql: "SELECT id, name, email, created_at, updated_at FROM users WHERE status = 'active'",
        referencedTables: [],
      }
      const summary = sqlPlugin.getSummary(op)
      expect(summary.length).toBeLessThanOrEqual(40)
      expect(summary.endsWith('...')).toBe(true)
    })

    it('returns first line of multiline query', () => {
      const op: SqlQueryOperation = {
        type: 'sql',
        sql: 'SELECT *\nFROM users\nWHERE id = 1',
        referencedTables: [],
      }
      expect(sqlPlugin.getSummary(op)).toBe('SELECT *')
    })

    it('trims whitespace', () => {
      const op: SqlQueryOperation = {
        type: 'sql',
        sql: '  SELECT * FROM users  ',
        referencedTables: [],
      }
      expect(sqlPlugin.getSummary(op)).toBe('SELECT * FROM users')
    })
  })

  describe('metadata', () => {
    it('has correct type', () => {
      expect(sqlPlugin.type).toBe('sql')
    })

    it('has correct category', () => {
      expect(sqlPlugin.category).toBe('custom')
    })

    it('has tool definition with required sql parameter', () => {
      expect(sqlPlugin.toolDefinition.name).toBe('sql')
      expect(sqlPlugin.toolDefinition.parameters.required).toContain('sql')
    })
  })
})
