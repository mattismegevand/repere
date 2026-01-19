import { useCallback, useMemo } from 'react'
import type { DataView, SortOperation } from '@/types'
import type { PipelineNode } from '@/types/pipeline'

interface UseSortHandlingOptions {
  activeNode: PipelineNode | null
  applyOrReplaceOperation: (op: SortOperation) => Promise<DataView | null>
  removeCurrentOperation: () => Promise<{ needsConfirmation?: boolean; descendantCount?: number }>
  saveScrollPosition: (includeRow?: boolean) => void
  setConfirmDelete: (value: { descendantCount: number } | null) => void
}

export function useSortHandling({
  activeNode,
  applyOrReplaceOperation,
  removeCurrentOperation,
  saveScrollPosition,
  setConfirmDelete,
}: UseSortHandlingOptions) {
  // Get all current sorts
  const currentSorts = useMemo(() => {
    if (!activeNode || activeNode.type !== 'view') return []
    const view = activeNode as DataView
    if (view.operation.type !== 'sort') return []
    const op = view.operation as SortOperation
    return op.sorts
  }, [activeNode])

  // Handle sort click - cycles through: none -> asc -> desc -> none
  const handleSortClick = useCallback(
    async (columnName: string) => {
      saveScrollPosition(false)

      const existingSort = currentSorts.find((s) => s.column === columnName)

      if (!existingSort) {
        // Add new sort
        await applyOrReplaceOperation({
          type: 'sort',
          sorts: [...currentSorts, { column: columnName, direction: 'asc' }],
        } as SortOperation)
      } else if (existingSort.direction === 'asc') {
        // Change to desc
        const newSorts = currentSorts.map((s) => (s.column === columnName ? { ...s, direction: 'desc' as const } : s))
        await applyOrReplaceOperation({ type: 'sort', sorts: newSorts } as SortOperation)
      } else {
        // Remove this sort
        const newSorts = currentSorts.filter((s) => s.column !== columnName)
        if (newSorts.length === 0) {
          const result = await removeCurrentOperation()
          if (result.needsConfirmation && result.descendantCount) {
            setConfirmDelete({ descendantCount: result.descendantCount })
          }
        } else {
          await applyOrReplaceOperation({ type: 'sort', sorts: newSorts } as SortOperation)
        }
      }
    },
    [currentSorts, applyOrReplaceOperation, removeCurrentOperation, saveScrollPosition, setConfirmDelete]
  )

  // Handle sort chip click - toggle direction (asc ↔ desc)
  const handleSortChipClick = useCallback(
    async (columnName: string) => {
      saveScrollPosition(false)
      const newSorts = currentSorts.map((s) =>
        s.column === columnName ? { ...s, direction: (s.direction === 'asc' ? 'desc' : 'asc') as 'asc' | 'desc' } : s
      )
      await applyOrReplaceOperation({ type: 'sort', sorts: newSorts } as SortOperation)
    },
    [currentSorts, applyOrReplaceOperation, saveScrollPosition]
  )

  // Handle sort chip remove
  const handleSortChipRemove = useCallback(
    async (columnName: string) => {
      saveScrollPosition(false)
      const newSorts = currentSorts.filter((s) => s.column !== columnName)
      if (newSorts.length === 0) {
        const result = await removeCurrentOperation()
        if (result.needsConfirmation && result.descendantCount) {
          setConfirmDelete({ descendantCount: result.descendantCount })
        }
      } else {
        await applyOrReplaceOperation({ type: 'sort', sorts: newSorts } as SortOperation)
      }
    },
    [currentSorts, applyOrReplaceOperation, removeCurrentOperation, saveScrollPosition, setConfirmDelete]
  )

  return {
    currentSorts,
    handleSortClick,
    handleSortChipClick,
    handleSortChipRemove,
  }
}
