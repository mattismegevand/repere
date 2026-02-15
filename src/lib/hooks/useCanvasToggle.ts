import { useCallback } from 'react'
import { useDialogStore } from '@/stores/dialogStore'
import { usePanelStore } from '@/stores/panelStore'
import { usePipelineUiStore } from '@/stores/pipelineUiStore'

/**
 * Hook for toggling canvas mode with deferred branching check.
 * When switching from table to canvas with a pending branch edit,
 * shows a dialog for the user to decide what to do.
 */
export function useCanvasToggle() {
  const isCanvasMode = usePanelStore((s) => s.isCanvasMode)
  const setCanvasMode = usePanelStore((s) => s.setCanvasMode)
  const activeDialog = useDialogStore((s) => s.activeDialog)
  const openDialog = useDialogStore((s) => s.openDialog)
  const closeDialog = useDialogStore((s) => s.closeDialog)
  const pendingBranchEdit = usePipelineUiStore((s) => s.pendingBranchEdit)

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
