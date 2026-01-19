import { GitBranch, Replace } from 'lucide-react'
import { Button } from '@/components/ui'
import { RadixDialog } from '@/components/ui/RadixDialog'
import { usePipeline } from '@/lib/pipeline/usePipeline'
import { usePipelineStore } from '@/stores/pipelineStore'
import type { DataView, FilterOperation } from '@/types'

interface Props {
  onComplete: () => void
}

export function BranchDecisionDialog({ onComplete }: Props) {
  const { pendingBranchEdit, exitBranchingMode, getNode, getNodeChildren } = usePipelineStore()
  const { createBranchFromSnapshot, applyOrReplaceOperation } = usePipeline()

  if (!pendingBranchEdit) return null

  const view = getNode(pendingBranchEdit.viewId) as DataView | undefined
  if (!view || view.type !== 'view') return null

  const childCount = getNodeChildren(view.id).length
  const pendingOperation = pendingBranchEdit.pendingOperation

  const handleKeepChanges = async () => {
    // User wants to keep the in-place edit, clear pending and proceed
    const opToApply = pendingOperation
    exitBranchingMode()

    // Apply the operation that was blocked (if any)
    if (opToApply) {
      await applyOrReplaceOperation(opToApply)
    }

    onComplete()
  }

  const handleCreateBranch = async () => {
    // Capture the current modified operation
    const modifiedOperation = view.operation as FilterOperation
    const opToApply = pendingOperation

    // Create branch: restore snapshot then create new sibling view
    await createBranchFromSnapshot(pendingBranchEdit.snapshotBefore, modifiedOperation)

    exitBranchingMode()

    // Apply the operation that was blocked (if any)
    if (opToApply) {
      await applyOrReplaceOperation(opToApply)
    }

    onComplete()
  }

  return (
    <RadixDialog
      open={true}
      onOpenChange={(open) => !open && handleKeepChanges()}
      title="Keep changes or create branch?"
      footer={
        <Button variant="secondary" size="sm" onClick={handleKeepChanges}>
          Cancel
        </Button>
      }
    >
      <p className="text-xs text-[var(--color-text-secondary)] mb-4">
        You modified a filter view that has {childCount} derived view{childCount > 1 ? 's' : ''}. How would you like to
        proceed?
      </p>

      <div className="space-y-2">
        <button
          onClick={handleKeepChanges}
          className="w-full p-3 text-left rounded-lg border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-secondary)] transition-colors group"
        >
          <div className="flex items-center gap-2 mb-1">
            <Replace className="w-4 h-4 text-[var(--color-accent)]" />
            <span className="text-xs font-medium text-[var(--color-text-primary)]">Keep changes</span>
          </div>
          <p className="text-[10px] text-[var(--color-text-muted)] pl-6">
            The filter was already updated. Child views now use the new filter.
          </p>
        </button>

        <button
          onClick={handleCreateBranch}
          className="w-full p-3 text-left rounded-lg border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-secondary)] transition-colors group"
        >
          <div className="flex items-center gap-2 mb-1">
            <GitBranch className="w-4 h-4 text-[var(--color-accent)]" />
            <span className="text-xs font-medium text-[var(--color-text-primary)]">Create branch</span>
          </div>
          <p className="text-[10px] text-[var(--color-text-muted)] pl-6">
            Restore original filter (keeping child views) and create a new branch with your changes.
          </p>
        </button>
      </div>
    </RadixDialog>
  )
}
