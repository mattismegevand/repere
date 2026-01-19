import ReactECharts from 'echarts-for-react'
import { useCallback, useMemo } from 'react'
import { ECHARTS_REACT_PROPS, useChartTheme } from '@/lib/charts'
import type { ChartClickEvent, HistogramChartProps } from './types'

interface BarChartProps extends HistogramChartProps {
  horizontal?: boolean
  /** Use time-based x-axis for date columns */
  timeSeries?: boolean
  /** Click handler for cross-filtering */
  onClick?: (event: ChartClickEvent) => void
}

// Max items to show in horizontal bar chart to prevent overflow
const MAX_HORIZONTAL_ITEMS = 8

export function BarChart({
  data,
  totalCount,
  columnType,
  horizontal = false,
  timeSeries = false,
  width = 260,
  height,
  onClick,
}: BarChartProps) {
  const theme = useChartTheme()

  // Limit data for horizontal charts to prevent tall overflow
  const limitedData = useMemo(() => {
    if (horizontal && data.length > MAX_HORIZONTAL_ITEMS) {
      return data.slice(0, MAX_HORIZONTAL_ITEMS)
    }
    return data
  }, [data, horizontal])

  const computedHeight = height ?? (horizontal ? Math.max(80, Math.min(limitedData.length * 24, 200)) : 120)

  const { labels, values, ranges } = useMemo(() => {
    const labels = limitedData.map((d) => {
      if (typeof d.value === 'number') {
        if (d.min !== undefined && d.max !== undefined) {
          return `${formatNumber(d.min)}-${formatNumber(d.max)}`
        }
        return formatNumber(d.value)
      }
      return String(d.value)
    })
    const values = limitedData.map((d) => d.count)
    const ranges = limitedData.map((d) =>
      d.min !== undefined && d.max !== undefined ? { min: d.min, max: d.max } : null
    )
    return { labels, values, ranges }
  }, [limitedData])

  const option = useMemo(
    () => ({
      darkMode: theme.isDark,
      animation: theme.animation.enabled,
      animationDuration: theme.animation.duration,
      animationEasing: theme.animation.easing,
      tooltip: {
        trigger: 'axis',
        appendToBody: true,
        axisPointer: { type: 'shadow' },
        backgroundColor: theme.tooltip.backgroundColor,
        borderColor: theme.tooltip.borderColor,
        borderWidth: 1,
        textStyle: { color: theme.tooltip.textColor, fontSize: theme.typography.tooltip },
        extraCssText: `box-shadow: ${theme.tooltip.shadow};`,
        formatter: (params: Array<{ name: string; value: number; dataIndex: number }>) => {
          const item = params[0]
          const pct = totalCount > 0 ? ((item.value / totalCount) * 100).toFixed(1) : '0'
          const range = ranges[item.dataIndex]
          const label = range ? `${formatNumber(range.min)} - ${formatNumber(range.max)}` : item.name
          return `<b>${label}</b><br/>${item.value.toLocaleString()} rows (${pct}%)`
        },
      },
      grid: {
        left: horizontal ? 80 : 40,
        right: 12,
        top: 12,
        bottom: horizontal ? 28 : 40,
      },
      xAxis: horizontal
        ? {
            type: 'value',
            axisLine: { lineStyle: { color: theme.axis.line } },
            axisLabel: { color: theme.axis.label, fontSize: theme.typography.axisLabel },
            splitLine: { lineStyle: { color: theme.axis.splitLine } },
          }
        : timeSeries
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
                rotate: columnType === 'number' ? 0 : 30,
                // Show fewer labels when there are many items
                interval: labels.length > 10 ? Math.floor(labels.length / 6) : 0,
                formatter: (value: string) => (value.length > 8 ? value.slice(0, 6) + '..' : value),
              },
            },
      yAxis: horizontal
        ? {
            type: 'category',
            data: labels,
            axisLine: { lineStyle: { color: theme.axis.line } },
            axisLabel: {
              color: theme.axis.label,
              fontSize: theme.typography.axisLabel,
              formatter: (value: string) => (value.length > 10 ? value.slice(0, 8) + '..' : value),
            },
          }
        : {
            type: 'value',
            axisLine: { lineStyle: { color: theme.axis.line } },
            axisLabel: { color: theme.axis.label, fontSize: theme.typography.axisLabel },
            splitLine: { lineStyle: { color: theme.axis.splitLine } },
          },
      series: [
        {
          type: 'bar',
          data: timeSeries ? limitedData.map((d) => [d.value, d.count]) : values,
          barMaxWidth: 32,
          itemStyle: {
            color: theme.colors.primary,
            borderRadius: horizontal
              ? [0, theme.structure.barBorderRadius, theme.structure.barBorderRadius, 0]
              : [theme.structure.barBorderRadius, theme.structure.barBorderRadius, 0, 0],
          },
          emphasis: theme.structure.emphasisShadow
            ? { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.15)' } }
            : { disabled: true },
        },
      ],
    }),
    [labels, values, ranges, totalCount, horizontal, timeSeries, limitedData, columnType, theme]
  )

  const handleClick = useCallback(
    (params: { name?: string; value?: unknown; data?: unknown }) => {
      if (onClick) {
        onClick({ name: params.name, value: params.value, data: params.data as ChartClickEvent['data'] })
      }
    },
    [onClick]
  )

  const onEvents = onClick ? { click: handleClick } : undefined

  return (
    <ReactECharts
      option={option}
      style={{ width, height: computedHeight }}
      onEvents={onEvents}
      {...ECHARTS_REACT_PROPS}
    />
  )
}

function formatNumber(value: number): string {
  if (Math.abs(value) >= 1000000) return (value / 1000000).toFixed(1) + 'M'
  if (Math.abs(value) >= 1000) return (value / 1000).toFixed(1) + 'K'
  if (Number.isInteger(value)) return value.toString()
  return value.toFixed(2)
}
