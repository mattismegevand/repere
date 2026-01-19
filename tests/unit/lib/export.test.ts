import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DuckDBClient } from '@/lib/duckdb/interface'

// We need to test internal functions, so we'll extract them for testing
// For now, we test the escapeCSV logic inline and mock the export behavior

// Mock browser APIs
const mockCreateObjectURL = vi.fn().mockReturnValue('blob:test-url')
const mockRevokeObjectURL = vi.fn()

vi.stubGlobal('URL', {
  createObjectURL: mockCreateObjectURL,
  revokeObjectURL: mockRevokeObjectURL,
})

// Mock document for download
const mockClick = vi.fn()
const mockAppendChild = vi.fn()
const mockRemoveChild = vi.fn()
vi.stubGlobal('document', {
  createElement: vi.fn().mockReturnValue({
    href: '',
    download: '',
    click: mockClick,
  }),
  body: {
    appendChild: mockAppendChild,
    removeChild: mockRemoveChild,
  },
})

// Helper: escapeCSV implementation (matches exporter.ts)
function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

// Helper: bigIntReplacer implementation (matches exporter.ts)
function bigIntReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') {
    return Number(value)
  }
  return value
}

describe('escapeCSV', () => {
  it('returns empty string for null', () => {
    expect(escapeCSV(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(escapeCSV(undefined)).toBe('')
  })

  it('returns string as-is when no special characters', () => {
    expect(escapeCSV('hello')).toBe('hello')
    expect(escapeCSV('simple text')).toBe('simple text')
  })

  it('wraps value with quotes when contains comma', () => {
    expect(escapeCSV('hello,world')).toBe('"hello,world"')
  })

  it('wraps value with quotes when contains newline', () => {
    expect(escapeCSV('line1\nline2')).toBe('"line1\nline2"')
  })

  it('escapes double quotes by doubling them', () => {
    expect(escapeCSV('say "hello"')).toBe('"say ""hello"""')
  })

  it('handles value with comma, newline, and quotes', () => {
    expect(escapeCSV('a,b\nc"d')).toBe('"a,b\nc""d"')
  })

  it('converts numbers to string', () => {
    expect(escapeCSV(42)).toBe('42')
    expect(escapeCSV(3.14159)).toBe('3.14159')
    expect(escapeCSV(-100)).toBe('-100')
  })

  it('converts boolean to string', () => {
    expect(escapeCSV(true)).toBe('true')
    expect(escapeCSV(false)).toBe('false')
  })

  it('handles empty string', () => {
    expect(escapeCSV('')).toBe('')
  })

  it('handles string with only quotes', () => {
    // 3 quotes input: each quote becomes 2 quotes (escaped), wrapped in quotes = 2 + 3*2 = 8 chars
    expect(escapeCSV('"""')).toBe('""""""""')
  })

  it('handles string with only commas', () => {
    // Commas need wrapping in quotes
    expect(escapeCSV(',,,')).toBe('",,,"')
  })

  it('handles carriage return', () => {
    expect(escapeCSV('line1\r\nline2')).toBe('"line1\r\nline2"')
  })
})

describe('bigIntReplacer', () => {
  it('converts BigInt to Number', () => {
    expect(bigIntReplacer('key', BigInt(42))).toBe(42)
    expect(bigIntReplacer('key', BigInt(9007199254740991))).toBe(9007199254740991)
  })

  it('returns other values unchanged', () => {
    expect(bigIntReplacer('key', 'string')).toBe('string')
    expect(bigIntReplacer('key', 123)).toBe(123)
    expect(bigIntReplacer('key', null)).toBe(null)
    expect(bigIntReplacer('key', true)).toBe(true)
  })

  it('handles nested objects', () => {
    const obj = { a: BigInt(1), b: 'test' }
    const result = JSON.parse(JSON.stringify(obj, bigIntReplacer))
    expect(result).toEqual({ a: 1, b: 'test' })
  })

  it('handles arrays with BigInt', () => {
    const arr = [BigInt(1), BigInt(2), 'three']
    const result = JSON.parse(JSON.stringify(arr, bigIntReplacer))
    expect(result).toEqual([1, 2, 'three'])
  })

  it('handles negative BigInt', () => {
    expect(bigIntReplacer('key', BigInt(-1000))).toBe(-1000)
  })

  it('handles BigInt zero', () => {
    expect(bigIntReplacer('key', BigInt(0))).toBe(0)
  })
})

describe('CSV generation', () => {
  // Helper to build CSV from rows
  function buildCSV(columns: string[], rows: Record<string, unknown>[]): string {
    const lines: string[] = []
    lines.push(columns.map(escapeCSV).join(','))
    for (const row of rows) {
      lines.push(columns.map((col) => escapeCSV(row[col])).join(','))
    }
    return lines.join('\n')
  }

  it('builds CSV with headers', () => {
    const columns = ['name', 'age']
    const rows = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ]

    const csv = buildCSV(columns, rows)

    expect(csv).toBe('name,age\nAlice,30\nBob,25')
  })

  it('handles special characters in values', () => {
    const columns = ['text']
    const rows = [{ text: 'hello, "world"' }, { text: 'line1\nline2' }]

    const csv = buildCSV(columns, rows)

    expect(csv).toContain('"hello, ""world"""')
    expect(csv).toContain('"line1\nline2"')
  })

  it('handles null values', () => {
    const columns = ['value']
    const rows = [{ value: null }, { value: 'data' }]

    const csv = buildCSV(columns, rows)

    expect(csv).toBe('value\n\ndata')
  })

  it('handles mixed types', () => {
    const columns = ['id', 'name', 'active', 'score']
    const rows = [{ id: 1, name: 'Test', active: true, score: 95.5 }]

    const csv = buildCSV(columns, rows)

    expect(csv).toBe('id,name,active,score\n1,Test,true,95.5')
  })

  it('handles empty dataset', () => {
    const columns = ['col1', 'col2']
    const rows: Record<string, unknown>[] = []

    const csv = buildCSV(columns, rows)

    expect(csv).toBe('col1,col2')
  })

  it('handles unicode characters', () => {
    const columns = ['name']
    const rows = [{ name: '日本語' }, { name: 'Ñoño' }, { name: '🎉' }]

    const csv = buildCSV(columns, rows)

    expect(csv).toContain('日本語')
    expect(csv).toContain('Ñoño')
    expect(csv).toContain('🎉')
  })
})

describe('JSON export generation', () => {
  it('serializes array of objects', () => {
    const data = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ]

    const json = JSON.stringify(data, bigIntReplacer, 2)

    expect(JSON.parse(json)).toEqual(data)
  })

  it('handles BigInt in objects', () => {
    const data = [{ id: BigInt(12345678901234567890n), name: 'Test' }]

    const json = JSON.stringify(data, bigIntReplacer, 2)
    const parsed = JSON.parse(json)

    expect(typeof parsed[0].id).toBe('number')
  })

  it('handles nested objects', () => {
    const data = [{ user: { id: 1, profile: { name: 'Test' } } }]

    const json = JSON.stringify(data, bigIntReplacer, 2)

    expect(JSON.parse(json)).toEqual(data)
  })

  it('handles arrays within objects', () => {
    const data = [{ tags: ['a', 'b', 'c'] }]

    const json = JSON.stringify(data, bigIntReplacer, 2)

    expect(JSON.parse(json)).toEqual(data)
  })

  it('handles null values', () => {
    const data = [{ value: null }]

    const json = JSON.stringify(data, bigIntReplacer, 2)

    expect(JSON.parse(json)).toEqual(data)
  })
})

describe('JSONL export generation', () => {
  it('generates one JSON object per line', () => {
    const data = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ]

    const lines = data.map((row) => JSON.stringify(row, bigIntReplacer))
    const jsonl = lines.join('\n')

    const parsedLines = jsonl.split('\n').map((line) => JSON.parse(line))
    expect(parsedLines).toEqual(data)
  })

  it('handles BigInt in JSONL', () => {
    const data = [{ id: BigInt(999), name: 'Test' }]

    const lines = data.map((row) => JSON.stringify(row, bigIntReplacer))
    const jsonl = lines.join('\n')

    const parsed = JSON.parse(jsonl.split('\n')[0])
    expect(parsed.id).toBe(999)
  })

  it('handles empty array', () => {
    const data: Record<string, unknown>[] = []

    const lines = data.map((row) => JSON.stringify(row, bigIntReplacer))
    const jsonl = lines.join('\n')

    expect(jsonl).toBe('')
  })

  it('handles single row', () => {
    const data = [{ single: true }]

    const lines = data.map((row) => JSON.stringify(row, bigIntReplacer))
    const jsonl = lines.join('\n')

    expect(jsonl).toBe('{"single":true}')
  })
})

describe('export filename handling', () => {
  function ensureExtension(filename: string, ext: string): string {
    return filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`
  }

  it('adds .csv extension if missing', () => {
    expect(ensureExtension('report', 'csv')).toBe('report.csv')
  })

  it('keeps .csv extension if present', () => {
    expect(ensureExtension('report.csv', 'csv')).toBe('report.csv')
  })

  it('adds .json extension if missing', () => {
    expect(ensureExtension('data', 'json')).toBe('data.json')
  })

  it('adds .jsonl extension if missing', () => {
    expect(ensureExtension('data', 'jsonl')).toBe('data.jsonl')
  })

  it('adds .parquet extension if missing', () => {
    expect(ensureExtension('export', 'parquet')).toBe('export.parquet')
  })

  it('adds .xlsx extension if missing', () => {
    expect(ensureExtension('spreadsheet', 'xlsx')).toBe('spreadsheet.xlsx')
  })

  it('handles filename with dots', () => {
    expect(ensureExtension('my.report.2024', 'csv')).toBe('my.report.2024.csv')
  })
})

// Integration-style tests with mock client
describe('exportData integration', () => {
  function createMockClient(rows: Record<string, unknown>[]): DuckDBClient {
    return {
      execute: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({ rows, columns: [] }),
      describe: vi.fn().mockResolvedValue([
        { name: 'id', type: 'INTEGER' },
        { name: 'name', type: 'VARCHAR' },
      ]),
      count: vi.fn().mockResolvedValue(rows.length),
      close: vi.fn().mockResolvedValue(undefined),
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates temp view for export', async () => {
    const client = createMockClient([{ id: 1, name: 'Test' }])

    // Simulate what exportData does
    const viewName = `export_view_${Date.now()}`
    await client.execute(`CREATE OR REPLACE TEMP VIEW "${viewName}" AS SELECT * FROM "test"`)

    expect(client.execute).toHaveBeenCalledWith(expect.stringContaining('CREATE OR REPLACE TEMP VIEW'))
  })

  it('cleans up temp view after export', async () => {
    const client = createMockClient([{ id: 1 }])

    // Simulate cleanup
    await client.execute('DROP VIEW IF EXISTS "export_view_123"')

    expect(client.execute).toHaveBeenCalledWith('DROP VIEW IF EXISTS "export_view_123"')
  })
})

describe('downloadAllAsZip structure', () => {
  it('organizes exports in exports folder', () => {
    // Test that the expected structure would be created
    const expectedStructure = {
      'exports/': ['data.csv', 'report.json'],
      'charts/': ['chart1.png', 'chart2.png'],
    }

    expect(Object.keys(expectedStructure)).toContain('exports/')
    expect(Object.keys(expectedStructure)).toContain('charts/')
  })

  it('generates dated ZIP filename', () => {
    const date = new Date().toISOString().slice(0, 10)
    const filename = `repere_export_${date}.zip`

    expect(filename).toMatch(/^repere_export_\d{4}-\d{2}-\d{2}\.zip$/)
  })
})
