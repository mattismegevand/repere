import * as Popover from '@radix-ui/react-popover'
import { X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  createExpression,
  flattenExpression,
  removeFilterFromExpression,
  updateFilterInExpression,
} from '@/lib/filter-utils'
import { formatDuckDBDate, formatDuckDBTimestampForInput } from '@/lib/formatters'
import { useFilterApply } from '@/lib/hooks/useFilterApply'
import { usePipeline } from '@/lib/pipeline/usePipeline'
import type { Column, DataView, FilterExpression, FilterOperation, FilterOperator } from '@/types'

interface Props {
  column: Column
  onClose: () => void
  /** Fixed position for rendering as floating popup (e.g., from filter chip) */
  position?: { x: number; y: number }
}

interface OperatorConfig {
  key: FilterOperator
  label: string
  symbol: string
  types: Column['type'][]
  needsValue: boolean
}

const OPERATORS: OperatorConfig[] = [
  { key: 'eq', label: 'equals', symbol: '=', types: ['string', 'number', 'boolean', 'date'], needsValue: true },
  { key: 'neq', label: 'not equals', symbol: '≠', types: ['string', 'number', 'boolean', 'date'], needsValue: true },
  { key: 'gt', label: 'greater than', symbol: '>', types: ['number', 'date'], needsValue: true },
  { key: 'lt', label: 'less than', symbol: '<', types: ['number', 'date'], needsValue: true },
  { key: 'gte', label: 'greater or equal', symbol: '≥', types: ['number', 'date'], needsValue: true },
  { key: 'lte', label: 'less or equal', symbol: '≤', types: ['number', 'date'], needsValue: true },
  { key: 'contains', label: 'contains', symbol: 'contains', types: ['string'], needsValue: true },
  { key: 'notContains', label: 'excludes', symbol: 'excludes', types: ['string'], needsValue: true },
  { key: 'startsWith', label: 'starts with', symbol: 'starts', types: ['string'], needsValue: true },
  { key: 'endsWith', label: 'ends with', symbol: 'ends', types: ['string'], needsValue: true },
  {
    key: 'isNull',
    label: 'is empty',
    symbol: 'empty',
    types: ['string', 'number', 'boolean', 'date', 'unknown'],
    needsValue: false,
  },
  {
    key: 'isNotNull',
    label: 'has value',
    symbol: 'not empty',
    types: ['string', 'number', 'boolean', 'date', 'unknown'],
    needsValue: false,
  },
]

export function ColumnFilter({ column, onClose, position }: Props) {
  const { activeNode, removeCurrentOperation, forceRemoveCurrentOperation, getNodeChildren } = usePipeline()
  const { applyFilter } = useFilterApply({ onSuccess: onClose })

  const { filterExpression, existingFilter } = useMemo(() => {
    if (!activeNode || activeNode.type !== 'view') {
      return { filterExpression: undefined as FilterExpression | undefined, existingFilter: undefined }
    }
    const view = activeNode as DataView
    if (view.operation.type !== 'filter') {
      return { filterExpression: undefined as FilterExpression | undefined, existingFilter: undefined }
    }
    const op = view.operation as FilterOperation
    const filters = flattenExpression(op.expression)
    return {
      filterExpression: op.expression,
      existingFilter: filters.find((f) => f.column === column.name),
    }
  }, [activeNode, column.name])

  const [operator, setOperator] = useState<FilterOperator>(existingFilter?.operator ?? 'eq')
  const [value, setValue] = useState(() => {
    if (!existingFilter?.value) return ''
    // Format date/timestamp values properly
    if (column.type === 'date') {
      return formatDuckDBDate(existingFilter.value) ?? ''
    }
    if (column.type === 'timestamp') {
      return formatDuckDBTimestampForInput(existingFilter.value) ?? ''
    }
    return String(existingFilter.value)
  })
  const [confirmDelete, setConfirmDelete] = useState<{ descendantCount: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const availableOps = OPERATORS.filter((op) => op.types.includes(column.type))
  const currentOp = OPERATORS.find((op) => op.key === operator)
  const needsValue = currentOp?.needsValue ?? true

  // Focus input when operator changes and needs value
  useEffect(() => {
    if (needsValue && inputRef.current) {
      inputRef.current.focus()
    }
  }, [operator, needsValue])

  const handleApply = async () => {
    let parsedValue: unknown = value
    if (column.type === 'number' && value) {
      parsedValue = parseFloat(value)
    } else if (column.type === 'boolean') {
      parsedValue = value.toLowerCase() === 'true'
    } else if (column.type === 'timestamp' && value) {
      // Convert datetime-local format (YYYY-MM-DDTHH:mm) to SQL format (YYYY-MM-DD HH:mm:ss)
      parsedValue = value.replace('T', ' ') + (value.length === 16 ? ':00' : '')
    }

    const newFilter = {
      column: column.name,
      operator,
      value: needsValue ? parsedValue : null,
    }

    let newExpression: FilterExpression
    if (filterExpression) {
      newExpression = updateFilterInExpression(filterExpression, column.name, newFilter)
    } else {
      newExpression = createExpression([newFilter])
    }

    const operation: FilterOperation = { type: 'filter', expression: newExpression }

    // applyFilter handles the replace/branch choice dialog if needed
    await applyFilter(operation)
  }

  const handleClear = async () => {
    if (!activeNode || activeNode.type !== 'view' || !filterExpression) {
      onClose()
      return
    }

    const view = activeNode as DataView
    if (view.operation.type !== 'filter') {
      onClose()
      return
    }

    const newExpression = removeFilterFromExpression(filterExpression, column.name)

    if (!newExpression) {
      const result = await removeCurrentOperation()
      if (result.needsConfirmation && result.descendantCount) {
        setConfirmDelete({ descendantCount: result.descendantCount })
        return
      }
      onClose()
    } else {
      // Use applyFilter to ensure snapshot is captured for branching
      await applyFilter({
        type: 'filter',
        expression: newExpression,
      })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Stop propagation to prevent DataGrid keyboard shortcuts from firing
    e.stopPropagation()

    if (e.key === 'Enter' && (!needsValue || value)) {
      handleApply()
    }
  }

  const hasChildren = activeNode ? getNodeChildren(activeNode.id).length > 0 : false

  const content = (
    <div
      data-tour="column-filter"
      className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg shadow-lg min-w-[220px] overflow-hidden"
      onKeyDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase">{column.type}</span>
          <span className="text-[12px] font-medium text-[var(--color-text-primary)]">{column.name}</span>
        </div>
        <button
          onClick={onClose}
          className="p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Operator selection */}
      <div className="px-3 py-2 border-b border-[var(--color-border)]">
        <div className="flex flex-wrap gap-1">
          {availableOps.map((op) => (
            <button
              key={op.key}
              onClick={() => setOperator(op.key)}
              className={`px-2 py-1 text-[11px] rounded transition-colors ${
                operator === op.key
                  ? 'bg-[var(--color-accent)] text-black font-medium'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
              }`}
              title={op.label}
            >
              {op.symbol}
            </button>
          ))}
        </div>
      </div>

      {/* Value input */}
      {needsValue && (
        <div className="px-3 py-2 border-b border-[var(--color-border)]">
          <input
            ref={inputRef}
            type={
              column.type === 'number'
                ? 'number'
                : column.type === 'date'
                  ? 'date'
                  : column.type === 'timestamp'
                    ? 'datetime-local'
                    : 'text'
            }
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Enter ${column.type} value...`}
            className="w-full px-2 py-1.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded text-[12px] focus:outline-none focus:border-[var(--color-accent)]"
            autoFocus
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between px-3 py-2 bg-[var(--color-bg-secondary)]">
        {existingFilter ? (
          <button
            onClick={handleClear}
            className="text-[11px] text-[var(--color-error)] hover:underline"
            title={hasChildren ? 'Will delete child views' : undefined}
          >
            Remove filter
          </button>
        ) : (
          <div />
        )}
        <button
          onClick={handleApply}
          disabled={needsValue && !value}
          className="px-3 py-1 bg-[var(--color-accent)] text-black text-[11px] font-medium rounded hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Apply
        </button>
      </div>
    </div>
  )

  return (
    <>
      {confirmDelete && (
        <ConfirmDialog
          title="Delete filter with children?"
          message={`This will also delete ${confirmDelete.descendantCount} derived view${confirmDelete.descendantCount > 1 ? 's' : ''}.`}
          confirmLabel="Delete All"
          onConfirm={async () => {
            await forceRemoveCurrentOperation()
            setConfirmDelete(null)
            onClose()
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      <Popover.Root open onOpenChange={(open) => !open && onClose()}>
        {position ? (
          // Fixed position mode (from filter chip click)
          <Popover.Anchor asChild>
            <div style={{ position: 'fixed', left: position.x, top: position.y, width: 0, height: 0 }} />
          </Popover.Anchor>
        ) : (
          // Relative position mode (from column header) - anchor to parent
          <Popover.Anchor asChild>
            <div style={{ position: 'absolute', left: 0, top: '100%', width: 0, height: 0 }} />
          </Popover.Anchor>
        )}
        <Popover.Portal>
          <Popover.Content
            side="bottom"
            align="start"
            sideOffset={4}
            className="popover-content !p-0"
            onPointerDownOutside={(e) => {
              const target = e.target as HTMLElement
              // Don't close if clicking on driver tour elements or dialogs
              if (
                target.closest('.driver-popover') ||
                target.closest('.driver-overlay') ||
                target.closest('[role="dialog"]')
              ) {
                e.preventDefault()
              }
            }}
          >
            {content}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </>
  )
}
