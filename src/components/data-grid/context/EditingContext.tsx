import { useCallback } from 'react'
import { type EditingCell, useGridEditingStore } from '@/components/data-grid/stores'
import { formatValueForEdit, parseEditValue, validateEditValue } from '../utils/cell-editing'
import { useColumnsContext, useRowDataContext } from './DataContext'

export interface EditingContextValue {
  editingCell: EditingCell | null
  startEdit: (row: number, col: number, initialValue?: string) => void
  updateEditValue: (value: string, columnType: string) => void
  cancelEdit: () => void
  commitEdit: () => Promise<void>
  validateEditValue: (value: string, type: string) => boolean
  parseValue: (value: string, type: string) => unknown
}

/**
 * Hook that provides cell editing functionality.
 * Now reads from/writes to the gridEditingStore instead of React Context.
 */
export function useEditingContext(): EditingContextValue {
  const editingCell = useGridEditingStore((s) => s.editingCell)
  const setEditingCell = useGridEditingStore((s) => s.setEditingCell)
  const storeUpdateEditValue = useGridEditingStore((s) => s.updateEditValue)
  const storeCancelEdit = useGridEditingStore((s) => s.cancelEdit)
  const storeCommitEdit = useGridEditingStore((s) => s.commitEdit)

  // Get columns and getRow from split contexts for startEdit
  const { visibleColumns } = useColumnsContext()
  const { getRow } = useRowDataContext()

  const startEdit = useCallback(
    (row: number, col: number, initialValue?: string) => {
      const column = visibleColumns[col]
      if (!column) return

      const rowData = getRow(row)
      if (!rowData) return

      // Use initialValue if provided (e.g., from paste), otherwise use current cell value
      const displayValue =
        initialValue !== undefined ? initialValue : formatValueForEdit(rowData[column.name], column.type)
      const isValid = validateEditValue(displayValue, column.type)
      setEditingCell({ row, col, value: displayValue, isValid })
    },
    [visibleColumns, getRow, setEditingCell]
  )

  const updateEditValue = useCallback(
    (value: string, columnType: string) => {
      const isValid = validateEditValue(value, columnType)
      storeUpdateEditValue(value, isValid)
    },
    [storeUpdateEditValue]
  )

  const cancelEdit = useCallback(() => {
    storeCancelEdit()
  }, [storeCancelEdit])

  const commitEdit = useCallback(async () => {
    await storeCommitEdit()
  }, [storeCommitEdit])

  return {
    editingCell,
    startEdit,
    updateEditValue,
    cancelEdit,
    commitEdit,
    validateEditValue,
    parseValue: parseEditValue,
  }
}
