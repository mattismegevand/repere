import BarChart2 from 'lucide-react/dist/esm/icons/bar-chart-2'
import BoxSelect from 'lucide-react/dist/esm/icons/box-select'
import Combine from 'lucide-react/dist/esm/icons/combine'
import Gauge from 'lucide-react/dist/esm/icons/gauge'
import GitCompare from 'lucide-react/dist/esm/icons/git-compare'
import GitPullRequestArrow from 'lucide-react/dist/esm/icons/git-pull-request-arrow'
import Grid from 'lucide-react/dist/esm/icons/grid'
import Hash from 'lucide-react/dist/esm/icons/hash'
import LineChart from 'lucide-react/dist/esm/icons/line-chart'
import PieChart from 'lucide-react/dist/esm/icons/pie-chart'
import ScatterChart from 'lucide-react/dist/esm/icons/scatter-chart'
import TreesIcon from 'lucide-react/dist/esm/icons/trees-icon'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Label, Select } from '@/components/ui'
import type { ChartAggregation, ChartConfig, ChartType, Column } from '@/types'

const CHART_TYPES: Array<{ type: ChartType; label: string; icon: typeof BarChart2 }> = [
  { type: 'bar', label: 'Bar', icon: BarChart2 },
  { type: 'line', label: 'Line', icon: LineChart },
  { type: 'pie', label: 'Pie', icon: PieChart },
  { type: 'scatter', label: 'Scatter', icon: ScatterChart },
  { type: 'kpi', label: 'KPI', icon: Hash },
  { type: 'gauge', label: 'Gauge', icon: Gauge },
  { type: 'funnel', label: 'Funnel', icon: GitPullRequestArrow },
  { type: 'combo', label: 'Combo', icon: Combine },
  { type: 'stackedBar', label: 'Stacked', icon: BarChart2 },
  { type: 'heatmap', label: 'Heatmap', icon: Grid },
  { type: 'treemap', label: 'Treemap', icon: TreesIcon },
  { type: 'boxplot', label: 'Box Plot', icon: BoxSelect },
  { type: 'correlationMatrix', label: 'Correlation', icon: GitCompare },
]

const AGGREGATIONS: Array<{ value: ChartAggregation; label: string }> = [
  { value: 'count', label: 'Count' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
]

function isNumericType(type: Column['type']): boolean {
  const numericTypes = ['number', 'integer', 'bigint', 'float', 'double', 'decimal']
  return numericTypes.includes(type.toLowerCase())
}

export interface ChartConfigFormProps {
  columns: Column[]
  initialConfig?: ChartConfig
  onChange: (config: ChartConfig) => void
  /** If true, shows all chart types. If false, shows simplified subset */
  showAllChartTypes?: boolean
  /** Debounce delay in ms before calling onChange. Set to 0 for immediate updates */
  debounceMs?: number
}

export function ChartConfigForm({
  columns,
  initialConfig,
  onChange,
  showAllChartTypes = true,
  debounceMs = 300,
}: ChartConfigFormProps) {
  const [chartType, setChartType] = useState<ChartType>(initialConfig?.chartType ?? 'bar')
  const [xColumn, setXColumn] = useState<string>(initialConfig?.xAxis?.column ?? '')
  const [yColumn, setYColumn] = useState<string>(
    Array.isArray(initialConfig?.yAxis) ? (initialConfig?.yAxis[0]?.column ?? '') : (initialConfig?.yAxis?.column ?? '')
  )
  const [aggregation, setAggregation] = useState<ChartAggregation>(initialConfig?.aggregation ?? 'count')
  const [colorColumn, setColorColumn] = useState<string>(initialConfig?.colorBy ?? '')
  const [sizeColumn, setSizeColumn] = useState<string>(initialConfig?.sizeBy ?? '')

  const numericColumns = columns.filter((c) => isNumericType(c.type))
  const initializedRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-select default columns based on chart type
  const getDefaultXColumn = useCallback(
    (type: ChartType) => {
      if (type === 'correlationMatrix') return ''
      if (type === 'boxplot') return numericColumns[0]?.name ?? ''
      const categoricalColumns = columns.filter((c) => !isNumericType(c.type))
      return categoricalColumns[0]?.name ?? columns[0]?.name ?? ''
    },
    [columns, numericColumns]
  )

  const getDefaultYColumn = useCallback(
    (type: ChartType) => {
      if (!['bar', 'line', 'scatter', 'stackedBar', 'heatmap'].includes(type)) return ''
      return numericColumns[0]?.name ?? ''
    },
    [numericColumns]
  )

  // Initialize with defaults if no initial config
  useEffect(() => {
    if (!initializedRef.current && columns.length > 0) {
      initializedRef.current = true
      if (!initialConfig) {
        setXColumn(getDefaultXColumn(chartType))
        setYColumn(getDefaultYColumn(chartType))
      }
    }
  }, [columns, initialConfig, chartType, getDefaultXColumn, getDefaultYColumn])

  // Build config and call onChange (debounced)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const buildConfig = () => {
      const config: ChartConfig = {
        chartType,
        xAxis: xColumn ? { column: xColumn } : undefined,
        yAxis: yColumn ? { column: yColumn } : undefined,
        aggregation,
        colorBy: colorColumn || undefined,
        sizeBy: sizeColumn || undefined,
      }
      onChange(config)
    }

    if (debounceMs > 0) {
      debounceRef.current = setTimeout(buildConfig, debounceMs)
    } else {
      buildConfig()
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [chartType, xColumn, yColumn, aggregation, colorColumn, sizeColumn, onChange, debounceMs])

  const handleChartTypeChange = (type: ChartType) => {
    setChartType(type)
    setXColumn(getDefaultXColumn(type))
    setYColumn(getDefaultYColumn(type))
  }

  // Chart type visibility flags
  const isCorrelation = chartType === 'correlationMatrix'
  const isBoxplot = chartType === 'boxplot'
  const showXColumn = !isCorrelation
  const showYColumn = ['bar', 'line', 'scatter', 'stackedBar', 'heatmap'].includes(chartType)
  const showColorColumn = ['scatter', 'stackedBar', 'stackedArea'].includes(chartType)
  const showSizeColumn = ['scatter', 'treemap'].includes(chartType)
  const showAggregation = ['bar', 'line', 'pie', 'heatmap', 'treemap'].includes(chartType)
  const xAxisColumns = isBoxplot ? numericColumns : columns

  const chartTypesToShow = showAllChartTypes ? CHART_TYPES : CHART_TYPES.slice(0, 4)

  return (
    <div className="space-y-4">
      {/* Chart Type Grid */}
      <div>
        <Label className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-2 block">
          Chart Type
        </Label>
        <div className="flex flex-wrap gap-1">
          {chartTypesToShow.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              onClick={() => handleChartTypeChange(type)}
              title={label}
              className={`px-3 py-2 rounded flex items-center gap-1.5 text-xs transition-colors ${
                chartType === type
                  ? 'bg-[var(--color-accent-bg)] text-[var(--color-accent)]'
                  : 'hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Axis Selectors */}
      <div className="flex gap-4 flex-wrap">
        {showXColumn && (
          <div className="min-w-[180px]">
            <Label className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
              {isBoxplot ? 'Value (numeric)' : chartType === 'scatter' ? 'X Axis' : 'Category'}
            </Label>
            <Select
              value={xColumn}
              onChange={(e) => setXColumn(e.target.value)}
              className="mt-1 text-xs"
              disabled={xAxisColumns.length === 0}
            >
              {xAxisColumns.map((col) => (
                <option key={col.name} value={col.name}>
                  {col.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        {isCorrelation && (
          <div className="text-xs text-[var(--color-text-muted)] py-4">Auto-correlates all numeric columns.</div>
        )}

        {showYColumn && (
          <div className="min-w-[180px]">
            <Label className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
              {chartType === 'scatter' ? 'Y Axis' : 'Value'}
            </Label>
            <Select
              value={yColumn}
              onChange={(e) => setYColumn(e.target.value)}
              className="mt-1 text-xs"
              disabled={columns.length === 0}
            >
              {columns.map((col) => (
                <option key={col.name} value={col.name}>
                  {col.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        {showAggregation && (
          <div className="min-w-[140px]">
            <Label className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Aggregation</Label>
            <Select
              value={aggregation}
              onChange={(e) => setAggregation(e.target.value as ChartAggregation)}
              className="mt-1 text-xs"
            >
              {AGGREGATIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        )}

        {showColorColumn && (
          <div className="min-w-[140px]">
            <Label className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Color By</Label>
            <Select value={colorColumn} onChange={(e) => setColorColumn(e.target.value)} className="mt-1 text-xs">
              <option value="">None</option>
              {columns.map((col) => (
                <option key={col.name} value={col.name}>
                  {col.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        {showSizeColumn && (
          <div className="min-w-[140px]">
            <Label className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Size By</Label>
            <Select value={sizeColumn} onChange={(e) => setSizeColumn(e.target.value)} className="mt-1 text-xs">
              <option value="">None</option>
              {numericColumns.map((col) => (
                <option key={col.name} value={col.name}>
                  {col.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>
    </div>
  )
}
