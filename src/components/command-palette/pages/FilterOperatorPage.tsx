import { Command } from 'cmdk'
import { useMemo } from 'react'
import { addFilterToExpression, createExpression } from '@/lib/filter-utils'
import { useFilterApply } from '@/lib/hooks/useFilterApply'
import { usePipeline } from '@/lib/pipeline/usePipeline'
import type { Column, DataView, FilterExpression, FilterOperation, FilterOperator } from '@/types'
import { useCommandPalette } from '../CommandPaletteContext'
import { PageHeader } from '../components/PageHeader'

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

export function FilterOperatorPage() {
  const { page, pushPage, close } = useCommandPalette()
  const { activeNode } = usePipeline()
  const { applyFilter } = useFilterApply({ onSuccess: close })

  // Extract page data (may be undefined if not on filter page)
  const isValidPage = page.type === 'filter' && !!page.column
  const pageColumn = page.type === 'filter' ? page.column : undefined

  // Get current filter expression from active node (if it's a filter view)
  const currentFilterExpression = useMemo((): FilterExpression | undefined => {
    if (!activeNode || activeNode.type !== 'view') return undefined
    const view = activeNode as DataView
    if (view.operation.type !== 'filter') return undefined
    return (view.operation as FilterOperation).expression
  }, [activeNode])

  const column = activeNode?.columns.find((c) => c.name === pageColumn)
  const columnType = column?.type ?? 'unknown'
  const availableOps = OPERATORS.filter((op) => op.types.includes(columnType))

  // Early return for invalid page state (after hooks)
  if (!isValidPage) {
    return null
  }

  const handleSelect = async (op: OperatorConfig) => {
    if (op.needsValue) {
      pushPage({ type: 'filter', column: pageColumn, operator: op.key })
    } else {
      // Apply immediately for isNull/isNotNull
      const newFilter = {
        column: pageColumn!,
        operator: op.key,
        value: null,
      }

      // Combine with existing filter expression if present
      const expression = currentFilterExpression
        ? addFilterToExpression(currentFilterExpression, newFilter)
        : createExpression([newFilter])

      await applyFilter({
        type: 'filter',
        expression,
      })
    }
  }

  return (
    <>
      <PageHeader title={pageColumn!} breadcrumbs={['Filter']} />
      <Command.List className="max-h-80 overflow-y-auto p-2">
        <Command.Empty className="py-6 text-center text-sm text-[var(--color-text-muted)]">
          No operators available
        </Command.Empty>
        {availableOps.map((op) => (
          <Command.Item
            key={op.key}
            value={`${op.label} ${op.symbol}`}
            onSelect={() => handleSelect(op)}
            className="px-2 py-2 cursor-pointer text-sm rounded-md hover:bg-[var(--color-bg-secondary)] data-[selected=true]:bg-[var(--color-accent-bg)] flex items-center gap-3"
          >
            <span className="w-16 font-mono text-[var(--color-text-muted)]">{op.symbol}</span>
            <span>{op.label}</span>
            {!op.needsValue && (
              <span className="ml-auto text-xs text-[var(--color-text-muted)]">applies immediately</span>
            )}
          </Command.Item>
        ))}
      </Command.List>
    </>
  )
}
