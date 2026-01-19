import { createContext, type ReactNode, useContext, useMemo } from 'react'

export interface ColumnStateContextValue {
  getColumnSize: (name: string) => number
  resizeColumn: (name: string, width: number) => void
  pinnedColumns: Set<string>
  hiddenColumns: Set<string>
  toggleColumnPin: (name: string) => void
  toggleColumnVisibility: (name: string) => void
}

const ColumnStateContext = createContext<ColumnStateContextValue | null>(null)

export function useColumnStateContext(): ColumnStateContextValue {
  const ctx = useContext(ColumnStateContext)
  if (!ctx) throw new Error('useColumnStateContext must be used within ColumnStateProvider')
  return ctx
}

interface ColumnStateProviderProps extends ColumnStateContextValue {
  children: ReactNode
}

export function ColumnStateProvider({
  children,
  getColumnSize,
  resizeColumn,
  pinnedColumns,
  hiddenColumns,
  toggleColumnPin,
  toggleColumnVisibility,
}: ColumnStateProviderProps) {
  const value = useMemo<ColumnStateContextValue>(
    () => ({
      getColumnSize,
      resizeColumn,
      pinnedColumns,
      hiddenColumns,
      toggleColumnPin,
      toggleColumnVisibility,
    }),
    [getColumnSize, resizeColumn, pinnedColumns, hiddenColumns, toggleColumnPin, toggleColumnVisibility]
  )

  return <ColumnStateContext.Provider value={value}>{children}</ColumnStateContext.Provider>
}
