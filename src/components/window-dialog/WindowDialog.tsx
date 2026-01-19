import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronDown, X } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Button, Label, Select } from '@/components/ui'
import { FormInput } from '@/components/ui/form'
import { RadixDialog } from '@/components/ui/RadixDialog'
import { usePipeline } from '@/lib/pipeline/usePipeline'
import { useDialogStore } from '@/stores'
import type { WindowFunction, WindowOperation } from '@/types'
import { type WindowFormValues, windowFormSchema } from './schema'

const WINDOW_FUNCTIONS: Array<{
  group: string
  functions: Array<{ value: WindowFunction; label: string; needsColumn: boolean; description: string }>
}> = [
  {
    group: 'Ranking',
    functions: [
      { value: 'row_number', label: 'ROW_NUMBER', needsColumn: false, description: 'Sequential integer for each row' },
      { value: 'rank', label: 'RANK', needsColumn: false, description: 'Rank with gaps for ties' },
      { value: 'dense_rank', label: 'DENSE_RANK', needsColumn: false, description: 'Rank without gaps' },
      { value: 'ntile', label: 'NTILE', needsColumn: false, description: 'Distribute into N buckets' },
    ],
  },
  {
    group: 'Offset',
    functions: [
      { value: 'lag', label: 'LAG', needsColumn: true, description: 'Value from N rows before' },
      { value: 'lead', label: 'LEAD', needsColumn: true, description: 'Value from N rows after' },
      { value: 'first_value', label: 'FIRST_VALUE', needsColumn: true, description: 'First value in window' },
      { value: 'last_value', label: 'LAST_VALUE', needsColumn: true, description: 'Last value in window' },
    ],
  },
  {
    group: 'Running Aggregate',
    functions: [
      { value: 'sum', label: 'Running SUM', needsColumn: true, description: 'Cumulative sum' },
      { value: 'avg', label: 'Running AVG', needsColumn: true, description: 'Cumulative average' },
      { value: 'count', label: 'Running COUNT', needsColumn: true, description: 'Cumulative count' },
      { value: 'min', label: 'Running MIN', needsColumn: true, description: 'Cumulative minimum' },
      { value: 'max', label: 'Running MAX', needsColumn: true, description: 'Cumulative maximum' },
    ],
  },
]

const ALL_FUNCTIONS = WINDOW_FUNCTIONS.flatMap((g) => g.functions)

function getFunctionInfo(fn: WindowFunction) {
  return ALL_FUNCTIONS.find((f) => f.value === fn)
}

function generateOutputColumnName(fn: WindowFunction, column?: string): string {
  const base = fn.replace(/_/g, '_')
  if (column) {
    return `${base}_${column}`
  }
  return base
}

export function WindowDialog() {
  const { activeNode, applyOrReplaceOperation } = usePipeline()
  const { activeDialog, closeDialog } = useDialogStore()
  const windowDialogColumn = activeDialog?.type === 'window' ? activeDialog.column : undefined
  const columns = activeNode?.columns ?? []

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<WindowFormValues>({
    resolver: zodResolver(windowFormSchema),
    defaultValues: {
      windowFn: 'row_number',
      sourceColumn: '',
      outputColumn: 'row_number',
      partitionBy: [],
      orderBy: [],
      offset: 1,
      ntileBuckets: 4,
    },
  })

  const windowFn = watch('windowFn')
  const sourceColumn = watch('sourceColumn')
  const partitionBy = watch('partitionBy')
  const orderBy = watch('orderBy')

  const fnInfo = getFunctionInfo(windowFn)
  const needsColumn = fnInfo?.needsColumn ?? false
  const isOffsetFunction = windowFn === 'lag' || windowFn === 'lead'
  const isNtile = windowFn === 'ntile'

  // Pre-select column from header menu
  useEffect(() => {
    if (windowDialogColumn && columns.some((c) => c.name === windowDialogColumn)) {
      setValue('sourceColumn', windowDialogColumn)
    }
  }, [windowDialogColumn, columns, setValue])

  // Auto-generate output column name when function or source column changes
  useEffect(() => {
    setValue('outputColumn', generateOutputColumnName(windowFn, needsColumn ? sourceColumn : undefined))
  }, [windowFn, sourceColumn, needsColumn, setValue])

  const handleClose = () => closeDialog()

  const addPartitionColumn = (colName: string) => {
    if (!partitionBy.includes(colName)) {
      setValue('partitionBy', [...partitionBy, colName])
    }
  }

  const removePartitionColumn = (colName: string) => {
    setValue(
      'partitionBy',
      partitionBy.filter((c) => c !== colName)
    )
  }

  const addOrderByColumn = (colName: string) => {
    if (!orderBy.some((o) => o.column === colName)) {
      setValue('orderBy', [...orderBy, { column: colName, direction: 'ASC' as const }])
    }
  }

  const removeOrderByColumn = (colName: string) => {
    setValue(
      'orderBy',
      orderBy.filter((o) => o.column !== colName)
    )
  }

  const toggleOrderDirection = (colName: string) => {
    setValue(
      'orderBy',
      orderBy.map((o) =>
        o.column === colName ? { ...o, direction: o.direction === 'ASC' ? 'DESC' : ('ASC' as const) } : o
      )
    )
  }

  const onSubmit = async (data: WindowFormValues) => {
    clearErrors('root')

    if (columns.some((c) => c.name === data.outputColumn.trim())) {
      setError('root', { message: 'Column name already exists' })
      return
    }

    const operation: WindowOperation = {
      type: 'window',
      function: data.windowFn,
      outputColumn: data.outputColumn.trim(),
      partitionBy: data.partitionBy,
      orderBy: data.orderBy,
      ...(needsColumn && data.sourceColumn ? { column: data.sourceColumn } : {}),
      ...(isOffsetFunction ? { offset: data.offset } : {}),
      ...(isNtile ? { ntileBuckets: data.ntileBuckets } : {}),
    }

    await applyOrReplaceOperation(operation)
    handleClose()
  }

  const availableForPartition = columns.filter((c) => !partitionBy.includes(c.name))
  const availableForOrderBy = columns.filter((c) => !orderBy.some((o) => o.column === c.name))

  return (
    <RadixDialog
      open={true}
      onOpenChange={(open) => !open && handleClose()}
      title="Add window function"
      width="xl"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit(onSubmit)}>
            Apply
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Function selector */}
        <div>
          <Label size="sm">Function</Label>
          <Select value={windowFn} onChange={(e) => setValue('windowFn', e.target.value as WindowFunction)}>
            {WINDOW_FUNCTIONS.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.functions.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
          {fnInfo && <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{fnInfo.description}</p>}
        </div>

        {/* Source column (for functions that need it) */}
        {needsColumn && (
          <div>
            <Label size="sm">Source column</Label>
            <Select value={sourceColumn} onChange={(e) => setValue('sourceColumn', e.target.value)}>
              <option value="" disabled>
                Select column...
              </option>
              {columns.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.type})
                </option>
              ))}
            </Select>
            {errors.sourceColumn && (
              <p className="text-[10px] text-[var(--color-error)] mt-1">{errors.sourceColumn.message}</p>
            )}
          </div>
        )}

        {/* Output column name */}
        <div>
          <Label size="sm">Output column name</Label>
          <FormInput name="outputColumn" control={control} placeholder="new_column" inputSize="sm" />
        </div>

        {/* NTILE buckets */}
        {isNtile && (
          <div>
            <Label size="sm">Number of buckets</Label>
            <FormInput name="ntileBuckets" control={control} type="number" min={1} inputSize="sm" />
          </div>
        )}

        {/* Offset for LAG/LEAD */}
        {isOffsetFunction && (
          <div>
            <Label size="sm">Offset (rows)</Label>
            <FormInput name="offset" control={control} type="number" min={1} inputSize="sm" />
          </div>
        )}

        {/* Partition By */}
        <div>
          <Label size="sm">Partition by (optional)</Label>
          <p className="text-[10px] text-[var(--color-text-muted)] mb-1">
            Reset the window for each unique combination of these columns
          </p>
          {partitionBy.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {partitionBy.map((col) => (
                <span
                  key={col}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-[var(--color-accent-bg)] border border-[var(--color-accent)] rounded"
                >
                  {col}
                  <button
                    type="button"
                    onClick={() => removePartitionColumn(col)}
                    className="hover:text-[var(--color-error)]"
                    aria-label={`Remove ${col}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {availableForPartition.length > 0 && (
            <div className="relative">
              <select
                className="w-full px-2 py-1 pr-8 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-xs appearance-none cursor-pointer"
                value=""
                onChange={(e) => {
                  if (e.target.value) addPartitionColumn(e.target.value)
                }}
              >
                <option value="">Add column...</option>
                {availableForPartition.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none text-[var(--color-text-muted)]" />
            </div>
          )}
        </div>

        {/* Order By */}
        <div>
          <Label size="sm">Order by</Label>
          <p className="text-[10px] text-[var(--color-text-muted)] mb-1">
            Determines the order of rows within each partition
          </p>
          {orderBy.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {orderBy.map((o) => (
                <span
                  key={o.column}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded"
                >
                  {o.column}
                  <button
                    type="button"
                    onClick={() => toggleOrderDirection(o.column)}
                    className="px-1 hover:bg-[var(--color-bg-tertiary)] rounded text-[var(--color-text-muted)]"
                    title="Toggle direction"
                  >
                    {o.direction}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeOrderByColumn(o.column)}
                    className="hover:text-[var(--color-error)]"
                    aria-label={`Remove ${o.column}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {availableForOrderBy.length > 0 && (
            <div className="relative">
              <select
                className="w-full px-2 py-1 pr-8 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-xs appearance-none cursor-pointer"
                value=""
                onChange={(e) => {
                  if (e.target.value) addOrderByColumn(e.target.value)
                }}
              >
                <option value="">Add column...</option>
                {availableForOrderBy.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none text-[var(--color-text-muted)]" />
            </div>
          )}
        </div>

        {errors.root && (
          <p className="text-xs text-[var(--color-error)] border border-[var(--color-error)] p-2">
            {errors.root.message}
          </p>
        )}
      </div>
    </RadixDialog>
  )
}
