import { memo, useCallback, useMemo } from 'react'
import { selectIsRowInSelection, useGridSelectionStore } from '@/components/data-grid/stores'
import { useColumnsContext, useColumnVirtualizationContext, useRowDataContext, useSelectionContext } from './context'
import { GridCell } from './GridCell'

interface GridRowProps {
  rowIndex: number
  virtualStart: number
  onContextMenu: (e: React.MouseEvent, row: number, col: number, colName: string, value: unknown) => void
}

export const GridRow = memo(function GridRow({ rowIndex, virtualStart, onContextMenu }: GridRowProps) {
  // Use split contexts for better re-render isolation
  const { getRow } = useRowDataContext()
  const {
    pinnedCols,
    scrollableCols,
    visibleColumns,
    columnIndexMap,
    pinnedLeftOffsets,
    ROW_HEIGHT,
    ROW_NUMBER_WIDTH,
  } = useColumnsContext()
  const { selectRow, dragStateRef, startRowDrag, updateRowDrag } = useSelectionContext()
  const { visibleScrollableCols, totalScrollableWidth, isVirtualized } = useColumnVirtualizationContext()

  // Use row-specific selector to avoid re-rendering when other rows' selection changes
  const isRowInSelection = useGridSelectionStore(useMemo(() => selectIsRowInSelection(rowIndex), [rowIndex]))
  const selectionMode = useGridSelectionStore((s) => s.selection?.mode)
  const isRowSelected = selectionMode === 'row' && isRowInSelection

  const rowData = getRow(rowIndex)
  const isEvenRow = rowIndex % 2 === 0

  // Pivot subtotal/grand total detection
  const rowType = typeof rowData?._row_type === 'number' ? rowData._row_type : 0
  const isSubtotal = rowType > 0
  const isGrandTotal = rowData?._sort_group === null && rowType > 0

  // Memoize row classes to avoid string recreation on every render
  const rowClassName = useMemo(() => {
    const bgClass = isGrandTotal
      ? 'bg-[var(--color-bg-tertiary)]'
      : isSubtotal
        ? 'bg-[var(--color-bg-secondary)]'
        : isEvenRow
          ? 'bg-[var(--color-bg-primary)]'
          : 'bg-[var(--color-bg-secondary)]'
    const fontClass = isGrandTotal ? 'font-bold' : isSubtotal ? 'font-semibold' : ''
    return `flex absolute hover:bg-[var(--color-accent-bg)] ${fontClass} ${bgClass}`
  }, [isGrandTotal, isSubtotal, isEvenRow])

  // Total columns for selection functions
  const totalCols = visibleColumns.length

  // Handle row number mouse down for row selection (supports drag)
  const handleRowNumberMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      if (e.shiftKey) {
        // Shift+click extends selection
        selectRow(rowIndex, true, totalCols)
      } else {
        // Regular click starts drag selection
        startRowDrag(rowIndex, e.clientY, totalCols)
      }
    },
    [selectRow, startRowDrag, rowIndex, totalCols]
  )

  // Handle mouse enter on row number during drag
  const handleRowNumberMouseEnter = useCallback(
    (e: React.MouseEvent) => {
      if (dragStateRef.current.isDragging && dragStateRef.current.mode === 'row') {
        updateRowDrag(rowIndex, e.clientY, totalCols)
      }
    },
    [dragStateRef, updateRowDrag, rowIndex, totalCols]
  )

  // Use shared column index map from context (computed once, not per row)
  const getColumnIndex = useCallback((colName: string) => columnIndexMap.get(colName) ?? -1, [columnIndexMap])

  return (
    // biome-ignore lint/a11y/useSemanticElements: Uses div for flexbox layout and virtualization
    // biome-ignore lint/a11y/useFocusableInteractive: Grid handles focus at container level
    <div
      role="row"
      aria-rowindex={rowIndex + 2}
      data-row={rowIndex}
      className={rowClassName}
      style={{
        height: ROW_HEIGHT,
        transform: `translateY(${virtualStart}px)`,
      }}
    >
      {/* Row number - sticky with solid background, clickable for row selection */}
      {/* biome-ignore lint/a11y/useSemanticElements: Uses div for sticky positioning */}
      {/* biome-ignore lint/a11y/useFocusableInteractive: Grid handles focus at container level */}
      <div
        role="rowheader"
        aria-colindex={1}
        aria-label={`Row ${rowIndex + 1}`}
        aria-selected={isRowSelected || undefined}
        onMouseDown={handleRowNumberMouseDown}
        onMouseEnter={handleRowNumberMouseEnter}
        className={`border-b border-r border-[var(--color-border-light)] text-[10px] flex items-center justify-center shrink-0 sticky left-0 cursor-pointer select-none hover:bg-[var(--color-accent-bg)] ${
          isRowSelected ? 'bg-[var(--color-accent)]/30 text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'
        }`}
        style={{
          width: ROW_NUMBER_WIDTH,
          zIndex: 20,
          backgroundColor: isRowSelected
            ? undefined // Let the class handle it
            : isGrandTotal
              ? 'var(--color-bg-tertiary)'
              : isSubtotal || !isEvenRow
                ? 'var(--color-bg-secondary)'
                : 'var(--color-bg-primary)',
        }}
      >
        {rowIndex + 1}
      </div>

      {/* Pinned cells - sticky */}
      {pinnedCols.map((col, pinnedIndex) => (
        <GridCell
          key={col.name}
          column={col}
          rowIndex={rowIndex}
          colIndex={getColumnIndex(col.name)}
          isPinned={true}
          leftOffset={pinnedLeftOffsets[pinnedIndex]}
          isEvenRow={isEvenRow}
          isSubtotal={isSubtotal}
          isGrandTotal={isGrandTotal}
          onContextMenu={onContextMenu}
        />
      ))}

      {/* Scrollable cells - virtualized when enabled */}
      {isVirtualized && visibleScrollableCols.length > 0 ? (
        <>
          {/* Left spacer to offset visible columns */}
          {visibleScrollableCols[0].start > 0 && (
            <div style={{ width: visibleScrollableCols[0].start, flexShrink: 0 }} aria-hidden="true" />
          )}
          {/* Render only visible columns */}
          {visibleScrollableCols.map((virtualCol) => {
            const colIndex = getColumnIndex(virtualCol.column.name)
            return (
              <GridCell
                key={virtualCol.column.name}
                column={virtualCol.column}
                rowIndex={rowIndex}
                colIndex={colIndex}
                isPinned={false}
                isEvenRow={isEvenRow}
                isSubtotal={isSubtotal}
                isGrandTotal={isGrandTotal}
                onContextMenu={onContextMenu}
              />
            )
          })}
          {/* Right spacer to maintain total width */}
          {(() => {
            const lastCol = visibleScrollableCols[visibleScrollableCols.length - 1]
            const usedWidth = lastCol.start + lastCol.size
            const remainingWidth = totalScrollableWidth - usedWidth
            return remainingWidth > 0 ? (
              <div style={{ width: remainingWidth, flexShrink: 0 }} aria-hidden="true" />
            ) : null
          })()}
        </>
      ) : (
        // Fallback: render all scrollable columns when not virtualized
        scrollableCols.map((col) => {
          const colIndex = getColumnIndex(col.name)
          return (
            <GridCell
              key={col.name}
              column={col}
              rowIndex={rowIndex}
              colIndex={colIndex}
              isPinned={false}
              isEvenRow={isEvenRow}
              isSubtotal={isSubtotal}
              isGrandTotal={isGrandTotal}
              onContextMenu={onContextMenu}
            />
          )
        })
      )}
    </div>
  )
})
