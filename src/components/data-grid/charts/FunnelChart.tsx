import ReactECharts from 'echarts-for-react'
import { useCallback, useMemo } from 'react'
import { ECHARTS_REACT_PROPS, useChartTheme } from '@/lib/charts'
import type { ChartClickEvent } from './types'

export interface FunnelChartProps {
  /** Data for the funnel - should be sorted by value descending for proper display */
  data: Array<{ name: string; value: number }>
  /** Show conversion rates between stages */
  showConversion?: boolean
  /** Label position */
  labelPosition?: 'inside' | 'outside'
  /** Click handler for cross-filtering */
  onClick?: (event: ChartClickEvent) => void
  width?: number
  height?: number
}

export function FunnelChart({
  data,
  showConversion = true,
  labelPosition = 'inside',
  onClick,
  width = 300,
  height = 250,
}: FunnelChartProps) {
  const theme = useChartTheme()

  // Sort data by value descending for proper funnel display
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => b.value - a.value)
  }, [data])

  // Calculate conversion rates
  const dataWithConversion = useMemo(() => {
    return sortedData.map((item, index) => {
      const prev = index > 0 ? sortedData[index - 1] : null
      const conversionRate = prev ? ((item.value / prev.value) * 100).toFixed(1) : null
      return { ...item, conversionRate }
    })
  }, [sortedData])

  const option = useMemo(() => {
    const maxValue = sortedData[0]?.value ?? 1

    return {
      darkMode: theme.isDark,
      animation: theme.animation.enabled,
      animationDuration: theme.animation.duration,
      color: theme.colors.categorical,
      tooltip: {
        trigger: 'item',
        appendToBody: true,
        backgroundColor: theme.tooltip.backgroundColor,
        borderColor: theme.tooltip.borderColor,
        borderWidth: 1,
        textStyle: { color: theme.tooltip.textColor, fontSize: theme.typography.tooltip },
        extraCssText: theme.tooltip.shadow !== 'none' ? `box-shadow: ${theme.tooltip.shadow};` : '',
        formatter: (params: { name: string; value: number; dataIndex: number }) => {
          const item = dataWithConversion[params.dataIndex]
          const percentage = ((params.value / maxValue) * 100).toFixed(1)
          let html = `<b>${params.name}</b><br/>${params.value.toLocaleString()} (${percentage}%)`
          if (showConversion && item?.conversionRate) {
            html += `<br/><span style="color: ${theme.text.secondary}">↓ ${item.conversionRate}% conversion</span>`
          }
          return html
        },
      },
      series: [
        {
          type: 'funnel',
          left: '10%',
          right: '10%',
          top: '10%',
          bottom: '10%',
          width: '80%',
          min: 0,
          max: maxValue,
          minSize: '20%',
          maxSize: '100%',
          sort: 'descending',
          gap: 4,
          label: {
            show: true,
            position: labelPosition,
            color: labelPosition === 'inside' ? '#fff' : theme.text.primary,
            fontSize: theme.typography.axisLabel,
            formatter: (params: { name: string; value: number }) => {
              const percentage = ((params.value / maxValue) * 100).toFixed(0)
              return `${params.name}\n${percentage}%`
            },
          },
          labelLine: {
            show: labelPosition === 'outside',
            length: 20,
            lineStyle: {
              color: theme.axis.line,
            },
          },
          emphasis: {
            label: {
              fontSize: theme.typography.axisLabel + 2,
            },
          },
          itemStyle: {
            borderColor: theme.tooltip.backgroundColor,
            borderWidth: 2,
          },
          data: sortedData.map((item) => ({
            name: item.name,
            value: item.value,
          })),
        },
      ],
    }
  }, [sortedData, dataWithConversion, showConversion, labelPosition, theme])

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
