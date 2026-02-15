import Eye from 'lucide-react/dist/esm/icons/eye'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import Pencil from 'lucide-react/dist/esm/icons/pencil'
import { memo, useCallback } from 'react'
import { useNodePreview } from '@/lib/duckdb/useNodePreview'
import { getOperationUiMeta } from '@/lib/operations/registry'
import { openOperationEditor } from '@/lib/operations/ui'
import type { HydratedNode } from '@/lib/pipeline/hydration'
import { getOperationSummary } from '@/lib/pipeline/operation-summary'
import { useDialogStore } from '@/stores/dialogStore'
import { usePanelStore } from '@/stores/panelStore'
import { usePipelineStore } from '@/stores/pipelineStore'
import { usePivotStore } from '@/stores/pivotStore'
import type { JoinOperation } from '@/types'
import type { TypeBadgeColor } from './shared'
import { ExpandablePreview, NodeActionButton, NodeContent, NodeHeader, NodeShell } from './shared'

type HydratedView = Extract<HydratedNode, { type: 'view' }>

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
      {conditions ? <span className="ml-1 normal-case">: {conditions}</span> : null}
    </span>
  )
}

interface ViewNodeData {
  view: HydratedView
  isActive: boolean
  isSelected: boolean
  isPending?: boolean
  pendingParentNames?: string[]
  [key: string]: unknown
}

export const ViewNode = memo(function ViewNode({ data, selected }: { data: ViewNodeData; selected?: boolean }) {
  const { view, isActive, isSelected, isPending, pendingParentNames } = data
  const isNodeSelected = isSelected || selected
  const setFilterEditor = usePanelStore((s) => s.setFilterEditor)
  const openPivotPanel = usePanelStore((s) => s.openPivotPanel)
  const openSqlPanelForNode = usePanelStore((s) => s.openSqlPanelForNode)
  const setCanvasMode = usePanelStore((s) => s.setCanvasMode)
  const openDialog = useDialogStore((s) => s.openDialog)
  const loadFromOperation = usePivotStore((s) => s.loadFromOperation)
  const toggleNodeExpanded = usePipelineStore((s) => s.toggleNodeExpanded)

  const uiMeta = getOperationUiMeta(view.operation.type)
  const canEdit = uiMeta.editable && !isPending
  const isExpanded = !!view.isExpanded && !isPending && !view.isDisabled
  const canExpand = !isPending && !view.isDisabled && view.rowCount !== 0

  const preview = useNodePreview(view.tableName ?? '', isExpanded && !!view.tableName)

  const operationSummary =
    view.operation.type === 'join' ? (
      <JoinSummary operation={view.operation as JoinOperation} />
    ) : (
      getOperationSummary(view.operation)
    )

  const handleDragStart = (e: React.DragEvent) => {
    if (!view.tableName) return
    e.dataTransfer.setData('text/plain', view.tableName)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    openOperationEditor(view, uiMeta, {
      setFilterEditor,
      openPivotPanel,
      openSqlPanelForNode,
      openDialog,
      loadPivotFromOperation: loadFromOperation,
      setCanvasMode,
    })
  }

  const handleToggleExpand = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      toggleNodeExpanded(view.id)
    },
    [view.id, toggleNodeExpanded]
  )

  const formatCount = (n: number | null | undefined) => (typeof n === 'number' ? n.toLocaleString() : '...')

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
              {canEdit ? <NodeActionButton icon={Pencil} onClick={handleEdit} title="Edit operation" /> : null}
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
          <div className="text-gray-500">Disabled · {view.columns?.length ?? 0} cols</div>
        ) : view.hasError ? (
          <>
            <div className="text-red-500 truncate">{view.errorMessage || 'Error'}</div>
            <div className="text-[var(--color-text-secondary)]">{view.columns?.length ?? 0} cols</div>
          </>
        ) : (
          <>
            <div className="text-[var(--color-text-secondary)]">
              {formatCount(view.rowCount)} rows · {view.columns?.length ?? 0} cols
            </div>
            {view.tableName && (
              <div
                draggable
                onDragStart={handleDragStart}
                className="nodrag font-mono text-[10px] truncate text-[var(--color-text-muted)] cursor-grab hover:text-[var(--color-accent)] active:cursor-grabbing"
                title={`${view.tableName} (drag to SQL editor)`}
              >
                {view.tableName}
              </div>
            )}
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
