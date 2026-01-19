import type { BenchmarkResult, ComparisonResult, DataSize, ScenarioName } from '../config'
import { DATA_SIZES } from '../config'
import { formatMs } from '../utils/stats'

interface ReportOptions {
  showTimings?: boolean
}

/**
 * Format results for console output with tables
 */
export function formatConsoleReport(
  results: BenchmarkResult[],
  comparisons: ComparisonResult[],
  _options: ReportOptions = {}
): string {
  const lines: string[] = []

  lines.push('Repere Benchmark Results')
  lines.push('========================')
  lines.push(`Date: ${new Date().toISOString()}`)
  lines.push(`Platform: ${process.platform} ${process.arch}`)
  lines.push('')

  // Group results by size
  const sizes = [...new Set(results.map((r) => r.size))] as DataSize[]

  for (const size of sizes) {
    lines.push(`Dataset: ${DATA_SIZES[size].label} rows`)
    lines.push('-'.repeat(40))
    lines.push('')

    const sizeResults = results.filter((r) => r.size === size)
    const sizeComparisons = comparisons.filter((c) => c.size === size)

    // Group by category
    const categories = [
      { name: 'File Loading', prefix: 'file-load' },
      { name: 'Query Execution', prefix: 'query' },
      { name: 'Pipeline Operations', prefix: 'op-' },
      { name: 'View Operations', prefix: 'view' },
    ]

    for (const category of categories) {
      const categoryResults = sizeResults.filter((r) => r.scenario.startsWith(category.prefix))
      if (categoryResults.length === 0) continue

      lines.push(category.name)

      // Build comparison table
      const hasWasm = categoryResults.some((r) => r.backend === 'wasm')
      const hasNative = categoryResults.some((r) => r.backend === 'native')

      if (hasWasm && hasNative) {
        // Comparison table
        lines.push(formatComparisonTable(categoryResults, sizeComparisons))
      } else {
        // Single backend table
        lines.push(formatSingleBackendTable(categoryResults))
      }

      lines.push('')
    }

    lines.push('')
  }

  // Summary
  if (comparisons.length > 0) {
    lines.push('Summary')
    lines.push('-'.repeat(40))

    const wasmWins = comparisons.filter((c) => c.winner === 'wasm').length
    const nativeWins = comparisons.filter((c) => c.winner === 'native').length
    const avgRatio = comparisons.reduce((sum, c) => sum + c.ratio, 0) / comparisons.length

    lines.push(`Native wins: ${nativeWins}/${comparisons.length}`)
    lines.push(`WASM wins: ${wasmWins}/${comparisons.length}`)
    lines.push(`Average speedup: ${avgRatio.toFixed(2)}x`)
  }

  return lines.join('\n')
}

function formatComparisonTable(results: BenchmarkResult[], comparisons: ComparisonResult[]): string {
  const lines: string[] = []
  const scenarios = [...new Set(results.map((r) => r.scenario))] as ScenarioName[]

  // Header
  lines.push('| Scenario          | WASM (ms)   | Native (ms) | Ratio  |')
  lines.push('|-------------------|-------------|-------------|--------|')

  for (const scenario of scenarios) {
    const wasmResult = results.find((r) => r.scenario === scenario && r.backend === 'wasm')
    const nativeResult = results.find((r) => r.scenario === scenario && r.backend === 'native')
    const comparison = comparisons.find((c) => c.scenario === scenario)

    const wasmMs = wasmResult?.mean ? formatMs(wasmResult.mean).padStart(9) : '      N/A'
    const nativeMs = nativeResult?.mean ? formatMs(nativeResult.mean).padStart(9) : '      N/A'
    const ratio = comparison?.ratio ? `${comparison.ratio.toFixed(2)}x`.padStart(6) : '   N/A'

    lines.push(`| ${scenario.padEnd(17)} | ${wasmMs} | ${nativeMs} | ${ratio} |`)
  }

  return lines.join('\n')
}

function formatSingleBackendTable(results: BenchmarkResult[]): string {
  const lines: string[] = []
  const backend = results[0]?.backend || 'unknown'

  // Header
  lines.push(`| Scenario          | ${backend.toUpperCase().padEnd(9)} | Median    | P95       |`)
  lines.push('|-------------------|-------------|-----------|-----------|')

  for (const result of results) {
    const mean = formatMs(result.mean).padStart(9)
    const median = formatMs(result.median).padStart(9)
    const p95 = formatMs(result.p95).padStart(9)

    lines.push(`| ${result.scenario.padEnd(17)} | ${mean} | ${median} | ${p95} |`)
  }

  return lines.join('\n')
}

/**
 * Print results to console with progress
 */
export function printProgress(current: number, total: number, scenario: string, backend: string, size: string): void {
  const percent = Math.round((current / total) * 100)
  const bar = '█'.repeat(Math.floor(percent / 5)) + '░'.repeat(20 - Math.floor(percent / 5))
  process.stdout.write(`\r[${bar}] ${percent}% - ${backend}/${size}/${scenario}`.padEnd(80))
}
