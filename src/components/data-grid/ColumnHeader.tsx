import Pin from 'lucide-react/dist/esm/icons/pin'
import { memo, useEffect, useRef, useState } from 'react'
import { useGridUIStore } from '@/components/data-grid/stores'
import type { Column } from '@/types'
import { ColumnFilter } from './ColumnFilter'
import { ColumnHoverCard } from './ColumnHoverCard'
import { SparklineChart } from './charts'
import { useColumnHeaderContext, useColumnStateContext } from './context'
import { formatCell } from './formatters'
import { FilterIcon, SortAscIcon, SortDescIcon, SortNeutralIcon, TypeIcon } from './TypeIcon'

interface ColumnResizerProps {
  columnId: string
  columnType: Column['type']
  headerText: string
  onResize: (id: string, width: number) => void
  getColumnData: () => unknown[]
}

function ColumnResizer({ columnId, columnType, headerText, onResize, getColumnData }: ColumnResizerProps) {
  const [isResizing, setIsResizing] = useState(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  const startResize = (clientX: number, target: HTMLElement) => {
    setIsResizing(true)
    startXRef.current = clientX
    const th = target.parentElement
    startWidthRef.current = th?.offsetWidth ?? 150
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    startResize(e.clientX, e.target as HTMLElement)

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startXRef.current
      const newWidth = Math.max(80, startWidthRef.current + diff)
      onResize(columnId, newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    startResize(touch.clientX, e.target as HTMLElement)

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0]
      const diff = touch.clientX - startXRef.current
      const newWidth = Math.max(80, startWidthRef.current + diff)
      onResize(columnId, newWidth)
    }

    const handleTouchEnd = () => {
      setIsResizing(false)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }

    document.addEventListener('touchmove', handleTouchMove, { passive: true })
    document.addEventListener('touchend', handleTouchEnd)
  }

  const handleDoubleClick = () => {
    const data = getColumnData()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.font = '11px monospace'
    let maxWidth = ctx.measureText(headerText).width

    for (const value of data) {
      const text = formatCell(value, columnType)
      const width = ctx.measureText(text).width
      if (width > maxWidth) maxWidth = width
    }

    const finalWidth = Math.max(80, Math.min(400, Math.ceil(maxWidth) + 24))
    onResize(columnId, finalWidth)
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onDoubleClick={handleDoubleClick}
      className={`absolute right-0 top-0 h-full w-2 cursor-col-resize select-none opacity-30 group-hover:opacity-100 hover:bg-[var(--color-accent)] touch-resize-handle ${
        isResizing ? 'bg-[var(--color-accent)] opacity-100' : 'bg-[var(--color-border)]'
      }`}
    />
  )
}

interface ColumnHeaderProps {
  column: Column
  colIndex: number
  isPinned: boolean
  leftOffset?: number
  dataTour?: string
}

export const ColumnHeader = memo(function ColumnHeader({
  column,
  colIndex,
  isPinned,
  leftOffset,
  dataTour,
}: ColumnHeaderProps) {
  const headerRef = useRef<HTMLDivElement>(null)
  const [hoverCardFlip, setHoverCardFlip] = useState(false)

  // Get shared context
  const {
    client,
    tableName,
    totalCount,
    currentSorts,
    activeFilterColumns,
    getSparklineStats,
    getSampleData,
    hoverTimeoutRef,
    onMouseEnter,
    onMouseLeave,
    onSortClick,
    onContextMenu,
    onSelectColumn,
    onResize,
    onDrop,
  } = useColumnHeaderContext()

  // Get column width from column state
  const { getColumnSize } = useColumnStateContext()
  const width = getColumnSize(column.name)

  // Read UI state from store with selective subscriptions (only re-render when THIS column's state changes)
  const isHovered = useGridUIStore((s) => s.hoverColumn === column.name)
  const isDragging = useGridUIStore((s) => s.draggedColumn === column.name)
  const isDropTarget = useGridUIStore((s) => s.dropTargetColumn === column.name)
  const showSparklines = useGridUIStore((s) => s.showSparklines)
  const filterColumn = useGridUIStore((s) => s.filterColumn)
  const setFilterColumn = useGridUIStore((s) => s.setFilterColumn)
  const setDraggedColumn = useGridUIStore((s) => s.setDraggedColumn)
  const setDropTargetColumn = useGridUIStore((s) => s.setDropTargetColumn)

  // Compute derived state
  const hasFilter = activeFilterColumns.includes(column.name)
  const sortIndex = currentSorts.findIndex((s) => s.column === column.name)
  const sortInfo = sortIndex >= 0 ? currentSorts[sortIndex] : null
  const totalSorts = currentSorts.length
  const sparklineStats = getSparklineStats(column.name)
  const isFilterOpen = filterColumn?.column === column.name && !filterColumn.position

  // Check if hover card should flip to left side when column is near right edge
  useEffect(() => {
    if (isHovered && headerRef.current) {
      const rect = headerRef.current.getBoundingClientRect()
      const hoverCardWidth = 320
      const shouldFlip = rect.left + hoverCardWidth > window.innerWidth - 20
      setHoverCardFlip(shouldFlip)
    }
  }, [isHovered])

  const isActive = hasFilter || sortInfo !== null
  const stickyClass = isPinned ? 'sticky z-20 bg-[var(--color-bg-secondary)]' : ''
  const activeClass = isActive && !isPinned ? 'bg-[var(--color-accent)]/5' : ''
  const style: React.CSSProperties = {
    width,
    minWidth: 80,
    flexShrink: 0,
    ...(isPinned && leftOffset !== undefined ? { left: leftOffset } : {}),
    ...(isActive ? { borderBottomColor: 'var(--color-accent)', borderBottomWidth: '2px' } : {}),
  }

  const isBlobColumn = column.type === 'blob'
  const shouldReserveSparklineSpace = totalCount > 1 && width >= 140 && !isBlobColumn
  const canShowSparkline = showSparklines && sparklineStats && shouldReserveSparklineSpace
  const ariaSort = sortInfo ? (sortInfo.direction === 'asc' ? 'ascending' : 'descending') : undefined

  // Drag handlers
  const handleDragStart = (e: React.DragEvent) => {
    setDraggedColumn(column.name)
    e.dataTransfer.effectAllowed = 'copyMove'
    e.dataTransfer.setData('text/plain', column.name)
    if (e.currentTarget instanceof HTMLElement) {
      e.dataTransfer.setDragImage(e.currentTarget, 0, 0)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const draggedCol = useGridUIStore.getState().draggedColumn
    if (draggedCol && column.name !== draggedCol) {
      setDropTargetColumn(column.name)
    }
  }

  const handleDragLeave = () => {
    setDropTargetColumn(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    onDrop(e, column.name)
  }

  const handleDragEnd = () => {
    setDraggedColumn(null)
    setDropTargetColumn(null)
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: Uses div for flexbox layout and drag-drop
    // biome-ignore lint/a11y/useFocusableInteractive: Grid handles focus at container level
    <div
      ref={headerRef}
      role="columnheader"
      aria-colindex={colIndex}
      aria-sort={ariaSort}
      aria-label={`${column.name}, ${column.type} column${sortInfo ? `, sorted ${sortInfo.direction === 'asc' ? 'ascending' : 'descending'}` : ''}${hasFilter ? ', filtered' : ''}`}
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
      onContextMenu={(e) => onContextMenu(e, column.name, column.type)}
      className={`text-left px-1.5 py-0.5 border-b border-r border-[var(--color-border)] select-none relative group cursor-grab ${stickyClass} ${activeClass} ${
        isDragging ? 'opacity-50' : ''
      } ${isDropTarget ? 'border-l-2 border-l-[var(--color-accent)]' : ''}`}
      style={style}
      data-tour={dataTour}
      onMouseEnter={() => onMouseEnter(column.name)}
      onMouseLeave={onMouseLeave}
    >
      <div className="flex flex-col">
        <div className="flex items-center gap-1">
          {isPinned && (
            <span title="Pinned column">
              <Pin className="w-3 h-3 text-[var(--color-accent)] flex-shrink-0" />
            </span>
          )}
          <span
            className="cursor-pointer flex-1 truncate font-medium flex items-center gap-1"
            onClick={(e) => onSelectColumn(column.name, e.metaKey || e.ctrlKey)}
          >
            <TypeIcon type={column.type} className="text-[var(--color-text-muted)] flex-shrink-0" />
            {column.name}
          </span>
          {!isBlobColumn && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onSortClick(column.name)
              }}
              className={`p-0.5 hover:bg-[var(--color-bg-tertiary)] rounded flex items-center ${sortInfo ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}
              title={sortInfo ? `Sorted ${sortInfo.direction}` : 'Sort'}
              aria-label={
                sortInfo ? `Sort ${column.name}, currently ${sortInfo.direction}ending` : `Sort ${column.name}`
              }
            >
              {!sortInfo ? <SortNeutralIcon size={12} /> : null}
              {sortInfo?.direction === 'asc' ? <SortAscIcon size={12} /> : null}
              {sortInfo?.direction === 'desc' ? <SortDescIcon size={12} /> : null}
              {sortInfo && totalSorts > 1 && (
                <span className="text-[9px] ml-0.5 w-3 h-3 flex items-center justify-center rounded-full bg-[var(--color-accent)] text-white font-medium">
                  {sortIndex + 1}
                </span>
              )}
            </button>
          )}
          {!isBlobColumn && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setFilterColumn(isFilterOpen ? null : { column: column.name })
              }}
              className={`p-0.5 hover:bg-[var(--color-bg-tertiary)] rounded ${hasFilter ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}
              data-tour={dataTour === 'revenue-column' ? 'filter-button' : undefined}
              title="Filter"
              aria-label={`Filter ${column.name}${hasFilter ? ', filter active' : ''}`}
              aria-pressed={hasFilter}
            >
              <FilterIcon size={12} />
            </button>
          )}
        </div>
        {shouldReserveSparklineSpace && (
          <div
            className="mt-0.5 h-6"
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={(e) => e.stopPropagation()}
            onMouseMove={(e) => e.stopPropagation()}
          >
            {canShowSparkline && (
              <SparklineChart stats={sparklineStats} columnType={column.type} width={width - 12} height={24} />
            )}
          </div>
        )}
      </div>
      {isFilterOpen ? <ColumnFilter column={column} onClose={() => setFilterColumn(null)} /> : null}
      {isHovered && !filterColumn && client && (
        <div
          className={`absolute top-full mt-1 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg shadow-lg ${isPinned ? 'z-30' : 'z-20'} ${hoverCardFlip ? 'right-0' : 'left-0'}`}
          draggable={false}
          onDragStart={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseEnter={() => {
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
          }}
          onMouseLeave={onMouseLeave}
        >
          <ColumnHoverCard client={client!} tableName={tableName} column={column} />
        </div>
      )}
      <ColumnResizer
        columnId={column.name}
        columnType={column.type}
        headerText={column.name}
        onResize={onResize}
        getColumnData={() => getSampleData(column.name)}
      />
    </div>
  )
})
