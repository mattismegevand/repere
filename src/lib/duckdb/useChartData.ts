import { useCallback } from 'react'
import { useCachedQuery, useCacheManagerOptional } from '@/lib/cache'
import { usePipelineStore } from '@/stores'
import type { ChartAggregation, ChartConfig, ChartType, DashboardFilter } from '@/types'
import type { DuckDBClient } from './interface'
import { escapeIdentifier, escapeValue } from './sql-builder'

interface ChartData {
  scatter: Array<{ x: number | string; y: number | string; size?: number; color?: number | string }>
  stacked: Array<{ category: string; series: string; value: number }>
  heatmap: Array<{ x: string | number; y: string | number; value: number }>
  treemap: Array<{ name: string; value: number; children?: Array<{ name: string; value: number }> }>
  simple: Array<{ label: string; value: number }>
  boxplot: { min: number; p25: number; median: number; p75: number; max: number }
  correlationMatrix: { columns: string[]; correlations: Array<{ col1: string; col2: string; value: number }> }
  kpi: { value: number; count: number }
  combo: Array<{ category: string; barValue: number; lineValue: number }>
}

type ChartDataResult = ChartData[keyof ChartData]

export interface UseChartDataResult {
  data: ChartDataResult | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

const CHART_DATA_LIMIT = 5000

/** Build WHERE clause from dashboard filters */
function buildFilterClause(filters: DashboardFilter[]): string {
  if (filters.length === 0) return ''

  const conditions = filters.map((f) => {
    const col = escapeIdentifier(f.column)
    switch (f.operator) {
      case 'eq':
        return `${col} = ${escapeValue(f.value)}`
      case 'neq':
        return `${col} != ${escapeValue(f.value)}`
      case 'gt':
        return `${col} > ${escapeValue(f.value)}`
      case 'gte':
        return `${col} >= ${escapeValue(f.value)}`
      case 'lt':
        return `${col} < ${escapeValue(f.value)}`
      case 'lte':
        return `${col} <= ${escapeValue(f.value)}`
      case 'in':
        if (Array.isArray(f.value)) {
          return `${col} IN (${f.value.map((v) => escapeValue(v)).join(', ')})`
        }
        return `${col} = ${escapeValue(f.value)}`
      case 'contains':
        return `${col} LIKE '%' || ${escapeValue(f.value)} || '%'`
      default:
        return `${col} = ${escapeValue(f.value)}`
    }
  })

  return ` AND ${conditions.join(' AND ')}`
}

function buildChartDataSql(
  sourceTable: string,
  config: ChartConfig,
  filters: DashboardFilter[] = []
): { sql: string; type: 'scatter' | 'stacked' | 'heatmap' | 'treemap' | 'simple' | 'boxplot' | 'kpi' | 'combo' } {
  const filterClause = buildFilterClause(filters)
  const { chartType, xAxis, yAxis, colorBy, sizeBy, groupBy, aggregation, limit } = config
  const rowLimit = limit ?? CHART_DATA_LIMIT

  switch (chartType) {
    case 'boxplot': {
      // Use xAxis column or yAxis column for box plot
      const valueCol = xAxis?.column
        ? escapeIdentifier(xAxis.column)
        : Array.isArray(yAxis)
          ? escapeIdentifier(yAxis[0]?.column ?? '')
          : yAxis?.column
            ? escapeIdentifier(yAxis.column)
            : 'NULL'

      return {
        sql: `SELECT
                MIN(${valueCol}) AS min,
                PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ${valueCol}) AS p25,
                MEDIAN(${valueCol}) AS median,
                PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ${valueCol}) AS p75,
                MAX(${valueCol}) AS max
              FROM ${escapeIdentifier(sourceTable)}
              WHERE ${valueCol} IS NOT NULL${filterClause}`,
        type: 'boxplot',
      }
    }

    case 'scatter': {
      const xCol = xAxis?.column ? escapeIdentifier(xAxis.column) : 'NULL'
      const yCol = Array.isArray(yAxis)
        ? escapeIdentifier(yAxis[0]?.column ?? '')
        : yAxis?.column
          ? escapeIdentifier(yAxis.column)
          : 'NULL'

      const selectParts = [`${xCol} AS x`, `${yCol} AS y`]
      if (sizeBy) selectParts.push(`${escapeIdentifier(sizeBy)} AS size`)
      if (colorBy) selectParts.push(`${escapeIdentifier(colorBy)} AS color`)

      return {
        sql: `SELECT ${selectParts.join(', ')} FROM ${escapeIdentifier(sourceTable)}
              WHERE ${xCol} IS NOT NULL AND ${yCol} IS NOT NULL${filterClause}
              LIMIT ${rowLimit}`,
        type: 'scatter',
      }
    }

    case 'stackedBar':
    case 'stackedArea': {
      const categoryCol = xAxis?.column
        ? escapeIdentifier(xAxis.column)
        : groupBy?.[0]
          ? escapeIdentifier(groupBy[0])
          : 'NULL'
      const seriesCol = colorBy ? escapeIdentifier(colorBy) : groupBy?.[1] ? escapeIdentifier(groupBy[1]) : "'Total'"
      const valueCol = Array.isArray(yAxis)
        ? escapeIdentifier(yAxis[0]?.column ?? '')
        : yAxis?.column
          ? escapeIdentifier(yAxis.column)
          : 'NULL'
      const aggFunc = getAggFunc(aggregation)

      return {
        sql: `SELECT ${categoryCol} AS category, ${seriesCol} AS series, ${aggFunc}(${valueCol}) AS value
              FROM ${escapeIdentifier(sourceTable)}
              WHERE ${categoryCol} IS NOT NULL${filterClause}
              GROUP BY ${categoryCol}, ${seriesCol}
              ORDER BY ${categoryCol}
              LIMIT ${rowLimit}`,
        type: 'stacked',
      }
    }

    case 'heatmap': {
      const xCol = xAxis?.column ? escapeIdentifier(xAxis.column) : 'NULL'
      const yCol = Array.isArray(yAxis)
        ? escapeIdentifier(yAxis[0]?.column ?? '')
        : yAxis?.column
          ? escapeIdentifier(yAxis.column)
          : 'NULL'
      const aggFunc = getAggFunc(aggregation ?? 'count')

      return {
        sql: `SELECT ${xCol} AS x, ${yCol} AS y, ${aggFunc}(*) AS value
              FROM ${escapeIdentifier(sourceTable)}
              WHERE ${xCol} IS NOT NULL AND ${yCol} IS NOT NULL${filterClause}
              GROUP BY ${xCol}, ${yCol}
              ORDER BY ${xCol}, ${yCol}
              LIMIT ${rowLimit}`,
        type: 'heatmap',
      }
    }

    case 'treemap': {
      const groupCols = groupBy ?? (xAxis?.column ? [xAxis.column] : [])
      const valueCol = Array.isArray(yAxis) ? yAxis[0]?.column : yAxis?.column
      const aggFunc = getAggFunc(aggregation ?? 'sum')

      if (groupCols.length === 0) {
        // No grouping - just sum everything
        return {
          sql: `SELECT 'Total' AS name, ${aggFunc}(${valueCol ? escapeIdentifier(valueCol) : '1'}) AS value
                FROM ${escapeIdentifier(sourceTable)}${filterClause ? ` WHERE 1=1${filterClause}` : ''}`,
          type: 'simple',
        }
      }

      if (groupCols.length === 1) {
        const col = escapeIdentifier(groupCols[0])
        return {
          sql: `SELECT ${col} AS name, ${aggFunc}(${valueCol ? escapeIdentifier(valueCol) : '1'}) AS value
                FROM ${escapeIdentifier(sourceTable)}
                WHERE ${col} IS NOT NULL${filterClause}
                GROUP BY ${col}
                ORDER BY value DESC
                LIMIT ${rowLimit}`,
          type: 'simple',
        }
      }

      // Multiple group levels - we'll build hierarchy in the transform
      const col1 = escapeIdentifier(groupCols[0])
      const col2 = escapeIdentifier(groupCols[1])
      return {
        sql: `SELECT ${col1} AS parent, ${col2} AS name, ${aggFunc}(${valueCol ? escapeIdentifier(valueCol) : '1'}) AS value
              FROM ${escapeIdentifier(sourceTable)}
              WHERE ${col1} IS NOT NULL AND ${col2} IS NOT NULL${filterClause}
              GROUP BY ${col1}, ${col2}
              ORDER BY ${col1}, value DESC
              LIMIT ${rowLimit}`,
        type: 'treemap',
      }
    }

    case 'kpi':
    case 'gauge': {
      // Single aggregated value
      const valueCol = Array.isArray(yAxis) ? yAxis[0]?.column : yAxis?.column
      const aggFunc = getAggFunc(aggregation ?? 'sum')

      return {
        sql: `SELECT ${aggFunc}(${valueCol ? escapeIdentifier(valueCol) : '*'}) AS value,
                     COUNT(*) AS count
              FROM ${escapeIdentifier(sourceTable)}
              WHERE 1=1${filterClause}`,
        type: 'kpi',
      }
    }

    case 'funnel': {
      // Funnel uses the same format as simple charts (name/value pairs)
      const categoryCol = xAxis?.column
        ? escapeIdentifier(xAxis.column)
        : groupBy?.[0]
          ? escapeIdentifier(groupBy[0])
          : 'NULL'
      const valueCol = Array.isArray(yAxis) ? yAxis[0]?.column : yAxis?.column
      const aggFunc = getAggFunc(aggregation ?? 'count')

      return {
        sql: `SELECT ${categoryCol} AS name, ${aggFunc}(${valueCol ? escapeIdentifier(valueCol) : '*'}) AS value
              FROM ${escapeIdentifier(sourceTable)}
              WHERE ${categoryCol} IS NOT NULL${filterClause}
              GROUP BY ${categoryCol}
              ORDER BY value DESC
              LIMIT ${rowLimit}`,
        type: 'simple',
      }
    }

    case 'combo': {
      // Combo chart needs category + two value columns
      const categoryCol = xAxis?.column ? escapeIdentifier(xAxis.column) : 'NULL'
      const barCol = Array.isArray(yAxis) && yAxis[0]?.column ? escapeIdentifier(yAxis[0].column) : 'NULL'
      const lineCol = Array.isArray(yAxis) && yAxis[1]?.column ? escapeIdentifier(yAxis[1].column) : barCol
      const aggFunc = getAggFunc(aggregation ?? 'sum')

      return {
        sql: `SELECT ${categoryCol} AS category,
                     ${aggFunc}(${barCol}) AS barValue,
                     ${aggFunc}(${lineCol}) AS lineValue
              FROM ${escapeIdentifier(sourceTable)}
              WHERE ${categoryCol} IS NOT NULL${filterClause}
              GROUP BY ${categoryCol}
              ORDER BY ${categoryCol}
              LIMIT ${rowLimit}`,
        type: 'combo',
      }
    }

    default: {
      // Simple aggregation chart (bar, line, pie, etc.)
      const categoryCol = xAxis?.column
        ? escapeIdentifier(xAxis.column)
        : groupBy?.[0]
          ? escapeIdentifier(groupBy[0])
          : 'NULL'
      const valueCol = Array.isArray(yAxis) ? yAxis[0]?.column : yAxis?.column
      const aggFunc = getAggFunc(aggregation ?? 'count')

      return {
        sql: `SELECT ${categoryCol} AS label, ${aggFunc}(${valueCol ? escapeIdentifier(valueCol) : '*'}) AS value
              FROM ${escapeIdentifier(sourceTable)}
              WHERE ${categoryCol} IS NOT NULL${filterClause}
              GROUP BY ${categoryCol}
              ORDER BY value DESC
              LIMIT ${rowLimit}`,
        type: 'simple',
      }
    }
  }
}

function getAggFunc(agg: ChartAggregation | undefined): string {
  switch (agg) {
    case 'sum':
      return 'SUM'
    case 'avg':
      return 'AVG'
    case 'min':
      return 'MIN'
    case 'max':
      return 'MAX'
    default:
      return 'COUNT'
  }
}

function transformResult(
  rows: Array<Record<string, unknown>>,
  type: 'scatter' | 'stacked' | 'heatmap' | 'treemap' | 'simple' | 'boxplot' | 'kpi' | 'combo',
  chartType: ChartType
): ChartDataResult {
  switch (type) {
    case 'boxplot': {
      const r = rows[0] ?? {}
      return {
        min: Number(r.min ?? 0),
        p25: Number(r.p25 ?? 0),
        median: Number(r.median ?? 0),
        p75: Number(r.p75 ?? 0),
        max: Number(r.max ?? 0),
      }
    }

    case 'kpi': {
      const r = rows[0] ?? {}
      return {
        value: Number(r.value ?? 0),
        count: Number(r.count ?? 0),
      }
    }

    case 'combo':
      return rows.map((r) => ({
        category: String(r.category),
        barValue: Number(r.barValue ?? 0),
        lineValue: Number(r.lineValue ?? 0),
      }))

    case 'scatter':
      return rows.map((r) => ({
        x: r.x as number | string,
        y: r.y as number | string,
        size: r.size as number | undefined,
        color: r.color as number | string | undefined,
      }))

    case 'stacked':
      return rows.map((r) => ({
        category: String(r.category),
        series: String(r.series),
        value: Number(r.value),
      }))

    case 'heatmap':
      return rows.map((r) => ({
        x: r.x as string | number,
        y: r.y as string | number,
        value: Number(r.value),
      }))

    case 'treemap': {
      // Build hierarchical structure from parent/name/value rows
      const parentMap = new Map<string, Array<{ name: string; value: number }>>()
      for (const r of rows) {
        const parent = String(r.parent)
        const child = { name: String(r.name), value: Number(r.value) }
        if (!parentMap.has(parent)) {
          parentMap.set(parent, [])
        }
        parentMap.get(parent)!.push(child)
      }
      return Array.from(parentMap.entries()).map(([name, children]) => ({
        name,
        value: children.reduce((sum, c) => sum + c.value, 0),
        children,
      }))
    }

    default:
      // For treemap with single group, use simple format
      if (chartType === 'treemap') {
        return rows.map((r) => ({
          name: String(r.name ?? r.label),
          value: Number(r.value),
        }))
      }
      return rows.map((r) => ({
        label: String(r.label),
        value: Number(r.value),
      }))
  }
}

export function useChartData(
  client: DuckDBClient | null,
  sourceTable: string | undefined,
  config: ChartConfig | undefined,
  /** Node ID for DAG-aware cache invalidation */
  nodeId?: string,
  /** Dashboard filters to apply (for cross-filtering) */
  filters?: DashboardFilter[]
): UseChartDataResult {
  const edges = usePipelineStore((s) => s.edges)
  const cacheManager = useCacheManagerOptional()

  const queryFn = useCallback(async (): Promise<ChartDataResult> => {
    if (!client || !sourceTable || !config) {
      throw new Error('Missing required parameters')
    }

    const { sql, type } = buildChartDataSql(sourceTable, config, filters ?? [])
    const result = await client.query<Record<string, unknown>>(sql)
    return transformResult(result.rows, type, config.chartType)
  }, [client, sourceTable, config, filters])

  const enabled = Boolean(client && sourceTable && config)

  // Use DAG-aware caching when cache manager and nodeId are available
  // Include full config in params so cache invalidates when any config changes
  const { data, isLoading, error, refetch } = useCachedQuery({
    category: 'chart-data',
    nodeId: nodeId ?? sourceTable ?? 'unknown',
    edges,
    queryFn,
    enabled: enabled && !!cacheManager,
    params: { config, sourceTable, filters },
  })

  return {
    data: data ?? null,
    loading: isLoading,
    error: error?.message ?? null,
    refetch,
  }
}
