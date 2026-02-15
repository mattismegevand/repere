import { Button } from '@/components/ui'
import { RadixDialog } from '@/components/ui/RadixDialog'
import { usePipelineStore } from '@/stores/pipelineStore'

interface Props {
  nodeIds: string[]
  onDelete: () => void
  onCancel: () => void
}

export function DeleteNodeDialog({ nodeIds, onDelete, onCancel }: Props) {
  const nodes = usePipelineStore((s) => s.nodes)
  const getNodeChildren = usePipelineStore((s) => s.getNodeChildren)
  const getNodeDescendants = usePipelineStore((s) => s.getNodeDescendants)

  if (nodeIds.length === 0) return null

  // For single node, show detailed info
  if (nodeIds.length === 1) {
    const nodeId = nodeIds[0]
    const node = nodes[nodeId]
    if (!node) return null

    const descendants = getNodeDescendants(nodeId)
    const hasChildren = getNodeChildren(nodeId).length > 0

    const getDescendantInfo = () => {
      if (descendants.length === 0) return null
      const views = descendants.filter((id) => nodes[id]?.type === 'view')
      if (views.length === 0) return null
      return `${views.length} derived view${views.length === 1 ? '' : 's'} will also be deleted`
    }

    const descendantInfo = getDescendantInfo()
    const nodeType = node.type === 'dataset' ? 'dataset' : 'view'

    return (
      <RadixDialog
        open={true}
        onOpenChange={(open) => !open && onCancel()}
        title={`Delete ${nodeType}?`}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={onDelete}>
              {hasChildren ? 'Delete all' : 'Delete'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-[var(--color-text-primary)]">
            Are you sure you want to delete <span className="font-medium">"{node.name}"</span>?
          </p>

          {descendantInfo && (
            <div className="p-2 bg-[var(--color-warning-bg)] text-[var(--color-warning)] text-xs rounded border border-[var(--color-warning)]/20">
              {descendantInfo}
            </div>
          )}
        </div>
      </RadixDialog>
    )
  }

  // For multiple nodes, show summary
  const allDescendants = new Set<string>()
  let totalWithChildren = 0

  for (const nodeId of nodeIds) {
    const children = getNodeChildren(nodeId)
    if (children.length > 0) {
      totalWithChildren++
    }
    for (const descId of getNodeDescendants(nodeId)) {
      // Don't count descendants that are also being deleted directly
      if (!nodeIds.includes(descId)) {
        allDescendants.add(descId)
      }
    }
  }

  const nodeNames = nodeIds
    .map((id) => nodes[id]?.name)
    .filter(Boolean)
    .slice(0, 3)

  const moreCount = nodeIds.length - nodeNames.length

  return (
    <RadixDialog
      open={true}
      onOpenChange={(open) => !open && onCancel()}
      title={`Delete ${nodeIds.length} nodes?`}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={onDelete}>
            Delete {totalWithChildren > 0 ? 'all' : `${nodeIds.length} nodes`}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-[var(--color-text-primary)]">Are you sure you want to delete these nodes?</p>

        <div className="p-2 bg-[var(--color-bg-secondary)] text-xs rounded border border-[var(--color-border)] space-y-1">
          {nodeNames.map((name) => (
            <div key={name} className="text-[var(--color-text-secondary)]">
              • {name}
            </div>
          ))}
          {moreCount > 0 ? <div className="text-[var(--color-text-muted)]">...and {moreCount} more</div> : null}
        </div>

        {allDescendants.size > 0 && (
          <div className="p-2 bg-[var(--color-warning-bg)] text-[var(--color-warning)] text-xs rounded border border-[var(--color-warning)]/20">
            {allDescendants.size} additional derived view{allDescendants.size === 1 ? '' : 's'} will also be deleted
          </div>
        )}
      </div>
    </RadixDialog>
  )
}
