import { createContext, useContext } from 'react'
import type { ColumnVirtualItem } from '../hooks/useColumnVirtualization'

export interface ColumnVirtualizationContextValue {
  /** Visible scrollable columns (virtualized) */
  visibleScrollableCols: ColumnVirtualItem[]
  /** Total width of all scrollable columns */
  totalScrollableWidth: number
  /** Whether column virtualization is enabled */
  isVirtualized: boolean
}

const ColumnVirtualizationContext = createContext<ColumnVirtualizationContextValue | null>(null)

export function ColumnVirtualizationProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: ColumnVirtualizationContextValue
}) {
  return <ColumnVirtualizationContext.Provider value={value}>{children}</ColumnVirtualizationContext.Provider>
}

export function useColumnVirtualizationContext(): ColumnVirtualizationContextValue {
  const ctx = useContext(ColumnVirtualizationContext)
  if (!ctx) throw new Error('useColumnVirtualizationContext must be used within ColumnVirtualizationProvider')
  return ctx
}
