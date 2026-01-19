import type { PipelineEdge } from '@/types'

export type QueryCategory =
  | 'grid-rows' // Row data for DataGrid virtualization
  | 'row-count' // COUNT(*) queries
  | 'schema' // DESCRIBE queries
  | 'chart-data' // Chart aggregations
  | 'profile' // Column profiling data
  | 'aggregation' // General aggregations

export interface CacheEntry<T = unknown> {
  data: T
  timestamp: number
  expiresAt: number
  size: number // Approximate memory size in bytes
  category: QueryCategory
  nodeIds: string[] // Pipeline nodes this entry depends on
}

export interface CacheConfig {
  /** Maximum memory budget in bytes (default: 50MB) */
  maxSize: number
  /** Category-specific TTLs in milliseconds */
  defaultTTL: Record<QueryCategory, number>
}

export interface CacheStats {
  hits: number
  misses: number
  evictions: number
  currentSize: number
  entryCount: number
}

export interface CacheKeyParams {
  category: QueryCategory
  nodeId: string
  /** Additional parameters to include in key (e.g., query params, filters) */
  params?: Record<string, unknown>
}

export interface CacheManagerInterface {
  get<T>(key: string): T | undefined
  set<T>(key: string, data: T, category: QueryCategory, nodeIds: string[]): void
  delete(key: string): void
  invalidateNode(nodeId: string, edges: PipelineEdge[]): void
  invalidateCategory(category: QueryCategory): void
  generateKey(params: CacheKeyParams): string
  getStats(): CacheStats
  clear(): void
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxSize: 50 * 1024 * 1024, // 50MB
  defaultTTL: {
    'grid-rows': 60_000, // 1 minute
    'row-count': 300_000, // 5 minutes
    schema: 600_000, // 10 minutes (rarely changes)
    'chart-data': 120_000, // 2 minutes
    profile: 300_000, // 5 minutes
    aggregation: 120_000, // 2 minutes
  },
}
