import ReactECharts from 'echarts-for-react'
import { useCallback, useMemo } from 'react'
import { ECHARTS_REACT_PROPS, useChartTheme } from '@/lib/charts'
import type { ChartClickEvent } from './types'

export interface ComboChartProps {
  /** Data for the chart */
  data: Array<{
    category: string
    barValue: number
    lineValue: number
  }>
  /** Label for the bar series */
  barLabel?: string
  /** Label for the line series */
  lineLabel?: string
  /** Label for the X axis */
  xLabel?: string
  /** Label for the bar Y axis (left) */
  barYLabel?: string
  /** Label for the line Y axis (right) */
  lineYLabel?: string
  /** Click handler */
  onClick?: (event: ChartClickEvent) => void
  width?: number
  height?: number
}

export function ComboChart({
  data,
  barLabel = 'Value',
  lineLabel = 'Trend',
  xLabel,
  barYLabel,
  lineYLabel,
  onClick,
  width = 400,
  height = 300,
}: ComboChartProps) {
  const theme = useChartTheme()

  const categories = useMemo(() => data.map((d) => d.category), [data])
  const barValues = useMemo(() => data.map((d) => d.barValue), [data])
  const lineValues = useMemo(() => data.map((d) => d.lineValue), [data])

  const option = useMemo(() => {
    return {
      darkMode: theme.isDark,
      animation: theme.animation.enabled,
      animationDuration: theme.animation.duration,
      tooltip: {
        trigger: 'axis',
        appendToBody: true,
        backgroundColor: theme.tooltip.backgroundColor,
        borderColor: theme.tooltip.borderColor,
        borderWidth: 1,
        textStyle: { color: theme.tooltip.textColor, fontSize: theme.typography.tooltip },
        extraCssText: theme.tooltip.shadow !== 'none' ? `box-shadow: ${theme.tooltip.shadow};` : '',
        axisPointer: {
          type: 'cross',
          crossStyle: {
            color: theme.axis.line,
          },
        },
      },
      legend: {
        data: [barLabel, lineLabel],
        textStyle: {
          color: theme.text.secondary,
          fontSize: theme.typography.axisLabel,
        },
        top: 0,
      },
      grid: {
        left: 50,
        right: 50,
        top: 40,
        bottom: xLabel ? 50 : 30,
      },
      xAxis: {
        type: 'category',
        data: categories,
        name: xLabel,
        nameLocation: 'middle',
        nameGap: 30,
        nameTextStyle: {
          color: theme.text.secondary,
          fontSize: theme.typography.axisLabel,
        },
        axisLine: { lineStyle: { color: theme.axis.line } },
        axisLabel: {
          color: theme.axis.label,
          fontSize: theme.typography.axisLabel,
          rotate: categories.length > 8 ? 30 : 0,
          formatter: (value: string) => (value.length > 10 ? value.slice(0, 8) + '..' : value),
        },
        axisTick: { alignWithLabel: true },
      },
      yAxis: [
        {
          type: 'value',
          name: barYLabel,
          nameTextStyle: {
            color: theme.text.secondary,
            fontSize: theme.typography.axisLabel,
          },
          axisLine: { show: true, lineStyle: { color: theme.colors.primary } },
          axisLabel: {
            color: theme.axis.label,
            fontSize: theme.typography.axisLabel,
            formatter: (v: number) => {
              if (Math.abs(v) >= 1000000) return `${(v / 1000000).toFixed(0)}M`
              if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}K`
              return v.toString()
            },
          },
          splitLine: { lineStyle: { color: theme.axis.splitLine } },
        },
        {
          type: 'value',
          name: lineYLabel,
          nameTextStyle: {
            color: theme.text.secondary,
            fontSize: theme.typography.axisLabel,
          },
          axisLine: { show: true, lineStyle: { color: theme.colors.categorical[1] } },
          axisLabel: {
            color: theme.axis.label,
            fontSize: theme.typography.axisLabel,
            formatter: (v: number) => {
              if (Math.abs(v) >= 1000000) return `${(v / 1000000).toFixed(0)}M`
              if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}K`
              return v.toString()
            },
          },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: barLabel,
          type: 'bar',
          data: barValues,
          itemStyle: {
            color: theme.colors.primary,
            borderRadius: [theme.structure.barBorderRadius, theme.structure.barBorderRadius, 0, 0],
          },
          barMaxWidth: 40,
        },
        {
          name: lineLabel,
          type: 'line',
          yAxisIndex: 1,
          data: lineValues,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: {
            color: theme.colors.categorical[1],
            width: 2,
          },
          itemStyle: {
            color: theme.colors.categorical[1],
          },
        },
      ],
    }
  }, [categories, barValues, lineValues, barLabel, lineLabel, xLabel, barYLabel, lineYLabel, theme])

  const handleClick = useCallback(
    (params: { name?: string; value?: unknown; data?: unknown; seriesName?: string }) => {
      if (onClick) {
        onClick({
          name: params.name,
          value: params.value,
          data: { label: params.name, name: params.seriesName, value: params.value },
        })
      }
    },
    [onClick]
  )

  const onEvents = onClick ? { click: handleClick } : undefined

  return <ReactECharts option={option} style={{ width, height }} onEvents={onEvents} {...ECHARTS_REACT_PROPS} />
}
