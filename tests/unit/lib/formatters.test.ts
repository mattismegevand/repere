import { describe, expect, it } from 'vitest'
import {
  detectImageType,
  formatCell,
  formatDuckDBDate,
  formatDuckDBTimestamp,
  formatDuckDBTimestampForInput,
  getCachedDataUrl,
  normalizeRowDates,
} from '@/lib/formatters'

describe('formatDuckDBDate', () => {
  it('returns null for null', () => {
    expect(formatDuckDBDate(null)).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(formatDuckDBDate(undefined)).toBeNull()
  })

  it('formats Date object to YYYY-MM-DD', () => {
    const date = new Date('2024-03-15T10:30:00Z')
    const result = formatDuckDBDate(date)
    expect(result).toBe('2024-03-15')
  })

  it('extracts date part from ISO string', () => {
    const result = formatDuckDBDate('2024-03-15T10:30:00.000Z')
    expect(result).toBe('2024-03-15')
  })

  it('returns date string as-is if already date format', () => {
    const result = formatDuckDBDate('2024-03-15')
    expect(result).toBe('2024-03-15')
  })

  it('returns non-ISO string as-is', () => {
    const result = formatDuckDBDate('March 15, 2024')
    expect(result).toBe('March 15, 2024')
  })

  it('converts milliseconds to date string', () => {
    // 2024-03-15 in milliseconds
    const ms = new Date('2024-03-15').getTime()
    const result = formatDuckDBDate(ms)
    expect(result).toBe('2024-03-15')
  })

  it('converts bigint epoch to date string', () => {
    const ms = BigInt(new Date('2024-03-15').getTime())
    const result = formatDuckDBDate(ms)
    expect(result).toBe('2024-03-15')
  })

  it('returns string representation for other types', () => {
    expect(formatDuckDBDate({ foo: 'bar' })).toBe('[object Object]')
    expect(formatDuckDBDate(['array'])).toBe('array')
  })
})

describe('formatDuckDBTimestamp', () => {
  it('returns null for null', () => {
    expect(formatDuckDBTimestamp(null)).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(formatDuckDBTimestamp(undefined)).toBeNull()
  })

  it('formats Date object to YYYY-MM-DD HH:MM:SS', () => {
    const date = new Date('2024-03-15T10:30:45Z')
    const result = formatDuckDBTimestamp(date)
    expect(result).toBe('2024-03-15 10:30:45')
  })

  it('formats ISO string timestamp', () => {
    const result = formatDuckDBTimestamp('2024-03-15T10:30:45.123Z')
    expect(result).toBe('2024-03-15 10:30:45')
  })

  it('returns non-ISO string as-is', () => {
    const result = formatDuckDBTimestamp('March 15, 2024 10:30')
    expect(result).toBe('March 15, 2024 10:30')
  })

  it('detects milliseconds and converts correctly', () => {
    // 2024-03-15 10:30:45 UTC in milliseconds
    const ms = new Date('2024-03-15T10:30:45Z').getTime()
    const result = formatDuckDBTimestamp(ms)
    expect(result).toBe('2024-03-15 10:30:45')
  })

  it('detects microseconds and converts correctly', () => {
    // Microseconds are 1000x larger than milliseconds
    const ms = new Date('2024-03-15T10:30:45Z').getTime()
    const microseconds = ms * 1000
    const result = formatDuckDBTimestamp(microseconds)
    expect(result).toBe('2024-03-15 10:30:45')
  })

  it('handles bigint values', () => {
    const ms = BigInt(new Date('2024-03-15T10:30:45Z').getTime())
    const result = formatDuckDBTimestamp(ms)
    expect(result).toBe('2024-03-15 10:30:45')
  })

  it('handles negative timestamps (dates before 1970)', () => {
    // 1960-01-01 in milliseconds
    const ms = new Date('1960-01-01T00:00:00Z').getTime()
    const result = formatDuckDBTimestamp(ms)
    expect(result).toBe('1960-01-01 00:00:00')
  })
})

describe('formatDuckDBTimestampForInput', () => {
  it('returns null for null', () => {
    expect(formatDuckDBTimestampForInput(null)).toBeNull()
  })

  it('converts to datetime-local format', () => {
    const date = new Date('2024-03-15T10:30:45Z')
    const result = formatDuckDBTimestampForInput(date)
    expect(result).toBe('2024-03-15T10:30')
  })

  it('handles ISO string', () => {
    const result = formatDuckDBTimestampForInput('2024-03-15T10:30:45.123Z')
    expect(result).toBe('2024-03-15T10:30')
  })
})

describe('normalizeRowDates', () => {
  it('converts date columns to ISO string', () => {
    const row = { id: 1, created: new Date('2024-03-15').getTime() }
    const columns = [
      { name: 'id', type: 'number' },
      { name: 'created', type: 'date' },
    ]
    const result = normalizeRowDates(row, columns)

    expect(result.id).toBe(1)
    expect(result.created).toBe('2024-03-15')
  })

  it('converts timestamp columns to ISO string', () => {
    const row = { id: 1, created: new Date('2024-03-15T10:30:45Z').getTime() }
    const columns = [
      { name: 'id', type: 'number' },
      { name: 'created', type: 'timestamp' },
    ]
    const result = normalizeRowDates(row, columns)

    expect(result.created).toBe('2024-03-15 10:30:45')
  })

  it('leaves other column types unchanged', () => {
    const row = { name: 'test', count: 42, active: true }
    const columns = [
      { name: 'name', type: 'string' },
      { name: 'count', type: 'number' },
      { name: 'active', type: 'boolean' },
    ]
    const result = normalizeRowDates(row, columns)

    expect(result).toEqual(row)
  })

  it('handles null values', () => {
    const row = { id: 1, created: null }
    const columns = [
      { name: 'id', type: 'number' },
      { name: 'created', type: 'date' },
    ]
    const result = normalizeRowDates(row, columns)

    expect(result.created).toBeNull()
  })

  it('does not mutate original row', () => {
    const row = { id: 1, created: new Date('2024-03-15').getTime() }
    const columns = [{ name: 'created', type: 'date' }]
    normalizeRowDates(row, columns)

    expect(typeof row.created).toBe('number')
  })
})

describe('formatCell', () => {
  it('returns empty symbol for null', () => {
    expect(formatCell(null, 'string')).toBe('∅')
  })

  it('returns empty symbol for undefined', () => {
    expect(formatCell(undefined, 'string')).toBe('∅')
  })

  describe('number type', () => {
    it('formats integer with thousands separator', () => {
      const result = formatCell(1234567, 'number')
      expect(result).toMatch(/1.?234.?567/)
    })

    it('formats integer without thousands separator when disabled', () => {
      const result = formatCell(1234567, 'number', { decimals: 2, thousandsSeparator: false })
      expect(result).toBe('1234567')
    })

    it('formats decimal with default precision', () => {
      const result = formatCell(123.456789, 'number')
      expect(result).toMatch(/123[.,]46/)
    })

    it('formats decimal with custom precision', () => {
      const result = formatCell(123.456789, 'number', { decimals: 4, thousandsSeparator: false })
      expect(result).toBe('123.4568')
    })

    it('formats bigint', () => {
      const result = formatCell(BigInt(1234567), 'number')
      expect(result).toMatch(/1.?234.?567/)
    })

    it('returns string for non-number value', () => {
      expect(formatCell('not a number', 'number')).toBe('not a number')
    })
  })

  describe('boolean type', () => {
    it('formats true', () => {
      expect(formatCell(true, 'boolean')).toBe('true')
    })

    it('formats false', () => {
      expect(formatCell(false, 'boolean')).toBe('false')
    })

    it('formats truthy value as true', () => {
      expect(formatCell(1, 'boolean')).toBe('true')
    })

    it('formats falsy value as false', () => {
      expect(formatCell(0, 'boolean')).toBe('false')
    })
  })

  describe('date type', () => {
    it('formats Date object', () => {
      const date = new Date('2024-03-15T10:30:00Z')
      expect(formatCell(date, 'date')).toBe('2024-03-15')
    })

    it('formats epoch milliseconds', () => {
      const ms = new Date('2024-03-15').getTime()
      expect(formatCell(ms, 'date')).toBe('2024-03-15')
    })
  })

  describe('time type', () => {
    it('formats Date object to time string', () => {
      const date = new Date('2024-03-15T10:30:45Z')
      expect(formatCell(date, 'time')).toBe('10:30:45')
    })

    it('returns string value as-is', () => {
      expect(formatCell('10:30:45', 'time')).toBe('10:30:45')
    })
  })

  describe('timestamp type', () => {
    it('formats Date object', () => {
      const date = new Date('2024-03-15T10:30:45Z')
      expect(formatCell(date, 'timestamp')).toBe('2024-03-15 10:30:45')
    })
  })

  describe('json type', () => {
    it('stringifies object', () => {
      expect(formatCell({ foo: 'bar' }, 'json')).toBe('{"foo":"bar"}')
    })

    it('stringifies array', () => {
      expect(formatCell([1, 2, 3], 'json')).toBe('[1,2,3]')
    })

    it('returns string value as-is', () => {
      expect(formatCell('already string', 'json')).toBe('already string')
    })
  })

  describe('blob type', () => {
    it('formats Uint8Array as hex', () => {
      const data = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f])
      const result = formatCell(data, 'blob')
      expect(result).toBe('0x48656c6c6f')
    })

    it('truncates long blob with ellipsis', () => {
      const data = new Uint8Array(32).fill(0xab)
      const result = formatCell(data, 'blob')
      expect(result).toMatch(/^0x[a-f0-9]{32}\.\.\.$/i)
    })

    it('formats array as blob', () => {
      const data = [0x48, 0x65, 0x6c, 0x6c, 0x6f]
      const result = formatCell(data, 'blob')
      expect(result).toBe('0x48656c6c6f')
    })

    it('returns [BLOB] for unrecognized format', () => {
      expect(formatCell('not a blob', 'blob')).toBe('[BLOB]')
    })
  })

  describe('array type', () => {
    it('formats short array', () => {
      expect(formatCell([1, 2, 3], 'array')).toBe('[1, 2, 3]')
    })

    it('truncates long array with ellipsis', () => {
      expect(formatCell([1, 2, 3, 4, 5], 'array')).toBe('[1, 2, 3, ...]')
    })

    it('returns string for non-array', () => {
      expect(formatCell('not an array', 'array')).toBe('not an array')
    })
  })

  describe('other types', () => {
    it('formats uuid as string', () => {
      expect(formatCell('550e8400-e29b-41d4-a716-446655440000', 'uuid')).toBe('550e8400-e29b-41d4-a716-446655440000')
    })

    it('formats interval as string', () => {
      expect(formatCell('1 day 2 hours', 'interval')).toBe('1 day 2 hours')
    })

    it('formats unknown type as string', () => {
      // @ts-expect-error testing unknown type
      expect(formatCell({ x: 1 }, 'unknown')).toBe('[object Object]')
    })
  })
})

describe('detectImageType', () => {
  it('detects PNG magic bytes', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(detectImageType(png)).toBe('png')
  })

  it('detects JPEG magic bytes', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])
    expect(detectImageType(jpeg)).toBe('jpeg')
  })

  it('detects GIF magic bytes', () => {
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
    expect(detectImageType(gif)).toBe('gif')
  })

  it('detects WebP magic bytes', () => {
    // RIFF....WEBP
    const webp = new Uint8Array([
      0x52,
      0x49,
      0x46,
      0x46, // RIFF
      0x00,
      0x00,
      0x00,
      0x00, // file size (placeholder)
      0x57,
      0x45,
      0x42,
      0x50, // WEBP
    ])
    expect(detectImageType(webp)).toBe('webp')
  })

  it('returns null for unrecognized format', () => {
    const unknown = new Uint8Array([0x00, 0x00, 0x00, 0x00])
    expect(detectImageType(unknown)).toBeNull()
  })

  it('returns null for data too short', () => {
    const short = new Uint8Array([0x89, 0x50, 0x4e])
    expect(detectImageType(short)).toBeNull()
  })

  it('returns null for empty array', () => {
    expect(detectImageType(new Uint8Array([]))).toBeNull()
  })

  it('returns null for WebP-like but too short', () => {
    const shortWebp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00])
    expect(detectImageType(shortWebp)).toBeNull()
  })
})

describe('getCachedDataUrl', () => {
  it('returns data URL with correct mime type', () => {
    const data = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]) // "Hello"
    const result = getCachedDataUrl(data, 'image/png')

    expect(result).toMatch(/^data:image\/png;base64,/)
  })

  it('returns same URL for same data (cache hit)', () => {
    const data = new Uint8Array([0x01, 0x02, 0x03, 0x04])
    const result1 = getCachedDataUrl(data, 'image/jpeg')
    const result2 = getCachedDataUrl(data, 'image/jpeg')

    expect(result1).toBe(result2)
  })

  it('returns different URL for different mime type', () => {
    const data = new Uint8Array([0x05, 0x06, 0x07, 0x08])
    const png = getCachedDataUrl(data, 'image/png')
    const jpeg = getCachedDataUrl(data, 'image/jpeg')

    expect(png).not.toBe(jpeg)
  })

  it('handles large data', () => {
    const largeData = new Uint8Array(10000).fill(0xab)
    const result = getCachedDataUrl(largeData, 'image/png')

    expect(result).toMatch(/^data:image\/png;base64,/)
    expect(result.length).toBeGreaterThan(10000) // Base64 is ~33% larger
  })
})
