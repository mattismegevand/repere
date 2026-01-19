import { formatDuckDBDate, formatDuckDBTimestamp } from '@/lib/formatters'

/**
 * Format a cell value for display in the edit input
 */
export function formatValueForEdit(value: unknown, type: string): string {
  if (value === null || value === undefined) return ''
  if (type === 'date') return formatDuckDBDate(value) ?? ''
  if (type === 'timestamp') return formatDuckDBTimestamp(value) ?? ''
  return String(value)
}

/**
 * Validate an edit value for a given column type
 */
export function validateEditValue(value: string, type: string): boolean {
  if (value === '' || value === '∅') return true
  if (type === 'number') return !Number.isNaN(Number.parseFloat(value))
  if (type === 'date' || type === 'timestamp') return !Number.isNaN(Date.parse(value))
  return true
}

/**
 * Parse an edit value for storage/SQL
 */
export function parseEditValue(value: string, type: string): unknown {
  if (value === '' || value === '∅') return null

  if (type === 'number') {
    const num = Number.parseFloat(value)
    return Number.isNaN(num) ? null : num
  }

  if (type === 'boolean') {
    return value.toLowerCase() === 'true'
  }

  if (type === 'date') {
    return formatDuckDBDate(value)
  }

  if (type === 'timestamp') {
    return formatDuckDBTimestamp(value)
  }

  return value
}
