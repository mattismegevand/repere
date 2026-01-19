import { RadixDialog } from '@/components/ui/RadixDialog'
import type { PipelineNode } from '@/types'

interface ConnectionTypeDialogProps {
  sourceNode: PipelineNode
  targetNode: PipelineNode
  onSelectJoin: () => void
  onSelectUnion: () => void
  onClose: () => void
}

export function ConnectionTypeDialog({
  sourceNode,
  targetNode,
  onSelectJoin,
  onSelectUnion,
  onClose,
}: ConnectionTypeDialogProps) {
  return (
    <RadixDialog open={true} onOpenChange={(open) => !open && onClose()} title="Connect tables">
      <p className="text-xs text-[var(--color-text-muted)] mb-4">
        How would you like to combine "{sourceNode.name}" and "{targetNode.name}"?
      </p>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onSelectJoin}
          className="p-4 border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-secondary)] hover:border-[var(--color-accent)] transition-colors text-left"
        >
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-orange-500" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="9" cy="12" r="6" stroke="currentColor" strokeWidth="2" fill="none" />
              <circle cx="15" cy="12" r="6" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
            <span className="font-medium text-sm">Join</span>
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">Combine columns based on matching values</p>
        </button>

        <button
          type="button"
          onClick={onSelectUnion}
          className="p-4 border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-secondary)] hover:border-[var(--color-accent)] transition-colors text-left"
        >
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-orange-500" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="4" y="4" width="16" height="6" rx="1" stroke="currentColor" strokeWidth="2" fill="none" />
              <rect x="4" y="14" width="16" height="6" rx="1" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
            <span className="font-medium text-sm">Union</span>
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">Stack rows vertically (same columns)</p>
        </button>
      </div>
    </RadixDialog>
  )
}
