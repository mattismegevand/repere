#!/usr/bin/env bun

import { writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import type { Backend, ComparisonResult, DataSize, ScenarioName } from './config'
import { DATA_SIZES, DEFAULT_CONFIG, SCENARIOS } from './config'
import { formatConsoleReport, printProgress } from './reporters/console'
import { formatJsonReport } from './reporters/json'
import { formatMarkdownReport } from './reporters/markdown'
import { BenchmarkRunner } from './runner'
import { calculateRatio } from './utils/stats'

const HELP = `
Repere Benchmark CLI
====================

Usage: bun run benchmarks/cli.ts [options]

Options:
  --backend <value>     Backend to benchmark: wasm, native, all (default: all)
  --size <value>        Dataset size: small, medium, large, xlarge, all (default: all)
  --scenario <value>    Run specific scenario (can be repeated)
  --iterations <n>      Number of timed iterations (default: ${DEFAULT_CONFIG.iterations})
  --warmup <n>          Warmup iterations (default: ${DEFAULT_CONFIG.warmup})
  --output <format>     Output format: console, json, markdown (default: console)
  --outfile <path>      Write results to file
  --data-dir <path>     Directory for benchmark data (default: benchmarks/.data)
  --verbose             Show detailed progress
  --help                Show this help

Examples:
  bun run benchmarks/cli.ts --backend wasm --size small
  bun run benchmarks/cli.ts --scenario query-filter --scenario query-sort
  bun run benchmarks/cli.ts --output markdown --outfile results.md
`

async function main() {
  const { values } = parseArgs({
    options: {
      backend: { type: 'string', default: 'all' },
      size: { type: 'string', default: 'all' },
      scenario: { type: 'string', multiple: true },
      iterations: { type: 'string', default: String(DEFAULT_CONFIG.iterations) },
      warmup: { type: 'string', default: String(DEFAULT_CONFIG.warmup) },
      output: { type: 'string', default: 'console' },
      outfile: { type: 'string' },
      'data-dir': { type: 'string', default: DEFAULT_CONFIG.dataDir },
      verbose: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
    allowPositionals: true,
  })

  if (values.help) {
    console.log(HELP)
    process.exit(0)
  }

  // Parse backends
  let backends: Backend[]
  if (values.backend === 'all') {
    backends = ['wasm', 'native']
  } else if (values.backend === 'wasm' || values.backend === 'native') {
    backends = [values.backend]
  } else {
    console.error(`Invalid backend: ${values.backend}. Use: wasm, native, or all`)
    process.exit(1)
  }

  // Parse sizes
  let sizes: DataSize[]
  if (values.size === 'all') {
    sizes = ['small', 'medium', 'large']
  } else if (values.size in DATA_SIZES) {
    sizes = [values.size as DataSize]
  } else {
    console.error(`Invalid size: ${values.size}. Use: small, medium, large, xlarge, or all`)
    process.exit(1)
  }

  // Parse scenarios
  let scenarios: ScenarioName[]
  if (values.scenario && values.scenario.length > 0) {
    scenarios = values.scenario as ScenarioName[]
    // Validate scenarios
    for (const s of scenarios) {
      if (!SCENARIOS.includes(s as ScenarioName)) {
        console.error(`Invalid scenario: ${s}`)
        console.error(`Available scenarios: ${SCENARIOS.join(', ')}`)
        process.exit(1)
      }
    }
  } else {
    // Default to all scenarios except file-load-parquet (needs parquet files)
    scenarios = SCENARIOS.filter((s) => s !== 'file-load-parquet') as ScenarioName[]
  }

  const iterations = parseInt(values.iterations, 10)
  const warmup = parseInt(values.warmup, 10)
  const dataDir = values['data-dir']
  const verbose = values.verbose

  console.log('Repere Benchmark')
  console.log('================')
  console.log(`Backends: ${backends.join(', ')}`)
  console.log(`Sizes: ${sizes.join(', ')}`)
  console.log(`Scenarios: ${scenarios.length}`)
  console.log(`Iterations: ${iterations} (warmup: ${warmup})`)
  console.log(`Data directory: ${dataDir}`)
  console.log('')

  // Create runner
  const runner = new BenchmarkRunner({
    backends,
    sizes,
    scenarios,
    iterations,
    warmup,
    dataDir,
    verbose,
  })

  // Initialize
  console.log('Initializing...')
  await runner.initialize()
  console.log('')

  // Run benchmarks
  console.log('Running benchmarks...')
  const results = await runner.runAll((progress) => {
    if (!verbose) {
      printProgress(progress.current, progress.total, progress.scenario, progress.backend, progress.size)
    }
  })

  if (!verbose) {
    console.log('') // New line after progress bar
  }

  // Close runner
  await runner.close()

  // Generate comparisons
  const comparisons = generateComparisons(results)

  // Format output
  let output: string
  switch (values.output) {
    case 'json':
      output = formatJsonReport(results, comparisons)
      break
    case 'markdown':
      output = formatMarkdownReport(results, comparisons)
      break
    default:
      output = formatConsoleReport(results, comparisons)
  }

  // Write or print output
  if (values.outfile) {
    await writeFile(values.outfile, output, 'utf-8')
    console.log(`Results written to: ${values.outfile}`)
  } else {
    console.log('')
    console.log(output)
  }
}

function generateComparisons(results: import('./config').BenchmarkResult[]): ComparisonResult[] {
  const comparisons: ComparisonResult[] = []

  // Group by scenario and size
  const groups = new Map<string, import('./config').BenchmarkResult[]>()

  for (const result of results) {
    const key = `${result.scenario}-${result.size}`
    const group = groups.get(key) || []
    group.push(result)
    groups.set(key, group)
  }

  for (const [_key, group] of groups) {
    const wasmResult = group.find((r) => r.backend === 'wasm')
    const nativeResult = group.find((r) => r.backend === 'native')

    if (wasmResult && nativeResult && wasmResult.mean > 0 && nativeResult.mean > 0) {
      const ratio = calculateRatio(wasmResult.mean, nativeResult.mean)
      comparisons.push({
        scenario: wasmResult.scenario,
        size: wasmResult.size,
        wasmMean: wasmResult.mean,
        nativeMean: nativeResult.mean,
        ratio,
        winner: ratio > 1 ? 'native' : 'wasm',
      })
    }
  }

  return comparisons
}

main().catch((err) => {
  console.error('Benchmark failed:', err)
  process.exit(1)
})
