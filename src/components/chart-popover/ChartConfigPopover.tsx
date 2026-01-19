import {
  BarChart2,
  BoxSelect,
  ChevronDown,
  ChevronUp,
  GitCompare,
  Grid,
  GripHorizontal,
  LineChart,
  PieChart,
  ScatterChart,
  TreesIcon,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Label, Select } from '@/components/ui'
import { useDuckDB } from '@/lib/duckdb'
import { usePipeline } from '@/lib/pipeline/usePipeline'
import { usePanelStore, usePipelineStore } from '@/stores'
import type { ChartAggregation, ChartConfig, ChartNode, ChartType, Column } from '@/types'

const CHART_TYPES: Array<{ type: ChartType; label: string; icon: typeof BarChart2 }> = [
  { type: 'bar', label: 'Bar', icon: BarChart2 },
  { type: 'line', label: 'Line', icon: LineChart },
  { type: 'pie', label: 'Pie', icon: PieChart },
  { type: 'scatter', label: 'Scatter', icon: ScatterChart },
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

export function ChartConfigPopover() {
  const { client } = useDuckDB()
  const closeChartPanel = usePanelStore((s) => s.closeChartPanel)
  const activeEditingPanel = usePanelStore((s) => s.activeEditingPanel)
  const { nodes } = usePipelineStore()
  const { createChart, updateChart, deleteNode } = usePipeline()
  const popoverRef = useRef<HTMLDivElement>(null)

  // Derive chart panel state from discriminated union
  const chartPanelSourceId = activeEditingPanel.type === 'chart' ? activeEditingPanel.sourceNodeId : null
  const chartPanelEditingId = activeEditingPanel.type === 'chart' ? activeEditingPanel.editingNodeId : null
  const chartPanelPosition = activeEditingPanel.type === 'chart' ? activeEditingPanel.position : null
  const chartPanelDefaultType = activeEditingPanel.type === 'chart' ? activeEditingPanel.defaultType : null

  // Use default type from store if provided, otherwise 'bar'
  const [chartType, setChartType] = useState<ChartType>((chartPanelDefaultType as ChartType) || 'bar')
  const [xColumn, setXColumn] = useState<string>('')
  const [yColumn, setYColumn] = useState<string>('')
  const [aggregation, setAggregation] = useState<ChartAggregation>('count')
  const [colorColumn, setColorColumn] = useState<string>('')
  const [sizeColumn, setSizeColumn] = useState<string>('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Dragging state
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const isDragging = useRef(false)

  const createdChartIdRef = useRef<string | null>(chartPanelEditingId)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isCreatingRef = useRef(false)

  const createChartRef = useRef(createChart)
  const updateChartRef = useRef(updateChart)
  const deleteNodeRef = useRef(deleteNode)
  createChartRef.current = createChart
  updateChartRef.current = updateChart
  deleteNodeRef.current = deleteNode

  const sourceNode = chartPanelSourceId ? nodes[chartPanelSourceId] : null
  const columns = sourceNode?.columns ?? []
  const numericColumns = columns.filter((c) => isNumericType(c.type))
  const categoricalColumns = columns.filter((c) => !isNumericType(c.type))

  // Initialize with existing chart config if editing
  useEffect(() => {
    if (chartPanelEditingId) {
      const editNode = nodes[chartPanelEditingId]
      if (editNode?.type === 'chart') {
        const chartNode = editNode as ChartNode
        const config = chartNode.config
        setChartType(config.chartType)
        setXColumn(config.xAxis?.column ?? '')
        setYColumn(Array.isArray(config.yAxis) ? (config.yAxis[0]?.column ?? '') : (config.yAxis?.column ?? ''))
        setAggregation(config.aggregation ?? 'count')
        setColorColumn(config.colorBy ?? '')
        setSizeColumn(config.sizeBy ?? '')
        if (config.colorBy || config.sizeBy) setShowAdvanced(true)
      }
      createdChartIdRef.current = chartPanelEditingId
    }
  }, [chartPanelEditingId, nodes])

  // Auto-suggest columns when source changes
  useEffect(() => {
    if (!chartPanelEditingId && columns.length > 0) {
      const firstCat = categoricalColumns[0]
      if (firstCat && !xColumn) {
        setXColumn(firstCat.name)
      }
      const firstNum = numericColumns[0]
      if (firstNum && !yColumn) {
        setYColumn(firstNum.name)
      }
    }
  }, [columns, chartPanelEditingId, xColumn, yColumn, categoricalColumns, numericColumns])

  const isCorrelation = chartType === 'correlationMatrix'
  const isValid = isCorrelation || xColumn !== ''

  // Auto-create/update chart
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    const currentSourceNode = chartPanelSourceId ? nodes[chartPanelSourceId] : null
    if (!client || !currentSourceNode || !chartPanelSourceId || !isValid) {
      return
    }

    debounceRef.current = setTimeout(async () => {
      if (isCreatingRef.current) return
      isCreatingRef.current = true

      try {
        const config: ChartConfig = {
          chartType,
          xAxis: { column: xColumn },
          yAxis: yColumn ? { column: yColumn } : undefined,
          aggregation,
          colorBy: colorColumn || undefined,
          sizeBy: sizeColumn || undefined,
        }

        // If editing an existing chart, update it in place to preserve position
        if (createdChartIdRef.current) {
          updateChartRef.current(createdChartIdRef.current, config)
        } else {
          // Creating a new chart
          const newChart = createChartRef.current(chartPanelSourceId, config)
          if (newChart) {
            createdChartIdRef.current = newChart.id
          }
        }
      } catch (err) {
        console.error('Failed to create/update chart:', err)
      } finally {
        isCreatingRef.current = false
      }
    }, 500)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, chartPanelSourceId, chartType, xColumn, yColumn, aggregation, colorColumn, sizeColumn, isValid])

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeChartPanel()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [closeChartPanel])

  // Dragging handlers
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    const rect = popoverRef.current?.getBoundingClientRect()
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
    }
  }, [])

  useEffect(() => {
    const handleDrag = (e: MouseEvent) => {
      if (!isDragging.current || !dragOffset) return
      const newX = e.clientX - dragOffset.x
      const newY = e.clientY - dragOffset.y
      setPosition({ x: newX, y: newY })
    }

    const handleDragEnd = () => {
      isDragging.current = false
    }

    document.addEventListener('mousemove', handleDrag)
    document.addEventListener('mouseup', handleDragEnd)
    return () => {
      document.removeEventListener('mousemove', handleDrag)
      document.removeEventListener('mouseup', handleDragEnd)
    }
  }, [dragOffset])

  const handleClose = useCallback(() => {
    closeChartPanel()
  }, [closeChartPanel])

  if (!chartPanelSourceId || !sourceNode) return null

  // Default position to center of screen if not provided
  const panelPosition = chartPanelPosition ?? { x: window.innerWidth / 2, y: 100 }

  const isBoxplot = chartType === 'boxplot'
  const showXColumn = !isCorrelation
  const showYColumn = ['bar', 'line', 'scatter', 'stackedBar', 'heatmap'].includes(chartType)
  const showColorColumn = ['scatter', 'stackedBar', 'stackedArea'].includes(chartType)
  const showSizeColumn = ['scatter', 'treemap'].includes(chartType)
  const showAggregation = ['bar', 'line', 'pie', 'heatmap', 'treemap'].includes(chartType)
  const hasAdvancedOptions = showColorColumn || showSizeColumn
  // For boxplot, only show numeric columns
  const xAxisColumns = isBoxplot ? numericColumns : columns

  // Calculate position - use dragged position if available, otherwise calculate from chart position
  let left: number
  let top: number

  if (position) {
    // Use dragged position
    left = position.x
    top = position.y
  } else {
    // Calculate initial position - ensure popover stays within viewport
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const popoverWidth = 280
    const popoverHeight = 400

    left = panelPosition.x + 340 // Position to right of chart node
    top = panelPosition.y

    // Flip to left if would overflow right
    if (left + popoverWidth > viewportWidth - 20) {
      left = panelPosition.x - popoverWidth - 20
    }

    // Adjust vertical position if would overflow bottom
    if (top + popoverHeight > viewportHeight - 20) {
      top = viewportHeight - popoverHeight - 20
    }

    // Ensure minimum top position
    if (top < 20) top = 20
  }

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 w-[280px] bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg shadow-xl"
      style={{ left, top }}
    >
      {/* Header with drag handle */}
      <div
        onMouseDown={handleDragStart}
        className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)] cursor-move select-none"
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
          <span className="text-xs font-medium">Configure Chart</span>
        </div>
        <button
          onClick={handleClose}
          onMouseDown={(e) => e.stopPropagation()}
          className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] rounded"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3 max-h-[60vh] overflow-y-auto">
        {/* Chart type selection */}
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Type</Label>
          <div className="mt-1.5 grid grid-cols-4 gap-1">
            {CHART_TYPES.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                onClick={() => setChartType(type)}
                title={label}
                className={`p-2 rounded flex flex-col items-center gap-0.5 transition-colors ${
                  chartType === type
                    ? 'bg-[var(--color-accent-bg)] text-[var(--color-accent)]'
                    : 'hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[9px]">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* X Axis / Category / Value (for boxplot) */}
        {showXColumn && (
          <div>
            <Label htmlFor="x-column" className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
              {isBoxplot ? 'Value (numeric)' : chartType === 'scatter' ? 'X Axis' : 'Category'}
            </Label>
            <Select id="x-column" value={xColumn} onChange={(e) => setXColumn(e.target.value)} className="mt-1 text-xs">
              <option value="">Select column...</option>
              {xAxisColumns.map((col) => (
                <option key={col.name} value={col.name}>
                  {col.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        {/* Correlation matrix info */}
        {isCorrelation && (
          <div className="text-[10px] text-[var(--color-text-muted)] py-1">Auto-correlates all numeric columns.</div>
        )}

        {/* Y Axis / Value */}
        {showYColumn && (
          <div>
            <Label htmlFor="y-column" className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
              {chartType === 'scatter' ? 'Y Axis' : 'Value'}
            </Label>
            <Select id="y-column" value={yColumn} onChange={(e) => setYColumn(e.target.value)} className="mt-1 text-xs">
              <option value="">Select column...</option>
              {columns.map((col) => (
                <option key={col.name} value={col.name}>
                  {col.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        {/* Aggregation */}
        {showAggregation && (
          <div>
            <Label htmlFor="aggregation" className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
              Aggregation
            </Label>
            <Select
              id="aggregation"
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

        {/* Advanced options toggle */}
        {hasAdvancedOptions && (
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <span>More options</span>
          </button>
        )}

        {/* Advanced options */}
        {showAdvanced && (
          <div className="space-y-3 pt-2 border-t border-[var(--color-border)]">
            {showColorColumn && (
              <div>
                <Label
                  htmlFor="color-column"
                  className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]"
                >
                  Color By
                </Label>
                <Select
                  id="color-column"
                  value={colorColumn}
                  onChange={(e) => setColorColumn(e.target.value)}
                  className="mt-1 text-xs"
                >
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
              <div>
                <Label
                  htmlFor="size-column"
                  className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]"
                >
                  Size By
                </Label>
                <Select
                  id="size-column"
                  value={sizeColumn}
                  onChange={(e) => setSizeColumn(e.target.value)}
                  className="mt-1 text-xs"
                >
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
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-[var(--color-border)]">
        <button
          onClick={handleClose}
          className="w-full py-1.5 text-xs font-medium text-[var(--color-accent)] bg-[var(--color-accent-bg)] hover:bg-[var(--color-accent)]/20 rounded"
        >
          Done
        </button>
      </div>
    </div>
  )
}

function isNumericType(type: Column['type']): boolean {
  const numericTypes = ['number', 'integer', 'bigint', 'float', 'double', 'decimal']
  return numericTypes.includes(type.toLowerCase())
}
