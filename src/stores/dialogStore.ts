import { create } from 'zustand'

/**
 * Discriminated union for modal dialogs.
 * Only one modal dialog can be open at a time.
 */
export type DialogState =
  | { type: 'join'; preSelectedLeft?: string; preSelectedRight?: string }
  | { type: 'union'; preSelectedNodes?: string[]; editingNodeId?: string }
  | { type: 'addColumn' }
  | { type: 'loadSession' }
  | { type: 'shortcutCheatsheet' }
  | { type: 'shareUrl' }
  | { type: 'deleteConfirm'; nodeIds: string[] }
  | { type: 'connectionType'; sourceId: string; targetId: string }
  | { type: 'export'; sourceNodeId?: string }
  | { type: 'chartModal'; nodeId: string }
  | { type: 'branchDecision' }
  | { type: 'window'; column?: string }
  | { type: 'dashboardView'; nodeId: string }
  | { type: 'dashboardConfig'; nodeId: string }

interface DialogStoreState {
  activeDialog: DialogState | null
}

interface DialogStoreActions {
  openDialog: (dialog: DialogState) => void
  closeDialog: () => void
}

export const useDialogStore = create<DialogStoreState & DialogStoreActions>()((set) => ({
  activeDialog: null,
  openDialog: (dialog) => set({ activeDialog: dialog }),
  closeDialog: () => set({ activeDialog: null }),
}))
