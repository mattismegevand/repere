import { beforeEach, describe, expect, it } from 'vitest'
import {
  selectSelectedCol,
  selectSelectedRow,
  useGridSelectionStore,
} from '@/components/data-grid/stores/gridSelectionStore'

describe('gridSelectionStore', () => {
  beforeEach(() => {
    useGridSelectionStore.setState({
      selection: null,
      isDragging: false,
      dragState: { isDragging: false, mode: 'cell', lastMouseY: 0, lastCol: 0 },
    })
  })

  describe('selectCell', () => {
    it('selects a single cell', () => {
      useGridSelectionStore.getState().selectCell(5, 3)
      const selection = useGridSelectionStore.getState().selection
      expect(selection).toMatchObject({
        mode: 'cell',
        anchorRow: 5,
        anchorCol: 3,
        focusRow: 5,
        focusCol: 3,
      })
    })

    it('replaces existing selection', () => {
      useGridSelectionStore.getState().selectCell(1, 1)
      useGridSelectionStore.getState().selectCell(10, 20)
      const selection = useGridSelectionStore.getState().selection
      expect(selection?.anchorRow).toBe(10)
      expect(selection?.anchorCol).toBe(20)
    })
  })

  describe('extendSelection', () => {
    it('creates new selection if none exists', () => {
      useGridSelectionStore.getState().extendSelection(5, 3)
      const selection = useGridSelectionStore.getState().selection
      expect(selection).not.toBeNull()
      expect(selection?.focusRow).toBe(5)
    })

    it('extends existing selection to new cell', () => {
      useGridSelectionStore.getState().selectCell(0, 0)
      useGridSelectionStore.getState().extendSelection(5, 5)
      const selection = useGridSelectionStore.getState().selection
      expect(selection).toMatchObject({
        mode: 'range',
        anchorRow: 0,
        anchorCol: 0,
        focusRow: 5,
        focusCol: 5,
      })
    })

    it('keeps anchor, updates focus', () => {
      useGridSelectionStore.getState().selectCell(2, 3)
      useGridSelectionStore.getState().extendSelection(10, 15)
      const selection = useGridSelectionStore.getState().selection
      expect(selection?.anchorRow).toBe(2)
      expect(selection?.anchorCol).toBe(3)
      expect(selection?.focusRow).toBe(10)
      expect(selection?.focusCol).toBe(15)
    })
  })

  describe('selectRow', () => {
    it('selects a single row', () => {
      useGridSelectionStore.getState().selectRow(5, false, 10)
      const selection = useGridSelectionStore.getState().selection
      expect(selection).toMatchObject({
        mode: 'row',
        anchorRow: 5,
        anchorCol: 0,
        focusRow: 5,
        focusCol: 9, // totalCols - 1
      })
    })

    it('extends row selection when extend is true', () => {
      useGridSelectionStore.getState().selectRow(2, false, 10)
      useGridSelectionStore.getState().selectRow(8, true, 10)
      const selection = useGridSelectionStore.getState().selection
      expect(selection?.anchorRow).toBe(2)
      expect(selection?.focusRow).toBe(8)
    })

    it('creates new selection when extend is true but no existing selection', () => {
      useGridSelectionStore.getState().selectRow(5, true, 10)
      const selection = useGridSelectionStore.getState().selection
      expect(selection?.anchorRow).toBe(5)
      expect(selection?.focusRow).toBe(5)
    })
  })

  describe('selectColumn', () => {
    it('selects a single column', () => {
      useGridSelectionStore.getState().selectColumn(3, false, 100)
      const selection = useGridSelectionStore.getState().selection
      expect(selection).toMatchObject({
        mode: 'column',
        anchorRow: 0,
        anchorCol: 3,
        focusRow: 99, // totalRows - 1
        focusCol: 3,
      })
    })

    it('extends column selection when extend is true', () => {
      useGridSelectionStore.getState().selectColumn(1, false, 100)
      useGridSelectionStore.getState().selectColumn(5, true, 100)
      const selection = useGridSelectionStore.getState().selection
      expect(selection?.anchorCol).toBe(1)
      expect(selection?.focusCol).toBe(5)
    })
  })

  describe('drag operations', () => {
    it('startDrag initializes drag state', () => {
      useGridSelectionStore.getState().startDrag(3, 4, 150)
      const state = useGridSelectionStore.getState()
      expect(state.isDragging).toBe(true)
      expect(state.dragState).toMatchObject({
        isDragging: true,
        mode: 'cell',
        lastMouseY: 150,
        lastCol: 4,
      })
      expect(state.selection).toMatchObject({
        mode: 'range',
        anchorRow: 3,
        anchorCol: 4,
      })
    })

    it('updateDrag updates selection during drag', () => {
      useGridSelectionStore.getState().startDrag(0, 0, 0)
      useGridSelectionStore.getState().updateDrag(5, 5, 200)
      const selection = useGridSelectionStore.getState().selection
      expect(selection?.focusRow).toBe(5)
      expect(selection?.focusCol).toBe(5)
    })

    it('updateDrag is no-op when not dragging', () => {
      useGridSelectionStore.getState().selectCell(0, 0)
      useGridSelectionStore.getState().updateDrag(5, 5, 200)
      const selection = useGridSelectionStore.getState().selection
      expect(selection?.focusRow).toBe(0)
    })

    it('startRowDrag initializes row drag', () => {
      useGridSelectionStore.getState().startRowDrag(5, 100, 10)
      const state = useGridSelectionStore.getState()
      expect(state.isDragging).toBe(true)
      expect(state.dragState.mode).toBe('row')
      expect(state.selection?.mode).toBe('row')
    })

    it('updateRowDrag updates row selection', () => {
      useGridSelectionStore.getState().startRowDrag(0, 0, 10)
      useGridSelectionStore.getState().updateRowDrag(5, 200, 10)
      const selection = useGridSelectionStore.getState().selection
      expect(selection?.focusRow).toBe(5)
    })

    it('updateRowDrag is no-op when not row dragging', () => {
      useGridSelectionStore.getState().startDrag(0, 0, 0) // cell mode
      useGridSelectionStore.getState().updateRowDrag(5, 200, 10)
      const selection = useGridSelectionStore.getState().selection
      expect(selection?.focusRow).toBe(0)
    })

    it('endDrag stops dragging', () => {
      useGridSelectionStore.getState().startDrag(0, 0, 0)
      useGridSelectionStore.getState().endDrag()
      expect(useGridSelectionStore.getState().isDragging).toBe(false)
      expect(useGridSelectionStore.getState().dragState.isDragging).toBe(false)
    })
  })

  describe('clearSelection', () => {
    it('clears the selection', () => {
      useGridSelectionStore.getState().selectCell(5, 5)
      useGridSelectionStore.getState().clearSelection()
      expect(useGridSelectionStore.getState().selection).toBeNull()
    })
  })

  describe('setSelection', () => {
    it('sets selection directly', () => {
      useGridSelectionStore.getState().setSelection({
        mode: 'range',
        anchorRow: 0,
        anchorCol: 0,
        focusRow: 10,
        focusCol: 10,
      })
      expect(useGridSelectionStore.getState().selection?.mode).toBe('range')
    })

    it('can set selection to null', () => {
      useGridSelectionStore.getState().selectCell(5, 5)
      useGridSelectionStore.getState().setSelection(null)
      expect(useGridSelectionStore.getState().selection).toBeNull()
    })
  })

  describe('getSelectionBounds', () => {
    it('returns null when no selection', () => {
      expect(useGridSelectionStore.getState().getSelectionBounds()).toBeNull()
    })

    it('returns bounds for single cell', () => {
      useGridSelectionStore.getState().selectCell(5, 3)
      const bounds = useGridSelectionStore.getState().getSelectionBounds()
      expect(bounds).toEqual({ minRow: 5, maxRow: 5, minCol: 3, maxCol: 3 })
    })

    it('returns correct bounds for range selection', () => {
      useGridSelectionStore.getState().selectCell(10, 5)
      useGridSelectionStore.getState().extendSelection(2, 15)
      const bounds = useGridSelectionStore.getState().getSelectionBounds()
      expect(bounds).toEqual({ minRow: 2, maxRow: 10, minCol: 5, maxCol: 15 })
    })

    it('handles inverted selection (focus before anchor)', () => {
      useGridSelectionStore.getState().selectCell(0, 0)
      useGridSelectionStore.getState().extendSelection(10, 10)
      const bounds = useGridSelectionStore.getState().getSelectionBounds()
      expect(bounds?.minRow).toBe(0)
      expect(bounds?.maxRow).toBe(10)
    })
  })

  describe('selectors', () => {
    it('selectSelectedRow returns null when no selection', () => {
      expect(selectSelectedRow(useGridSelectionStore.getState())).toBeNull()
    })

    it('selectSelectedRow returns focus row', () => {
      useGridSelectionStore.getState().selectCell(5, 3)
      expect(selectSelectedRow(useGridSelectionStore.getState())).toBe(5)
    })

    it('selectSelectedCol returns null when no selection', () => {
      expect(selectSelectedCol(useGridSelectionStore.getState())).toBeNull()
    })

    it('selectSelectedCol returns focus col', () => {
      useGridSelectionStore.getState().selectCell(5, 3)
      expect(selectSelectedCol(useGridSelectionStore.getState())).toBe(3)
    })
  })
})
