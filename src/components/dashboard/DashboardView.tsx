import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { arrayMove, rectSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import * as Dialog from '@radix-ui/react-dialog'
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import Grid2X2 from 'lucide-react/dist/esm/icons/grid-2-x-2'
import Grid3X3 from 'lucide-react/dist/esm/icons/grid-3-x-3'
import GripVertical from 'lucide-react/dist/esm/icons/grip-vertical'
import Home from 'lucide-react/dist/esm/icons/home'
import LayoutGrid from 'lucide-react/dist/esm/icons/layout-grid'
import Pencil from 'lucide-react/dist/esm/icons/pencil'
import Plus from 'lucide-react/dist/esm/icons/plus'
import Settings from 'lucide-react/dist/esm/icons/settings'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import X from 'lucide-react/dist/esm/icons/x'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChartConfigForm } from '@/components/chart-modal/ChartConfigForm'
import {
  BarChart,
  type ChartClickEvent,
  ComboChart,
  FunnelChart,
  GaugeChart,
  HeatmapChart,
  KPICard,
  LineChart as LineChartComponent,
  PieChart,
  ScatterChart as ScatterChartComponent,
  StackedAreaChart,
  StackedBarChart,
  TreemapChart,
} from '@/components/data-grid/charts'
import { useDuckDB } from '@/lib/duckdb'
import { useChartData } from '@/lib/duckdb/useChartData'
import { generateTimestampId } from '@/lib/id'
import { useDashboardStore } from '@/stores/dashboardStore'
import { useDialogStore } from '@/stores/dialogStore'
import { usePipelineRuntimeStore } from '@/stores/pipelineRuntimeStore'
import { usePipelineStore } from '@/stores/pipelineStore'
import { usePipelineUiStore } from '@/stores/pipelineUiStore'
import type {
  ChartConfig,
  ChartType,
  Column,
  DashboardChartConfig,
  DashboardFilter,
  DashboardGlobalFilter,
  DashboardNode as DashboardNodeType,
  DrillState,
} from '@/types'

// Minimum chart height for proper display
const MIN_CHART_HEIGHT = 250

export function DashboardView() {
  const activeDialog = useDialogStore((s) => s.activeDialog)
  const closeDialog = useDialogStore((s) => s.closeDialog)
  const openDialog = useDialogStore((s) => s.openDialog)
  const nodes = usePipelineStore((s) => s.nodes)
  const edges = usePipelineStore((s) => s.edges)
  const runtimeById = usePipelineRuntimeStore((s) => s.nodes)
  const updateNode = usePipelineStore((s) => s.updateNode)
  const dataVersion = usePipelineUiStore((s) => s.dataVersion)
  const activeFilters = useDashboardStore((s) => s.activeFilters)
  const collapseDashboard = useDashboardStore((s) => s.collapseDashboard)

  const [showAddChart, setShowAddChart] = useState(false)
  const [editingChart, setEditingChart] = useState<DashboardChartConfig | null>(null)

  const isDashboardViewOpen = activeDialog?.type === 'dashboardView'
  const dashboardNodeId = isDashboardViewOpen ? activeDialog.nodeId : null

  const dashboardNode = dashboardNodeId ? (nodes[dashboardNodeId] as DashboardNodeType) : null
  const config = dashboardNode?.config

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  )

  const handleClose = useCallback(() => {
    collapseDashboard()
    closeDialog()
  }, [collapseDashboard, closeDialog])

  const handleConfigure = useCallback(() => {
    if (dashboardNodeId) {
      openDialog({ type: 'dashboardConfig', nodeId: dashboardNodeId })
    }
  }, [dashboardNodeId, openDialog])

  const handleAddChart = useCallback(
    (chartConfig: DashboardChartConfig) => {
      if (!dashboardNodeId || !config) return

      const updatedCharts = [...config.embeddedCharts, chartConfig]
      updateNode(dashboardNodeId, {
        config: { ...config, embeddedCharts: updatedCharts },
      })
      setShowAddChart(false)
    },
    [dashboardNodeId, config, updateNode]
  )

  const handleUpdateChart = useCallback(
    (chartConfig: DashboardChartConfig) => {
      if (!dashboardNodeId || !config) return

      const updatedCharts = config.embeddedCharts.map((c) => (c.id === chartConfig.id ? chartConfig : c))
      updateNode(dashboardNodeId, {
        config: { ...config, embeddedCharts: updatedCharts },
      })
      setEditingChart(null)
    },
    [dashboardNodeId, config, updateNode]
  )

  const handleDeleteChart = useCallback(
    (chartId: string) => {
      if (!dashboardNodeId || !config) return

      const updatedCharts = config.embeddedCharts.filter((c) => c.id !== chartId)
      updateNode(dashboardNodeId, {
        config: { ...config, embeddedCharts: updatedCharts },
      })
    },
    [dashboardNodeId, config, updateNode]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id || !dashboardNodeId || !config) return

      const oldIndex = config.embeddedCharts.findIndex((c) => c.id === active.id)
      const newIndex = config.embeddedCharts.findIndex((c) => c.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedCharts = arrayMove(config.embeddedCharts, oldIndex, newIndex)
        updateNode(dashboardNodeId, {
          config: { ...config, embeddedCharts: reorderedCharts },
        })
      }
    },
    [dashboardNodeId, config, updateNode]
  )

  // Get current filters for this dashboard
  const dashboardFilters = dashboardNodeId ? activeFilters[dashboardNodeId] || [] : []

  if (!isDashboardViewOpen || !dashboardNode || !config) {
    return null
  }

  const { embeddedCharts, layout } = config
  const title = config.title || dashboardNode.name

  // Get the first parent's columns for the add chart dialog
  const firstParentId = dashboardNodeId ? edges.find((e) => e.targetId === dashboardNodeId)?.sourceId : undefined
  const firstParent = firstParentId ? nodes[firstParentId] : null
  const firstParentRuntime = firstParentId ? runtimeById[firstParentId] : undefined

  return (
    <Dialog.Root open={isDashboardViewOpen} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed inset-4 bg-[var(--color-bg-primary)] rounded-lg z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-4 px-4 py-3 border-b border-[var(--color-border)]">
            <button
              onClick={handleClose}
              className="p-1.5 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]"
              title="Back to canvas"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <Dialog.Title className="text-lg font-semibold flex-1">{title}</Dialog.Title>

            <div className="flex items-center gap-2">
              {/* Layout selector */}
              <LayoutSelector
                currentColumns={layout.gridColumns}
                onChange={(cols) => {
                  if (dashboardNodeId) {
                    usePipelineStore.getState().updateNode(dashboardNodeId, {
                      config: { ...config, layout: { ...layout, gridColumns: cols } },
                    })
                  }
                }}
              />

              <div className="w-px h-5 bg-[var(--color-border)]" />

              <button
                onClick={handleConfigure}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]"
              >
                <Settings className="w-4 h-4" />
                Configure
              </button>
              <Dialog.Close asChild>
                <button className="p-1.5 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]">
                  <X className="w-5 h-5" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* Global filters bar */}
          {config.globalFilters.length > 0 && (
            <GlobalFilterBar dashboardId={dashboardNodeId!} globalFilters={config.globalFilters} />
          )}

          {/* Active filters display */}
          {dashboardFilters.length > 0 ? <FilterBar dashboardId={dashboardNodeId!} filters={dashboardFilters} /> : null}

          {/* Chart grid */}
          <div className="flex-1 overflow-auto p-4">
            {embeddedCharts.length === 0 ? (
              <EmptyDashboard onAddChart={() => setShowAddChart(true)} />
            ) : (
              <div className="flex flex-col gap-4">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <ChartGrid
                    charts={embeddedCharts}
                    dashboardId={dashboardNodeId!}
                    layout={layout}
                    dataVersion={dataVersion}
                    onEditChart={setEditingChart}
                    onDeleteChart={handleDeleteChart}
                  />
                </DndContext>
                {/* Add chart button when there are already charts */}
                <button
                  onClick={() => setShowAddChart(true)}
                  className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-[var(--color-border)] rounded-lg text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  <span>Add Chart</span>
                </button>
              </div>
            )}
          </div>

          {/* Add Chart Dialog */}
          {showAddChart && firstParent && (
            <AddChartDialog
              sourceId={firstParentId!}
              tableName={firstParentRuntime?.tableName ?? ''}
              columns={firstParentRuntime?.columns ?? []}
              onAdd={handleAddChart}
              onClose={() => setShowAddChart(false)}
            />
          )}

          {/* Edit Chart Dialog */}
          {editingChart && firstParent && (
            <EditChartDialog
              chart={editingChart}
              tableName={firstParentRuntime?.tableName ?? ''}
              columns={firstParentRuntime?.columns ?? []}
              onSave={handleUpdateChart}
              onClose={() => setEditingChart(null)}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// Global filter bar - dropdown selectors that filter all charts
interface GlobalFilterBarProps {
  dashboardId: string
  globalFilters: DashboardGlobalFilter[]
}

function GlobalFilterBar({ dashboardId, globalFilters }: GlobalFilterBarProps) {
  const { client } = useDuckDB()
  const runtimeById = usePipelineRuntimeStore((s) => s.nodes)
  const activeFilters = useDashboardStore((s) => s.activeFilters)
  const setFilter = useDashboardStore((s) => s.setFilter)
  const removeFilter = useDashboardStore((s) => s.removeFilter)

  const dashboardFilters = activeFilters[dashboardId] || []

  const handleFilterChange = useCallback(
    (filter: DashboardGlobalFilter, value: string | null) => {
      const filterId = `global-${filter.id}`

      if (value === null || value === '') {
        // Remove the filter
        removeFilter(dashboardId, filterId)
      } else {
        // Set the filter
        const dashboardFilter: DashboardFilter = {
          id: filterId,
          column: filter.column,
          operator: 'eq',
          value: value,
          source: 'global',
          sourceId: filter.sourceId,
        }
        setFilter(dashboardId, dashboardFilter)
      }
    },
    [dashboardId, setFilter, removeFilter]
  )

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
      <span className="text-xs font-medium text-[var(--color-text-muted)]">Filters:</span>
      <div className="flex items-center gap-3 flex-wrap">
        {globalFilters.map((filter) => {
          const currentFilter = dashboardFilters.find((f) => f.id === `global-${filter.id}`)
          const currentValue = currentFilter?.value as string | undefined

          return (
            <GlobalFilterDropdown
              key={filter.id}
              filter={filter}
              value={currentValue}
              onChange={(value) => handleFilterChange(filter, value)}
              client={client}
              tableName={runtimeById[filter.sourceId]?.tableName}
            />
          )
        })}
      </div>
    </div>
  )
}

// Individual global filter dropdown
interface GlobalFilterDropdownProps {
  filter: DashboardGlobalFilter
  value: string | undefined
  onChange: (value: string | null) => void
  client: ReturnType<typeof useDuckDB>['client']
  tableName: string | undefined
}

function GlobalFilterDropdown({ filter, value, onChange, client, tableName }: GlobalFilterDropdownProps) {
  const [options, setOptions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  // Fetch distinct values for this column
  useEffect(() => {
    if (!client || !tableName) return

    const fetchOptions = async () => {
      setLoading(true)
      try {
        const sql = `SELECT DISTINCT "${filter.column}" AS value FROM "${tableName}" WHERE "${filter.column}" IS NOT NULL ORDER BY value LIMIT 100`
        const result = await client.query<{ value: unknown }>(sql)
        setOptions(result.rows.map((r) => String(r.value)))
      } catch {
        setOptions([])
      } finally {
        setLoading(false)
      }
    }

    fetchOptions()
  }, [client, tableName, filter.column])

  return (
    <div className="flex items-center gap-1.5">
      <label className="text-xs text-[var(--color-text-secondary)]">{filter.label}:</label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="text-xs px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] min-w-[100px]"
        disabled={loading}
      >
        <option value="">All</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  )
}

// Filter bar showing active filters
interface FilterBarProps {
  dashboardId: string
  filters: DashboardFilter[]
}

function FilterBar({ dashboardId, filters }: FilterBarProps) {
  const removeFilter = useDashboardStore((s) => s.removeFilter)
  const clearAllDashboardFilters = useDashboardStore((s) => s.clearAllDashboardFilters)

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
      <span className="text-xs text-[var(--color-text-muted)]">Active filters:</span>
      <div className="flex items-center gap-1.5 flex-wrap">
        {filters.map((filter) => (
          <FilterPill key={filter.id} filter={filter} onRemove={() => removeFilter(dashboardId, filter.id)} />
        ))}
      </div>
      {filters.length > 1 && (
        <button
          onClick={() => clearAllDashboardFilters(dashboardId)}
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] ml-2"
        >
          Clear all
        </button>
      )}
    </div>
  )
}

// Individual filter pill
interface FilterPillProps {
  filter: DashboardFilter
  onRemove: () => void
}

function FilterPill({ filter, onRemove }: FilterPillProps) {
  const displayValue = typeof filter.value === 'string' ? filter.value : String(filter.value)
  const operatorDisplay = filter.operator === 'eq' ? '=' : filter.operator

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-[var(--color-accent-bg)] text-[var(--color-accent)]">
      <span className="font-medium">{filter.column}</span>
      <span className="opacity-70">{operatorDisplay}</span>
      <span>"{displayValue}"</span>
      <button onClick={onRemove} className="ml-0.5 p-0.5 rounded-full hover:bg-[var(--color-accent)]/20">
        <X className="w-3 h-3" />
      </button>
    </span>
  )
}

// Empty state
interface EmptyDashboardProps {
  onAddChart: () => void
}

function EmptyDashboard({ onAddChart }: EmptyDashboardProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-[var(--color-text-muted)]">
      <div className="w-16 h-16 rounded-full bg-[var(--color-bg-secondary)] flex items-center justify-center">
        <Plus className="w-8 h-8" />
      </div>
      <div className="text-center">
        <p className="text-lg font-medium text-[var(--color-text-primary)]">No charts yet</p>
        <p className="text-sm mt-1">Add charts to start building your dashboard</p>
      </div>
      <button
        onClick={onAddChart}
        className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90"
      >
        Add Chart
      </button>
    </div>
  )
}

// Add Chart Dialog - uses shared ChartConfigForm with live preview
interface AddChartDialogProps {
  sourceId: string
  tableName: string
  columns: Column[]
  onAdd: (chart: DashboardChartConfig) => void
  onClose: () => void
}

const PREVIEW_SIZE = { width: 500, height: 280 }

function AddChartDialog({ sourceId, tableName, columns, onAdd, onClose }: AddChartDialogProps) {
  const { client } = useDuckDB()
  const [chartConfig, setChartConfig] = useState<ChartConfig>({ chartType: 'bar' })
  const [title, setTitle] = useState('')

  // Live preview data
  const { data, loading, error } = useChartData(client, tableName, chartConfig, 'preview')

  const handleSubmit = () => {
    const xColumn = chartConfig.xAxis?.column ?? columns[0]?.name ?? ''

    const dashboardChart: DashboardChartConfig = {
      id: generateTimestampId('chart'),
      sourceId,
      chartConfig: { ...chartConfig, title: title || `${chartConfig.chartType} chart` },
      gridPosition: { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      crossFilterEnabled: true,
      linkedFilters: xColumn ? [xColumn] : [],
      respondToFilters: columns.map((c) => c.name),
    }

    onAdd(dashboardChart)
  }

  return (
    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
      <div className="bg-[var(--color-bg-primary)] rounded-lg shadow-xl w-[900px] max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <h3 className="font-medium">Add Chart</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--color-bg-secondary)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex">
          {/* Left side: Config */}
          <div className="w-[380px] p-4 space-y-4 border-r border-[var(--color-border)]">
            {/* Title */}
            <div>
              <label className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1 block">
                Title (optional)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`${chartConfig.chartType} chart`}
                className="w-full px-3 py-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)]"
              />
            </div>

            {/* Reused Chart Config Form */}
            <ChartConfigForm columns={columns} onChange={setChartConfig} debounceMs={300} />
          </div>

          {/* Right side: Live Preview */}
          <div className="flex-1 p-4 flex flex-col">
            <label className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-2 block">
              Preview
            </label>
            <div className="flex-1 flex items-center justify-center bg-[var(--color-bg-secondary)] rounded-lg min-h-[300px]">
              {loading ? <div className="text-[var(--color-text-muted)] text-sm">Loading preview...</div> : null}
              {error ? <div className="text-red-500 text-sm">{error}</div> : null}
              {!loading && !error && data && (
                <ChartRenderer
                  chartType={chartConfig.chartType}
                  data={data}
                  config={chartConfig}
                  width={PREVIEW_SIZE.width}
                  height={PREVIEW_SIZE.height}
                />
              )}
              {!loading && !error && !data && (
                <div className="text-[var(--color-text-muted)] text-sm">Configure chart to see preview</div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[var(--color-border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-sm rounded bg-[var(--color-accent)] text-white hover:opacity-90"
          >
            Add Chart
          </button>
        </div>
      </div>
    </div>
  )
}

// Edit Chart Dialog - similar to Add but pre-populated
interface EditChartDialogProps {
  chart: DashboardChartConfig
  tableName: string
  columns: Column[]
  onSave: (chart: DashboardChartConfig) => void
  onClose: () => void
}

function EditChartDialog({ chart, tableName, columns, onSave, onClose }: EditChartDialogProps) {
  const { client } = useDuckDB()
  const [chartConfig, setChartConfig] = useState<ChartConfig>(chart.chartConfig)
  const [title, setTitle] = useState(chart.chartConfig.title || '')

  // Live preview data
  const { data, loading, error } = useChartData(client, tableName, chartConfig, 'edit-preview')

  const handleSubmit = () => {
    const xColumn = chartConfig.xAxis?.column ?? columns[0]?.name ?? ''

    const updatedChart: DashboardChartConfig = {
      ...chart,
      chartConfig: { ...chartConfig, title: title || `${chartConfig.chartType} chart` },
      linkedFilters: xColumn ? [xColumn] : [],
      respondToFilters: columns.map((c) => c.name),
    }

    onSave(updatedChart)
  }

  return (
    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
      <div className="bg-[var(--color-bg-primary)] rounded-lg shadow-xl w-[900px] max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <h3 className="font-medium">Edit Chart</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--color-bg-secondary)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex">
          {/* Left side: Config */}
          <div className="w-[380px] p-4 space-y-4 border-r border-[var(--color-border)]">
            {/* Title */}
            <div>
              <label className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1 block">
                Title (optional)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`${chartConfig.chartType} chart`}
                className="w-full px-3 py-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)]"
              />
            </div>

            {/* Reused Chart Config Form - with initial config */}
            <ChartConfigForm
              columns={columns}
              initialConfig={chart.chartConfig}
              onChange={setChartConfig}
              debounceMs={300}
            />
          </div>

          {/* Right side: Live Preview */}
          <div className="flex-1 p-4 flex flex-col">
            <label className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-2 block">
              Preview
            </label>
            <div className="flex-1 flex items-center justify-center bg-[var(--color-bg-secondary)] rounded-lg min-h-[300px]">
              {loading ? <div className="text-[var(--color-text-muted)] text-sm">Loading preview...</div> : null}
              {error ? <div className="text-red-500 text-sm">{error}</div> : null}
              {!loading && !error && data && (
                <ChartRenderer
                  chartType={chartConfig.chartType}
                  data={data}
                  config={chartConfig}
                  width={PREVIEW_SIZE.width}
                  height={PREVIEW_SIZE.height}
                />
              )}
              {!loading && !error && !data && (
                <div className="text-[var(--color-text-muted)] text-sm">Configure chart to see preview</div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[var(--color-border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-sm rounded bg-[var(--color-accent)] text-white hover:opacity-90"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}

// Layout selector for changing grid columns
interface LayoutSelectorProps {
  currentColumns: number
  onChange: (columns: number) => void
}

function LayoutSelector({ currentColumns, onChange }: LayoutSelectorProps) {
  const layouts = [
    { cols: 2, icon: Grid2X2, label: '2 columns' },
    { cols: 3, icon: Grid3X3, label: '3 columns' },
    { cols: 4, icon: LayoutGrid, label: '4 columns' },
  ]

  return (
    <div className="flex items-center gap-1 bg-[var(--color-bg-tertiary)] rounded p-0.5">
      {layouts.map(({ cols, icon: Icon, label }) => (
        <button
          key={cols}
          onClick={() => onChange(cols)}
          className={`p-1.5 rounded transition-colors ${
            currentColumns === cols
              ? 'bg-[var(--color-bg-primary)] text-[var(--color-accent)] shadow-sm'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
          }`}
          title={label}
        >
          <Icon className="w-4 h-4" />
        </button>
      ))}
    </div>
  )
}

// Chart grid with drag-and-drop
interface ChartGridProps {
  charts: DashboardChartConfig[]
  dashboardId: string
  layout: DashboardNodeType['config']['layout']
  dataVersion: number
  onEditChart: (chart: DashboardChartConfig) => void
  onDeleteChart: (chartId: string) => void
}

function ChartGrid({ charts, dashboardId, layout, dataVersion, onEditChart, onDeleteChart }: ChartGridProps) {
  const chartIds = charts.map((c) => c.id)

  return (
    <SortableContext items={chartIds} strategy={rectSortingStrategy}>
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${layout.gridColumns}, 1fr)`,
        }}
      >
        {charts.map((chartConfig) => (
          <SortableChartWrapper
            key={chartConfig.id}
            chartConfig={chartConfig}
            dashboardId={dashboardId}
            dataVersion={dataVersion}
            onEdit={() => onEditChart(chartConfig)}
            onDelete={() => onDeleteChart(chartConfig.id)}
          />
        ))}
      </div>
    </SortableContext>
  )
}

// Sortable wrapper for drag-and-drop
interface SortableChartWrapperProps {
  chartConfig: DashboardChartConfig
  dashboardId: string
  dataVersion: number
  onEdit: () => void
  onDelete: () => void
}

function SortableChartWrapper({ chartConfig, dashboardId, dataVersion, onEdit, onDelete }: SortableChartWrapperProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: chartConfig.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    gridColumn: `span ${chartConfig.gridPosition.colSpan}`,
    gridRow: `span ${chartConfig.gridPosition.rowSpan}`,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <DashboardChart
        chartConfig={chartConfig}
        dashboardId={dashboardId}
        dataVersion={dataVersion}
        onEdit={onEdit}
        onDelete={onDelete}
        dragListeners={listeners}
      />
    </div>
  )
}

// Drill breadcrumb navigation
interface DrillBreadcrumbProps {
  drillState: DrillState
  onNavigate: (level: number) => void
}

function DrillBreadcrumb({ drillState, onNavigate }: DrillBreadcrumbProps) {
  const { hierarchy, currentLevel, filters } = drillState

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[var(--color-bg-tertiary)] border-b border-[var(--color-border)]">
      <button
        onClick={() => onNavigate(0)}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]"
        title="Reset to top level"
      >
        <Home className="w-3 h-3" />
      </button>
      {filters.map((filter, idx) => (
        <div key={idx} className="flex items-center">
          <ChevronRight className="w-3 h-3 text-[var(--color-text-muted)]" />
          <button
            onClick={() => onNavigate(idx + 1)}
            className={`px-1.5 py-0.5 rounded hover:bg-[var(--color-bg-secondary)] ${idx === currentLevel - 1 ? 'font-medium text-[var(--color-accent)]' : 'text-[var(--color-text-secondary)]'}`}
          >
            {String(filter.value)}
          </button>
        </div>
      ))}
      {currentLevel < hierarchy.length && (
        <span className="text-[var(--color-text-muted)] ml-1">({hierarchy[currentLevel].label})</span>
      )}
    </div>
  )
}

// Individual dashboard chart
interface DashboardChartProps {
  chartConfig: DashboardChartConfig
  dashboardId: string
  dataVersion: number
  onEdit?: () => void
  onDelete?: () => void
  dragListeners?: Record<string, unknown>
}

function DashboardChart({
  chartConfig,
  dashboardId,
  dataVersion,
  onEdit,
  onDelete,
  dragListeners,
}: DashboardChartProps) {
  const { client } = useDuckDB()
  const runtimeById = usePipelineRuntimeStore((s) => s.nodes)
  const activeFilters = useDashboardStore((s) => s.activeFilters)
  const drillStates = useDashboardStore((s) => s.drillStates)
  const setFilter = useDashboardStore((s) => s.setFilter)
  const initDrill = useDashboardStore((s) => s.initDrill)
  const drillDown = useDashboardStore((s) => s.drillDown)
  const drillToLevel = useDashboardStore((s) => s.drillToLevel)
  const containerRef = useRef<HTMLDivElement>(null)
  const [chartSize, setChartSize] = useState({ width: 400, height: MIN_CHART_HEIGHT })

  // Observe container size for responsive charts
  useEffect(() => {
    if (!containerRef.current) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          setChartSize({ width: Math.floor(width), height: Math.floor(height) })
        }
      }
    })

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Get the source node for this chart
  const tableName = runtimeById[chartConfig.sourceId]?.tableName

  // Initialize drill state if chart has hierarchy
  const hasDrillHierarchy = chartConfig.drillHierarchy && chartConfig.drillHierarchy.length > 0
  const drillState = drillStates[chartConfig.id]

  useEffect(() => {
    if (hasDrillHierarchy && !drillState) {
      initDrill(chartConfig.id, chartConfig.drillHierarchy!)
    }
  }, [hasDrillHierarchy, drillState, chartConfig.id, chartConfig.drillHierarchy, initDrill])

  // Compute the effective chart config based on drill state
  const effectiveConfig = useMemo(() => {
    if (!hasDrillHierarchy || !drillState) return chartConfig.chartConfig

    const currentColumn = drillState.hierarchy[drillState.currentLevel]?.column
    if (!currentColumn) return chartConfig.chartConfig

    // Modify chart config to use current drill level column
    return {
      ...chartConfig.chartConfig,
      xAxis: { ...chartConfig.chartConfig.xAxis, column: currentColumn },
      groupBy: [currentColumn],
    } as ChartConfig
  }, [chartConfig.chartConfig, hasDrillHierarchy, drillState])

  // Convert drill filters to DashboardFilter format
  const drillFilters: DashboardFilter[] = useMemo(() => {
    if (!drillState) return []
    return drillState.filters.map((f, idx) => ({
      id: `drill-${chartConfig.id}-${idx}`,
      column: f.column,
      operator: 'eq' as const,
      value: f.value,
      source: 'drill' as const,
      sourceChartId: chartConfig.id,
      sourceId: chartConfig.sourceId,
    }))
  }, [drillState, chartConfig.id, chartConfig.sourceId])

  // Compute applicable filters for this chart (cross-filters + drill filters)
  const dashboardFilters = activeFilters[dashboardId] || []
  const crossFilters = dashboardFilters.filter((f) => {
    if (f.source === 'chart' && f.sourceChartId === chartConfig.id) return false
    if (!chartConfig.respondToFilters.includes(f.column)) return false
    if (f.sourceId && f.sourceId !== chartConfig.sourceId) return false
    return true
  })
  const applicableFilters = [...crossFilters, ...drillFilters]

  // Build chart data with filters applied
  const { data, loading, error } = useChartData(
    client,
    tableName,
    effectiveConfig,
    String(dataVersion),
    applicableFilters
  )

  // Handle chart click - either drill-down or cross-filter
  const handleChartClick = useCallback(
    (params: { name?: string; value?: unknown; data?: { label?: string; name?: string } }) => {
      const clickedValue = params.name || params.data?.label || params.data?.name
      if (!clickedValue) return

      // If drill is enabled and not at last level, drill down
      if (hasDrillHierarchy && drillState && drillState.currentLevel < drillState.hierarchy.length - 1) {
        drillDown(chartConfig.id, clickedValue)
        return
      }

      // Otherwise, apply cross-filter if enabled
      if (!chartConfig.crossFilterEnabled) return

      const column = effectiveConfig.xAxis?.column
      if (!column || !chartConfig.linkedFilters.includes(column)) return

      const filter: DashboardFilter = {
        id: `${chartConfig.id}-${column}`,
        column,
        operator: 'eq',
        value: clickedValue,
        source: 'chart',
        sourceChartId: chartConfig.id,
        sourceId: chartConfig.sourceId,
      }

      setFilter(dashboardId, filter)
    },
    [chartConfig, dashboardId, setFilter, hasDrillHierarchy, drillState, drillDown, effectiveConfig]
  )

  const handleDrillNavigate = useCallback(
    (level: number) => {
      drillToLevel(chartConfig.id, level)
    },
    [chartConfig.id, drillToLevel]
  )

  const chartType = effectiveConfig.chartType

  return (
    <div className="group bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] overflow-hidden flex flex-col min-h-[320px]">
      {/* Chart header with drag handle and actions */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
        {/* Drag handle */}
        <button
          className="p-1 -ml-1 cursor-grab active:cursor-grabbing text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] opacity-0 group-hover:opacity-100 transition-opacity"
          {...dragListeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>

        <h3 className="text-sm font-medium truncate flex-1">{chartConfig.chartConfig.title || 'Chart'}</h3>

        {/* Edit and delete buttons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-1 rounded hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              title="Edit chart"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="p-1 rounded hover:bg-red-500/10 text-[var(--color-text-muted)] hover:text-red-500"
              title="Delete chart"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Drill breadcrumb - only show if drilled into */}
      {drillState && drillState.currentLevel > 0 && (
        <DrillBreadcrumb drillState={drillState} onNavigate={handleDrillNavigate} />
      )}

      {/* Chart content - flex-1 to fill remaining space */}
      <div ref={containerRef} className="p-2 flex-1 min-h-0">
        {loading && (
          <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">Loading...</div>
        )}
        {error ? <div className="flex items-center justify-center h-full text-red-500 text-sm">{error}</div> : null}
        {!loading && !error && data && (
          <ChartRenderer
            chartType={chartType}
            data={data}
            config={effectiveConfig}
            onChartClick={handleChartClick}
            width={chartSize.width}
            height={chartSize.height}
          />
        )}
        {!loading && !error && !data && (
          <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">No data</div>
        )}
      </div>
    </div>
  )
}

// Chart renderer component
interface ChartRendererProps {
  chartType: ChartType
  data: unknown
  config: ChartConfig
  onChartClick?: (event: ChartClickEvent) => void
  width?: number
  height?: number
}

function ChartRenderer({ chartType, data, config, onChartClick, width, height }: ChartRendererProps) {
  const size = { width: width ?? 400, height: height ?? MIN_CHART_HEIGHT }
  const xLabel = config.xAxis?.label ?? config.xAxis?.column ?? 'X'
  const yLabel = Array.isArray(config.yAxis)
    ? (config.yAxis[0]?.label ?? config.yAxis[0]?.column ?? 'Value')
    : (config.yAxis?.label ?? config.yAxis?.column ?? 'Value')

  switch (chartType) {
    case 'scatter':
      return (
        <ScatterChartComponent
          data={data as Array<{ x: number | string; y: number | string; size?: number; color?: number | string }>}
          xLabel={xLabel}
          yLabel={yLabel}
          sizeColumn={config.sizeBy}
          colorColumn={config.colorBy}
          onClick={onChartClick}
          {...size}
        />
      )

    case 'stackedBar':
      return (
        <StackedBarChart
          data={data as Array<{ category: string; series: string; value: number }>}
          categoryLabel={xLabel}
          valueLabel={yLabel}
          onClick={onChartClick}
          {...size}
        />
      )

    case 'stackedArea':
      return (
        <StackedAreaChart
          data={data as Array<{ x: string | number; series: string; value: number }>}
          xLabel={xLabel}
          yLabel={yLabel}
          onClick={onChartClick}
          {...size}
        />
      )

    case 'heatmap':
      return (
        <HeatmapChart
          data={data as Array<{ x: string | number; y: string | number; value: number }>}
          xLabel={xLabel}
          yLabel={yLabel}
          onClick={onChartClick}
          {...size}
        />
      )

    case 'treemap':
      return (
        <TreemapChart
          data={data as Array<{ name: string; value: number; children?: Array<{ name: string; value: number }> }>}
          valueLabel={yLabel}
          onClick={onChartClick}
          {...size}
        />
      )

    case 'kpi':
      return (
        <KPICard value={(data as { value: number; count: number }).value} label={config.title ?? yLabel} {...size} />
      )

    case 'gauge':
      return (
        <GaugeChart value={(data as { value: number; count: number }).value} label={config.title ?? yLabel} {...size} />
      )

    case 'funnel':
      return (
        <FunnelChart
          data={(data as Array<{ label: string; value: number }>).map((d) => ({ name: d.label, value: d.value }))}
          {...size}
        />
      )

    case 'combo':
      return (
        <ComboChart
          data={data as Array<{ category: string; barValue: number; lineValue: number }>}
          barLabel={yLabel}
          lineLabel="Trend"
          xLabel={xLabel}
          {...size}
        />
      )

    case 'pie':
      return (
        <PieChart
          data={(data as Array<{ label: string; value: number }>).map((d) => ({ label: d.label, count: d.value }))}
          totalCount={(data as Array<{ label: string; value: number }>).reduce((sum, d) => sum + d.value, 0)}
          onClick={onChartClick}
          {...size}
        />
      )

    case 'line':
      return (
        <LineChartComponent
          data={(data as Array<{ label: string; value: number }>).map((d) => ({ date: d.label, count: d.value }))}
          totalCount={(data as Array<{ label: string; value: number }>).reduce((sum, d) => sum + d.value, 0)}
          onClick={onChartClick}
          {...size}
        />
      )

    default:
      return (
        <BarChart
          data={(data as Array<{ label: string; value: number }>).map((d) => ({ value: d.label, count: d.value }))}
          totalCount={(data as Array<{ label: string; value: number }>).reduce((sum, d) => sum + d.value, 0)}
          columnType="string"
          horizontal
          onClick={onChartClick}
          {...size}
        />
      )
  }
}
