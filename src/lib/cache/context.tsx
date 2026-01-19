import { createContext, type ReactNode, useContext, useMemo } from 'react'
import { CacheManager } from './CacheManager'
import type { CacheConfig } from './types'

const CacheContext = createContext<CacheManager | null>(null)

interface CacheProviderProps {
  children: ReactNode
  config?: Partial<CacheConfig>
}

export function CacheProvider({ children, config }: CacheProviderProps) {
  const cacheManager = useMemo(() => new CacheManager(config), [])

  return <CacheContext.Provider value={cacheManager}>{children}</CacheContext.Provider>
}

/**
 * Get the CacheManager instance from context, or null if not available.
 * Useful for optional cache integration.
 */
export function useCacheManagerOptional(): CacheManager | null {
  return useContext(CacheContext)
}
