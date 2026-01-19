import { describe, expect, it } from 'vitest'
import { buildCountQuery, buildSelectQuery } from '@/lib/duckdb/query-builder'

describe('buildSelectQuery', () => {
  it('builds basic query with limit and offset', () => {
    const sql = buildSelectQuery({ tableName: 'test', limit: 100, offset: 0 })
    expect(sql).toBe('SELECT * FROM "test" LIMIT 100 OFFSET 0')
  })

  it('includes ORDER BY when sort is provided', () => {
    const sql = buildSelectQuery({
      tableName: 'test',
      sort: { column: 'name', direction: 'asc' },
    })
    expect(sql).toContain('ORDER BY "name" ASC')
  })

  it('builds WHERE clause for eq filter', () => {
    const sql = buildSelectQuery({
      tableName: 'test',
      filters: [{ column: 'age', operator: 'eq', value: 30 }],
    })
    expect(sql).toContain('WHERE "age" = 30')
  })

  it('escapes boolean filters', () => {
    const sql = buildSelectQuery({
      tableName: 'test',
      filters: [{ column: 'active', operator: 'eq', value: true }],
    })
    expect(sql).toContain('WHERE "active" = TRUE')
  })

  it('builds WHERE clause for contains filter', () => {
    const sql = buildSelectQuery({
      tableName: 'test',
      filters: [{ column: 'name', operator: 'contains', value: 'John' }],
    })
    expect(sql).toContain('WHERE "name" ILIKE \'%John%\'')
  })

  it('builds WHERE clause for isNull filter', () => {
    const sql = buildSelectQuery({
      tableName: 'test',
      filters: [{ column: 'email', operator: 'isNull', value: null }],
    })
    expect(sql).toContain('WHERE "email" IS NULL')
  })

  it('builds WHERE clause for isNotNull filter', () => {
    const sql = buildSelectQuery({
      tableName: 'test',
      filters: [{ column: 'email', operator: 'isNotNull', value: null }],
    })
    expect(sql).toContain('WHERE "email" IS NOT NULL')
  })

  it('combines multiple filters with AND', () => {
    const sql = buildSelectQuery({
      tableName: 'test',
      filters: [
        { column: 'age', operator: 'gt', value: 18 },
        { column: 'status', operator: 'eq', value: 'active' },
      ],
    })
    expect(sql).toContain('"age" > 18')
    expect(sql).toContain('"status" = \'active\'')
    expect(sql).toContain('AND')
  })

  it('adds search condition for string columns', () => {
    const sql = buildSelectQuery({
      tableName: 'test',
      search: 'test',
      searchColumns: ['name', 'email'],
    })
    expect(sql).toContain('"name" ILIKE \'%test%\'')
    expect(sql).toContain('"email" ILIKE \'%test%\'')
    expect(sql).toContain('OR')
  })

  it('uses case sensitive LIKE when configured', () => {
    const sql = buildSelectQuery({
      tableName: 'test',
      search: 'Alpha',
      searchColumns: ['name'],
      searchCaseSensitive: true,
    })
    expect(sql).toContain('"name" LIKE \'%Alpha%\'')
    expect(sql).not.toContain('ILIKE')
  })

  it('escapes single quotes in values', () => {
    const sql = buildSelectQuery({
      tableName: 'test',
      filters: [{ column: 'name', operator: 'eq', value: "O'Brien" }],
    })
    expect(sql).toContain("'O''Brien'")
  })
})

describe('buildCountQuery', () => {
  it('builds basic count query', () => {
    const sql = buildCountQuery({ tableName: 'test' })
    expect(sql).toBe('SELECT COUNT(*) as count FROM "test"')
  })

  it('includes WHERE clause for filters', () => {
    const sql = buildCountQuery({
      tableName: 'test',
      filters: [{ column: 'age', operator: 'gt', value: 21 }],
    })
    expect(sql).toContain('WHERE "age" > 21')
  })

  it('respects case sensitive search', () => {
    const sql = buildCountQuery({
      tableName: 'test',
      search: 'Alpha',
      searchColumns: ['name'],
      searchCaseSensitive: true,
    })
    expect(sql).toContain('"name" LIKE \'%Alpha%\'')
    expect(sql).not.toContain('ILIKE')
  })
})
