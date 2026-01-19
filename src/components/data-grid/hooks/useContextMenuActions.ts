import { useCallback } from 'react'
import { addFilterToExpression, createExpression } from '@/lib/filter-utils'
import type { Column, FilterExpression, FilterOperation, PipelineNode } from '@/types'
import type { CellContextMenuState } from '../CellContextMenu'
import type { ColumnHeaderMenuState } from '../ColumnHeaderMenu'

interface UseContextMenuActionsOptions {
  contextMenu: CellContextMenuState | null
  activeNode: PipelineNode | null
  activeNodeId: string | null
  visibleColumns: Column[]
  filterExpression: FilterExpression | null | undefined
  applyFilter: (operation: FilterOperation) => Promise<boolean>
  toggleColumnVisibility: (column: string) => void
  toggleColumnPin: (column: string) => void
  setContextMenu: (menu: CellContextMenuState | null) => void
  setColumnHeaderMenu: (menu: ColumnHeaderMenuState | null) => void
  closeAllMenus: () => void
}

export function useContextMenuActions({
  contextMenu,
  activeNode,
  activeNodeId,
  visibleColumns,
  filterExpression,
  applyFilter,
  toggleColumnVisibility,
  toggleColumnPin,
  setContextMenu,
  setColumnHeaderMenu,
  closeAllMenus,
}: UseContextMenuActionsOptions) {
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, row: number, col: number, colName: string, value: unknown) => {
      e.preventDefault()
      setContextMenu({ x: e.clientX, y: e.clientY, row, col, colName, value })
    },
    [setContextMenu]
  )

  const handleColumnHeaderContextMenu = useCallback(
    (e: React.MouseEvent, colName: string, colType: Column['type']) => {
      e.preventDefault()
      e.stopPropagation()
      setColumnHeaderMenu({ x: e.clientX, y: e.clientY, colName, colType })
      setContextMenu(null)
    },
    [setColumnHeaderMenu, setContextMenu]
  )

  const handleFilterByValue = useCallback(async () => {
    if (!contextMenu || !activeNode || !activeNodeId) return
    const column = visibleColumns[contextMenu.col]
    if (!column) return

    const newFilter: { column: string; operator: 'eq' | 'isNull'; value: unknown } = {
      column: column.name,
      operator: contextMenu.value === null ? 'isNull' : 'eq',
      value: contextMenu.value,
    }

    const expression = filterExpression
      ? addFilterToExpression(filterExpression, newFilter)
      : createExpression([newFilter])

    const operation: FilterOperation = { type: 'filter', expression }

    closeAllMenus()
    await applyFilter(operation)
  }, [contextMenu, activeNode, activeNodeId, visibleColumns, filterExpression, applyFilter, closeAllMenus])

  const handleHideColumn = useCallback(() => {
    if (!contextMenu) return
    toggleColumnVisibility(contextMenu.colName)
    closeAllMenus()
  }, [contextMenu, toggleColumnVisibility, closeAllMenus])

  const handlePinColumn = useCallback(() => {
    if (!contextMenu) return
    toggleColumnPin(contextMenu.colName)
    closeAllMenus()
  }, [contextMenu, toggleColumnPin, closeAllMenus])

  return {
    closeAllMenus,
    handleContextMenu,
    handleColumnHeaderContextMenu,
    handleFilterByValue,
    handleHideColumn,
    handlePinColumn,
  }
}
