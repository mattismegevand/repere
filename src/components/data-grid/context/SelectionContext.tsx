import { useCallback, useMemo, useRef } from 'react'
import {
  type DragState,
  type Selection,
  type SelectionBounds,
  selectSelectedCol,
  selectSelectedRow,
  useGridSelectionStore,
} from '@/components/data-grid/stores'

export interface SelectionContextValue {
  selection: Selection | null
  selectedCell: { row: number; col: number } | null
  dragStateRef: React.RefObject<DragState>
  getSelectionBounds: () => SelectionBounds | null
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
}

/**
 * Hook that provides selection functionality.
 * Now reads from/writes to the gridSelectionStore instead of React Context.
 */
export function useSelectionContext(): SelectionContextValue {
  const selection = useGridSelectionStore((s) => s.selection)
  const selectedRow = useGridSelectionStore(selectSelectedRow)
  const selectedCol = useGridSelectionStore(selectSelectedCol)
  const selectedCell = useMemo(
    () => (selectedRow !== null && selectedCol !== null ? { row: selectedRow, col: selectedCol } : null),
    [selectedRow, selectedCol]
  )
  const dragState = useGridSelectionStore((s) => s.dragState)

  // Create a ref that always points to current dragState for imperative access
  const dragStateRef = useRef<DragState>(dragState)
  dragStateRef.current = dragState

  // Actions from store
  const storeSelectCell = useGridSelectionStore((s) => s.selectCell)
  const storeExtendSelection = useGridSelectionStore((s) => s.extendSelection)
  const storeSelectRow = useGridSelectionStore((s) => s.selectRow)
  const storeSelectColumn = useGridSelectionStore((s) => s.selectColumn)
  const storeStartDrag = useGridSelectionStore((s) => s.startDrag)
  const storeUpdateDrag = useGridSelectionStore((s) => s.updateDrag)
  const storeStartRowDrag = useGridSelectionStore((s) => s.startRowDrag)
  const storeUpdateRowDrag = useGridSelectionStore((s) => s.updateRowDrag)
  const storeEndDrag = useGridSelectionStore((s) => s.endDrag)
  const storeClearSelection = useGridSelectionStore((s) => s.clearSelection)
  const storeSetSelection = useGridSelectionStore((s) => s.setSelection)
  const storeGetSelectionBounds = useGridSelectionStore((s) => s.getSelectionBounds)

  // Wrap actions in useCallback for stable references
  const selectCell = useCallback((row: number, col: number) => storeSelectCell(row, col), [storeSelectCell])
  const extendSelection = useCallback(
    (row: number, col: number) => storeExtendSelection(row, col),
    [storeExtendSelection]
  )
  const selectRow = useCallback(
    (row: number, extend: boolean, totalCols: number) => storeSelectRow(row, extend, totalCols),
    [storeSelectRow]
  )
  const selectColumn = useCallback(
    (col: number, extend: boolean, totalRows: number) => storeSelectColumn(col, extend, totalRows),
    [storeSelectColumn]
  )
  const startDrag = useCallback(
    (row: number, col: number, mouseY: number) => storeStartDrag(row, col, mouseY),
    [storeStartDrag]
  )
  const updateDrag = useCallback(
    (row: number, col: number, mouseY: number) => storeUpdateDrag(row, col, mouseY),
    [storeUpdateDrag]
  )
  const startRowDrag = useCallback(
    (row: number, mouseY: number, totalCols: number) => storeStartRowDrag(row, mouseY, totalCols),
    [storeStartRowDrag]
  )
  const updateRowDrag = useCallback(
    (row: number, mouseY: number, totalCols: number) => storeUpdateRowDrag(row, mouseY, totalCols),
    [storeUpdateRowDrag]
  )
  const endDrag = useCallback(() => storeEndDrag(), [storeEndDrag])
  const clearSelection = useCallback(() => storeClearSelection(), [storeClearSelection])
  const setSelection = useCallback((sel: Selection | null) => storeSetSelection(sel), [storeSetSelection])
  const getSelectionBounds = useCallback(() => storeGetSelectionBounds(), [storeGetSelectionBounds])

  return {
    selection,
    selectedCell,
    dragStateRef,
    getSelectionBounds,
    selectCell,
    extendSelection,
    selectRow,
    selectColumn,
    startDrag,
    updateDrag,
    startRowDrag,
    updateRowDrag,
    endDrag,
    clearSelection,
    setSelection,
  }
}
