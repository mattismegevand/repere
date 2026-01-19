import type { PivotValueField, ShowValuesAs, ValueFormat, ValueFormatType } from '@/stores/pivotStore'
import type { AggregateFunction } from '@/types/pipeline'

interface ValueFieldConfigProps {
  field: PivotValueField
  onUpdate: (updates: Partial<PivotValueField>) => void
  onRemove: () => void
}

const AGGREGATE_FUNCTIONS: { value: AggregateFunction; label: string }[] = [
  { value: 'sum', label: 'Sum' },
  { value: 'count', label: 'Count' },
  { value: 'countDistinct', label: 'Count distinct' },
  { value: 'avg', label: 'Avg' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
  { value: 'first', label: 'First' },
  { value: 'last', label: 'Last' },
]

const FORMAT_TYPES: { value: ValueFormatType; label: string }[] = [
  { value: 'number', label: 'Number' },
  { value: 'decimal', label: 'Decimal' },
  { value: 'currency', label: 'Currency' },
  { value: 'percent', label: 'Percent' },
]

const SHOW_VALUES_AS: { value: ShowValuesAs; label: string }[] = [
  { value: 'normal', label: 'No calculation' },
  { value: 'percentOfGrandTotal', label: '% of Grand Total' },
  { value: 'percentOfParentTotal', label: '% of Parent Total' },
  { value: 'percentOfColumnTotal', label: '% of Column Total' },
]

export function ValueFieldConfig({ field, onUpdate, onRemove }: ValueFieldConfigProps) {
  const handleAggregationChange = (agg: AggregateFunction) => {
    onUpdate({
      aggregation: agg,
      alias: `${agg}_${field.column}`,
    })
  }

  const handleFormatChange = (type: ValueFormatType) => {
    const newFormat: ValueFormat = {
      ...field.format,
      type,
      prefix: type === 'currency' ? '$' : undefined,
      suffix: type === 'percent' ? '%' : undefined,
    }
    onUpdate({ format: newFormat })
  }

  const handleDecimalsChange = (decimals: number) => {
    onUpdate({
      format: { ...field.format, decimals },
    })
  }

  const handleShowValuesAsChange = (showValuesAs: ShowValuesAs) => {
    onUpdate({ showValuesAs })
  }

  return (
    <div className="p-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] mb-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium">{field.column}</span>
        <button
          onClick={onRemove}
          className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-error)]"
        >
          Remove
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className="text-[9px] text-[var(--color-text-muted)] block mb-1">Aggregation</label>
          <select
            value={field.aggregation}
            onChange={(e) => handleAggregationChange(e.target.value as AggregateFunction)}
            className="w-full text-[10px] px-2 py-1 bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)]"
          >
            {AGGREGATE_FUNCTIONS.map((fn) => (
              <option key={fn.value} value={fn.value}>
                {fn.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[9px] text-[var(--color-text-muted)] block mb-1">Format</label>
          <select
            value={field.format.type}
            onChange={(e) => handleFormatChange(e.target.value as ValueFormatType)}
            className="w-full text-[10px] px-2 py-1 bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)]"
          >
            {FORMAT_TYPES.map((fmt) => (
              <option key={fmt.value} value={fmt.value}>
                {fmt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-2">
        <label className="text-[9px] text-[var(--color-text-muted)] block mb-1">Show values as</label>
        <select
          value={field.showValuesAs ?? 'normal'}
          onChange={(e) => handleShowValuesAsChange(e.target.value as ShowValuesAs)}
          className="w-full text-[10px] px-2 py-1 bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)]"
        >
          {SHOW_VALUES_AS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-[9px] text-[var(--color-text-muted)]">Decimals</label>
        <input
          type="number"
          min={0}
          max={10}
          value={field.format.decimals}
          onChange={(e) => handleDecimalsChange(parseInt(e.target.value, 10) || 0)}
          className="w-16 text-[10px] px-2 py-1 bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)]"
        />
      </div>
    </div>
  )
}
