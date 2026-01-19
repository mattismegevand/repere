import { getDescendants } from '@/lib/graph'
import type { PipelineEdge } from '@/types'
import type { CacheConfig, CacheEntry, CacheKeyParams, CacheManagerInterface, CacheStats, QueryCategory } from './types'
import { DEFAULT_CACHE_CONFIG } from './types'
import { estimateSize, hashObject } from './utils'

export class CacheManager implements CacheManagerInterface {
  private cache: Map<string, CacheEntry>
  private nodeToEntries: Map<string, Set<string>> // nodeId -> cache keys
  private stats: CacheStats
  private config: CacheConfig

  constructor(config: Partial<CacheConfig> = {}) {
    this.cache = new Map()
    this.nodeToEntries = new Map()
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      currentSize: 0,
      entryCount: 0,
    }
    this.config = {
      ...DEFAULT_CACHE_CONFIG,
      ...config,
      defaultTTL: {
        ...DEFAULT_CACHE_CONFIG.defaultTTL,
        ...config.defaultTTL,
      },
    }
  }

  generateKey(params: CacheKeyParams): string {
    const normalized = {
      category: params.category,
      nodeId: params.nodeId,
      params: params.params,
    }
    return `${params.category}:${params.nodeId}:${hashObject(normalized)}`
  }

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) {
      this.stats.misses++
      return undefined
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.deleteEntry(key)
      this.stats.misses++
      return undefined
    }

    this.stats.hits++
    // Update timestamp for LRU tracking
    entry.timestamp = Date.now()
    return entry.data as T
  }

  set<T>(key: string, data: T, category: QueryCategory, nodeIds: string[]): void {
    // Delete existing entry first if present
    if (this.cache.has(key)) {
      this.deleteEntry(key)
    }

    const size = estimateSize(data)

    // Evict entries if we'd exceed budget
    while (this.stats.currentSize + size > this.config.maxSize && this.cache.size > 0) {
      this.evictLRU()
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.config.defaultTTL[category],
      size,
      category,
      nodeIds,
    }

    // Register node dependencies
    for (const nodeId of nodeIds) {
      let entries = this.nodeToEntries.get(nodeId)
      if (!entries) {
        entries = new Set()
        this.nodeToEntries.set(nodeId, entries)
      }
      entries.add(key)
    }

    this.cache.set(key, entry)
    this.stats.currentSize += size
    this.stats.entryCount++
  }

  delete(key: string): void {
    this.deleteEntry(key)
  }

  invalidateNode(nodeId: string, edges: PipelineEdge[]): void {
    const descendants = getDescendants(nodeId, edges)
    const nodesToInvalidate = [nodeId, ...descendants]

    for (const nid of nodesToInvalidate) {
      const keys = this.nodeToEntries.get(nid)
      if (keys) {
        for (const key of keys) {
          this.deleteEntry(key)
        }
        this.nodeToEntries.delete(nid)
      }
    }
  }

  invalidateCategory(category: QueryCategory): void {
    for (const [key, entry] of this.cache) {
      if (entry.category === category) {
        this.deleteEntry(key)
      }
    }
  }

  getStats(): CacheStats {
    return { ...this.stats }
  }

  clear(): void {
    this.cache.clear()
    this.nodeToEntries.clear()
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      currentSize: 0,
      entryCount: 0,
    }
  }

  private deleteEntry(key: string): void {
    const entry = this.cache.get(key)
    if (!entry) return

    this.stats.currentSize -= entry.size
    this.stats.entryCount--

    // Remove from node index
    for (const nodeId of entry.nodeIds) {
      const entries = this.nodeToEntries.get(nodeId)
      if (entries) {
        entries.delete(key)
        if (entries.size === 0) {
          this.nodeToEntries.delete(nodeId)
        }
      }
    }

    this.cache.delete(key)
  }

  private evictLRU(): void {
    let oldest: { key: string; timestamp: number } | null = null

    for (const [key, entry] of this.cache) {
      if (!oldest || entry.timestamp < oldest.timestamp) {
        oldest = { key, timestamp: entry.timestamp }
      }
    }

    if (oldest) {
      this.deleteEntry(oldest.key)
      this.stats.evictions++
    }
  }
}

let globalCacheManager: CacheManager | null = null

export function resetGlobalCacheManager(): void {
  globalCacheManager?.clear()
  globalCacheManager = null
}
