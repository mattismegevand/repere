import { useGridUIStore } from '@/components/data-grid/stores'
import type { DuckDBClient } from '@/lib/duckdb/interface'
import type { Column, Sort } from '@/types'
import { ColumnHeader } from './ColumnHeader'
import type { ColumnStats } from './charts'
import { ColumnHeaderProvider, useColumnStateContext, useColumnsContext, useRowDataContext } from './context'

interface GridHeaderProps {
  // DuckDB-specific
  client: DuckDBClient
  tableName: string
  // Sort/filter state (from activeNode)
  currentSorts: Sort[]
  activeFilterColumns: string[]
  // Sparkline data
  getSparklineStats: (columnName: string) => ColumnStats | null
  sampleDataCallbacks: Record<string, () => unknown[]>
  // Callbacks
  onAutoFitAll: () => void
  onColumnHeaderContextMenu: (e: React.MouseEvent, colName: string, colType: Column['type']) => void
  onSelectColumnByName: (columnName: string, multiSelect: boolean) => void
  onSortClick: (column: string) => void
  onColumnDrop: (e: React.DragEvent, targetColumnName: string) => Promise<void>
}

export function GridHeader({
  client,
  tableName,
  currentSorts,
  activeFilterColumns,
  getSparklineStats,
  sampleDataCallbacks,
  onAutoFitAll,
  onColumnHeaderContextMenu,
  onSelectColumnByName,
  onSortClick,
  onColumnDrop,
}: GridHeaderProps) {
  // Read from contexts
  const { pinnedCols, scrollableCols, ROW_NUMBER_WIDTH: rowNumberWidth } = useColumnsContext()
  const { totalCount } = useRowDataContext()
  const { getColumnSize, resizeColumn } = useColumnStateContext()

  // Read hover setter from store
  const setHoverColumn = useGridUIStore((s) => s.setHoverColumn)

  return (
    <ColumnHeaderProvider
      client={client}
      tableName={tableName}
      totalCount={totalCount}
      currentSorts={currentSorts}
      activeFilterColumns={activeFilterColumns}
      getSparklineStats={getSparklineStats}
      sampleDataCallbacks={sampleDataCallbacks}
      onHover={setHoverColumn}
      onSortClick={onSortClick}
      onContextMenu={onColumnHeaderContextMenu}
      onSelectColumn={onSelectColumnByName}
      onResize={resizeColumn}
      onDrop={onColumnDrop}
    >
      {/* biome-ignore lint/a11y/useSemanticElements: Uses div for flexbox layout */}
      {/* biome-ignore lint/a11y/useFocusableInteractive: Grid handles focus at container level */}
      <div role="row" aria-rowindex={1} className="sticky top-0 bg-[var(--color-bg-secondary)] z-10 flex text-[11px]">
        {/* biome-ignore lint/a11y/useSemanticElements: Button is more appropriate here than th */}
        <button
          role="columnheader"
          aria-colindex={1}
          aria-label="Row numbers. Click to auto-fit all columns"
          onClick={onAutoFitAll}
          className="py-1 border-b border-r border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] shrink-0 flex items-center justify-center sticky left-0 z-20 bg-[var(--color-bg-secondary)]"
          style={{ width: rowNumberWidth }}
          title="Auto-fit all columns"
        >
          ⊞
        </button>
        {pinnedCols.map((col, pinnedIndex) => {
          const leftOffset =
            rowNumberWidth + pinnedCols.slice(0, pinnedIndex).reduce((sum, c) => sum + getColumnSize(c.name), 0)
          return (
            <ColumnHeader
              key={col.name}
              column={col}
              colIndex={pinnedIndex + 2}
              isPinned={true}
              leftOffset={leftOffset}
            />
          )
        })}
        {scrollableCols.map((col, scrollableIndex) => (
          <ColumnHeader
            key={col.name}
            column={col}
            colIndex={pinnedCols.length + scrollableIndex + 2}
            isPinned={false}
            dataTour={col.name === 'revenue' ? 'revenue-column' : undefined}
          />
        ))}
      </div>
    </ColumnHeaderProvider>
  )
}
