import { useCallback, useEffect, useRef, useState } from 'react'
import type { DuckDBClient } from '@/lib/duckdb/interface'
import type { Column } from '@/types'
import { calculateUniqueRatio, determineChartType } from './chartHeuristics'
import type { ColumnStats, HistogramBin } from './types'

// Helper to convert BigInt or other numeric types to number
function toNumber(val: unknown): number | undefined {
  if (val === null || val === undefined) return undefined
  if (typeof val === 'bigint') return Number(val)
  if (typeof val === 'number') return val
  return undefined
}

interface ColumnStatsCache {
  [columnName: string]: {
    stats: ColumnStats
    fetchedAt: number
    histogramFetched: boolean
  }
}

interface UseColumnStatsResult {
  getStats: (columnName: string) => ColumnStats | null
  isLoading: (columnName: string) => boolean
  prefetchAll: () => void
  prefetchColumn: (column: Column) => Promise<ColumnStats | null>
  ensureHistogram: (column: Column) => Promise<ColumnStats | null>
}

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export function useColumnStats(
  client: DuckDBClient | null,
  tableName: string,
  columns: Column[]
): UseColumnStatsResult {
  const cacheRef = useRef<ColumnStatsCache>({})
  const loadingRef = useRef<Set<string>>(new Set())
  // Version counter to trigger re-renders when cache or loading state changes
  const [cacheVersion, setCacheVersion] = useState(0)

  // Clear cache when table changes
  useEffect(() => {
    cacheRef.current = {}
    loadingRef.current.clear()
  }, [tableName])

  // Fetch basic stats without histogram (fast)
  const fetchBasicStats = useCallback(
    async (column: Column): Promise<ColumnStats | null> => {
      if (!client) return null

      const col = `"${column.name}"`

      try {
        const result: ColumnStats = {
          count: 0,
          nullCount: 0,
          uniqueCount: 0,
          uniqueRatio: 0,
          chartType: 'none',
        }

        // Type-specific stats - combine base stats with type-specific in one query where possible
        if (column.type === 'number') {
          // Combined query: base stats + numeric stats in one
          const numResult = await client.query<Record<string, unknown>>(`
            SELECT
              COUNT(*) as cnt,
              COUNT(*) - COUNT(${col}) as null_cnt,
              COUNT(DISTINCT ${col}) as unique_cnt,
              MIN(${col}) as min_val,
              MAX(${col}) as max_val,
              AVG(${col}) as mean_val,
              STDDEV(${col}) as std_dev,
              MEDIAN(${col}) as median_val,
              PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ${col}) as p25,
              PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ${col}) as p75
            FROM "${tableName}"
          `)
          const num = numResult.rows[0] ?? {}
          result.count = Number(num.cnt)
          result.nullCount = Number(num.null_cnt)
          result.uniqueCount = Number(num.unique_cnt)
          result.uniqueRatio = calculateUniqueRatio(result.count, result.nullCount, result.uniqueCount)
          result.min = toNumber(num.min_val)
          result.max = toNumber(num.max_val)
          result.mean = toNumber(num.mean_val)
          result.stdDev = toNumber(num.std_dev)
          result.median = toNumber(num.median_val)
          result.p25 = toNumber(num.p25)
          result.p75 = toNumber(num.p75)
        } else if (column.type === 'date' || column.type === 'timestamp') {
          // Combined query: base stats + date range in one
          const dateResult = await client.query<Record<string, unknown>>(`
            SELECT
              COUNT(*) as cnt,
              COUNT(*) - COUNT(${col}) as null_cnt,
              COUNT(DISTINCT ${col}) as unique_cnt,
              CAST(MIN(${col}) AS VARCHAR) as min_val,
              CAST(MAX(${col}) AS VARCHAR) as max_val,
              DATEDIFF('day', MIN(${col}), MAX(${col})) as span_days
            FROM "${tableName}"
          `)
          const dateRow = dateResult.rows[0] ?? {}
          result.count = Number(dateRow.cnt)
          result.nullCount = Number(dateRow.null_cnt)
          result.uniqueCount = Number(dateRow.unique_cnt)
          result.uniqueRatio = calculateUniqueRatio(result.count, result.nullCount, result.uniqueCount)
          result.minDate = dateRow.min_val ? String(dateRow.min_val).split(' ')[0] : undefined
          result.maxDate = dateRow.max_val ? String(dateRow.max_val).split(' ')[0] : undefined
          result.dateSpanDays = dateRow.span_days as number
        } else if (column.type === 'string' || column.type === 'boolean') {
          // For strings: base stats + top values in one query (histogram comes from this too)
          const topResult = await client.query<Record<string, unknown>>(`
            WITH base AS (
              SELECT
                COUNT(*) as cnt,
                COUNT(*) - COUNT(${col}) as null_cnt,
                COUNT(DISTINCT ${col}) as unique_cnt
              FROM "${tableName}"
            ),
            top_vals AS (
              SELECT ${col} as val, COUNT(*) as cnt
              FROM "${tableName}"
              WHERE ${col} IS NOT NULL
              GROUP BY ${col}
              ORDER BY cnt DESC
              LIMIT 10
            )
            SELECT
              base.cnt, base.null_cnt, base.unique_cnt,
              top_vals.val, top_vals.cnt as val_cnt
            FROM base, top_vals
          `)
          const rows = topResult.rows
          if (rows.length > 0) {
            result.count = Number(rows[0].cnt)
            result.nullCount = Number(rows[0].null_cnt)
            result.uniqueCount = Number(rows[0].unique_cnt)
            result.uniqueRatio = calculateUniqueRatio(result.count, result.nullCount, result.uniqueCount)
            result.mode = String(rows[0].val)
            result.modeCount = Number(rows[0].val_cnt)
            result.sampleValues = rows.slice(0, 5).map((r) => {
              const val = String(r.val)
              return val.length > 25 ? val.slice(0, 22) + '...' : val
            })
            // Histogram comes from the same data
            result.histogram = rows.map((r) => {
              const label = String(r.val)
              return {
                value: label.length > 20 ? label.slice(0, 18) + '...' : label,
                count: Number(r.val_cnt),
              }
            })
          }
        } else {
          // Fallback: just base stats
          const baseResult = await client.query<Record<string, unknown>>(`
            SELECT
              COUNT(*) as cnt,
              COUNT(*) - COUNT(${col}) as null_cnt,
              COUNT(DISTINCT ${col}) as unique_cnt
            FROM "${tableName}"
          `)
          const base = baseResult.rows[0] ?? {}
          result.count = Number(base.cnt)
          result.nullCount = Number(base.null_cnt)
          result.uniqueCount = Number(base.unique_cnt)
          result.uniqueRatio = calculateUniqueRatio(result.count, result.nullCount, result.uniqueCount)
        }

        // Determine chart type based on stats so far
        result.chartType = determineChartType(column.type, result)

        return result
      } catch (err) {
        console.error(`Failed to fetch stats for ${column.name}:`, err)
        return null
      }
    },
    [client, tableName]
  )

  // Fetch histogram separately (for numeric/date columns, called lazily)
  const fetchHistogram = useCallback(
    async (column: Column, existingStats: ColumnStats): Promise<ColumnStats> => {
      if (!client) return existingStats

      const col = `"${column.name}"`
      const result = { ...existingStats }

      try {
        if (column.type === 'number' && result.min != null && result.max != null && result.min !== result.max) {
          const range = (result.max as number) - (result.min as number)
          const binCount = 15
          const binWidth = range / binCount

          const histResult = await client.query<Record<string, unknown>>(`
            SELECT
              FLOOR((${col} - ${result.min}) / (${range} / ${binCount})) as bin,
              COUNT(*) as cnt
            FROM "${tableName}"
            WHERE ${col} IS NOT NULL
            GROUP BY bin
            ORDER BY bin
          `)

          result.histogram = histResult.rows.map((r) => {
            const binIndex = Number(r.bin)
            const binMin = (result.min as number) + binIndex * binWidth
            const binMax = binMin + binWidth
            return {
              value: binMin + binWidth / 2,
              count: Number(r.cnt),
              min: binMin,
              max: binMax,
            } as HistogramBin
          })
        } else if (
          (column.type === 'date' || column.type === 'timestamp') &&
          result.minDate &&
          result.maxDate &&
          result.dateSpanDays &&
          result.dateSpanDays > 0
        ) {
          const histResult = await client.query<Record<string, unknown>>(`
            SELECT CAST(DATE_TRUNC('day', ${col}) AS VARCHAR) as day, COUNT(*) as cnt
            FROM "${tableName}"
            WHERE ${col} IS NOT NULL
            GROUP BY day
            ORDER BY day
            LIMIT 30
          `)
          result.histogram = histResult.rows.map((r) => ({
            value: String(r.day).split(' ')[0],
            count: Number(r.cnt),
          }))
        }
      } catch (err) {
        console.error(`Failed to fetch histogram for ${column.name}:`, err)
      }

      return result
    },
    [client, tableName]
  )

  // Prefetch basic stats (without histogram for numeric/date columns)
  const prefetchColumn = useCallback(
    async (column: Column): Promise<ColumnStats | null> => {
      const cached = cacheRef.current[column.name]
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
        return cached.stats
      }

      if (loadingRef.current.has(column.name)) {
        return null
      }

      loadingRef.current.add(column.name)
      setCacheVersion((v) => v + 1)

      const stats = await fetchBasicStats(column)

      loadingRef.current.delete(column.name)

      if (stats) {
        // String/boolean columns already have histogram from fetchBasicStats
        const histogramFetched = column.type === 'string' || column.type === 'boolean'
        cacheRef.current[column.name] = {
          stats,
          fetchedAt: Date.now(),
          histogramFetched,
        }
      }

      setCacheVersion((v) => v + 1)
      return stats
    },
    [fetchBasicStats]
  )

  // Lazily fetch histogram for a column (only for numeric/date that need it)
  const ensureHistogram = useCallback(
    async (column: Column): Promise<ColumnStats | null> => {
      const cached = cacheRef.current[column.name]
      if (!cached) return null

      // Already have histogram or not applicable
      if (
        cached.histogramFetched ||
        (column.type !== 'number' && column.type !== 'date' && column.type !== 'timestamp')
      ) {
        return cached.stats
      }

      // Fetch histogram
      const statsWithHistogram = await fetchHistogram(column, cached.stats)

      cacheRef.current[column.name] = {
        stats: statsWithHistogram,
        fetchedAt: cached.fetchedAt,
        histogramFetched: true,
      }

      setCacheVersion((v) => v + 1)
      return statsWithHistogram
    },
    [fetchHistogram]
  )

  // Prefetch all columns: first basic stats, then histograms in background
  const prefetchAll = useCallback(async () => {
    // First pass: fetch basic stats for all columns (fast, no histograms for numeric/date)
    await Promise.all(columns.map((col) => prefetchColumn(col)))

    // Second pass: lazily fetch histograms for numeric/date columns in background
    // Use requestIdleCallback or setTimeout to avoid blocking
    const needsHistogram = columns.filter(
      (col) => col.type === 'number' || col.type === 'date' || col.type === 'timestamp'
    )
    if (needsHistogram.length > 0) {
      setTimeout(async () => {
        for (const col of needsHistogram) {
          await ensureHistogram(col)
        }
      }, 100)
    }
  }, [columns, prefetchColumn, ensureHistogram])

  const getStats = useCallback(
    (columnName: string): ColumnStats | null => {
      const cached = cacheRef.current[columnName]
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
        return cached.stats
      }
      return null
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cacheVersion]
  )

  const isLoading = useCallback(
    (columnName: string): boolean => {
      return loadingRef.current.has(columnName)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cacheVersion]
  )

  return {
    getStats,
    isLoading,
    prefetchAll,
    prefetchColumn,
    ensureHistogram,
  }
}
