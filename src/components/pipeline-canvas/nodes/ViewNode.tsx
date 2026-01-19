import { Eye, EyeOff, Pencil } from 'lucide-react'
import { memo, useCallback } from 'react'
import { useNodePreview } from '@/lib/duckdb/useNodePreview'
import { getOperationUiMeta } from '@/lib/operations/registry'
import { getOperationSummary } from '@/lib/pipeline/operation-summary'
import { useDialogStore, usePanelStore, usePipelineStore, usePivotStore } from '@/stores'
import type { DataView, JoinOperation, PivotOperation } from '@/types'
import type { TypeBadgeColor } from './shared'
import { ExpandablePreview, NodeActionButton, NodeContent, NodeHeader, NodeShell } from './shared'

// Venn diagram SVG for join types
function JoinVenn({ type }: { type: JoinOperation['joinType'] }) {
  const size = 16
  const r = 5
  const cx1 = 5
  const cx2 = 11
  const cy = 8

  // Colors for different parts
  const leftOnly = type === 'left' || type === 'full' ? 'var(--color-accent)' : 'var(--color-bg-tertiary)'
  const rightOnly = type === 'right' || type === 'full' ? 'var(--color-accent)' : 'var(--color-bg-tertiary)'
  const intersection =
    type === 'inner' || type === 'left' || type === 'right' || type === 'full'
      ? 'var(--color-accent)'
      : 'var(--color-bg-tertiary)'

  if (type === 'cross') {
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="inline-block mr-1.5"
        aria-hidden="true"
      >
        <rect x="2" y="2" width="5" height="12" fill="var(--color-accent)" opacity="0.6" />
        <rect x="9" y="2" width="5" height="12" fill="var(--color-accent)" opacity="0.6" />
        <text x="8" y="11" fontSize="8" fill="var(--color-text-primary)" textAnchor="middle">
          ×
        </text>
      </svg>
    )
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="inline-block mr-1.5" aria-hidden="true">
      <defs>
        <clipPath id={`left-${type}`}>
          <circle cx={cx1} cy={cy} r={r} />
        </clipPath>
        <clipPath id={`right-${type}`}>
          <circle cx={cx2} cy={cy} r={r} />
        </clipPath>
      </defs>
      {/* Left circle background */}
      <circle cx={cx1} cy={cy} r={r} fill={leftOnly} opacity="0.6" />
      {/* Right circle background */}
      <circle cx={cx2} cy={cy} r={r} fill={rightOnly} opacity="0.6" />
      {/* Intersection */}
      <circle cx={cx2} cy={cy} r={r} fill={intersection} opacity="0.8" clipPath={`url(#left-${type})`} />
      {/* Outlines */}
      <circle cx={cx1} cy={cy} r={r} fill="none" stroke="var(--color-border)" strokeWidth="0.5" />
      <circle cx={cx2} cy={cy} r={r} fill="none" stroke="var(--color-border)" strokeWidth="0.5" />
    </svg>
  )
}

// Join summary with Venn diagram
function JoinSummary({ operation }: { operation: JoinOperation }) {
  const conditions = operation.conditions.map((c) => `${c.leftColumn}=${c.rightColumn}`).join(', ')
  return (
    <span className="flex items-center">
      <JoinVenn type={operation.joinType} />
      <span className="uppercase">{operation.joinType}</span>
      {conditions && <span className="ml-1 normal-case">: {conditions}</span>}
    </span>
  )
}

interface ViewNodeData {
  view: DataView
  isActive: boolean
  isSelected: boolean
  isPending?: boolean
  pendingParentNames?: string[]
  [key: string]: unknown
}

export const ViewNode = memo(function ViewNode({ data, selected }: { data: ViewNodeData; selected?: boolean }) {
  const { view, isActive, isSelected, isPending, pendingParentNames } = data
  const isNodeSelected = isSelected || selected
  const { setFilterEditor, openPivotPanel, openSqlPanelForNode, setCanvasMode } = usePanelStore()
  const { openDialog } = useDialogStore()
  const { loadFromOperation } = usePivotStore()
  const { toggleNodeExpanded } = usePipelineStore()

  const uiMeta = getOperationUiMeta(view.operation.type)
  const canEdit = uiMeta.editable && !isPending
  const isExpanded = !!view.isExpanded && !isPending && !view.isDisabled
  const canExpand = !isPending && !view.isDisabled && view.rowCount !== 0

  const preview = useNodePreview(view.tableName, isExpanded)

  const operationSummary =
    view.operation.type === 'join' ? (
      <JoinSummary operation={view.operation as JoinOperation} />
    ) : (
      getOperationSummary(view.operation)
    )

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', view.tableName)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (view.operation.type === 'filter') {
      setFilterEditor(true)
    } else if (view.operation.type === 'pivot') {
      loadFromOperation(view.operation as PivotOperation)
      const parentId = view.parentIds[0]
      if (parentId) {
        setCanvasMode(false)
        openPivotPanel(parentId, view.id)
      }
    } else if (view.operation.type === 'sql') {
      openSqlPanelForNode(view.id)
    } else if (view.operation.type === 'union') {
      openDialog({ type: 'union', preSelectedNodes: [], editingNodeId: view.id })
    }
  }

  const handleToggleExpand = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      toggleNodeExpanded(view.id)
    },
    [view.id, toggleNodeExpanded]
  )

  const formatCount = (n: number | null) => (n === null ? '...' : n.toLocaleString())

  return (
    <NodeShell
      isActive={isActive}
      isSelected={isNodeSelected}
      isDisabled={view.isDisabled}
      isPending={isPending}
      hasError={view.hasError}
      isExpanded={isExpanded}
    >
      <NodeHeader
        badge={uiMeta.label}
        badgeColor={uiMeta.color as TypeBadgeColor}
        name={view.name}
        subtitle={!isPending && !view.hasError ? operationSummary : undefined}
        actions={
          (canEdit || canExpand) && (
            <>
              {canEdit && <NodeActionButton icon={Pencil} onClick={handleEdit} title="Edit operation" />}
              {canExpand && (
                <NodeActionButton
                  icon={isExpanded ? EyeOff : Eye}
                  onClick={handleToggleExpand}
                  title={isExpanded ? 'Hide preview' : 'Show preview'}
                  ariaExpanded={isExpanded}
                  alwaysVisible={isExpanded}
                />
              )}
            </>
          )
        }
      />

      <NodeContent>
        {isPending ? (
          <>
            <div className="text-[var(--color-warning)]">Waiting for:</div>
            <div className="truncate text-[var(--color-text-secondary)]">
              {pendingParentNames?.join(', ') || 'parent datasets'}
            </div>
          </>
        ) : view.isDisabled ? (
          <div className="text-gray-500">Disabled · {view.columns.length} cols</div>
        ) : view.hasError ? (
          <>
            <div className="text-red-500 truncate">{view.errorMessage || 'Error'}</div>
            <div className="text-[var(--color-text-secondary)]">{view.columns.length} cols</div>
          </>
        ) : (
          <>
            <div className="text-[var(--color-text-secondary)]">
              {formatCount(view.rowCount)} rows · {view.columns.length} cols
            </div>
            <div
              draggable
              onDragStart={handleDragStart}
              className="nodrag font-mono text-[10px] truncate text-[var(--color-text-muted)] cursor-grab hover:text-[var(--color-accent)] active:cursor-grabbing"
              title={`${view.tableName} (drag to SQL editor)`}
            >
              {view.tableName}
            </div>
          </>
        )}
      </NodeContent>

      <ExpandablePreview
        nodeId={view.id}
        isExpanded={isExpanded}
        rows={preview.rows}
        columns={preview.columns}
        loading={preview.loading}
        error={preview.error}
      />
    </NodeShell>
  )
})
