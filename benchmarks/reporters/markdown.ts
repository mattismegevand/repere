import type { BenchmarkResult, ComparisonResult } from '../config'
import { DATA_SIZES } from '../config'
import { formatMs } from '../utils/stats'

/**
 * Generate Markdown benchmark report
 */
export function formatMarkdownReport(results: BenchmarkResult[], comparisons: ComparisonResult[]): string {
  const lines: string[] = []

  lines.push('# Benchmark Results')
  lines.push('')
  lines.push(`**Date:** ${new Date().toISOString().split('T')[0]}`)
  lines.push(`**Platform:** ${process.platform} ${process.arch}`)
  lines.push('')

  // Summary table
  if (comparisons.length > 0) {
    lines.push('## Summary')
    lines.push('')
    lines.push('| Scenario | Size | WASM (ms) | Native (ms) | Winner | Speedup |')
    lines.push('|----------|------|-----------|-------------|--------|---------|')

    for (const comp of comparisons) {
      const wasmMs = comp.wasmMean > 0 ? formatMs(comp.wasmMean) : 'N/A'
      const nativeMs = comp.nativeMean > 0 ? formatMs(comp.nativeMean) : 'N/A'
      const speedup = comp.ratio > 0 ? `${comp.ratio.toFixed(1)}x` : 'N/A'

      lines.push(
        `| ${comp.scenario} | ${DATA_SIZES[comp.size].label} | ${wasmMs} | ${nativeMs} | ${comp.winner} | ${speedup} |`
      )
    }

    lines.push('')
  }

  // Detailed results by backend
  const backends = [...new Set(results.map((r) => r.backend))]

  for (const backend of backends) {
    const backendResults = results.filter((r) => r.backend === backend)
    if (backendResults.length === 0) continue

    lines.push(`## ${backend.toUpperCase()} Backend`)
    lines.push('')
    lines.push('| Scenario | Size | Mean | Median | P95 | Min | Max | StdDev |')
    lines.push('|----------|------|------|--------|-----|-----|-----|--------|')

    for (const result of backendResults) {
      if (result.iterations === 0) continue

      lines.push(
        `| ${result.scenario} | ${DATA_SIZES[result.size].label} | ${formatMs(result.mean)} | ${formatMs(result.median)} | ${formatMs(result.p95)} | ${formatMs(result.min)} | ${formatMs(result.max)} | ${formatMs(result.stddev)} |`
      )
    }

    lines.push('')
  }

  // Analysis
  if (comparisons.length > 0) {
    lines.push('## Analysis')
    lines.push('')

    const wasmWins = comparisons.filter((c) => c.winner === 'wasm').length
    const nativeWins = comparisons.filter((c) => c.winner === 'native').length
    const avgRatio =
      comparisons.filter((c) => c.ratio > 0).reduce((sum, c) => sum + c.ratio, 0) /
      comparisons.filter((c) => c.ratio > 0).length

    lines.push(`- **Native wins:** ${nativeWins} out of ${comparisons.length} scenarios`)
    lines.push(`- **WASM wins:** ${wasmWins} out of ${comparisons.length} scenarios`)
    lines.push(`- **Average Native speedup:** ${avgRatio.toFixed(2)}x faster than WASM`)
    lines.push('')

    // Find biggest differences
    const sortedByRatio = [...comparisons].filter((c) => c.ratio > 0).sort((a, b) => b.ratio - a.ratio)

    if (sortedByRatio.length > 0) {
      lines.push('### Biggest Performance Differences')
      lines.push('')
      const top3 = sortedByRatio.slice(0, 3)
      for (const comp of top3) {
        lines.push(
          `- **${comp.scenario}** (${DATA_SIZES[comp.size].label}): Native is ${comp.ratio.toFixed(1)}x faster`
        )
      }
    }
  }

  return lines.join('\n')
}
