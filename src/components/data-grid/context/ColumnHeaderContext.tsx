import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef } from 'react'
import type { DuckDBClient } from '@/lib/duckdb/interface'
import type { Column, Sort } from '@/types'
import type { ColumnStats } from '../charts'

export interface ColumnHeaderContextValue {
  // DuckDB connection
  client: DuckDBClient | null
  tableName: string
  totalCount: number

  // Sort state
  currentSorts: Sort[]

  // Filter state
  activeFilterColumns: string[]

  // Sparkline stats
  getSparklineStats: (columnName: string) => ColumnStats | null

  // Sample data for auto-fit
  getSampleData: (columnName: string) => unknown[]

  // Hover management
  hoverTimeoutRef: React.MutableRefObject<number | null>
  onMouseEnter: (columnName: string) => void
  onMouseLeave: () => void

  // Actions
  onSortClick: (columnName: string) => void
  onContextMenu: (e: React.MouseEvent, colName: string, colType: Column['type']) => void
  onSelectColumn: (colName: string, multiSelect: boolean) => void
  onResize: (columnId: string, width: number) => void
  onDrop: (e: React.DragEvent, targetColumnName: string) => Promise<void>
}

const ColumnHeaderContext = createContext<ColumnHeaderContextValue | null>(null)

export function useColumnHeaderContext(): ColumnHeaderContextValue {
  const ctx = useContext(ColumnHeaderContext)
  if (!ctx) throw new Error('useColumnHeaderContext must be used within ColumnHeaderProvider')
  return ctx
}

interface ColumnHeaderProviderProps {
  children: ReactNode
  client: DuckDBClient | null
  tableName: string
  totalCount: number
  currentSorts: Sort[]
  activeFilterColumns: string[]
  getSparklineStats: (columnName: string) => ColumnStats | null
  sampleDataCallbacks: Record<string, () => unknown[]>
  onHover: (column: string | null) => void
  onSortClick: (columnName: string) => void
  onContextMenu: (e: React.MouseEvent, colName: string, colType: Column['type']) => void
  onSelectColumn: (colName: string, multiSelect: boolean) => void
  onResize: (columnId: string, width: number) => void
  onDrop: (e: React.DragEvent, targetColumnName: string) => Promise<void>
}

export function ColumnHeaderProvider({
  children,
  client,
  tableName,
  totalCount,
  currentSorts,
  activeFilterColumns,
  getSparklineStats,
  sampleDataCallbacks,
  onHover,
  onSortClick,
  onContextMenu,
  onSelectColumn,
  onResize,
  onDrop,
}: ColumnHeaderProviderProps) {
  const hoverTimeoutRef = useRef<number | null>(null)

  const onMouseEnter = useCallback(
    (columnName: string) => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = window.setTimeout(() => onHover(columnName), 300)
    },
    [onHover]
  )

  const onMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    hoverTimeoutRef.current = window.setTimeout(() => onHover(null), 100)
  }, [onHover])

  const getSampleData = useCallback(
    (columnName: string) => {
      const callback = sampleDataCallbacks[columnName]
      return callback ? callback() : []
    },
    [sampleDataCallbacks]
  )

  const value = useMemo<ColumnHeaderContextValue>(
    () => ({
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
    }),
    [
      client,
      tableName,
      totalCount,
      currentSorts,
      activeFilterColumns,
      getSparklineStats,
      getSampleData,
      onMouseEnter,
      onMouseLeave,
      onSortClick,
      onContextMenu,
      onSelectColumn,
      onResize,
      onDrop,
    ]
  )

  return <ColumnHeaderContext.Provider value={value}>{children}</ColumnHeaderContext.Provider>
}
