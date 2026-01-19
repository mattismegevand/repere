import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDuckDB } from '@/lib/duckdb'
import { useFilterApply } from '@/lib/hooks/useFilterApply'
import { usePipeline } from '@/lib/pipeline/usePipeline'
import {
  selectSelectedCol,
  selectSelectedRow,
  useDialogStore,
  useGridEditingStore,
  useGridSelectionStore,
  useGridUIStore,
  usePanelStore,
  useQueryStore,
  useThemeStore,
} from '@/stores'
import type { DataView } from '@/types'
import { useColumnStats } from './charts'
import { GridActionsProvider } from './context'
import { DataGridProvider, ROW_HEIGHT } from './DataGridProvider'
import { FilterBar } from './FilterBar'
import { formatCell } from './formatters'
import { GridBody } from './GridBody'
import { GridContextMenus } from './GridContextMenus'
import { GridEmptyState } from './GridEmptyState'
import { GridHeader } from './GridHeader'
import {
  DeleteConfirmDialog,
  FilterColumnPopup,
  ImagePreviewModal,
  RowJumpPrompt,
  VisualModeIndicator,
} from './GridModals'
import { GridOverlays } from './GridOverlays'
import { GridToolbar } from './GridToolbar'
import {
  useCellCommit,
  useClipboardActions,
  useColumnOutlierStats,
  useColumnState,
  useColumnVirtualization,
  useContextMenuActions,
  useFilterBarHandlers,
  useFilterExpression,
  useGridData,
  useKeyboardNavigation,
  useSelectionStats,
  useSortHandling,
} from './hooks'
import { useVirtualScroll } from './hooks/useVirtualScroll'
import { formatValueForEdit, parseEditValue, validateEditValue } from './utils/cell-editing'
import { VirtualScrollbar } from './VirtualScrollbar'

const HEADER_HEIGHT = 26

function getRowNumberWidth(totalCount: number): number {
  const digits = Math.max(1, Math.floor(Math.log10(Math.max(1, totalCount))) + 1)
  return Math.max(32, 12 + digits * 8)
}

export function DataGrid() {
  const { client } = useDuckDB()
  const {
    activeNode,
    activeNodeId,
    nodes,
    applyOrReplaceOperation,
    removeCurrentOperation,
    forceRemoveCurrentOperation,
    undo,
    redo,
    canUndo,
    canRedo,
  } = usePipeline()
  const { applyFilter } = useFilterApply()
  // Use individual selectors for data to avoid unnecessary re-renders
  const search = useQueryStore((s) => s.search)
  const searchCaseSensitive = useQueryStore((s) => s.searchCaseSensitive)
  // Actions are stable references, can destructure
  const { setSearch, reset: resetQuery } = useQueryStore()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [rowJumpValue, setRowJumpValue] = useState<string | null>(null)
  const rowJumpInputRef = useRef<HTMLInputElement>(null)

  // Data fetching hook
  // Use viewSql as cacheKey for views - it changes whenever the operation changes
  const viewCacheKey = activeNode?.type === 'view' ? (activeNode as DataView).viewSql : undefined
  const { totalCount, getRow, prefetchRange, getSampleRows, invalidateCache } = useGridData({
    tableName: activeNode?.tableName,
    columns: activeNode?.columns ?? [],
    search,
    searchCaseSensitive,
    cacheKey: viewCacheKey,
  })

  // Store getSampleRows in ref to avoid callback dependency cascades
  const getSampleRowsRef = useRef(getSampleRows)
  getSampleRowsRef.current = getSampleRows

  const rowNumberWidth = getRowNumberWidth(activeNode?.rowCount ?? 0)

  // Column state hook
  const {
    hiddenColumns,
    pinnedColumns,
    visibleColumns,
    pinnedCols,
    scrollableCols,
    displayColumns,
    toggleColumnVisibility,
    toggleColumnPin,
    resizeColumn,
    setAllColumnSizes,
    getColumnSize,
  } = useColumnState({
    columns: activeNode?.columns ?? [],
    storageKey: activeNode?.tableName,
  })

  // Cell editing state from store
  const editingCell = useGridEditingStore((s) => s.editingCell)
  const clearEditingCell = useGridEditingStore((s) => s.clearEditingCell)
  const setCommitEditCallback = useGridEditingStore((s) => s.setCommitEditCallback)

  // Selection state from store
  const selection = useGridSelectionStore((s) => s.selection)
  const selectedRow = useGridSelectionStore(selectSelectedRow)
  const selectedCol = useGridSelectionStore(selectSelectedCol)
  const selectedCell = useMemo(
    () => (selectedRow !== null && selectedCol !== null ? { row: selectedRow, col: selectedCol } : null),
    [selectedRow, selectedCol]
  )
  const selectCell = useGridSelectionStore((s) => s.selectCell)
  const selectColumn = useGridSelectionStore((s) => s.selectColumn)
  const clearSelection = useGridSelectionStore((s) => s.clearSelection)
  const getSelectionBounds = useGridSelectionStore((s) => s.getSelectionBounds)

  // Grid UI state from store
  const filterColumn = useGridUIStore((s) => s.filterColumn)
  const setFilterColumn = useGridUIStore((s) => s.setFilterColumn)
  const confirmDelete = useGridUIStore((s) => s.confirmDelete)
  const setConfirmDelete = useGridUIStore((s) => s.setConfirmDelete)
  const showSparklines = useGridUIStore((s) => s.showSparklines)
  const contextMenu = useGridUIStore((s) => s.contextMenu)
  const setContextMenu = useGridUIStore((s) => s.setContextMenu)
  const setColumnHeaderMenu = useGridUIStore((s) => s.setColumnHeaderMenu)
  const closeAllMenus = useGridUIStore((s) => s.closeAllMenus)
  const setImagePreviewUrl = useGridUIStore((s) => s.setImagePreviewUrl)

  // Column stats (computed from DuckDB, not in store)
  const [columnStats, setColumnStats] = useState<
    Record<string, { min: number; max: number; outlierLower?: number; outlierUpper?: number }>
  >({})

  // Selection stats
  const selectionStats = useSelectionStats({
    client,
    tableName: activeNode?.tableName,
    visibleColumns,
    getSelectionBounds,
  })

  // Extended column stats for header sparklines
  const { getStats: getSparklineStats, prefetchAll: prefetchSparklineStats } = useColumnStats(
    client,
    activeNode?.tableName ?? '',
    activeNode?.columns ?? []
  )

  // Prefetch sparkline stats when sparklines are enabled
  useEffect(() => {
    if (showSparklines && activeNode) {
      prefetchSparklineStats()
    }
  }, [showSparklines, activeNode?.tableName, prefetchSparklineStats])

  const parentRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [viewportHeight, setViewportHeight] = useState(600)
  const imagePreviewUrl = useGridUIStore((s) => s.imagePreviewUrl)

  // Reset state when switching nodes
  useEffect(() => {
    // Reset query filters/search when node changes
    resetQuery()
    if (activeNodeId) {
      selectCell(0, 0)
      // Focus the grid so keyboard navigation works immediately
      parentRef.current?.focus()
    } else {
      clearSelection()
    }
  }, [activeNodeId, selectCell, clearSelection, resetQuery])

  // Measure viewport height (debounced to avoid layout thrashing)
  useEffect(() => {
    if (!containerRef.current) return

    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height ?? 600
      // Debounce to avoid triggering re-renders on every pixel change
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        setViewportHeight(Math.max(100, height - HEADER_HEIGHT))
      }, 100)
    })

    observer.observe(containerRef.current)
    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      observer.disconnect()
    }
  }, [])

  // Virtual scroll state
  const virtualScroll = useVirtualScroll({
    totalRows: totalCount,
    rowHeight: ROW_HEIGHT,
    viewportHeight,
    overscan: 20,
  })

  // Column virtualization - compute pinned width for offset calculation
  const pinnedWidth = useMemo(() => {
    let width = rowNumberWidth
    for (const col of pinnedCols) {
      width += getColumnSize(col.name)
    }
    return width
  }, [pinnedCols, getColumnSize, rowNumberWidth])

  // Column virtualization hook - only render visible columns
  const columnVirtualization = useColumnVirtualization({
    scrollableCols,
    getColumnSize,
    scrollContainerRef: parentRef,
    pinnedWidth,
    overscan: 2,
  })

  // Build column virtualization context value
  const columnVirtContextValue = useMemo(
    () => ({
      visibleScrollableCols: columnVirtualization.visibleColumns,
      totalScrollableWidth: columnVirtualization.totalScrollableWidth,
      isVirtualized: scrollableCols.length > 10, // Only virtualize if many columns
    }),
    [columnVirtualization.visibleColumns, columnVirtualization.totalScrollableWidth, scrollableCols.length]
  )

  // Store virtual scroll functions in refs to avoid stale closures in event handlers
  const scrollByRowsRef = useRef(virtualScroll.scrollByRows)
  scrollByRowsRef.current = virtualScroll.scrollByRows
  const scrollRowRef = useRef(virtualScroll.scrollRow)
  scrollRowRef.current = virtualScroll.scrollRow
  const setScrollRowRef = useRef(virtualScroll.setScrollRow)
  setScrollRowRef.current = virtualScroll.setScrollRow

  // Handle wheel events for virtual scrolling
  useEffect(() => {
    const element = parentRef.current
    if (!element) return

    const handleWheel = (e: WheelEvent) => {
      // Only handle vertical scroll
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault()
        const deltaRows = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY : e.deltaY / ROW_HEIGHT
        scrollByRowsRef.current(deltaRows)
      }
    }

    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => element.removeEventListener('wheel', handleWheel)
  }, []) // No dependencies - handler uses ref

  // Handle touch events for virtual scrolling on mobile
  const touchStartRef = useRef<{ y: number; scrollRow: number } | null>(null)

  useEffect(() => {
    const element = parentRef.current
    if (!element) return

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      touchStartRef.current = {
        y: touch.clientY,
        scrollRow: scrollRowRef.current,
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStartRef.current) return
      const touch = e.touches[0]
      const deltaY = touchStartRef.current.y - touch.clientY
      const deltaRows = deltaY / ROW_HEIGHT
      const newScrollRow = touchStartRef.current.scrollRow + deltaRows
      setScrollRowRef.current(newScrollRow)
    }

    const handleTouchEnd = () => {
      touchStartRef.current = null
    }

    element.addEventListener('touchstart', handleTouchStart, { passive: true })
    element.addEventListener('touchmove', handleTouchMove, { passive: true })
    element.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchmove', handleTouchMove)
      element.removeEventListener('touchend', handleTouchEnd)
    }
  }, []) // No dependencies - handlers use refs

  // Use individual selectors for data to avoid unnecessary re-renders
  const numberFormat = useThemeStore((s) => s.numberFormat)
  const columnNumberFormats = useThemeStore((s) => s.columnNumberFormats)
  const {
    saveScrollPosition: saveScroll,
    setFilterEditor,
    setCanvasMode,
    openChartPanel,
    openCommandPalette,
  } = usePanelStore()
  const { openDialog } = useDialogStore()

  // Pre-compute merged formats to avoid creating new objects on every getFormat call
  const mergedFormats = useMemo(() => {
    const merged: Record<string, typeof numberFormat> = {}
    for (const [col, override] of Object.entries(columnNumberFormats)) {
      merged[col] = { ...numberFormat, ...override }
    }
    return merged
  }, [numberFormat, columnNumberFormats])

  // Helper to get effective format - returns stable references from memoized map
  const getFormat = useCallback(
    (column?: string) => {
      if (!column) return numberFormat
      return mergedFormats[column] ?? numberFormat
    },
    [numberFormat, mergedFormats]
  )

  // Clipboard actions
  const { handleCopySelection, handleCopyRowCsv } = useClipboardActions({
    activeNode,
    visibleColumns,
    selection,
    getRow,
    getFormat,
    contextMenu,
    closeAllMenus,
  })

  // Column drop handler (drag state is now in gridUIStore, handled by ColumnHeader)
  const handleColumnDrop = useCallback(
    async (e: React.DragEvent, targetColName: string) => {
      e.preventDefault()
      const { draggedColumn, setDraggedColumn, setDropTargetColumn } = useGridUIStore.getState()
      if (!draggedColumn || draggedColumn === targetColName || !activeNode) {
        setDraggedColumn(null)
        setDropTargetColumn(null)
        return
      }

      const currentOrder = activeNode.columns.map((c) => c.name)
      const dragIndex = currentOrder.indexOf(draggedColumn)
      const dropIndex = currentOrder.indexOf(targetColName)

      if (dragIndex === -1 || dropIndex === -1) {
        setDraggedColumn(null)
        setDropTargetColumn(null)
        return
      }

      const newOrder = [...currentOrder]
      newOrder.splice(dragIndex, 1)
      newOrder.splice(dropIndex, 0, draggedColumn)

      setDraggedColumn(null)
      setDropTargetColumn(null)

      await applyOrReplaceOperation({
        type: 'reorderColumns',
        order: newOrder,
      })
    },
    [activeNode, applyOrReplaceOperation]
  )

  // Get current filters from the active view's operation
  const { currentFilters, filterExpression, filterCombineMode, filterIsComplex, filterCount, activeFilterColumns } =
    useFilterExpression({ activeNode })

  // Context menu actions
  const { handleContextMenu, handleColumnHeaderContextMenu } = useContextMenuActions({
    contextMenu,
    activeNode,
    activeNodeId,
    visibleColumns,
    filterExpression,
    applyFilter,
    toggleColumnVisibility,
    toggleColumnPin,
    setContextMenu,
    setColumnHeaderMenu,
    closeAllMenus,
  })

  // FilterBar handlers
  const { handleRemoveFilter, handleClearAllFilters, handleEditFilter, handleAddFilter } = useFilterBarHandlers({
    filterExpression,
    removeCurrentOperation,
    applyFilter,
    setConfirmDelete,
    setFilterColumn,
  })

  // Helper to save scroll position before operations
  const saveScrollPosition = useCallback(
    (includeRow = true) => {
      const row = includeRow ? (selectedCell?.row ?? null) : null
      const scrollLeft = parentRef.current?.scrollLeft ?? 0
      saveScroll(row, scrollLeft)
    },
    [selectedCell?.row, saveScroll]
  )

  // Column outlier stats (for sparklines and outlier highlighting)
  useColumnOutlierStats({
    client,
    tableName: activeNode?.tableName,
    columns: activeNode?.columns,
    setColumnStats,
  })

  // Sort handling
  const { currentSorts, handleSortClick, handleSortChipClick, handleSortChipRemove } = useSortHandling({
    activeNode,
    applyOrReplaceOperation,
    removeCurrentOperation,
    saveScrollPosition,
    setConfirmDelete,
  })

  // Keyboard navigation (must be after currentSorts and handleSortClick are defined)
  // Reads selection/editing/column state from stores internally
  const { handleKeyDown, visualMode } = useKeyboardNavigation({
    activeNode,
    activeNodeId,
    visibleColumns,
    displayColumns,
    totalCount,
    virtualScroll,
    currentSorts,
    handleCopySelection,
    handleCopyRowCsv,
    handleSortClick,
    invalidateCache,
    searchInputRef,
    rowJumpInputRef,
    setRowJumpValue,
    setSearch,
    openCommandPalette,
    setCanvasMode,
    openChartPanel,
    openDialog,
    undo,
    redo,
    canUndo,
    canRedo,
  })

  // Handle column selection by name - for ColumnHeader which uses column names
  const handleSelectColumnByName = useCallback(
    (columnName: string, multiSelect: boolean) => {
      const colIndex = visibleColumns.findIndex((c) => c.name === columnName)
      if (colIndex === -1) return
      selectColumn(colIndex, multiSelect, totalCount)
    },
    [visibleColumns, selectColumn, totalCount]
  )

  const handleAutoFitAll = useCallback(() => {
    if (!activeNode) return

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.font = '13px monospace'

    const newSizes: Record<string, number> = {}

    for (const col of activeNode.columns) {
      const typeLabel = col.type.toUpperCase()
      const headerText = `${col.name} [${typeLabel}]`
      let maxWidth = ctx.measureText(headerText).width

      for (const row of getSampleRows(100)) {
        const text = formatCell(row[col.name], col.type, getFormat(col.name))
        const width = ctx.measureText(text).width
        if (width > maxWidth) maxWidth = width
      }

      newSizes[col.name] = Math.max(80, Math.min(400, Math.ceil(maxWidth) + 24))
    }

    setAllColumnSizes(newSizes)
  }, [activeNode, getSampleRows, getFormat, setAllColumnSizes])

  // Key by column names, not array reference, to avoid thrashing when columns haven't changed
  const columnNamesKey = visibleColumns.map((c) => c.name).join(',')

  // Memoized getSampleData callbacks per column to avoid breaking ColumnHeader memo
  const sampleDataCallbacks = useMemo(() => {
    const callbacks: Record<string, () => unknown[]> = {}
    for (const col of visibleColumns) {
      callbacks[col.name] = () => getSampleRowsRef.current(100).map((row) => row[col.name])
    }
    return callbacks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnNamesKey])

  // Cell commit hook - register callback with store
  const getScrollLeft = useCallback(() => parentRef.current?.scrollLeft ?? 0, [])
  const { commitEdit: handleCommitEdit } = useCellCommit({
    editingCell,
    activeNode,
    visibleColumns,
    client,
    nodes,
    getRow,
    validateEditValue,
    formatValueForEdit,
    parseValue: parseEditValue,
    clearEditingCell,
    applyOrReplaceOperation,
    removeCurrentOperation,
    saveScrollPosition: saveScroll,
    getScrollLeft,
  })

  // Register the commit callback with the store so child components can call it
  useEffect(() => {
    setCommitEditCallback(handleCommitEdit)
    return () => setCommitEditCallback(null)
  }, [handleCommitEdit, setCommitEditCallback])

  // Memoize total width calculation
  const totalWidth = useMemo(() => {
    const pinned = pinnedCols.reduce((sum, col) => sum + getColumnSize(col.name), 0)
    const scrollable = scrollableCols.reduce((sum, col) => sum + getColumnSize(col.name), 0)
    return rowNumberWidth + pinned + scrollable
  }, [pinnedCols, scrollableCols, getColumnSize, rowNumberWidth])

  if (!activeNode || !client) return null

  return (
    <div className="flex flex-col h-full">
      <GridToolbar
        columns={activeNode.columns}
        totalCount={totalCount}
        currentSorts={currentSorts}
        onSortChipClick={handleSortChipClick}
        onSortChipRemove={handleSortChipRemove}
        currentFilters={currentFilters}
        onOpenFilterEditor={() => setFilterEditor(true)}
        searchInputRef={searchInputRef}
      />

      {/* Filter bar */}
      {currentFilters.length > 0 && (
        <FilterBar
          filters={currentFilters}
          filterExpression={filterExpression}
          columns={activeNode.columns}
          combineMode={filterCombineMode}
          isComplex={filterIsComplex}
          filterCount={filterCount}
          onRemoveFilter={handleRemoveFilter}
          onClearAll={handleClearAllFilters}
          onEditFilter={handleEditFilter}
          onAddFilter={handleAddFilter}
          onOpenEditor={() => setFilterEditor(true)}
        />
      )}

      {confirmDelete && (
        <DeleteConfirmDialog
          confirmDelete={confirmDelete}
          onConfirm={() => {
            forceRemoveCurrentOperation()
            setConfirmDelete(null)
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      <div ref={containerRef} className="flex-1 relative">
        <DataGridProvider
          columns={activeNode.columns}
          visibleColumns={visibleColumns}
          pinnedCols={pinnedCols}
          scrollableCols={scrollableCols}
          getRow={getRow}
          totalCount={totalCount}
          prefetchRange={prefetchRange}
          getColumnSize={getColumnSize}
          resizeColumn={resizeColumn}
          pinnedColumns={pinnedColumns}
          hiddenColumns={hiddenColumns}
          toggleColumnPin={toggleColumnPin}
          toggleColumnVisibility={toggleColumnVisibility}
          getFormat={getFormat}
          columnStats={columnStats}
          virtualScroll={virtualScroll}
          columnVirtualization={columnVirtContextValue}
          rowNumberWidth={rowNumberWidth}
        >
          {/* biome-ignore lint/a11y/useSemanticElements: Grid uses divs for flexbox layout, virtualization, and sticky columns - native table elements don't support these features */}
          <div
            ref={parentRef}
            role="grid"
            aria-label={`Data grid for ${activeNode.tableName}`}
            aria-rowcount={totalCount + 1}
            aria-colcount={visibleColumns.length + 1}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            className="absolute inset-0 overflow-x-auto overflow-y-hidden virtual-scroll-container focus:outline-none"
            style={{ right: totalCount > virtualScroll.visibleRows ? 8 : 0 }}
          >
            <div style={{ width: totalWidth, minWidth: '100%' }}>
              <GridHeader
                client={client}
                tableName={activeNode.tableName}
                currentSorts={currentSorts}
                activeFilterColumns={activeFilterColumns}
                getSparklineStats={getSparklineStats}
                sampleDataCallbacks={sampleDataCallbacks}
                onAutoFitAll={handleAutoFitAll}
                onColumnHeaderContextMenu={handleColumnHeaderContextMenu}
                onSelectColumnByName={handleSelectColumnByName}
                onSortClick={handleSortClick}
                onColumnDrop={handleColumnDrop}
              />
              {totalCount === 0 ? (
                <GridEmptyState
                  type={search ? 'search-empty' : currentFilters.length > 0 ? 'filtered-empty' : 'no-data'}
                  onClearSearch={() => setSearch('')}
                  onClearFilters={handleClearAllFilters}
                />
              ) : (
                <GridBody
                  key={activeNodeId ?? 'none'}
                  parentRef={parentRef}
                  activeNodeId={activeNodeId}
                  onContextMenu={handleContextMenu}
                />
              )}
            </div>
          </div>
          <GridActionsProvider
            filterExpression={filterExpression}
            currentSorts={currentSorts}
            applyFilter={applyFilter}
          >
            <GridContextMenus />
          </GridActionsProvider>
        </DataGridProvider>

        {/* Virtual Scrollbar */}
        <VirtualScrollbar
          totalRows={totalCount}
          visibleRows={virtualScroll.visibleRows}
          scrollRow={virtualScroll.scrollRow}
          maxScrollRow={virtualScroll.maxScrollRow}
          onScrollChange={virtualScroll.setScrollRow}
          className="absolute right-0 top-0 bottom-0 z-20"
        />

        <GridOverlays selectionStats={selectionStats} />
        <VisualModeIndicator visible={visualMode} />
      </div>

      {filterColumn?.position && (
        <FilterColumnPopup
          filterColumn={{ column: filterColumn.column, position: filterColumn.position }}
          columns={activeNode.columns}
          onClose={() => setFilterColumn(null)}
        />
      )}

      {rowJumpValue !== null && (
        <RowJumpPrompt
          value={rowJumpValue}
          totalCount={totalCount}
          inputRef={rowJumpInputRef}
          onValueChange={setRowJumpValue}
          onJump={(rowNum) => selectCell(rowNum - 1, selectedCell?.col ?? 0)}
          onClose={() => setRowJumpValue(null)}
        />
      )}

      {imagePreviewUrl && <ImagePreviewModal url={imagePreviewUrl} onClose={() => setImagePreviewUrl(null)} />}
    </div>
  )
}
