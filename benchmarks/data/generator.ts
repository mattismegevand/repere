import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { DATA_SIZES, type DataSize } from '../config'
import {
  CATEGORIES,
  type ColumnDefinition,
  type DataSchema,
  FIRST_NAMES,
  JOIN_SCHEMA,
  LAST_NAMES,
  REGIONS,
  STANDARD_SCHEMA,
} from './schemas'

/**
 * Simple seeded random number generator (mulberry32)
 */
function createRNG(seed: number) {
  let t = seed
  return () => {
    t = (t + 0x6d2b79f5) | 0
    let r = Math.imul(t ^ (t >>> 15), t | 1)
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Generate a name from the pool based on index
 */
function generateName(index: number): string {
  const firstIndex = index % FIRST_NAMES.length
  const lastIndex = Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length
  return `${FIRST_NAMES[firstIndex]} ${LAST_NAMES[lastIndex]}`
}

/**
 * Generate a date within the last 5 years
 */
function generateDate(random: () => number): string {
  const now = Date.now()
  const fiveYearsAgo = now - 5 * 365 * 24 * 60 * 60 * 1000
  const timestamp = fiveYearsAgo + random() * (now - fiveYearsAgo)
  const date = new Date(timestamp)
  return date.toISOString().split('T')[0]
}

/**
 * Generate a single row based on schema
 */
function generateRow(id: number, schema: DataSchema, random: () => number): Record<string, string | number | boolean> {
  const row: Record<string, string | number | boolean> = {}

  for (const col of schema.columns) {
    row[col.name] = generateColumnValue(col, id, random)
  }

  return row
}

function generateColumnValue(col: ColumnDefinition, id: number, random: () => number): string | number | boolean {
  switch (col.type) {
    case 'integer':
      if (col.name === 'id') return id
      return Math.floor(random() * ((col.max ?? 100) - (col.min ?? 0)) + (col.min ?? 0))
    case 'float':
      return random() * ((col.max ?? 100) - (col.min ?? 0)) + (col.min ?? 0)
    case 'boolean':
      return random() > 0.3
    case 'date':
      return generateDate(random)
    case 'string': {
      if (col.name === 'name' || col.name === 'description') {
        return generateName(id % 1000)
      }
      if (col.name === 'category') {
        return CATEGORIES[id % CATEGORIES.length]
      }
      if (col.name === 'region') {
        return REGIONS[id % REGIONS.length]
      }
      // Generic string with cardinality
      const card = col.cardinality ?? 100
      return `value_${id % card}`
    }
    default:
      return ''
  }
}

/**
 * Convert row to CSV line
 */
function rowToCSV(row: Record<string, string | number | boolean>, columns: ColumnDefinition[]): string {
  return columns
    .map((col) => {
      const val = row[col.name]
      if (typeof val === 'string') {
        // Escape quotes and wrap in quotes if contains comma
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          return `"${val.replace(/"/g, '""')}"`
        }
        return val
      }
      return String(val)
    })
    .join(',')
}

/**
 * Generate CSV data file
 */
export async function generateCSV(outputPath: string, rowCount: number, schema: DataSchema): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true })

  const random = createRNG(schema.seed)
  const header = schema.columns.map((c) => c.name).join(',')
  const lines: string[] = [header]

  // Generate in chunks to avoid memory issues
  const chunkSize = 10000
  for (let i = 0; i < rowCount; i += chunkSize) {
    const end = Math.min(i + chunkSize, rowCount)
    for (let j = i; j < end; j++) {
      const row = generateRow(j, schema, random)
      lines.push(rowToCSV(row, schema.columns))
    }

    // Write in chunks for large files
    if (lines.length > 50000) {
      await writeFile(outputPath, lines.join('\n') + '\n', { flag: i === 0 ? 'w' : 'a' })
      lines.length = 0
    }
  }

  // Write remaining lines
  if (lines.length > 0) {
    await writeFile(outputPath, lines.join('\n') + '\n', { flag: rowCount <= 50000 ? 'w' : 'a' })
  }
}

/**
 * Generate all benchmark data files for a given size
 */
export async function generateBenchmarkData(dataDir: string, size: DataSize): Promise<void> {
  const rowCount = DATA_SIZES[size].rows
  const sizeDir = join(dataDir, size)

  console.log(`Generating ${size} (${DATA_SIZES[size].label} rows) data...`)

  // Main benchmark data
  const mainPath = join(sizeDir, 'benchmark.csv')
  console.log(`  - ${mainPath}`)
  await generateCSV(mainPath, rowCount, STANDARD_SCHEMA)

  // Join table (smaller, for join benchmarks)
  const joinPath = join(sizeDir, 'join_table.csv')
  const joinRows = Math.min(rowCount, 100000) // Cap at 100K for join table
  console.log(`  - ${joinPath}`)
  await generateCSV(joinPath, joinRows, JOIN_SCHEMA)

  console.log(`  Done!`)
}

/**
 * Generate all benchmark data for all sizes
 */
export async function generateAllData(dataDir: string, sizes: DataSize[]): Promise<void> {
  for (const size of sizes) {
    await generateBenchmarkData(dataDir, size)
  }
}

// CLI entry point
if (import.meta.main) {
  const args = process.argv.slice(2)
  const dataDir = args[0] || 'benchmarks/.data'
  const sizes: DataSize[] = args[1] ? (args[1].split(',') as DataSize[]) : ['small', 'medium', 'large', 'xlarge']

  console.log('Benchmark Data Generator')
  console.log('========================')
  console.log(`Output directory: ${dataDir}`)
  console.log(`Sizes: ${sizes.join(', ')}`)
  console.log('')

  generateAllData(dataDir, sizes)
    .then(() => {
      console.log('\nAll data generated successfully!')
    })
    .catch((err) => {
      console.error('Error generating data:', err)
      process.exit(1)
    })
}
