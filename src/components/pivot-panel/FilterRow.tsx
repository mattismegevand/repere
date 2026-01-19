import type { Column, Filter, FilterOperator } from '@/types/dataset'

interface FilterRowProps {
  filter: Filter
  columns: Column[]
  onUpdate: (filter: Filter) => void
  onRemove: () => void
}

const OPERATORS: { value: FilterOperator; label: string; needsValue: boolean }[] = [
  { value: 'eq', label: '=', needsValue: true },
  { value: 'neq', label: '!=', needsValue: true },
  { value: 'gt', label: '>', needsValue: true },
  { value: 'gte', label: '>=', needsValue: true },
  { value: 'lt', label: '<', needsValue: true },
  { value: 'lte', label: '<=', needsValue: true },
  { value: 'contains', label: 'contains', needsValue: true },
  { value: 'startsWith', label: 'starts with', needsValue: true },
  { value: 'endsWith', label: 'ends with', needsValue: true },
  { value: 'isNull', label: 'is null', needsValue: false },
  { value: 'isNotNull', label: 'is not null', needsValue: false },
]

export function FilterRow({ filter, columns, onUpdate, onRemove }: FilterRowProps) {
  const operatorInfo = OPERATORS.find((o) => o.value === filter.operator)
  const needsValue = operatorInfo?.needsValue ?? true

  return (
    <div className="flex items-center gap-1 p-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
      <select
        value={filter.column}
        onChange={(e) => onUpdate({ ...filter, column: e.target.value })}
        className="flex-1 min-w-0 px-1 py-0.5 text-[10px] bg-[var(--color-bg-primary)] border border-[var(--color-border)] outline-none"
      >
        {columns.map((col) => (
          <option key={col.name} value={col.name}>
            {col.name}
          </option>
        ))}
      </select>

      <select
        value={filter.operator}
        onChange={(e) => onUpdate({ ...filter, operator: e.target.value as FilterOperator })}
        className="w-20 px-1 py-0.5 text-[10px] bg-[var(--color-bg-primary)] border border-[var(--color-border)] outline-none"
      >
        {OPERATORS.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>

      {needsValue && (
        <input
          type="text"
          value={String(filter.value ?? '')}
          onChange={(e) => onUpdate({ ...filter, value: e.target.value })}
          placeholder="value"
          className="flex-1 min-w-0 px-1 py-0.5 text-[10px] bg-[var(--color-bg-primary)] border border-[var(--color-border)] outline-none"
        />
      )}

      <button
        onClick={onRemove}
        className="px-1 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-error)]"
      >
        x
      </button>
    </div>
  )
}
