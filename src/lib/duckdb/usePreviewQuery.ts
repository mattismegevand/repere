import { useEffect, useState } from 'react'
import { normalizeRowDates } from '@/lib/formatters'
import type { Column } from '@/types'
import { useDuckDB } from './hooks/useDuckDB'
import { mapDuckDBType } from './type-mapper'

interface PreviewResult {
  data: Record<string, unknown>[] | null
  columns: Column[]
  loading: boolean
  error: string | null
  rowCount: number | null
}

/**
 * Hook to execute a preview query and return the first N rows + total count
 * Debounces queries by 500ms to avoid excessive execution during typing
 */
export function usePreviewQuery(sql: string | null, limit = 1000): PreviewResult {
  const { client } = useDuckDB()
  const [data, setData] = useState<Record<string, unknown>[] | null>(null)
  const [columns, setColumns] = useState<Column[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rowCount, setRowCount] = useState<number | null>(null)

  useEffect(() => {
    if (!sql || !client) {
      setData(null)
      setColumns([])
      setRowCount(null)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const timeout = setTimeout(async () => {
      try {
        // Get columns with types from schema first (needed for date normalization)
        const schemaResult = await client.query(`DESCRIBE (${sql})`)
        if (cancelled) return
        const cols = schemaResult.rows.map((row) => ({
          name: row.column_name as string,
          type: mapDuckDBType(row.column_type as string),
          nullable: row.null === 'YES',
          duckdbType: row.column_type as string,
        }))
        setColumns(cols)

        // Get preview data
        const previewSql = `SELECT * FROM (${sql}) LIMIT ${limit}`
        const result = await client.query(previewSql)

        if (cancelled) return

        // Normalize dates in rows
        const rows = result.rows.map((r) => normalizeRowDates(r, cols))
        setData(rows)

        // Get total count
        const countSql = `SELECT COUNT(*) as cnt FROM (${sql})`
        const countResult = await client.query<{ cnt: bigint }>(countSql)
        setRowCount(countResult.rows[0] ? Number(countResult.rows[0].cnt) : 0)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Query failed')
        setData(null)
        setColumns([])
        setRowCount(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 500) // 500ms debounce

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [sql, client, limit])

  return { data, columns, loading, error, rowCount }
}
