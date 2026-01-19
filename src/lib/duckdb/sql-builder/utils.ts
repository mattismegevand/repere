import type { Filter, FilterExpression } from '@/types'

export function escapeIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

export function escapeValue(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number') return value.toString()
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (value instanceof Date) return `'${value.toISOString()}'`
  if (value instanceof Uint8Array) {
    const hex = Array.from(value)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    return `'\\x${hex}'::BLOB`
  }
  if (Array.isArray(value)) {
    return `(${value.map(escapeValue).join(', ')})`
  }
  if (typeof value === 'object') {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::JSON`
  }
  return `'${String(value).replace(/'/g, "''")}'`
}

function buildFilterCondition(filter: Filter): string {
  const col = escapeIdentifier(filter.column)
  const val = escapeValue(filter.value)

  switch (filter.operator) {
    case 'eq':
      return `${col} = ${val}`
    case 'neq':
      return `${col} != ${val}`
    case 'gt':
      return `${col} > ${val}`
    case 'lt':
      return `${col} < ${val}`
    case 'gte':
      return `${col} >= ${val}`
    case 'lte':
      return `${col} <= ${val}`
    case 'contains':
      return `${col} ILIKE '%' || ${val} || '%'`
    case 'notContains':
      return `${col} NOT ILIKE '%' || ${val} || '%'`
    case 'startsWith':
      return `${col} ILIKE ${val} || '%'`
    case 'endsWith':
      return `${col} ILIKE '%' || ${val}`
    case 'isNull':
      return `${col} IS NULL`
    case 'isNotNull':
      return `${col} IS NOT NULL`
    case 'in':
      return `${col} IN ${val}`
    case 'notIn':
      return `${col} NOT IN ${val}`
    case 'between': {
      const arr = filter.value as [unknown, unknown]
      return `${col} BETWEEN ${escapeValue(arr[0])} AND ${escapeValue(arr[1])}`
    }
    default:
      return '1=1'
  }
}

export function buildFilterExpression(expr: FilterExpression): string {
  if (expr.type === 'condition') {
    return buildFilterCondition(expr.filter)
  }

  if (expr.children.length === 0) {
    return '1=1'
  }

  if (expr.children.length === 1) {
    return buildFilterExpression(expr.children[0])
  }

  const connector = expr.combineMode === 'and' ? ' AND ' : ' OR '
  const conditions = expr.children.map(buildFilterExpression)
  return `(${conditions.join(connector)})`
}

export function buildWhereClause(filters: Filter[], combineMode: 'and' | 'or' = 'and'): string {
  if (filters.length === 0) return ''

  const conditions = filters.map(buildFilterCondition)
  const connector = combineMode === 'and' ? ' AND ' : ' OR '
  return `WHERE ${conditions.join(connector)}`
}

export function buildOrderByClause(
  sorts: Array<{ column: string; direction: 'asc' | 'desc'; nulls?: 'first' | 'last' }>
): string {
  if (sorts.length === 0) return ''

  const clauses = sorts.map((sort) => {
    const col = escapeIdentifier(sort.column)
    const dir = sort.direction.toUpperCase()
    const nulls = sort.nulls ? ` NULLS ${sort.nulls.toUpperCase()}` : ''
    return `${col} ${dir}${nulls}`
  })

  return `ORDER BY ${clauses.join(', ')}`
}

export function buildAggregate(agg: { column: string; function: string; alias?: string }): string {
  const col = escapeIdentifier(agg.column)
  const alias = escapeIdentifier(agg.alias ?? `${agg.function}_${agg.column}`)

  switch (agg.function) {
    case 'count':
      return `COUNT(${col}) AS ${alias}`
    case 'countDistinct':
      return `COUNT(DISTINCT ${col}) AS ${alias}`
    case 'sum':
      return `SUM(${col}) AS ${alias}`
    case 'avg':
      return `AVG(${col}) AS ${alias}`
    case 'min':
      return `MIN(${col}) AS ${alias}`
    case 'max':
      return `MAX(${col}) AS ${alias}`
    case 'first':
      return `FIRST(${col}) AS ${alias}`
    case 'last':
      return `LAST(${col}) AS ${alias}`
    case 'stddev':
      return `STDDEV(${col}) AS ${alias}`
    case 'variance':
      return `VARIANCE(${col}) AS ${alias}`
    case 'list':
      return `LIST(${col}) AS ${alias}`
    default:
      return `${col} AS ${alias}`
  }
}
