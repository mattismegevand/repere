import { useCallback } from 'react'
import { usePipeline } from '@/lib/pipeline/usePipeline'
import { usePipelineStore } from '@/stores/pipelineStore'
import type { DataView, FilterOperation } from '@/types'

interface UseFilterApplyOptions {
  onSuccess?: () => void
}

/**
 * Hook for applying filter operations.
 * Always applies in place for fluid data exploration.
 * When view has children, captures a snapshot before editing so user can
 * branch later (when switching to canvas or doing another operation).
 */
export function useFilterApply({ onSuccess }: UseFilterApplyOptions = {}) {
  const { activeNode, applyOrReplaceOperation, getNodeChildren } = usePipeline()

  const applyFilter = useCallback(
    async (operation: FilterOperation): Promise<boolean> => {
      if (!activeNode) return false

      const { pendingBranchEdit, captureSnapshot, enterBranchingMode } = usePipelineStore.getState()
      const hasChildren = getNodeChildren(activeNode.id).length > 0
      const isFilterView = activeNode.type === 'view' && (activeNode as DataView).operation.type === 'filter'

      // If editing a filter view with children and no pending edit yet, capture snapshot
      if (hasChildren && isFilterView && !pendingBranchEdit) {
        const snapshot = captureSnapshot()
        enterBranchingMode(activeNode.id, snapshot)
      }

      // Always apply in place for fluid exploration
      await applyOrReplaceOperation(operation)
      onSuccess?.()
      return true
    },
    [activeNode, applyOrReplaceOperation, getNodeChildren, onSuccess]
  )

  return {
    applyFilter,
  }
}
