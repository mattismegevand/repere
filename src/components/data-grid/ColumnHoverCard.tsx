import {
  BarChart2,
  BoxSelect,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Plus,
  ScatterChart,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DuckDBClient } from '@/lib/duckdb/interface'
import { formatDuckDBDate } from '@/lib/formatters'
import { usePanelStore, usePipelineStore } from '@/stores'
import type { Column, ChartType as PipelineChartType } from '@/types'
import type { ChartType, HistogramBin } from './charts'
import { BarChart, BoxPlot, calculateUniqueRatio, determineChartType, LineChart, PieChart } from './charts'

// Chart type suggestions based on column type
const CHART_SUGGESTIONS: Record<string, Array<{ type: PipelineChartType; icon: typeof BarChart2; label: string }>> = {
  number: [
    { type: 'bar', icon: BarChart2, label: 'Bar' },
    { type: 'line', icon: LineChartIcon, label: 'Line' },
    { type: 'scatter', icon: ScatterChart, label: 'Scatter' },
    { type: 'boxplot', icon: BoxSelect, label: 'Box' },
  ],
  string: [
    { type: 'bar', icon: BarChart2, label: 'Bar' },
    { type: 'pie', icon: PieChartIcon, label: 'Pie' },
  ],
  boolean: [
    { type: 'pie', icon: PieChartIcon, label: 'Pie' },
    { type: 'bar', icon: BarChart2, label: 'Bar' },
  ],
  date: [
    { type: 'line', icon: LineChartIcon, label: 'Line' },
    { type: 'bar', icon: BarChart2, label: 'Bar' },
  ],
  timestamp: [
    { type: 'line', icon: LineChartIcon, label: 'Line' },
    { type: 'bar', icon: BarChart2, label: 'Bar' },
  ],
}

// Helper to convert BigInt or other numeric types to number
function toNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null
  if (typeof val === 'bigint') return Number(val)
  if (typeof val === 'number') return val
  return null
}

interface Stats {
  count: number
  nullCount: number
  uniqueCount: number
  uniqueRatio: number
  min?: number | string
  max?: number | string
  mean?: number
  stdDev?: number
  median?: number
  p25?: number
  p75?: number
  outlierCount?: number
  outlierLower?: number
  outlierUpper?: number
  mode?: string
  modeCount?: number
  sampleValues?: string[]
  histogram?: HistogramBin[]
  chartType: ChartType
  dateSpanDays?: number
}

interface Props {
  client: DuckDBClient
  tableName: string
  column: Column
}

// Chart dimensions for hover card (larger than sparklines)
const CHART_WIDTH = 280
const CHART_HEIGHT_DEFAULT = 120
const CHART_HEIGHT_PIE = 150
const CHART_HEIGHT_BOX = 80

// Copyable value component with click-to-copy (no icon, just hover highlight)
function CopyableValue({ value, className = '' }: { value: string | number; className?: string }) {
  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      try {
        await navigator.clipboard.writeText(String(value))
      } catch (err) {
        console.error('Failed to copy:', err)
      }
    },
    [value]
  )

  return (
    <button
      onClick={handleCopy}
      className={`hover:text-[var(--color-accent)] transition-colors cursor-pointer ${className}`}
      title="Click to copy"
    >
      {String(value)}
    </button>
  )
}

export function ColumnHoverCard({ client, tableName, column }: Props) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedChartType, setSelectedChartType] = useState<PipelineChartType | null>(null)
  const activeNodeId = usePipelineStore((s) => s.activeNodeId)
  const activeNode = usePipelineStore((s) => (s.activeNodeId ? s.nodes[s.activeNodeId] : null))
  const setCanvasMode = usePanelStore((s) => s.setCanvasMode)
  const openChartPanel = usePanelStore((s) => s.openChartPanel)

  // Get chart suggestions for this column type
  const chartSuggestions = useMemo(() => {
    return CHART_SUGGESTIONS[column.type] ?? CHART_SUGGESTIONS.string
  }, [column.type])

  const handleCreateChart = useCallback(() => {
    if (!activeNodeId || !activeNode) return
    // Switch to canvas and open chart panel with selected type
    setCanvasMode(true)
    // Small delay to let canvas render, then open chart panel
    setTimeout(() => {
      openChartPanel(activeNodeId, undefined, { x: window.innerWidth / 2, y: 100 }, selectedChartType ?? undefined)
    }, 50)
  }, [activeNodeId, activeNode, setCanvasMode, openChartPanel, selectedChartType])

  useEffect(() => {
    let cancelled = false

    async function loadStats() {
      const col = `"${column.name}"`

      try {
        const baseResult = await client.query<Record<string, unknown>>(`
          SELECT
            COUNT(*) as cnt,
            COUNT(*) - COUNT(${col}) as null_cnt,
            COUNT(DISTINCT ${col}) as unique_cnt
          FROM "${tableName}"
        `)
        const base = baseResult.rows[0] ?? {}

        const count = Number(base.cnt)
        const nullCount = Number(base.null_cnt)
        const uniqueCount = Number(base.unique_cnt)
        const uniqueRatio = calculateUniqueRatio(count, nullCount, uniqueCount)

        const result: Stats = {
          count,
          nullCount,
          uniqueCount,
          uniqueRatio,
          chartType: 'none',
        }

        if (column.type === 'number') {
          const numResult = await client.query<Record<string, unknown>>(`
            SELECT
              MIN(${col}) as min_val,
              MAX(${col}) as max_val,
              AVG(${col}) as mean_val,
              STDDEV(${col}) as std_dev,
              MEDIAN(${col}) as median_val,
              PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ${col}) as p25,
              PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ${col}) as p75
            FROM "${tableName}"
          `)
          const num = numResult.rows[0] ?? {}
          const minVal = toNumber(num.min_val)
          const maxVal = toNumber(num.max_val)
          const meanVal = toNumber(num.mean_val)
          const stdDevVal = toNumber(num.std_dev)
          const medianVal = toNumber(num.median_val)
          const p25Val = toNumber(num.p25)
          const p75Val = toNumber(num.p75)

          result.min = minVal ?? undefined
          result.max = maxVal ?? undefined
          result.mean = meanVal ?? undefined
          result.stdDev = stdDevVal ?? undefined
          result.median = medianVal ?? undefined
          result.p25 = p25Val ?? undefined
          result.p75 = p75Val ?? undefined

          // Calculate IQR outlier bounds and count
          if (p25Val !== null && p75Val !== null) {
            const iqr = p75Val - p25Val
            result.outlierLower = p25Val - 1.5 * iqr
            result.outlierUpper = p75Val + 1.5 * iqr

            const outlierResult = await client.query<Record<string, unknown>>(`
              SELECT COUNT(*) as cnt
              FROM "${tableName}"
              WHERE ${col} IS NOT NULL AND (${col} < ${result.outlierLower} OR ${col} > ${result.outlierUpper})
            `)
            const outlierRow = outlierResult.rows[0] ?? {}
            result.outlierCount = Number(outlierRow.cnt)
          }

          // Always generate histogram for numbers (removed strict uniqueRatio check)
          if (minVal !== null && maxVal !== null && minVal !== maxVal) {
            const range = maxVal - minVal
            const binCount = 15
            const binWidth = range / binCount

            const histResult = await client.query<Record<string, unknown>>(`
              SELECT
                FLOOR((${col} - ${minVal}) / (${range} / ${binCount})) as bin,
                COUNT(*) as cnt
              FROM "${tableName}"
              WHERE ${col} IS NOT NULL
              GROUP BY bin
              ORDER BY bin
            `)
            result.histogram = histResult.rows.map((r) => {
              const binIndex = Number(r.bin)
              const binMin = minVal + binIndex * binWidth
              const binMax = binMin + binWidth
              return {
                value: binMin + binWidth / 2,
                count: Number(r.cnt),
                min: binMin,
                max: binMax,
              }
            })
          }
        } else if (column.type === 'date' || column.type === 'timestamp') {
          const dateResult = await client.query<Record<string, unknown>>(`
            SELECT
              MIN(${col}) as min_val,
              MAX(${col}) as max_val,
              DATEDIFF('day', MIN(${col}), MAX(${col})) as span_days
            FROM "${tableName}"
          `)
          const dateRow = dateResult.rows[0] ?? {}

          result.min = formatDuckDBDate(dateRow.min_val) ?? undefined
          result.max = formatDuckDBDate(dateRow.max_val) ?? undefined
          result.dateSpanDays = toNumber(dateRow.span_days) ?? undefined

          // Date histogram - cast to VARCHAR to avoid epoch day/millisecond issues
          if (result.dateSpanDays && result.dateSpanDays > 0) {
            const histResult = await client.query<Record<string, unknown>>(`
              SELECT CAST(DATE_TRUNC('day', ${col}) AS VARCHAR) as day, COUNT(*) as cnt
              FROM "${tableName}"
              WHERE ${col} IS NOT NULL
              GROUP BY day
              ORDER BY day
              LIMIT 30
            `)
            result.histogram = histResult.rows.map((r) => {
              // Extract just the date part (YYYY-MM-DD) from the string
              return { value: String(r.day).split(' ')[0], count: Number(r.cnt) }
            })
          }
        } else if (column.type === 'string' || column.type === 'boolean') {
          // Get mode (most common value)
          const modeResult = await client.query<Record<string, unknown>>(`
            SELECT ${col} as val, COUNT(*) as cnt
            FROM "${tableName}"
            WHERE ${col} IS NOT NULL
            GROUP BY ${col}
            ORDER BY cnt DESC
            LIMIT 1
          `)
          const modeRow = modeResult.rows[0]
          if (modeRow) {
            result.mode = String(modeRow.val)
            result.modeCount = Number(modeRow.cnt)
          }

          // Get sample values (first 5 unique)
          const sampleResult = await client.query<Record<string, unknown>>(`
            SELECT DISTINCT ${col} as val
            FROM "${tableName}"
            WHERE ${col} IS NOT NULL
            LIMIT 5
          `)
          result.sampleValues = sampleResult.rows.map((r) => {
            const val = String(r.val)
            return val.length > 25 ? val.slice(0, 22) + '...' : val
          })

          // Get top values histogram
          const topResult = await client.query<Record<string, unknown>>(`
            SELECT ${col} as val, COUNT(*) as cnt
            FROM "${tableName}"
            WHERE ${col} IS NOT NULL
            GROUP BY ${col}
            ORDER BY cnt DESC
            LIMIT 10
          `)
          result.histogram = topResult.rows.map((r) => {
            const label = String(r.val)
            return {
              value: label.length > 20 ? label.slice(0, 18) + '...' : label,
              count: Number(r.cnt),
            }
          })
        }

        result.chartType = determineChartType(column.type, result)

        if (!cancelled) {
          setStats(result)
          setLoading(false)
        }
      } catch (err) {
        console.error('Failed to load column stats:', err)
        if (!cancelled) setLoading(false)
      }
    }

    loadStats()
    return () => {
      cancelled = true
    }
  }, [client, tableName, column])

  if (loading) {
    return <div className="p-3 text-xs text-[var(--color-text-muted)]">Loading...</div>
  }

  if (!stats) return null

  const nullPct = stats.count > 0 ? ((stats.nullCount / stats.count) * 100).toFixed(1) : '0'
  const uniquePct = stats.count > 0 ? ((stats.uniqueCount / stats.count) * 100).toFixed(1) : '0'

  const renderChart = () => {
    if (!stats.histogram) return null

    const totalCount = stats.count - stats.nullCount

    // Use selected chart type if set, otherwise use auto-determined type
    // Map pipeline chart types to sparkline chart types
    let chartTypeToRender: ChartType = stats.chartType
    if (selectedChartType) {
      switch (selectedChartType) {
        case 'bar':
          chartTypeToRender = 'horizontal-bar'
          break
        case 'line':
          chartTypeToRender = 'line'
          break
        case 'pie':
          chartTypeToRender = 'pie'
          break
        case 'scatter':
          chartTypeToRender = 'histogram' // Show as histogram for scatter preview
          break
        case 'boxplot':
          chartTypeToRender = 'box-plot'
          break
      }
    }

    if (chartTypeToRender === 'none') return null

    switch (chartTypeToRender) {
      case 'box-plot':
        if (stats.min != null && stats.max != null && stats.p25 != null && stats.p75 != null && stats.median != null) {
          return (
            <BoxPlot
              min={stats.min as number}
              p25={stats.p25}
              median={stats.median}
              p75={stats.p75}
              max={stats.max as number}
              width={CHART_WIDTH}
              height={CHART_HEIGHT_BOX}
            />
          )
        }
        return null

      case 'pie':
        return (
          <PieChart
            data={stats.histogram.map((h) => ({ label: String(h.value), count: h.count }))}
            totalCount={totalCount}
            width={CHART_WIDTH}
            height={CHART_HEIGHT_PIE}
          />
        )

      case 'line':
        return (
          <LineChart
            data={stats.histogram.map((h) => ({ date: String(h.value), count: h.count }))}
            totalCount={totalCount}
            width={CHART_WIDTH}
            height={CHART_HEIGHT_DEFAULT}
          />
        )

      case 'histogram':
        return (
          <BarChart
            data={stats.histogram}
            totalCount={totalCount}
            columnType={column.type}
            timeSeries={column.type === 'date' || column.type === 'timestamp'}
            width={CHART_WIDTH}
            height={CHART_HEIGHT_DEFAULT}
          />
        )

      case 'horizontal-bar':
        return (
          <BarChart
            data={stats.histogram}
            totalCount={totalCount}
            columnType={column.type}
            horizontal
            width={CHART_WIDTH}
          />
        )

      default:
        return null
    }
  }

  return (
    <div className="p-3 min-w-[300px] max-h-[70vh] overflow-y-auto">
      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs mb-3 items-baseline">
        <span className="text-[var(--color-text-muted)]">Type</span>
        <span className="font-mono text-[10px]">{column.type}</span>
        <span className="text-[var(--color-text-muted)]">Count</span>
        <span>
          <CopyableValue value={stats.count.toLocaleString()} />
        </span>
        <span className="text-[var(--color-text-muted)]">Unique</span>
        <span>
          <CopyableValue value={stats.uniqueCount.toLocaleString()} />
          <span className="text-[var(--color-text-muted)] ml-1">({uniquePct}%)</span>
        </span>
        <span className="text-[var(--color-text-muted)]">Null</span>
        <span>
          <CopyableValue value={stats.nullCount.toLocaleString()} />
          <span className="text-[var(--color-text-muted)] ml-1">({nullPct}%)</span>
        </span>

        {/* Number-specific stats */}
        {column.type === 'number' && stats.min !== undefined && (
          <>
            <span className="text-[var(--color-text-muted)]">Min</span>
            <span className="tabular-nums">
              <CopyableValue value={typeof stats.min === 'number' ? stats.min : stats.min} />
            </span>
            <span className="text-[var(--color-text-muted)]">Max</span>
            <span className="tabular-nums">
              <CopyableValue value={typeof stats.max === 'number' ? stats.max : (stats.max as string)} />
            </span>
            {stats.mean !== undefined && (
              <>
                <span className="text-[var(--color-text-muted)]">Mean</span>
                <span className="tabular-nums">
                  <CopyableValue value={stats.mean.toFixed(2)} />
                </span>
              </>
            )}
            {stats.median !== undefined && (
              <>
                <span className="text-[var(--color-text-muted)]">Median</span>
                <span className="tabular-nums">
                  <CopyableValue value={stats.median.toFixed(2)} />
                </span>
              </>
            )}
            {stats.stdDev !== undefined && (
              <>
                <span className="text-[var(--color-text-muted)]">Std Dev</span>
                <span className="tabular-nums">
                  <CopyableValue value={stats.stdDev.toFixed(2)} />
                </span>
              </>
            )}
            {stats.p25 !== undefined && stats.p75 !== undefined && (
              <>
                <span className="text-[var(--color-text-muted)]">IQR</span>
                <span className="tabular-nums">
                  {stats.p25.toFixed(1)} – {stats.p75.toFixed(1)}
                </span>
              </>
            )}
            {stats.outlierCount !== undefined && stats.outlierCount > 0 && (
              <>
                <span className="text-[var(--color-text-muted)]">Outliers</span>
                <span
                  className={stats.count > 0 && (stats.outlierCount / stats.count) * 100 > 5 ? 'text-orange-500' : ''}
                >
                  {stats.outlierCount.toLocaleString()}
                  <span className="text-[var(--color-text-muted)] ml-1">
                    ({((stats.outlierCount / stats.count) * 100).toFixed(1)}%)
                  </span>
                </span>
              </>
            )}
          </>
        )}

        {/* Date/timestamp stats */}
        {(column.type === 'date' || column.type === 'timestamp') && stats.min !== undefined && (
          <>
            <span className="text-[var(--color-text-muted)]">Min</span>
            <span className="font-mono text-[10px]">
              <CopyableValue value={stats.min as string} />
            </span>
            <span className="text-[var(--color-text-muted)]">Max</span>
            <span className="font-mono text-[10px]">
              <CopyableValue value={stats.max as string} />
            </span>
          </>
        )}

        {/* String-specific stats */}
        {(column.type === 'string' || column.type === 'boolean') && stats.mode && (
          <>
            <span className="text-[var(--color-text-muted)]">Mode</span>
            <span title={stats.mode}>
              <CopyableValue value={stats.mode.length > 15 ? stats.mode.slice(0, 12) + '...' : stats.mode} />
              <span className="text-[var(--color-text-muted)] ml-1">({stats.modeCount})</span>
            </span>
          </>
        )}
      </div>

      {/* Sample values for strings when no chart */}
      {stats.sampleValues && stats.sampleValues.length > 0 && stats.chartType === 'none' && (
        <div className="mt-2 pt-2 border-t border-[var(--color-border-light)]">
          <div className="text-[10px] text-[var(--color-text-muted)] mb-1">Sample values</div>
          <div className="flex flex-wrap gap-1">
            {stats.sampleValues.map((val, i) => (
              <button
                key={i}
                onClick={() => navigator.clipboard.writeText(val)}
                className="px-1.5 py-0.5 text-[10px] bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] cursor-pointer transition-colors"
                title={`Click to copy: ${val}`}
              >
                {val}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chart - dynamic min-height prevents shrinking when switching types */}
      <div className="mt-2 overflow-visible min-h-[120px]">{renderChart()}</div>

      {/* Chart type switcher */}
      {chartSuggestions.length > 0 && stats.histogram && (
        <div className="mt-3 pt-2 border-t border-[var(--color-border-light)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-0.5">
              {chartSuggestions.map(({ type, icon: Icon, label }) => (
                <button
                  key={type}
                  onClick={() => setSelectedChartType(type === selectedChartType ? null : type)}
                  title={label}
                  className={`p-1.5 rounded transition-colors ${
                    selectedChartType === type
                      ? 'text-[var(--color-accent)] bg-[var(--color-accent-bg)]'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
            {activeNodeId && (
              <button
                onClick={handleCreateChart}
                className="flex items-center gap-1 px-2 py-1 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-bg)] rounded transition-colors"
                title="Create chart node"
              >
                <Plus className="w-3 h-3" />
                <span>Create</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
