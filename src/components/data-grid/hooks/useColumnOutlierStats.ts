import { useEffect } from 'react'
import type { DuckDBClient } from '@/lib/duckdb/interface'
import { escapeIdentifier } from '@/lib/duckdb/sql-builder'
import type { Column } from '@/types/dataset'

export interface ColumnOutlierStats {
  min: number
  max: number
  outlierLower?: number
  outlierUpper?: number
}

interface UseColumnOutlierStatsOptions {
  client: DuckDBClient | null
  tableName: string | undefined
  columns: Column[] | undefined
  setColumnStats: (stats: Record<string, ColumnOutlierStats>) => void
}

/**
 * Fetches min/max and IQR outlier bounds for numeric columns.
 * Used for sparklines and outlier highlighting in the grid.
 */
export function useColumnOutlierStats({ client, tableName, columns, setColumnStats }: UseColumnOutlierStatsOptions) {
  useEffect(() => {
    if (!client || !tableName || !columns) return

    async function fetchColumnStats() {
      const numericCols = columns!.filter((c) => c.type === 'number')
      if (numericCols.length === 0) {
        setColumnStats({})
        return
      }

      const stats: Record<string, ColumnOutlierStats> = {}
      const escapedTableName = escapeIdentifier(tableName!)

      for (const col of numericCols) {
        try {
          const colName = escapeIdentifier(col.name)
          const result = await client!.query<{
            min_val: number | bigint | null
            max_val: number | bigint | null
            q1: number | null
            q3: number | null
          }>(`
            SELECT
              MIN(${colName}) as min_val,
              MAX(${colName}) as max_val,
              PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ${colName}) as q1,
              PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ${colName}) as q3
            FROM ${escapedTableName}
          `)
          const row = result.rows[0]
          if (!row || row.min_val === null || row.max_val === null) continue
          const minVal = typeof row.min_val === 'bigint' ? Number(row.min_val) : row.min_val
          const maxVal = typeof row.max_val === 'bigint' ? Number(row.max_val) : row.max_val
          if (minVal !== maxVal) {
            const stat: ColumnOutlierStats = {
              min: minVal,
              max: maxVal,
            }
            // Calculate IQR outlier bounds if Q1 and Q3 are available
            if (row.q1 !== null && row.q3 !== null) {
              const iqr = row.q3 - row.q1
              stat.outlierLower = row.q1 - 1.5 * iqr
              stat.outlierUpper = row.q3 + 1.5 * iqr
            }
            stats[col.name] = stat
          }
        } catch {
          // Skip columns that fail
        }
      }
      setColumnStats(stats)
    }

    fetchColumnStats()
  }, [client, tableName, columns, setColumnStats])
}
