import ReactECharts from 'echarts-for-react'
import { memo, useMemo } from 'react'
import { useChartTheme } from '@/lib/charts'
import type { SparklineProps } from './types'

function SparklineChartInner({ stats, columnType, width = 50, height = 18 }: SparklineProps) {
  const theme = useChartTheme()

  const option = useMemo(() => {
    if (!stats || !stats.histogram || stats.histogram.length === 0) {
      return null
    }

    const chartType = stats.chartType

    const baseConfig = {
      darkMode: theme.isDark,
      animation: false,
      hoverLayerThreshold: Infinity,
      tooltip: { show: false },
      color: [theme.colors.primary],
    }

    // Date/timestamp columns: time-series bar chart with dates on x-axis
    if (columnType === 'date' || columnType === 'timestamp') {
      const histData = stats.histogram.slice(0, 30)
      const values = histData.map((d) => d.count)
      const maxVal = Math.max(...values)

      return {
        ...baseConfig,
        grid: { left: 0, right: 0, top: 2, bottom: 2 },
        xAxis: {
          type: 'time',
          show: false,
          min: histData[0]?.value,
          max: histData[histData.length - 1]?.value,
        },
        yAxis: { type: 'value', show: false, max: maxVal * 1.1 },
        series: [
          {
            type: 'bar',
            data: histData.map((d) => [d.value, d.count]),
            barMaxWidth: 8,
            itemStyle: {
              color: theme.colors.primary,
              borderRadius: [1, 1, 0, 0],
            },
            emphasis: { disabled: true },
          },
        ],
      }
    }

    // For sparklines, always use histogram bars for numeric data
    // Box-plot is too hard to read at tiny sizes
    if (chartType === 'box-plot' || chartType === 'histogram') {
      const histData = stats.histogram.slice(0, 15)
      const values = histData.map((d) => d.count)
      const maxVal = Math.max(...values)

      return {
        ...baseConfig,
        grid: { left: 0, right: 0, top: 2, bottom: 2 },
        xAxis: { type: 'category', show: false, data: histData.map((_, i) => i) },
        yAxis: { type: 'value', show: false, max: maxVal * 1.1 },
        series: [
          {
            type: 'bar',
            data: values,
            barCategoryGap: '10%',
            itemStyle: {
              color: theme.colors.primary,
              borderRadius: [1, 1, 0, 0],
            },
            emphasis: { disabled: true },
          },
        ],
      }
    }

    // For categorical with many values, use horizontal stacked bar instead of pie
    // Pie is unreadable at tiny sizes with >3 categories
    if (chartType === 'pie') {
      const pieData = stats.histogram.slice(0, 5)
      const total = pieData.reduce((sum, d) => sum + d.count, 0)

      // If more than 3 categories, use stacked bar instead
      if (pieData.length > 3) {
        return {
          ...baseConfig,
          color: theme.colors.categorical,
          grid: { left: 0, right: 0, top: 4, bottom: 4 },
          xAxis: { type: 'value', show: false, max: total },
          yAxis: { type: 'category', show: false, data: [''] },
          series: pieData.map((d, i) => ({
            type: 'bar',
            stack: 'total',
            data: [d.count],
            barWidth: '60%',
            itemStyle: {
              color: theme.colors.categorical[i % theme.colors.categorical.length],
              borderRadius: i === 0 ? [2, 0, 0, 2] : i === pieData.length - 1 ? [0, 2, 2, 0] : 0,
            },
            emphasis: { disabled: true },
          })),
        }
      }

      // For 2-3 categories, pie is fine
      return {
        ...baseConfig,
        color: theme.colors.categorical,
        series: [
          {
            type: 'pie',
            radius: ['35%', '85%'],
            center: ['50%', '50%'],
            label: { show: false },
            labelLine: { show: false },
            data: pieData.map((d) => ({ value: d.count, name: String(d.value) })),
            itemStyle: { borderWidth: 0 },
            emphasis: { disabled: true },
            select: { disabled: true },
          },
        ],
      }
    }

    // Line sparkline for date/time series - use area fill
    if (chartType === 'line') {
      const values = stats.histogram.map((d) => d.count)
      const labels = stats.histogram.map((d) => String(d.value))

      return {
        ...baseConfig,
        grid: { left: 0, right: 0, top: 2, bottom: 2 },
        xAxis: { type: 'category', show: false, data: labels },
        yAxis: { type: 'value', show: false },
        series: [
          {
            type: 'line',
            data: values,
            smooth: 0.3,
            symbol: 'none',
            lineStyle: { width: 1.5, color: theme.colors.primary },
            areaStyle: { opacity: 0.15, color: theme.colors.primary },
            emphasis: { disabled: true },
          },
        ],
      }
    }

    // Bar sparkline (default for histogram and horizontal-bar)
    const histData = stats.histogram.slice(0, 10)
    const values = histData.map((d) => d.count)
    const maxVal = Math.max(...values)

    return {
      ...baseConfig,
      grid: { left: 0, right: 0, top: 2, bottom: 2 },
      xAxis: { type: 'category', show: false, data: histData.map((_, i) => i) },
      yAxis: { type: 'value', show: false, max: maxVal * 1.1 },
      series: [
        {
          type: 'bar',
          data: values,
          barCategoryGap: '15%',
          itemStyle: {
            color: theme.colors.primary,
            borderRadius: [1, 1, 0, 0],
          },
          emphasis: { disabled: true },
        },
      ],
    }
  }, [stats, columnType, theme])

  if (!option) {
    return null
  }

  return (
    <ReactECharts
      option={option}
      style={{ width, height }}
      opts={{ renderer: 'canvas' }}
      notMerge={true}
      lazyUpdate={true}
    />
  )
}

export const SparklineChart = memo(SparklineChartInner)
