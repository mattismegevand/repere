import { useEffect, useMemo, useRef, useState } from 'react'
import { PreviewDataGrid } from '@/components/common/PreviewDataGrid'
import { buildFilterExpression, escapeIdentifier } from '@/lib/duckdb/sql-builder/utils'
import { usePreviewQuery } from '@/lib/duckdb/usePreviewQuery'
import { addFilterToExpression, createExpression } from '@/lib/filter-utils'
import { useFilterApply } from '@/lib/hooks/useFilterApply'
import { usePipeline } from '@/lib/pipeline/usePipeline'
import { formatShortcut } from '@/lib/platform'
import type { DataView, FilterExpression, FilterOperation, FilterOperator } from '@/types'
import { useCommandPalette } from '../CommandPaletteContext'
import { PageHeader } from '../components/PageHeader'

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: '=',
  neq: '≠',
  gt: '>',
  lt: '<',
  gte: '≥',
  lte: '≤',
  contains: 'contains',
  notContains: 'excludes',
  startsWith: 'starts',
  endsWith: 'ends',
  isNull: 'empty',
  isNotNull: 'not empty',
  in: 'in',
  notIn: 'not in',
  between: 'between',
}

export function FilterValuePage() {
  const { page, close } = useCommandPalette()
  const { activeNode } = usePipeline()
  const { applyFilter } = useFilterApply({ onSuccess: close })

  const [value, setValue] = useState('')
  const [isApplying, setIsApplying] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Extract page data (may be undefined if not on filter page)
  const isValidPage = page.type === 'filter' && page.column && page.operator
  const pageColumn = page.type === 'filter' ? page.column : undefined
  const pageOperator = page.type === 'filter' ? page.operator : undefined

  const column = activeNode?.columns.find((c) => c.name === pageColumn)
  const columnType = column?.type ?? 'string'

  // Get current filter expression from active node (if it's a filter view)
  const currentFilterExpression = useMemo((): FilterExpression | undefined => {
    if (!activeNode || activeNode.type !== 'view') return undefined
    const view = activeNode as DataView
    if (view.operation.type !== 'filter') return undefined
    return (view.operation as FilterOperation).expression
  }, [activeNode])

  // Build preview SQL
  const previewSql = useMemo(() => {
    if (!isValidPage || !activeNode || !value.trim()) return null

    try {
      let parsedValue: unknown = value
      if (columnType === 'number') {
        parsedValue = parseFloat(value)
        if (isNaN(parsedValue as number)) return null
      } else if (columnType === 'boolean') {
        parsedValue = value.toLowerCase() === 'true'
      }

      const expr = createExpression([
        {
          column: pageColumn!,
          operator: pageOperator!,
          value: parsedValue,
        },
      ])
      const whereClause = buildFilterExpression(expr)
      return `SELECT * FROM ${escapeIdentifier(activeNode.tableName)} WHERE ${whereClause}`
    } catch {
      return null
    }
  }, [isValidPage, activeNode, value, pageColumn, pageOperator, columnType])

  // Use preview query hook (debounced) - show more rows since we have virtual scroll
  const preview = usePreviewQuery(previewSql, 100)

  // Focus input on mount
  useEffect(() => {
    if (isValidPage) {
      inputRef.current?.focus()
    }
  }, [isValidPage])

  // Early return for invalid page state (after hooks)
  if (!isValidPage) {
    return null
  }

  const handleApply = async () => {
    if (!value.trim() || isApplying) return

    setIsApplying(true)
    try {
      let parsedValue: unknown = value
      if (columnType === 'number') {
        parsedValue = parseFloat(value)
      } else if (columnType === 'boolean') {
        parsedValue = value.toLowerCase() === 'true'
      }

      const newFilter = {
        column: pageColumn!,
        operator: pageOperator!,
        value: parsedValue,
      }

      // Combine with existing filter expression if present (same as "Filter by value" action)
      const expression = currentFilterExpression
        ? addFilterToExpression(currentFilterExpression, newFilter)
        : createExpression([newFilter])

      await applyFilter({
        type: 'filter',
        expression,
      })
    } finally {
      setIsApplying(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && value.trim()) {
      e.preventDefault()
      handleApply()
    }
  }

  const operatorLabel = OPERATOR_LABELS[pageOperator!] ?? pageOperator

  return (
    <>
      <PageHeader title={operatorLabel} breadcrumbs={['Filter', pageColumn!]} />

      <div className="p-3 space-y-2">
        {/* Value input */}
        <input
          ref={inputRef}
          type={columnType === 'number' ? 'number' : 'text'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Enter ${columnType} value...`}
          className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
          autoComplete="off"
        />

        {/* Preview table */}
        {(value.trim() || preview.loading) && (
          <div className="[&>div]:mt-0">
            <PreviewDataGrid
              data={preview.data}
              columns={preview.columns}
              loading={preview.loading}
              error={preview.error}
              rowCount={preview.rowCount}
              height={240}
              enableSort={false}
            />
          </div>
        )}

        {/* Fallback message when no value */}
        {!value.trim() && !preview.loading && (
          <div className="text-xs text-[var(--color-text-muted)] py-2">Type to preview results</div>
        )}

        {/* Action hint */}
        <div className="flex justify-between items-center pt-2 border-t border-[var(--color-border)]">
          <span className="text-xs text-[var(--color-text-muted)]">Press Enter to apply</span>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded">
            {formatShortcut('↵')}
          </kbd>
        </div>
      </div>
    </>
  )
}
