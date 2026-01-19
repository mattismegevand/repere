import { ArrowDown, ArrowUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { formatCell } from '@/lib/formatters'
import type { Column } from '@/types'

type SortDirection = 'asc' | 'desc' | null

interface PreviewDataGridProps {
  data: Record<string, unknown>[] | null
  columns: Column[]
  loading: boolean
  error: string | null
  rowCount: number | null
  height?: number
  enableSort?: boolean
}

function compareValues(a: unknown, b: unknown, direction: SortDirection): number {
  if (a === null || a === undefined) return direction === 'asc' ? 1 : -1
  if (b === null || b === undefined) return direction === 'asc' ? -1 : 1

  if (typeof a === 'number' && typeof b === 'number') {
    return direction === 'asc' ? a - b : b - a
  }
  if (typeof a === 'bigint' && typeof b === 'bigint') {
    return direction === 'asc' ? Number(a - b) : Number(b - a)
  }
  if (a instanceof Date && b instanceof Date) {
    return direction === 'asc' ? a.getTime() - b.getTime() : b.getTime() - a.getTime()
  }

  const strA = String(a).toLowerCase()
  const strB = String(b).toLowerCase()
  return direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA)
}

export function PreviewDataGrid({
  data,
  columns,
  loading,
  error,
  rowCount,
  height = 200,
  enableSort = true,
}: PreviewDataGridProps) {
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)

  const handleHeaderClick = (columnName: string) => {
    if (!enableSort) return

    if (sortColumn === columnName) {
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (sortDirection === 'desc') {
        setSortColumn(null)
        setSortDirection(null)
      }
    } else {
      setSortColumn(columnName)
      setSortDirection('asc')
    }
  }

  const sortedData = useMemo(() => {
    if (!data || !sortColumn || !sortDirection) return data
    return [...data].sort((a, b) => compareValues(a[sortColumn], b[sortColumn], sortDirection))
  }, [data, sortColumn, sortDirection])

  if (error) {
    return (
      <div className="mt-3 p-3 bg-red-500/10 text-red-500 text-xs rounded border border-red-500/30">
        <div className="font-medium mb-1">Preview error</div>
        <div className="font-mono text-[10px] break-all">{error}</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mt-3 p-4 border border-[var(--color-border)] rounded">
        <div className="animate-pulse space-y-2">
          <div className="h-3 bg-[var(--color-bg-secondary)] rounded w-1/2" />
          <div className="h-3 bg-[var(--color-bg-secondary)] rounded w-3/4" />
          <div className="h-3 bg-[var(--color-bg-secondary)] rounded w-2/3" />
        </div>
      </div>
    )
  }

  if (!sortedData || sortedData.length === 0) {
    if (rowCount === 0) {
      return (
        <div className="mt-3 p-3 bg-amber-500/10 text-amber-600 text-xs rounded border border-amber-500/30">
          Result is empty (0 rows)
        </div>
      )
    }
    return null
  }

  return (
    <div className="mt-3 border border-[var(--color-border)] rounded overflow-hidden">
      <div className="px-2 py-1.5 bg-[var(--color-bg-secondary)] text-xs flex justify-between items-center border-b border-[var(--color-border)]">
        <span className="font-medium">Preview</span>
        {rowCount !== null && (
          <span className="text-[var(--color-text-muted)]">
            {sortedData.length < rowCount ? `Showing ${sortedData.length} of ` : ''}
            {rowCount.toLocaleString()} rows
          </span>
        )}
      </div>
      <div className="overflow-auto" style={{ maxHeight: height }}>
        <table className="w-full text-xs border-collapse">
          <thead className="bg-[var(--color-bg-secondary)] sticky top-0 z-10">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.name}
                  onClick={() => handleHeaderClick(col.name)}
                  className={`
                    px-2 py-1.5 text-left font-medium border-b border-[var(--color-border)] whitespace-nowrap
                    ${enableSort ? 'cursor-pointer hover:bg-[var(--color-bg-tertiary)] select-none' : ''}
                  `}
                >
                  <div className="flex items-center gap-1">
                    <span className="truncate max-w-[120px]" title={col.name}>
                      {col.name}
                    </span>
                    <span className="text-[10px] text-[var(--color-text-muted)]">({col.type})</span>
                    {enableSort && sortColumn === col.name && (
                      <span className="ml-auto">
                        {sortDirection === 'asc' ? (
                          <ArrowUp className="w-3 h-3 text-[var(--color-accent)]" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-[var(--color-accent)]" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, i) => (
              <tr
                key={i}
                className={`border-b border-[var(--color-border)] ${i % 2 === 1 ? 'bg-[var(--color-bg-secondary)]/50' : ''}`}
              >
                {columns.map((col) => {
                  const formatted = formatCell(row[col.name], col.type)
                  return (
                    <td key={col.name} className="px-2 py-1 truncate max-w-[150px]" title={formatted}>
                      {formatted}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
