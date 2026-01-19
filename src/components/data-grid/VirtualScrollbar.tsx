import { useCallback, useEffect, useRef, useState } from 'react'

interface VirtualScrollbarProps {
  totalRows: number
  visibleRows: number
  scrollRow: number
  maxScrollRow: number
  onScrollChange: (rowIndex: number) => void
  className?: string
  style?: React.CSSProperties
}

const MIN_THUMB_HEIGHT = 30

export function VirtualScrollbar({
  totalRows,
  visibleRows,
  scrollRow,
  maxScrollRow,
  onScrollChange,
  className,
  style,
}: VirtualScrollbarProps) {
  const [trackHeight, setTrackHeight] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ startY: number; startScrollRow: number } | null>(null)
  const observerRef = useRef<ResizeObserver | null>(null)
  const trackNodeRef = useRef<HTMLDivElement | null>(null)

  // Debounce timeout ref for resize observer
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Callback ref to measure track height when element mounts/unmounts
  const trackRef = useCallback((node: HTMLDivElement | null) => {
    trackNodeRef.current = node

    // Cleanup previous observer and debounce
    if (observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = null
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }

    if (node) {
      // Measure immediately
      setTrackHeight(node.clientHeight)

      // Set up observer for future resizes (debounced)
      observerRef.current = new ResizeObserver((entries) => {
        const height = entries[0]?.contentRect.height ?? 0
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
          setTrackHeight(height)
        }, 100)
      })
      observerRef.current.observe(node)
    } else {
      setTrackHeight(0)
    }
  }, [])

  // Cleanup observer and debounce on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  // Calculate thumb dimensions
  const thumbHeight =
    trackHeight > 0 ? Math.max(MIN_THUMB_HEIGHT, (visibleRows / totalRows) * trackHeight) : MIN_THUMB_HEIGHT
  const scrollableTrackHeight = trackHeight - thumbHeight
  const thumbTop =
    maxScrollRow > 0 && scrollableTrackHeight > 0 ? (scrollRow / maxScrollRow) * scrollableTrackHeight : 0

  // Handle drag - using refs to avoid stale closures
  useEffect(() => {
    if (!isDragging || !dragStartRef.current) return

    const handleMove = (clientY: number) => {
      if (!dragStartRef.current || scrollableTrackHeight <= 0) return

      const deltaY = clientY - dragStartRef.current.startY
      const deltaRows = (deltaY / scrollableTrackHeight) * maxScrollRow
      const newRow = Math.max(0, Math.min(maxScrollRow, dragStartRef.current.startScrollRow + deltaRows))
      onScrollChange(newRow)
    }

    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientY)
    const handleTouchMove = (e: TouchEvent) => handleMove(e.touches[0].clientY)

    const handleEnd = () => {
      setIsDragging(false)
      dragStartRef.current = null
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleEnd)
    document.addEventListener('touchmove', handleTouchMove, { passive: true })
    document.addEventListener('touchend', handleEnd)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleEnd)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleEnd)
    }
  }, [isDragging, maxScrollRow, scrollableTrackHeight, onScrollChange])

  const startDrag = useCallback(
    (clientY: number) => {
      dragStartRef.current = { startY: clientY, startScrollRow: scrollRow }
      setIsDragging(true)
    },
    [scrollRow]
  )

  const handleThumbMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      startDrag(e.clientY)
    },
    [startDrag]
  )

  const handleThumbTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.stopPropagation()
      startDrag(e.touches[0].clientY)
    },
    [startDrag]
  )

  // Handle track click (jump to position)
  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      // Don't handle if clicking on thumb
      if ((e.target as HTMLElement).dataset.thumb === 'true') return
      if (!trackNodeRef.current || trackHeight <= 0) return

      const rect = trackNodeRef.current.getBoundingClientRect()
      const clickY = e.clientY - rect.top
      const clickRatio = clickY / trackHeight
      const targetRow = clickRatio * totalRows - visibleRows / 2
      onScrollChange(Math.max(0, Math.min(maxScrollRow, targetRow)))
    },
    [totalRows, visibleRows, maxScrollRow, trackHeight, onScrollChange]
  )

  // Handle keyboard navigation on scrollbar
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          onScrollChange(Math.max(0, scrollRow - 1))
          break
        case 'ArrowDown':
          e.preventDefault()
          onScrollChange(Math.min(maxScrollRow, scrollRow + 1))
          break
        case 'PageUp':
          e.preventDefault()
          onScrollChange(Math.max(0, scrollRow - visibleRows))
          break
        case 'PageDown':
          e.preventDefault()
          onScrollChange(Math.min(maxScrollRow, scrollRow + visibleRows))
          break
        case 'Home':
          e.preventDefault()
          onScrollChange(0)
          break
        case 'End':
          e.preventDefault()
          onScrollChange(maxScrollRow)
          break
      }
    },
    [scrollRow, maxScrollRow, visibleRows, onScrollChange]
  )

  // Don't render if no scrolling needed
  if (totalRows <= visibleRows) {
    return null
  }

  // Only show thumb when track is properly measured
  const showThumb = trackHeight > 0 && scrollableTrackHeight > 0

  return (
    <div
      ref={trackRef}
      role="scrollbar"
      aria-controls="data-grid-body"
      aria-orientation="vertical"
      aria-valuenow={Math.round(scrollRow)}
      aria-valuemin={0}
      aria-valuemax={maxScrollRow}
      aria-label={`Scroll through ${totalRows.toLocaleString()} rows`}
      tabIndex={0}
      onClick={handleTrackClick}
      onKeyDown={handleKeyDown}
      className={`w-2 bg-[var(--color-bg-secondary)] border-l border-[var(--color-border)] cursor-pointer focus:outline-none ${className ?? ''}`}
      style={style}
    >
      {showThumb && (
        <div
          data-thumb="true"
          className={`absolute left-0 right-0 rounded-sm cursor-pointer ${
            isDragging ? 'bg-[var(--color-text-muted)]' : 'bg-[var(--color-border)] hover:bg-[var(--color-text-muted)]'
          }`}
          style={{
            height: thumbHeight,
            top: thumbTop,
          }}
          onMouseDown={handleThumbMouseDown}
          onTouchStart={handleThumbTouchStart}
        />
      )}
    </div>
  )
}
