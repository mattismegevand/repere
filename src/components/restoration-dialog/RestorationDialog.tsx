import {
  Background,
  type ColorMode,
  Controls,
  type Edge,
  type Node,
  type NodeTypes,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react'
import { useCallback, useMemo, useState } from 'react'
import '@xyflow/react/dist/style.css'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui'
import type { SessionData } from '@/lib/pipeline/persistence'
import { usePipeline } from '@/lib/pipeline/usePipeline'
import { useThemeStore } from '@/stores'
import type { RestorationState } from '@/stores/pipelineStore'
import type { ChartNode as ChartNodeType, Dataset, DataView, ExportNode as ExportNodeType } from '@/types'
import { ChartNode } from '../pipeline-canvas/nodes/ChartNode'
import { DatasetNode } from '../pipeline-canvas/nodes/DatasetNode'
import { ExportNode } from '../pipeline-canvas/nodes/ExportNode'
import { ViewNode } from '../pipeline-canvas/nodes/ViewNode'

// Register custom node types
const nodeTypes: NodeTypes = {
  dataset: DatasetNode,
  view: ViewNode,
  chart: ChartNode,
  export: ExportNode,
}

// Props for partial recovery (needs file drops)
interface PartialRecoveryProps {
  mode: 'partial'
  restorationState: RestorationState
  onCancel: () => void
  onDiscard: () => void
  onComplete: () => void
  onSkipMissing: () => void
}

// Props for full recovery (all data embedded)
interface FullRecoveryProps {
  mode: 'full'
  session: SessionData
  onRecover: () => void
  onDiscard: () => void
}

type Props = PartialRecoveryProps | FullRecoveryProps

// Inner component that can use useReactFlow hook
function RestorationDialogInner(props: Props) {
  const { screenToFlowPosition } = useReactFlow()
  const [isDragOver, setIsDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const theme = useThemeStore((s) => s.theme)
  const { provideFileForRestoration, isRestorationReady, getRestorationProgress, skipDatasetRestoration } =
    usePipeline()

  const isPartialMode = props.mode === 'partial'
  const session = isPartialMode ? props.restorationState.session : props.session

  const progress = isPartialMode ? getRestorationProgress() : { provided: 0, required: 0 }
  const ready = isPartialMode ? isRestorationReady() : true

  // Session already contains parsed nodes and edges
  const parsedNodes = session.nodes
  const parsedEdges = session.edges

  // Check if a node is pending (recursively checks ancestors) - only for partial mode
  const isNodePending = useCallback(
    (nodeId: string, visited: Set<string> = new Set()): boolean => {
      if (!isPartialMode) return false

      // Prevent infinite loops
      if (visited.has(nodeId)) return false
      visited.add(nodeId)

      const restorationState = props.restorationState

      // Check if it's a dataset that needs a file
      const datasetInfo = restorationState.datasets.get(nodeId)
      if (datasetInfo) {
        if (datasetInfo.status !== 'embedded' && datasetInfo.status !== 'provided') {
          if (!restorationState.skippedDatasets.has(nodeId)) {
            return true
          }
        }
        return false
      }

      // It's a view/chart/export - check if any of its parents are pending
      const node = parsedNodes[nodeId]
      if (node) {
        if (node.type === 'view') {
          const view = node as DataView
          for (const parentId of view.parentIds) {
            if (isNodePending(parentId, visited)) {
              return true
            }
          }
        } else if (node.type === 'chart' || node.type === 'export') {
          const terminalNode = node as ChartNodeType | ExportNodeType
          if (isNodePending(terminalNode.parentId, visited)) {
            return true
          }
        }
      }

      return false
    },
    [isPartialMode, props, parsedNodes]
  )

  // Get pending ancestor dataset names (recursively)
  const getPendingAncestorNames = useCallback(
    (nodeId: string, visited: Set<string> = new Set()): string[] => {
      if (!isPartialMode) return []

      // Prevent infinite loops
      if (visited.has(nodeId)) return []
      visited.add(nodeId)

      const pendingNames: string[] = []
      const restorationState = props.restorationState

      // Check if it's a pending dataset
      const datasetInfo = restorationState.datasets.get(nodeId)
      if (datasetInfo) {
        if (datasetInfo.status !== 'embedded' && datasetInfo.status !== 'provided') {
          if (!restorationState.skippedDatasets.has(nodeId)) {
            pendingNames.push(datasetInfo.fileName)
          }
        }
        return pendingNames
      }

      // It's a view/chart/export - recursively get pending ancestors
      const node = parsedNodes[nodeId]
      if (node) {
        if (node.type === 'view') {
          const view = node as DataView
          for (const parentId of view.parentIds) {
            pendingNames.push(...getPendingAncestorNames(parentId, visited))
          }
        } else if (node.type === 'chart' || node.type === 'export') {
          const terminalNode = node as ChartNodeType | ExportNodeType
          pendingNames.push(...getPendingAncestorNames(terminalNode.parentId, visited))
        }
      }

      return pendingNames
    },
    [isPartialMode, props, parsedNodes]
  )

  // Check if a view is pending (waiting for ancestor datasets)
  const isViewPending = useCallback(
    (parentIds: string[]): boolean => {
      for (const parentId of parentIds) {
        if (isNodePending(parentId)) {
          return true
        }
      }
      return false
    },
    [isNodePending]
  )

  // Get pending parent names for views (recursively)
  const getPendingParentNames = useCallback(
    (parentIds: string[]): string[] => {
      const allPendingNames: string[] = []
      for (const parentId of parentIds) {
        allPendingNames.push(...getPendingAncestorNames(parentId))
      }
      // Remove duplicates
      return [...new Set(allPendingNames)]
    },
    [getPendingAncestorNames]
  )

  // Handle file drop on a dataset node
  const handleFileDrop = useCallback(
    (nodeId: string) => async (file: File) => {
      await provideFileForRestoration(nodeId, file)
    },
    [provideFileForRestoration]
  )

  // Handle skip for a dataset node
  const handleSkip = useCallback(
    (nodeId: string) => () => {
      skipDatasetRestoration(nodeId)
    },
    [skipDatasetRestoration]
  )

  // Convert session nodes to React Flow nodes
  const flowNodes: Node[] = useMemo(() => {
    return Object.values(parsedNodes).map((node) => {
      if (node.type === 'dataset') {
        const dataset = node as Dataset

        if (isPartialMode) {
          const restorationState = props.restorationState
          const datasetInfo = restorationState.datasets.get(node.id)
          const isSkipped = restorationState.skippedDatasets.has(node.id)

          return {
            id: node.id,
            type: 'dataset',
            position: node.position,
            data: {
              dataset,
              isActive: false,
              isSelected: false,
              restorationStatus: isSkipped ? undefined : datasetInfo?.status,
              isExactMatch: datasetInfo?.isExactMatch,
              onFileDrop: isSkipped ? undefined : handleFileDrop(node.id),
              onSkip: isSkipped ? undefined : handleSkip(node.id),
            },
            deletable: false,
            selectable: false,
            draggable: false,
            measured: { width: 200, height: 100 },
            style: isSkipped ? { opacity: 0.3 } : undefined,
          }
        } else {
          // Full recovery mode - no drop zones needed
          return {
            id: node.id,
            type: 'dataset',
            position: node.position,
            data: {
              dataset,
              isActive: false,
              isSelected: false,
              restorationStatus: 'embedded',
            },
            deletable: false,
            selectable: false,
            draggable: false,
            measured: { width: 200, height: 100 },
          }
        }
      } else if (node.type === 'view') {
        const view = node as DataView
        const isPending = isViewPending(view.parentIds)
        const pendingParentNames = isPending ? getPendingParentNames(view.parentIds) : undefined

        return {
          id: node.id,
          type: 'view',
          position: node.position,
          data: {
            view,
            isActive: false,
            isSelected: false,
            isPending,
            pendingParentNames,
          },
          deletable: false,
          selectable: false,
          draggable: false,
          measured: { width: 200, height: 80 },
        }
      } else if (node.type === 'chart') {
        const chart = node as ChartNodeType
        const isPending = isViewPending([chart.parentId])

        return {
          id: node.id,
          type: 'chart',
          position: node.position,
          data: {
            chart,
            isActive: false,
            isSelected: false,
            isPending,
          },
          deletable: false,
          selectable: false,
          draggable: false,
          measured: { width: 200, height: 150 },
        }
      } else {
        // export node
        const exportNode = node as ExportNodeType
        const isPending = isViewPending([exportNode.parentId])

        return {
          id: node.id,
          type: 'export',
          position: node.position,
          data: {
            export: exportNode,
            isActive: false,
            isSelected: false,
            isPending,
          },
          deletable: false,
          selectable: false,
          draggable: false,
          measured: { width: 200, height: 80 },
        }
      }
    })
  }, [parsedNodes, isPartialMode, props, handleFileDrop, handleSkip, isViewPending, getPendingParentNames])

  // Convert pipeline edges to React Flow edges
  const flowEdges: Edge[] = useMemo(() => {
    return parsedEdges.map((edge) => ({
      id: edge.id,
      source: edge.sourceId,
      target: edge.targetId,
      type: 'smoothstep',
      animated: false,
      style: { stroke: 'var(--color-border)', strokeWidth: 2 },
    }))
  }, [parsedEdges])

  // Handle skip missing - marks all required datasets as skipped
  const handleSkipMissing = () => {
    if (!isPartialMode) return
    const restorationState = props.restorationState

    for (const [nodeId, info] of restorationState.datasets) {
      if (info.status === 'required' || info.status === 'error') {
        skipDatasetRestoration(nodeId)
      }
    }
    props.onSkipMissing()
  }

  // Handle drag over the canvas
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!isPartialMode) return
      if (e.dataTransfer.types.includes('Files')) {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
        setIsDragOver(true)
      }
    },
    [isPartialMode]
  )

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  // Handle drop on the canvas - find which node was targeted
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      if (!isPartialMode) return
      e.preventDefault()
      setIsDragOver(false)

      const file = e.dataTransfer.files[0]
      if (!file) return

      const ext = file.name.split('.').pop()?.toLowerCase()
      if (!ext || !['csv', 'json', 'jsonl', 'parquet', 'xlsx'].includes(ext)) return

      // Convert screen position to flow position
      const flowPosition = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      const restorationState = props.restorationState

      // Find dataset node at this position (with some tolerance)
      const NODE_WIDTH = 200
      const NODE_HEIGHT = 120
      const TOLERANCE = 20

      for (const node of flowNodes) {
        if (node.type !== 'dataset') continue

        const datasetInfo = restorationState.datasets.get(node.id)
        if (!datasetInfo || datasetInfo.status === 'embedded') continue
        if (restorationState.skippedDatasets.has(node.id)) continue

        const nodeLeft = node.position.x - TOLERANCE
        const nodeRight = node.position.x + NODE_WIDTH + TOLERANCE
        const nodeTop = node.position.y - TOLERANCE
        const nodeBottom = node.position.y + NODE_HEIGHT + TOLERANCE

        if (
          flowPosition.x >= nodeLeft &&
          flowPosition.x <= nodeRight &&
          flowPosition.y >= nodeTop &&
          flowPosition.y <= nodeBottom
        ) {
          // Found the target node
          await provideFileForRestoration(node.id, file)
          return
        }
      }
    },
    [isPartialMode, props, screenToFlowPosition, flowNodes, provideFileForRestoration]
  )

  const handleRecover = () => {
    if (props.mode === 'full') {
      setLoading(true)
      props.onRecover()
    }
  }

  const handleComplete = () => {
    if (props.mode === 'partial') {
      props.onComplete()
    }
  }

  // Count datasets and views for the header
  const datasetCount = Object.values(parsedNodes).filter((n) => n.type === 'dataset').length
  const viewCount = Object.values(parsedNodes).filter((n) => n.type === 'view').length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={() => setShowDiscardConfirm(true)} />

      {/* Dialog */}
      <div className="relative flex flex-col bg-[var(--color-bg-primary)] w-[min(800px,90vw)] h-[min(600px,80vh)] border border-[var(--color-border)] rounded-xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <div>
            <h2 className="text-sm font-medium">{isPartialMode ? 'Restore session' : 'Recover session'}</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {isPartialMode
                ? 'Drop files onto dataset nodes to restore the pipeline'
                : `${datasetCount} dataset${datasetCount !== 1 ? 's' : ''}${viewCount > 0 ? `, ${viewCount} view${viewCount !== 1 ? 's' : ''}` : ''}`}
            </p>
          </div>
          {isPartialMode && (
            <div className="text-xs text-[var(--color-text-secondary)]">
              {progress.provided}/{progress.required} datasets ready
            </div>
          )}
        </div>

        {/* Canvas */}
        <div
          className={`flex-1 min-h-0 ${isDragOver ? 'ring-2 ring-inset ring-[var(--color-accent)]' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            colorMode={theme as ColorMode}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.1}
            maxZoom={2}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnDrag={true}
            zoomOnScroll={true}
            defaultEdgeOptions={{
              type: 'smoothstep',
            }}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)]">
          {isPartialMode ? (
            <>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowDiscardConfirm(true)}>
                  Discard
                </Button>
                {progress.required > progress.provided && (
                  <Button variant="secondary" size="sm" onClick={handleSkipMissing}>
                    Skip missing
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={props.onCancel}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={handleComplete} disabled={!ready}>
                  Restore
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={() => setShowDiscardConfirm(true)}>
                Discard
              </Button>
              <Button variant="primary" size="sm" onClick={handleRecover} disabled={loading} loading={loading}>
                Recover
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Discard Confirmation */}
      {showDiscardConfirm && (
        <ConfirmDialog
          title="Discard session?"
          message="This will permanently delete the saved session data."
          confirmLabel="Discard"
          variant="danger"
          onConfirm={props.onDiscard}
          onCancel={() => setShowDiscardConfirm(false)}
        />
      )}
    </div>
  )
}

// Wrapper component that provides ReactFlowProvider
export function RestorationDialog(props: Props) {
  return (
    <ReactFlowProvider>
      <RestorationDialogInner {...props} />
    </ReactFlowProvider>
  )
}
