import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import BarChart2 from 'lucide-react/dist/esm/icons/bar-chart-2'
import Braces from 'lucide-react/dist/esm/icons/braces'
import Copy from 'lucide-react/dist/esm/icons/copy'
import FileSpreadsheet from 'lucide-react/dist/esm/icons/file-spreadsheet'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import LayoutDashboard from 'lucide-react/dist/esm/icons/layout-dashboard'
import Package from 'lucide-react/dist/esm/icons/package'
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw'
import { useCallback } from 'react'
import { isSessionFile, pickedFileToFile, pickFiles } from '@/lib/file-system'
import { generateTimestampId } from '@/lib/id'
import { usePipeline } from '@/lib/pipeline'
import { useHydratedNodes } from '@/lib/pipeline/hooks/useHydratedNodes'
import { useDialogStore } from '@/stores/dialogStore'
import { type ContextMenuState, usePanelStore } from '@/stores/panelStore'
import { usePipelineStore } from '@/stores/pipelineStore'
import type { DashboardNode, ExportConfig, ExportFormat } from '@/types'
import { isTerminalNode } from '@/types'

interface NodeContextMenuProps {
  menu: ContextMenuState
  onClose: () => void
  onDelete: () => void
  onPreview: () => void
}

const EXPORT_FORMATS: Array<{ format: ExportFormat; label: string; icon: typeof FileText; description: string }> = [
  { format: 'csv', label: 'CSV', icon: FileText, description: 'Comma-separated values' },
  { format: 'json', label: 'JSON', icon: Braces, description: 'JSON array' },
  { format: 'jsonl', label: 'JSONL', icon: Braces, description: 'JSON Lines (one object per line)' },
  { format: 'parquet', label: 'Parquet', icon: Package, description: 'Columnar format, best for large data' },
  { format: 'xlsx', label: 'Excel', icon: FileSpreadsheet, description: 'Microsoft Excel format' },
]

const itemClass = 'menu-item w-full text-left'

export function NodeContextMenu({ menu, onClose, onDelete, onPreview }: NodeContextMenuProps) {
  const nodes = useHydratedNodes()
  const getNodeChildren = usePipelineStore((s) => s.getNodeChildren)
  const duplicateBranch = usePipelineStore((s) => s.duplicateBranch)
  const addDashboardNode = usePipelineStore((s) => s.addDashboardNode)
  const openChartPanel = usePanelStore((s) => s.openChartPanel)
  const openDialog = useDialogStore((s) => s.openDialog)
  const { createExport, replaceDataset, setError } = usePipeline()
  const hasChildren = getNodeChildren(menu.nodeId).length > 0

  const handleDuplicate = useCallback(() => {
    duplicateBranch(menu.nodeId)
    onClose()
  }, [menu.nodeId, duplicateBranch, onClose])

  const node = nodes[menu.nodeId]
  const canAddTerminalNodes = node && !isTerminalNode(node)
  const isDataset = node?.type === 'dataset'

  const handleReplaceFile = useCallback(async () => {
    const pickedFiles = await pickFiles()
    if (!pickedFiles.length) {
      onClose()
      return
    }

    const picked = pickedFiles[0]
    // Don't allow replacing with session files
    if (isSessionFile(picked)) {
      onClose()
      return
    }

    // Convert to File for schema validation and hash computation
    const file = await pickedFileToFile(picked)
    const result = await replaceDataset(menu.nodeId, file)
    if (!result.success && result.error) {
      setError(result.error)
    }
    onClose()
  }, [menu.nodeId, replaceDataset, onClose, setError])

  const handleCreateChart = useCallback(() => {
    // Open chart popover near the context menu position
    openChartPanel(menu.nodeId, undefined, { x: menu.x + 200, y: menu.y })
    onClose()
  }, [menu.nodeId, menu.x, menu.y, openChartPanel, onClose])

  const handleCreateDashboard = useCallback(() => {
    const sourceNode = nodes[menu.nodeId]
    if (!sourceNode) return

    const dashboardId = generateTimestampId('dashboard')

    const dashboard: DashboardNode = {
      id: dashboardId,
      type: 'dashboard',
      name: `${sourceNode.name} Dashboard`,
      chartRefs: [],
      createdAt: new Date(),
      config: {
        title: `${sourceNode.name} Dashboard`,
        layout: { preset: '2x2', gridColumns: 2, gridRows: 2, gap: 16 },
        globalFilters: [],
        embeddedCharts: [],
        columnMappings: [],
      },
    }

    const sourcePosition = sourceNode.position ?? { x: 100, y: 100 }
    addDashboardNode(dashboard, [menu.nodeId], {
      position: {
        x: sourcePosition.x + 300,
        y: sourcePosition.y,
      },
      isExpanded: true,
    })

    // Open the dashboard view
    openDialog({ type: 'dashboardView', nodeId: dashboardId })
    onClose()
  }, [menu.nodeId, nodes, addDashboardNode, openDialog, onClose])

  const handleCreateExport = useCallback(
    async (format: ExportFormat) => {
      const config: ExportConfig = {
        format,
        filename: node?.name.replace(/[^a-zA-Z0-9]/g, '_') ?? 'export',
      }
      await createExport(menu.nodeId, config)
      onClose()
    },
    [menu.nodeId, node?.name, createExport, onClose]
  )

  return (
    <DropdownMenu.Root open onOpenChange={(open) => !open && onClose()}>
      <DropdownMenu.Trigger asChild>
        <div
          style={{
            position: 'fixed',
            left: menu.x,
            top: menu.y,
            width: 0,
            height: 0,
          }}
        />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" sideOffset={0} className="popover-content py-1 min-w-44">
          <DropdownMenu.Item onSelect={onPreview} className={itemClass}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
            <span>View data</span>
          </DropdownMenu.Item>

          <DropdownMenu.Item
            onSelect={handleDuplicate}
            className={itemClass}
            title="Duplicate this node and all descendants"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Duplicate branch</span>
          </DropdownMenu.Item>

          {isDataset && (
            <DropdownMenu.Item
              onSelect={handleReplaceFile}
              className={itemClass}
              title="Replace with a compatible file"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Replace file...</span>
            </DropdownMenu.Item>
          )}

          {canAddTerminalNodes && (
            <>
              <DropdownMenu.Separator className="h-px bg-[var(--color-border)] my-1" />

              <DropdownMenu.Item onSelect={handleCreateChart} className={itemClass}>
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Create Chart</span>
              </DropdownMenu.Item>

              <DropdownMenu.Item onSelect={handleCreateDashboard} className={itemClass}>
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Create Dashboard</span>
              </DropdownMenu.Item>

              <DropdownMenu.Label className="px-3 py-1 text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
                Export
              </DropdownMenu.Label>
              {EXPORT_FORMATS.map(({ format, label, icon: Icon, description }) => (
                <DropdownMenu.Item
                  key={format}
                  onSelect={() => handleCreateExport(format)}
                  className={itemClass}
                  title={description}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </DropdownMenu.Item>
              ))}
            </>
          )}

          <DropdownMenu.Separator className="h-px bg-[var(--color-border)] my-1" />

          <DropdownMenu.Item
            onSelect={onDelete}
            className="w-full px-3 py-1.5 text-xs text-left outline-none hover:bg-red-500/10 focus:bg-red-500/10 text-red-500 flex items-center gap-2 cursor-default"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            <span>{hasChildren ? 'Delete (cascade)...' : 'Delete'}</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
