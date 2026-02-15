import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { Column } from '@/types'

interface CellContextMenuState {
  x: number
  y: number
  row: number
  col: number
  colName: string
  value: unknown
}

interface ColumnHeaderMenuState {
  x: number
  y: number
  colName: string
  colType: Column['type']
}

interface FilterEditState {
  column: string
  position?: { x: number; y: number }
}

interface ConfirmDeleteState {
  descendantCount: number
}

interface GridUIState {
  // Menus
  contextMenu: CellContextMenuState | null
  columnHeaderMenu: ColumnHeaderMenuState | null

  // Hover
  hoverColumn: string | null

  // Column drag state
  draggedColumn: string | null
  dropTargetColumn: string | null

  // Features
  showSparklines: boolean
  showColumnPicker: boolean

  // Modals/dialogs
  filterColumn: FilterEditState | null
  confirmDelete: ConfirmDeleteState | null
  imagePreviewUrl: string | null
}

interface GridUIActions {
  // Menu actions
  setContextMenu: (menu: CellContextMenuState | null) => void
  setColumnHeaderMenu: (menu: ColumnHeaderMenuState | null) => void
  closeAllMenus: () => void

  // Hover actions
  setHoverColumn: (column: string | null) => void

  // Column drag actions
  setDraggedColumn: (column: string | null) => void
  setDropTargetColumn: (column: string | null) => void

  // Feature toggles
  toggleSparklines: () => void
  setShowSparklines: (show: boolean) => void
  toggleColumnPicker: () => void
  setShowColumnPicker: (show: boolean) => void

  // Modal actions
  setFilterColumn: (state: FilterEditState | null) => void
  setConfirmDelete: (state: ConfirmDeleteState | null) => void
  setImagePreviewUrl: (url: string | null) => void
}

export const useGridUIStore = create<GridUIState & GridUIActions>()(
  subscribeWithSelector((set) => ({
    // State
    contextMenu: null,
    columnHeaderMenu: null,
    hoverColumn: null,
    draggedColumn: null,
    dropTargetColumn: null,
    showSparklines: true,
    showColumnPicker: false,
    filterColumn: null,
    confirmDelete: null,
    imagePreviewUrl: null,

    // Actions
    setContextMenu: (menu) => set({ contextMenu: menu }),
    setColumnHeaderMenu: (menu) => set({ columnHeaderMenu: menu }),
    closeAllMenus: () => set({ contextMenu: null, columnHeaderMenu: null }),

    setHoverColumn: (column) => set({ hoverColumn: column }),

    setDraggedColumn: (column) => set({ draggedColumn: column }),
    setDropTargetColumn: (column) => set({ dropTargetColumn: column }),

    toggleSparklines: () => set((state) => ({ showSparklines: !state.showSparklines })),
    setShowSparklines: (show) => set({ showSparklines: show }),
    toggleColumnPicker: () => set((state) => ({ showColumnPicker: !state.showColumnPicker })),
    setShowColumnPicker: (show) => set({ showColumnPicker: show }),

    setFilterColumn: (state) => set({ filterColumn: state }),
    setConfirmDelete: (state) => set({ confirmDelete: state }),
    setImagePreviewUrl: (url) => set({ imagePreviewUrl: url }),
  }))
)
