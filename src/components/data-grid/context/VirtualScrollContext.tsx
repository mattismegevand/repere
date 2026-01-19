import { createContext, type ReactNode, useContext } from 'react'
import type { UseVirtualScrollResult } from '../hooks/useVirtualScroll'

export type VirtualScrollState = UseVirtualScrollResult

const VirtualScrollContext = createContext<VirtualScrollState | null>(null)

export function useVirtualScrollContext(): VirtualScrollState | null {
  return useContext(VirtualScrollContext)
}

interface VirtualScrollProviderProps {
  children: ReactNode
  value: VirtualScrollState | null
}

export function VirtualScrollProvider({ children, value }: VirtualScrollProviderProps) {
  return <VirtualScrollContext.Provider value={value}>{children}</VirtualScrollContext.Provider>
}
