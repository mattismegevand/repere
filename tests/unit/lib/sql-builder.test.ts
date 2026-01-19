import { describe, expect, it } from 'vitest'
import {
  buildCreateViewSql,
  buildDropViewSql,
  buildOperationSql,
  escapeIdentifier,
  escapeValue,
  generateViewName,
  getOperationDisplayName,
  type OperationContext,
} from '@/lib/duckdb/sql-builder'
import type { Column, FilterExpression } from '@/types'

// Helper to create a basic context
function createContext(
  tableName: string = 'test_table',
  columns: Column[] = [
    { name: 'id', type: 'INTEGER' },
    { name: 'name', type: 'VARCHAR' },
    { name: 'value', type: 'DOUBLE' },
  ]
): OperationContext {
  return { sourceTableName: tableName, sourceColumns: columns }
}

describe('escapeIdentifier', () => {
  it('wraps identifier in double quotes', () => {
    expect(escapeIdentifier('column')).toBe('"column"')
  })

  it('escapes double quotes by doubling them', () => {
    expect(escapeIdentifier('column"name')).toBe('"column""name"')
  })

  it('handles multiple double quotes', () => {
    expect(escapeIdentifier('a"b"c')).toBe('"a""b""c"')
  })

  it('handles empty string', () => {
    expect(escapeIdentifier('')).toBe('""')
  })

  // SQL injection prevention tests
  it('prevents SQL injection via identifier with semicolon', () => {
    const malicious = 'col; DROP TABLE users;--'
    const escaped = escapeIdentifier(malicious)
    // The quotes around it make it a literal identifier, not executable SQL
    expect(escaped).toBe('"col; DROP TABLE users;--"')
    // Starts and ends with quotes, making the whole thing a single identifier
    expect(escaped.startsWith('"')).toBe(true)
    expect(escaped.endsWith('"')).toBe(true)
  })

  it('prevents SQL injection via identifier with quotes and commands', () => {
    const malicious = '"; DROP TABLE users;--'
    const escaped = escapeIdentifier(malicious)
    expect(escaped).toBe('"""; DROP TABLE users;--"')
  })

  it('handles identifier with newlines', () => {
    const malicious = 'col\nDROP TABLE users'
    const escaped = escapeIdentifier(malicious)
    expect(escaped).toBe('"col\nDROP TABLE users"')
  })

  it('handles reserved SQL keywords as identifiers', () => {
    expect(escapeIdentifier('SELECT')).toBe('"SELECT"')
    expect(escapeIdentifier('FROM')).toBe('"FROM"')
    expect(escapeIdentifier('WHERE')).toBe('"WHERE"')
  })

  it('handles special characters in column names', () => {
    expect(escapeIdentifier('column-name')).toBe('"column-name"')
    expect(escapeIdentifier('column.name')).toBe('"column.name"')
    expect(escapeIdentifier('column name')).toBe('"column name"')
    expect(escapeIdentifier('column@name')).toBe('"column@name"')
  })
})

describe('escapeValue', () => {
  it('returns NULL for null', () => {
    expect(escapeValue(null)).toBe('NULL')
  })

  it('returns NULL for undefined', () => {
    expect(escapeValue(undefined)).toBe('NULL')
  })

  it('returns number as string', () => {
    expect(escapeValue(42)).toBe('42')
    expect(escapeValue(3.14159)).toBe('3.14159')
    expect(escapeValue(-100)).toBe('-100')
    expect(escapeValue(0)).toBe('0')
  })

  it('handles special number values', () => {
    expect(escapeValue(Infinity)).toBe('Infinity')
    expect(escapeValue(-Infinity)).toBe('-Infinity')
    expect(escapeValue(NaN)).toBe('NaN')
  })

  it('returns boolean as TRUE/FALSE', () => {
    expect(escapeValue(true)).toBe('TRUE')
    expect(escapeValue(false)).toBe('FALSE')
  })

  it('returns Date as ISO string in quotes', () => {
    const date = new Date('2024-01-15T10:30:00.000Z')
    expect(escapeValue(date)).toBe("'2024-01-15T10:30:00.000Z'")
  })

  it('returns string in single quotes', () => {
    expect(escapeValue('hello')).toBe("'hello'")
  })

  it('escapes single quotes in strings by doubling', () => {
    expect(escapeValue("O'Brien")).toBe("'O''Brien'")
    expect(escapeValue("It's a 'test'")).toBe("'It''s a ''test'''")
  })

  it('handles array values', () => {
    expect(escapeValue([1, 2, 3])).toBe('(1, 2, 3)')
    expect(escapeValue(['a', 'b'])).toBe("('a', 'b')")
    expect(escapeValue([1, 'two', null])).toBe("(1, 'two', NULL)")
  })

  it('handles empty array', () => {
    expect(escapeValue([])).toBe('()')
  })

  // SQL injection prevention tests
  it('prevents SQL injection via string value', () => {
    const malicious = "'; DROP TABLE users;--"
    const escaped = escapeValue(malicious)
    expect(escaped).toBe("'''; DROP TABLE users;--'")
    // The single quote is escaped, making it a literal string
  })

  it('prevents SQL injection via string with double quotes', () => {
    const malicious = '"; DROP TABLE users;--'
    const escaped = escapeValue(malicious)
    expect(escaped).toBe("'\"; DROP TABLE users;--'")
  })

  it('handles strings with backslashes', () => {
    expect(escapeValue('path\\to\\file')).toBe("'path\\to\\file'")
  })

  it('handles strings with newlines', () => {
    expect(escapeValue('line1\nline2')).toBe("'line1\nline2'")
  })

  it('handles strings with various special characters', () => {
    expect(escapeValue('test%value')).toBe("'test%value'")
    expect(escapeValue('test_value')).toBe("'test_value'")
    expect(escapeValue('test[value]')).toBe("'test[value]'")
  })
})

describe('buildOperationSql - filter operations', () => {
  const ctx = createContext()

  // Helper to create a simple filter expression
  const cond = (column: string, operator: string, value: unknown) => ({
    type: 'condition' as const,
    filter: { column, operator, value },
  })

  it('builds eq filter', () => {
    const sql = buildOperationSql({ type: 'filter', expression: cond('id', 'eq', 1) }, ctx)
    expect(sql).toBe('SELECT * FROM "test_table" WHERE "id" = 1')
  })

  it('builds neq filter', () => {
    const sql = buildOperationSql({ type: 'filter', expression: cond('id', 'neq', 1) }, ctx)
    expect(sql).toBe('SELECT * FROM "test_table" WHERE "id" != 1')
  })

  it('builds gt filter', () => {
    const sql = buildOperationSql({ type: 'filter', expression: cond('value', 'gt', 10.5) }, ctx)
    expect(sql).toBe('SELECT * FROM "test_table" WHERE "value" > 10.5')
  })

  it('builds lt filter', () => {
    const sql = buildOperationSql({ type: 'filter', expression: cond('value', 'lt', 100) }, ctx)
    expect(sql).toBe('SELECT * FROM "test_table" WHERE "value" < 100')
  })

  it('builds gte filter', () => {
    const sql = buildOperationSql({ type: 'filter', expression: cond('value', 'gte', 0) }, ctx)
    expect(sql).toBe('SELECT * FROM "test_table" WHERE "value" >= 0')
  })

  it('builds lte filter', () => {
    const sql = buildOperationSql({ type: 'filter', expression: cond('value', 'lte', 999) }, ctx)
    expect(sql).toBe('SELECT * FROM "test_table" WHERE "value" <= 999')
  })

  it('builds contains filter', () => {
    const sql = buildOperationSql({ type: 'filter', expression: cond('name', 'contains', 'test') }, ctx)
    expect(sql).toBe("SELECT * FROM \"test_table\" WHERE \"name\" ILIKE '%' || 'test' || '%'")
  })

  it('builds notContains filter', () => {
    const sql = buildOperationSql({ type: 'filter', expression: cond('name', 'notContains', 'bad') }, ctx)
    expect(sql).toBe("SELECT * FROM \"test_table\" WHERE \"name\" NOT ILIKE '%' || 'bad' || '%'")
  })

  it('builds startsWith filter', () => {
    const sql = buildOperationSql({ type: 'filter', expression: cond('name', 'startsWith', 'prefix') }, ctx)
    expect(sql).toBe('SELECT * FROM "test_table" WHERE "name" ILIKE \'prefix\' || \'%\'')
  })

  it('builds endsWith filter', () => {
    const sql = buildOperationSql({ type: 'filter', expression: cond('name', 'endsWith', 'suffix') }, ctx)
    expect(sql).toBe('SELECT * FROM "test_table" WHERE "name" ILIKE \'%\' || \'suffix\'')
  })

  it('builds isNull filter', () => {
    const sql = buildOperationSql({ type: 'filter', expression: cond('name', 'isNull', null) }, ctx)
    expect(sql).toBe('SELECT * FROM "test_table" WHERE "name" IS NULL')
  })

  it('builds isNotNull filter', () => {
    const sql = buildOperationSql({ type: 'filter', expression: cond('name', 'isNotNull', null) }, ctx)
    expect(sql).toBe('SELECT * FROM "test_table" WHERE "name" IS NOT NULL')
  })

  it('builds in filter', () => {
    const sql = buildOperationSql({ type: 'filter', expression: cond('id', 'in', [1, 2, 3]) }, ctx)
    expect(sql).toBe('SELECT * FROM "test_table" WHERE "id" IN (1, 2, 3)')
  })

  it('builds notIn filter', () => {
    const sql = buildOperationSql({ type: 'filter', expression: cond('name', 'notIn', ['bad', 'ugly']) }, ctx)
    expect(sql).toBe('SELECT * FROM "test_table" WHERE "name" NOT IN (\'bad\', \'ugly\')')
  })

  it('builds between filter', () => {
    const sql = buildOperationSql({ type: 'filter', expression: cond('value', 'between', [10, 20]) }, ctx)
    expect(sql).toBe('SELECT * FROM "test_table" WHERE "value" BETWEEN 10 AND 20')
  })

  it('combines multiple filters with AND', () => {
    const sql = buildOperationSql(
      {
        type: 'filter',
        expression: {
          type: 'group',
          combineMode: 'and',
          children: [cond('id', 'gt', 0), cond('name', 'isNotNull', null)],
        },
      },
      ctx
    )
    expect(sql).toBe('SELECT * FROM "test_table" WHERE ("id" > 0 AND "name" IS NOT NULL)')
  })

  it('combines multiple filters with OR', () => {
    const sql = buildOperationSql(
      {
        type: 'filter',
        expression: {
          type: 'group',
          combineMode: 'or',
          children: [cond('id', 'eq', 1), cond('id', 'eq', 2)],
        },
      },
      ctx
    )
    expect(sql).toBe('SELECT * FROM "test_table" WHERE ("id" = 1 OR "id" = 2)')
  })

  it('handles empty filters', () => {
    const sql = buildOperationSql(
      { type: 'filter', expression: { type: 'group', combineMode: 'and', children: [] } },
      ctx
    )
    expect(sql).toBe('SELECT * FROM "test_table" WHERE 1=1')
  })

  it('handles unknown operator with fallback', () => {
    const sql = buildOperationSql(
      // @ts-expect-error testing unknown operator
      { type: 'filter', expression: cond('id', 'unknown', 1) },
      ctx
    )
    expect(sql).toBe('SELECT * FROM "test_table" WHERE 1=1')
  })
})

describe('buildOperationSql - filter expressions (nested)', () => {
  const ctx = createContext()

  it('builds simple condition expression', () => {
    const expression: FilterExpression = {
      type: 'condition',
      filter: { column: 'id', operator: 'eq', value: 1 },
    }
    const sql = buildOperationSql({ type: 'filter', expression }, ctx)
    expect(sql).toBe('SELECT * FROM "test_table" WHERE "id" = 1')
  })

  it('builds AND group expression', () => {
    const expression: FilterExpression = {
      type: 'group',
      combineMode: 'and',
      children: [
        { type: 'condition', filter: { column: 'id', operator: 'gt', value: 0 } },
        { type: 'condition', filter: { column: 'name', operator: 'isNotNull', value: null } },
      ],
    }
    const sql = buildOperationSql({ type: 'filter', expression }, ctx)
    expect(sql).toBe('SELECT * FROM "test_table" WHERE ("id" > 0 AND "name" IS NOT NULL)')
  })

  it('builds OR group expression', () => {
    const expression: FilterExpression = {
      type: 'group',
      combineMode: 'or',
      children: [
        { type: 'condition', filter: { column: 'id', operator: 'eq', value: 1 } },
        { type: 'condition', filter: { column: 'id', operator: 'eq', value: 2 } },
      ],
    }
    const sql = buildOperationSql({ type: 'filter', expression }, ctx)
    expect(sql).toBe('SELECT * FROM "test_table" WHERE ("id" = 1 OR "id" = 2)')
  })

  it('builds nested group expressions', () => {
    const expression: FilterExpression = {
      type: 'group',
      combineMode: 'and',
      children: [
        { type: 'condition', filter: { column: 'value', operator: 'gt', value: 0 } },
        {
          type: 'group',
          combineMode: 'or',
          children: [
            { type: 'condition', filter: { column: 'name', operator: 'eq', value: 'a' } },
            { type: 'condition', filter: { column: 'name', operator: 'eq', value: 'b' } },
          ],
        },
      ],
    }
    const sql = buildOperationSql({ type: 'filter', expression }, ctx)
    expect(sql).toBe('SELECT * FROM "test_table" WHERE ("value" > 0 AND ("name" = \'a\' OR "name" = \'b\'))')
  })

  it('handles empty group', () => {
    const expression: FilterExpression = {
      type: 'group',
      combineMode: 'and',
      children: [],
    }
    const sql = buildOperationSql({ type: 'filter', expression }, ctx)
    expect(sql).toBe('SELECT * FROM "test_table" WHERE 1=1')
  })

  it('handles single-child group', () => {
    const expression: FilterExpression = {
      type: 'group',
      combineMode: 'and',
      children: [{ type: 'condition', filter: { column: 'id', operator: 'eq', value: 1 } }],
    }
    const sql = buildOperationSql({ type: 'filter', expression }, ctx)
    expect(sql).toBe('SELECT * FROM "test_table" WHERE "id" = 1')
  })
})

describe('buildOperationSql - sort operations', () => {
  const ctx = createContext()

  it('builds single sort ascending', () => {
    const sql = buildOperationSql({ type: 'sort', sorts: [{ column: 'name', direction: 'asc' }] }, ctx)
    expect(sql).toBe('SELECT * FROM "test_table" ORDER BY "name" ASC')
  })

  it('builds single sort descending', () => {
    const sql = buildOperationSql({ type: 'sort', sorts: [{ column: 'value', direction: 'desc' }] }, ctx)
    expect(sql).toBe('SELECT * FROM "test_table" ORDER BY "value" DESC')
  })

  it('builds multiple sorts', () => {
    const sql = buildOperationSql(
      {
        type: 'sort',
        sorts: [
          { column: 'name', direction: 'asc' },
          { column: 'value', direction: 'desc' },
        ],
      },
      ctx
    )
    expect(sql).toBe('SELECT * FROM "test_table" ORDER BY "name" ASC, "value" DESC')
  })

  it('builds sort with nulls first', () => {
    const sql = buildOperationSql({ type: 'sort', sorts: [{ column: 'name', direction: 'asc', nulls: 'first' }] }, ctx)
    expect(sql).toBe('SELECT * FROM "test_table" ORDER BY "name" ASC NULLS FIRST')
  })

  it('builds sort with nulls last', () => {
    const sql = buildOperationSql({ type: 'sort', sorts: [{ column: 'name', direction: 'desc', nulls: 'last' }] }, ctx)
    expect(sql).toBe('SELECT * FROM "test_table" ORDER BY "name" DESC NULLS LAST')
  })

  it('handles empty sorts', () => {
    const sql = buildOperationSql({ type: 'sort', sorts: [] }, ctx)
    expect(sql).toBe('SELECT * FROM "test_table" ')
  })
})

describe('buildOperationSql - limit operations', () => {
  const ctx = createContext()

  it('builds limit only', () => {
    const sql = buildOperationSql({ type: 'limit', limit: 100 }, ctx)
    expect(sql).toBe('SELECT * FROM "test_table" LIMIT 100 ')
  })

  it('builds limit with offset', () => {
    const sql = buildOperationSql({ type: 'limit', limit: 50, offset: 100 }, ctx)
    expect(sql).toBe('SELECT * FROM "test_table" LIMIT 50 OFFSET 100')
  })

  it('builds limit with zero offset', () => {
    const sql = buildOperationSql({ type: 'limit', limit: 10, offset: 0 }, ctx)
    expect(sql).toBe('SELECT * FROM "test_table" LIMIT 10 ')
  })
})

describe('buildOperationSql - select operations', () => {
  const ctx = createContext()

  it('builds select with specific columns', () => {
    const sql = buildOperationSql({ type: 'select', columns: ['id', 'name'] }, ctx)
    expect(sql).toBe('SELECT "id", "name" FROM "test_table"')
  })

  it('builds select with single column', () => {
    const sql = buildOperationSql({ type: 'select', columns: ['id'] }, ctx)
    expect(sql).toBe('SELECT "id" FROM "test_table"')
  })

  it('handles columns with special characters', () => {
    const sql = buildOperationSql({ type: 'select', columns: ['col-1', 'col 2', 'col"3'] }, ctx)
    expect(sql).toBe('SELECT "col-1", "col 2", "col""3" FROM "test_table"')
  })
})

describe('buildOperationSql - addColumn operations', () => {
  const ctx = createContext()

  it('builds addColumn with expression', () => {
    const sql = buildOperationSql({ type: 'addColumn', columns: [{ name: 'doubled', expression: '"value" * 2' }] }, ctx)
    expect(sql).toBe('SELECT *, ("value" * 2) AS "doubled" FROM "test_table"')
  })

  it('builds addColumn with multiple columns', () => {
    const sql = buildOperationSql(
      {
        type: 'addColumn',
        columns: [
          { name: 'doubled', expression: '"value" * 2' },
          { name: 'upper_name', expression: 'UPPER("name")' },
        ],
      },
      ctx
    )
    expect(sql).toBe('SELECT *, ("value" * 2) AS "doubled", (UPPER("name")) AS "upper_name" FROM "test_table"')
  })
})

describe('buildOperationSql - removeColumns operations', () => {
  const ctx = createContext()

  it('removes single column', () => {
    const sql = buildOperationSql({ type: 'removeColumns', columns: ['value'] }, ctx)
    expect(sql).toBe('SELECT "id", "name" FROM "test_table"')
  })

  it('removes multiple columns', () => {
    const sql = buildOperationSql({ type: 'removeColumns', columns: ['name', 'value'] }, ctx)
    expect(sql).toBe('SELECT "id" FROM "test_table"')
  })
})

describe('buildOperationSql - renameColumns operations', () => {
  const ctx = createContext()

  it('renames single column', () => {
    const sql = buildOperationSql({ type: 'renameColumns', renames: [{ from: 'name', to: 'full_name' }] }, ctx)
    expect(sql).toBe('SELECT "id", "name" AS "full_name", "value" FROM "test_table"')
  })

  it('renames multiple columns', () => {
    const sql = buildOperationSql(
      {
        type: 'renameColumns',
        renames: [
          { from: 'name', to: 'full_name' },
          { from: 'value', to: 'amount' },
        ],
      },
      ctx
    )
    expect(sql).toBe('SELECT "id", "name" AS "full_name", "value" AS "amount" FROM "test_table"')
  })
})

describe('buildOperationSql - reorderColumns operations', () => {
  const ctx = createContext()

  it('reorders columns', () => {
    const sql = buildOperationSql({ type: 'reorderColumns', order: ['value', 'name', 'id'] }, ctx)
    expect(sql).toBe('SELECT "value", "name", "id" FROM "test_table"')
  })
})

describe('buildOperationSql - castColumn operations', () => {
  const ctx = createContext()

  it('casts column to new type', () => {
    const sql = buildOperationSql({ type: 'castColumn', column: 'id', toType: 'VARCHAR' }, ctx)
    expect(sql).toBe('SELECT CAST("id" AS VARCHAR) AS "id", "name", "value" FROM "test_table"')
  })
})

describe('buildOperationSql - pivot groupBy mode (no pivotColumn)', () => {
  const ctx = createContext()

  it('builds pivot in groupBy mode with single aggregation', () => {
    const sql = buildOperationSql(
      {
        type: 'pivot',
        rowColumns: ['name'],
        pivotColumn: null,
        aggregations: [{ column: 'value', function: 'sum', alias: 'total_value' }],
      },
      ctx
    )
    expect(sql).toBe('SELECT "name", SUM("value") AS "total_value" FROM "test_table" GROUP BY "name"')
  })

  it('builds pivot in groupBy mode with multiple aggregations', () => {
    const sql = buildOperationSql(
      {
        type: 'pivot',
        rowColumns: ['name'],
        pivotColumn: null,
        aggregations: [
          { column: 'value', function: 'sum', alias: 'total' },
          { column: 'value', function: 'avg', alias: 'average' },
          { column: 'id', function: 'count', alias: 'count' },
        ],
      },
      ctx
    )
    expect(sql).toBe(
      'SELECT "name", SUM("value") AS "total", AVG("value") AS "average", COUNT("id") AS "count" FROM "test_table" GROUP BY "name"'
    )
  })

  it('builds pivot in groupBy mode with all aggregate functions', () => {
    const aggregations = [
      { column: 'value', function: 'count', alias: 'cnt' },
      { column: 'value', function: 'countDistinct', alias: 'cnt_distinct' },
      { column: 'value', function: 'sum', alias: 's' },
      { column: 'value', function: 'avg', alias: 'a' },
      { column: 'value', function: 'min', alias: 'mn' },
      { column: 'value', function: 'max', alias: 'mx' },
      { column: 'value', function: 'first', alias: 'f' },
      { column: 'value', function: 'last', alias: 'l' },
      { column: 'value', function: 'stddev', alias: 'sd' },
      { column: 'value', function: 'variance', alias: 'var' },
      { column: 'value', function: 'list', alias: 'lst' },
    ]
    const sql = buildOperationSql({ type: 'pivot', rowColumns: ['name'], pivotColumn: null, aggregations }, ctx)
    expect(sql).toContain('COUNT("value") AS "cnt"')
    expect(sql).toContain('COUNT(DISTINCT "value") AS "cnt_distinct"')
    expect(sql).toContain('SUM("value") AS "s"')
    expect(sql).toContain('AVG("value") AS "a"')
    expect(sql).toContain('MIN("value") AS "mn"')
    expect(sql).toContain('MAX("value") AS "mx"')
    expect(sql).toContain('FIRST("value") AS "f"')
    expect(sql).toContain('LAST("value") AS "l"')
    expect(sql).toContain('STDDEV("value") AS "sd"')
    expect(sql).toContain('VARIANCE("value") AS "var"')
    expect(sql).toContain('LIST("value") AS "lst"')
  })
})

describe('buildOperationSql - pivot operations', () => {
  const ctx = createContext()

  it('builds simple pivot with single aggregation (no row dims)', () => {
    const sql = buildOperationSql(
      {
        type: 'pivot',
        rowColumns: [],
        pivotColumn: 'name',
        pivotValues: ['a', 'b', 'c'],
        aggregations: [{ column: 'value', function: 'sum' }],
      },
      ctx
    )
    // No row columns = uses dummy column for grouping, then excludes it
    expect(sql).toContain('SELECT * EXCLUDE (_dummy)')
    expect(sql).toContain("IN ('a', 'b', 'c')")
    expect(sql).toContain('GROUP BY "_dummy"')
  })

  it('builds pivot with row dimensions (GROUP BY)', () => {
    const sql = buildOperationSql(
      {
        type: 'pivot',
        rowColumns: ['category', 'region'],
        pivotColumn: 'quarter',
        pivotValues: ['Q1', 'Q2', 'Q3', 'Q4'],
        aggregations: [{ column: 'sales', function: 'sum', alias: 'total' }],
      },
      ctx
    )
    expect(sql).toContain('PIVOT "test_table" ON "quarter"')
    expect(sql).toContain("IN ('Q1', 'Q2', 'Q3', 'Q4')")
    expect(sql).toContain('USING SUM("sales") AS "total"')
    expect(sql).toContain('GROUP BY "category", "region"')
  })

  it('builds pivot with multiple aggregations', () => {
    const sql = buildOperationSql(
      {
        type: 'pivot',
        rowColumns: ['region'],
        pivotColumn: 'product',
        pivotValues: ['A', 'B'],
        aggregations: [
          { column: 'sales', function: 'sum', alias: 'total' },
          { column: 'sales', function: 'avg', alias: 'average' },
        ],
      },
      ctx
    )
    expect(sql).toContain('SUM("sales") AS "total"')
    expect(sql).toContain('AVG("sales") AS "average"')
  })

  it('sorts pivot values alphabetically', () => {
    const sql = buildOperationSql(
      {
        type: 'pivot',
        rowColumns: [],
        pivotColumn: 'name',
        pivotValues: ['zebra', 'apple', 'mango'],
        aggregations: [{ column: 'value', function: 'count' }],
      },
      ctx
    )
    // Values should be sorted: apple, mango, zebra
    expect(sql).toContain("IN ('apple', 'mango', 'zebra')")
  })

  it('builds pivot with subtotals and grand total', () => {
    const sql = buildOperationSql(
      {
        type: 'pivot',
        rowColumns: ['region', 'category'],
        pivotColumn: 'quarter',
        pivotValues: ['Q1', 'Q2'],
        aggregations: [{ column: 'sales', function: 'sum', alias: 'total' }],
        showSubtotals: true,
        showGrandTotal: true,
      },
      ctx
    )
    // Should be a CTE with UNION for subtotals
    expect(sql).toContain('WITH')
    expect(sql).toContain('pivoted AS')
    expect(sql).toContain('subtotal_level_0 AS')
    expect(sql).toContain('grand_total AS')
    expect(sql).toContain('UNION ALL')
    expect(sql).toContain('_row_type')
    expect(sql).toContain('_sort_group')
    expect(sql).toContain('ORDER BY')
  })

  it('builds pivot with only grand total (no subtotals)', () => {
    const sql = buildOperationSql(
      {
        type: 'pivot',
        rowColumns: ['region'],
        pivotColumn: 'quarter',
        pivotValues: ['Q1', 'Q2'],
        aggregations: [{ column: 'sales', function: 'sum', alias: 'total' }],
        showSubtotals: false,
        showGrandTotal: true,
      },
      ctx
    )
    expect(sql).toContain('grand_total AS')
    expect(sql).not.toContain('subtotal_level')
  })

  it('escapes single quotes in pivot values', () => {
    const sql = buildOperationSql(
      {
        type: 'pivot',
        rowColumns: [],
        pivotColumn: 'name',
        pivotValues: ["it's", "test's"],
        aggregations: [{ column: 'value', function: 'sum' }],
      },
      ctx
    )
    expect(sql).toContain("'it''s'")
    expect(sql).toContain("'test''s'")
  })
})

describe('buildOperationSql - unpivot operations', () => {
  const ctx = createContext()

  it('builds unpivot', () => {
    const sql = buildOperationSql(
      { type: 'unpivot', valueColumns: ['name', 'value'], nameColumn: 'attribute', valueColumn: 'val' },
      ctx
    )
    expect(sql).toBe('UNPIVOT "test_table" ON "name", "value" INTO NAME "attribute" VALUE "val"')
  })
})

describe('buildOperationSql - distinct operations', () => {
  const ctx = createContext()

  it('builds distinct all columns', () => {
    const sql = buildOperationSql({ type: 'distinct' }, ctx)
    expect(sql).toBe('SELECT DISTINCT * FROM "test_table"')
  })

  it('builds distinct on specific columns', () => {
    const sql = buildOperationSql({ type: 'distinct', columns: ['name'] }, ctx)
    expect(sql).toBe('SELECT DISTINCT ON ("name") * FROM "test_table"')
  })

  it('builds distinct on multiple columns', () => {
    const sql = buildOperationSql({ type: 'distinct', columns: ['name', 'value'] }, ctx)
    expect(sql).toBe('SELECT DISTINCT ON ("name", "value") * FROM "test_table"')
  })
})

describe('buildOperationSql - join operations', () => {
  const ctx: OperationContext = {
    sourceTableName: 'left_table',
    sourceColumns: [
      { name: 'id', type: 'INTEGER' },
      { name: 'name', type: 'VARCHAR' },
    ],
    additionalSources: {
      right1: {
        tableName: 'right_table',
        columns: [
          { name: 'id', type: 'INTEGER' },
          { name: 'amount', type: 'DOUBLE' },
        ],
      },
    },
  }

  it('builds inner join', () => {
    const sql = buildOperationSql(
      {
        type: 'join',
        rightSourceId: 'right1',
        joinType: 'inner',
        conditions: [{ leftColumn: 'id', operator: '=', rightColumn: 'id' }],
      },
      ctx
    )
    expect(sql).toContain('INNER JOIN "right_table" r')
    expect(sql).toContain('l."id" = r."id"')
    expect(sql).toContain('l."id" AS "id"')
    expect(sql).toContain('r."id" AS "right_table_id"') // aliased to avoid conflict
    expect(sql).toContain('r."amount" AS "amount"')
  })

  it('builds left join', () => {
    const sql = buildOperationSql(
      {
        type: 'join',
        rightSourceId: 'right1',
        joinType: 'left',
        conditions: [{ leftColumn: 'id', operator: '=', rightColumn: 'id' }],
      },
      ctx
    )
    expect(sql).toContain('LEFT JOIN "right_table"')
  })

  it('builds right join', () => {
    const sql = buildOperationSql(
      {
        type: 'join',
        rightSourceId: 'right1',
        joinType: 'right',
        conditions: [{ leftColumn: 'id', operator: '=', rightColumn: 'id' }],
      },
      ctx
    )
    expect(sql).toContain('RIGHT JOIN "right_table"')
  })

  it('builds full join', () => {
    const sql = buildOperationSql(
      {
        type: 'join',
        rightSourceId: 'right1',
        joinType: 'full',
        conditions: [{ leftColumn: 'id', operator: '=', rightColumn: 'id' }],
      },
      ctx
    )
    expect(sql).toContain('FULL JOIN "right_table"')
  })

  it('throws error when additionalSources is missing', () => {
    expect(() =>
      buildOperationSql(
        {
          type: 'join',
          rightSourceId: 'right1',
          joinType: 'inner',
          conditions: [{ leftColumn: 'id', operator: '=', rightColumn: 'id' }],
        },
        createContext()
      )
    ).toThrow('Join requires additionalSources with rightSourceId')
  })
})

describe('buildOperationSql - union operations', () => {
  const ctx: OperationContext = {
    sourceTableName: 'table1',
    sourceColumns: [{ name: 'id', type: 'INTEGER' }],
    additionalSources: {
      source2: { tableName: 'table2', columns: [{ name: 'id', type: 'INTEGER' }] },
      source3: { tableName: 'table3', columns: [{ name: 'id', type: 'INTEGER' }] },
    },
  }

  it('builds union (distinct)', () => {
    const sql = buildOperationSql({ type: 'union', sourceIds: ['source2'], mode: 'distinct' }, ctx)
    expect(sql).toBe('SELECT * FROM "table1" UNION SELECT * FROM "table2"')
  })

  it('builds union all', () => {
    const sql = buildOperationSql({ type: 'union', sourceIds: ['source2'], mode: 'all' }, ctx)
    expect(sql).toBe('SELECT * FROM "table1" UNION ALL SELECT * FROM "table2"')
  })

  it('builds union with multiple sources', () => {
    const sql = buildOperationSql({ type: 'union', sourceIds: ['source2', 'source3'], mode: 'all' }, ctx)
    expect(sql).toBe('SELECT * FROM "table1" UNION ALL SELECT * FROM "table2" UNION ALL SELECT * FROM "table3"')
  })
})

describe('buildCreateViewSql', () => {
  const ctx = createContext()

  it('creates view with proper escaping', () => {
    const sql = buildCreateViewSql('my_view', { type: 'distinct' }, ctx)
    expect(sql).toBe('CREATE VIEW "my_view" AS SELECT DISTINCT * FROM "test_table"')
  })

  it('escapes view name with special characters', () => {
    const sql = buildCreateViewSql('view"with"quotes', { type: 'distinct' }, ctx)
    expect(sql).toBe('CREATE VIEW "view""with""quotes" AS SELECT DISTINCT * FROM "test_table"')
  })
})

describe('buildDropViewSql', () => {
  it('drops view with proper escaping', () => {
    expect(buildDropViewSql('my_view')).toBe('DROP VIEW IF EXISTS "my_view"')
  })

  it('escapes view name with special characters', () => {
    expect(buildDropViewSql('view"name')).toBe('DROP VIEW IF EXISTS "view""name"')
  })
})

describe('generateViewName', () => {
  it('generates unique view name with operation abbreviation', () => {
    const name1 = generateViewName('filter')
    const name2 = generateViewName('filter')
    // Without parent name: view_flt_xxxx
    expect(name1).toMatch(/^view_flt_[a-z0-9]{4}$/)
    expect(name1).not.toBe(name2) // Should be unique
  })

  it('includes operation abbreviation in name', () => {
    expect(generateViewName('sort')).toContain('_srt_')
    expect(generateViewName('pivot')).toContain('_pvt_')
  })

  it('uses parent base name when provided', () => {
    const name = generateViewName('filter', 'products')
    expect(name).toMatch(/^products_flt_[a-z0-9]{4}$/)
  })

  it('sanitizes parent name', () => {
    const name = generateViewName('filter', 'My-Data.csv')
    expect(name).toMatch(/^my_data_flt_[a-z0-9]{4}$/)
  })
})

describe('getOperationDisplayName', () => {
  it('returns correct display names', () => {
    expect(getOperationDisplayName('filter')).toBe('Filtered')
    expect(getOperationDisplayName('sort')).toBe('Sorted')
    expect(getOperationDisplayName('pivot')).toBe('Pivoted')
    expect(getOperationDisplayName('join')).toBe('Joined')
  })

  it('returns Transformed for unknown types', () => {
    expect(getOperationDisplayName('unknown')).toBe('Transformed')
  })
})

describe('SQL injection edge cases', () => {
  const ctx = createContext()

  it('handles table name with injection attempt', () => {
    const maliciousCtx = createContext('users"; DROP TABLE users;--')
    const sql = buildOperationSql({ type: 'distinct' }, maliciousCtx)
    expect(sql).toBe('SELECT DISTINCT * FROM "users""; DROP TABLE users;--"')
    // The double quotes make it a literal identifier
  })

  it('handles column name with injection attempt in filter', () => {
    const sql = buildOperationSql(
      {
        type: 'filter',
        expression: {
          type: 'condition',
          filter: { column: 'col"; DROP TABLE users;--', operator: 'eq', value: 1 },
        },
      },
      ctx
    )
    expect(sql).toContain('"col""; DROP TABLE users;--"')
  })

  it('handles value with complex injection attempt', () => {
    const sql = buildOperationSql(
      {
        type: 'filter',
        expression: {
          type: 'condition',
          filter: { column: 'name', operator: 'eq', value: "'; DROP TABLE users; SELECT '" },
        },
      },
      ctx
    )
    expect(sql).toContain("'''; DROP TABLE users; SELECT '''")
  })

  it('handles contains filter with SQL wildcards', () => {
    const sql = buildOperationSql(
      {
        type: 'filter',
        expression: {
          type: 'condition',
          filter: { column: 'name', operator: 'contains', value: '%_[]' },
        },
      },
      ctx
    )
    // Wildcards should be escaped as literal characters (DuckDB handles this with || concatenation)
    expect(sql).toContain("'%_[]'")
  })
})
