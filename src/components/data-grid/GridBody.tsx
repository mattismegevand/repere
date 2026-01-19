import { useEffect, useRef, useState } from 'react'
import { usePanelStore } from '@/stores'
import { useRowDataContext, useSelectionContext, useVirtualScrollContext } from './context'
import { ROW_HEIGHT } from './DataGridProvider'
import { GridRow } from './GridRow'

interface GridBodyProps {
  parentRef: React.RefObject<HTMLDivElement | null>
  activeNodeId: string | null | undefined
  onContextMenu: (e: React.MouseEvent, row: number, col: number, colName: string, value: unknown) => void
}

export function GridBody({ parentRef, activeNodeId, onContextMenu }: GridBodyProps) {
  // Use split contexts for better re-render isolation
  const { totalCount, prefetchRange } = useRowDataContext()
  const { selectedCell, dragStateRef, updateDrag, endDrag } = useSelectionContext()
  const virtualScroll = useVirtualScrollContext()
  const lastMouseYRef = useRef(0)

  const { preservedScroll, lastRestoredScrollVersion, markScrollRestored } = usePanelStore()

  // Handle global mouseup to end drag selection
  useEffect(() => {
    const handleMouseUp = () => {
      endDrag()
    }
    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [endDrag])

  // Auto-scroll during drag selection when mouse is near edges
  useEffect(() => {
    if (!parentRef.current || !virtualScroll) return

    let animationId: number | null = null
    const SCROLL_ZONE = 50
    const SCROLL_SPEED = 0.5 // rows per frame
    const HEADER_HEIGHT = 26 // Height of the header row

    // Cache rect to avoid layout thrashing - only update when not in animation loop
    let cachedRect: DOMRect | null = null
    let rectCacheTime = 0
    const RECT_CACHE_TTL = 100 // ms

    const getCachedRect = (): DOMRect | null => {
      const now = performance.now()
      if (!cachedRect || now - rectCacheTime > RECT_CACHE_TTL) {
        cachedRect = parentRef.current?.getBoundingClientRect() ?? null
        rectCacheTime = now
      }
      return cachedRect
    }

    // Calculate row index from mouse Y position relative to grid body
    const calculateRowFromMouseY = (mouseY: number, scrollRow: number): number => {
      const rect = getCachedRect()
      if (!rect) return 0
      // mouseY relative to body (below header)
      const relativeY = mouseY - rect.top - HEADER_HEIGHT
      const rowOffset = Math.floor(relativeY / ROW_HEIGHT)
      return Math.max(0, Math.min(totalCount - 1, Math.floor(scrollRow) + rowOffset))
    }

    const handleMouseMove = (e: MouseEvent) => {
      lastMouseYRef.current = e.clientY

      if (!dragStateRef.current.isDragging || !parentRef.current) return

      const rect = getCachedRect()
      if (!rect) return
      const y = e.clientY

      if (animationId) cancelAnimationFrame(animationId)

      if (y < rect.top + SCROLL_ZONE) {
        const scroll = () => {
          if (!dragStateRef.current.isDragging) return
          virtualScroll.scrollByRows(-SCROLL_SPEED)
          // Update selection based on current mouse position during scroll
          const newRow = calculateRowFromMouseY(lastMouseYRef.current, virtualScroll.scrollRow)
          updateDrag(newRow, dragStateRef.current.lastCol, lastMouseYRef.current)
          animationId = requestAnimationFrame(scroll)
        }
        scroll()
      } else if (y > rect.bottom - SCROLL_ZONE) {
        const scroll = () => {
          if (!dragStateRef.current.isDragging) return
          virtualScroll.scrollByRows(SCROLL_SPEED)
          // Update selection based on current mouse position during scroll
          const newRow = calculateRowFromMouseY(lastMouseYRef.current, virtualScroll.scrollRow)
          updateDrag(newRow, dragStateRef.current.lastCol, lastMouseYRef.current)
          animationId = requestAnimationFrame(scroll)
        }
        scroll()
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      if (animationId) cancelAnimationFrame(animationId)
    }
  }, [dragStateRef, parentRef, virtualScroll, totalCount, updateDrag])

  // Restore scroll position after node changes
  useEffect(() => {
    if (!virtualScroll) return
    if (preservedScroll && totalCount > 0 && preservedScroll.version > lastRestoredScrollVersion) {
      const saved = preservedScroll

      const timeoutId = setTimeout(() => {
        if (saved.version <= lastRestoredScrollVersion) return

        if (saved.row !== null && saved.row < totalCount) {
          virtualScroll.scrollToIndex(saved.row, { align: 'center' })
        }
        requestAnimationFrame(() => {
          if (parentRef.current && saved.scrollLeft > 0) {
            parentRef.current.scrollLeft = saved.scrollLeft
          }
          markScrollRestored(saved.version)
        })
      }, 50)

      return () => clearTimeout(timeoutId)
    }
  }, [
    activeNodeId,
    totalCount,
    virtualScroll,
    preservedScroll,
    lastRestoredScrollVersion,
    markScrollRestored,
    parentRef,
  ])

  // Track previous selected cell to detect actual changes (not just re-renders)
  const [prevSelectedCell, setPrevSelectedCell] = useState<{ row: number; col: number } | null>(null)

  // Scroll to selected cell when it actually changes (not on every render)
  useEffect(() => {
    if (!selectedCell || !virtualScroll) return

    // Only scroll if selection actually changed
    const selectionChanged =
      !prevSelectedCell || prevSelectedCell.row !== selectedCell.row || prevSelectedCell.col !== selectedCell.col

    if (!selectionChanged) return

    setPrevSelectedCell({ row: selectedCell.row, col: selectedCell.col })

    const { row } = selectedCell
    const { scrollRow, visibleRows } = virtualScroll

    // Check if row is outside visible area
    if (row < scrollRow) {
      virtualScroll.scrollToRow(row, 'start')
    } else if (row >= scrollRow + visibleRows - 1) {
      virtualScroll.scrollToRow(row, 'end')
    }
  }, [selectedCell, virtualScroll, prevSelectedCell])

  // Get virtual items from context
  const virtualItems = virtualScroll?.virtualItems ?? []

  // Fetch visible rows
  useEffect(() => {
    if (totalCount === 0 || !virtualScroll) return
    // If virtualItems is empty (initial render before measurement), prefetch first batch
    if (virtualItems.length === 0) {
      prefetchRange(0, Math.min(50, totalCount - 1))
      return
    }
    const startIdx = virtualItems[0].index
    const endIdx = virtualItems[virtualItems.length - 1].index
    prefetchRange(Math.max(0, startIdx - 20), Math.min(endIdx + 20, totalCount - 1))
  }, [virtualItems, totalCount, prefetchRange, virtualScroll])

  return (
    // biome-ignore lint/a11y/useSemanticElements: Uses div for virtualization and absolute positioning
    <div
      id="data-grid-body"
      role="rowgroup"
      aria-label="Grid data rows"
      className="relative text-[11px]"
      style={{ height: virtualScroll?.totalHeight ?? 0 }}
    >
      {virtualItems.map((virtualRow) => (
        <GridRow
          key={virtualRow.index}
          rowIndex={virtualRow.index}
          virtualStart={virtualRow.start}
          onContextMenu={onContextMenu}
        />
      ))}
    </div>
  )
}
