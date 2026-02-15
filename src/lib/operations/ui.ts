import { getParents } from '@/lib/graph'
import type { DialogState } from '@/stores/dialogStore'
import { usePipelineStore } from '@/stores/pipelineStore'
import type { DataView, PivotOperation } from '@/types'
import type { OperationUiMeta } from './types'

export interface OperationEditorActions {
  setFilterEditor: (open: boolean) => void
  openPivotPanel: (sourceNodeId: string, editingNodeId?: string) => void
  openSqlPanelForNode: (nodeId: string) => void
  openDialog: (dialog: DialogState) => void
  loadPivotFromOperation: (operation: PivotOperation) => void
  setCanvasMode?: (enabled: boolean) => void
}

export function openOperationEditor(view: DataView, ui: OperationUiMeta, actions: OperationEditorActions): void {
  const editor = ui.editor
  if (!editor) return

  switch (editor.type) {
    case 'filter':
      actions.setFilterEditor(true)
      return

    case 'pivot': {
      actions.loadPivotFromOperation(view.operation as PivotOperation)
      const parentId = getParents(view.id, usePipelineStore.getState().edges)[0]
      if (parentId) {
        actions.setCanvasMode?.(false)
        actions.openPivotPanel(parentId, view.id)
      }
      return
    }

    case 'sql':
      actions.openSqlPanelForNode(view.id)
      return

    case 'union':
      actions.openDialog({ type: 'union', preSelectedNodes: [], editingNodeId: view.id })
      return

    default:
      return
  }
}
