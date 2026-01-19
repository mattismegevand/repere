import type { ColumnType } from '@/types'

/**
 * Maps DuckDB type strings to our simplified ColumnType.
 * Single source of truth for type mapping across the codebase.
 */
export function mapDuckDBType(duckType: string): ColumnType {
  const t = duckType.toUpperCase()

  // Check for array types first (e.g., INTEGER[], VARCHAR[])
  if (t.endsWith('[]') || t.includes('LIST')) {
    return 'array'
  }

  // Check for specific types before broader patterns
  if (t === 'UUID') return 'uuid'
  if (t === 'JSON' || t === 'JSONB') return 'json'
  if (t === 'BLOB' || t === 'BYTEA') return 'blob'
  if (t === 'INTERVAL') return 'interval'

  // Timestamp types (must check before DATE/TIME)
  if (t.includes('TIMESTAMP')) return 'timestamp'

  // Date and time (check before numeric types - DATE doesn't contain INT)
  if (t.includes('DATE')) return 'date'
  if (t === 'TIME' || t.startsWith('TIME ') || t.includes('TIME WITH')) return 'time'

  // Numeric types
  if (
    t.includes('INT') ||
    t.includes('FLOAT') ||
    t.includes('DOUBLE') ||
    t.includes('DECIMAL') ||
    t.includes('NUMERIC') ||
    t === 'REAL' ||
    t === 'HUGEINT' ||
    t === 'UHUGEINT'
  ) {
    return 'number'
  }

  // Boolean
  if (t.includes('BOOL')) return 'boolean'

  // String types
  if (t.includes('VARCHAR') || t.includes('TEXT') || t.includes('CHAR') || t.includes('STRING')) {
    return 'string'
  }

  // Map types and structs to json for display purposes
  if (t.startsWith('MAP') || t.startsWith('STRUCT')) return 'json'

  return 'unknown'
}

/**
 * Maps our ColumnType back to a DuckDB type for table creation.
 */
export function mapColumnTypeToDuckDB(colType: ColumnType): string {
  switch (colType) {
    case 'number':
      return 'DOUBLE'
    case 'string':
      return 'VARCHAR'
    case 'boolean':
      return 'BOOLEAN'
    case 'date':
      return 'DATE'
    case 'time':
      return 'TIME'
    case 'timestamp':
      return 'TIMESTAMP'
    case 'uuid':
      return 'UUID'
    case 'json':
      return 'JSON'
    case 'blob':
      return 'BLOB'
    case 'interval':
      return 'INTERVAL'
    case 'array':
      return 'VARCHAR[]' // Default array to string array
    default:
      return 'VARCHAR' // Safe fallback
  }
}
