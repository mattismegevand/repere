import { Code, Plus, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ResultGrid } from '@/components/sql-panel/ResultGrid'
import { Button } from '@/components/ui'
import { RadixDialog } from '@/components/ui/RadixDialog'
import { useDuckDB } from '@/lib/duckdb'
import { formatSqlError } from '@/lib/duckdb/error-utils'
import { buildFilterExpression, escapeIdentifier } from '@/lib/duckdb/sql-builder'
import { formatFilterExpression, parseFilterText } from '@/lib/filter-parser'
import { simplifyExpression } from '@/lib/filter-utils'
import { formatDuckDBDate, formatDuckDBTimestampForInput, normalizeRowDates } from '@/lib/formatters'
import { useFilterApply } from '@/lib/hooks/useFilterApply'
import { usePipeline } from '@/lib/pipeline/usePipeline'
import { formatShortcut } from '@/lib/platform'
import { useThemeStore } from '@/stores'
import type {
  Column,
  DataView,
  Filter,
  FilterCondition,
  FilterExpression,
  FilterGroup,
  FilterOperation,
  FilterOperator,
} from '@/types'
import { FilterCodeEditor } from './FilterCodeEditor'

interface Props {
  onClose: () => void
}

const OPERATORS: Record<FilterOperator, { label: string; types: Column['type'][]; needsValue: boolean }> = {
  eq: { label: '=', types: ['string', 'number', 'boolean', 'date'], needsValue: true },
  neq: { label: '≠', types: ['string', 'number', 'boolean', 'date'], needsValue: true },
  gt: { label: '>', types: ['number', 'date'], needsValue: true },
  lt: { label: '<', types: ['number', 'date'], needsValue: true },
  gte: { label: '≥', types: ['number', 'date'], needsValue: true },
  lte: { label: '≤', types: ['number', 'date'], needsValue: true },
  contains: { label: 'contains', types: ['string'], needsValue: true },
  notContains: { label: '!contains', types: ['string'], needsValue: true },
  startsWith: { label: 'starts', types: ['string'], needsValue: true },
  endsWith: { label: 'ends', types: ['string'], needsValue: true },
  isNull: { label: 'is null', types: ['string', 'number', 'boolean', 'date', 'unknown'], needsValue: false },
  isNotNull: { label: 'not null', types: ['string', 'number', 'boolean', 'date', 'unknown'], needsValue: false },
  in: { label: 'in', types: ['string', 'number'], needsValue: true },
  notIn: { label: 'not in', types: ['string', 'number'], needsValue: true },
  between: { label: 'between', types: ['number', 'date'], needsValue: true },
}

let nodeIdCounter = 0
function generateId() {
  return `node_${++nodeIdCounter}`
}

type WithId<T> = T & { _id: string }

function attachIds(expr: FilterExpression): WithId<FilterExpression> {
  if (expr.type === 'condition') {
    return { ...expr, _id: generateId() } as WithId<FilterCondition>
  }
  return {
    ...expr,
    _id: generateId(),
    children: expr.children.map(attachIds),
  } as WithId<FilterGroup>
}

function stripIds(expr: WithId<FilterExpression>): FilterExpression {
  if (expr.type === 'condition') {
    const { _id, ...rest } = expr
    return rest as FilterCondition
  }
  const { _id, children, ...rest } = expr as WithId<FilterGroup>
  return {
    ...rest,
    children: children.map((c) => stripIds(c as WithId<FilterExpression>)),
  } as FilterGroup
}

function createEmptyCondition(columns: Column[]): WithId<FilterCondition> {
  const firstCol = columns[0]?.name ?? ''
  return {
    _id: generateId(),
    type: 'condition',
    filter: { column: firstCol, operator: 'eq', value: '' },
  }
}

function formatFilterValue(value: unknown, colType: Column['type']): string {
  if (value === null || value === undefined) return ''
  if (colType === 'date') {
    return formatDuckDBDate(value) ?? ''
  }
  if (colType === 'timestamp') {
    return formatDuckDBTimestampForInput(value) ?? ''
  }
  return String(value)
}

function getInputType(colType: Column['type']): string {
  if (colType === 'number') return 'number'
  if (colType === 'date') return 'date'
  if (colType === 'timestamp') return 'datetime-local'
  return 'text'
}

function normalizeFilterValue(value: string, colType: Column['type']): string {
  if (colType === 'timestamp' && value) {
    // Convert datetime-local format (YYYY-MM-DDTHH:mm) to SQL format (YYYY-MM-DD HH:mm:ss)
    return value.replace('T', ' ') + (value.length === 16 ? ':00' : '')
  }
  return value
}

function createEmptyGroup(): WithId<FilterGroup> {
  return { _id: generateId(), type: 'group', combineMode: 'and', children: [] }
}

// Compact condition row
function ConditionRow({
  condition,
  columns,
  onChange,
  onRemove,
}: {
  condition: WithId<FilterCondition>
  columns: Column[]
  onChange: (c: WithId<FilterCondition>) => void
  onRemove: () => void
}) {
  const filter = condition.filter
  const selectedColumn = columns.find((c) => c.name === filter.column)
  const colType = selectedColumn?.type ?? 'unknown'

  const availableOps = Object.entries(OPERATORS).filter(
    ([_, op]) => op.types.includes(colType) || op.types.includes('unknown')
  )

  const currentOp = OPERATORS[filter.operator]
  const needsValue = currentOp?.needsValue ?? true

  const updateFilter = (updates: Partial<Filter>) => {
    onChange({ ...condition, filter: { ...filter, ...updates } })
  }

  return (
    <div className="group flex items-center gap-1.5 py-1 px-2 -mx-2 rounded hover:bg-[var(--color-bg-secondary)] transition-colors text-[11px]">
      <select
        value={filter.column}
        onChange={(e) => updateFilter({ column: e.target.value })}
        className="bg-transparent text-[var(--color-text-primary)] outline-none cursor-pointer hover:text-[var(--color-accent)]"
      >
        {columns.map((col) => (
          <option key={col.name} value={col.name}>
            {col.name}
          </option>
        ))}
      </select>

      <select
        value={filter.operator}
        onChange={(e) => updateFilter({ operator: e.target.value as FilterOperator })}
        className="bg-transparent text-[var(--color-accent)] outline-none cursor-pointer"
      >
        {availableOps.map(([key, op]) => (
          <option key={key} value={key}>
            {op.label}
          </option>
        ))}
      </select>

      {needsValue && filter.operator === 'between' ? (
        <>
          <input
            type={getInputType(colType)}
            value={Array.isArray(filter.value) ? formatFilterValue(filter.value[0], colType) : ''}
            onChange={(e) => {
              const arr = Array.isArray(filter.value) ? [...filter.value] : ['', '']
              arr[0] = normalizeFilterValue(e.target.value, colType)
              updateFilter({ value: arr })
            }}
            placeholder="min"
            className="w-20 px-1.5 py-0.5 bg-[var(--color-bg-tertiary)] rounded border-none focus:ring-1 focus:ring-[var(--color-accent)] outline-none"
          />
          <span className="text-[var(--color-text-muted)]">–</span>
          <input
            type={getInputType(colType)}
            value={Array.isArray(filter.value) ? formatFilterValue(filter.value[1], colType) : ''}
            onChange={(e) => {
              const arr = Array.isArray(filter.value) ? [...filter.value] : ['', '']
              arr[1] = normalizeFilterValue(e.target.value, colType)
              updateFilter({ value: arr })
            }}
            placeholder="max"
            className="w-20 px-1.5 py-0.5 bg-[var(--color-bg-tertiary)] rounded border-none focus:ring-1 focus:ring-[var(--color-accent)] outline-none"
          />
        </>
      ) : needsValue && (filter.operator === 'in' || filter.operator === 'notIn') ? (
        <input
          type="text"
          value={Array.isArray(filter.value) ? filter.value.join(', ') : ((filter.value as string) ?? '')}
          onChange={(e) => updateFilter({ value: e.target.value.split(',').map((v) => v.trim()) })}
          placeholder="a, b, c"
          className="flex-1 px-1.5 py-0.5 bg-[var(--color-bg-tertiary)] rounded border-none focus:ring-1 focus:ring-[var(--color-accent)] outline-none min-w-[80px]"
        />
      ) : needsValue ? (
        <input
          type={getInputType(colType)}
          value={formatFilterValue(filter.value, colType)}
          onChange={(e) => updateFilter({ value: normalizeFilterValue(e.target.value, colType) })}
          placeholder="value"
          className="flex-1 px-1.5 py-0.5 bg-[var(--color-bg-tertiary)] rounded border-none focus:ring-1 focus:ring-[var(--color-accent)] outline-none min-w-[80px]"
        />
      ) : null}

      <button
        onClick={onRemove}
        className="p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-error)] opacity-0 group-hover:opacity-100 transition-all"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}

// Depth-based border colors for visual hierarchy
const DEPTH_COLORS = [
  'var(--color-border)',
  'var(--color-accent)',
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#06b6d4', // cyan
]

function getDepthColor(depth: number): string {
  return DEPTH_COLORS[depth % DEPTH_COLORS.length]
}

// Compact group editor
function GroupEditor({
  group,
  columns,
  onChange,
  onRemove,
  depth = 0,
}: {
  group: WithId<FilterGroup>
  columns: Column[]
  onChange: (g: WithId<FilterGroup>) => void
  onRemove?: () => void
  depth?: number
}) {
  const updateChild = (index: number, child: WithId<FilterExpression>) => {
    const newChildren = [...group.children]
    newChildren[index] = child
    onChange({ ...group, children: newChildren })
  }

  const removeChild = (index: number) => {
    onChange({ ...group, children: group.children.filter((_, i) => i !== index) })
  }

  const addCondition = () => {
    onChange({ ...group, children: [...group.children, createEmptyCondition(columns)] })
  }

  const addGroup = () => {
    const newGroup = createEmptyGroup()
    newGroup.combineMode = group.combineMode === 'and' ? 'or' : 'and'
    newGroup.children = [createEmptyCondition(columns)]
    onChange({ ...group, children: [...group.children, newGroup] })
  }

  const isAnd = group.combineMode === 'and'

  return (
    <div
      className={depth > 0 ? 'ml-3 pl-3 border-l-2' : ''}
      style={depth > 0 ? { borderColor: getDepthColor(depth) } : undefined}
    >
      {/* Group header */}
      <div className="flex items-center gap-2 text-[11px] mb-1.5">
        <span className="text-[var(--color-text-muted)]">match</span>
        <button
          onClick={() => onChange({ ...group, combineMode: isAnd ? 'or' : 'and' })}
          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide transition-colors ${
            isAnd ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]' : 'bg-amber-500/15 text-amber-500'
          }`}
        >
          {isAnd ? 'ALL' : 'ANY'}
        </button>
        {onRemove && (
          <button
            onClick={onRemove}
            className="p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Children */}
      <div>
        {group.children.map((child, index) => {
          const childWithId = child as WithId<FilterExpression>
          return childWithId.type === 'condition' ? (
            <ConditionRow
              key={childWithId._id}
              condition={childWithId as WithId<FilterCondition>}
              columns={columns}
              onChange={(c) => updateChild(index, c)}
              onRemove={() => removeChild(index)}
            />
          ) : (
            <div key={childWithId._id} className="mt-3 mb-2">
              <GroupEditor
                group={childWithId as WithId<FilterGroup>}
                columns={columns}
                onChange={(g) => updateChild(index, g)}
                onRemove={() => removeChild(index)}
                depth={depth + 1}
              />
            </div>
          )
        })}
      </div>

      {/* Add buttons */}
      <div className="flex gap-3 mt-2 text-[11px]">
        <button
          onClick={addCondition}
          className="flex items-center gap-1 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
        >
          <Plus className="w-3 h-3" />
          <span>condition</span>
        </button>
        <button
          onClick={addGroup}
          className="flex items-center gap-1 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
        >
          <Plus className="w-3 h-3" />
          <span>group</span>
        </button>
      </div>
    </div>
  )
}

const PREVIEW_LIMIT = 100
const PREVIEW_DEBOUNCE_MS = 300

export function FilterEditorDialog({ onClose }: Props) {
  const { activeNode } = usePipeline()
  const { applyFilter } = useFilterApply({ onSuccess: onClose })
  const { client } = useDuckDB()
  const theme = useThemeStore((s) => s.theme)
  const columns = activeNode?.columns ?? []

  // Get source table for preview queries
  const sourceTable = activeNode?.tableName

  const initialExpression = useMemo((): WithId<FilterGroup> => {
    if (activeNode?.type === 'view') {
      const view = activeNode as DataView
      if (view.operation.type === 'filter') {
        const op = view.operation as FilterOperation
        if (op.expression.type === 'group') {
          return attachIds(op.expression) as WithId<FilterGroup>
        }
        return {
          _id: generateId(),
          type: 'group',
          combineMode: 'and',
          children: [attachIds(op.expression)],
        }
      }
    }
    const group = createEmptyGroup()
    group.children = [createEmptyCondition(columns)]
    return group
  }, [activeNode, columns])

  const [expression, setExpression] = useState<WithId<FilterGroup>>(initialExpression)
  const [editorMode, setEditorMode] = useState<'visual' | 'code'>('visual')
  const [codeValue, setCodeValue] = useState('')

  // Sync visual -> code when switching to code mode
  useEffect(() => {
    if (editorMode === 'code') {
      const cleanExpr = stripIds(expression)
      setCodeValue(formatFilterExpression(cleanExpr))
    }
  }, [editorMode]) // Only when mode changes

  // Sync code -> visual when switching back to visual mode
  const syncFromCode = useCallback(() => {
    const result = parseFilterText(codeValue)
    if (result.success && result.expression) {
      // Wrap in group if it's a condition
      const expr =
        result.expression.type === 'condition'
          ? { type: 'group' as const, combineMode: 'and' as const, children: [result.expression] }
          : result.expression
      setExpression(attachIds(expr) as WithId<FilterGroup>)
      return true
    }
    return false
  }, [codeValue])

  // Handle mode toggle
  const handleModeToggle = useCallback(
    (mode: 'visual' | 'code') => {
      if (mode === editorMode) return

      if (mode === 'visual' && editorMode === 'code') {
        // Switching from code to visual - sync the code first
        if (!syncFromCode()) {
          // Parse error - don't switch
          return
        }
      }
      setEditorMode(mode)
    },
    [editorMode, syncFromCode]
  )

  // Keyboard shortcut: Cmd/Ctrl+E to toggle mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault()
        handleModeToggle(editorMode === 'visual' ? 'code' : 'visual')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [editorMode, handleModeToggle])

  // Live preview state
  const [preview, setPreview] = useState<{
    columns: { name: string; type: string }[]
    rows: Record<string, unknown>[]
    totalCount: number
    loading: boolean
    error: string | null
  }>({ columns: [], rows: [], totalCount: 0, loading: false, error: null })

  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Get current filter expression based on mode
  const getCurrentExpression = useCallback((): FilterExpression | null => {
    if (editorMode === 'code') {
      // Empty code = no filter (show all)
      if (!codeValue.trim()) return null

      const result = parseFilterText(codeValue)
      if (!result.success) {
        // Return a special marker for parse errors
        throw new Error(result.errors[0]?.message ?? 'Invalid filter syntax')
      }
      return result.expression ?? null
    }
    // Visual mode - use the expression state
    const cleanExpr = stripIds(expression)
    // Empty expression = no filter
    if (cleanExpr.type === 'group' && cleanExpr.children.length === 0) return null
    return cleanExpr
  }, [editorMode, codeValue, expression])

  // Run preview query when filter changes (debounced)
  useEffect(() => {
    if (!client || !sourceTable) return

    // Clear previous timeout
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current)
    }

    setPreview((p) => ({ ...p, loading: true, error: null }))

    previewTimeoutRef.current = setTimeout(async () => {
      try {
        let filterExpr: FilterExpression | null = null
        try {
          filterExpr = getCurrentExpression()
        } catch (err) {
          // Parse error in code mode
          setPreview((p) => ({
            ...p,
            loading: false,
            error: err instanceof Error ? err.message : 'Invalid filter',
          }))
          return
        }

        // Build query - no filter means show all rows
        const whereClause = filterExpr ? `WHERE ${buildFilterExpression(filterExpr)}` : ''
        const query = `SELECT * FROM ${escapeIdentifier(sourceTable)} ${whereClause} LIMIT ${PREVIEW_LIMIT}`
        const countQuery = `SELECT COUNT(*) as cnt FROM ${escapeIdentifier(sourceTable)} ${whereClause}`

        const [dataResult, countResult] = await Promise.all([
          client.query(query),
          client.query<{ cnt: bigint }>(countQuery),
        ])

        const totalCount = Number(countResult.rows[0]?.cnt ?? 0)

        // Normalize dates in preview rows
        const rows = dataResult.rows.map((r) => normalizeRowDates(r, columns))

        // Get column info from schema
        const cols = dataResult.columns.map((c) => ({
          name: c.name,
          type: c.duckdb_type,
        }))

        setPreview({ columns: cols, rows, totalCount, loading: false, error: null })
      } catch (err) {
        const rawError = err instanceof Error ? err.message : 'Query failed'
        setPreview((p) => ({
          ...p,
          loading: false,
          // Show raw errors in code mode for debugging, formatted in visual mode
          error: editorMode === 'code' ? rawError : formatSqlError(rawError, columns),
        }))
      }
    }, PREVIEW_DEBOUNCE_MS)

    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current)
      }
    }
  }, [codeValue, expression, editorMode, client, sourceTable, getCurrentExpression])

  // Handle apply from code editor
  const handleCodeApply = useCallback(
    async (expr: FilterExpression) => {
      const simplifiedExpr = simplifyExpression(expr)

      await applyFilter({
        type: 'filter',
        expression: simplifiedExpr,
      } as FilterOperation)
    },
    [applyFilter]
  )

  const handleApply = async () => {
    if (editorMode === 'code') {
      const result = parseFilterText(codeValue)
      if (result.success && result.expression) {
        await handleCodeApply(result.expression)
      }
      return
    }

    if (expression.children.length === 0) return

    const cleanExpr = stripIds(expression) as FilterGroup
    const simplifiedExpr = simplifyExpression(cleanExpr) as FilterGroup

    await applyFilter({
      type: 'filter',
      expression: simplifiedExpr,
    } as FilterOperation)
  }

  // Disable apply only if there's a syntax/parse error or no conditions
  // Note: 0 rows is a valid filter result, and SQL errors (like bad column) should block apply
  const isApplyDisabled =
    preview.error !== null ||
    (editorMode === 'visual' ? expression.children.length === 0 : !parseFilterText(codeValue).success)

  return (
    <RadixDialog
      open={true}
      onOpenChange={(open) => !open && onClose()}
      title="Filter"
      width="lg"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleApply} disabled={isApplyDisabled}>
            Apply
          </Button>
        </>
      }
    >
      {/* Mode toggle */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1 bg-[var(--color-bg-secondary)] rounded p-0.5">
          <button
            onClick={() => handleModeToggle('visual')}
            className={`px-2.5 py-1 text-[11px] rounded transition-colors ${
              editorMode === 'visual'
                ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            }`}
          >
            Visual
          </button>
          <button
            onClick={() => handleModeToggle('code')}
            className={`px-2.5 py-1 text-[11px] rounded transition-colors flex items-center gap-1 ${
              editorMode === 'code'
                ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            }`}
          >
            <Code className="w-3 h-3" />
            Code
          </button>
        </div>
        <span className="text-[10px] text-[var(--color-text-muted)]">{formatShortcut('⌘E')} to toggle</span>
      </div>

      {/* Editor content */}
      <div className="mb-3">
        {editorMode === 'visual' ? (
          <GroupEditor group={expression} columns={columns} onChange={setExpression} />
        ) : (
          <FilterCodeEditor
            value={codeValue}
            onChange={setCodeValue}
            onApply={handleCodeApply}
            columns={columns}
            theme={theme}
          />
        )}
      </div>

      {/* Live preview - shown in both modes */}
      <div className="border-t border-[var(--color-border)] pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
            Preview
          </span>
          {preview.loading && <span className="text-[10px] text-[var(--color-text-muted)]">Loading...</span>}
          {!preview.loading && !preview.error && (
            <span className="text-[10px] text-[var(--color-text-muted)]">
              {preview.totalCount.toLocaleString()} row{preview.totalCount !== 1 ? 's' : ''}
              {preview.totalCount > PREVIEW_LIMIT && ` (showing ${PREVIEW_LIMIT})`}
            </span>
          )}
        </div>

        {preview.error ? (
          <div className="text-[11px] text-[var(--color-error)] bg-[var(--color-error)]/10 p-2 rounded">
            {preview.error}
          </div>
        ) : preview.rows.length > 0 ? (
          <ResultGrid columns={preview.columns} rows={preview.rows} maxHeight={200} />
        ) : !preview.loading ? (
          <div className="text-[11px] text-[var(--color-text-muted)] p-3 text-center bg-[var(--color-bg-secondary)] rounded">
            No rows match this filter
          </div>
        ) : null}
      </div>
    </RadixDialog>
  )
}
