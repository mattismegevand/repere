import type { QueryCategory } from '@/lib/cache/types'

interface QueryMetric {
  category: QueryCategory | 'other'
  duration: number
  rowCount: number
  timestamp: number
  sql: string
}

interface CategoryStats {
  count: number
  totalDuration: number
  avgDuration: number
  maxDuration: number
  minDuration: number
  totalRows: number
}

class QueryMetricsCollector {
  private metrics: QueryMetric[] = []
  private maxEntries = 1000

  record(category: QueryCategory | 'other', duration: number, rowCount: number, sql: string): void {
    if (!import.meta.env.DEV) return

    this.metrics.push({
      category,
      duration,
      rowCount,
      timestamp: Date.now(),
      sql,
    })

    // Keep bounded
    if (this.metrics.length > this.maxEntries) {
      this.metrics = this.metrics.slice(-this.maxEntries)
    }
  }

  getStats(): Record<string, CategoryStats> {
    const byCategory = new Map<string, QueryMetric[]>()

    for (const m of this.metrics) {
      const existing = byCategory.get(m.category) ?? []
      existing.push(m)
      byCategory.set(m.category, existing)
    }

    const result: Record<string, CategoryStats> = {}
    for (const [category, items] of byCategory) {
      const durations = items.map((i) => i.duration)
      result[category] = {
        count: items.length,
        totalDuration: durations.reduce((a, b) => a + b, 0),
        avgDuration: durations.reduce((a, b) => a + b, 0) / items.length,
        maxDuration: Math.max(...durations),
        minDuration: Math.min(...durations),
        totalRows: items.reduce((a, b) => a + b.rowCount, 0),
      }
    }
    return result
  }

  getRecentMetrics(limit = 50): QueryMetric[] {
    return this.metrics.slice(-limit)
  }

  reset(): void {
    this.metrics = []
  }
}

export const queryMetrics = new QueryMetricsCollector()
