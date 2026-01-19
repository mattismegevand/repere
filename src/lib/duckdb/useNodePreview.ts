import { useEffect, useState } from 'react'
import { normalizeRowDates } from '@/lib/formatters'
import type { Column } from '@/types'
import { useDuckDB } from './hooks/useDuckDB'

interface PreviewResult {
  rows: Record<string, unknown>[]
  columns: Column[]
  loading: boolean
  error: string | null
}

const PREVIEW_LIMIT = 500

export function useNodePreview(tableName: string, enabled: boolean): PreviewResult {
  const { client } = useDuckDB()
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [columns, setColumns] = useState<Column[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !client || !tableName) {
      setRows([])
      setColumns([])
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const fetchPreview = async () => {
      try {
        const cols = await client.describe(tableName)
        if (cancelled) return
        setColumns(cols)

        const sql = `SELECT * FROM "${tableName}" LIMIT ${PREVIEW_LIMIT}`
        const result = await client.query(sql)

        if (cancelled) return

        const data = result.rows.map((r) => normalizeRowDates(r, cols))
        setRows(data)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to fetch preview')
        setRows([])
        setColumns([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchPreview()

    return () => {
      cancelled = true
    }
  }, [client, tableName, enabled])

  return { rows, columns, loading, error }
}
