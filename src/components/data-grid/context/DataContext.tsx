import { createContext, type ReactNode, useContext, useMemo } from 'react'
import type { NumberFormat } from '@/stores'
import type { Column } from '@/types'

export interface ColumnStat {
  min: number
  max: number
  outlierLower?: number
  outlierUpper?: number
}

// Split into 3 contexts for fine-grained re-renders:
// 1. ColumnsContext - column structure, rarely changes
// 2. RowDataContext - data access, changes on query
// 3. StatsContext - sparkline stats, changes async

// === ColumnsContext (rarely changes) ===
export interface ColumnsContextValue {
  columns: Column[]
  visibleColumns: Column[]
  pinnedCols: Column[]
  scrollableCols: Column[]
  columnIndexMap: Map<string, number>
  pinnedLeftOffsets: number[]
  getFormat: (column?: string) => NumberFormat
  ROW_HEIGHT: number
  ROW_NUMBER_WIDTH: number
}

const ColumnsContext = createContext<ColumnsContextValue | null>(null)

export function useColumnsContext(): ColumnsContextValue {
  const ctx = useContext(ColumnsContext)
  if (!ctx) throw new Error('useColumnsContext must be used within DataProvider')
  return ctx
}

// === RowDataContext (changes on query/fetch) ===
export interface RowDataContextValue {
  getRow: (index: number) => Record<string, unknown> | undefined
  totalCount: number
  prefetchRange: (start: number, end: number) => void
}

const RowDataContext = createContext<RowDataContextValue | null>(null)

export function useRowDataContext(): RowDataContextValue {
  const ctx = useContext(RowDataContext)
  if (!ctx) throw new Error('useRowDataContext must be used within DataProvider')
  return ctx
}

// === StatsContext (changes async when stats load) ===
export interface StatsContextValue {
  columnStats: Record<string, ColumnStat>
}

const StatsContext = createContext<StatsContextValue | null>(null)

export function useStatsContext(): StatsContextValue {
  const ctx = useContext(StatsContext)
  if (!ctx) throw new Error('useStatsContext must be used within DataProvider')
  return ctx
}

// === Provider ===
interface DataProviderProps {
  children: ReactNode
  columns: Column[]
  visibleColumns: Column[]
  pinnedCols: Column[]
  scrollableCols: Column[]
  getRow: (index: number) => Record<string, unknown> | undefined
  totalCount: number
  prefetchRange: (start: number, end: number) => void
  getFormat: (column?: string) => NumberFormat
  columnStats: Record<string, ColumnStat>
  getColumnSize: (name: string) => number
  ROW_HEIGHT: number
  ROW_NUMBER_WIDTH: number
}

export function DataProvider({
  children,
  columns,
  visibleColumns,
  pinnedCols,
  scrollableCols,
  getRow,
  totalCount,
  prefetchRange,
  getFormat,
  columnStats,
  getColumnSize,
  ROW_HEIGHT,
  ROW_NUMBER_WIDTH,
}: DataProviderProps) {
  // Pre-compute column index map once (shared across all rows)
  const columnIndexMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const [idx, col] of visibleColumns.entries()) {
      map.set(col.name, idx)
    }
    return map
  }, [visibleColumns])

  // Pre-compute pinned column offsets once (shared across all rows)
  const pinnedLeftOffsets = useMemo(() => {
    const offsets: number[] = []
    let cumulative = ROW_NUMBER_WIDTH
    for (const col of pinnedCols) {
      offsets.push(cumulative)
      cumulative += getColumnSize(col.name)
    }
    return offsets
  }, [pinnedCols, getColumnSize, ROW_NUMBER_WIDTH])

  // Memoize each context value separately for fine-grained updates
  const columnsValue = useMemo<ColumnsContextValue>(
    () => ({
      columns,
      visibleColumns,
      pinnedCols,
      scrollableCols,
      columnIndexMap,
      pinnedLeftOffsets,
      getFormat,
      ROW_HEIGHT,
      ROW_NUMBER_WIDTH,
    }),
    [
      columns,
      visibleColumns,
      pinnedCols,
      scrollableCols,
      columnIndexMap,
      pinnedLeftOffsets,
      getFormat,
      ROW_HEIGHT,
      ROW_NUMBER_WIDTH,
    ]
  )

  const rowDataValue = useMemo<RowDataContextValue>(
    () => ({
      getRow,
      totalCount,
      prefetchRange,
    }),
    [getRow, totalCount, prefetchRange]
  )

  const statsValue = useMemo<StatsContextValue>(
    () => ({
      columnStats,
    }),
    [columnStats]
  )

  return (
    <ColumnsContext.Provider value={columnsValue}>
      <RowDataContext.Provider value={rowDataValue}>
        <StatsContext.Provider value={statsValue}>{children}</StatsContext.Provider>
      </RowDataContext.Provider>
    </ColumnsContext.Provider>
  )
}
