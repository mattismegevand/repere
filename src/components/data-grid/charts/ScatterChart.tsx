import ReactECharts from 'echarts-for-react'
import { useCallback, useMemo } from 'react'
import { ECHARTS_REACT_PROPS, useChartTheme } from '@/lib/charts'
import type { ChartClickEvent } from './types'

interface ScatterDataPoint {
  x: number | string
  y: number | string
  size?: number
  color?: string | number
}

interface ScatterChartProps {
  data: ScatterDataPoint[]
  xLabel?: string
  yLabel?: string
  sizeColumn?: string
  colorColumn?: string
  width?: number
  height?: number
  onClick?: (event: ChartClickEvent) => void
}

export function ScatterChart({
  data,
  xLabel = 'X',
  yLabel = 'Y',
  sizeColumn,
  colorColumn,
  width = 300,
  height = 200,
  onClick,
}: ScatterChartProps) {
  const theme = useChartTheme()

  const option = useMemo(() => {
    const seriesData = data.map((d) => {
      const point: (number | string)[] = [d.x, d.y]
      if (d.size !== undefined) point.push(d.size)
      if (d.color !== undefined) point.push(d.color)
      return point
    })

    const sizes = data.filter((d) => d.size !== undefined).map((d) => d.size as number)
    const minSize = sizes.length > 0 ? Math.min(...sizes) : 0
    const maxSize = sizes.length > 0 ? Math.max(...sizes) : 0

    return {
      darkMode: theme.isDark,
      animation: false,
      color: theme.colors.categorical,
      tooltip: {
        trigger: 'item',
        appendToBody: true,
        backgroundColor: theme.tooltip.backgroundColor,
        borderColor: theme.tooltip.borderColor,
        textStyle: { color: theme.tooltip.textColor, fontSize: theme.typography.tooltip },
        extraCssText: theme.tooltip.shadow !== 'none' ? `box-shadow: ${theme.tooltip.shadow};` : '',
        formatter: (params: { value: (number | string)[] }) => {
          const [x, y, size, color] = params.value
          let content = `<b>${xLabel}:</b> ${x}<br/><b>${yLabel}:</b> ${y}`
          if (size !== undefined && sizeColumn) content += `<br/><b>${sizeColumn}:</b> ${size}`
          if (color !== undefined && colorColumn) content += `<br/><b>${colorColumn}:</b> ${color}`
          return content
        },
      },
      grid: { left: 50, right: 20, top: 20, bottom: 40 },
      xAxis: {
        type: typeof data[0]?.x === 'number' ? 'value' : 'category',
        name: xLabel,
        nameLocation: 'center',
        nameGap: 25,
        axisLine: { lineStyle: { color: theme.axis.line } },
        axisLabel: { color: theme.axis.label, fontSize: theme.typography.axisLabel },
      },
      yAxis: {
        type: typeof data[0]?.y === 'number' ? 'value' : 'category',
        name: yLabel,
        nameLocation: 'center',
        nameGap: 35,
        axisLine: { lineStyle: { color: theme.axis.line } },
        axisLabel: { color: theme.axis.label, fontSize: theme.typography.axisLabel },
      },
      visualMap: colorColumn
        ? {
            show: false,
            dimension: 3,
            min: Math.min(...data.map((d) => Number(d.color) || 0)),
            max: Math.max(...data.map((d) => Number(d.color) || 0)),
            inRange: { color: theme.colors.sequential.slice(2) },
          }
        : undefined,
      series: [
        {
          type: 'scatter',
          data: seriesData,
          itemStyle: { color: theme.colors.primary },
          symbolSize: sizeColumn
            ? (val: (number | string)[]) => {
                const size = val[2] as number
                if (maxSize === minSize) return 10
                return 5 + ((size - minSize) / (maxSize - minSize)) * 25
              }
            : 10,
        },
      ],
    }
  }, [data, xLabel, yLabel, sizeColumn, colorColumn, theme])

  const handleClick = useCallback(
    (params: { name?: string; value?: unknown; data?: unknown }) => {
      if (onClick) {
        const value = params.value as (number | string)[] | undefined
        onClick({ name: value?.[0]?.toString(), value: value?.[1], data: { label: value?.[0]?.toString() } })
      }
    },
    [onClick]
  )

  const onEvents = onClick ? { click: handleClick } : undefined

  return <ReactECharts option={option} style={{ width, height }} onEvents={onEvents} {...ECHARTS_REACT_PROPS} />
}
