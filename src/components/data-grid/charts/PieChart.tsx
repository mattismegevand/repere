import ReactECharts from 'echarts-for-react'
import { useCallback, useMemo } from 'react'
import { ECHARTS_REACT_PROPS, useChartTheme } from '@/lib/charts'
import type { ChartClickEvent, PieChartProps } from './types'

interface ExtendedPieChartProps extends PieChartProps {
  onClick?: (event: ChartClickEvent) => void
}

export function PieChart({ data, maxSlices = 7, width = 200, height = 180, onClick }: ExtendedPieChartProps) {
  const theme = useChartTheme()

  const processedData = useMemo(() => {
    if (data.length <= maxSlices) {
      return data.map((d) => ({ name: d.label, value: d.count }))
    }
    const top = data.slice(0, maxSlices - 1)
    const otherCount = data.slice(maxSlices - 1).reduce((sum, d) => sum + d.count, 0)
    return [...top.map((d) => ({ name: d.label, value: d.count })), { name: 'Other', value: otherCount }]
  }, [data, maxSlices])

  const option = useMemo(
    () => ({
      darkMode: theme.isDark,
      animation: theme.animation.enabled,
      animationDuration: theme.animation.duration,
      animationEasing: theme.animation.easing,
      color: theme.colors.categorical,
      tooltip: {
        trigger: 'item',
        appendToBody: true,
        backgroundColor: theme.tooltip.backgroundColor,
        borderColor: theme.tooltip.borderColor,
        borderWidth: 1,
        textStyle: { color: theme.tooltip.textColor, fontSize: theme.typography.tooltip },
        extraCssText: theme.tooltip.shadow !== 'none' ? `box-shadow: ${theme.tooltip.shadow};` : '',
        formatter: (params: { name: string; value: number; percent: number }) =>
          `<b>${params.name}</b><br/>${params.value.toLocaleString()} rows (${params.percent.toFixed(1)}%)`,
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '50%'],
          data: processedData,
          itemStyle: {
            borderRadius: theme.structure.barBorderRadius + 1,
            borderColor: theme.tooltip.backgroundColor,
            borderWidth: 2,
          },
          label: {
            color: theme.text.secondary,
            fontSize: theme.typography.axisLabel,
            formatter: (params: { name: string }) =>
              params.name.length > 10 ? params.name.slice(0, 8) + '...' : params.name,
          },
          emphasis: {
            scaleSize: 6,
          },
        },
      ],
    }),
    [processedData, theme]
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
