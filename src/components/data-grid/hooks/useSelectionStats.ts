import { useEffect, useState } from 'react'
import type { DuckDBClient } from '@/lib/duckdb/interface'
import type { SelectionBounds } from '@/stores'
import type { Column } from '@/types'

export interface SelectionStats {
  count: number
  unique: number
  sum: number | null
  avg: number | null
  median: number | null
  stdDev: number | null
  min: string | number | null
  max: string | number | null
}

interface UseSelectionStatsOptions {
  client: DuckDBClient | null
  tableName: string | undefined
  visibleColumns: Column[]
  getSelectionBounds: () => SelectionBounds | null
}

export function useSelectionStats({
  client,
  tableName,
  visibleColumns,
  getSelectionBounds,
}: UseSelectionStatsOptions): SelectionStats | null {
  const [stats, setStats] = useState<SelectionStats | null>(null)

  useEffect(() => {
    const bounds = getSelectionBounds()
    if (!client || !tableName || !bounds) {
      setStats(null)
      return
    }

    const selectedCols = visibleColumns.slice(bounds.minCol, bounds.maxCol + 1)
    if (selectedCols.length === 0) {
      setStats(null)
      return
    }

    const numericCols = selectedCols.filter((c) => c.type === 'number')
    const dateCols = selectedCols.filter((c) => c.type === 'date' || c.type === 'timestamp')
    const primaryCol = selectedCols[0]
    const allSameType = selectedCols.every((c) => c.type === primaryCol.type)
    const isMixedTypes = selectedCols.length > 1 && !allSameType
    const isDateType = primaryCol.type === 'date' || primaryCol.type === 'timestamp'

    async function fetchStats() {
      try {
        // Use LIMIT/OFFSET instead of ROW_NUMBER() - much faster for large tables
        const rowCount = bounds!.maxRow - bounds!.minRow + 1
        const baseQuery = `SELECT * FROM "${tableName}" LIMIT ${rowCount} OFFSET ${bounds!.minRow}`

        if (isMixedTypes) {
          const unionParts = selectedCols
            .map((c) => `SELECT CAST("${c.name}" AS VARCHAR) as val FROM (${baseQuery})`)
            .join(' UNION ALL ')
          const result = await client!.query<Record<string, unknown>>(`
            SELECT COUNT(val) as cnt, COUNT(DISTINCT val) as uniq FROM (${unionParts})
          `)
          return { rows: result.rows, mode: 'mixed' as const }
        } else if (selectedCols.length === 1 && primaryCol.type === 'number') {
          const result = await client!.query<Record<string, unknown>>(`
            SELECT
              COUNT("${primaryCol.name}") as cnt,
              COUNT(DISTINCT "${primaryCol.name}") as uniq,
              SUM("${primaryCol.name}") as total,
              AVG("${primaryCol.name}") as average,
              MEDIAN("${primaryCol.name}") as med,
              STDDEV("${primaryCol.name}") as std_dev,
              MIN("${primaryCol.name}") as minimum,
              MAX("${primaryCol.name}") as maximum
            FROM (${baseQuery}) sub
          `)
          return { rows: result.rows, mode: 'numeric' as const }
        } else if (numericCols.length > 0 && allSameType) {
          const unionParts = numericCols.map((c) => `SELECT "${c.name}" as val FROM (${baseQuery})`).join(' UNION ALL ')
          const result = await client!.query<Record<string, unknown>>(`
            SELECT
              COUNT(val) as cnt, COUNT(DISTINCT val) as uniq,
              SUM(val) as total, AVG(val) as average,
              MEDIAN(val) as med, STDDEV(val) as std_dev,
              MIN(val) as minimum, MAX(val) as maximum
            FROM (${unionParts})
          `)
          return { rows: result.rows, mode: 'numeric' as const }
        } else if (isDateType && allSameType) {
          if (selectedCols.length === 1) {
            const result = await client!.query<Record<string, unknown>>(`
              SELECT
                COUNT("${primaryCol.name}") as cnt,
                COUNT(DISTINCT "${primaryCol.name}") as uniq,
                MIN("${primaryCol.name}") as minimum,
                MAX("${primaryCol.name}") as maximum
              FROM (${baseQuery}) sub
            `)
            return { rows: result.rows, mode: 'date' as const }
          } else {
            const unionParts = dateCols.map((c) => `SELECT "${c.name}" as val FROM (${baseQuery})`).join(' UNION ALL ')
            const result = await client!.query<Record<string, unknown>>(`
              SELECT COUNT(val) as cnt, COUNT(DISTINCT val) as uniq,
                MIN(val) as minimum, MAX(val) as maximum
              FROM (${unionParts})
            `)
            return { rows: result.rows, mode: 'date' as const }
          }
        } else {
          if (selectedCols.length === 1) {
            const result = await client!.query<Record<string, unknown>>(`
              SELECT
                COUNT("${primaryCol.name}") as cnt,
                COUNT(DISTINCT "${primaryCol.name}") as uniq,
                MIN("${primaryCol.name}") as minimum,
                MAX("${primaryCol.name}") as maximum
              FROM (${baseQuery}) sub
            `)
            return { rows: result.rows, mode: 'text' as const }
          } else {
            const unionParts = selectedCols
              .map((c) => `SELECT "${c.name}" as val FROM (${baseQuery})`)
              .join(' UNION ALL ')
            const result = await client!.query<Record<string, unknown>>(`
              SELECT COUNT(val) as cnt, COUNT(DISTINCT val) as uniq,
                MIN(val) as minimum, MAX(val) as maximum
              FROM (${unionParts})
            `)
            return { rows: result.rows, mode: 'text' as const }
          }
        }
      } catch (e) {
        console.error('Stats query error:', e)
        return null
      }
    }

    fetchStats().then((data) => {
      if (!data) {
        setStats(null)
        return
      }
      const { rows, mode } = data
      const row = rows[0]
      if (!row) {
        setStats(null)
        return
      }

      const toNum = (v: unknown): number | null => {
        if (v === null || v === undefined) return null
        if (typeof v === 'bigint') return Number(v)
        if (typeof v === 'number') return v
        if (typeof v === 'object' && v !== null && 'valueOf' in v) return Number(v.valueOf())
        const parsed = Number.parseFloat(String(v))
        return Number.isNaN(parsed) ? null : parsed
      }
      const toVal = (v: unknown) =>
        v !== null && v !== undefined ? (typeof v === 'bigint' ? Number(v) : (v as string | number)) : null
      const toDate = (v: unknown) => {
        if (v === null || v === undefined) return null
        const ms = typeof v === 'bigint' ? Number(v) : typeof v === 'number' ? v : null
        if (ms !== null) return new Date(ms).toISOString().split('T')[0]
        return String(v)
      }

      if (mode === 'mixed') {
        setStats({
          count: Number(row.cnt),
          unique: Number(row.uniq),
          sum: null,
          avg: null,
          median: null,
          stdDev: null,
          min: null,
          max: null,
        })
      } else if (mode === 'numeric') {
        setStats({
          count: Number(row.cnt),
          unique: Number(row.uniq),
          sum: toNum(row.total),
          avg: toNum(row.average),
          median: toNum(row.med),
          stdDev: toNum(row.std_dev),
          min: toVal(row.minimum),
          max: toVal(row.maximum),
        })
      } else if (mode === 'date') {
        setStats({
          count: Number(row.cnt),
          unique: Number(row.uniq),
          sum: null,
          avg: null,
          median: null,
          stdDev: null,
          min: toDate(row.minimum),
          max: toDate(row.maximum),
        })
      } else {
        setStats({
          count: Number(row.cnt),
          unique: Number(row.uniq),
          sum: null,
          avg: null,
          median: null,
          stdDev: null,
          min: toVal(row.minimum),
          max: toVal(row.maximum),
        })
      }
    })
  }, [client, tableName, visibleColumns, getSelectionBounds])

  return stats
}
