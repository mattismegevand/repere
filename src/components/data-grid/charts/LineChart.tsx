import ReactECharts from 'echarts-for-react'
import { useCallback, useMemo } from 'react'
import { ECHARTS_REACT_PROPS, useChartTheme } from '@/lib/charts'
import type { ChartClickEvent, LineChartProps } from './types'

interface ExtendedLineChartProps extends LineChartProps {
  onClick?: (event: ChartClickEvent) => void
}

export function LineChart({ data, totalCount, width = 260, height = 120, onClick }: ExtendedLineChartProps) {
  const theme = useChartTheme()

  // Detect if data contains valid dates or categorical labels
  const isTimeSeries = useMemo(() => {
    if (data.length === 0) return false
    const firstDate = data[0].date
    if (firstDate instanceof Date) return true
    if (typeof firstDate === 'string') {
      // Check if it looks like a date (ISO format or similar)
      const parsed = Date.parse(firstDate)
      return (!Number.isNaN(parsed) && !firstDate.includes('-')) || /^\d{4}-\d{2}/.test(firstDate)
    }
    return false
  }, [data])

  // Convert data based on axis type
  const { chartData, labels } = useMemo(() => {
    if (isTimeSeries) {
      const chartData = data.map((d) => {
        const dateStr = typeof d.date === 'string' ? d.date : d.date.toISOString().split('T')[0]
        return [dateStr, d.count]
      })
      return { chartData, labels: [] }
    }
    // For categorical data, use simple values array
    return {
      chartData: data.map((d) => d.count),
      labels: data.map((d) => String(d.date)),
    }
  }, [data, isTimeSeries])

  const option = useMemo(
    () => ({
      darkMode: theme.isDark,
      animation: theme.animation.enabled,
      animationDuration: theme.animation.duration,
      animationEasing: theme.animation.easing,
      tooltip: {
        trigger: 'axis',
        appendToBody: true,
        backgroundColor: theme.tooltip.backgroundColor,
        borderColor: theme.tooltip.borderColor,
        borderWidth: 1,
        textStyle: { color: theme.tooltip.textColor, fontSize: theme.typography.tooltip },
        extraCssText: theme.tooltip.shadow !== 'none' ? `box-shadow: ${theme.tooltip.shadow};` : '',
        formatter: (params: Array<{ data: [string, number] | number; name?: string; value?: number }>) => {
          const item = params[0]
          const label = isTimeSeries ? (item.data as [string, number])[0] : item.name
          const count = isTimeSeries ? (item.data as [string, number])[1] : (item.value as number)
          const pct = totalCount > 0 ? ((count / totalCount) * 100).toFixed(1) : '0'
          return `<b>${label}</b><br/>${count.toLocaleString()} rows (${pct}%)`
        },
      },
      grid: { left: 40, right: 12, top: 12, bottom: 36 },
      xAxis: isTimeSeries
        ? {
            type: 'time',
            axisLine: { lineStyle: { color: theme.axis.line } },
            axisLabel: {
              color: theme.axis.label,
              fontSize: theme.typography.axisLabel,
              formatter: '{MM}-{dd}',
            },
            splitLine: { lineStyle: { color: theme.axis.splitLine } },
          }
        : {
            type: 'category',
            data: labels,
            axisLine: { lineStyle: { color: theme.axis.line } },
            axisLabel: {
              color: theme.axis.label,
              fontSize: theme.typography.axisLabel,
              rotate: labels.length > 8 ? 30 : 0,
              formatter: (value: string) => (value.length > 8 ? value.slice(0, 6) + '..' : value),
            },
            splitLine: { lineStyle: { color: theme.axis.splitLine } },
          },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: theme.axis.line } },
        axisLabel: { color: theme.axis.label, fontSize: theme.typography.axisLabel },
        splitLine: { lineStyle: { color: theme.axis.splitLine } },
      },
      series: [
        {
          type: 'line',
          data: chartData,
          smooth: 0.3,
          symbol: 'circle',
          symbolSize: 6,
          showSymbol: chartData.length <= 20,
          lineStyle: { width: 2, color: theme.colors.primary },
          itemStyle: { color: theme.colors.primary },
          areaStyle: { opacity: 0.1, color: theme.colors.primary },
        },
      ],
    }),
    [chartData, labels, isTimeSeries, totalCount, theme]
  )

  const handleClick = useCallback(
    (params: { name?: string; value?: unknown; data?: unknown }) => {
      if (onClick) {
        onClick({ name: params.name, value: params.value, data: { label: params.name, value: params.value } })
      }
    },
    [onClick]
  )

  const onEvents = onClick ? { click: handleClick } : undefined

  return <ReactECharts option={option} style={{ width, height }} onEvents={onEvents} {...ECHARTS_REACT_PROPS} />
}
