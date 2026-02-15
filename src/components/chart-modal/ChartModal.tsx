import * as Dialog from '@radix-ui/react-dialog'
import BarChart2 from 'lucide-react/dist/esm/icons/bar-chart-2'
import BoxSelect from 'lucide-react/dist/esm/icons/box-select'
import Download from 'lucide-react/dist/esm/icons/download'
import GitCompare from 'lucide-react/dist/esm/icons/git-compare'
import Grid from 'lucide-react/dist/esm/icons/grid'
import LineChart from 'lucide-react/dist/esm/icons/line-chart'
import PieChart from 'lucide-react/dist/esm/icons/pie-chart'
import ScatterChart from 'lucide-react/dist/esm/icons/scatter-chart'
import TreesIcon from 'lucide-react/dist/esm/icons/trees'
import X from 'lucide-react/dist/esm/icons/x'
import { useCallback, useEffect, useRef, useState } from 'react'
import { PreviewDataGrid } from '@/components/common/PreviewDataGrid'
import {
  BarChart,
  BoxPlot,
  HeatmapChart,
  LineChart as LineChartComponent,
  PieChart as PieChartComponent,
  ScatterChart as ScatterChartComponent,
  StackedAreaChart,
  StackedBarChart,
  TreemapChart,
} from '@/components/data-grid/charts'
import { CorrelationMatrix } from '@/components/profiling'
import { Label, Select } from '@/components/ui'
import { useDuckDB } from '@/lib/duckdb'
import { escapeIdentifier } from '@/lib/duckdb/sql-builder'
import { useChartData } from '@/lib/duckdb/useChartData'
import { useHydratedNodes } from '@/lib/pipeline/hooks/useHydratedNodes'
import { type CorrelationMatrix as CorrelationData, computeCorrelationMatrix } from '@/lib/profiling/correlation'
import { useDialogStore } from '@/stores/dialogStore'
import { usePipelineStore } from '@/stores/pipelineStore'
import type { ChartAggregation, ChartConfig, ChartType, Column } from '@/types'

type TabType = 'config' | 'data' | 'stats'

const CHART_TYPES: Array<{ type: ChartType; label: string; icon: typeof BarChart2 }> = [
  { type: 'bar', label: 'Bar', icon: BarChart2 },
  { type: 'line', label: 'Line', icon: LineChart },
  { type: 'pie', label: 'Pie', icon: PieChart },
  { type: 'scatter', label: 'Scatter', icon: ScatterChart },
  { type: 'stackedBar', label: 'Stacked', icon: BarChart2 },
  { type: 'heatmap', label: 'Heatmap', icon: Grid },
  { type: 'treemap', label: 'Treemap', icon: TreesIcon },
  { type: 'boxplot', label: 'Box Plot', icon: BoxSelect },
  { type: 'correlationMatrix', label: 'Correlation', icon: GitCompare },
]

const AGGREGATIONS: Array<{ value: ChartAggregation; label: string }> = [
  { value: 'count', label: 'Count' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
]

function isNumericType(type: Column['type']): boolean {
  const numericTypes = ['number', 'integer', 'bigint', 'float', 'double', 'decimal']
  return numericTypes.includes(type.toLowerCase())
}

export function ChartModal() {
  const activeDialog = useDialogStore((s) => s.activeDialog)
  const closeDialog = useDialogStore((s) => s.closeDialog)
  const nodes = useHydratedNodes()
  const updateChartNode = usePipelineStore((s) => s.updateChartNode)
  const { client } = useDuckDB()
  const chartRef = useRef<HTMLDivElement>(null)

  const [activeTab, setActiveTab] = useState<TabType>('config')

  // Get state from activeDialog
  const chartModalOpen = activeDialog?.type === 'chartModal'
  const chartModalNodeId = chartModalOpen ? activeDialog.nodeId : null

  // Chart configuration state
  const chartNode = chartModalNodeId ? nodes[chartModalNodeId] : null
  const isChartNode = chartNode?.type === 'chart'
  const chartConfig = isChartNode ? chartNode.config : null

  const parentId = isChartNode ? chartNode.parentId : null
  const parentNode = parentId ? nodes[parentId] : null

  const [chartType, setChartType] = useState<ChartType>('bar')
  const [xColumn, setXColumn] = useState<string>('')
  const [yColumn, setYColumn] = useState<string>('')
  const [aggregation, setAggregation] = useState<ChartAggregation>('count')
  const [colorColumn, setColorColumn] = useState<string>('')
  const [sizeColumn, setSizeColumn] = useState<string>('')

  const columns: Column[] = parentNode?.columns ?? []
  const numericColumns = columns.filter((c) => isNumericType(c.type))

  // Correlation matrix special handling
  const isCorrelation = chartType === 'correlationMatrix'
  const [correlationData, setCorrelationData] = useState<CorrelationData | null>(null)
  const [correlationLoading, setCorrelationLoading] = useState(false)

  useEffect(() => {
    if (!isCorrelation || !client || !parentNode?.tableName || !parentNode?.columns) return

    setCorrelationLoading(true)
    computeCorrelationMatrix(client, parentNode.tableName, parentNode.columns)
      .then(setCorrelationData)
      .finally(() => setCorrelationLoading(false))
  }, [client, parentNode?.tableName, parentNode?.columns, isCorrelation])

  // Track if user has made changes (to avoid auto-updating on mount)
  const hasUserChangedRef = useRef(false)
  const initializedRef = useRef(false)

  // Auto-select first matching column for each field based on chart type
  const getDefaultXColumn = useCallback(
    (type: ChartType) => {
      if (type === 'correlationMatrix') return ''
      if (type === 'boxplot') return numericColumns[0]?.name ?? ''
      // For most charts, prefer categorical columns for X axis
      const categoricalColumns = columns.filter((c) => !isNumericType(c.type))
      return categoricalColumns[0]?.name ?? columns[0]?.name ?? ''
    },
    [columns, numericColumns]
  )

  const getDefaultYColumn = useCallback(
    (type: ChartType) => {
      if (!['bar', 'line', 'scatter', 'stackedBar', 'heatmap'].includes(type)) return ''
      return numericColumns[0]?.name ?? ''
    },
    [numericColumns]
  )

  // Initialize config from existing chart config (only once when modal opens)
  useEffect(() => {
    if (chartConfig && !initializedRef.current) {
      initializedRef.current = true
      setChartType(chartConfig.chartType)
      // Use existing values or auto-select defaults
      setXColumn(chartConfig.xAxis?.column ?? getDefaultXColumn(chartConfig.chartType))
      const existingY = Array.isArray(chartConfig.yAxis) ? chartConfig.yAxis[0]?.column : chartConfig.yAxis?.column
      setYColumn(existingY ?? getDefaultYColumn(chartConfig.chartType))
      setAggregation(chartConfig.aggregation ?? 'count')
      setColorColumn(chartConfig.colorBy ?? '')
      setSizeColumn(chartConfig.sizeBy ?? '')
    }
  }, [chartConfig, getDefaultXColumn, getDefaultYColumn])

  // Reset initialized flag when modal closes
  useEffect(() => {
    if (!chartModalOpen) {
      initializedRef.current = false
      hasUserChangedRef.current = false
    }
  }, [chartModalOpen])

  // Debounced chart update - only when user makes changes
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isUpdatingRef = useRef(false)

  const updateChartConfigFn = useCallback(async () => {
    if (!chartModalNodeId || !parentNode || isUpdatingRef.current) return
    if (!isChartNode) return

    isUpdatingRef.current = true

    try {
      const newConfig: ChartConfig = {
        chartType,
        xAxis: xColumn ? { column: xColumn } : undefined,
        yAxis: yColumn ? { column: yColumn } : undefined,
        aggregation,
        colorBy: colorColumn || undefined,
        sizeBy: sizeColumn || undefined,
      }

      // Update the chart node in the store (no DuckDB view needed)
      updateChartNode(chartModalNodeId, { config: newConfig })

      hasUserChangedRef.current = false
    } catch (err) {
      console.error('Failed to update chart:', err)
    } finally {
      isUpdatingRef.current = false
    }
  }, [
    chartModalNodeId,
    parentNode,
    isChartNode,
    chartType,
    xColumn,
    yColumn,
    aggregation,
    colorColumn,
    sizeColumn,
    updateChartNode,
  ])

  // Trigger update only when user changes config
  useEffect(() => {
    if (!hasUserChangedRef.current || !chartModalOpen) return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(updateChartConfigFn, 600)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [chartType, xColumn, yColumn, aggregation, colorColumn, sizeColumn, chartModalOpen, updateChartConfigFn])

  // Handlers that mark user changes
  const handleChartTypeChange = (type: ChartType) => {
    hasUserChangedRef.current = true
    setChartType(type)
    // Auto-select appropriate columns for the new chart type
    setXColumn(getDefaultXColumn(type))
    setYColumn(getDefaultYColumn(type))
  }
  const handleXColumnChange = (val: string) => {
    hasUserChangedRef.current = true
    setXColumn(val)
  }
  const handleYColumnChange = (val: string) => {
    hasUserChangedRef.current = true
    setYColumn(val)
  }
  const handleAggregationChange = (val: ChartAggregation) => {
    hasUserChangedRef.current = true
    setAggregation(val)
  }
  const handleColorColumnChange = (val: string) => {
    hasUserChangedRef.current = true
    setColorColumn(val)
  }
  const handleSizeColumnChange = (val: string) => {
    hasUserChangedRef.current = true
    setSizeColumn(val)
  }

  // Chart data - skip for correlation matrix which uses special handling
  const {
    data: chartData,
    loading: chartLoading,
    error: chartError,
  } = useChartData(
    client,
    isCorrelation ? undefined : parentNode?.tableName,
    isCorrelation ? undefined : (chartConfig ?? undefined),
    parentId ?? undefined
  )

  // Unified loading/error states
  const loading = isCorrelation ? correlationLoading : chartLoading
  const error = isCorrelation ? null : chartError

  // Data tab: fetch preview rows
  const [previewData, setPreviewData] = useState<Record<string, unknown>[] | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  useEffect(() => {
    if (activeTab !== 'data' || !client || !parentNode?.tableName) return

    setPreviewLoading(true)
    setPreviewError(null)

    client
      .query<Record<string, unknown>>(`SELECT * FROM ${escapeIdentifier(parentNode.tableName)} LIMIT 100`)
      .then((result) => {
        setPreviewData(result.rows)
      })
      .catch((err) => setPreviewError(err.message))
      .finally(() => setPreviewLoading(false))
  }, [activeTab, client, parentNode?.tableName])

  // Stats tab: fetch column stats
  const [stats, setStats] = useState<Record<string, Record<string, unknown>> | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)

  useEffect(() => {
    if (activeTab !== 'stats' || !client || !parentNode?.tableName || !chartConfig) return

    const columnsToFetch = [
      chartConfig.xAxis?.column,
      Array.isArray(chartConfig.yAxis) ? chartConfig.yAxis[0]?.column : chartConfig.yAxis?.column,
    ].filter(Boolean) as string[]

    if (columnsToFetch.length === 0) return

    setStatsLoading(true)

    Promise.all(
      columnsToFetch.map(async (colName) => {
        const col = columns.find((c) => c.name === colName)
        if (!col) return null

        const isNumeric = isNumericType(col.type)
        const escapedCol = escapeIdentifier(colName)
        const parentTableName = parentNode.tableName
        if (!parentTableName) return null
        const escapedTable = escapeIdentifier(parentTableName)

        const sql = isNumeric
          ? `SELECT
               COUNT(*) as count,
               COUNT(${escapedCol}) as non_null,
               COUNT(DISTINCT ${escapedCol}) as unique_count,
               MIN(${escapedCol}) as min,
               MAX(${escapedCol}) as max,
               AVG(${escapedCol}) as mean,
               MEDIAN(${escapedCol}) as median,
               STDDEV(${escapedCol}) as stddev
             FROM ${escapedTable}`
          : `SELECT
               COUNT(*) as count,
               COUNT(${escapedCol}) as non_null,
               COUNT(DISTINCT ${escapedCol}) as unique_count
             FROM ${escapedTable}`

        const result = await client.query<Record<string, unknown>>(sql)
        const row = result.rows[0] ?? {}
        return { colName, stats: row }
      })
    )
      .then((results) => {
        const statsMap: Record<string, Record<string, unknown>> = {}
        for (const r of results) {
          if (r) statsMap[r.colName] = r.stats
        }
        setStats(statsMap)
      })
      .finally(() => setStatsLoading(false))
  }, [activeTab, client, parentNode?.tableName, chartConfig, columns])

  // Dynamic chart size based on modal dimensions
  const [chartSize, setChartSize] = useState({ width: 900, height: 450 })

  // Measure chart container and update size (debounced to avoid layout thrashing)
  useEffect(() => {
    if (!chartModalOpen || !chartRef.current) return

    let resizeTimeout: ReturnType<typeof setTimeout> | null = null

    const updateSize = () => {
      const container = chartRef.current
      if (container) {
        const rect = container.getBoundingClientRect()
        // Leave some padding
        setChartSize({
          width: Math.max(400, rect.width - 32),
          height: Math.max(300, rect.height - 32),
        })
      }
    }

    const debouncedUpdateSize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(updateSize, 100)
    }

    // Initial measurement after a short delay to allow DOM to settle
    const timeout = setTimeout(updateSize, 50)
    window.addEventListener('resize', debouncedUpdateSize)

    return () => {
      clearTimeout(timeout)
      if (resizeTimeout) clearTimeout(resizeTimeout)
      window.removeEventListener('resize', debouncedUpdateSize)
    }
  }, [chartModalOpen])

  const handleClose = useCallback(() => {
    closeDialog()
  }, [closeDialog])

  const handleExport = useCallback(() => {
    const echartsWrapper = chartRef.current?.querySelector('.echarts-for-react')
    if (echartsWrapper) {
      const instance = (
        echartsWrapper as unknown as {
          getEchartsInstance: () => { getDataURL: (opts: { type: string; backgroundColor: string }) => string }
        }
      ).getEchartsInstance?.()
      if (instance) {
        const url = instance.getDataURL({ type: 'png', backgroundColor: '#fff' })
        const a = document.createElement('a')
        a.href = url
        a.download = `${chartNode?.name ?? 'chart'}.png`
        a.click()
      }
    }
  }, [chartNode?.name])

  if (!chartNode || !chartConfig) return null

  // Chart type visibility flags (isCorrelation already defined above)
  const isBoxplot = chartType === 'boxplot'
  const showXColumn = !isCorrelation
  const showYColumn = ['bar', 'line', 'scatter', 'stackedBar', 'heatmap'].includes(chartType)
  const showColorColumn = ['scatter', 'stackedBar', 'stackedArea'].includes(chartType)
  const showSizeColumn = ['scatter', 'treemap'].includes(chartType)
  const showAggregation = ['bar', 'line', 'pie', 'heatmap', 'treemap'].includes(chartType)
  const xAxisColumns = isBoxplot ? numericColumns : columns

  return (
    <Dialog.Root open={chartModalOpen} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="dialog-content w-[95vw] max-w-[1200px] h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] shrink-0">
            <div>
              <Dialog.Title className="text-base font-medium">{chartNode.name}</Dialog.Title>
              <Dialog.Description className="text-xs text-[var(--color-text-muted)]">
                Source: {parentNode?.name ?? 'Unknown'}
              </Dialog.Description>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]"
              >
                <Download className="w-3.5 h-3.5" />
                Export PNG
              </button>
              <Dialog.Close asChild>
                <button className="p-2 rounded hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]">
                  <X className="w-5 h-5" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* Chart Area - fills available space */}
          <div className="flex-1 min-h-0 flex items-center justify-center p-4" ref={chartRef}>
            {loading ? <div className="text-[var(--color-text-muted)]">Loading chart data...</div> : null}
            {error ? <div className="text-red-500">{error}</div> : null}
            {!loading && !error && isCorrelation && correlationData && (
              <CorrelationMatrix data={correlationData} panelWidth={chartSize.width} />
            )}
            {!loading &&
              !error &&
              !isCorrelation &&
              chartData &&
              renderChart(chartConfig.chartType, chartData, chartConfig, chartSize)}
            {!loading && !error && !isCorrelation && !chartData && !correlationData && (
              <div className="text-[var(--color-text-muted)]">No data available</div>
            )}
          </div>

          {/* Tab Bar */}
          <div className="flex items-center gap-1 px-4 py-2 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            {(['config', 'data', 'stats'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  activeTab === tab
                    ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] shadow-sm'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {tab === 'config' ? 'Chart Config' : tab === 'data' ? 'Data' : 'Statistics'}
              </button>
            ))}
            <div className="ml-auto text-xs text-[var(--color-text-muted)]">
              {typeof chartNode.rowCount === 'number' ? chartNode.rowCount.toLocaleString() : '...'} rows
            </div>
          </div>

          {/* Tab Content */}
          <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-primary)]">
            {activeTab === 'config' && (
              <div className="p-4 space-y-4">
                {/* Chart Type Grid */}
                <div>
                  <Label className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-2 block">
                    Chart Type
                  </Label>
                  <div className="flex flex-wrap gap-1">
                    {CHART_TYPES.map(({ type, label, icon: Icon }) => (
                      <button
                        key={type}
                        onClick={() => handleChartTypeChange(type)}
                        title={label}
                        className={`px-3 py-2 rounded flex items-center gap-1.5 text-xs transition-colors ${
                          chartType === type
                            ? 'bg-[var(--color-accent-bg)] text-[var(--color-accent)]'
                            : 'hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Axis Selectors */}
                <div className="flex gap-4 flex-wrap">
                  {showXColumn && (
                    <div className="min-w-[180px]">
                      <Label className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
                        {isBoxplot ? 'Value (numeric)' : chartType === 'scatter' ? 'X Axis' : 'Category'}
                      </Label>
                      <Select
                        value={xColumn}
                        onChange={(e) => handleXColumnChange(e.target.value)}
                        className="mt-1 text-xs"
                        disabled={xAxisColumns.length === 0}
                      >
                        {xAxisColumns.map((col) => (
                          <option key={col.name} value={col.name}>
                            {col.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}

                  {isCorrelation && (
                    <div className="text-xs text-[var(--color-text-muted)] py-4">
                      Auto-correlates all numeric columns.
                    </div>
                  )}

                  {showYColumn && (
                    <div className="min-w-[180px]">
                      <Label className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
                        {chartType === 'scatter' ? 'Y Axis' : 'Value'}
                      </Label>
                      <Select
                        value={yColumn}
                        onChange={(e) => handleYColumnChange(e.target.value)}
                        className="mt-1 text-xs"
                        disabled={columns.length === 0}
                      >
                        {columns.map((col) => (
                          <option key={col.name} value={col.name}>
                            {col.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}

                  {showAggregation && (
                    <div className="min-w-[140px]">
                      <Label className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
                        Aggregation
                      </Label>
                      <Select
                        value={aggregation}
                        onChange={(e) => handleAggregationChange(e.target.value as ChartAggregation)}
                        className="mt-1 text-xs"
                      >
                        {AGGREGATIONS.map(({ value, label }) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}

                  {showColorColumn && (
                    <div className="min-w-[140px]">
                      <Label className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
                        Color By
                      </Label>
                      <Select
                        value={colorColumn}
                        onChange={(e) => handleColorColumnChange(e.target.value)}
                        className="mt-1 text-xs"
                      >
                        <option value="">None</option>
                        {columns.map((col) => (
                          <option key={col.name} value={col.name}>
                            {col.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}

                  {showSizeColumn && (
                    <div className="min-w-[140px]">
                      <Label className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
                        Size By
                      </Label>
                      <Select
                        value={sizeColumn}
                        onChange={(e) => handleSizeColumnChange(e.target.value)}
                        className="mt-1 text-xs"
                      >
                        <option value="">None</option>
                        {numericColumns.map((col) => (
                          <option key={col.name} value={col.name}>
                            {col.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'data' && (
              <div className="p-4 max-h-[250px] overflow-auto">
                <PreviewDataGrid
                  data={previewData}
                  columns={columns}
                  loading={previewLoading}
                  error={previewError}
                  rowCount={parentNode?.rowCount ?? null}
                  height={200}
                />
              </div>
            )}

            {activeTab === 'stats' && (
              <div className="p-4">
                {statsLoading ? (
                  <div className="text-xs text-[var(--color-text-muted)]">Loading statistics...</div>
                ) : null}
                {!statsLoading && stats && (
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(stats).map(([colName, colStats]) => (
                      <div key={colName} className="p-3 rounded border border-[var(--color-border)]">
                        <div className="text-xs font-medium mb-2">{colName}</div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          <StatRow label="Count" value={formatNumber(colStats.count)} />
                          <StatRow
                            label="Null %"
                            value={`${((1 - Number(colStats.non_null) / Number(colStats.count)) * 100).toFixed(1)}%`}
                          />
                          <StatRow
                            label="Unique"
                            value={`${formatNumber(colStats.unique_count)} (${((Number(colStats.unique_count) / Number(colStats.count)) * 100).toFixed(1)}%)`}
                          />
                          {colStats.min !== undefined ? (
                            <StatRow label="Min" value={formatNumber(colStats.min)} />
                          ) : null}
                          {colStats.max !== undefined ? (
                            <StatRow label="Max" value={formatNumber(colStats.max)} />
                          ) : null}
                          {colStats.mean !== undefined ? (
                            <StatRow label="Mean" value={formatNumber(colStats.mean)} />
                          ) : null}
                          {colStats.median !== undefined && (
                            <StatRow label="Median" value={formatNumber(colStats.median)} />
                          )}
                          {colStats.stddev !== undefined && (
                            <StatRow label="Std Dev" value={formatNumber(colStats.stddev)} />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!statsLoading && !stats && (
                  <div className="text-xs text-[var(--color-text-muted)]">No columns selected for statistics.</div>
                )}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(value)
  }

  return (
    <>
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <button
        onClick={handleCopy}
        className="font-mono text-left hover:bg-[var(--color-bg-secondary)] px-1 -mx-1 rounded cursor-pointer"
        title="Click to copy"
      >
        {value}
      </button>
    </>
  )
}

function formatNumber(value: unknown): string {
  if (value === null || value === undefined) return '-'
  const num = Number(value)
  if (Number.isNaN(num)) return String(value)
  if (Number.isInteger(num)) return num.toLocaleString()
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function renderChart(
  chartType: ChartType,
  data: unknown,
  config: ChartConfig,
  size: { width: number; height: number }
) {
  const xLabel = config.xAxis?.label ?? config.xAxis?.column ?? 'X'
  const yLabel = Array.isArray(config.yAxis)
    ? (config.yAxis[0]?.label ?? config.yAxis[0]?.column ?? 'Value')
    : (config.yAxis?.label ?? config.yAxis?.column ?? 'Value')

  switch (chartType) {
    case 'scatter':
      return (
        <ScatterChartComponent
          data={data as Array<{ x: number | string; y: number | string; size?: number; color?: number | string }>}
          xLabel={xLabel}
          yLabel={yLabel}
          sizeColumn={config.sizeBy}
          colorColumn={config.colorBy}
          {...size}
        />
      )

    case 'stackedBar':
      return (
        <StackedBarChart
          data={data as Array<{ category: string; series: string; value: number }>}
          categoryLabel={xLabel}
          valueLabel={yLabel}
          {...size}
        />
      )

    case 'stackedArea':
      return (
        <StackedAreaChart
          data={data as Array<{ x: string | number; series: string; value: number }>}
          xLabel={xLabel}
          yLabel={yLabel}
          {...size}
        />
      )

    case 'heatmap':
      return (
        <HeatmapChart
          data={data as Array<{ x: string | number; y: string | number; value: number }>}
          xLabel={xLabel}
          yLabel={yLabel}
          {...size}
        />
      )

    case 'treemap':
      return (
        <TreemapChart
          data={data as Array<{ name: string; value: number; children?: Array<{ name: string; value: number }> }>}
          valueLabel={yLabel}
          {...size}
        />
      )

    case 'boxplot': {
      const boxData = data as { min: number; p25: number; median: number; p75: number; max: number }
      return <BoxPlot {...boxData} {...size} />
    }

    case 'pie':
      return (
        <PieChartComponent
          data={(data as Array<{ label: string; value: number }>).map((d) => ({ label: d.label, count: d.value }))}
          totalCount={(data as Array<{ label: string; value: number }>).reduce((sum, d) => sum + d.value, 0)}
          {...size}
        />
      )

    case 'line':
      return (
        <LineChartComponent
          data={(data as Array<{ label: string; value: number }>).map((d) => ({ date: d.label, count: d.value }))}
          totalCount={(data as Array<{ label: string; value: number }>).reduce((sum, d) => sum + d.value, 0)}
          {...size}
        />
      )

    default:
      return (
        <BarChart
          data={(data as Array<{ label: string; value: number }>).map((d) => ({ value: d.label, count: d.value }))}
          totalCount={(data as Array<{ label: string; value: number }>).reduce((sum, d) => sum + d.value, 0)}
          columnType="string"
          horizontal
          {...size}
        />
      )
  }
}
