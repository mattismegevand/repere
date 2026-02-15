import Eye from 'lucide-react/dist/esm/icons/eye'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import Pencil from 'lucide-react/dist/esm/icons/pencil'
import { memo, useCallback } from 'react'
import { PythonIcon } from '@/components/icons/PythonIcon'
import { useNodePreview } from '@/lib/duckdb/useNodePreview'
import type { HydratedNode } from '@/lib/pipeline/hydration'
import { usePanelStore } from '@/stores/panelStore'
import { usePipelineStore } from '@/stores/pipelineStore'
import { ExpandablePreview, NodeActionButton, NodeContent, NodeHeader, NodeShell } from './shared'

type HydratedPython = Extract<HydratedNode, { type: 'python' }>

interface PythonNodeData {
  python: HydratedPython
  isActive: boolean
  isSelected: boolean
  isPending?: boolean
  [key: string]: unknown
}

export const PythonNode = memo(function PythonNode({ data, selected }: { data: PythonNodeData; selected?: boolean }) {
  const { python, isActive, isSelected, isPending } = data
  const isNodeSelected = isSelected || selected
  const openPythonPanelForNode = usePanelStore((s) => s.openPythonPanelForNode)
  const toggleNodeExpanded = usePipelineStore((s) => s.toggleNodeExpanded)

  const isExpanded = !!python.isExpanded && !isPending
  const canExpand = !isPending && python.rowCount !== 0

  const preview = useNodePreview(python.tableName ?? '', isExpanded && !!python.tableName)

  const handleEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      openPythonPanelForNode(python.id)
    },
    [python.id, openPythonPanelForNode]
  )

  const handleToggleExpand = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      toggleNodeExpanded(python.id)
    },
    [python.id, toggleNodeExpanded]
  )

  const handleDragStart = (e: React.DragEvent) => {
    if (!python.tableName) return
    e.dataTransfer.setData('text/plain', python.tableName)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const formatCount = (n: number | null | undefined) => (typeof n === 'number' ? n.toLocaleString() : '...')

  const formatTime = (ms: number | undefined) => {
    if (ms === undefined) return null
    if (ms < 1000) return `${ms.toFixed(0)}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const executionTime = formatTime(python.executionTimeMs)

  return (
    <NodeShell
      isActive={isActive}
      isSelected={isNodeSelected}
      isPending={isPending ?? false}
      hasSourceHandle={true}
      hasTargetHandle={true}
      isExpanded={isExpanded}
    >
      <NodeHeader
        icon={PythonIcon}
        badge="Python"
        badgeColor="amber"
        name={python.name}
        subtitle={executionTime ? `ran in ${executionTime}` : undefined}
        actions={
          <>
            <NodeActionButton icon={Pencil} onClick={handleEdit} title="Edit Python code" />
            {canExpand && (
              <NodeActionButton
                icon={isExpanded ? EyeOff : Eye}
                onClick={handleToggleExpand}
                title={isExpanded ? 'Hide preview' : 'Show preview'}
                ariaExpanded={isExpanded}
                alwaysVisible={isExpanded}
              />
            )}
          </>
        }
      />

      {/* Matplotlib preview thumbnail */}
      {python.matplotlibOutput && (
        <div className="px-3 py-2 border-b border-[var(--color-border)]">
          <img
            src={`data:image/png;base64,${python.matplotlibOutput}`}
            alt="Matplotlib output"
            className="w-full max-h-[80px] object-contain rounded border border-[var(--color-border)] bg-white"
          />
        </div>
      )}

      <NodeContent>
        <div className="text-[var(--color-text-secondary)]">
          {formatCount(python.rowCount)} rows · {python.columns?.length ?? 0} cols
        </div>
        {python.tableName && (
          <div
            draggable
            onDragStart={handleDragStart}
            className="nodrag font-mono text-[10px] truncate text-[var(--color-text-muted)] cursor-grab hover:text-[var(--color-accent)] active:cursor-grabbing"
            title={`${python.tableName} (drag to SQL editor)`}
          >
            {python.tableName}
          </div>
        )}
      </NodeContent>

      <ExpandablePreview
        nodeId={python.id}
        isExpanded={isExpanded}
        rows={preview.rows}
        columns={preview.columns}
        loading={preview.loading}
        error={preview.error}
      />
    </NodeShell>
  )
})
