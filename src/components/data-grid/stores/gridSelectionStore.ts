import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

export type SelectionMode = 'cell' | 'range' | 'row' | 'column'

export interface Selection {
  mode: SelectionMode
  anchorRow: number
  anchorCol: number
  focusRow: number
  focusCol: number
}

export interface SelectionBounds {
  minRow: number
  maxRow: number
  minCol: number
  maxCol: number
}

export type DragMode = 'cell' | 'row'

export interface DragState {
  isDragging: boolean
  mode: DragMode
  lastMouseY: number
  lastCol: number
}

interface GridSelectionState {
  selection: Selection | null
  isDragging: boolean
  dragState: DragState
}

interface GridSelectionActions {
  selectCell: (row: number, col: number) => void
  extendSelection: (row: number, col: number) => void
  selectRow: (row: number, extend: boolean, totalCols: number) => void
  selectColumn: (col: number, extend: boolean, totalRows: number) => void
  startDrag: (row: number, col: number, mouseY: number) => void
  updateDrag: (row: number, col: number, mouseY: number) => void
  startRowDrag: (row: number, mouseY: number, totalCols: number) => void
  updateRowDrag: (row: number, mouseY: number, totalCols: number) => void
  endDrag: () => void
  clearSelection: () => void
  setSelection: (selection: Selection | null) => void
  getSelectionBounds: () => SelectionBounds | null
}

const initialDragState: DragState = {
  isDragging: false,
  mode: 'cell',
  lastMouseY: 0,
  lastCol: 0,
}

export const useGridSelectionStore = create<GridSelectionState & GridSelectionActions>()(
  subscribeWithSelector((set, get) => ({
    // State
    selection: null,
    isDragging: false,
    dragState: initialDragState,

    // Actions
    selectCell: (row, col) => {
      set({
        selection: {
          mode: 'cell',
          anchorRow: row,
          anchorCol: col,
          focusRow: row,
          focusCol: col,
        },
      })
    },

    extendSelection: (row, col) => {
      const { selection } = get()
      if (!selection) {
        get().selectCell(row, col)
        return
      }
      set({
        selection: {
          ...selection,
          mode: 'range',
          focusRow: row,
          focusCol: col,
        },
      })
    },

    selectRow: (row, extend, totalCols) => {
      const { selection } = get()
      if (extend && selection) {
        set({
          selection: {
            mode: 'row',
            anchorRow: selection.anchorRow,
            anchorCol: 0,
            focusRow: row,
            focusCol: totalCols - 1,
          },
        })
      } else {
        set({
          selection: {
            mode: 'row',
            anchorRow: row,
            anchorCol: 0,
            focusRow: row,
            focusCol: totalCols - 1,
          },
        })
      }
    },

    selectColumn: (col, extend, totalRows) => {
      const { selection } = get()
      if (extend && selection) {
        set({
          selection: {
            mode: 'column',
            anchorRow: 0,
            anchorCol: selection.anchorCol,
            focusRow: totalRows - 1,
            focusCol: col,
          },
        })
      } else {
        set({
          selection: {
            mode: 'column',
            anchorRow: 0,
            anchorCol: col,
            focusRow: totalRows - 1,
            focusCol: col,
          },
        })
      }
    },

    startDrag: (row, col, mouseY) => {
      set({
        isDragging: true,
        dragState: {
          isDragging: true,
          mode: 'cell',
          lastMouseY: mouseY,
          lastCol: col,
        },
        selection: {
          mode: 'range',
          anchorRow: row,
          anchorCol: col,
          focusRow: row,
          focusCol: col,
        },
      })
    },

    updateDrag: (row, col, mouseY) => {
      const { dragState, selection } = get()
      if (!dragState.isDragging || !selection) return
      set({
        dragState: {
          ...dragState,
          lastMouseY: mouseY,
          lastCol: col,
        },
        selection: {
          ...selection,
          mode: 'range',
          focusRow: row,
          focusCol: col,
        },
      })
    },

    startRowDrag: (row, mouseY, totalCols) => {
      set({
        isDragging: true,
        dragState: {
          isDragging: true,
          mode: 'row',
          lastMouseY: mouseY,
          lastCol: 0,
        },
        selection: {
          mode: 'row',
          anchorRow: row,
          anchorCol: 0,
          focusRow: row,
          focusCol: totalCols - 1,
        },
      })
    },

    updateRowDrag: (row, mouseY, totalCols) => {
      const { dragState, selection } = get()
      if (!dragState.isDragging || dragState.mode !== 'row' || !selection) return
      set({
        dragState: {
          ...dragState,
          lastMouseY: mouseY,
        },
        selection: {
          ...selection,
          mode: 'row',
          focusRow: row,
          focusCol: totalCols - 1,
        },
      })
    },

    endDrag: () => {
      set({
        isDragging: false,
        dragState: {
          ...get().dragState,
          isDragging: false,
        },
      })
    },

    clearSelection: () => {
      set({ selection: null })
    },

    setSelection: (selection) => {
      set({ selection })
    },

    getSelectionBounds: () => {
      const { selection } = get()
      if (!selection) return null
      return {
        minRow: Math.min(selection.anchorRow, selection.focusRow),
        maxRow: Math.max(selection.anchorRow, selection.focusRow),
        minCol: Math.min(selection.anchorCol, selection.focusCol),
        maxCol: Math.max(selection.anchorCol, selection.focusCol),
      }
    },
  }))
)

// Selectors for selected cell (primitives to avoid object reference issues)
export const selectSelectedRow = (state: GridSelectionState) => state.selection?.focusRow ?? null
export const selectSelectedCol = (state: GridSelectionState) => state.selection?.focusCol ?? null

// Row-specific selector factory - returns whether a specific row is selected
// This allows rows to only re-render when their selection status changes
export function selectIsRowInSelection(rowIndex: number) {
  return (state: GridSelectionState): boolean => {
    if (!state.selection) return false
    const minRow = Math.min(state.selection.anchorRow, state.selection.focusRow)
    const maxRow = Math.max(state.selection.anchorRow, state.selection.focusRow)
    return rowIndex >= minRow && rowIndex <= maxRow
  }
}
