export const DATA_SIZES = {
  small: { rows: 1_000, label: '1K' },
  medium: { rows: 100_000, label: '100K' },
  large: { rows: 1_000_000, label: '1M' },
  xlarge: { rows: 10_000_000, label: '10M' },
} as const

export type DataSize = keyof typeof DATA_SIZES

export type Backend = 'wasm' | 'native'

export const SCENARIOS = [
  // File loading
  'file-load-csv',
  'file-load-parquet',
  // Query execution
  'query-select-all',
  'query-filter',
  'query-sort',
  'query-aggregate',
  // Pipeline operations
  'op-filter',
  'op-sort',
  'op-join',
  'op-pivot',
  'op-window',
  // View operations
  'view-create',
  'view-chain-5',
] as const

export type ScenarioName = (typeof SCENARIOS)[number]

export interface BenchmarkResult {
  scenario: ScenarioName
  backend: Backend
  size: DataSize
  iterations: number
  timings: number[] // milliseconds
  mean: number
  median: number
  p95: number
  min: number
  max: number
  stddev: number
  memoryBefore?: number
  memoryAfter?: number
  memoryDelta?: number
}

export interface ComparisonResult {
  scenario: ScenarioName
  size: DataSize
  wasmMean: number
  nativeMean: number
  ratio: number
  winner: Backend
}

interface BenchmarkConfig {
  backend: Backend
  size: DataSize
  iterations: number
  warmup: number
  dataDir: string
}

interface BenchmarkContext {
  tableName: string
  dataPath: string
  secondaryDataPath?: string
  config: BenchmarkConfig
}

interface BenchmarkScenario {
  name: ScenarioName
  description: string
  category: 'file-loading' | 'query' | 'operation' | 'view'
  setup: (context: BenchmarkContext) => Promise<void>
  run: (context: BenchmarkContext) => Promise<void>
  teardown?: (context: BenchmarkContext) => Promise<void>
}

export interface BenchmarkMetadata {
  date: string
  platform: string
  arch: string
  bunVersion: string
}

export interface BenchmarkReport {
  metadata: BenchmarkMetadata
  results: BenchmarkResult[]
  comparisons: ComparisonResult[]
}

export const DEFAULT_CONFIG: Omit<BenchmarkConfig, 'backend' | 'size'> = {
  iterations: 5,
  warmup: 2,
  dataDir: 'benchmarks/.data',
}
