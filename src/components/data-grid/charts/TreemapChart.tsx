import ReactECharts from 'echarts-for-react'
import { useCallback, useMemo } from 'react'
import { ECHARTS_REACT_PROPS, useChartTheme } from '@/lib/charts'
import type { ChartClickEvent } from './types'

interface TreemapDataNode {
  name: string
  value: number
  children?: TreemapDataNode[]
}

interface TreemapChartProps {
  data: TreemapDataNode[]
  valueLabel?: string
  width?: number
  height?: number
  onClick?: (event: ChartClickEvent) => void
}

export function TreemapChart({ data, valueLabel = 'Value', width = 300, height = 200, onClick }: TreemapChartProps) {
  const theme = useChartTheme()

  const option = useMemo(() => {
    const total = data.reduce((sum, d) => sum + calculateTotal(d), 0)

    return {
      darkMode: theme.isDark,
      animation: false,
      color: theme.colors.categorical,
      tooltip: {
        appendToBody: true,
        backgroundColor: theme.tooltip.backgroundColor,
        borderColor: theme.tooltip.borderColor,
        textStyle: { color: theme.tooltip.textColor, fontSize: theme.typography.tooltip },
        extraCssText: theme.tooltip.shadow !== 'none' ? `box-shadow: ${theme.tooltip.shadow};` : '',
        formatter: (params: { name: string; value: number; treePathInfo: { name: string }[] }) => {
          const path = params.treePathInfo.map((p) => p.name).join(' > ')
          const percentage = ((params.value / total) * 100).toFixed(1)
          return `<b>${path}</b><br/>${valueLabel}: ${params.value}<br/>${percentage}% of total`
        },
      },
      series: [
        {
          type: 'treemap',
          data: data,
          width: '100%',
          height: '100%',
          roam: false,
          nodeClick: 'zoomToNode',
          breadcrumb: {
            show: true,
            height: 20,
            bottom: 0,
            itemStyle: {
              color: theme.tooltip.backgroundColor,
              borderColor: theme.tooltip.borderColor,
              textStyle: { color: theme.text.primary },
            },
          },
          label: {
            show: true,
            formatter: '{b}',
            color: theme.text.primary,
            fontSize: theme.typography.axisLabel,
          },
          itemStyle: {
            borderRadius: theme.structure.barBorderRadius,
          },
        },
      ],
    }
  }, [data, valueLabel, theme])

  const handleClick = useCallback(
    (params: { name?: string; value?: number }) => {
      if (onClick) {
        onClick({ name: params.name, value: params.value, data: { label: params.name, name: params.name } })
      }
    },
    [onClick]
  )

  const onEvents = onClick ? { click: handleClick } : undefined

  return <ReactECharts option={option} style={{ width, height }} onEvents={onEvents} {...ECHARTS_REACT_PROPS} />
}

function calculateTotal(node: TreemapDataNode): number {
  if (node.children && node.children.length > 0) {
    return node.children.reduce((sum, child) => sum + calculateTotal(child), 0)
  }
  return node.value
}
