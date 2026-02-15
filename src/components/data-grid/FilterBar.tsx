import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import FilterIcon from 'lucide-react/dist/esm/icons/filter'
import Pencil from 'lucide-react/dist/esm/icons/pencil'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import X from 'lucide-react/dist/esm/icons/x'
import { Fragment, useState } from 'react'
import { formatDuckDBDate, formatDuckDBTimestamp } from '@/lib/formatters'
import type { Column, ColumnType, Filter, FilterExpression } from '@/types'

function getFilterColumns(expr: FilterExpression): string[] {
  if (expr.type === 'condition') {
    return [expr.filter.column]
  }
  const cols = new Set<string>()
  for (const child of expr.children) {
    for (const col of getFilterColumns(child)) {
      cols.add(col)
    }
  }
  return Array.from(cols)
}

interface FilterBarProps {
  filters: Filter[]
  filterExpression: FilterExpression | undefined
  columns: Column[]
  combineMode: 'and' | 'or'
  isComplex: boolean
  filterCount: number
  onRemoveFilter: (columnName: string) => void
  onClearAll: () => void
  onEditFilter: (filter: Filter, position?: { x: number; y: number }) => void
  onAddFilter: (columnName: string) => void
  onOpenEditor: () => void
}

const OPERATOR_LABELS: Record<string, string> = {
  eq: '=',
  neq: '≠',
  gt: '>',
  lt: '<',
  gte: '≥',
  lte: '≤',
  contains: 'contains',
  notContains: 'not contains',
  startsWith: 'starts with',
  endsWith: 'ends with',
  isNull: 'is empty',
  isNotNull: 'is not empty',
  in: 'in',
  notIn: 'not in',
  between: 'between',
}

function formatValue(value: unknown, columnType?: ColumnType): string {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) {
    return value.map((v) => formatValue(v, columnType)).join(', ')
  }
  // Format dates and timestamps properly
  if (columnType === 'date') {
    const formatted = formatDuckDBDate(value)
    if (formatted) return formatted
  }
  if (columnType === 'timestamp') {
    const formatted = formatDuckDBTimestamp(value)
    if (formatted) return formatted
  }
  const str = String(value)
  return str.length > 20 ? str.slice(0, 17) + '...' : str
}

export function FilterBar({
  filters,
  filterExpression,
  columns,
  combineMode,
  isComplex,
  filterCount,
  onRemoveFilter,
  onClearAll,
  onEditFilter,
  onAddFilter,
  onOpenEditor,
}: FilterBarProps) {
  const [showAddMenu, setShowAddMenu] = useState(false)
  const availableColumns = columns.filter((col) => !filters.some((f) => f.column === col.name))

  if (filters.length === 0 && availableColumns.length === 0) {
    return null
  }

  const combineModeLabel = combineMode === 'and' ? 'AND' : 'OR'
  const filterColumnNames = filterExpression ? getFilterColumns(filterExpression) : []

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]">
      <div className="flex items-center gap-1 text-[var(--color-text-muted)]">
        <FilterIcon size={12} />
        <span className="text-[10px] font-medium uppercase tracking-wide">Filters</span>
      </div>

      <div className="flex-1">
        {isComplex && filterExpression ? (
          <button
            onClick={onOpenEditor}
            className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <span className="text-[var(--color-text-muted)]">
              {filterColumnNames.slice(0, 3).join(', ')}
              {filterColumnNames.length > 3 && `, +${filterColumnNames.length - 3}`}
            </span>
            <span className="text-[var(--color-text-muted)]">•</span>
            <span>
              {filterCount} condition{filterCount !== 1 ? 's' : ''}
            </span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 flex-wrap">
            {filters.map((filter, index) => {
              const col = columns.find((c) => c.name === filter.column)
              return (
                <Fragment key={filter.column}>
                  <FilterChip
                    filter={filter}
                    columnType={col?.type}
                    onRemove={() => onRemoveFilter(filter.column)}
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      onEditFilter(filter, { x: rect.left, y: rect.bottom + 4 })
                    }}
                  />
                  {index < filters.length - 1 && (
                    <span
                      className={`text-[10px] font-medium ${
                        combineMode === 'and' ? 'text-[var(--color-accent)]' : 'text-amber-500'
                      }`}
                    >
                      {combineModeLabel}
                    </span>
                  )}
                </Fragment>
              )
            })}

            {availableColumns.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowAddMenu(!showAddMenu)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] rounded transition-colors"
                >
                  <span>+ Add</span>
                  <ChevronDown size={10} />
                </button>

                {showAddMenu && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowAddMenu(false)} />
                    <div className="absolute top-full left-0 mt-1 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg shadow-lg z-40 min-w-[160px] max-h-[240px] overflow-y-auto">
                      {availableColumns.map((col) => (
                        <button
                          key={col.name}
                          onClick={() => {
                            onAddFilter(col.name)
                            setShowAddMenu(false)
                          }}
                          className="w-full px-3 py-1.5 text-left text-[11px] hover:bg-[var(--color-bg-secondary)] flex items-center gap-2"
                        >
                          <span className="text-[var(--color-text-muted)] text-[9px] uppercase w-12">{col.type}</span>
                          <span className="truncate">{col.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <button
        onClick={onOpenEditor}
        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        title="Open filter editor"
      >
        <Pencil size={10} />
        <span>Edit</span>
      </button>

      {filterCount > 1 && (
        <button
          onClick={onClearAll}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors"
          title="Clear all filters"
        >
          <Trash2 size={10} />
          <span>Clear</span>
        </button>
      )}
    </div>
  )
}

function FilterChip({
  filter,
  columnType,
  onRemove,
  onClick,
}: {
  filter: Filter
  columnType?: ColumnType
  onRemove: () => void
  onClick: (e: React.MouseEvent) => void
}) {
  const needsValue = !['isNull', 'isNotNull'].includes(filter.operator)
  const opLabel = OPERATOR_LABELS[filter.operator] || filter.operator

  return (
    <div
      className="group inline-flex items-center bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md overflow-hidden text-[11px] cursor-pointer hover:border-[var(--color-accent)] transition-colors"
      onClick={onClick}
    >
      <span className="px-2 py-0.5 text-[var(--color-text-muted)] border-r border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
        {filter.column}
      </span>
      <span className="px-1.5 py-0.5 text-[var(--color-text-secondary)]">
        {opLabel}
        {needsValue && (
          <span className="ml-1 text-[var(--color-text-primary)] font-medium">
            {formatValue(filter.value, columnType)}
          </span>
        )}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="px-1.5 py-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-colors"
        title="Remove filter"
      >
        <X size={12} />
      </button>
    </div>
  )
}
