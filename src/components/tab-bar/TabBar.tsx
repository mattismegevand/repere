import { useCallback, useMemo } from 'react'
import { getOperationSummary, getOperationUiMeta } from '@/lib/operations/registry'
import { usePipelineStore } from '@/stores'
import type { ChartNode, Dataset, DataView, ExportNode, PipelineNode, PythonNode } from '@/types'

function getParentId(node: PipelineNode): string | undefined {
  if (node.type === 'dataset') return undefined
  if (node.type === 'chart') return (node as ChartNode).parentId
  if (node.type === 'export') return (node as ExportNode).parentId
  if (node.type === 'python') return (node as PythonNode).parentId
  if (node.type === 'dashboard') return undefined // Dashboard can have multiple parents
  return (node as DataView).parentIds[0]
}

function getRootDatasetName(node: PipelineNode, nodes: Record<string, PipelineNode>): string {
  if (node.type === 'dataset') {
    return (node as Dataset).fileName.replace(/\.[^.]+$/, '')
  }

  const parentId = getParentId(node)
  const parent = parentId ? nodes[parentId] : undefined
  if (parent) {
    return getRootDatasetName(parent, nodes)
  }
  return 'unknown'
}

function getOperationLabel(node: PipelineNode): string | null {
  if (node.type !== 'view') return null
  const view = node as DataView
  const uiMeta = getOperationUiMeta(view.operation.type)
  return uiMeta.label
}

function truncateSummary(summary: string, maxLength = 20): string {
  if (summary.length <= maxLength) return summary
  return `${summary.slice(0, maxLength - 1)}…`
}

function buildTabLabels(openNodeIds: string[], nodes: Record<string, PipelineNode>): Map<string, string> {
  const results = new Map<string, string>()

  // Build initial labels: "filename" for datasets, "filename [Operation]" for views
  const initialLabels: { nodeId: string; base: string; opLabel: string | null; summary: string }[] = []
  for (const nodeId of openNodeIds) {
    const node = nodes[nodeId]
    if (!node) continue

    const base = getRootDatasetName(node, nodes)
    const opLabel = getOperationLabel(node)
    const summary = node.type === 'view' ? truncateSummary(getOperationSummary((node as DataView).operation)) : ''

    initialLabels.push({ nodeId, base, opLabel, summary })
  }

  // Count occurrences of "base [opLabel]" to detect collisions
  const labelCounts = new Map<string, number>()
  for (const item of initialLabels) {
    const key = item.opLabel ? `${item.base} [${item.opLabel}]` : item.base
    labelCounts.set(key, (labelCounts.get(key) || 0) + 1)
  }

  // Assign final labels
  const usedCounts = new Map<string, number>()
  for (const { nodeId, base, opLabel, summary } of initialLabels) {
    const key = opLabel ? `${base} [${opLabel}]` : base
    const count = labelCounts.get(key) || 0

    let finalLabel: string
    if (!opLabel) {
      // Dataset: just the filename
      if (count > 1) {
        const used = usedCounts.get(key) || 0
        finalLabel = used > 0 ? `${base} (${used + 1})` : base
        usedCounts.set(key, used + 1)
      } else {
        finalLabel = base
      }
    } else if (count > 1 && summary) {
      // Multiple views with same operation type - disambiguate with summary
      finalLabel = `${base} [${opLabel}]: ${summary}`
    } else {
      // Single view with this operation type
      finalLabel = `${base} [${opLabel}]`
    }

    results.set(nodeId, finalLabel)
  }

  return results
}

export function TabBar() {
  const { nodes, openNodeIds, activeNodeId, setActiveNode, closeTab } = usePipelineStore()

  const tabLabels = useMemo(() => buildTabLabels(openNodeIds, nodes), [openNodeIds, nodes])

  const handleDragStart = useCallback((e: React.DragEvent, tableName: string) => {
    e.dataTransfer.setData('text/plain', tableName)
    e.dataTransfer.effectAllowed = 'copy'
  }, [])

  return (
    <div className="flex items-center gap-1 px-1.5 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] overflow-x-auto h-[28px]">
      {openNodeIds.map((nodeId) => {
        const node = nodes[nodeId]
        if (!node) return null

        const isActive = nodeId === activeNodeId
        const label = tabLabels.get(nodeId) || node.name

        return (
          <div
            key={nodeId}
            draggable
            onDragStart={(e) => node.tableName && handleDragStart(e, node.tableName)}
            className={`
              flex items-center gap-1.5 px-2.5 py-1 cursor-grab
              select-none shrink-0 rounded-md text-[11px] transition-colors
              ${
                isActive
                  ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] shadow-sm border border-[var(--color-border-light)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-transparent'
              }
            `}
            onClick={() => setActiveNode(nodeId)}
            title={node.tableName ? `${node.tableName} (drag to SQL editor)` : undefined}
          >
            <span className="max-w-[140px] truncate font-medium">{label}</span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                closeTab(nodeId)
              }}
              className="p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] rounded"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )
      })}
    </div>
  )
}
