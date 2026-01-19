import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { detectImageType, getCachedDataUrl } from '@/lib/formatters'
import { useGridUIStore, useQueryStore } from '@/stores'
import type { Column } from '@/types'
import {
  useColumnStateContext,
  useColumnsContext,
  useEditingContext,
  useRowDataContext,
  useSelectionContext,
  useStatsContext,
} from './context'
import { formatCell, highlightMatch } from './formatters'

const LONG_PRESS_DURATION = 500

function ImageThumbnail({ dataUrl, onClick }: { dataUrl: string; onClick: () => void }) {
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)

  return (
    <>
      <button
        type="button"
        className="relative z-10 h-[18px] w-auto flex items-center justify-center cursor-pointer"
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        onMouseEnter={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
        onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setMousePos(null)}
        aria-label="View image"
      >
        <img src={dataUrl} alt="" className="h-full w-auto object-contain rounded-sm" />
      </button>
      {mousePos &&
        createPortal(
          <div
            className="fixed pointer-events-none bg-[var(--color-bg-primary)] p-1.5 rounded-lg shadow-xl border border-[var(--color-border)]"
            style={{
              left: mousePos.x + 20,
              top: mousePos.y - 60,
              zIndex: 9999,
            }}
          >
            <img src={dataUrl} alt="" className="w-[120px] h-[120px] object-contain rounded" />
          </div>,
          document.body
        )}
    </>
  )
}

interface GridCellProps {
  column: Column
  rowIndex: number
  colIndex: number
  isPinned: boolean
  leftOffset?: number
  isEvenRow: boolean
  isSubtotal: boolean
  isGrandTotal: boolean
  onContextMenu: (e: React.MouseEvent, row: number, col: number, colName: string, value: unknown) => void
}

export const GridCell = memo(function GridCell({
  column,
  rowIndex,
  colIndex,
  isPinned,
  leftOffset,
  isEvenRow,
  isSubtotal,
  isGrandTotal,
  onContextMenu,
}: GridCellProps) {
  // Use split contexts for better re-render isolation
  const { getRow } = useRowDataContext()
  const { getFormat } = useColumnsContext()
  const { columnStats } = useStatsContext()
  const { getSelectionBounds, selectedCell, dragStateRef, startDrag, updateDrag } = useSelectionContext()
  const { editingCell, startEdit, updateEditValue, cancelEdit, commitEdit } = useEditingContext()
  const { getColumnSize } = useColumnStateContext()

  // Read from stores directly (selective subscriptions)
  const showSparklines = useGridUIStore((s) => s.showSparklines)
  const setImagePreviewUrl = useGridUIStore((s) => s.setImagePreviewUrl)
  const search = useQueryStore((s) => s.search)
  const searchCaseSensitive = useQueryStore((s) => s.searchCaseSensitive)

  const rowData = getRow(rowIndex)
  const rawValue = rowData?.[column.name]

  // Detect if blob is an image
  // Arrow's toJSON() converts Uint8Array to array of numbers, so we need to handle both
  const imageInfo = useMemo(() => {
    if (column.type !== 'blob' || !rawValue) return null

    let blobData: Uint8Array
    if (rawValue instanceof Uint8Array) {
      blobData = rawValue
    } else if (Array.isArray(rawValue)) {
      // Arrow toJSON() converts binary to number array
      blobData = new Uint8Array(rawValue)
    } else {
      return null
    }

    const imageType = detectImageType(blobData)
    if (!imageType) return null
    return {
      type: imageType,
      dataUrl: getCachedDataUrl(blobData, `image/${imageType}`),
    }
  }, [column.type, rawValue])

  // Get format once (now returns stable reference from memoized map)
  const format = getFormat(column.name)

  // Memoize cell text to avoid formatCell computation on every render
  const cellText = useMemo(() => {
    let text = rowData ? formatCell(rawValue, column.type, format) : ''
    if (text === '∅' && isSubtotal) {
      text = colIndex === 0 ? (isGrandTotal ? 'Grand Total' : 'Subtotal') : ''
    }
    return text
  }, [rawValue, column.type, format, rowData, isSubtotal, colIndex, isGrandTotal])

  // Selection state
  const bounds = getSelectionBounds()
  const isInSelection =
    bounds &&
    rowIndex >= bounds.minRow &&
    rowIndex <= bounds.maxRow &&
    colIndex >= bounds.minCol &&
    colIndex <= bounds.maxCol
  const isFocus = selectedCell?.row === rowIndex && selectedCell?.col === colIndex
  const isEditing = editingCell?.row === rowIndex && editingCell?.col === colIndex

  // Sparkline bar - memoized to avoid recalculation on every render
  const stats = columnStats[column.name]
  const numValue = typeof rawValue === 'number' ? rawValue : typeof rawValue === 'bigint' ? Number(rawValue) : null
  const barWidth = useMemo(() => {
    if (!showSparklines || !stats || numValue === null) return 0
    return Math.max(0, Math.min(100, ((numValue - stats.min) / (stats.max - stats.min)) * 100))
  }, [showSparklines, stats, numValue])
  const showBar = barWidth > 0

  // Highlight search matches
  const shouldHighlight = search && column.type === 'string' && cellText

  // Memoize cell style to avoid object recreation on every render
  const cellStyle = useMemo(() => {
    const pinnedBg = isInSelection
      ? 'var(--color-accent-bg)'
      : isGrandTotal
        ? 'var(--color-bg-tertiary)'
        : isSubtotal || !isEvenRow
          ? 'var(--color-bg-secondary)'
          : 'var(--color-bg-primary)'

    const baseStyle: React.CSSProperties = {
      width: getColumnSize(column.name),
      minWidth: 80,
      flexShrink: 0,
      height: '100%',
    }

    if (isPinned && leftOffset !== undefined) {
      return { ...baseStyle, left: leftOffset, zIndex: 20, backgroundColor: pinnedBg }
    }
    return baseStyle
  }, [column.name, isPinned, leftOffset, isInSelection, isGrandTotal, isSubtotal, isEvenRow, getColumnSize])

  // Long-press for context menu on touch devices
  const longPressRef = useRef<{ timeout: number | null; touch: React.Touch | null }>({
    timeout: null,
    touch: null,
  })

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      // Select cell on touch
      const touch = e.touches[0]
      startDrag(rowIndex, colIndex, touch.clientY)

      // Start long-press timer for context menu
      longPressRef.current.touch = touch
      longPressRef.current.timeout = window.setTimeout(() => {
        if (longPressRef.current.touch) {
          // Create a synthetic event with touch coordinates
          const syntheticEvent = {
            preventDefault: () => {},
            clientX: touch.clientX,
            clientY: touch.clientY,
          } as React.MouseEvent
          onContextMenu(syntheticEvent, rowIndex, colIndex, column.name, rawValue)
        }
      }, LONG_PRESS_DURATION)
    },
    [startDrag, rowIndex, colIndex, onContextMenu, column.name, rawValue]
  )

  const handleTouchEnd = useCallback(() => {
    if (longPressRef.current.timeout) {
      clearTimeout(longPressRef.current.timeout)
      longPressRef.current.timeout = null
    }
    longPressRef.current.touch = null
  }, [])

  return (
    // biome-ignore lint/a11y/useSemanticElements: Uses div for flexbox layout and sticky positioning
    // biome-ignore lint/a11y/useFocusableInteractive: Grid handles focus at container level
    <div
      role="gridcell"
      aria-colindex={colIndex + 2}
      aria-selected={isInSelection || isFocus}
      onMouseDown={(e) => {
        if (e.button !== 0) return
        startDrag(rowIndex, colIndex, e.clientY)
      }}
      onMouseEnter={(e) => {
        if (dragStateRef.current.isDragging) {
          updateDrag(rowIndex, colIndex, e.clientY)
        }
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
      onDoubleClick={() => startEdit(rowIndex, colIndex)}
      onContextMenu={(e) => onContextMenu(e, rowIndex, colIndex, column.name, rawValue)}
      className={`px-1.5 border-b border-r border-[var(--color-border-light)] truncate flex items-center relative cursor-pointer select-none ${
        isInSelection ? 'bg-[var(--color-accent)]/20' : ''
      } ${isFocus ? 'ring-2 ring-inset ring-[var(--color-accent)]' : ''} ${isPinned ? 'sticky' : ''}`}
      style={cellStyle}
    >
      {showBar && (
        <div
          className="absolute left-0 top-0 h-full bg-[var(--color-accent)] opacity-20"
          style={{ width: `${barWidth}%` }}
        />
      )}
      {isEditing ? (
        <input
          type={column.type === 'date' ? 'date' : 'text'}
          value={editingCell.value}
          onChange={(e) => updateEditValue(e.target.value, column.type)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitEdit()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              cancelEdit()
            }
            e.stopPropagation()
          }}
          onBlur={commitEdit}
          autoFocus
          aria-label={`Edit ${column.name} value`}
          className={`w-full h-full bg-[var(--color-bg-primary)] border-none outline-none px-0 text-xs ${
            editingCell.isValid === false ? 'ring-2 ring-red-500 ring-inset' : ''
          }`}
        />
      ) : imageInfo ? (
        <ImageThumbnail dataUrl={imageInfo.dataUrl} onClick={() => setImagePreviewUrl(imageInfo.dataUrl)} />
      ) : (
        <span className="relative z-10 data-value">
          {shouldHighlight ? highlightMatch(cellText, search, searchCaseSensitive) : cellText}
        </span>
      )}
    </div>
  )
})
