import type { Column } from '@/types'

/**
 * Convert a DuckDB date value to ISO string (YYYY-MM-DD).
 *
 * DuckDB-WASM uses Apache Arrow for data transfer. Arrow's Date type uses
 * milliseconds since epoch (Date64/DateMillisecond format), which is what
 * toJSON() returns for date columns.
 *
 * @see https://github.com/duckdb/duckdb-wasm/issues/393
 * @see https://arrow.apache.org/docs/js/
 */
export function formatDuckDBDate(value: unknown): string | null {
  if (value === null || value === undefined) return null

  if (value instanceof Date) {
    return value.toISOString().split('T')[0]
  }

  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      return value.split('T')[0]
    }
    return value
  }

  // Arrow returns dates as milliseconds since epoch (Date64/DateMillisecond)
  if (typeof value === 'number' || typeof value === 'bigint') {
    const ms = Number(value)
    try {
      return new Date(ms).toISOString().split('T')[0]
    } catch {
      return String(value)
    }
  }

  return String(value)
}

/**
 * Convert a DuckDB timestamp value to ISO string (YYYY-MM-DD HH:MM:SS).
 *
 * DuckDB internally stores timestamps as microseconds since epoch, but
 * Arrow JS / DuckDB-WASM may return them as milliseconds depending on
 * configuration and Arrow version.
 *
 * We detect the unit by checking the magnitude:
 * - Microseconds for year 2020: ~1.6e15
 * - Milliseconds for year 2020: ~1.6e12
 *
 * @see https://github.com/duckdb/duckdb-wasm/issues/393
 */
export function formatDuckDBTimestamp(value: unknown): string | null {
  if (value === null || value === undefined) return null

  if (value instanceof Date) {
    return value.toISOString().replace('T', ' ').split('.')[0]
  }

  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      return value.replace('T', ' ').split('.')[0]
    }
    return value
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    const num = Number(value)
    // Detect if microseconds (very large) or milliseconds
    // Year 2000 in ms: ~9.5e11, in μs: ~9.5e14
    // Year 2100 in ms: ~4.1e12, in μs: ~4.1e15
    const isMicroseconds = Math.abs(num) > 1e13
    const ms = isMicroseconds ? num / 1000 : num
    try {
      return new Date(ms).toISOString().replace('T', ' ').split('.')[0]
    } catch {
      return String(value)
    }
  }

  return String(value)
}

/**
 * Format a DuckDB timestamp for use in datetime-local inputs.
 * Returns format: YYYY-MM-DDTHH:mm (required by datetime-local)
 */
export function formatDuckDBTimestampForInput(value: unknown): string | null {
  const formatted = formatDuckDBTimestamp(value)
  if (!formatted) return null
  // Convert "YYYY-MM-DD HH:MM:SS" to "YYYY-MM-DDTHH:mm"
  return formatted.replace(' ', 'T').slice(0, 16)
}

/**
 * Normalize date and timestamp values in a row from DuckDB.
 *
 * DuckDB-WASM returns dates/timestamps as epoch milliseconds via Arrow.
 * This function converts them to ISO strings at the data fetch boundary,
 * ensuring consistent format throughout the application (display, filters, exports).
 */
export function normalizeRowDates(
  row: Record<string, unknown>,
  columns: Array<{ name: string; type: string }>
): Record<string, unknown> {
  const result = { ...row }
  for (const col of columns) {
    const val = result[col.name]
    if (val == null) continue
    if (col.type === 'date') {
      result[col.name] = formatDuckDBDate(val)
    } else if (col.type === 'timestamp') {
      result[col.name] = formatDuckDBTimestamp(val)
    }
  }
  return result
}

export interface NumberFormatOptions {
  decimals: number
  thousandsSeparator: boolean
}

export function formatCell(value: unknown, type: Column['type'], numberFormat?: NumberFormatOptions): string {
  if (value === null || value === undefined) return '∅'

  switch (type) {
    case 'number': {
      if (typeof value === 'number') {
        const fmt = numberFormat ?? { decimals: 2, thousandsSeparator: true }
        if (Number.isInteger(value)) {
          return fmt.thousandsSeparator
            ? value.toLocaleString(undefined, { maximumFractionDigits: 0 })
            : value.toString()
        }
        return fmt.thousandsSeparator
          ? value.toLocaleString(undefined, {
              minimumFractionDigits: fmt.decimals,
              maximumFractionDigits: fmt.decimals,
            })
          : value.toFixed(fmt.decimals)
      }
      if (typeof value === 'bigint') {
        const fmt = numberFormat ?? { decimals: 2, thousandsSeparator: true }
        return fmt.thousandsSeparator
          ? Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })
          : value.toString()
      }
      return String(value)
    }
    case 'boolean':
      return value ? 'true' : 'false'
    case 'date':
      return formatDuckDBDate(value) ?? String(value)
    case 'time':
      if (value instanceof Date) return value.toISOString().split('T')[1].split('.')[0]
      return String(value)
    case 'timestamp':
      return formatDuckDBTimestamp(value) ?? String(value)
    case 'interval':
      return String(value)
    case 'uuid':
      return String(value)
    case 'json':
      if (typeof value === 'object') return JSON.stringify(value)
      return String(value)
    case 'blob': {
      // Arrow's toJSON() converts Uint8Array to number array
      const blobData = value instanceof Uint8Array ? value : Array.isArray(value) ? new Uint8Array(value) : null
      if (blobData) {
        const hex = Array.from(blobData.slice(0, 16))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
        return blobData.length > 16 ? `0x${hex}...` : `0x${hex}`
      }
      return '[BLOB]'
    }
    case 'array':
      if (Array.isArray(value)) {
        const preview = value
          .slice(0, 3)
          .map((v) => String(v))
          .join(', ')
        return value.length > 3 ? `[${preview}, ...]` : `[${preview}]`
      }
      return String(value)
    default:
      return String(value)
  }
}

/**
 * Detect image type from magic bytes in a Uint8Array.
 * Returns the image type or null if not a recognized image format.
 */
export function detectImageType(data: Uint8Array): 'png' | 'jpeg' | 'gif' | 'webp' | null {
  if (data.length < 4) return null
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return 'png'
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'jpeg'
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x38) return 'gif'
  if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 && data.length >= 12) {
    if (data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50) return 'webp'
  }
  return null
}

/**
 * Convert a Uint8Array to a data URL for display in an <img> tag.
 */
function blobToDataUrl(data: Uint8Array, mimeType: string): string {
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return `data:${mimeType};base64,${btoa(binary)}`
}

// Cache for data URLs to avoid expensive base64 encoding on every render
const dataUrlCache = new Map<string, string>()
const DATA_URL_CACHE_MAX_SIZE = 100

/**
 * Get a cached data URL for blob data. Uses a simple LRU eviction.
 * Cache key is based on data length + first 32 bytes (fast, collision-resistant).
 */
export function getCachedDataUrl(data: Uint8Array, mimeType: string): string {
  // Create cache key from first 32 bytes + length
  const keyPrefix = Array.from(data.subarray(0, 32)).join(',')
  const key = `${keyPrefix}:${data.length}:${mimeType}`

  let url = dataUrlCache.get(key)
  if (!url) {
    url = blobToDataUrl(data, mimeType)
    // Simple LRU: delete oldest entry if cache is full
    if (dataUrlCache.size >= DATA_URL_CACHE_MAX_SIZE) {
      const firstKey = dataUrlCache.keys().next().value
      if (firstKey) dataUrlCache.delete(firstKey)
    }
    dataUrlCache.set(key, url)
  }
  return url
}
