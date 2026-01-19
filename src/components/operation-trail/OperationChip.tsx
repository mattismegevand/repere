import { FileSpreadsheet } from 'lucide-react'
import { memo } from 'react'
import { getOperationUiMeta, type OperationUiMeta } from '@/lib/operations/registry'
import { getOperationSummary } from '@/lib/pipeline/operation-summary'
import { useDialogStore, usePanelStore, usePivotStore } from '@/stores'
import type { Dataset, DataView, JoinOperation, PivotOperation } from '@/types'

type ChipColor = OperationUiMeta['color']

const COLOR_CLASSES: Record<ChipColor, { base: string; active: string }> = {
  blue: {
    base: 'bg-[var(--color-chip-blue-bg)] text-[var(--color-chip-blue-text)] hover:bg-[var(--color-chip-blue-bg-active)]',
    active:
      'bg-[var(--color-chip-blue-bg-active)] text-[var(--color-chip-blue-text)] ring-1 ring-[var(--color-chip-blue-ring)]',
  },
  green: {
    base: 'bg-[var(--color-chip-green-bg)] text-[var(--color-chip-green-text)] hover:bg-[var(--color-chip-green-bg-active)]',
    active:
      'bg-[var(--color-chip-green-bg-active)] text-[var(--color-chip-green-text)] ring-1 ring-[var(--color-chip-green-ring)]',
  },
  purple: {
    base: 'bg-[var(--color-chip-purple-bg)] text-[var(--color-chip-purple-text)] hover:bg-[var(--color-chip-purple-bg-active)]',
    active:
      'bg-[var(--color-chip-purple-bg-active)] text-[var(--color-chip-purple-text)] ring-1 ring-[var(--color-chip-purple-ring)]',
  },
  orange: {
    base: 'bg-[var(--color-chip-orange-bg)] text-[var(--color-chip-orange-text)] hover:bg-[var(--color-chip-orange-bg-active)]',
    active:
      'bg-[var(--color-chip-orange-bg-active)] text-[var(--color-chip-orange-text)] ring-1 ring-[var(--color-chip-orange-ring)]',
  },
  cyan: {
    base: 'bg-[var(--color-chip-cyan-bg)] text-[var(--color-chip-cyan-text)] hover:bg-[var(--color-chip-cyan-bg-active)]',
    active:
      'bg-[var(--color-chip-cyan-bg-active)] text-[var(--color-chip-cyan-text)] ring-1 ring-[var(--color-chip-cyan-ring)]',
  },
  amber: {
    base: 'bg-[var(--color-chip-amber-bg)] text-[var(--color-chip-amber-text)] hover:bg-[var(--color-chip-amber-bg-active)]',
    active:
      'bg-[var(--color-chip-amber-bg-active)] text-[var(--color-chip-amber-text)] ring-1 ring-[var(--color-chip-amber-ring)]',
  },
  gray: {
    base: 'bg-[var(--color-chip-gray-bg)] text-[var(--color-chip-gray-text)] hover:bg-[var(--color-chip-gray-bg-active)]',
    active:
      'bg-[var(--color-chip-gray-bg-active)] text-[var(--color-chip-gray-text)] ring-1 ring-[var(--color-chip-gray-ring)]',
  },
}

function getJoinSummary(operation: JoinOperation): string {
  const type = operation.joinType.toUpperCase()
  const conditions = operation.conditions.map((c) => `${c.leftColumn}=${c.rightColumn}`).join(', ')
  return conditions ? `${type}: ${conditions}` : type
}

interface OperationChipProps {
  node: Dataset | DataView
  isActive: boolean
  onClick: () => void
}

export const OperationChip = memo(function OperationChip({ node, isActive, onClick }: OperationChipProps) {
  const { setFilterEditor, openPivotPanel, openSqlPanelForNode } = usePanelStore()
  const { openDialog } = useDialogStore()
  const { loadFromOperation } = usePivotStore()

  // Dataset chip
  if (node.type === 'dataset') {
    const dataset = node as Dataset
    const fileName = dataset.fileName.replace(/\.[^.]+$/, '')
    const colorClasses = isActive ? COLOR_CLASSES.gray.active : COLOR_CLASSES.gray.base

    return (
      <button
        onClick={onClick}
        className={`
          inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium
          transition-all cursor-pointer shrink-0
          ${colorClasses}
        `}
        title={dataset.fileName}
      >
        <FileSpreadsheet className="w-3 h-3" />
        <span className="max-w-[100px] truncate">{fileName}</span>
      </button>
    )
  }

  // View chip
  const view = node as DataView
  if (!view.operation) {
    return null // Guard against incomplete view nodes
  }
  const uiMeta = getOperationUiMeta(view.operation.type)
  const Icon = uiMeta.icon
  const colorClasses = isActive ? COLOR_CLASSES[uiMeta.color].active : COLOR_CLASSES[uiMeta.color].base
  const canEdit = uiMeta.editable

  // Get summary
  const summary =
    view.operation.type === 'join'
      ? getJoinSummary(view.operation as JoinOperation)
      : getOperationSummary(view.operation)

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (view.operation.type === 'filter') {
      setFilterEditor(true)
    } else if (view.operation.type === 'pivot') {
      loadFromOperation(view.operation as PivotOperation)
      const parentId = view.parentIds[0]
      if (parentId) {
        openPivotPanel(parentId, view.id)
      }
    } else if (view.operation.type === 'sql') {
      openSqlPanelForNode(view.id)
    } else if (view.operation.type === 'union') {
      openDialog({ type: 'union', preSelectedNodes: [], editingNodeId: view.id })
    }
  }

  return (
    <button
      onClick={onClick}
      className={`
        group inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium
        transition-all cursor-pointer shrink-0
        ${colorClasses}
      `}
      title={`${uiMeta.label}: ${summary}`}
    >
      <Icon className="w-3 h-3" />
      <span className="max-w-[120px] truncate">{summary || uiMeta.label}</span>
      {canEdit && isActive && (
        <span
          onClick={handleEdit}
          className="ml-0.5 px-1 py-0.5 text-[10px] opacity-60 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 rounded"
        >
          Edit
        </span>
      )}
    </button>
  )
})
