import type { Column } from '@/types'

/**
 * Convert DuckDB SQL errors to user-friendly messages
 */
export function formatSqlError(error: string, columns?: Column[]): string {
  // Strip SQL context (LINE 1: ... stuff) from any error first
  let cleaned = error.replace(/\s*LINE \d+:.*$/s, '').trim()

  // Column not found error
  const colNotFound = cleaned.match(/Referenced column "([^"]+)" not found/i)
  if (colNotFound) {
    const badCol = colNotFound[1]
    if (columns && columns.length > 0) {
      const similar = columns.filter((c) => c.name.toLowerCase().includes(badCol.toLowerCase().slice(0, 3))).slice(0, 3)
      if (similar.length > 0) {
        return `Column "${badCol}" not found. Did you mean: ${similar.map((c) => c.name).join(', ')}?`
      }
    }
    return `Column "${badCol}" not found`
  }

  // Type mismatch - Could not convert string 'x' to TYPE
  const typeMismatch = cleaned.match(/Could not convert string '([^']*)' to (\w+)/i)
  if (typeMismatch) {
    const val = typeMismatch[1]
    const type = formatTypeName(typeMismatch[2])
    return val === '' ? `Empty value not allowed for ${type} column` : `Invalid value "${val}" for ${type} column`
  }

  // Invalid date format - handles both empty and malformed dates
  const dateFormat = cleaned.match(/invalid date field format: "([^"]*)"(?:, expected format is \(([^)]+)\))?/i)
  if (dateFormat) {
    const val = dateFormat[1]
    const format = dateFormat[2] ?? 'YYYY-MM-DD'
    return val === '' ? `Empty value not allowed for date column` : `Invalid date "${val}", expected format: ${format}`
  }

  // Invalid time/timestamp format
  const timeFormat = cleaned.match(/invalid (time|timestamp) field format: "([^"]*)"/i)
  if (timeFormat) {
    const type = timeFormat[1]
    const val = timeFormat[2]
    return val === '' ? `Empty value not allowed for ${type} column` : `Invalid ${type} "${val}"`
  }

  // Syntax error
  if (cleaned.includes('syntax error') || cleaned.includes('Parser Error')) {
    return 'Invalid filter syntax'
  }

  // Conversion error - extract just the message
  const convError = cleaned.match(/Conversion Error:\s*(.+)/i)
  if (convError) {
    return cleanErrorMessage(convError[1])
  }

  // Binder error (general)
  const binderError = cleaned.match(/Binder Error:\s*(.+)/i)
  if (binderError) {
    return cleanErrorMessage(binderError[1])
  }

  // Catalog error (table/view not found)
  const catalogError = cleaned.match(/Catalog Error:\s*(.+)/i)
  if (catalogError) {
    return cleanErrorMessage(catalogError[1])
  }

  // Final cleanup - remove any remaining SQL noise
  cleaned = cleanErrorMessage(cleaned)

  // Truncate if still too long
  if (cleaned.length > 120) {
    return cleaned.slice(0, 120) + '...'
  }

  return cleaned
}

function formatTypeName(type: string): string {
  const typeMap: Record<string, string> = {
    INT64: 'integer',
    INT32: 'integer',
    INT16: 'integer',
    INT8: 'integer',
    BIGINT: 'integer',
    INTEGER: 'integer',
    SMALLINT: 'integer',
    TINYINT: 'integer',
    DOUBLE: 'decimal',
    FLOAT: 'decimal',
    REAL: 'decimal',
    BOOLEAN: 'boolean',
    BOOL: 'boolean',
  }
  return typeMap[type.toUpperCase()] ?? type.toLowerCase()
}

function cleanErrorMessage(msg: string): string {
  return msg
    .replace(/\s*LINE \d+:.*$/s, '') // Remove LINE X: context
    .replace(/\s*\^.*$/s, '') // Remove caret pointer
    .replace(/["'][\w_]+["']\s*(?:WHERE|FROM|SELECT|LIMIT).*$/i, '') // Remove SQL fragments
    .trim()
}
