import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

export interface EditingCell {
  row: number
  col: number
  value: string
  isValid?: boolean
}

interface GridEditingState {
  editingCell: EditingCell | null
  // Callback for commit - registered by DataGrid
  commitEditCallback: (() => Promise<void>) | null
}

interface GridEditingActions {
  setEditingCell: (cell: EditingCell | null) => void
  updateEditValue: (value: string, isValid: boolean) => void
  cancelEdit: () => void
  clearEditingCell: () => void
  // Register the commit callback (called by DataGrid)
  setCommitEditCallback: (callback: (() => Promise<void>) | null) => void
  // Call the registered commit callback
  commitEdit: () => Promise<void>
}

export const useGridEditingStore = create<GridEditingState & GridEditingActions>()(
  subscribeWithSelector((set, get) => ({
    // State
    editingCell: null,
    commitEditCallback: null,

    // Actions
    setEditingCell: (cell) => {
      set({ editingCell: cell })
    },

    updateEditValue: (value, isValid) => {
      const { editingCell } = get()
      if (!editingCell) return
      set({ editingCell: { ...editingCell, value, isValid } })
    },

    cancelEdit: () => {
      set({ editingCell: null })
    },

    clearEditingCell: () => {
      set({ editingCell: null })
    },

    setCommitEditCallback: (callback) => {
      set({ commitEditCallback: callback })
    },

    commitEdit: async () => {
      const { commitEditCallback } = get()
      if (commitEditCallback) {
        await commitEditCallback()
      }
    },
  }))
)
