import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { InlineTablePreview, PreviewSection } from '@/components/operation-dialogs/shared'
import { Button, DialogErrorBanner } from '@/components/ui'
import { RadixDialog } from '@/components/ui/RadixDialog'
import { useDuckDB } from '@/lib/duckdb'
import { useOperationDialog } from '@/lib/hooks/useOperationDialog'
import { usePipeline } from '@/lib/pipeline/usePipeline'
import { useDialogStore, usePipelineStore } from '@/stores'
import { isTerminalNode, type JoinCondition, type JoinOperation } from '@/types'

type JoinType = 'inner' | 'left' | 'right' | 'full' | 'cross'
type CombineMode = 'and' | 'or'

const PREVIEW_LIMIT = 100

const JOIN_TYPES: { type: JoinType; label: string; description: string }[] = [
  { type: 'inner', label: 'Inner', description: 'Only matching rows from both tables' },
  { type: 'left', label: 'Left', description: 'All rows from left, matching from right' },
  { type: 'right', label: 'Right', description: 'All rows from right, matching from left' },
  { type: 'full', label: 'Full', description: 'All rows from both tables' },
  { type: 'cross', label: 'Cross', description: 'Every combination of rows (cartesian product)' },
]

function JoinDiagram({ type, size = 32 }: { type: JoinType; size?: number }) {
  const r = size * 0.35
  const cx1 = size * 0.38
  const cx2 = size * 0.62
  const cy = size * 0.5

  const fillLeft = type === 'left' || type === 'full' ? 'var(--color-accent)' : 'transparent'
  const fillRight = type === 'right' || type === 'full' ? 'var(--color-accent)' : 'transparent'
  const fillIntersect =
    type === 'inner' || type === 'left' || type === 'right' || type === 'full' ? 'var(--color-accent)' : 'transparent'
  const fillBoth = type === 'cross' ? 'var(--color-accent)' : 'transparent'

  if (type === 'cross') {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={cx1} cy={cy} r={r} fill={fillBoth} opacity={0.6} stroke="currentColor" strokeWidth={1.5} />
        <circle cx={cx2} cy={cy} r={r} fill={fillBoth} opacity={0.6} stroke="currentColor" strokeWidth={1.5} />
      </svg>
    )
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <defs>
        <clipPath id={`left-only-${type}`}>
          <circle cx={cx1} cy={cy} r={r} />
        </clipPath>
        <clipPath id={`right-only-${type}`}>
          <circle cx={cx2} cy={cy} r={r} />
        </clipPath>
      </defs>
      {/* Left circle fill (excluding intersection for left-only) */}
      <circle cx={cx1} cy={cy} r={r} fill={fillLeft} opacity={0.4} />
      {/* Right circle fill (excluding intersection for right-only) */}
      <circle cx={cx2} cy={cy} r={r} fill={fillRight} opacity={0.4} />
      {/* Intersection highlight */}
      <circle cx={cx1} cy={cy} r={r} fill={fillIntersect} opacity={0.7} clipPath={`url(#right-only-${type})`} />
      {/* Outlines */}
      <circle cx={cx1} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={1.5} />
      <circle cx={cx2} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  )
}

const OPERATORS: { value: JoinCondition['operator']; label: string }[] = [
  { value: '=', label: '=' },
  { value: '!=', label: '≠' },
  { value: '>', label: '>' },
  { value: '<', label: '<' },
  { value: '>=', label: '≥' },
  { value: '<=', label: '≤' },
]

interface Props {
  onClose: () => void
}

function CollapsibleSection({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1 text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5 hover:text-[var(--color-text-primary)] transition-colors"
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {title}
      </button>
      {expanded && children}
    </div>
  )
}

function escapeIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

function buildJoinPreviewSql(
  leftTableName: string,
  rightTableName: string,
  joinType: JoinType,
  conditions: JoinCondition[],
  combineMode: CombineMode
): string {
  const joinTypeMap = {
    inner: 'INNER JOIN',
    left: 'LEFT JOIN',
    right: 'RIGHT JOIN',
    full: 'FULL OUTER JOIN',
    cross: 'CROSS JOIN',
  }

  const joinClause = joinTypeMap[joinType]
  const leftTable = escapeIdentifier(leftTableName)
  const rightTable = escapeIdentifier(rightTableName)

  // For cross join, no ON clause
  if (joinType === 'cross') {
    return `SELECT l.*, r.* FROM ${leftTable} l ${joinClause} ${rightTable} r`
  }

  // Build ON clause from conditions
  const separator = combineMode === 'and' ? ' AND ' : ' OR '
  const onConditions = conditions
    .map((c) => {
      const leftCol = `l.${escapeIdentifier(c.leftColumn)}`
      const rightCol = `r.${escapeIdentifier(c.rightColumn)}`

      if (c.operator === 'BETWEEN' && c.secondaryValue) {
        const rightCol2 = `r.${escapeIdentifier(c.secondaryValue)}`
        return `${leftCol} BETWEEN ${rightCol} AND ${rightCol2}`
      }

      return `${leftCol} ${c.operator} ${rightCol}`
    })
    .join(separator)

  return `SELECT l.*, r.* FROM ${leftTable} l ${joinClause} ${rightTable} r ON ${onConditions}`
}

export function JoinDialog({ onClose }: Props) {
  const { nodes } = usePipelineStore()
  const { activeDialog } = useDialogStore()
  const { applyJoin, openTab } = usePipeline()
  const { client } = useDuckDB()

  // Get pre-selected values from activeDialog
  const joinPreSelectedLeft = activeDialog?.type === 'join' ? activeDialog.preSelectedLeft : undefined
  const joinPreSelectedRight = activeDialog?.type === 'join' ? activeDialog.preSelectedRight : undefined

  // Get all nodes that can be joined (datasets and views, not terminal nodes)
  const nodeList = useMemo(() => Object.values(nodes).filter((n) => !isTerminalNode(n)), [nodes])

  // Initialize with pre-selected values or first two nodes
  const [leftId, setLeftId] = useState<string>(() => {
    if (joinPreSelectedLeft && nodes[joinPreSelectedLeft]) return joinPreSelectedLeft
    return nodeList[0]?.id || ''
  })

  const [rightId, setRightId] = useState<string>(() => {
    if (joinPreSelectedRight && nodes[joinPreSelectedRight]) return joinPreSelectedRight
    // Pick a different node than left
    const defaultRight = nodeList.find((n) => n.id !== leftId)
    return defaultRight?.id || nodeList[1]?.id || ''
  })

  const [conditions, setConditions] = useState<JoinCondition[]>([{ leftColumn: '', rightColumn: '', operator: '=' }])
  const [combineMode, setCombineMode] = useState<CombineMode>('and')
  const [joinType, setJoinType] = useState<JoinType>('inner')
  const [sourcePreviewExpanded, setSourcePreviewExpanded] = useState(true)
  const [resultPreviewExpanded, setResultPreviewExpanded] = useState(true)
  const { loading, error, execute } = useOperationDialog()

  const leftNode = nodes[leftId]
  const rightNode = nodes[rightId]

  const leftColumns = useMemo(() => leftNode?.columns ?? [], [leftNode])
  const rightColumns = useMemo(() => rightNode?.columns ?? [], [rightNode])

  // Auto-select first column when node changes
  useEffect(() => {
    if (
      leftColumns.length > 0 &&
      (!conditions[0]?.leftColumn || !leftColumns.find((c) => c.name === conditions[0].leftColumn))
    ) {
      setConditions((prev) => prev.map((c, i) => (i === 0 ? { ...c, leftColumn: leftColumns[0].name } : c)))
    }
  }, [leftColumns, conditions])

  useEffect(() => {
    if (
      rightColumns.length > 0 &&
      (!conditions[0]?.rightColumn || !rightColumns.find((c) => c.name === conditions[0].rightColumn))
    ) {
      setConditions((prev) => prev.map((c, i) => (i === 0 ? { ...c, rightColumn: rightColumns[0].name } : c)))
    }
  }, [rightColumns, conditions])

  // Build preview SQL
  const previewSql = useMemo(() => {
    if (!leftNode || !rightNode || leftId === rightId) return null
    if (!conditions.every((c) => c.leftColumn && c.rightColumn)) return null
    if (joinType !== 'cross' && conditions.some((c) => c.operator === 'BETWEEN' && !c.secondaryValue)) return null

    return buildJoinPreviewSql(leftNode.tableName, rightNode.tableName, joinType, conditions, combineMode)
  }, [leftNode, rightNode, leftId, rightId, joinType, conditions, combineMode])

  // Live preview state
  const [preview, setPreview] = useState<{
    columns: { name: string; type: string }[]
    rows: Record<string, unknown>[]
    totalCount: number
    loading: boolean
    error: string | null
  }>({ columns: [], rows: [], totalCount: 0, loading: false, error: null })

  // Run preview query
  useEffect(() => {
    if (!client || !previewSql) {
      setPreview({ columns: [], rows: [], totalCount: 0, loading: false, error: null })
      return
    }

    setPreview((p) => ({ ...p, loading: true, error: null }))

    const run = async () => {
      try {
        const query = `${previewSql} LIMIT ${PREVIEW_LIMIT}`
        const countQuery = `SELECT COUNT(*) as cnt FROM (${previewSql}) t`

        const [dataResult, countResult] = await Promise.all([
          client.query(query),
          client.query<{ cnt: bigint }>(countQuery),
        ])

        const rows = dataResult.rows
        const totalCount = Number(countResult.rows[0]?.cnt ?? 0)

        const cols = dataResult.columns.map((c) => ({
          name: c.name,
          type: c.duckdb_type,
        }))

        setPreview({ columns: cols, rows, totalCount, loading: false, error: null })
      } catch (err) {
        setPreview((p) => ({
          ...p,
          loading: false,
          error: err instanceof Error ? err.message : 'Query failed',
        }))
      }
    }

    run()
  }, [client, previewSql])

  const canJoin = leftId && rightId && leftId !== rightId && conditions.every((c) => c.leftColumn && c.rightColumn)

  const updateCondition = (index: number, updates: Partial<JoinCondition>) => {
    const newConditions = [...conditions]
    newConditions[index] = { ...newConditions[index], ...updates }
    setConditions(newConditions)
  }

  const addCondition = () => {
    setConditions([
      ...conditions,
      { leftColumn: leftColumns[0]?.name || '', rightColumn: rightColumns[0]?.name || '', operator: '=' },
    ])
  }

  const removeCondition = (index: number) => {
    if (conditions.length > 1) {
      setConditions(conditions.filter((_, i) => i !== index))
    }
  }

  const handleJoin = () => {
    if (!canJoin || !leftNode || !rightNode) return

    execute(async () => {
      const operation: JoinOperation = {
        type: 'join',
        joinType,
        rightSourceId: rightId,
        conditions,
        conditionCombineMode: combineMode,
      }

      const newView = await applyJoin(leftId, operation)
      if (newView) {
        openTab(newView.id)
      }
      onClose()
    })
  }

  if (nodeList.length < 2) {
    return (
      <RadixDialog
        open={true}
        onOpenChange={(open) => !open && onClose()}
        title="Join tables"
        footer={
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        }
      >
        <p className="text-xs text-[var(--color-text-secondary)]">Load at least two datasets to join them.</p>
      </RadixDialog>
    )
  }

  return (
    <RadixDialog
      open={true}
      onOpenChange={(open) => !open && onClose()}
      title="Join tables"
      width="4xl"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleJoin} disabled={!canJoin || loading}>
            {loading ? 'Joining...' : 'Join'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col h-full max-h-[calc(85vh-180px)] overflow-hidden">
        <DialogErrorBanner error={error} />

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Table selection dropdowns */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5">
                Left table
              </div>
              <select
                value={leftId}
                onChange={(e) => setLeftId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg outline-none focus:border-[var(--color-accent)] cursor-pointer"
              >
                {nodeList.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.name} ({node.columns.length} cols · {node.rowCount?.toLocaleString() ?? '?'} rows)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5">
                Right table
              </div>
              <select
                value={rightId}
                onChange={(e) => setRightId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg outline-none focus:border-[var(--color-accent)] cursor-pointer"
              >
                {nodeList.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.name} ({node.columns.length} cols · {node.rowCount?.toLocaleString() ?? '?'} rows)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Source table previews - collapsible */}
          <CollapsibleSection
            title="Source tables"
            expanded={sourcePreviewExpanded}
            onToggle={() => setSourcePreviewExpanded(!sourcePreviewExpanded)}
          >
            <div className="grid grid-cols-2 gap-4">
              <InlineTablePreview node={leftNode} height={140} />
              <InlineTablePreview node={rightNode} height={140} />
            </div>
          </CollapsibleSection>

          {/* Join configuration row */}
          <div className="flex items-start gap-6 py-3 border-y border-[var(--color-border)]">
            {/* Join type selection */}
            <div className="shrink-0">
              <div className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5">
                Join type
              </div>
              <div className="flex gap-1">
                {JOIN_TYPES.map(({ type, label, description }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setJoinType(type)}
                    className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md border transition-all ${
                      joinType === type
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                        : 'border-transparent hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
                    }`}
                    title={description}
                  >
                    <JoinDiagram type={type} size={24} />
                    <span className="text-[9px] font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Conditions */}
            {joinType !== 'cross' && (
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5">
                  <span>Conditions</span>
                  <button
                    type="button"
                    onClick={() => setCombineMode(combineMode === 'and' ? 'or' : 'and')}
                    className={`px-2 py-0.5 rounded-full font-semibold tracking-wide transition-colors normal-case ${
                      combineMode === 'and'
                        ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                        : 'bg-amber-500/15 text-amber-500'
                    }`}
                  >
                    {combineMode === 'and' ? 'ALL' : 'ANY'}
                  </button>
                </div>
                <div className="space-y-1.5">
                  {conditions.map((condition, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <select
                        value={condition.leftColumn}
                        onChange={(e) => updateCondition(index, { leftColumn: e.target.value })}
                        className="flex-1 min-w-0 px-2 py-1.5 text-xs bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded outline-none focus:border-[var(--color-accent)] cursor-pointer truncate"
                      >
                        {leftColumns.map((col) => (
                          <option key={col.name} value={col.name}>
                            {col.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={condition.operator}
                        onChange={(e) =>
                          updateCondition(index, { operator: e.target.value as JoinCondition['operator'] })
                        }
                        className="shrink-0 px-2 py-1.5 text-xs font-medium bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded outline-none focus:border-[var(--color-accent)] cursor-pointer text-[var(--color-accent)]"
                      >
                        {OPERATORS.map((op) => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={condition.rightColumn}
                        onChange={(e) => updateCondition(index, { rightColumn: e.target.value })}
                        className="flex-1 min-w-0 px-2 py-1.5 text-xs bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded outline-none focus:border-[var(--color-accent)] cursor-pointer truncate"
                      >
                        {rightColumns.map((col) => (
                          <option key={col.name} value={col.name}>
                            {col.name}
                          </option>
                        ))}
                      </select>
                      {conditions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCondition(index)}
                          className="shrink-0 p-1 text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addCondition}
                    className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Warning for same table */}
          {leftId === rightId && (
            <div className="text-[11px] text-[var(--color-warning)] bg-[var(--color-warning)]/10 p-2 rounded">
              Select two different tables to join.
            </div>
          )}

          {/* Result preview - collapsible */}
          <CollapsibleSection
            title={`Result${preview.totalCount > 0 ? ` (${preview.totalCount.toLocaleString()} rows)` : ''}`}
            expanded={resultPreviewExpanded}
            onToggle={() => setResultPreviewExpanded(!resultPreviewExpanded)}
          >
            <PreviewSection
              columns={preview.columns}
              rows={preview.rows}
              totalCount={preview.totalCount}
              loading={preview.loading}
              error={preview.error}
              limit={PREVIEW_LIMIT}
              hideHeader
            />
          </CollapsibleSection>
        </div>
      </div>
    </RadixDialog>
  )
}
