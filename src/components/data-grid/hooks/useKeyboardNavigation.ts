import { useCallback, useMemo, useRef, useState } from 'react'
import { isModKey } from '@/lib/platform'
import {
  type CommandPalettePage,
  type DialogState,
  selectSelectedCol,
  selectSelectedRow,
  useGridColumnStore,
  useGridEditingStore,
  useGridSelectionStore,
} from '@/stores'
import type { Column, PipelineNode, Sort } from '@/types'

interface VirtualScrollState {
  visibleRows: number
}

interface UseKeyboardNavigationParams {
  // Data (must be passed - from DuckDB/context)
  activeNode: PipelineNode | null
  activeNodeId: string | null
  visibleColumns: Column[]
  displayColumns: Column[] // Visual order: pinned first, then scrollable
  totalCount: number
  virtualScroll: VirtualScrollState
  currentSorts: Sort[]
  // Callbacks that need DataGrid context
  handleCopySelection: () => Promise<void>
  handleCopyRowCsv: () => void
  handleSortClick: (colName: string) => void
  invalidateCache: () => void
  // Refs
  searchInputRef: React.RefObject<HTMLInputElement | null>
  rowJumpInputRef: React.RefObject<HTMLInputElement | null>
  // UI actions (from stores, passed for convenience)
  setRowJumpValue: (value: string | null) => void
  setSearch: (search: string) => void
  openCommandPalette: (initialPage?: CommandPalettePage) => void
  setCanvasMode: (mode: boolean) => void
  openChartPanel: (
    nodeId: string,
    editingId?: string,
    position?: { x: number; y: number },
    defaultChartType?: string
  ) => void
  openDialog: (dialog: DialogState) => void
  // Pipeline operations
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

export function useKeyboardNavigation({
  activeNode,
  activeNodeId,
  visibleColumns,
  displayColumns,
  totalCount,
  virtualScroll,
  currentSorts,
  handleCopySelection,
  handleCopyRowCsv,
  handleSortClick,
  invalidateCache,
  searchInputRef,
  rowJumpInputRef,
  setRowJumpValue,
  setSearch,
  openCommandPalette,
  setCanvasMode,
  openChartPanel,
  openDialog,
  undo,
  redo,
  canUndo,
  canRedo,
}: UseKeyboardNavigationParams) {
  // Selection state and actions from store
  const selection = useGridSelectionStore((s) => s.selection)
  const selectedRow = useGridSelectionStore(selectSelectedRow)
  const selectedCol = useGridSelectionStore(selectSelectedCol)
  const selectedCell = useMemo(
    () => (selectedRow !== null && selectedCol !== null ? { row: selectedRow, col: selectedCol } : null),
    [selectedRow, selectedCol]
  )
  const selectCell = useGridSelectionStore((s) => s.selectCell)
  const extendSelection = useGridSelectionStore((s) => s.extendSelection)
  const selectRow = useGridSelectionStore((s) => s.selectRow)
  const selectColumn = useGridSelectionStore((s) => s.selectColumn)
  const setSelection = useGridSelectionStore((s) => s.setSelection)
  const clearSelection = useGridSelectionStore((s) => s.clearSelection)

  // Editing state and actions from store
  const editingCell = useGridEditingStore((s) => s.editingCell)
  const setEditingCell = useGridEditingStore((s) => s.setEditingCell)
  const cancelEdit = useGridEditingStore((s) => s.cancelEdit)

  // Column actions from store
  const toggleColumnPin = useGridColumnStore((s) => s.toggleColumnPin)
  const toggleColumnVisibility = useGridColumnStore((s) => s.toggleColumnVisibility)

  // Vim state
  const [keyBuffer, setKeyBuffer] = useState<string[]>([])
  const [visualMode, setVisualMode] = useState(false)
  const keyBufferTimeoutRef = useRef<number | null>(null)

  // Helper to start editing (needs visibleColumns for column type)
  const startEdit = useCallback(
    (row: number, col: number, initialValue?: string) => {
      const column = visibleColumns[col]
      if (!column) return
      // Just set the editing cell - the actual value formatting is handled by the cell
      setEditingCell({ row, col, value: initialValue ?? '', isValid: true })
    },
    [visibleColumns, setEditingCell]
  )

  const clearKeyBuffer = useCallback(() => {
    if (keyBufferTimeoutRef.current) {
      clearTimeout(keyBufferTimeoutRef.current)
      keyBufferTimeoutRef.current = null
    }
    setKeyBuffer([])
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!activeNode) return

      const colCount = visibleColumns.length
      const rowCount = totalCount

      // Check if focus is on an input element
      const activeEl = document.activeElement
      const isInputFocused =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl?.getAttribute('contenteditable') === 'true'
      const isNormalMode = !editingCell && !isInputFocused

      // Ctrl/Cmd+F: Focus search input
      if (isModKey(e) && e.key === 'f') {
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
        return
      }

      // Ctrl/Cmd+V: Paste - start editing selected cell with clipboard content
      if (isModKey(e) && e.key === 'v' && selectedCell && !editingCell) {
        e.preventDefault()
        navigator.clipboard.readText().then((text) => {
          if (text) {
            startEdit(selectedCell.row, selectedCell.col, text)
          }
        })
        return
      }

      // Ctrl/Cmd+C: Copy selection
      if (isModKey(e) && e.key === 'c' && !e.shiftKey) {
        if (selection && selectedCell) {
          e.preventDefault()
          handleCopySelection()
          // Restore single-cell selection at current position
          selectCell(selectedCell.row, selectedCell.col)
        }
        return
      }

      // Ctrl/Cmd+Shift+C: Copy entire row as CSV
      if (isModKey(e) && e.key === 'C' && e.shiftKey && selectedCell && activeNode) {
        e.preventDefault()
        handleCopyRowCsv()
        // Restore single-cell selection at current position
        selectCell(selectedCell.row, selectedCell.col)
        return
      }

      // Ctrl+r: Redo
      if (isModKey(e) && e.key === 'r' && canRedo) {
        e.preventDefault()
        redo()
        return
      }

      // Enter or F2: Start editing
      if ((e.key === 'Enter' || e.key === 'F2') && selectedCell && !editingCell) {
        e.preventDefault()
        startEdit(selectedCell.row, selectedCell.col)
        return
      }

      // Shift+Space: Select entire row
      if (e.key === ' ' && e.shiftKey && !isModKey(e) && selectedCell) {
        e.preventDefault()
        selectRow(selectedCell.row, false, visibleColumns.length)
        return
      }

      // Ctrl/Cmd+Space: Select entire column
      if (e.key === ' ' && isModKey(e) && !e.shiftKey && selectedCell) {
        e.preventDefault()
        selectColumn(selectedCell.col, false, totalCount)
        return
      }

      // Ctrl/Cmd+A: Select all
      if (e.key === 'a' && isModKey(e) && !e.shiftKey) {
        e.preventDefault()
        setSelection({
          mode: 'range',
          anchorRow: 0,
          anchorCol: 0,
          focusRow: totalCount - 1,
          focusCol: visibleColumns.length - 1,
        })
        return
      }

      // Ctrl+d: Half-page down
      if (e.key === 'd' && e.ctrlKey && !e.metaKey && !e.shiftKey && selectedCell) {
        e.preventDefault()
        const halfPage = Math.floor(virtualScroll.visibleRows / 2)
        const newRow = Math.min(totalCount - 1, selectedCell.row + halfPage)
        selectCell(newRow, selectedCell.col)
        return
      }

      // Ctrl+u: Half-page up
      if (e.key === 'u' && e.ctrlKey && !e.metaKey && !e.shiftKey && selectedCell) {
        e.preventDefault()
        const halfPage = Math.floor(virtualScroll.visibleRows / 2)
        const newRow = Math.max(0, selectedCell.row - halfPage)
        selectCell(newRow, selectedCell.col)
        return
      }

      // === Vim-style shortcuts (only in normal mode) ===
      if (isNormalMode && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const key = e.key

        // / : Focus search (vim-style)
        if (key === '/') {
          e.preventDefault()
          searchInputRef.current?.focus()
          searchInputRef.current?.select()
          return
        }

        // Handle key sequences (gg, yy)
        const newBuffer = [...keyBuffer, key]

        // gg: Jump to first row (stay on same column)
        if (newBuffer.length >= 2 && newBuffer[newBuffer.length - 2] === 'g' && key === 'g') {
          e.preventDefault()
          clearKeyBuffer()
          selectCell(0, selectedCell?.col ?? 0)
          return
        }

        // G (Shift+g): Jump to last row (stay on same column)
        if (key === 'G') {
          e.preventDefault()
          clearKeyBuffer()
          selectCell(rowCount - 1, selectedCell?.col ?? 0)
          return
        }

        // 0: Jump to first column (visual order - first displayed column)
        if (key === '0' && selectedCell) {
          e.preventDefault()
          clearKeyBuffer()
          const firstColName = displayColumns[0]?.name
          const firstCol = visibleColumns.findIndex((c) => c.name === firstColName)
          selectCell(selectedCell.row, firstCol !== -1 ? firstCol : 0)
          return
        }

        // $: Jump to last column (visual order - last displayed column)
        if (key === '$') {
          e.preventDefault()
          clearKeyBuffer()
          const lastColName = displayColumns[displayColumns.length - 1]?.name
          const lastCol = visibleColumns.findIndex((c) => c.name === lastColName)
          selectCell(selectedCell?.row ?? 0, lastCol !== -1 ? lastCol : colCount - 1)
          return
        }

        // Column operations (require a selected cell)
        if (selectedCell) {
          const column = visibleColumns[selectedCell.col]
          if (column) {
            // s: Sort column ascending (toggle if already sorted)
            if (key === 's') {
              e.preventDefault()
              clearKeyBuffer()
              handleSortClick(column.name)
              return
            }

            // S: Sort column descending
            if (key === 'S') {
              e.preventDefault()
              clearKeyBuffer()
              const existingSort = currentSorts.find((sort) => sort.column === column.name)
              if (!existingSort) {
                handleSortClick(column.name)
                setTimeout(() => handleSortClick(column.name), 0)
              } else if (existingSort.direction === 'asc') {
                handleSortClick(column.name)
              }
              return
            }

            // f: Open filter in command palette for column
            if (key === 'f') {
              e.preventDefault()
              clearKeyBuffer()
              openCommandPalette({ type: 'filter', column: column.name })
              return
            }

            // p: Pin/unpin column
            if (key === 'p') {
              e.preventDefault()
              clearKeyBuffer()
              toggleColumnPin(column.name)
              return
            }

            // H: Hide column
            if (key === 'H') {
              e.preventDefault()
              clearKeyBuffer()
              toggleColumnVisibility(column.name)
              return
            }
          }
        }

        // hjkl navigation
        if (['h', 'j', 'k', 'l'].includes(key)) {
          e.preventDefault()
          clearKeyBuffer()
          const currentFocus = selectedCell ?? { row: 0, col: 0 }
          let { row, col } = currentFocus

          switch (key) {
            case 'h':
            case 'l': {
              // For left/right navigation, use displayColumns (visual order)
              // to properly handle pinned columns appearing first
              const currentColName = visibleColumns[col]?.name
              const displayIndex = displayColumns.findIndex((c) => c.name === currentColName)
              let newDisplayIndex = displayIndex
              if (key === 'h') {
                newDisplayIndex = Math.max(0, displayIndex - 1)
              } else {
                newDisplayIndex = Math.min(displayColumns.length - 1, displayIndex + 1)
              }
              // Convert back to visibleColumns index
              const newColName = displayColumns[newDisplayIndex]?.name
              col = visibleColumns.findIndex((c) => c.name === newColName)
              if (col === -1) col = currentFocus.col // fallback
              break
            }
            case 'j':
              row = Math.min(rowCount - 1, row + 1)
              break
            case 'k':
              row = Math.max(0, row - 1)
              break
          }

          if ((e.shiftKey || visualMode) && selection) {
            extendSelection(row, col)
          } else {
            selectCell(row, col)
          }
          return
        }

        // w: Next column (word-like navigation) - uses visual order
        if (key === 'w' && selectedCell) {
          e.preventDefault()
          clearKeyBuffer()
          const currentColName = visibleColumns[selectedCell.col]?.name
          const displayIndex = displayColumns.findIndex((c) => c.name === currentColName)
          const newDisplayIndex = Math.min(displayColumns.length - 1, displayIndex + 1)
          const newColName = displayColumns[newDisplayIndex]?.name
          const newCol = visibleColumns.findIndex((c) => c.name === newColName)
          selectCell(selectedCell.row, newCol !== -1 ? newCol : selectedCell.col)
          return
        }

        // b: Previous column (word-like navigation) - uses visual order
        if (key === 'b' && selectedCell) {
          e.preventDefault()
          clearKeyBuffer()
          const currentColName = visibleColumns[selectedCell.col]?.name
          const displayIndex = displayColumns.findIndex((c) => c.name === currentColName)
          const newDisplayIndex = Math.max(0, displayIndex - 1)
          const newColName = displayColumns[newDisplayIndex]?.name
          const newCol = visibleColumns.findIndex((c) => c.name === newColName)
          selectCell(selectedCell.row, newCol !== -1 ? newCol : selectedCell.col)
          return
        }

        // r: Refresh data
        if (key === 'r') {
          e.preventDefault()
          clearKeyBuffer()
          invalidateCache()
          return
        }

        // x: Export view
        if (key === 'x' && activeNodeId) {
          e.preventDefault()
          clearKeyBuffer()
          openDialog({ type: 'export', sourceNodeId: activeNodeId })
          return
        }

        // yy: Copy entire row as CSV
        if (newBuffer.length >= 2 && newBuffer[newBuffer.length - 2] === 'y' && key === 'y' && selectedCell) {
          e.preventDefault()
          clearKeyBuffer()
          handleCopyRowCsv()
          // Restore single-cell selection at current position
          selectCell(selectedCell.row, selectedCell.col)
          return
        }

        // e: Edit cell
        if (key === 'e' && selectedCell) {
          e.preventDefault()
          clearKeyBuffer()
          startEdit(selectedCell.row, selectedCell.col)
          return
        }

        // c: Open chart panel (switches to canvas view)
        if (key === 'c' && activeNodeId) {
          e.preventDefault()
          clearKeyBuffer()
          setCanvasMode(true)
          // Use setTimeout to let canvas render, then open chart popover at center
          setTimeout(() => {
            openChartPanel(activeNodeId, undefined, { x: window.innerWidth / 2, y: 100 })
          }, 50)
          return
        }

        // u: Undo
        if (key === 'u' && canUndo) {
          e.preventDefault()
          clearKeyBuffer()
          undo()
          return
        }

        // :: Open row jump prompt (vim-style :number)
        if (key === ':') {
          e.preventDefault()
          clearKeyBuffer()
          setRowJumpValue('')
          setTimeout(() => rowJumpInputRef.current?.focus(), 0)
          return
        }

        // ?: Show keyboard shortcuts
        if (key === '?') {
          e.preventDefault()
          clearKeyBuffer()
          openDialog({ type: 'shortcutCheatsheet' })
          return
        }

        // v: Toggle visual selection mode
        if (key === 'v' && selectedCell) {
          e.preventDefault()
          clearKeyBuffer()
          if (!visualMode) {
            setVisualMode(true)
            setSelection({
              mode: 'range',
              anchorRow: selectedCell.row,
              anchorCol: selectedCell.col,
              focusRow: selectedCell.row,
              focusCol: selectedCell.col,
            })
          } else {
            setVisualMode(false)
          }
          return
        }

        // V: Select entire row (keep cursor in same column)
        if (key === 'V' && selectedCell) {
          e.preventDefault()
          clearKeyBuffer()
          // Use row mode but keep focusCol at current position
          setSelection({
            mode: 'row',
            anchorRow: selectedCell.row,
            anchorCol: selectedCell.col,
            focusRow: selectedCell.row,
            focusCol: selectedCell.col,
          })
          return
        }

        // y: Copy selection in visual mode (yank)
        if (key === 'y' && visualMode && selection && selectedCell) {
          e.preventDefault()
          clearKeyBuffer()
          handleCopySelection()
          setVisualMode(false)
          // Restore single-cell selection at current position
          selectCell(selectedCell.row, selectedCell.col)
          return
        }

        // Buffer 'g' or 'y' for potential gg/yy sequence
        if (key === 'g' || key === 'y') {
          e.preventDefault()
          setKeyBuffer(newBuffer)
          if (keyBufferTimeoutRef.current) clearTimeout(keyBufferTimeoutRef.current)
          keyBufferTimeoutRef.current = window.setTimeout(clearKeyBuffer, 500)
          return
        }
      }

      // Only handle navigation keys
      if (
        !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape', 'PageUp', 'PageDown', 'Home', 'End'].includes(
          e.key
        )
      ) {
        return
      }

      e.preventDefault()

      // Escape: Cancel edit or clear selection
      if (e.key === 'Escape') {
        if (editingCell) {
          cancelEdit()
        } else if (visualMode) {
          setVisualMode(false)
        } else {
          clearSelection()
          if (document.activeElement === searchInputRef.current) {
            setSearch('')
            searchInputRef.current?.blur()
          }
        }
        return
      }

      // Navigation
      const currentFocus = selectedCell ?? { row: 0, col: 0 }
      let { row, col } = currentFocus

      // Helper to navigate columns in visual order
      const navigateCol = (direction: 'left' | 'right' | 'first' | 'last'): number => {
        const currentColName = visibleColumns[col]?.name
        const displayIndex = displayColumns.findIndex((c) => c.name === currentColName)
        let newDisplayIndex: number
        switch (direction) {
          case 'left':
            newDisplayIndex = Math.max(0, displayIndex - 1)
            break
          case 'right':
            newDisplayIndex = Math.min(displayColumns.length - 1, displayIndex + 1)
            break
          case 'first':
            newDisplayIndex = 0
            break
          case 'last':
            newDisplayIndex = displayColumns.length - 1
            break
        }
        const newColName = displayColumns[newDisplayIndex]?.name
        const newCol = visibleColumns.findIndex((c) => c.name === newColName)
        return newCol !== -1 ? newCol : col
      }

      switch (e.key) {
        case 'ArrowUp':
          row = Math.max(0, row - 1)
          break
        case 'ArrowDown':
          row = Math.min(rowCount - 1, row + 1)
          break
        case 'ArrowLeft':
          col = navigateCol('left')
          break
        case 'ArrowRight':
          col = navigateCol('right')
          break
        case 'PageUp':
          row = Math.max(0, row - virtualScroll.visibleRows)
          break
        case 'PageDown':
          row = Math.min(rowCount - 1, row + virtualScroll.visibleRows)
          break
        case 'Home':
          if (e.metaKey || e.ctrlKey) {
            row = 0
            col = navigateCol('first')
          } else {
            col = navigateCol('first')
          }
          break
        case 'End':
          if (e.metaKey || e.ctrlKey) {
            row = rowCount - 1
            col = navigateCol('last')
          } else {
            col = navigateCol('last')
          }
          break
      }

      // Shift+Arrow: Extend selection
      if ((e.shiftKey || visualMode) && selection) {
        extendSelection(row, col)
      } else {
        selectCell(row, col)
      }
    },
    [
      activeNode,
      activeNodeId,
      visibleColumns,
      displayColumns,
      totalCount,
      editingCell,
      selection,
      selectedCell,
      virtualScroll.visibleRows,
      currentSorts,
      keyBuffer,
      visualMode,
      handleCopySelection,
      handleCopyRowCsv,
      startEdit,
      cancelEdit,
      extendSelection,
      selectCell,
      selectRow,
      selectColumn,
      setSelection,
      clearSelection,
      clearKeyBuffer,
      searchInputRef,
      rowJumpInputRef,
      setRowJumpValue,
      setSearch,
      handleSortClick,
      toggleColumnPin,
      toggleColumnVisibility,
      openCommandPalette,
      invalidateCache,
      undo,
      redo,
      canUndo,
      canRedo,
      setCanvasMode,
      openChartPanel,
      openDialog,
    ]
  )

  return { handleKeyDown, visualMode }
}
