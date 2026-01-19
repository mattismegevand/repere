import ReactECharts from 'echarts-for-react'
import { useMemo } from 'react'
import { ECHARTS_REACT_PROPS, useChartTheme } from '@/lib/charts'
import type { BoxPlotProps } from './types'

export function BoxPlot({ min, p25, median, p75, max, width = 260, height = 80 }: BoxPlotProps) {
  const theme = useChartTheme()

  const option = useMemo(
    () => ({
      darkMode: theme.isDark,
      animation: false,
      tooltip: {
        trigger: 'item',
        appendToBody: true,
        backgroundColor: theme.tooltip.backgroundColor,
        borderColor: theme.tooltip.borderColor,
        textStyle: { color: theme.tooltip.textColor, fontSize: theme.typography.tooltip },
        extraCssText: theme.tooltip.shadow !== 'none' ? `box-shadow: ${theme.tooltip.shadow};` : '',
        formatter: () =>
          `<b>Distribution</b><br/>Min: ${min}<br/>Q1: ${p25}<br/>Median: ${median}<br/>Q3: ${p75}<br/>Max: ${max}`,
      },
      grid: { left: 10, right: 10, top: 10, bottom: 25, containLabel: false },
      xAxis: {
        type: 'value',
        min: min - (max - min) * 0.1,
        max: max + (max - min) * 0.1,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { color: theme.axis.label, fontSize: theme.typography.axisLabel },
      },
      yAxis: {
        type: 'category',
        data: [''],
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          type: 'boxplot',
          data: [[min, p25, median, p75, max]],
          boxWidth: ['40%', '60%'],
          itemStyle: {
            color: theme.tooltip.backgroundColor,
            borderColor: theme.colors.primary,
          },
          emphasis: { disabled: true },
        },
      ],
    }),
    [min, p25, median, p75, max, theme]
  )

  return <ReactECharts option={option} style={{ width, height }} {...ECHARTS_REACT_PROPS} />
}
