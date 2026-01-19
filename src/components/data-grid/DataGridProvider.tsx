import type { ReactNode } from 'react'
import type { NumberFormat } from '@/stores'
import type { Column } from '@/types'
import {
  type ColumnStat,
  ColumnStateProvider,
  type ColumnVirtualizationContextValue,
  ColumnVirtualizationProvider,
  DataProvider,
  VirtualScrollProvider,
  type VirtualScrollState,
} from './context'

export const ROW_HEIGHT = 22

export interface DataGridProviderProps {
  children: ReactNode

  // Data
  columns: Column[]
  visibleColumns: Column[]
  pinnedCols: Column[]
  scrollableCols: Column[]
  getRow: (index: number) => Record<string, unknown> | undefined
  totalCount: number
  prefetchRange: (start: number, end: number) => void

  // Column state
  getColumnSize: (name: string) => number
  resizeColumn: (name: string, width: number) => void
  pinnedColumns: Set<string>
  hiddenColumns: Set<string>
  toggleColumnPin: (name: string) => void
  toggleColumnVisibility: (name: string) => void

  // Formatting (computed)
  getFormat: (column?: string) => NumberFormat
  columnStats: Record<string, ColumnStat>

  // Virtual scroll
  virtualScroll: VirtualScrollState | null

  // Column virtualization
  columnVirtualization: ColumnVirtualizationContextValue | null

  // Dimensions
  rowNumberWidth: number
}

export function DataGridProvider({
  children,
  columns,
  visibleColumns,
  pinnedCols,
  scrollableCols,
  getRow,
  totalCount,
  prefetchRange,
  getColumnSize,
  resizeColumn,
  pinnedColumns,
  hiddenColumns,
  toggleColumnPin,
  toggleColumnVisibility,
  getFormat,
  columnStats,
  virtualScroll,
  columnVirtualization,
  rowNumberWidth,
}: DataGridProviderProps) {
  // Default column virtualization value when not enabled
  const colVirtValue: ColumnVirtualizationContextValue = columnVirtualization ?? {
    visibleScrollableCols: [],
    totalScrollableWidth: 0,
    isVirtualized: false,
  }

  return (
    <DataProvider
      columns={columns}
      visibleColumns={visibleColumns}
      pinnedCols={pinnedCols}
      scrollableCols={scrollableCols}
      getRow={getRow}
      totalCount={totalCount}
      prefetchRange={prefetchRange}
      getFormat={getFormat}
      columnStats={columnStats}
      getColumnSize={getColumnSize}
      ROW_HEIGHT={ROW_HEIGHT}
      ROW_NUMBER_WIDTH={rowNumberWidth}
    >
      <ColumnStateProvider
        getColumnSize={getColumnSize}
        resizeColumn={resizeColumn}
        pinnedColumns={pinnedColumns}
        hiddenColumns={hiddenColumns}
        toggleColumnPin={toggleColumnPin}
        toggleColumnVisibility={toggleColumnVisibility}
      >
        <VirtualScrollProvider value={virtualScroll}>
          <ColumnVirtualizationProvider value={colVirtValue}>{children}</ColumnVirtualizationProvider>
        </VirtualScrollProvider>
      </ColumnStateProvider>
    </DataProvider>
  )
}
