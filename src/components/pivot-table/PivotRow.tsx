import { PivotCell } from './PivotCell'
import type { PivotColumn, PivotRow as PivotRowType } from './types'

interface PivotRowProps {
  row: PivotRowType
  columns: PivotColumn[]
  onToggleExpand: (groupPath: string[]) => void
  onCellClick?: (row: PivotRowType, columnKey: string) => void
}

export function PivotRow({ row, columns, onToggleExpand, onCellClick }: PivotRowProps) {
  const indent = row.level * 16

  const handleExpandClick = () => {
    if (row.children && row.children.length > 0) {
      onToggleExpand(row.groupPath)
    }
  }

  // Count only non-subtotal children for display
  const dataChildCount = row.children?.filter((c) => !c.isSubtotal).length ?? 0
  const hasChildren = dataChildCount > 0

  // When collapsed, use subtotal values for display
  const subtotalChild = row.children?.find((c) => c.isSubtotal)
  const displayValues = !row.isExpanded && subtotalChild ? subtotalChild.values : row.values

  return (
    <tr>
      {columns.map((col) => {
        const isRowLabelColumn = col.key === '__row_label__'
        const value = displayValues[col.key]

        if (isRowLabelColumn) {
          // First row column gets special treatment with expand/collapse
          const displayValue = row.isGrandTotal
            ? 'Grand Total'
            : row.isSubtotal
              ? `${row.groupValue ?? ''} Subtotal`
              : String(row.groupValue ?? value ?? '')

          return (
            <td
              key={col.key}
              className={`px-2 py-1.5 text-[11px] border-b border-r border-[var(--color-border)] text-left ${
                row.isGrandTotal
                  ? 'bg-[var(--color-bg-tertiary)] font-bold'
                  : row.isSubtotal
                    ? 'bg-[var(--color-bg-secondary)] font-semibold'
                    : 'bg-[var(--color-bg-primary)]'
              }`}
            >
              <div className="flex items-center" style={{ paddingLeft: indent }}>
                {hasChildren && (
                  <button
                    onClick={handleExpandClick}
                    aria-label={row.isExpanded ? 'Collapse group' : 'Expand group'}
                    aria-expanded={row.isExpanded}
                    className="w-4 h-4 mr-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] flex items-center justify-center"
                  >
                    {row.isExpanded ? '▼' : '▶'}
                  </button>
                )}
                {!hasChildren && row.level > 0 && <span className="w-4 mr-1" />}
                <span>{displayValue}</span>
                {hasChildren && !row.isExpanded && (
                  <span className="ml-1 text-[9px] text-[var(--color-text-muted)]">
                    ({row.childCount ?? dataChildCount})
                  </span>
                )}
              </div>
            </td>
          )
        }

        return (
          <PivotCell
            key={col.key}
            value={value as string | number | null | undefined}
            format={col.format}
            isRowHeader={col.isRowHeader}
            isSubtotal={row.isSubtotal}
            isGrandTotal={row.isGrandTotal}
            onClick={
              !col.isRowHeader && !row.isSubtotal && !row.isGrandTotal ? () => onCellClick?.(row, col.key) : undefined
            }
          />
        )
      })}
    </tr>
  )
}
