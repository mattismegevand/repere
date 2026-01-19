import type { Column } from '@/types'

export type ChartType = 'none' | 'histogram' | 'box-plot' | 'line' | 'pie' | 'horizontal-bar'

export interface HistogramBin {
  value: string | number
  count: number
  // For numeric histograms, the bin range
  min?: number
  max?: number
}

export interface ColumnStats {
  // Basic stats (all types)
  count: number
  nullCount: number
  uniqueCount: number

  // Numeric stats
  min?: number
  max?: number
  mean?: number
  stdDev?: number
  median?: number
  p25?: number
  p75?: number

  // String stats
  mode?: string
  modeCount?: number
  sampleValues?: string[]

  // Date stats
  minDate?: string
  maxDate?: string
  dateSpanDays?: number

  // Distribution data
  histogram?: HistogramBin[]

  // Computed
  chartType: ChartType
  uniqueRatio: number
}

interface ChartTooltipData {
  label: string
  value?: string | number
  count: number
  percentage: number
  range?: { min: number; max: number }
}

interface TooltipPosition {
  x: number
  y: number
}

/** Click event data for cross-filtering */
export interface ChartClickEvent {
  /** The clicked category/label name */
  name?: string
  /** The clicked value */
  value?: unknown
  /** Raw data from the clicked element */
  data?: { label?: string; name?: string; value?: unknown }
}

interface ChartProps {
  width?: number
  height?: number
  onHover?: (data: ChartTooltipData | null, position: TooltipPosition | null) => void
  /** Click handler for cross-filtering in dashboards */
  onClick?: (event: ChartClickEvent) => void
}

export interface BoxPlotProps extends ChartProps {
  min: number
  p25: number
  median: number
  p75: number
  max: number
}

export interface PieChartProps extends ChartProps {
  data: { label: string; count: number }[]
  maxSlices?: number
  totalCount: number
}

export interface LineChartProps extends ChartProps {
  data: { date: string | Date; count: number }[]
  totalCount: number
}

export interface HistogramChartProps extends ChartProps {
  data: HistogramBin[]
  totalCount: number
  columnType: Column['type']
}

export interface SparklineProps {
  stats: ColumnStats | null
  columnType: Column['type']
  width?: number
  height?: number
}
