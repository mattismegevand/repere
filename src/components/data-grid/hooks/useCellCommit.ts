import { useCallback } from 'react'
import type { DuckDBClient } from '@/lib/duckdb/interface'
import type { HydratedNode } from '@/lib/pipeline/hydration'
import type { EditCellOperation, DataView as PipelineDataView } from '@/types'
import type { RuntimeColumn } from '@/types/pipelineRuntime'

interface EditingCell {
  row: number
  col: number
  value: string
}

interface UseCellCommitOptions {
  editingCell: EditingCell | null
  activeNode: HydratedNode | null
  visibleColumns: RuntimeColumn[]
  client: DuckDBClient | null
  nodes: Record<string, HydratedNode>
  getRow: (index: number) => Record<string, unknown> | undefined
  validateEditValue: (value: string, type: RuntimeColumn['type']) => boolean
  formatValueForEdit: (value: unknown, type: RuntimeColumn['type']) => string
  parseValue: (value: string, type: RuntimeColumn['type']) => unknown
  clearEditingCell: () => void
  applyOrReplaceOperation: (operation: EditCellOperation) => Promise<PipelineDataView | null>
  removeCurrentOperation: () => Promise<{ success: boolean; needsConfirmation?: boolean; descendantCount?: number }>
  saveScrollPosition: (row: number, scrollLeft: number) => void
  getScrollLeft: () => number
}

export function useCellCommit({
  editingCell,
  activeNode,
  visibleColumns,
  client,
  nodes,
  getRow,
  validateEditValue,
  formatValueForEdit,
  parseValue,
  clearEditingCell,
  applyOrReplaceOperation,
  removeCurrentOperation,
  saveScrollPosition,
  getScrollLeft,
}: UseCellCommitOptions) {
  const commitEdit = useCallback(async () => {
    if (!editingCell || !activeNode || !client) return

    const column = visibleColumns[editingCell.col]
    if (!column) {
      clearEditingCell()
      return
    }

    if (!validateEditValue(editingCell.value, column.type)) {
      return
    }

    saveScrollPosition(editingCell.row, getScrollLeft())

    const rowData = getRow(editingCell.row)
    const currentValue = rowData?.[column.name]
    const currentDisplayValue = formatValueForEdit(currentValue, column.type)

    // No change - just close editor
    if (editingCell.value === currentDisplayValue) {
      clearEditingCell()
      return
    }

    const parsedValue = parseValue(editingCell.value, column.type)
    if (parsedValue === null && editingCell.value !== '' && editingCell.value !== '∅') {
      return
    }

    const rowId = editingCell.row + 1
    const colName = column.name

    // Check if we're editing an existing editCell view
    const isEditCellView = activeNode.type === 'view' && activeNode.operation.type === 'editCell'

    if (isEditCellView) {
      const view = activeNode
      const currentOp = view.operation as EditCellOperation
      const existingEdits = [...currentOp.edits]

      // Get original value from parent to detect if we're restoring it
      const parentId = view.parentIds[0]
      let originalValue: unknown = currentValue

      if (parentId) {
        const parentNode = nodes[parentId]
        if (parentNode?.tableName) {
          try {
            const result = await client.query<{ val: unknown }>(`
              SELECT "${colName}" as val FROM (
                SELECT *, ROW_NUMBER() OVER () AS __row_id FROM "${parentNode.tableName}"
              ) WHERE __row_id = ${rowId}
            `)
            const row = result.rows[0]
            if (row) originalValue = row.val
          } catch {
            // Ignore query errors
          }
        }
      }

      const originalDisplayValue = originalValue === null || originalValue === undefined ? '' : String(originalValue)
      const newDisplayValue = parsedValue === null || parsedValue === undefined ? '' : String(parsedValue)
      const isRestoringOriginal = newDisplayValue === originalDisplayValue

      const existingEditIndex = existingEdits.findIndex((e) => e.rowId === rowId && e.column === colName)

      if (isRestoringOriginal) {
        // Remove this edit since we're restoring original value
        if (existingEditIndex >= 0) {
          existingEdits.splice(existingEditIndex, 1)
        }

        if (existingEdits.length === 0) {
          // No more edits - remove the editCell view entirely
          clearEditingCell()
          await removeCurrentOperation()
          return
        }
        // Update with remaining edits
        const operation: EditCellOperation = { type: 'editCell', edits: existingEdits }
        clearEditingCell()
        await applyOrReplaceOperation(operation)
        return
      }

      // Update or add the edit
      if (existingEditIndex >= 0) {
        existingEdits[existingEditIndex] = { rowId, column: colName, value: parsedValue }
      } else {
        existingEdits.push({ rowId, column: colName, value: parsedValue })
      }

      const operation: EditCellOperation = { type: 'editCell', edits: existingEdits }
      clearEditingCell()
      await applyOrReplaceOperation(operation)
      return
    }

    // New edit on non-editCell view
    const operation: EditCellOperation = {
      type: 'editCell',
      edits: [{ rowId, column: colName, value: parsedValue }],
    }

    clearEditingCell()
    await applyOrReplaceOperation(operation)
  }, [
    editingCell,
    activeNode,
    visibleColumns,
    client,
    nodes,
    getRow,
    validateEditValue,
    formatValueForEdit,
    parseValue,
    clearEditingCell,
    applyOrReplaceOperation,
    removeCurrentOperation,
    saveScrollPosition,
    getScrollLeft,
  ])

  return { commitEdit }
}
