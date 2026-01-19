import ReactECharts from 'echarts-for-react'
import { useCallback, useMemo } from 'react'
import { ECHARTS_REACT_PROPS, useChartTheme } from '@/lib/charts'
import type { ChartClickEvent } from './types'

interface StackedBarDataPoint {
  category: string
  series: string
  value: number
}

interface StackedBarChartProps {
  data: StackedBarDataPoint[]
  categoryLabel?: string
  valueLabel?: string
  horizontal?: boolean
  width?: number
  height?: number
  onClick?: (event: ChartClickEvent) => void
}

export function StackedBarChart({
  data,
  categoryLabel = 'Category',
  valueLabel = 'Value',
  horizontal = false,
  width = 300,
  height = 200,
  onClick,
}: StackedBarChartProps) {
  const theme = useChartTheme()

  const option = useMemo(() => {
    const categories = [...new Set(data.map((d) => d.category))]
    const seriesNames = [...new Set(data.map((d) => d.series))]

    const seriesData = seriesNames.map((seriesName) => ({
      name: seriesName,
      type: 'bar',
      stack: 'total',
      itemStyle: {
        borderRadius: theme.structure.barBorderRadius,
      },
      data: categories.map((category) => {
        const point = data.find((d) => d.category === category && d.series === seriesName)
        return point?.value ?? 0
      }),
    }))

    return {
      darkMode: theme.isDark,
      animation: false,
      color: theme.colors.categorical,
      tooltip: {
        trigger: 'axis',
        appendToBody: true,
        axisPointer: { type: 'shadow' },
        backgroundColor: theme.tooltip.backgroundColor,
        borderColor: theme.tooltip.borderColor,
        textStyle: { color: theme.tooltip.textColor, fontSize: theme.typography.tooltip },
        extraCssText: theme.tooltip.shadow !== 'none' ? `box-shadow: ${theme.tooltip.shadow};` : '',
      },
      legend: {
        show: seriesNames.length <= 8,
        bottom: 0,
        textStyle: { color: theme.text.secondary, fontSize: theme.typography.legend },
      },
      grid: {
        left: horizontal ? 80 : 50,
        right: 20,
        top: 20,
        bottom: seriesNames.length <= 8 ? 40 : 20,
      },
      xAxis: horizontal
        ? {
            type: 'value',
            name: valueLabel,
            axisLine: { lineStyle: { color: theme.axis.line } },
            axisLabel: { color: theme.axis.label, fontSize: theme.typography.axisLabel },
            splitLine: { lineStyle: { color: theme.axis.splitLine } },
          }
        : {
            type: 'category',
            data: categories,
            name: categoryLabel,
            axisLabel: {
              rotate: categories.length > 5 ? 45 : 0,
              color: theme.axis.label,
              fontSize: theme.typography.axisLabel,
            },
            axisLine: { lineStyle: { color: theme.axis.line } },
          },
      yAxis: horizontal
        ? {
            type: 'category',
            data: categories,
            name: categoryLabel,
            axisLine: { lineStyle: { color: theme.axis.line } },
            axisLabel: { color: theme.axis.label, fontSize: theme.typography.axisLabel },
          }
        : {
            type: 'value',
            name: valueLabel,
            axisLine: { lineStyle: { color: theme.axis.line } },
            axisLabel: { color: theme.axis.label, fontSize: theme.typography.axisLabel },
            splitLine: { lineStyle: { color: theme.axis.splitLine } },
          },
      series: seriesData,
    }
  }, [data, categoryLabel, valueLabel, horizontal, theme])

  const handleClick = useCallback(
    (params: { name?: string; value?: unknown; seriesName?: string }) => {
      if (onClick) {
        onClick({ name: params.name, value: params.value, data: { label: params.name, name: params.seriesName } })
      }
    },
    [onClick]
  )

  const onEvents = onClick ? { click: handleClick } : undefined

  return <ReactECharts option={option} style={{ width, height }} onEvents={onEvents} {...ECHARTS_REACT_PROPS} />
}
