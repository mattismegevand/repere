import ReactECharts from 'echarts-for-react'
import { useMemo } from 'react'
import { ECHARTS_REACT_PROPS_SVG, useChartTheme } from '@/lib/charts'

interface Props {
  data: { bin: string; count: number }[]
  height?: number
}

export function Histogram({ data, height = 80 }: Props) {
  const theme = useChartTheme()

  const option = useMemo(() => {
    const labels = data.map((d) => d.bin)
    const values = data.map((d) => d.count)
    const total = values.reduce((sum, v) => sum + v, 0)

    return {
      darkMode: theme.isDark,
      animation: false,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: Array<{ name: string; value: number }>) => {
          const item = params[0]
          const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0'
          return `<div style="font-size: 12px;">
            <div><b>${item.name}</b></div>
            <div>${item.value.toLocaleString()} (${pct}%)</div>
          </div>`
        },
        backgroundColor: theme.tooltip.backgroundColor,
        borderColor: theme.tooltip.borderColor,
        textStyle: { color: theme.tooltip.textColor },
        extraCssText: theme.tooltip.shadow !== 'none' ? `box-shadow: ${theme.tooltip.shadow};` : '',
      },
      grid: {
        left: 35,
        right: 8,
        top: 8,
        bottom: 20,
        containLabel: false,
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: {
          fontSize: 8,
          color: theme.text.muted,
          rotate: 0,
          interval: 'auto',
          formatter: (value: string) => {
            // For numeric ranges like "1.0-2.0", just show the start
            const parts = value.split('-')
            if (parts.length === 2 && !Number.isNaN(Number(parts[0]))) {
              return Number(parts[0]).toFixed(0)
            }
            // For string values, truncate
            return value.length > 6 ? value.slice(0, 5) + '…' : value
          },
        },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          fontSize: 8,
          color: theme.text.muted,
          formatter: (value: number) => {
            if (value >= 1000000) return (value / 1000000).toFixed(0) + 'M'
            if (value >= 1000) return (value / 1000).toFixed(0) + 'K'
            return value.toString()
          },
        },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: theme.axis.splitLine } },
        splitNumber: 3,
      },
      series: [
        {
          type: 'bar',
          data: values,
          itemStyle: {
            color: theme.colors.primary,
            borderRadius: [theme.structure.barBorderRadius, theme.structure.barBorderRadius, 0, 0],
          },
          barMaxWidth: 20,
          emphasis: { disabled: true },
        },
      ],
    }
  }, [data, theme])

  if (data.length === 0) {
    return <div className="text-xs text-[var(--color-text-muted)]">No data</div>
  }

  return <ReactECharts option={option} style={{ width: '100%', height }} {...ECHARTS_REACT_PROPS_SVG} />
}
