export interface Stats {
  mean: number
  median: number
  p95: number
  min: number
  max: number
  stddev: number
}

/**
 * Calculate statistical measures from timing data
 */
export function calculateStats(timings: number[]): Stats {
  if (timings.length === 0) {
    return { mean: 0, median: 0, p95: 0, min: 0, max: 0, stddev: 0 }
  }

  const sorted = [...timings].sort((a, b) => a - b)
  const n = sorted.length

  const sum = sorted.reduce((acc, val) => acc + val, 0)
  const mean = sum / n

  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)]

  const p95Index = Math.ceil(n * 0.95) - 1
  const p95 = sorted[Math.min(p95Index, n - 1)]

  const min = sorted[0]
  const max = sorted[n - 1]

  const squaredDiffs = sorted.map((val) => (val - mean) ** 2)
  const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / n
  const stddev = Math.sqrt(variance)

  return { mean, median, p95, min, max, stddev }
}

/**
 * Format milliseconds for display
 */
export function formatMs(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`
  }
  return `${ms.toFixed(1)}ms`
}

/**
 * Calculate speedup ratio (how many times faster)
 */
export function calculateRatio(slower: number, faster: number): number {
  if (faster === 0) return 0
  return slower / faster
}
