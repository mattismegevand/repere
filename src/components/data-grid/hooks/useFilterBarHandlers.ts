import { useCallback } from 'react'
import { removeFilterFromExpression } from '@/lib/filter-utils'
import type { FilterExpression, FilterOperation } from '@/types'

interface UseFilterBarHandlersOptions {
  filterExpression: FilterExpression | undefined
  removeCurrentOperation: () => Promise<{ needsConfirmation?: boolean; descendantCount?: number }>
  applyFilter: (operation: FilterOperation) => Promise<boolean>
  setConfirmDelete: (value: { descendantCount: number } | null) => void
  setFilterColumn: (value: { column: string; position?: { x: number; y: number } } | null) => void
}

export function useFilterBarHandlers({
  filterExpression,
  removeCurrentOperation,
  applyFilter,
  setConfirmDelete,
  setFilterColumn,
}: UseFilterBarHandlersOptions) {
  const handleRemoveFilter = useCallback(
    async (columnName: string) => {
      if (!filterExpression) return
      const newExpression = removeFilterFromExpression(filterExpression, columnName)
      if (!newExpression) {
        // No filters left, remove the entire filter operation
        const result = await removeCurrentOperation()
        if (result.needsConfirmation && result.descendantCount) {
          setConfirmDelete({ descendantCount: result.descendantCount })
        }
      } else {
        // Use applyFilter for deferred branching (captures snapshot if view has children)
        await applyFilter({
          type: 'filter',
          expression: newExpression,
        })
      }
    },
    [filterExpression, removeCurrentOperation, applyFilter, setConfirmDelete]
  )

  const handleClearAllFilters = useCallback(async () => {
    const result = await removeCurrentOperation()
    if (result.needsConfirmation && result.descendantCount) {
      setConfirmDelete({ descendantCount: result.descendantCount })
    }
  }, [removeCurrentOperation, setConfirmDelete])

  const handleEditFilter = useCallback(
    (filter: { column: string }, position?: { x: number; y: number }) => {
      setFilterColumn({ column: filter.column, position })
    },
    [setFilterColumn]
  )

  const handleAddFilter = useCallback(
    (columnName: string) => {
      setFilterColumn({ column: columnName })
    },
    [setFilterColumn]
  )

  return {
    handleRemoveFilter,
    handleClearAllFilters,
    handleEditFilter,
    handleAddFilter,
  }
}
