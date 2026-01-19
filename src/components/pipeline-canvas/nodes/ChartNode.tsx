import * as echarts from 'echarts'
import {
  BarChart2,
  BoxSelect,
  Combine,
  Download,
  Expand,
  Gauge,
  GitCompare,
  GitPullRequestArrow,
  Grid,
  Hash,
  LineChart,
  type LucideIcon,
  Pencil,
  PieChart as PieIcon,
  ScatterChart,
  TreesIcon,
} from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import {
  BarChart,
  BoxPlot,
  ComboChart,
  FunnelChart,
  GaugeChart,
  HeatmapChart,
  KPICard,
  LineChart as LineChartComponent,
  PieChart,
  ScatterChart as ScatterChartComponent,
  StackedAreaChart,
  StackedBarChart,
  TreemapChart,
} from '@/components/data-grid/charts'
import { CorrelationMatrix } from '@/components/profiling'
import { useDuckDB } from '@/lib/duckdb'
import { useChartData } from '@/lib/duckdb/useChartData'
import { type CorrelationMatrix as CorrelationData, computeCorrelationMatrix } from '@/lib/profiling/correlation'
import { useDialogStore, usePanelStore, usePipelineStore } from '@/stores'
import type { ChartConfig, ChartNode as ChartNodeType, ChartType } from '@/types'
import { NodeActionButton, NodeShell } from './shared'

interface ChartNodeData {
  chart: ChartNodeType
  isActive: boolean
  isSelected: boolean
  isPending?: boolean
  [key: string]: unknown
}

interface ChartTypeConfig {
  icon: LucideIcon
  label: string
}

const CHART_CONFIG: Record<ChartType, ChartTypeConfig> = {
  bar: { icon: BarChart2, label: 'Bar' },
  line: { icon: LineChart, label: 'Line' },
  pie: { icon: PieIcon, label: 'Pie' },
  scatter: { icon: ScatterChart, label: 'Scatter' },
  stackedBar: { icon: BarChart2, label: 'Stacked' },
  stackedArea: { icon: LineChart, label: 'Area' },
  heatmap: { icon: Grid, label: 'Heatmap' },
  treemap: { icon: TreesIcon, label: 'Treemap' },
  boxplot: { icon: BoxSelect, label: 'Box Plot' },
  correlationMatrix: { icon: GitCompare, label: 'Correlation' },
  kpi: { icon: Hash, label: 'KPI' },
  gauge: { icon: Gauge, label: 'Gauge' },
  funnel: { icon: GitPullRequestArrow, label: 'Funnel' },
  combo: { icon: Combine, label: 'Combo' },
}

const CHART_SIZE = { width: 320, height: 220 }

export const ChartNode = memo(function ChartNode({ data }: { data: ChartNodeData }) {
  const { chart, isActive, isSelected, isPending } = data
  const { client } = useDuckDB()
  const { nodes, dataVersion } = usePipelineStore()
  const { openChartPanel } = usePanelStore()
  const { openDialog } = useDialogStore()
  const chartRef = useRef<HTMLDivElement>(null)

  const chartConfig = chart.config
  const chartType = chartConfig.chartType
  const visualConfig = CHART_CONFIG[chartType]
  const Icon = visualConfig.icon

  const parentId = chart.parentId
  const parentNode = parentId ? nodes[parentId] : null

  const isCorrelation = chartType === 'correlationMatrix'
  const {
    data: chartData,
    loading,
    error,
  } = useChartData(
    client,
    isCorrelation ? undefined : parentNode?.tableName,
    isCorrelation ? undefined : chartConfig,
    String(dataVersion)
  )

  const [correlationData, setCorrelationData] = useState<CorrelationData | null>(null)
  const [correlationLoading, setCorrelationLoading] = useState(false)
  const [correlationError, setCorrelationError] = useState<string | null>(null)

  useEffect(() => {
    if (!isCorrelation || !client || !parentNode?.tableName || !parentNode?.columns) return

    setCorrelationLoading(true)
    setCorrelationError(null)

    computeCorrelationMatrix(client, parentNode.tableName, parentNode.columns)
      .then((data) => {
        setCorrelationData(data)
        setCorrelationLoading(false)
      })
      .catch((err) => {
        setCorrelationError(err.message)
        setCorrelationLoading(false)
      })
  }, [client, parentNode?.tableName, parentNode?.columns, isCorrelation, dataVersion])

  const isLoading = isCorrelation ? correlationLoading : loading
  const chartError = isCorrelation ? correlationError : error
  const hasData = isCorrelation ? correlationData !== null : chartData !== null

  const handleEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (parentId && chartRef.current) {
        const rect = chartRef.current.getBoundingClientRect()
        openChartPanel(parentId, chart.id, { x: rect.left, y: rect.top })
      }
    },
    [parentId, chart.id, openChartPanel]
  )

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      const chartElement = chartRef.current?.querySelector('[_echarts_instance_]')
      if (chartElement) {
        const instance = echarts.getInstanceByDom(chartElement as HTMLElement)
        if (instance) {
          const url = instance.getDataURL({
            type: 'png',
            pixelRatio: 2,
            backgroundColor: '#fff',
          })
          const a = document.createElement('a')
          a.href = url
          a.download = `${chart.name}.png`
          a.click()
        }
      }
    },
    [chart.name]
  )

  const handleDoubleClick = useCallback(() => {
    openDialog({ type: 'chartModal', nodeId: chart.id })
  }, [chart.id, openDialog])

  const handleExpand = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      openDialog({ type: 'chartModal', nodeId: chart.id })
    },
    [chart.id, openDialog]
  )

  const formatCount = (n: number | null) => (n === null ? '...' : n.toLocaleString())

  return (
    <NodeShell
      isActive={isActive}
      isSelected={isSelected}
      isPending={isPending ?? false}
      hasSourceHandle={false}
      hasTargetHandle={true}
      className="overflow-hidden"
    >
      <div onDoubleClick={handleDoubleClick}>
        {/* Chart visualization area */}
        <div
          ref={chartRef}
          className="w-[320px] h-[220px] flex items-center justify-center nopan nodrag bg-[var(--color-bg-primary)]"
        >
          {isPending !== undefined && <Icon className="w-12 h-12 text-[var(--color-text-muted)] opacity-30" />}
          {isPending === undefined && isLoading && (
            <div className="text-xs text-[var(--color-text-muted)]">Loading...</div>
          )}
          {isPending === undefined && chartError && (
            <div className="text-xs text-red-500 p-2 text-center">{chartError}</div>
          )}
          {isPending === undefined && !isLoading && !chartError && isCorrelation && correlationData && (
            <CorrelationMatrix data={correlationData} panelWidth={CHART_SIZE.width} />
          )}
          {isPending === undefined &&
            !isLoading &&
            !chartError &&
            !isCorrelation &&
            chartData &&
            renderChart(chartType, chartData, chartConfig)}
          {isPending === undefined && !isLoading && !chartError && !hasData && (
            <div className="text-xs text-[var(--color-text-muted)]">No data</div>
          )}
        </div>

        {/* Footer with name and actions */}
        <div className="flex items-center gap-2 px-3 py-2 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <Icon className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
          <span className="text-xs font-medium truncate flex-1" title={chart.name}>
            {chart.name}
          </span>
          <span className="text-[10px] text-[var(--color-text-muted)]">{formatCount(chart.rowCount)} rows</span>

          {/* Action buttons - visible on hover */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <NodeActionButton icon={Pencil} onClick={handleEdit} title="Edit chart" />
            <NodeActionButton icon={Download} onClick={handleDownload} title="Download PNG" />
            <NodeActionButton icon={Expand} onClick={handleExpand} title="Expand chart" />
          </div>
        </div>
      </div>
    </NodeShell>
  )
})

function renderChart(chartType: ChartType, data: unknown, config: ChartConfig) {
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
          {...CHART_SIZE}
        />
      )

    case 'stackedBar':
      return (
        <StackedBarChart
          data={data as Array<{ category: string; series: string; value: number }>}
          categoryLabel={xLabel}
          valueLabel={yLabel}
          {...CHART_SIZE}
        />
      )

    case 'stackedArea':
      return (
        <StackedAreaChart
          data={data as Array<{ x: string | number; series: string; value: number }>}
          xLabel={xLabel}
          yLabel={yLabel}
          {...CHART_SIZE}
        />
      )

    case 'heatmap':
      return (
        <HeatmapChart
          data={data as Array<{ x: string | number; y: string | number; value: number }>}
          xLabel={xLabel}
          yLabel={yLabel}
          {...CHART_SIZE}
        />
      )

    case 'treemap':
      return (
        <TreemapChart
          data={data as Array<{ name: string; value: number; children?: Array<{ name: string; value: number }> }>}
          valueLabel={yLabel}
          {...CHART_SIZE}
        />
      )

    case 'boxplot': {
      const boxData = data as { min: number; p25: number; median: number; p75: number; max: number }
      return <BoxPlot {...boxData} {...CHART_SIZE} />
    }

    case 'kpi':
      return (
        <KPICard
          value={(data as { value: number; count: number }).value}
          label={config.title ?? yLabel}
          {...CHART_SIZE}
        />
      )

    case 'gauge':
      return (
        <GaugeChart
          value={(data as { value: number; count: number }).value}
          label={config.title ?? yLabel}
          {...CHART_SIZE}
        />
      )

    case 'funnel':
      return (
        <FunnelChart
          data={(data as Array<{ label: string; value: number }>).map((d) => ({ name: d.label, value: d.value }))}
          {...CHART_SIZE}
        />
      )

    case 'combo':
      return (
        <ComboChart
          data={data as Array<{ category: string; barValue: number; lineValue: number }>}
          barLabel={yLabel}
          lineLabel="Trend"
          xLabel={xLabel}
          {...CHART_SIZE}
        />
      )

    case 'pie':
      return (
        <PieChart
          data={(data as Array<{ label: string; value: number }>).map((d) => ({ label: d.label, count: d.value }))}
          totalCount={(data as Array<{ label: string; value: number }>).reduce((sum, d) => sum + d.value, 0)}
          {...CHART_SIZE}
        />
      )

    case 'line':
      return (
        <LineChartComponent
          data={(data as Array<{ label: string; value: number }>).map((d) => ({ date: d.label, count: d.value }))}
          totalCount={(data as Array<{ label: string; value: number }>).reduce((sum, d) => sum + d.value, 0)}
          {...CHART_SIZE}
        />
      )

    default:
      return (
        <BarChart
          data={(data as Array<{ label: string; value: number }>).map((d) => ({ value: d.label, count: d.value }))}
          totalCount={(data as Array<{ label: string; value: number }>).reduce((sum, d) => sum + d.value, 0)}
          columnType="string"
          horizontal
          {...CHART_SIZE}
        />
      )
  }
}
