import { useCallback } from 'react'
import { useDialogStore, usePanelStore } from '@/stores'
import { usePipelineStore } from '@/stores/pipelineStore'

/**
 * Hook for toggling canvas mode with deferred branching check.
 * When switching from table to canvas with a pending branch edit,
 * shows a dialog for the user to decide what to do.
 */
export function useCanvasToggle() {
  const { isCanvasMode, setCanvasMode } = usePanelStore()
  const { activeDialog, openDialog, closeDialog } = useDialogStore()
  const { pendingBranchEdit } = usePipelineStore()

  const toggleCanvasMode = useCallback(() => {
    // Only check when switching TO canvas mode (from table view)
    if (!isCanvasMode && pendingBranchEdit) {
      openDialog({ type: 'branchDecision' })
    } else {
      setCanvasMode(!isCanvasMode)
    }
  }, [isCanvasMode, pendingBranchEdit, setCanvasMode, openDialog])

  const handleBranchDecisionComplete = useCallback(() => {
    closeDialog()
    setCanvasMode(true)
  }, [setCanvasMode, closeDialog])

  return {
    isCanvasMode,
    toggleCanvasMode,
    showBranchDialog: activeDialog?.type === 'branchDecision',
    handleBranchDecisionComplete,
  }
}
