import ReactECharts from 'echarts-for-react'
import { useCallback, useMemo } from 'react'
import { ECHARTS_REACT_PROPS, useChartTheme } from '@/lib/charts'
import type { ChartClickEvent } from './types'

interface HeatmapDataPoint {
  x: string | number
  y: string | number
  value: number
}

interface HeatmapChartProps {
  data: HeatmapDataPoint[]
  xLabel?: string
  yLabel?: string
  valueLabel?: string
  width?: number
  height?: number
  onClick?: (event: ChartClickEvent) => void
}

export function HeatmapChart({
  data,
  xLabel = 'X',
  yLabel = 'Y',
  valueLabel = 'Value',
  width = 300,
  height = 200,
  onClick,
}: HeatmapChartProps) {
  const theme = useChartTheme()

  const option = useMemo(() => {
    const xValues = [...new Set(data.map((d) => d.x))].sort()
    const yValues = [...new Set(data.map((d) => d.y))].sort()

    const heatmapData = data.map((d) => [xValues.indexOf(d.x), yValues.indexOf(d.y), d.value])

    const values = data.map((d) => d.value)
    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)

    return {
      darkMode: theme.isDark,
      animation: false,
      tooltip: {
        appendToBody: true,
        position: 'top',
        backgroundColor: theme.tooltip.backgroundColor,
        borderColor: theme.tooltip.borderColor,
        textStyle: { color: theme.tooltip.textColor, fontSize: theme.typography.tooltip },
        extraCssText: theme.tooltip.shadow !== 'none' ? `box-shadow: ${theme.tooltip.shadow};` : '',
        formatter: (params: { value: [number, number, number] }) => {
          const [xIdx, yIdx, val] = params.value
          return `<b>${xLabel}:</b> ${xValues[xIdx]}<br/><b>${yLabel}:</b> ${yValues[yIdx]}<br/><b>${valueLabel}:</b> ${val}`
        },
      },
      grid: { left: 60, right: 40, top: 20, bottom: 40 },
      xAxis: {
        type: 'category',
        data: xValues.map((v) => String(v)),
        name: xLabel,
        nameLocation: 'center',
        nameGap: 25,
        splitArea: { show: true },
        axisLine: { lineStyle: { color: theme.axis.line } },
        axisLabel: { color: theme.axis.label, fontSize: theme.typography.axisLabel },
      },
      yAxis: {
        type: 'category',
        data: yValues.map((v) => String(v)),
        name: yLabel,
        nameLocation: 'center',
        nameGap: 45,
        splitArea: { show: true },
        axisLine: { lineStyle: { color: theme.axis.line } },
        axisLabel: { color: theme.axis.label, fontSize: theme.typography.axisLabel },
      },
      visualMap: {
        min: minValue,
        max: maxValue,
        calculable: true,
        orient: 'vertical',
        right: 0,
        top: 'center',
        itemHeight: height - 60,
        itemWidth: 10,
        inRange: { color: theme.colors.sequential },
        textStyle: { color: theme.text.secondary },
      },
      series: [{ name: valueLabel, type: 'heatmap', data: heatmapData }],
    }
  }, [data, xLabel, yLabel, valueLabel, height, theme])

  const xValues = useMemo(() => [...new Set(data.map((d) => d.x))].sort(), [data])
  const yValues = useMemo(() => [...new Set(data.map((d) => d.y))].sort(), [data])

  const handleClick = useCallback(
    (params: { value?: [number, number, number] }) => {
      if (onClick && params.value) {
        const [xIdx, yIdx] = params.value
        onClick({ name: String(xValues[xIdx]), value: yValues[yIdx], data: { label: String(xValues[xIdx]) } })
      }
    },
    [onClick, xValues, yValues]
  )

  const onEvents = onClick ? { click: handleClick } : undefined

  return <ReactECharts option={option} style={{ width, height }} onEvents={onEvents} {...ECHARTS_REACT_PROPS} />
}
