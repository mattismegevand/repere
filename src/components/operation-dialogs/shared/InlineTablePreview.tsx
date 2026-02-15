import { useEffect, useState } from 'react'
import { MiniTable } from '@/components/pipeline-canvas/nodes/MiniTable'
import { useDuckDB } from '@/lib/duckdb'
import type { HydratedNode } from '@/lib/pipeline/hydration'

interface InlineTablePreviewProps {
  node: HydratedNode | null
  height?: number
}

function escapeIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

export function InlineTablePreview({ node, height = 140 }: InlineTablePreviewProps) {
  const { client } = useDuckDB()
  const [previewData, setPreviewData] = useState<{
    rows: Record<string, unknown>[]
    loading: boolean
    error: string | null
  }>({ rows: [], loading: false, error: null })

  useEffect(() => {
    if (!node || !node.tableName || !client) {
      setPreviewData({ rows: [], loading: false, error: null })
      return
    }

    setPreviewData((p) => ({ ...p, loading: true, error: null }))
    const tableName = node.tableName
    if (!tableName) return

    const fetchPreview = async () => {
      try {
        const query = `SELECT * FROM ${escapeIdentifier(tableName)} LIMIT 5`
        const result = await client.query(query)
        setPreviewData({ rows: result.rows, loading: false, error: null })
      } catch (err) {
        setPreviewData({
          rows: [],
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load preview',
        })
      }
    }

    fetchPreview()
  }, [node, client])

  if (!node) {
    return (
      <div
        className="border border-dashed border-[var(--color-border)] rounded-lg flex items-center justify-center text-xs text-[var(--color-text-muted)]"
        style={{ height }}
      >
        Select a table
      </div>
    )
  }

  return (
    <div className="border border-[var(--color-border)] rounded-lg overflow-hidden" style={{ height }}>
      <div className="px-2 py-1 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <span className="text-[10px] font-medium text-[var(--color-text-muted)]">{node.name}</span>
      </div>
      <div style={{ height: `calc(100% - 24px)` }}>
        <MiniTable
          rows={previewData.rows}
          columns={node.columns ?? []}
          loading={previewData.loading}
          error={previewData.error}
        />
      </div>
    </div>
  )
}
