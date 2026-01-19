import { generateShortId } from '@/lib/id'
import type { ViewOperation } from '@/types'
import { buildOperationSql as _buildOperationSql } from './registry'
import type { OperationContext } from './types'
import { escapeIdentifier as _escapeIdentifier } from './utils'

export { buildOperationSql } from './registry'
export type { OperationContext } from './types'
export {
  buildFilterExpression,
  escapeIdentifier,
  escapeValue,
} from './utils'

/**
 * Generate CREATE VIEW statement
 */
export function buildCreateViewSql(viewName: string, operation: ViewOperation, context: OperationContext): string {
  const selectSql = _buildOperationSql(operation, context)
  return `CREATE VIEW ${_escapeIdentifier(viewName)} AS ${selectSql}`
}

/**
 * Generate DROP VIEW statement
 */
export function buildDropViewSql(viewName: string): string {
  return `DROP VIEW IF EXISTS ${_escapeIdentifier(viewName)}`
}

/**
 * Operation type abbreviations for shorter view names
 */
const opAbbreviations: Record<string, string> = {
  filter: 'flt',
  sort: 'srt',
  limit: 'lim',
  select: 'sel',
  addColumn: 'add',
  removeColumns: 'rm',
  renameColumns: 'ren',
  reorderColumns: 'ord',
  castColumn: 'cast',
  editCell: 'edit',
  editColumn: 'xfm',
  fillNull: 'fill',
  replaceValue: 'rpl',
  pivot: 'pvt',
  unpivot: 'upvt',
  window: 'win',
  join: 'jn',
  union: 'un',
  distinct: 'dist',
  sql: 'sql',
}

/**
 * Sanitize a string for use in SQL identifiers.
 * - Removes file extension
 * - Replaces special chars with underscore
 * - Lowercases
 * - Truncates to maxLength
 * - Collapses multiple underscores
 */
function sanitizeForSqlIdentifier(str: string, maxLength = 20): string {
  return str
    .replace(/\.[^.]+$/, '') // Remove extension
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_') // Replace special chars
    .replace(/_+/g, '_') // Collapse multiple underscores
    .replace(/^_|_$/g, '') // Trim leading/trailing underscores
    .slice(0, maxLength)
}

/**
 * Generate unique view name with optional parent context
 * Format: {parentBase}_{opAbbrev}_{random4} (e.g., products_flt_a3bc)
 */
export function generateViewName(operationType: string, parentBaseName?: string): string {
  const random = generateShortId()
  const opAbbr = opAbbreviations[operationType] || operationType.slice(0, 4)

  if (parentBaseName) {
    const sanitized = sanitizeForSqlIdentifier(parentBaseName, 15)
    return `${sanitized}_${opAbbr}_${random}`
  }

  // Fallback for cases without parent context
  return `view_${opAbbr}_${random}`
}

/**
 * Generate table name for a dataset from its filename
 * Format: {sanitizedFilename}_{random8} (e.g., products_abc12345)
 */
export function generateDatasetTableName(fileName: string): string {
  const sanitized = sanitizeForSqlIdentifier(fileName, 20)
  const random = generateShortId(8)
  return `${sanitized}_${random}`
}

/**
 * Get display name for an operation type
 */
export function getOperationDisplayName(operationType: string): string {
  const names: Record<string, string> = {
    filter: 'Filtered',
    sort: 'Sorted',
    limit: 'Limited',
    select: 'Selected',
    addColumn: 'Added Column',
    removeColumns: 'Removed Columns',
    renameColumns: 'Renamed',
    reorderColumns: 'Reordered',
    castColumn: 'Cast',
    editCell: 'Edited',
    editColumn: 'Transformed',
    fillNull: 'Filled Nulls',
    replaceValue: 'Replaced',
    pivot: 'Pivoted',
    unpivot: 'Unpivoted',
    join: 'Joined',
    union: 'Union',
    distinct: 'Distinct',
    sql: 'SQL Query',
    chart: 'Chart',
    export: 'Export',
  }
  return names[operationType] ?? 'Transformed'
}
