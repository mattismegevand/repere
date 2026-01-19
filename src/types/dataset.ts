export type ColumnType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date' // DATE only (YYYY-MM-DD)
  | 'time' // TIME only (HH:MM:SS)
  | 'timestamp' // TIMESTAMP (date + time)
  | 'interval' // Duration/interval
  | 'uuid'
  | 'json'
  | 'blob'
  | 'array'
  | 'unknown'

export interface Column {
  name: string
  type: ColumnType
  nullable: boolean
  duckdbType?: string // Original DuckDB type for exact recreation (e.g., "BIGINT", "VARCHAR")
}

export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'isNull'
  | 'isNotNull'
  | 'in'
  | 'notIn'
  | 'between'

export interface Filter {
  column: string
  operator: FilterOperator
  value: unknown
}

/**
 * A filter condition - single comparison
 */
export interface FilterCondition {
  type: 'condition'
  filter: Filter
}

/**
 * A filter group - combines children with AND/OR
 */
export interface FilterGroup {
  type: 'group'
  combineMode: 'and' | 'or'
  children: FilterExpression[]
}

/**
 * Recursive filter expression - either a condition or a group
 */
export type FilterExpression = FilterCondition | FilterGroup

export interface Sort {
  column: string
  direction: 'asc' | 'desc'
}
