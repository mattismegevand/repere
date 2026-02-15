import { useCallback, useEffect, useRef, useState } from 'react'
import { useCacheManagerOptional } from '@/lib/cache'
import { useDuckDB } from '@/lib/duckdb'
import { buildCountQuery, buildSelectQuery } from '@/lib/duckdb/query-builder'
import { normalizeRowDates } from '@/lib/formatters'
import { usePipelineStore } from '@/stores/pipelineStore'
import type { Column } from '@/types'

const FETCH_SIZE = 500
const ROW_CACHE_MAX = 5000

// In-flight request deduplication - prevents duplicate concurrent requests
const inFlightRequests = new Map<string, Promise<Record<string, unknown>[]>>()

export interface UseGridDataOptions {
  tableName: string | undefined
  columns: Column[]
  search: string
  searchCaseSensitive: boolean
  /** Node ID for cache invalidation tracking */
  nodeId?: string
  /** A key that changes when the underlying data changes (e.g., stringified operation or viewSql) */
  cacheKey?: string
}

export interface UseGridDataResult {
  totalCount: number
  getRow: (index: number) => Record<string, unknown> | undefined
  prefetchRange: (start: number, end: number) => void
  invalidateCache: () => void
  getSampleRows: (limit?: number) => Record<string, unknown>[]
}

export function useGridData({
  tableName,
  columns,
  search,
  searchCaseSensitive,
  nodeId,
  cacheKey,
}: UseGridDataOptions): UseGridDataResult {
  const { client } = useDuckDB()
  const cacheManager = useCacheManagerOptional()
  const edges = usePipelineStore((s) => s.edges)
  const [totalCount, setTotalCount] = useState(0)

  // Local row cache - keeps rows in memory for quick access during scrolling
  const rowCacheRef = useRef<Map<number, Record<string, unknown>>>(new Map())
  const fetchingRef = useRef<Set<number>>(new Set())
  const queryVersionRef = useRef(0)
  // Counter that increments when data changes, used to change getRow reference
  const [dataVersion, setDataVersion] = useState(0)

  const stringColumns = columns.filter((c) => c.type === 'string').map((c) => c.name)

  // Invalidate cache when search, table, or underlying data changes
  useEffect(() => {
    queryVersionRef.current++
    rowCacheRef.current.clear()
    fetchingRef.current.clear()
    setDataVersion((v) => v + 1)
  }, [search, searchCaseSensitive, tableName, cacheKey])

  // Fetch total count with cache integration
  useEffect(() => {
    if (!client || !tableName) return

    let mounted = true

    async function fetchCount() {
      // Try global cache first for row count
      const countCacheKey = cacheManager?.generateKey({
        category: 'row-count',
        nodeId: nodeId ?? tableName!,
        params: { search, searchCaseSensitive },
      })

      if (cacheManager && countCacheKey) {
        const cached = cacheManager.get<number>(countCacheKey)
        if (cached !== undefined) {
          setTotalCount(cached)
          return
        }
      }

      const countSql = buildCountQuery({
        tableName: tableName!,
        filters: [],
        search,
        searchColumns: stringColumns,
        searchCaseSensitive,
      })
      const result = await client!.query<{ count: number | bigint }>(countSql)
      const count = Number(result.rows[0]?.count ?? 0)

      if (!mounted) return

      // Store in global cache
      if (cacheManager && countCacheKey && nodeId) {
        cacheManager.set(countCacheKey, count, 'row-count', [nodeId])
      }

      setTotalCount(count)
    }
    fetchCount()

    return () => {
      mounted = false
    }
  }, [client, tableName, search, searchCaseSensitive, stringColumns.join(','), cacheManager, nodeId])

  // Fetch rows for a range with deduplication
  const fetchRows = useCallback(
    async (startIndex: number, endIndex: number, currentTotalCount: number) => {
      if (!client || !tableName || currentTotalCount === 0) return

      const version = queryVersionRef.current
      const toFetch: number[] = []

      for (let i = startIndex; i <= endIndex; i++) {
        if (!rowCacheRef.current.has(i) && !fetchingRef.current.has(i)) {
          toFetch.push(i)
          fetchingRef.current.add(i)
        }
      }

      if (toFetch.length === 0) return

      const minIndex = Math.min(...toFetch)
      const fetchStart = Math.floor(minIndex / FETCH_SIZE) * FETCH_SIZE
      const fetchEnd = Math.min(fetchStart + FETCH_SIZE, currentTotalCount)

      if (fetchEnd <= fetchStart) return

      // Generate dedup key for this specific fetch request
      const dedupKey = `${tableName}:${search}:${searchCaseSensitive}:${fetchStart}:${fetchEnd}`

      // Check if there's already an in-flight request for this exact range
      let rowsPromise = inFlightRequests.get(dedupKey)

      if (!rowsPromise) {
        // Create new request
        const sql = buildSelectQuery({
          tableName,
          filters: [],
          sort: null,
          search,
          searchColumns: stringColumns,
          searchCaseSensitive,
          limit: fetchEnd - fetchStart,
          offset: fetchStart,
        })

        rowsPromise = client.query(sql).then((result) => {
          // Clean up in-flight map after completion
          inFlightRequests.delete(dedupKey)
          return result.rows.map((row) => normalizeRowDates(row as Record<string, unknown>, columns))
        })

        inFlightRequests.set(dedupKey, rowsPromise)
      }

      const rows = await rowsPromise

      // Check if query version changed during fetch
      if (version !== queryVersionRef.current) return

      // Enforce row cache size limit
      if (rowCacheRef.current.size + rows.length > ROW_CACHE_MAX) {
        // Clear old entries (simple approach - just clear if over limit)
        const entriesToRemove = rowCacheRef.current.size + rows.length - ROW_CACHE_MAX
        const iterator = rowCacheRef.current.keys()
        for (let i = 0; i < entriesToRemove; i++) {
          const key = iterator.next().value
          if (key !== undefined) {
            rowCacheRef.current.delete(key)
          }
        }
      }

      rows.forEach((row, i) => {
        rowCacheRef.current.set(fetchStart + i, row)
        fetchingRef.current.delete(fetchStart + i)
      })
      // Increment dataVersion to change getRow reference, triggering memo'd row re-renders
      setDataVersion((v) => v + 1)
    },
    [client, tableName, search, searchCaseSensitive, stringColumns.join(','), columns]
  )

  const getRow = useCallback(
    (index: number) => {
      return rowCacheRef.current.get(index)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dataVersion]
  )

  const prefetchRange = useCallback(
    (start: number, end: number) => {
      if (totalCount === 0) return
      fetchRows(Math.max(0, start), Math.min(end, totalCount - 1), totalCount)
    },
    [fetchRows, totalCount]
  )

  const invalidateCache = useCallback(() => {
    queryVersionRef.current++
    rowCacheRef.current.clear()
    fetchingRef.current.clear()
    setDataVersion((v) => v + 1)

    // Also invalidate global cache for this node
    if (cacheManager && nodeId) {
      cacheManager.invalidateNode(nodeId, edges)
    }
  }, [cacheManager, nodeId, edges])

  const getSampleRows = useCallback((limit = 100): Record<string, unknown>[] => {
    const rows: Record<string, unknown>[] = []
    for (const row of rowCacheRef.current.values()) {
      if (rows.length >= limit) break
      rows.push(row)
    }
    return rows
  }, [])

  return {
    totalCount,
    getRow,
    prefetchRange,
    invalidateCache,
    getSampleRows,
  }
}
