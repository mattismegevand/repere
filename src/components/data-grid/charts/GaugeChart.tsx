import ReactECharts from 'echarts-for-react'
import { useMemo } from 'react'
import { ECHARTS_REACT_PROPS, useChartTheme } from '@/lib/charts'

export interface GaugeChartProps {
  /** Current value */
  value: number
  /** Minimum value */
  min?: number
  /** Maximum value */
  max?: number
  /** Label for the gauge */
  label?: string
  /** Unit/suffix to display */
  unit?: string
  /** Color thresholds: [threshold, color][] */
  thresholds?: Array<[number, string]>
  width?: number
  height?: number
}

export function GaugeChart({
  value,
  min = 0,
  max = 100,
  label,
  unit = '',
  thresholds,
  width = 200,
  height = 200,
}: GaugeChartProps) {
  const theme = useChartTheme()

  const option = useMemo(() => {
    // Normalize value to 0-100 range for color calculation
    const normalizedValue = ((value - min) / (max - min)) * 100

    // Default color based on value
    let color = theme.colors.primary
    if (thresholds) {
      // Find the appropriate color based on thresholds
      for (const [threshold, thresholdColor] of thresholds) {
        if (normalizedValue <= threshold) {
          color = thresholdColor
          break
        }
      }
    } else {
      // Default traffic light coloring
      if (normalizedValue < 33) color = '#ef4444'
      else if (normalizedValue < 66) color = '#f59e0b'
      else color = '#22c55e'
    }

    return {
      darkMode: theme.isDark,
      animation: theme.animation.enabled,
      animationDuration: theme.animation.duration,
      series: [
        {
          type: 'gauge',
          startAngle: 200,
          endAngle: -20,
          min,
          max,
          splitNumber: 5,
          center: ['50%', '60%'],
          radius: '90%',
          axisLine: {
            lineStyle: {
              width: 12,
              color: [[1, theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)']],
            },
          },
          progress: {
            show: true,
            width: 12,
            itemStyle: {
              color,
            },
          },
          pointer: {
            show: false,
          },
          axisTick: {
            show: false,
          },
          splitLine: {
            show: false,
          },
          axisLabel: {
            distance: 20,
            color: theme.text.secondary,
            fontSize: 10,
            formatter: (v: number) => {
              if (Math.abs(v) >= 1000000) return `${(v / 1000000).toFixed(0)}M`
              if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}K`
              return v.toFixed(0)
            },
          },
          anchor: {
            show: false,
          },
          title: {
            show: !!label,
            offsetCenter: [0, '85%'],
            fontSize: 11,
            color: theme.text.secondary,
            fontWeight: 500,
          },
          detail: {
            valueAnimation: true,
            fontSize: 24,
            fontWeight: 'bold',
            offsetCenter: [0, '30%'],
            color: theme.text.primary,
            formatter: (v: number) => {
              if (Math.abs(v) >= 1000000) return `${(v / 1000000).toFixed(1)}M${unit}`
              if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}K${unit}`
              return `${v.toLocaleString()}${unit}`
            },
          },
          data: [{ value, name: label || '' }],
        },
      ],
    }
  }, [value, min, max, label, unit, thresholds, theme])

  return <ReactECharts option={option} style={{ width, height }} {...ECHARTS_REACT_PROPS} />
}
