import ReactECharts from 'echarts-for-react'
import { useMemo } from 'react'
import { ECHARTS_REACT_PROPS_SVG, useChartTheme } from '@/lib/charts'
import type { CorrelationMatrix as CorrelationData } from '@/lib/profiling/correlation'

interface Props {
  data: CorrelationData
  panelWidth?: number
}

export function CorrelationMatrix({ data, panelWidth = 360 }: Props) {
  const theme = useChartTheme()

  const option = useMemo(() => {
    const { columns, correlations } = data

    if (columns.length < 2) return null

    // Build heatmap data: [xIndex, yIndex, value]
    const heatmapData = correlations.map((c) => [columns.indexOf(c.col1), columns.indexOf(c.col2), c.value])

    // Adjust grid based on panel width - tighter margins for narrow panels
    const isNarrow = panelWidth < 400
    const labelTruncate = isNarrow ? 8 : 12
    const showLabels = columns.length <= (isNarrow ? 5 : 8)

    return {
      darkMode: theme.isDark,
      animation: false,
      tooltip: {
        position: 'top',
        confine: true,
        formatter: (params: { value: [number, number, number] }) => {
          const [xIdx, yIdx, val] = params.value
          const formatted = Number.isNaN(val) ? 'N/A' : val.toFixed(3)
          return `<div style="font-size: 11px;"><b>${columns[xIdx]}</b> × <b>${columns[yIdx]}</b><br/>r = ${formatted}</div>`
        },
        backgroundColor: theme.tooltip.backgroundColor,
        borderColor: theme.tooltip.borderColor,
        textStyle: { color: theme.tooltip.textColor, fontSize: 11 },
        extraCssText: theme.tooltip.shadow !== 'none' ? `box-shadow: ${theme.tooltip.shadow};` : '',
      },
      grid: {
        left: isNarrow ? 60 : 70,
        right: 45,
        top: 10,
        bottom: isNarrow ? 60 : 70,
        containLabel: false,
      },
      xAxis: {
        type: 'category',
        data: columns,
        position: 'bottom',
        axisLabel: {
          rotate: 45,
          fontSize: 9,
          color: theme.text.muted,
          formatter: (val: string) => (val.length > labelTruncate ? `${val.slice(0, labelTruncate - 2)}…` : val),
        },
        axisLine: { show: false },
        axisTick: { show: false },
        splitArea: { show: false },
      },
      yAxis: {
        type: 'category',
        data: columns,
        axisLabel: {
          fontSize: 9,
          color: theme.text.muted,
          formatter: (val: string) => (val.length > labelTruncate ? `${val.slice(0, labelTruncate - 2)}…` : val),
        },
        axisLine: { show: false },
        axisTick: { show: false },
        splitArea: { show: false },
      },
      visualMap: {
        min: -1,
        max: 1,
        calculable: false,
        orient: 'vertical',
        right: 0,
        top: 'center',
        itemHeight: 80,
        itemWidth: 10,
        inRange: { color: theme.colors.diverging },
        textStyle: { color: theme.text.muted, fontSize: 9 },
        formatter: (value: number) => value.toFixed(1),
      },
      series: [
        {
          type: 'heatmap',
          data: heatmapData,
          itemStyle: {
            borderWidth: 1,
            borderColor: theme.tooltip.backgroundColor,
          },
          label: {
            show: showLabels,
            fontSize: 8,
            color: theme.text.primary,
            formatter: (params: { value: [number, number, number] }) => {
              const val = params.value[2]
              return Number.isNaN(val) ? '' : val.toFixed(2)
            },
          },
          emphasis: {
            itemStyle: {
              borderColor: theme.colors.primary,
              borderWidth: 2,
            },
          },
        },
      ],
    }
  }, [data, panelWidth, theme])

  if (data.columns.length === 0) {
    return (
      <div className="text-[10px] text-[var(--color-text-muted)] py-3 text-center">
        No numeric columns available for correlation analysis.
      </div>
    )
  }

  if (data.columns.length === 1) {
    return (
      <div className="text-[10px] text-[var(--color-text-muted)] py-3 text-center">
        At least 2 numeric columns required for correlation analysis.
      </div>
    )
  }

  if (!option) return null

  // Dynamic size based on columns and panel width
  const availableWidth = panelWidth - 40 // Account for padding
  const cellSize = Math.min(40, Math.max(20, (availableWidth - 100) / data.columns.length))
  const matrixSize = Math.min(availableWidth, 80 + data.columns.length * cellSize)

  return <ReactECharts option={option} style={{ width: '100%', height: matrixSize }} {...ECHARTS_REACT_PROPS_SVG} />
}
