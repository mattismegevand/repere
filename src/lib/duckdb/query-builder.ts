import type { Filter, Sort } from '@/types'
import { escapeIdentifier, escapeValue } from './sql-builder'

function buildCondition(filter: Filter): string {
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
    case 'contains': {
      const escaped = String(filter.value).replace(/'/g, "''")
      return `${col} ILIKE '%${escaped}%'`
    }
    case 'isNull':
      return `${col} IS NULL`
    case 'isNotNull':
      return `${col} IS NOT NULL`
    default:
      return '1=1'
  }
}

interface QueryOptions {
  tableName: string
  filters?: Filter[]
  sort?: Sort | null
  search?: string
  searchColumns?: string[]
  searchCaseSensitive?: boolean
  limit?: number
  offset?: number
}

export function buildSelectQuery(options: QueryOptions): string {
  const {
    tableName,
    filters = [],
    sort,
    search,
    searchColumns = [],
    searchCaseSensitive = false,
    limit = 100,
    offset = 0,
  } = options

  let sql = `SELECT * FROM ${escapeIdentifier(tableName)}`
  const conditions: string[] = []

  for (const filter of filters) {
    conditions.push(buildCondition(filter))
  }

  if (search && searchColumns.length > 0) {
    const likeOp = searchCaseSensitive ? 'LIKE' : 'ILIKE'
    const escaped = search.replace(/'/g, "''")
    const searchConditions = searchColumns
      .map((col) => `${escapeIdentifier(col)} ${likeOp} '%${escaped}%'`)
      .join(' OR ')
    conditions.push(`(${searchConditions})`)
  }

  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`
  }

  if (sort) {
    sql += ` ORDER BY ${escapeIdentifier(sort.column)} ${sort.direction.toUpperCase()}`
  }

  sql += ` LIMIT ${limit} OFFSET ${offset}`

  return sql
}

export function buildCountQuery(options: Omit<QueryOptions, 'limit' | 'offset' | 'sort'>): string {
  const { tableName, filters = [], search, searchColumns = [], searchCaseSensitive = false } = options

  let sql = `SELECT COUNT(*) as count FROM ${escapeIdentifier(tableName)}`
  const conditions: string[] = []

  for (const filter of filters) {
    conditions.push(buildCondition(filter))
  }

  if (search && searchColumns.length > 0) {
    const likeOp = searchCaseSensitive ? 'LIKE' : 'ILIKE'
    const escaped = search.replace(/'/g, "''")
    const searchConditions = searchColumns
      .map((col) => `${escapeIdentifier(col)} ${likeOp} '%${escaped}%'`)
      .join(' OR ')
    conditions.push(`(${searchConditions})`)
  }

  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`
  }

  return sql
}
