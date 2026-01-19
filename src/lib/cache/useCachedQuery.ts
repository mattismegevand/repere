import { useCallback, useEffect, useRef, useState } from 'react'
import { getParents } from '@/lib/graph'
import type { PipelineEdge } from '@/types'
import { useCacheManagerOptional } from './context'
import type { QueryCategory } from './types'

export interface CachedQueryOptions<T> {
  /** Category for TTL and invalidation grouping */
  category: QueryCategory
  /** Primary node this query depends on */
  nodeId: string
  /** Pipeline edges for DAG traversal */
  edges: PipelineEdge[]
  /** Function that fetches the data */
  queryFn: () => Promise<T>
  /** Whether the query should run (default: true) */
  enabled?: boolean
  /** Called when query succeeds */
  onSuccess?: (data: T) => void
  /** Called when query fails */
  onError?: (error: Error) => void
  /** Additional parameters to include in cache key */
  params?: Record<string, unknown>
}

export interface CachedQueryResult<T> {
  data: T | undefined
  isLoading: boolean
  isFetching: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * DAG-aware query hook that caches results and invalidates when ancestors change.
 *
 * @example
 * const { data, isLoading } = useCachedQuery({
 *   category: 'chart-data',
 *   nodeId: view.id,
 *   edges: pipelineEdges,
 *   queryFn: () => fetchChartData(conn, view.tableName),
 *   enabled: !!conn,
 * })
 */
export function useCachedQuery<T>({
  category,
  nodeId,
  edges,
  queryFn,
  enabled = true,
  onSuccess,
  onError,
  params,
}: CachedQueryOptions<T>): CachedQueryResult<T> {
  const cacheManager = useCacheManagerOptional()
  const [data, setData] = useState<T | undefined>(undefined)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(false)

  const mountedRef = useRef(true)

  // Build dependency chain: this node + all ancestors
  const ancestors = getParents(nodeId, edges)
  const dependencyNodeIds = [nodeId, ...ancestors]

  // Generate cache key including dependencies
  const cacheKey = cacheManager?.generateKey({
    category,
    nodeId,
    params: { ...params, deps: dependencyNodeIds },
  })

  const fetchData = useCallback(async () => {
    if (!enabled) return

    // Check cache first (if cache manager available)
    if (cacheManager && cacheKey) {
      const cached = cacheManager.get<T>(cacheKey)
      if (cached !== undefined) {
        setData(cached)
        setError(null)
        return
      }
    }

    // Show loading only if we don't have data yet
    if (data === undefined) {
      setIsLoading(true)
    }
    setIsFetching(true)
    setError(null)

    try {
      const result = await queryFn()

      if (!mountedRef.current) return

      // Store in cache
      if (cacheManager && cacheKey) {
        cacheManager.set(cacheKey, result, category, dependencyNodeIds)
      }

      setData(result)
      setError(null)
      onSuccess?.(result)
    } catch (err) {
      if (!mountedRef.current) return

      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      onError?.(error)
    } finally {
      if (mountedRef.current) {
        setIsLoading(false)
        setIsFetching(false)
      }
    }
  }, [enabled, cacheManager, cacheKey, queryFn, category, dependencyNodeIds.join(','), data, onSuccess, onError])

  // Track mounted state
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Fetch on mount and when key changes
  useEffect(() => {
    if (enabled) {
      fetchData()
    } else {
      setData(undefined)
      setError(null)
      setIsLoading(false)
      setIsFetching(false)
    }
  }, [cacheKey, enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  const refetch = useCallback(async () => {
    // Clear cache entry to force refetch
    if (cacheManager && cacheKey) {
      cacheManager.delete(cacheKey)
    }
    await fetchData()
  }, [cacheManager, cacheKey, fetchData])

  return { data, isLoading, isFetching, error, refetch }
}
