import { beforeEach, describe, expect, it } from 'vitest'
import { CacheManager } from '@/lib/cache/CacheManager'
import type { PipelineEdge } from '@/types'

describe('CacheManager', () => {
  let cache: CacheManager

  beforeEach(() => {
    cache = new CacheManager({
      maxSize: 10000, // Small size for testing
      defaultTTL: {
        'grid-rows': 1000,
        'row-count': 1000,
        schema: 1000,
        'chart-data': 1000,
        profile: 1000,
        aggregation: 1000,
      },
    })
  })

  describe('basic operations', () => {
    it('stores and retrieves entries', () => {
      cache.set('test-key', { value: 42 }, 'chart-data', ['node1'])
      const result = cache.get<{ value: number }>('test-key')
      expect(result).toEqual({ value: 42 })
    })

    it('returns undefined for missing entries', () => {
      const result = cache.get('nonexistent')
      expect(result).toBeUndefined()
    })

    it('deletes entries', () => {
      cache.set('test-key', { value: 42 }, 'chart-data', ['node1'])
      cache.delete('test-key')
      const result = cache.get('test-key')
      expect(result).toBeUndefined()
    })

    it('clears all entries', () => {
      cache.set('key1', { value: 1 }, 'chart-data', ['node1'])
      cache.set('key2', { value: 2 }, 'chart-data', ['node2'])
      cache.clear()
      expect(cache.get('key1')).toBeUndefined()
      expect(cache.get('key2')).toBeUndefined()
    })
  })

  describe('expiration', () => {
    it('expires entries after TTL', async () => {
      // Create cache with very short TTL
      const shortCache = new CacheManager({
        maxSize: 10000,
        defaultTTL: {
          'grid-rows': 10, // 10ms
          'row-count': 10,
          schema: 10,
          'chart-data': 10,
          profile: 10,
          aggregation: 10,
        },
      })

      shortCache.set('test-key', { value: 42 }, 'chart-data', ['node1'])
      expect(shortCache.get('test-key')).toEqual({ value: 42 })

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 20))

      expect(shortCache.get('test-key')).toBeUndefined()
    })
  })

  describe('memory management', () => {
    it('enforces memory limit via eviction', () => {
      // Create cache with very small limit
      const smallCache = new CacheManager({
        maxSize: 500, // Very small
        defaultTTL: {
          'grid-rows': 60000,
          'row-count': 60000,
          schema: 60000,
          'chart-data': 60000,
          profile: 60000,
          aggregation: 60000,
        },
      })

      // Add entries that exceed the limit
      smallCache.set('key1', { data: 'x'.repeat(200) }, 'chart-data', ['node1'])
      smallCache.set('key2', { data: 'x'.repeat(200) }, 'chart-data', ['node2'])
      smallCache.set('key3', { data: 'x'.repeat(200) }, 'chart-data', ['node3'])

      // Should have evicted at least one entry
      const stats = smallCache.getStats()
      expect(stats.evictions).toBeGreaterThan(0)
    })

    it('tracks stats correctly', () => {
      cache.set('key1', { value: 1 }, 'chart-data', ['node1'])
      cache.get('key1') // hit
      cache.get('key1') // hit
      cache.get('nonexistent') // miss

      const stats = cache.getStats()
      expect(stats.hits).toBe(2)
      expect(stats.misses).toBe(1)
      expect(stats.entryCount).toBe(1)
    })
  })

  describe('DAG-aware invalidation', () => {
    const edges: PipelineEdge[] = [
      { id: 'e1', sourceId: 'root', targetId: 'child1' },
      { id: 'e2', sourceId: 'root', targetId: 'child2' },
      { id: 'e3', sourceId: 'child1', targetId: 'grandchild1' },
      { id: 'e4', sourceId: 'child2', targetId: 'grandchild2' },
    ]

    it('invalidates node and all descendants', () => {
      // Cache entries for various nodes
      cache.set('root-data', { value: 0 }, 'chart-data', ['root'])
      cache.set('child1-data', { value: 1 }, 'chart-data', ['child1'])
      cache.set('child2-data', { value: 2 }, 'chart-data', ['child2'])
      cache.set('grandchild1-data', { value: 3 }, 'chart-data', ['grandchild1'])
      cache.set('grandchild2-data', { value: 4 }, 'chart-data', ['grandchild2'])

      // Invalidate root - should clear all descendants
      cache.invalidateNode('root', edges)

      // All should be invalidated
      expect(cache.get('root-data')).toBeUndefined()
      expect(cache.get('child1-data')).toBeUndefined()
      expect(cache.get('child2-data')).toBeUndefined()
      expect(cache.get('grandchild1-data')).toBeUndefined()
      expect(cache.get('grandchild2-data')).toBeUndefined()
    })

    it('preserves unrelated entries', () => {
      cache.set('root-data', { value: 0 }, 'chart-data', ['root'])
      cache.set('unrelated-data', { value: 99 }, 'chart-data', ['unrelated'])

      cache.invalidateNode('root', edges)

      // Unrelated should still exist
      expect(cache.get('unrelated-data')).toEqual({ value: 99 })
    })

    it('invalidates only subtree when mid-node is target', () => {
      cache.set('root-data', { value: 0 }, 'chart-data', ['root'])
      cache.set('child1-data', { value: 1 }, 'chart-data', ['child1'])
      cache.set('child2-data', { value: 2 }, 'chart-data', ['child2'])
      cache.set('grandchild1-data', { value: 3 }, 'chart-data', ['grandchild1'])

      // Invalidate child1 - should only affect child1 and grandchild1
      cache.invalidateNode('child1', edges)

      // These should be invalidated
      expect(cache.get('child1-data')).toBeUndefined()
      expect(cache.get('grandchild1-data')).toBeUndefined()

      // These should remain
      expect(cache.get('root-data')).toEqual({ value: 0 })
      expect(cache.get('child2-data')).toEqual({ value: 2 })
    })
  })

  describe('cache key generation', () => {
    it('generates stable keys for same inputs', () => {
      const key1 = cache.generateKey({
        category: 'chart-data',
        nodeId: 'node1',
        params: { chartType: 'bar' },
      })
      const key2 = cache.generateKey({
        category: 'chart-data',
        nodeId: 'node1',
        params: { chartType: 'bar' },
      })
      expect(key1).toBe(key2)
    })

    it('generates different keys for different inputs', () => {
      const key1 = cache.generateKey({
        category: 'chart-data',
        nodeId: 'node1',
        params: { chartType: 'bar' },
      })
      const key2 = cache.generateKey({
        category: 'chart-data',
        nodeId: 'node1',
        params: { chartType: 'line' },
      })
      expect(key1).not.toBe(key2)
    })
  })

  describe('category invalidation', () => {
    it('invalidates all entries of a specific category', () => {
      cache.set('chart1', { value: 1 }, 'chart-data', ['node1'])
      cache.set('chart2', { value: 2 }, 'chart-data', ['node2'])
      cache.set('schema1', { value: 3 }, 'schema', ['node1'])

      cache.invalidateCategory('chart-data')

      expect(cache.get('chart1')).toBeUndefined()
      expect(cache.get('chart2')).toBeUndefined()
      expect(cache.get('schema1')).toEqual({ value: 3 })
    })
  })
})
