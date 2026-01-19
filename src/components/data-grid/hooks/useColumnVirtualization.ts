import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react'
import type { Column } from '@/types'

export interface ColumnVirtualItem {
  /** Column index in the scrollable columns array */
  index: number
  /** Left offset in pixels (relative to scrollable area, not including pinned) */
  start: number
  /** Column width in pixels */
  size: number
  /** The column data */
  column: Column
}

export interface UseColumnVirtualizationOptions {
  /** All scrollable columns (excluding pinned) */
  scrollableCols: Column[]
  /** Function to get column width by name */
  getColumnSize: (name: string) => number
  /** Reference to the scroll container */
  scrollContainerRef: React.RefObject<HTMLElement | null>
  /** Width of pinned columns + row number */
  pinnedWidth: number
  /** Extra columns to render outside visible area */
  overscan?: number
}

export interface UseColumnVirtualizationResult {
  /** Columns currently visible (plus overscan) */
  visibleColumns: ColumnVirtualItem[]
  /** Total width of all scrollable columns */
  totalScrollableWidth: number
  /** Current horizontal scroll position */
  scrollLeft: number
  /** Left offset where scrollable columns start (after pinned) */
  startOffset: number
}

/**
 * Hook for horizontal column virtualization.
 * Only renders columns that are visible in the viewport, plus overscan.
 */
export function useColumnVirtualization({
  scrollableCols,
  getColumnSize,
  scrollContainerRef,
  pinnedWidth,
  overscan = 2,
}: UseColumnVirtualizationOptions): UseColumnVirtualizationResult {
  // Pre-compute column positions for O(1) lookups
  const columnLayout = useMemo(() => {
    const positions: { start: number; end: number; column: Column }[] = []
    let currentOffset = 0

    for (const col of scrollableCols) {
      const width = getColumnSize(col.name)
      positions.push({
        start: currentOffset,
        end: currentOffset + width,
        column: col,
      })
      currentOffset += width
    }

    return {
      positions,
      totalWidth: currentOffset,
    }
  }, [scrollableCols, getColumnSize])

  // Subscribe to scroll events for scroll position
  const scrollLeftRef = useRef(0)
  const getScrollLeft = useCallback(() => scrollLeftRef.current, [])
  const subscribe = useCallback(
    (callback: () => void) => {
      const container = scrollContainerRef.current
      if (!container) return () => {}

      const handleScroll = () => {
        const newScrollLeft = container.scrollLeft
        if (newScrollLeft !== scrollLeftRef.current) {
          scrollLeftRef.current = newScrollLeft
          callback()
        }
      }

      container.addEventListener('scroll', handleScroll, { passive: true })
      // Initialize
      scrollLeftRef.current = container.scrollLeft

      return () => container.removeEventListener('scroll', handleScroll)
    },
    [scrollContainerRef]
  )

  const scrollLeft = useSyncExternalStore(subscribe, getScrollLeft, getScrollLeft)

  // Calculate visible columns based on scroll position
  const visibleColumns = useMemo(() => {
    if (scrollableCols.length === 0) return []

    const container = scrollContainerRef.current
    const viewportWidth = container?.clientWidth ?? 800

    // Visible range in the scrollable area
    const visibleStart = scrollLeft
    const visibleEnd = scrollLeft + viewportWidth - pinnedWidth

    // Binary search to find first visible column
    const { positions } = columnLayout
    let startIdx = 0
    let endIdx = positions.length - 1

    // Find first column that ends after visibleStart
    let lo = 0
    let hi = positions.length - 1
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2)
      if (positions[mid].end <= visibleStart) {
        lo = mid + 1
      } else {
        hi = mid
      }
    }
    startIdx = Math.max(0, lo - overscan)

    // Find last column that starts before visibleEnd
    lo = 0
    hi = positions.length - 1
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2)
      if (positions[mid].start >= visibleEnd) {
        hi = mid - 1
      } else {
        lo = mid
      }
    }
    endIdx = Math.min(positions.length - 1, hi + overscan)

    // Build visible column items
    const items: ColumnVirtualItem[] = []
    for (let i = startIdx; i <= endIdx; i++) {
      const pos = positions[i]
      items.push({
        index: i,
        start: pos.start,
        size: pos.end - pos.start,
        column: pos.column,
      })
    }

    return items
  }, [scrollableCols, scrollLeft, scrollContainerRef, pinnedWidth, columnLayout, overscan])

  return {
    visibleColumns,
    totalScrollableWidth: columnLayout.totalWidth,
    scrollLeft,
    startOffset: pinnedWidth,
  }
}
