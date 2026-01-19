import { memo } from 'react'
import {
  BarChart,
  ComboChart,
  FunnelChart,
  GaugeChart,
  HeatmapChart,
  KPICard,
  LineChart,
  PieChart,
  ScatterChart,
  StackedAreaChart,
  StackedBarChart,
  TreemapChart,
} from '@/components/data-grid/charts'
import type { DuckDBClient } from '@/lib/duckdb/interface'
import { useChartData } from '@/lib/duckdb/useChartData'
import type { DashboardChartConfig } from '@/types'

interface MiniChartPreviewProps {
  chart: DashboardChartConfig
  tableName: string | undefined
  client: DuckDBClient | null
}

export const MiniChartPreview = memo(function MiniChartPreview({ chart, tableName, client }: MiniChartPreviewProps) {
  const { data, loading, error } = useChartData(client, tableName, chart.chartConfig, `mini-${chart.id}`)

  if (loading) {
    return (
      <div className="w-full h-full bg-[var(--color-bg-tertiary)] rounded flex items-center justify-center border border-[var(--color-border)] animate-pulse">
        <div className="w-3/4 h-1/2 bg-[var(--color-bg-secondary)] rounded opacity-50" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="w-full h-full bg-[var(--color-bg-tertiary)] rounded flex items-center justify-center border border-[var(--color-border)]">
        <span className="text-[9px] text-[var(--color-text-muted)]">No data</span>
      </div>
    )
  }

  const chartType = chart.chartConfig.chartType

  return (
    <div className="w-full h-full bg-[var(--color-bg-tertiary)] rounded overflow-hidden border border-[var(--color-border)] mini-chart-container">
      {renderChart(chartType, data)}
    </div>
  )
})

function renderChart(chartType: string, data: unknown) {
  // Use 100% width/height - the container controls the size
  const size = { width: 180, height: 100 }

  switch (chartType) {
    case 'pie':
      return (
        <PieChart
          data={(data as Array<{ label: string; value: number }>)
            .slice(0, 6)
            .map((d) => ({ label: d.label, count: d.value }))}
          totalCount={(data as Array<{ label: string; value: number }>).reduce((sum, d) => sum + d.value, 0)}
          {...size}
        />
      )

    case 'line':
      return (
        <LineChart
          data={(data as Array<{ label: string; value: number }>)
            .slice(0, 12)
            .map((d) => ({ date: d.label, count: d.value }))}
          totalCount={(data as Array<{ label: string; value: number }>).reduce((sum, d) => sum + d.value, 0)}
          {...size}
        />
      )

    case 'scatter':
      return (
        <ScatterChart
          data={(data as Array<{ x: number | string; y: number | string }>).slice(0, 50)}
          xLabel=""
          yLabel=""
          {...size}
        />
      )

    case 'stackedBar':
      return (
        <StackedBarChart
          data={(data as Array<{ category: string; series: string; value: number }>).slice(0, 20)}
          categoryLabel=""
          valueLabel=""
          {...size}
        />
      )

    case 'stackedArea':
      return (
        <StackedAreaChart
          data={(data as Array<{ x: string | number; series: string; value: number }>).slice(0, 20)}
          xLabel=""
          yLabel=""
          {...size}
        />
      )

    case 'heatmap':
      return (
        <HeatmapChart
          data={(data as Array<{ x: string | number; y: string | number; value: number }>).slice(0, 50)}
          xLabel=""
          yLabel=""
          {...size}
        />
      )

    case 'treemap':
      return <TreemapChart data={data as Array<{ name: string; value: number }>} valueLabel="" {...size} />

    case 'kpi':
      return <KPICard value={(data as { value: number; count: number }).value} label="" {...size} />

    case 'gauge':
      return <GaugeChart value={(data as { value: number; count: number }).value} label="" {...size} />

    case 'funnel':
      return (
        <FunnelChart
          data={(data as Array<{ label: string; value: number }>)
            .slice(0, 5)
            .map((d) => ({ name: d.label, value: d.value }))}
          {...size}
        />
      )

    case 'combo':
      return (
        <ComboChart
          data={(data as Array<{ category: string; barValue: number; lineValue: number }>).slice(0, 8)}
          barLabel=""
          lineLabel=""
          xLabel=""
          {...size}
        />
      )

    default:
      // Bar chart
      return (
        <BarChart
          data={(data as Array<{ label: string; value: number }>)
            .slice(0, 6)
            .map((d) => ({ value: d.label, count: d.value }))}
          totalCount={(data as Array<{ label: string; value: number }>).reduce((sum, d) => sum + d.value, 0)}
          columnType="string"
          horizontal
          {...size}
        />
      )
  }
}
