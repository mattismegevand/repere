import ReactECharts from 'echarts-for-react'
import { useCallback, useMemo } from 'react'
import { ECHARTS_REACT_PROPS, useChartTheme } from '@/lib/charts'
import type { ChartClickEvent } from './types'

interface StackedAreaDataPoint {
  x: string | number
  series: string
  value: number
}

interface StackedAreaChartProps {
  data: StackedAreaDataPoint[]
  xLabel?: string
  yLabel?: string
  width?: number
  height?: number
  onClick?: (event: ChartClickEvent) => void
}

export function StackedAreaChart({
  data,
  xLabel = 'X',
  yLabel = 'Value',
  width = 300,
  height = 200,
  onClick,
}: StackedAreaChartProps) {
  const theme = useChartTheme()

  const option = useMemo(() => {
    const xValues = [...new Set(data.map((d) => d.x))]
    const seriesNames = [...new Set(data.map((d) => d.series))]

    const seriesData = seriesNames.map((seriesName) => ({
      name: seriesName,
      type: 'line',
      stack: 'total',
      areaStyle: { opacity: 0.6 },
      data: xValues.map((x) => {
        const point = data.find((d) => d.x === x && d.series === seriesName)
        return point?.value ?? 0
      }),
      smooth: true,
      symbol: 'none',
    }))

    return {
      darkMode: theme.isDark,
      animation: false,
      color: theme.colors.categorical,
      tooltip: {
        trigger: 'axis',
        appendToBody: true,
        axisPointer: { type: 'cross' },
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
        left: 50,
        right: 20,
        top: 20,
        bottom: seriesNames.length <= 8 ? 40 : 20,
      },
      xAxis: {
        type: 'category',
        data: xValues.map((v) => String(v)),
        name: xLabel,
        boundaryGap: false,
        axisLine: { lineStyle: { color: theme.axis.line } },
        axisLabel: { color: theme.axis.label, fontSize: theme.typography.axisLabel },
      },
      yAxis: {
        type: 'value',
        name: yLabel,
        axisLine: { lineStyle: { color: theme.axis.line } },
        axisLabel: { color: theme.axis.label, fontSize: theme.typography.axisLabel },
        splitLine: { lineStyle: { color: theme.axis.splitLine } },
      },
      series: seriesData,
    }
  }, [data, xLabel, yLabel, theme])

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
