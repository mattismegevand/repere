import { useCallback, useMemo, useState } from 'react'

export interface VirtualItem {
  index: number
  start: number
  size: number
}

export interface UseVirtualScrollOptions {
  totalRows: number
  rowHeight: number
  viewportHeight: number
  overscan?: number
}

export interface UseVirtualScrollResult {
  scrollRow: number
  visibleRows: number
  maxScrollRow: number
  virtualItems: VirtualItem[]
  totalHeight: number
  scrollToRow: (row: number, align?: 'start' | 'center' | 'end') => void
  scrollToIndex: (index: number, options?: { align?: 'start' | 'center' | 'end' }) => void
  scrollByRows: (delta: number) => void
  scrollByPixels: (deltaPixels: number) => void
  setScrollRow: (row: number) => void
}

export function useVirtualScroll({
  totalRows,
  rowHeight,
  viewportHeight,
  overscan = 20,
}: UseVirtualScrollOptions): UseVirtualScrollResult {
  const [scrollRow, setScrollRowState] = useState(0)

  const visibleRows = Math.ceil(viewportHeight / rowHeight)
  const maxScrollRow = Math.max(0, totalRows - visibleRows)

  const setScrollRow = useCallback(
    (row: number) => {
      const clamped = Math.max(0, Math.min(maxScrollRow, row))
      setScrollRowState(clamped)
    },
    [maxScrollRow]
  )

  const virtualItems = useMemo(() => {
    if (totalRows === 0) return []

    const startRow = Math.max(0, Math.floor(scrollRow) - overscan)
    const endRow = Math.min(totalRows - 1, Math.ceil(scrollRow) + visibleRows + overscan)

    const items: VirtualItem[] = []
    for (let i = startRow; i <= endRow; i++) {
      items.push({
        index: i,
        start: (i - Math.floor(scrollRow)) * rowHeight,
        size: rowHeight,
      })
    }
    return items
  }, [scrollRow, totalRows, rowHeight, visibleRows, overscan])

  const totalHeight = visibleRows * rowHeight

  const scrollToRow = useCallback(
    (row: number, align: 'start' | 'center' | 'end' = 'start') => {
      let targetRow = row
      if (align === 'center') {
        targetRow = row - visibleRows / 2
      } else if (align === 'end') {
        targetRow = row - visibleRows + 1
      }
      setScrollRow(targetRow)
    },
    [visibleRows, setScrollRow]
  )

  const scrollToIndex = useCallback(
    (index: number, options?: { align?: 'start' | 'center' | 'end' }) => {
      scrollToRow(index, options?.align)
    },
    [scrollToRow]
  )

  const scrollByRows = useCallback(
    (delta: number) => {
      setScrollRowState((prev) => Math.max(0, Math.min(maxScrollRow, prev + delta)))
    },
    [maxScrollRow]
  )

  const scrollByPixels = useCallback(
    (deltaPixels: number) => {
      scrollByRows(deltaPixels / rowHeight)
    },
    [rowHeight, scrollByRows]
  )

  return {
    scrollRow,
    visibleRows,
    maxScrollRow,
    virtualItems,
    totalHeight,
    scrollToRow,
    scrollToIndex,
    scrollByRows,
    scrollByPixels,
    setScrollRow,
  }
}
