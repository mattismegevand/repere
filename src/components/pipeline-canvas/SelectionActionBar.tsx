import { GitMerge, Layers, Trash2 } from 'lucide-react'
import { usePipeline } from '@/lib/pipeline'
import { useDialogStore, usePipelineStore } from '@/stores'
import type { Dataset } from '@/types'

interface SelectionActionBarProps {
  selectedNodeIds: string[]
}

export function SelectionActionBar({ selectedNodeIds }: SelectionActionBarProps) {
  const nodes = usePipelineStore((s) => s.nodes)
  const getNodeChildren = usePipelineStore((s) => s.getNodeChildren)
  const { openDialog } = useDialogStore()
  const { deleteNode } = usePipeline()

  // Need at least 2 nodes for any action
  if (selectedNodeIds.length < 2) return null

  // Check if any non-data node (chart/export) is selected
  const hasNonDataNode = selectedNodeIds.some((id) => {
    const n = nodes[id]
    return n && (n.type === 'chart' || n.type === 'export')
  })

  // Get valid data nodes for Join/Union
  const dataNodeIds = selectedNodeIds.filter((id) => {
    const n = nodes[id]
    if (!n) return false
    if (n.type !== 'dataset' && n.type !== 'view') return false
    if (n.rowCount === 0) return false
    if (n.type === 'dataset' && (n as Dataset).isPlaceholder) return false
    return true
  })

  const handleJoin = () => {
    if (hasNonDataNode || dataNodeIds.length !== 2) return
    openDialog({ type: 'join', preSelectedLeft: dataNodeIds[0], preSelectedRight: dataNodeIds[1] })
  }

  const handleUnion = () => {
    if (hasNonDataNode || dataNodeIds.length < 2) return
    openDialog({ type: 'union', preSelectedNodes: dataNodeIds })
  }

  const handleDelete = () => {
    const hasAnyChildren = selectedNodeIds.some((id) => getNodeChildren(id).length > 0)
    if (hasAnyChildren) {
      openDialog({ type: 'deleteConfirm', nodeIds: selectedNodeIds })
    } else {
      for (const id of selectedNodeIds) {
        deleteNode(id)
      }
    }
  }

  const canJoin = !hasNonDataNode && dataNodeIds.length === 2
  const canUnion = !hasNonDataNode && dataNodeIds.length >= 2

  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20">
      <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg shadow-lg">
        <span className="text-xs text-[var(--color-text-muted)] mr-2">{selectedNodeIds.length} selected</span>
        <button
          onClick={handleJoin}
          disabled={!canJoin}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded
                     bg-orange-500/10 text-orange-600 dark:text-orange-400
                     hover:bg-orange-500/20 disabled:opacity-40 disabled:cursor-not-allowed
                     transition-colors"
          title={canJoin ? 'Join tables (J)' : 'Select exactly 2 data nodes to join'}
        >
          <GitMerge className="w-3.5 h-3.5" />
          Join
        </button>
        <button
          onClick={handleUnion}
          disabled={!canUnion}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded
                     bg-orange-500/10 text-orange-600 dark:text-orange-400
                     hover:bg-orange-500/20 disabled:opacity-40 disabled:cursor-not-allowed
                     transition-colors"
          title={canUnion ? 'Union tables (U)' : 'Select 2+ data nodes to union'}
        >
          <Layers className="w-3.5 h-3.5" />
          Union
        </button>
        <div className="w-px h-5 bg-[var(--color-border)] mx-1" />
        <button
          onClick={handleDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded
                     bg-red-500/10 text-red-600 dark:text-red-400
                     hover:bg-red-500/20 transition-colors"
          title="Delete selected nodes (Delete)"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>
      </div>
    </div>
  )
}
