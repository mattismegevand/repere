import { useCallback, useMemo, useState } from 'react'
import { usePivotStore } from '@/stores/pivotStore'
import { PivotRow } from './PivotRow'
import type { PivotRow as PivotRowType, PivotTableData } from './types'

interface PivotTableProps {
  data: PivotTableData
  onCellClick?: (row: PivotRowType, columnKey: string) => void
}

export function PivotTable({ data, onCellClick }: PivotTableProps) {
  const expandedGroups = usePivotStore((s) => s.expandedGroups)
  const toggleGroupExpand = usePivotStore((s) => s.toggleGroupExpand)
  const sortColumn = usePivotStore((s) => s.sortColumn)
  const sortDirection = usePivotStore((s) => s.sortDirection)
  const setSort = usePivotStore((s) => s.setSort)

  const [hoveredColumn, setHoveredColumn] = useState<string | null>(null)

  const handleToggleExpand = useCallback(
    (groupPath: string[]) => {
      const pathKey = groupPath.join('|')
      toggleGroupExpand(pathKey)
    },
    [toggleGroupExpand]
  )

  const handleHeaderClick = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSort(columnKey, sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSort(columnKey, 'asc')
    }
  }

  const visibleRows = useMemo(() => {
    const result: PivotRowType[] = []

    const processRows = (rows: PivotRowType[]) => {
      for (const row of rows) {
        const pathKey = row.groupPath.join('|')
        const isExpanded = expandedGroups.has(pathKey) || expandedGroups.has('__all__')

        result.push({ ...row, isExpanded })

        if (isExpanded && row.children) {
          processRows(row.children)
        }
      }
    }

    processRows(data.rows)
    return result
  }, [data.rows, expandedGroups])

  const sortedRows = useMemo(() => {
    if (!sortColumn) return visibleRows

    return [...visibleRows].sort((a, b) => {
      const aVal = a.values[sortColumn]
      const bVal = b.values[sortColumn]

      // Keep subtotals and grand totals in place
      if (a.isGrandTotal) return 1
      if (b.isGrandTotal) return -1
      if (a.isSubtotal && !b.isSubtotal) return 1
      if (!a.isSubtotal && b.isSubtotal) return -1

      // Compare values
      if (aVal === null || aVal === undefined) return 1
      if (bVal === null || bVal === undefined) return -1

      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [visibleRows, sortColumn, sortDirection])

  if (data.columns.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] text-[12px]">
        Configure pivot fields to see results
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto" data-tour="pivot-table">
      <table className="w-full border-collapse text-[var(--color-text-primary)]">
        <thead className="sticky top-0 z-10">
          <tr>
            {data.columns.map((col) => (
              <th
                key={col.key}
                className={`px-2 py-2 text-[10px] uppercase tracking-wide border-b-2 border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] cursor-pointer select-none ${
                  col.isRowHeader ? 'text-left' : 'text-right'
                } ${hoveredColumn === col.key ? 'bg-[var(--color-bg-tertiary)]' : ''}`}
                onClick={() => handleHeaderClick(col.key)}
                onMouseEnter={() => setHoveredColumn(col.key)}
                onMouseLeave={() => setHoveredColumn(null)}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate">{col.label}</span>
                  {sortColumn === col.key && (
                    <span className="text-[var(--color-accent)]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <PivotRow
              key={row.id}
              row={row}
              columns={data.columns}
              onToggleExpand={handleToggleExpand}
              onCellClick={onCellClick}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
