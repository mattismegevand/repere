import { useEffect, useMemo } from 'react'
import { isInternalColumn, useGridColumnStore } from '@/components/data-grid/stores'
import type { Column } from '@/types'

export interface UseColumnStateOptions {
  columns: Column[]
  storageKey: string | undefined
}

export interface UseColumnStateResult {
  // State (from store)
  hiddenColumns: Set<string>
  pinnedColumns: Set<string>

  // Computed
  visibleColumns: Column[]
  pinnedCols: Column[]
  scrollableCols: Column[]
  displayColumns: Column[] // Visual order: pinned first, then scrollable

  // Actions (from store)
  toggleColumnVisibility: (colName: string) => void
  showAllColumns: () => void
  toggleColumnPin: (colName: string) => void
  unpinAllColumns: () => void
  resizeColumn: (colName: string, width: number) => void
  setAllColumnSizes: (sizes: Record<string, number>) => void
  getColumnSize: (colName: string) => number
}

export function useColumnState({ columns, storageKey }: UseColumnStateOptions): UseColumnStateResult {
  // Get state and actions from store
  const hiddenColumns = useGridColumnStore((s) => s.hiddenColumns)
  const pinnedColumns = useGridColumnStore((s) => s.pinnedColumns)

  const initForTable = useGridColumnStore((s) => s.initForTable)
  const toggleColumnVisibility = useGridColumnStore((s) => s.toggleColumnVisibility)
  const showAllColumns = useGridColumnStore((s) => s.showAllColumns)
  const toggleColumnPin = useGridColumnStore((s) => s.toggleColumnPin)
  const unpinAllColumns = useGridColumnStore((s) => s.unpinAllColumns)
  const resizeColumn = useGridColumnStore((s) => s.resizeColumn)
  const setAllColumnSizes = useGridColumnStore((s) => s.setAllColumnSizes)
  const getColumnSize = useGridColumnStore((s) => s.getColumnSize)

  // Initialize store when storageKey changes
  useEffect(() => {
    initForTable(storageKey)
  }, [storageKey, initForTable])

  // Visible columns (filtering out hidden and internal columns)
  const visibleColumns = useMemo(
    () => columns.filter((c) => !hiddenColumns.has(c.name) && !isInternalColumn(c.name)),
    [columns, hiddenColumns]
  )

  // Split visible columns into pinned (frozen) and scrollable
  const { pinnedCols, scrollableCols, displayColumns } = useMemo(() => {
    const pinned: Column[] = []
    const scrollable: Column[] = []
    for (const col of visibleColumns) {
      if (pinnedColumns.has(col.name)) {
        pinned.push(col)
      } else {
        scrollable.push(col)
      }
    }
    // displayColumns is the visual order: pinned first, then scrollable
    return { pinnedCols: pinned, scrollableCols: scrollable, displayColumns: [...pinned, ...scrollable] }
  }, [visibleColumns, pinnedColumns])

  return {
    // State
    hiddenColumns,
    pinnedColumns,

    // Computed
    visibleColumns,
    pinnedCols,
    scrollableCols,
    displayColumns,

    // Actions
    toggleColumnVisibility,
    showAllColumns,
    toggleColumnPin,
    unpinAllColumns,
    resizeColumn,
    setAllColumnSizes,
    getColumnSize,
  }
}
