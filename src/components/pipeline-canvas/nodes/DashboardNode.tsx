import { Expand, LayoutDashboard, Settings } from 'lucide-react'
import { memo, useCallback } from 'react'
import { useDuckDB } from '@/lib/duckdb'
import { useDashboardStore, useDialogStore, usePipelineStore } from '@/stores'
import type { DashboardNode as DashboardNodeType } from '@/types'
import { MiniChartPreview } from './MiniChartPreview'
import { NodeActionButton, NodeHeader, NodeShell } from './shared'

interface DashboardNodeData {
  dashboard: DashboardNodeType
  isActive: boolean
  isSelected: boolean
  isPending?: boolean
  [key: string]: unknown
}

export const DashboardNode = memo(function DashboardNode({ data }: { data: DashboardNodeData }) {
  const { dashboard, isActive, isSelected, isPending } = data
  const { nodes } = usePipelineStore()
  const { activeFilters, expandDashboard } = useDashboardStore()
  const { openDialog } = useDialogStore()
  const { client } = useDuckDB()

  const config = dashboard.config
  const embeddedCharts = config.embeddedCharts
  const chartRefs = dashboard.chartRefs

  // Count total charts (embedded + referenced)
  const totalCharts = embeddedCharts.length + chartRefs.length

  // Count active filters for this dashboard
  const dashboardFilters = activeFilters[dashboard.id] || []
  const activeFilterCount = dashboardFilters.length

  // Get parent names for display
  const parentNames = dashboard.parentIds
    .map((id) => nodes[id]?.name)
    .filter(Boolean)
    .slice(0, 2)

  const handleExpand = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      expandDashboard(dashboard.id)
      openDialog({ type: 'dashboardView', nodeId: dashboard.id })
    },
    [dashboard.id, expandDashboard, openDialog]
  )

  const handleConfigure = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      openDialog({ type: 'dashboardConfig', nodeId: dashboard.id })
    },
    [dashboard.id, openDialog]
  )

  const handleDoubleClick = useCallback(() => {
    expandDashboard(dashboard.id)
    openDialog({ type: 'dashboardView', nodeId: dashboard.id })
  }, [dashboard.id, expandDashboard, openDialog])

  // Build subtitle
  const subtitle =
    parentNames.length > 0
      ? `Sources: ${parentNames.join(', ')}${dashboard.parentIds.length > 2 ? ` +${dashboard.parentIds.length - 2}` : ''}`
      : 'No sources'

  // Actions for the header
  const actions = (
    <>
      <NodeActionButton icon={Settings} onClick={handleConfigure} title="Configure dashboard" />
      <NodeActionButton icon={Expand} onClick={handleExpand} title="Expand dashboard" />
    </>
  )

  return (
    <div onDoubleClick={handleDoubleClick} className="w-full h-full">
      <NodeShell
        isActive={isActive}
        isSelected={isSelected}
        isPending={isPending}
        hasSourceHandle={false}
        hasTargetHandle={true}
        isResizable={true}
        minWidth={280}
        minHeight={200}
        maxWidth={600}
        maxHeight={500}
      >
        <NodeHeader
          icon={LayoutDashboard}
          badge="Dashboard"
          badgeColor="purple"
          name={config.title || dashboard.name}
          subtitle={subtitle}
          actions={actions}
          nameMaxWidth="max-w-[160px]"
        />

        {/* Flexible content area that grows with node */}
        <div className="flex-1 flex flex-col min-h-0 px-3 py-2">
          {/* Stats row */}
          <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-muted)] mb-1">
            <span>
              {totalCharts} chart{totalCharts !== 1 ? 's' : ''}
            </span>
            {activeFilterCount > 0 && (
              <>
                <span>•</span>
                <span className="text-[var(--color-accent)]">
                  {activeFilterCount} active filter{activeFilterCount !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>

          {/* Mini chart grid preview - grows to fill space */}
          {totalCharts > 0 ? (
            <div className="flex-1 grid grid-cols-2 gap-1 min-h-0">
              {embeddedCharts.slice(0, 4).map((chart) => {
                const sourceNode = nodes[chart.sourceId]
                return (
                  <div key={chart.id} className="min-h-[60px]">
                    <MiniChartPreview chart={chart} tableName={sourceNode?.tableName} client={client} />
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[var(--color-text-muted)] text-xs">
              No charts yet
            </div>
          )}

          {totalCharts > 4 && (
            <div className="text-[10px] text-right text-[var(--color-text-muted)] mt-1">+{totalCharts - 4} more</div>
          )}
        </div>
      </NodeShell>
    </div>
  )
})
