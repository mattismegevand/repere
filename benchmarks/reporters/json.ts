import type { BenchmarkMetadata, BenchmarkReport, BenchmarkResult, ComparisonResult } from '../config'

/**
 * Generate JSON benchmark report
 */
function generateJsonReport(results: BenchmarkResult[], comparisons: ComparisonResult[]): BenchmarkReport {
  const metadata: BenchmarkMetadata = {
    date: new Date().toISOString(),
    platform: process.platform,
    arch: process.arch,
    bunVersion: typeof Bun !== 'undefined' ? Bun.version : 'N/A',
  }

  return {
    metadata,
    results,
    comparisons,
  }
}

/**
 * Format report as JSON string
 */
export function formatJsonReport(results: BenchmarkResult[], comparisons: ComparisonResult[]): string {
  const report = generateJsonReport(results, comparisons)
  return JSON.stringify(report, null, 2)
}
