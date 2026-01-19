import {
  Background,
  type ColorMode,
  type Connection,
  ConnectionLineType,
  Controls,
  type Edge,
  type EdgeMouseHandler,
  type Node,
  type NodeMouseHandler,
  type NodeTypes,
  type OnConnect,
  type OnConnectEnd,
  type OnConnectStart,
  type OnNodesChange,
  type OnReconnect,
  ReactFlow,
  SelectionMode,
  useReactFlow,
} from '@xyflow/react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '@xyflow/react/dist/style.css'

import { useDuckDB } from '@/lib/duckdb'
import { exportData } from '@/lib/export/exporter'
import { getLayoutedPositions } from '@/lib/graph/auto-layout'
import { useEngineDispatcher } from '@/lib/pipeline/hooks/useEngineDispatcher'
import { usePipeline } from '@/lib/pipeline/usePipeline'
import { useDialogStore, usePanelStore, usePipelineStore, useThemeStore } from '@/stores'
import type {
  ChartNode as ChartNodeType,
  DashboardNode as DashboardNodeType,
  Dataset,
  DataView,
  ExportNode as ExportNodeType,
  PythonNode as PythonNodeType,
} from '@/types'
import { AutoLayoutPanel } from './AutoLayoutPanel'
import { ConnectionTypeDialog } from './ConnectionTypeDialog'
import { EdgeContextMenu } from './EdgeContextMenu'
import { NodeContextMenu } from './NodeContextMenu'
import { ChartNode } from './nodes/ChartNode'
import { DashboardNode } from './nodes/DashboardNode'
import { DatasetNode } from './nodes/DatasetNode'
import { ExportNode } from './nodes/ExportNode'
import { PythonNode } from './nodes/PythonNode'
import { ViewNode } from './nodes/ViewNode'
import { SelectionActionBar } from './SelectionActionBar'

// Register custom node types
const nodeTypes: NodeTypes = {
  dataset: DatasetNode,
  view: ViewNode,
  chart: ChartNode,
  export: ExportNode,
  dashboard: DashboardNode,
  python: PythonNode,
}

export function PipelineCanvas() {
  // Use individual selectors for data to avoid unnecessary re-renders
  const pipelineNodes = usePipelineStore((s) => s.nodes)
  const pipelineEdges = usePipelineStore((s) => s.edges)
  const activeNodeId = usePipelineStore((s) => s.activeNodeId)
  const selectedNodeId = usePipelineStore((s) => s.selectedNodeId)
  // Actions are stable references, can destructure
  const { getNodeChildren, getNodeDescendants } = usePipelineStore()
  const { openTab, fillPlaceholder, deleteNode, rewireNode } = usePipeline()

  // Use engine dispatcher for mutations - routes through PipelineEngine
  const { dispatch } = useEngineDispatcher()

  // Use individual selectors for UI data
  const theme = useThemeStore((s) => s.theme)
  const nodeContextMenu = usePanelStore((s) => s.nodeContextMenu)
  const edgeContextMenu = usePanelStore((s) => s.edgeContextMenu)
  const activeDialog = useDialogStore((s) => s.activeDialog)
  // Actions are stable references
  const { openDialog, closeDialog } = useDialogStore()
  const { setNodeContextMenu, setEdgeContextMenu, setCanvasMode, closeChartPanel } = usePanelStore()

  // Get connection type dialog state from activeDialog
  const connectionTypeDialogOpen = activeDialog?.type === 'connectionType'
  const connectionSourceId = activeDialog?.type === 'connectionType' ? activeDialog.sourceId : null
  const connectionTargetId = activeDialog?.type === 'connectionType' ? activeDialog.targetId : null

  // Track multi-selected nodes for Join/Union operations
  const [multiSelectedNodeIds, setMultiSelectedNodeIds] = useState<string[]>([])
  // Track if we should skip the next select change (for regular clicks)
  const skipNextSelectChange = useRef(false)

  // Convert to Set for O(1) lookup in flowNodes
  const multiSelectedSet = useMemo(() => new Set(multiSelectedNodeIds), [multiSelectedNodeIds])

  // Convert pipeline nodes to React Flow nodes
  const flowNodes: Node[] = useMemo(() => {
    return Object.values(pipelineNodes).map((node) => {
      const isMultiSelected = multiSelectedSet.has(node.id)
      const baseData = {
        isActive: node.id === activeNodeId,
        isSelected: node.id === selectedNodeId || isMultiSelected,
      }

      if (node.type === 'dataset') {
        const dataset = node as Dataset
        return {
          id: node.id,
          type: 'dataset',
          position: node.position,
          selected: isMultiSelected,
          data: {
            ...baseData,
            dataset,
            onFillPlaceholder: dataset.isPlaceholder ? (file: File) => fillPlaceholder(node.id, file) : undefined,
          },
          deletable: false,
        }
      } else if (node.type === 'chart') {
        const chart = node as ChartNodeType
        return {
          id: node.id,
          type: 'chart',
          position: node.position,
          selected: isMultiSelected,
          data: {
            ...baseData,
            chart,
          },
          deletable: false,
        }
      } else if (node.type === 'export') {
        const exportNode = node as ExportNodeType
        return {
          id: node.id,
          type: 'export',
          position: node.position,
          selected: isMultiSelected,
          data: {
            ...baseData,
            export: exportNode,
          },
          deletable: false,
        }
      } else if (node.type === 'dashboard') {
        const dashboardNode = node as DashboardNodeType
        return {
          id: node.id,
          type: 'dashboard',
          position: node.position,
          selected: isMultiSelected,
          style: {
            width: dashboardNode.dimensions?.width ?? 320,
            height: dashboardNode.dimensions?.height ?? 280,
          },
          data: {
            ...baseData,
            dashboard: dashboardNode,
          },
          deletable: false,
        }
      } else if (node.type === 'python') {
        const pythonNode = node as PythonNodeType
        return {
          id: node.id,
          type: 'python',
          position: node.position,
          selected: isMultiSelected,
          data: {
            ...baseData,
            python: pythonNode,
          },
          deletable: false,
        }
      } else {
        const view = node as DataView
        return {
          id: node.id,
          type: 'view',
          position: node.position,
          selected: isMultiSelected,
          data: {
            ...baseData,
            view,
          },
          deletable: false,
        }
      }
    })
  }, [pipelineNodes, activeNodeId, selectedNodeId, multiSelectedSet, fillPlaceholder])

  // Convert pipeline edges to React Flow edges
  const flowEdges: Edge[] = useMemo(() => {
    return pipelineEdges.map((edge) => ({
      id: edge.id,
      source: edge.sourceId,
      target: edge.targetId,
      type: 'smoothstep',
      animated: false,
      style: { stroke: 'var(--color-border)', strokeWidth: 2 },
    }))
  }, [pipelineEdges])

  // Handle node changes (position, selection, dimensions)
  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          // Route position updates through engine
          dispatch({ type: 'updateNode', nodeId: change.id, updates: { position: change.position } })
        }
        // Handle dimension changes from NodeResizer
        if (change.type === 'dimensions' && change.dimensions) {
          const node = usePipelineStore.getState().nodes[change.id]
          if (node?.type === 'dashboard') {
            // Route dimension updates through engine
            dispatch({
              type: 'updateNode',
              nodeId: change.id,
              updates: { dimensions: { width: change.dimensions.width, height: change.dimensions.height } },
            })
          }
        }
      }
      // Handle selection changes from React Flow (rectangle drag selection)
      const selectChanges = changes.filter((c) => c.type === 'select')
      if (selectChanges.length > 0) {
        // Skip if this is from a click (handled by onNodeClick)
        if (skipNextSelectChange.current) {
          skipNextSelectChange.current = false
          return
        }
        // Rectangle selection: update selection based on changes
        // React Flow only sends changes for nodes whose selection state changed,
        // so we need to add/remove incrementally rather than replace
        setMultiSelectedNodeIds((prev) => {
          const newSelection = new Set(prev)
          for (const change of selectChanges) {
            if (change.type === 'select') {
              if (change.selected) {
                newSelection.add(change.id)
              } else {
                newSelection.delete(change.id)
              }
            }
          }
          return Array.from(newSelection)
        })
      }
    },
    [dispatch]
  )

  // Handle node selection
  const onNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      // Cmd+click: toggle in multi-selection
      if (event.metaKey || event.ctrlKey) {
        setMultiSelectedNodeIds((prev) => {
          // Start with current multi-selection, or include single-selected node if exists
          let currentSelection = prev.length > 0 ? prev : []
          if (prev.length === 0 && selectedNodeId && pipelineNodes[selectedNodeId]) {
            currentSelection = [selectedNodeId]
          }

          // Toggle the clicked node
          if (currentSelection.includes(node.id)) {
            return currentSelection.filter((id) => id !== node.id)
          }
          return [...currentSelection, node.id]
        })
        skipNextSelectChange.current = true
        return
      }
      // Regular click: select single node and clear multi-selection
      dispatch({ type: 'selectNode', nodeId: node.id })
      setMultiSelectedNodeIds([])
      skipNextSelectChange.current = true
    },
    [dispatch, pipelineNodes, selectedNodeId]
  )

  // Handle node double-click to open in tab and show table (or chart modal for charts)
  const onNodeDoubleClick: NodeMouseHandler = useCallback(
    (_, node) => {
      const pipelineNode = pipelineNodes[node.id]
      // For chart nodes, open the chart modal instead of the table
      if (pipelineNode?.type === 'chart') {
        openDialog({ type: 'chartModal', nodeId: node.id })
        return
      }
      // For dashboard nodes, open the dashboard view
      if (pipelineNode?.type === 'dashboard') {
        openDialog({ type: 'dashboardView', nodeId: node.id })
        return
      }
      openTab(node.id)
      setCanvasMode(false) // Exit canvas mode to show the table
    },
    [pipelineNodes, openTab, setCanvasMode, openDialog]
  )

  // Handle background click to deselect
  const onPaneClick = useCallback(() => {
    dispatch({ type: 'selectNode', nodeId: null })
    setMultiSelectedNodeIds([])
    setNodeContextMenu(null)
    setEdgeContextMenu(null)
  }, [dispatch, setNodeContextMenu, setEdgeContextMenu])

  // Handle node drag start - close chart panel
  const onNodeDragStart = useCallback(() => {
    closeChartPanel()
  }, [closeChartPanel])

  // Handle right-click on node for context menu
  const onNodeContextMenu: NodeMouseHandler = useCallback(
    (event, node) => {
      event.preventDefault()
      setNodeContextMenu({
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
        nodeType: node.type as 'dataset' | 'view',
      })
    },
    [setNodeContextMenu]
  )

  // Handle right-click on edge for context menu
  const onEdgeContextMenu: EdgeMouseHandler = useCallback(
    (event, edge) => {
      event.preventDefault()
      setEdgeContextMenu({
        x: event.clientX,
        y: event.clientY,
        edgeId: edge.id,
        sourceId: edge.source,
        targetId: edge.target,
      })
    },
    [setEdgeContextMenu]
  )

  // Handle context menu actions
  const handleContextMenuDelete = useCallback(() => {
    if (!nodeContextMenu) return
    const children = getNodeChildren(nodeContextMenu.nodeId)

    if (children.length > 0) {
      openDialog({ type: 'deleteConfirm', nodeIds: [nodeContextMenu.nodeId] })
    } else {
      deleteNode(nodeContextMenu.nodeId)
    }
    setNodeContextMenu(null)
  }, [nodeContextMenu, getNodeChildren, openDialog, deleteNode, setNodeContextMenu])

  const handleContextMenuPreview = useCallback(() => {
    if (!nodeContextMenu) return
    openTab(nodeContextMenu.nodeId)
    usePanelStore.getState().setCanvasMode(false)
    setNodeContextMenu(null)
  }, [nodeContextMenu, openTab, setNodeContextMenu])

  // Handle connection start (can be used for visual feedback later)
  const onConnectStart: OnConnectStart = useCallback(() => {
    // Can be used to highlight compatible nodes
  }, [])

  // Handle connection end
  const onConnectEnd: OnConnectEnd = useCallback(() => {
    // Cleanup after connection attempt
  }, [])

  // Handle edge reconnection (rewiring)
  const onReconnect: OnReconnect = useCallback(
    (oldEdge, newConnection) => {
      if (!newConnection.source || !newConnection.target) return

      // The target node is being rewired to a new source
      const targetNodeId = oldEdge.target
      const newSourceId = newConnection.source

      // Rewire the node to the new parent
      rewireNode(targetNodeId, newSourceId)
    },
    [rewireNode]
  )

  // Validate connections to prevent cycles and invalid connections
  const isValidConnection = useCallback(
    (connection: Edge | Connection) => {
      const source = connection.source
      const target = connection.target

      if (!source || !target) return false

      // Prevent self-connection
      if (source === target) return false

      // Prevent connecting to datasets (they have no inputs)
      const targetNode = pipelineNodes[target]
      if (targetNode?.type === 'dataset') return false

      // Prevent cycles: target cannot be an ancestor of source
      // (i.e., source cannot be a descendant of target)
      const descendants = getNodeDescendants(target)
      if (descendants.includes(source)) return false

      return true
    },
    [pipelineNodes, getNodeDescendants]
  )

  // Handle connection completion - rewires the target node to use the new source
  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return
      if (connection.source === connection.target) return

      const sourceNode = pipelineNodes[connection.source]
      const targetNode = pipelineNodes[connection.target]

      if (!sourceNode || !targetNode) return

      // Check for placeholder source nodes
      const sourceEmpty =
        (sourceNode.type === 'dataset' && (sourceNode as Dataset).isPlaceholder) ||
        (sourceNode.rowCount !== null && sourceNode.rowCount === 0)

      if (sourceEmpty) {
        console.warn('Cannot connect: source node has no data')
        return
      }

      // Connecting to any existing node (view, chart, export) rewires it
      // Join/Union operations are done via multi-select action bar
      if (targetNode.type === 'view' || targetNode.type === 'chart' || targetNode.type === 'export') {
        rewireNode(connection.target, connection.source)
      }
    },
    [pipelineNodes, rewireNode]
  )

  // Handle connection type selection
  const handleSelectJoin = useCallback(() => {
    if (!connectionSourceId || !connectionTargetId) return
    closeDialog()
    openDialog({ type: 'join', preSelectedLeft: connectionSourceId, preSelectedRight: connectionTargetId })
  }, [connectionSourceId, connectionTargetId, closeDialog, openDialog])

  const handleSelectUnion = useCallback(() => {
    if (!connectionSourceId || !connectionTargetId) return
    closeDialog()
    openDialog({ type: 'union', preSelectedNodes: [connectionSourceId, connectionTargetId] })
  }, [connectionSourceId, connectionTargetId, closeDialog, openDialog])

  return (
    <div className="relative h-full w-full" data-tour="pipeline-canvas">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onNodeDragStart={onNodeDragStart}
        onPaneClick={onPaneClick}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onReconnect={onReconnect}
        edgesReconnectable
        isValidConnection={isValidConnection}
        colorMode={theme as ColorMode}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        snapToGrid
        snapGrid={[20, 20]}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        selectionKeyCode="Shift"
        connectionLineType={ConnectionLineType.SmoothStep}
        defaultEdgeOptions={{
          type: 'smoothstep',
        }}
        proOptions={{ hideAttribution: true }}
        // Performance optimization: only render nodes/edges in the visible viewport
        onlyRenderVisibleElements
      >
        <Background gap={20} />
        <Controls />
        <AutoLayoutPanel />
        <CanvasKeyboardHandler multiSelectedNodeIds={multiSelectedNodeIds} />
      </ReactFlow>

      {/* Node context menu */}
      {nodeContextMenu && (
        <NodeContextMenu
          menu={nodeContextMenu}
          onClose={() => setNodeContextMenu(null)}
          onDelete={handleContextMenuDelete}
          onPreview={handleContextMenuPreview}
        />
      )}

      {/* Edge context menu */}
      {edgeContextMenu && <EdgeContextMenu menu={edgeContextMenu} onClose={() => setEdgeContextMenu(null)} />}

      {/* Multi-select action bar */}
      <SelectionActionBar selectedNodeIds={multiSelectedNodeIds} />

      {/* Connection type dialog */}
      {connectionTypeDialogOpen && connectionSourceId && connectionTargetId && (
        <ConnectionTypeDialog
          sourceNode={pipelineNodes[connectionSourceId]}
          targetNode={pipelineNodes[connectionTargetId]}
          onSelectJoin={handleSelectJoin}
          onSelectUnion={handleSelectUnion}
          onClose={() => closeDialog()}
        />
      )}
    </div>
  )
}

// Keyboard handler component - must be inside ReactFlow to use useReactFlow
interface CanvasKeyboardHandlerProps {
  multiSelectedNodeIds: string[]
}

const CanvasKeyboardHandler = memo(function CanvasKeyboardHandler({
  multiSelectedNodeIds,
}: CanvasKeyboardHandlerProps) {
  const { fitView, zoomIn, zoomOut, getNodes, getEdges, setNodes } = useReactFlow()
  // Use individual selectors for data to avoid unnecessary re-renders
  const pipelineNodes = usePipelineStore((s) => s.nodes)
  const selectedNodeId = usePipelineStore((s) => s.selectedNodeId)
  // Actions are stable references, can destructure
  const { getNodeChildren, duplicateBranch } = usePipelineStore()
  const { openTab, deleteNode } = usePipeline()
  const { setCanvasMode, openChartPanel } = usePanelStore()
  const { openDialog } = useDialogStore()
  const { client } = useDuckDB()

  // Use engine dispatcher for mutations
  const { dispatch } = useEngineDispatcher()

  // Key buffer for multi-key sequences (gg)
  const keyBufferRef = useRef<string[]>([])
  const keyBufferTimeoutRef = useRef<number | null>(null)

  const clearKeyBuffer = useCallback(() => {
    keyBufferRef.current = []
    if (keyBufferTimeoutRef.current) {
      clearTimeout(keyBufferTimeoutRef.current)
      keyBufferTimeoutRef.current = null
    }
  }, [])

  // Get sorted node IDs for navigation
  const sortedNodeIds = useMemo(() => {
    return Object.values(pipelineNodes)
      .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
      .map((n) => n.id)
  }, [pipelineNodes])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if we're in an input field or contenteditable
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      const key = e.key

      // Update key buffer for sequences like gg
      const newBuffer = [...keyBufferRef.current, key]

      // Check for gg sequence (go to first node)
      if (newBuffer.length >= 2 && newBuffer.slice(-2).join('') === 'gg') {
        e.preventDefault()
        clearKeyBuffer()
        if (sortedNodeIds.length > 0) {
          dispatch({ type: 'selectNode', nodeId: sortedNodeIds[0] })
        }
        return
      }

      // G: Go to last node
      if (key === 'G') {
        e.preventDefault()
        clearKeyBuffer()
        if (sortedNodeIds.length > 0) {
          dispatch({ type: 'selectNode', nodeId: sortedNodeIds[sortedNodeIds.length - 1] })
        }
        return
      }

      // +/=: Zoom in
      if (key === '+' || key === '=') {
        e.preventDefault()
        clearKeyBuffer()
        zoomIn({ duration: 200 })
        return
      }

      // -: Zoom out
      if (key === '-') {
        e.preventDefault()
        clearKeyBuffer()
        zoomOut({ duration: 200 })
        return
      }

      // t: Switch to table view
      if (key === 't' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        clearKeyBuffer()
        setCanvasMode(false)
        return
      }

      // f or Space: Fit view
      if ((key === 'f' || key === ' ') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        clearKeyBuffer()
        fitView({ padding: 0.2, duration: 200 })
        return
      }

      // Shift+L: Auto-layout nodes using Dagre
      if (key === 'L' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        clearKeyBuffer()
        const flowNodes = getNodes()
        const flowEdges = getEdges()
        if (flowNodes.length > 0) {
          const positions = getLayoutedPositions(flowNodes, flowEdges)
          // Update React Flow nodes directly for immediate visual feedback
          setNodes((currentNodes) =>
            currentNodes.map((node) => {
              const newPosition = positions.get(node.id)
              return newPosition ? { ...node, position: newPosition } : node
            })
          )
          // Sync to pipeline store via engine for persistence
          for (const [nodeId, position] of positions) {
            dispatch({ type: 'updateNode', nodeId, updates: { position } })
          }
          setTimeout(() => fitView({ padding: 0.2, duration: 200 }), 50)
        }
        return
      }

      // J: Join selected nodes (when 2 data nodes are multi-selected)
      if (key === 'j' && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        // Only if multi-selection has exactly 2 valid data nodes
        const validNodes = multiSelectedNodeIds.filter((id) => {
          const node = pipelineNodes[id]
          return node && (node.type === 'dataset' || node.type === 'view')
        })
        if (validNodes.length === 2) {
          e.preventDefault()
          clearKeyBuffer()
          openDialog({ type: 'join', preSelectedLeft: validNodes[0], preSelectedRight: validNodes[1] })
          return
        }
      }

      // U: Union selected nodes (when 2+ data nodes are multi-selected)
      if (key === 'u' && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        const validNodes = multiSelectedNodeIds.filter((id) => {
          const node = pipelineNodes[id]
          return node && (node.type === 'dataset' || node.type === 'view')
        })
        if (validNodes.length >= 2) {
          e.preventDefault()
          clearKeyBuffer()
          openDialog({ type: 'union', preSelectedNodes: validNodes })
          return
        }
      }

      // Cmd+D / Ctrl+D: Duplicate selected node with descendants
      if (key === 'd' && (e.metaKey || e.ctrlKey) && selectedNodeId) {
        e.preventDefault()
        clearKeyBuffer()
        duplicateBranch(selectedNodeId)
        return
      }

      // Arrow keys or hkl: Navigate between nodes (j/u only when no multi-selection)
      // Note: j is reserved for Join when 2 nodes are multi-selected
      const isNavKey =
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key) || ['h', 'k', 'l'].includes(key)

      if (isNavKey) {
        e.preventDefault()
        clearKeyBuffer()
        const currentIndex = selectedNodeId ? sortedNodeIds.indexOf(selectedNodeId) : -1
        let newIndex = currentIndex

        if (key === 'ArrowDown' || key === 'ArrowRight' || key === 'l') {
          newIndex = currentIndex < sortedNodeIds.length - 1 ? currentIndex + 1 : 0
        } else {
          newIndex = currentIndex > 0 ? currentIndex - 1 : sortedNodeIds.length - 1
        }

        if (sortedNodeIds[newIndex]) {
          dispatch({ type: 'selectNode', nodeId: sortedNodeIds[newIndex] })
        }
        return
      }

      // e or Enter: Open selected node in table view, or trigger special actions
      if ((key === 'Enter' || key === 'e') && selectedNodeId) {
        e.preventDefault()
        clearKeyBuffer()

        const node = pipelineNodes[selectedNodeId]

        // Export node: trigger download
        if (node?.type === 'export' && client) {
          const exportNode = node as ExportNodeType
          const parentNode = pipelineNodes[exportNode.parentId]
          if (parentNode) {
            const filename = exportNode.config.filename ?? parentNode.name.replace(/[^a-zA-Z0-9_-]/g, '_')
            exportData({
              client,
              tableName: parentNode.tableName,
              format: exportNode.config.format,
              filename,
            })
          }
          return
        }

        // Chart node: open chart popover for editing
        if (node?.type === 'chart') {
          const chartNode = node as ChartNodeType
          openChartPanel(chartNode.parentId, chartNode.id, { x: window.innerWidth / 2, y: 100 })
          return
        }

        // Default: open in table view
        openTab(selectedNodeId)
        setCanvasMode(false)
        return
      }

      // Delete/Backspace: Delete selected node(s)
      if (key === 'Delete' || key === 'Backspace') {
        // Handle multi-selection delete
        if (multiSelectedNodeIds.length > 0) {
          e.preventDefault()
          clearKeyBuffer()
          // Check if any selected node has children
          const hasAnyChildren = multiSelectedNodeIds.some((id) => getNodeChildren(id).length > 0)
          if (hasAnyChildren) {
            openDialog({ type: 'deleteConfirm', nodeIds: multiSelectedNodeIds })
          } else {
            // Delete all without confirmation
            for (const id of multiSelectedNodeIds) {
              deleteNode(id)
            }
          }
          return
        }
        // Handle single selection delete
        if (selectedNodeId) {
          e.preventDefault()
          clearKeyBuffer()
          const children = getNodeChildren(selectedNodeId)
          if (children.length > 0) {
            openDialog({ type: 'deleteConfirm', nodeIds: [selectedNodeId] })
          } else {
            deleteNode(selectedNodeId)
          }
          return
        }
      }

      // Buffer 'g' for potential gg sequence
      if (key === 'g') {
        e.preventDefault()
        keyBufferRef.current = newBuffer
        if (keyBufferTimeoutRef.current) clearTimeout(keyBufferTimeoutRef.current)
        keyBufferTimeoutRef.current = window.setTimeout(clearKeyBuffer, 500)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    selectedNodeId,
    sortedNodeIds,
    getNodeChildren,
    openDialog,
    deleteNode,
    setCanvasMode,
    fitView,
    zoomIn,
    zoomOut,
    dispatch,
    openTab,
    clearKeyBuffer,
    pipelineNodes,
    client,
    openChartPanel,
    multiSelectedNodeIds,
    duplicateBranch,
    getNodes,
    getEdges,
    setNodes,
  ])

  return null
})
