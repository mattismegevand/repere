import { ResultGrid } from '@/components/sql-panel/ResultGrid'

interface PreviewSectionProps {
  columns: { name: string; type: string }[]
  rows: Record<string, unknown>[]
  totalCount: number
  loading: boolean
  error: string | null
  maxHeight?: number
  limit?: number
  hideHeader?: boolean
}

export function PreviewSection({
  columns,
  rows,
  totalCount,
  loading,
  error,
  maxHeight = 200,
  limit = 100,
  hideHeader = false,
}: PreviewSectionProps) {
  return (
    <div className={hideHeader ? '' : 'border-t border-[var(--color-border)] pt-3'}>
      {!hideHeader && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
            Preview
          </span>
          {loading && <span className="text-[10px] text-[var(--color-text-muted)]">Loading...</span>}
          {!loading && !error && (
            <span className="text-[10px] text-[var(--color-text-muted)]">
              {totalCount.toLocaleString()} row{totalCount !== 1 ? 's' : ''}
              {totalCount > limit && ` (showing ${limit})`}
            </span>
          )}
        </div>
      )}

      {error ? (
        <div className="text-[11px] text-[var(--color-error)] bg-[var(--color-error)]/10 p-2 rounded">{error}</div>
      ) : rows.length > 0 ? (
        <ResultGrid columns={columns} rows={rows} maxHeight={maxHeight} />
      ) : !loading ? (
        <div className="text-[11px] text-[var(--color-text-muted)] p-3 text-center bg-[var(--color-bg-secondary)] rounded">
          No rows match
        </div>
      ) : null}
    </div>
  )
}
