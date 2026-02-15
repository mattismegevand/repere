import { useCallback } from 'react'
import type { HydratedNode } from '@/lib/pipeline/hydration'
import type { NumberFormat } from '@/stores/themeStore'
import type { Column } from '@/types'
import { formatCell } from '../formatters'

interface CellMenu {
  row: number
  col: number
  colName: string
  value: unknown
}

interface UseClipboardActionsParams {
  activeNode: HydratedNode | null
  visibleColumns: Column[]
  selection: {
    anchorRow: number
    anchorCol: number
    focusRow: number
    focusCol: number
  } | null
  getRow: (index: number) => Record<string, unknown> | undefined
  getFormat: (column?: string) => NumberFormat
  contextMenu: CellMenu | null
  closeAllMenus: () => void
}

export function useClipboardActions({
  activeNode,
  visibleColumns,
  selection,
  getRow,
  getFormat,
  contextMenu,
  closeAllMenus,
}: UseClipboardActionsParams) {
  // Copy single cell from context menu
  const handleCopyCell = useCallback(async () => {
    if (!contextMenu || !activeNode) return
    const column = visibleColumns[contextMenu.col]
    const text = formatCell(contextMenu.value, column?.type ?? 'string', getFormat(column?.name))
    await navigator.clipboard.writeText(text === '∅' ? '' : text)
    closeAllMenus()
  }, [contextMenu, activeNode, visibleColumns, closeAllMenus, getFormat])

  // Copy row as CSV from context menu
  const handleCopyRowCsv = useCallback(async () => {
    if (!contextMenu) return
    const rowData = getRow(contextMenu.row)
    if (!rowData || !activeNode) return
    const values = visibleColumns.map((col) => {
      const val = rowData[col.name]
      if (val === null || val === undefined) return ''
      if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
        return `"${val.replace(/"/g, '""')}"`
      }
      return String(val)
    })
    await navigator.clipboard.writeText(values.join(','))
    closeAllMenus()
  }, [contextMenu, activeNode, visibleColumns, getRow, closeAllMenus])

  // Copy row as JSON from context menu
  const handleCopyRowJson = useCallback(async () => {
    if (!contextMenu) return
    const rowData = getRow(contextMenu.row)
    if (!rowData) return
    await navigator.clipboard.writeText(JSON.stringify(rowData, null, 2))
    closeAllMenus()
  }, [contextMenu, getRow, closeAllMenus])

  // Copy selected cells
  const handleCopySelection = useCallback(async () => {
    if (!selection || !activeNode) return

    const bounds = {
      minRow: Math.min(selection.anchorRow, selection.focusRow),
      maxRow: Math.max(selection.anchorRow, selection.focusRow),
      minCol: Math.min(selection.anchorCol, selection.focusCol),
      maxCol: Math.max(selection.anchorCol, selection.focusCol),
    }

    const lines: string[] = []
    for (let row = bounds.minRow; row <= bounds.maxRow; row++) {
      const rowData = getRow(row)
      if (!rowData) continue

      const cells: string[] = []
      for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
        const column = visibleColumns[col]
        if (!column) continue
        const value = rowData[column.name]
        const text = formatCell(value, column.type, getFormat(column.name))
        cells.push(text === '∅' ? '' : text)
      }
      lines.push(cells.join('\t'))
    }

    try {
      await navigator.clipboard.writeText(lines.join('\n'))
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [selection, activeNode, visibleColumns, getRow, getFormat])

  return {
    handleCopyCell,
    handleCopyRowCsv,
    handleCopyRowJson,
    handleCopySelection,
  }
}
