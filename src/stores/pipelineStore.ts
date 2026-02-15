import { applyPatches, enablePatches, produceWithPatches } from 'immer'
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { type PipelineState as CorePipelineState, type PipelineCommand, PipelineEngine } from '@/lib/core'
import { getChildren, getDescendants, getParents, getRootNodes } from '@/lib/graph'
import { generateShortId } from '@/lib/id'
import { type HydratedNode, hydrateNode, hydrateNodes } from '@/lib/pipeline/hydration'
import type {
  ChartNode,
  DashboardNode,
  Dataset,
  DataView,
  ExportNode,
  PipelineEdge,
  PipelineNode,
  PythonNode,
} from '@/types'
import type { NodeLayout } from '@/types/pipelineLayout'
import type { NodeRuntime } from '@/types/pipelineRuntime'
import { usePipelineLayoutStore } from './pipelineLayoutStore'
import { usePipelineRuntimeStore } from './pipelineRuntimeStore'
import type { PipelineSnapshot } from './pipelineTypes'
import { usePipelineUiStore } from './pipelineUiStore'

// Enable Immer patches for efficient undo/redo
enablePatches()

const MAX_UNDO_STACK_SIZE = 50

// Re-export graph utilities
export { getChildren, getDescendants, getParents } from '@/lib/graph'

// ============================================
// STATE INTERFACE
// ============================================

interface PipelineState {
  // Core DAG data
  nodes: Record<string, PipelineNode>
  edges: PipelineEdge[]

  // Selection state
  selectedNodeId: string | null
  activeNodeId: string | null // Node being viewed in DataGrid

  // Tabs - open nodes for quick switching
  openNodeIds: string[]

  // Undo/redo stacks (snapshot-based)
  undoStack: PipelineSnapshot[]
  redoStack: PipelineSnapshot[]
}

// ============================================
// ACTIONS INTERFACE
// ============================================

interface PipelineActions {
  // Dataset management
  addDataset: (dataset: Dataset, runtime: NodeRuntime, layout: NodeLayout) => void
  removeDataset: (id: string) => string[] // Returns removed view IDs for cleanup

  // View management
  addView: (view: DataView, parentIds: string[], runtime: NodeRuntime, layout: NodeLayout) => void
  removeView: (id: string) => string[] // Returns removed view IDs for cleanup
  updateView: (id: string, updates: NodeUpdatePatch) => void // Updates view/runtime/layout/parents

  // Chart/Export/Dashboard management (terminal nodes - no DuckDB views)
  addChartNode: (chart: ChartNode, parentId: string, runtime: NodeRuntime, layout: NodeLayout) => void
  addExportNode: (exportNode: ExportNode, parentId: string, runtime: NodeRuntime, layout: NodeLayout) => void
  addDashboardNode: (dashboard: DashboardNode, parentIds: string[], layout: NodeLayout) => void
  removeTerminalNode: (id: string) => string[] // Returns removed node IDs
  updateChartNode: (id: string, updates: Partial<ChartNode> & Partial<NodeRuntime>) => void
  updateExportNode: (id: string, updates: Partial<ExportNode> & Partial<NodeRuntime>) => void
  updateDashboardNode: (id: string, updates: Partial<DashboardNode>) => void

  // Python node management (creates DuckDB TABLE, not VIEW)
  addPythonNode: (pythonNode: PythonNode, parentId: string, runtime: NodeRuntime, layout: NodeLayout) => void
  removePythonNode: (id: string) => string[] // Returns removed node IDs
  updatePythonNode: (id: string, updates: Partial<PythonNode> & Partial<NodeRuntime>) => void

  // Node operations
  updateNodePosition: (id: string, position: { x: number; y: number }) => void
  updateNodeName: (id: string, name: string) => void
  updateNodeRowCount: (id: string, rowCount: number) => void
  updateNode: (id: string, updates: NodeUpdatePatch) => void
  updateNodes: (updates: Record<string, NodeUpdatePatch>) => void // Batch update multiple nodes
  toggleNodeExpanded: (id: string) => void
  setNodeParents: (id: string, parentIds: string[]) => void

  // Selection
  selectNode: (id: string | null) => void
  setActiveNode: (id: string | null) => void

  // Tabs
  openTab: (id: string) => void
  closeTab: (id: string) => void
  replaceActiveTab: (oldId: string, newId: string) => void

  // Bulk operations
  cascadeDelete: (nodeId: string) => string[] // Returns all deleted IDs

  // Undo/redo (snapshot-based with optional Immer patches)
  captureSnapshot: () => PipelineSnapshot
  captureLightSnapshot: () => Omit<PipelineSnapshot, 'nodes' | 'edges'> // Just metadata, no data
  pushUndo: (snapshot: PipelineSnapshot) => void
  popUndo: () => PipelineSnapshot | undefined
  pushRedo: (snapshot: PipelineSnapshot) => void
  popRedo: () => PipelineSnapshot | undefined
  clearRedo: () => void
  pushUndoAndClearRedo: (snapshot: PipelineSnapshot) => void // Combined operation to reduce re-renders
  restoreSnapshot: (snapshot: PipelineSnapshot) => void
  // Patch-based mutation for efficient undo/redo
  mutateWithPatches: (mutator: (draft: { nodes: Record<string, PipelineNode>; edges: PipelineEdge[] }) => void) => {
    result: { nodes: Record<string, PipelineNode>; edges: PipelineEdge[] }
    snapshot: PipelineSnapshot
  }

  // State management
  reset: () => void

  // Duplicate branch
  duplicateBranch: (nodeId: string) => { newRootId: string; idMap: Record<string, string> } | null

  // Computed getters (as functions)
  getNode: (id: string) => PipelineNode | undefined
  getHydratedNode: (id: string) => HydratedNode | undefined
  getHydratedNodes: () => Record<string, HydratedNode>
  getNodeChildren: (id: string) => string[]
  getNodeParents: (id: string) => string[]
  getNodeDescendants: (id: string) => string[]
  getAllRootNodes: () => PipelineNode[]
  getDatasets: () => Dataset[]
  getViews: () => DataView[]
  getChartNodes: () => ChartNode[]
  getExportNodes: () => ExportNode[]
  getPythonNodes: () => PythonNode[]

  // Cloud sync actions
  setRemoteState: (state: { nodes: Record<string, PipelineNode>; edges: PipelineEdge[] }) => void
  mergeRemoteState: (state: { nodes: Record<string, PipelineNode>; edges: PipelineEdge[] }) => void
}

type NodeUpdatePatch = Partial<PipelineNode> &
  Partial<NodeRuntime> &
  Partial<NodeLayout> & {
    parentIds?: string[]
    parentId?: string
  }

// ============================================
// INITIAL STATE
// ============================================

const initialState: PipelineState = {
  nodes: {},
  edges: [],
  selectedNodeId: null,
  activeNodeId: null,
  openNodeIds: [],
  undoStack: [],
  redoStack: [],
}

// ============================================
// STORE IMPLEMENTATION
// ============================================

export const usePipelineStore = create<PipelineState & PipelineActions>()(
  subscribeWithSelector((set, get) => {
    const applyEngineCommand = (command: PipelineCommand) => {
      const state = get()
      const engineState: CorePipelineState = {
        nodes: state.nodes,
        edges: state.edges,
        activeNodeId: state.activeNodeId,
        selectedNodeId: state.selectedNodeId,
        openNodeIds: state.openNodeIds,
        undoStack: state.undoStack,
        redoStack: state.redoStack,
      }

      const { state: newState } = PipelineEngine.execute(engineState, command)

      set({
        nodes: newState.nodes,
        edges: newState.edges,
        activeNodeId: newState.activeNodeId,
        selectedNodeId: newState.selectedNodeId,
        openNodeIds: newState.openNodeIds,
        undoStack: newState.undoStack,
        redoStack: newState.redoStack,
      })
    }

    const splitNodeUpdates = (
      updates: NodeUpdatePatch
    ): {
      domainUpdates: Partial<PipelineNode>
      runtimeUpdates: Partial<NodeRuntime>
      layoutUpdates: Partial<NodeLayout>
      parentIds: string[] | null
    } => {
      const runtimeKeys = new Set<keyof NodeRuntime>([
        'tableName',
        'viewSql',
        'outputTableName',
        'columns',
        'rowCount',
        'matplotlibOutput',
        'executionTimeMs',
        'lastExecutedAt',
      ])
      const layoutKeys = new Set<keyof NodeLayout>(['position', 'isExpanded', 'dimensions'])

      const domainUpdates: Partial<PipelineNode> = {}
      const runtimeUpdates: Partial<NodeRuntime> = {}
      const layoutUpdates: Partial<NodeLayout> = {}
      let parentIds: string[] | null = null

      for (const [key, value] of Object.entries(updates)) {
        if (key === 'parentIds') {
          parentIds = Array.isArray(value) ? (value as string[]) : []
          continue
        }
        if (key === 'parentId') {
          parentIds = value ? [value as string] : []
          continue
        }
        if (runtimeKeys.has(key as keyof NodeRuntime)) {
          ;(runtimeUpdates as Record<string, unknown>)[key] = value
          continue
        }
        if (layoutKeys.has(key as keyof NodeLayout)) {
          ;(layoutUpdates as Record<string, unknown>)[key] = value
          continue
        }
        ;(domainUpdates as Record<string, unknown>)[key] = value
      }

      return { domainUpdates, runtimeUpdates, layoutUpdates, parentIds }
    }

    return {
      ...initialState,

      // ----------------------------------------
      // Dataset Management
      // ----------------------------------------

      addDataset: (dataset, runtime, layout) => {
        applyEngineCommand({ type: 'addDataset', dataset, suppressEffects: true })
        usePipelineRuntimeStore.getState().setNodeRuntime(dataset.id, runtime)
        usePipelineLayoutStore.getState().setNodeLayout(dataset.id, layout)
      },

      removeDataset: (id) => {
        const state = get()
        const descendants = getDescendants(id, state.edges)
        const allToRemove = [id, ...descendants]
        applyEngineCommand({ type: 'removeNode', nodeId: id, cascade: true, suppressEffects: true })
        usePipelineRuntimeStore.getState().removeNodesRuntime(allToRemove)
        usePipelineLayoutStore.getState().removeNodesLayout(allToRemove)

        return descendants // Return view IDs that need DuckDB cleanup
      },

      // ----------------------------------------
      // View Management
      // ----------------------------------------

      addView: (view, parentIds, runtime, layout) => {
        applyEngineCommand({ type: 'addView', view, parentIds, suppressEffects: true })
        usePipelineRuntimeStore.getState().setNodeRuntime(view.id, runtime)
        usePipelineLayoutStore.getState().setNodeLayout(view.id, layout)
      },

      removeView: (id) => {
        const state = get()
        const node = state.nodes[id]
        if (!node || node.type !== 'view') return []

        const descendants = getDescendants(id, state.edges)
        const allToRemove = [id, ...descendants]

        applyEngineCommand({ type: 'removeNode', nodeId: id, cascade: true, suppressEffects: true })
        usePipelineRuntimeStore.getState().removeNodesRuntime(allToRemove)
        usePipelineLayoutStore.getState().removeNodesLayout(allToRemove)

        return allToRemove // Return all view IDs for DuckDB cleanup
      },

      updateView: (id, updates) => {
        get().updateNode(id, updates)
      },

      // ----------------------------------------
      // Chart/Export Management (terminal nodes)
      // ----------------------------------------

      addChartNode: (chart, parentId, runtime, layout) => {
        applyEngineCommand({ type: 'addChartNode', chart, parentId })
        usePipelineRuntimeStore.getState().setNodeRuntime(chart.id, runtime)
        usePipelineLayoutStore.getState().setNodeLayout(chart.id, layout)
      },

      addExportNode: (exportNode, parentId, runtime, layout) => {
        applyEngineCommand({ type: 'addExportNode', exportNode, parentId })
        usePipelineRuntimeStore.getState().setNodeRuntime(exportNode.id, runtime)
        usePipelineLayoutStore.getState().setNodeLayout(exportNode.id, layout)
      },

      removeTerminalNode: (id) => {
        const state = get()
        const node = state.nodes[id]
        if (!node || (node.type !== 'chart' && node.type !== 'export' && node.type !== 'dashboard')) return []

        // Terminal nodes have no descendants, just remove the node
        applyEngineCommand({ type: 'removeNode', nodeId: id, cascade: false, suppressEffects: true })
        usePipelineRuntimeStore.getState().removeNodesRuntime([id])
        usePipelineLayoutStore.getState().removeNodesLayout([id])

        return [id]
      },

      updateChartNode: (id, updates) => {
        const node = get().nodes[id]
        if (!node || node.type !== 'chart') return
        get().updateNode(id, updates)
      },

      updateExportNode: (id, updates) => {
        const node = get().nodes[id]
        if (!node || node.type !== 'export') return
        get().updateNode(id, updates)
      },

      addDashboardNode: (dashboard, parentIds, layout) => {
        applyEngineCommand({ type: 'addDashboardNode', dashboard, parentIds, suppressEffects: true })
        usePipelineLayoutStore.getState().setNodeLayout(dashboard.id, layout)
      },

      updateDashboardNode: (id, updates) => {
        const node = get().nodes[id]
        if (!node || node.type !== 'dashboard') return
        get().updateNode(id, updates)
      },

      // ----------------------------------------
      // Python Node Management
      // ----------------------------------------

      addPythonNode: (pythonNode, parentId, runtime, layout) => {
        applyEngineCommand({ type: 'addPythonNode', pythonNode, parentId })
        usePipelineRuntimeStore.getState().setNodeRuntime(pythonNode.id, runtime)
        usePipelineLayoutStore.getState().setNodeLayout(pythonNode.id, layout)
      },

      removePythonNode: (id) => {
        const state = get()
        const node = state.nodes[id]
        if (!node || node.type !== 'python') return []

        // Python nodes can have descendants (they produce data)
        const descendants = getDescendants(id, state.edges)
        const allToRemove = [id, ...descendants]

        applyEngineCommand({ type: 'removeNode', nodeId: id, cascade: true, suppressEffects: true })
        usePipelineRuntimeStore.getState().removeNodesRuntime(allToRemove)
        usePipelineLayoutStore.getState().removeNodesLayout(allToRemove)

        return allToRemove
      },

      updatePythonNode: (id, updates) => {
        const node = get().nodes[id]
        if (!node || node.type !== 'python') return
        get().updateNode(id, updates)
      },

      // ----------------------------------------
      // Node ViewOperations
      // ----------------------------------------

      updateNodePosition: (id, position) => {
        usePipelineLayoutStore.getState().setNodePosition(id, position)
      },

      updateNodeName: (id, name) => {
        applyEngineCommand({ type: 'updateNode', nodeId: id, updates: { name }, suppressEffects: true })
      },

      updateNodeRowCount: (id, rowCount) => {
        usePipelineRuntimeStore.getState().setNodeRuntime(id, { rowCount })
      },

      updateNode: (id, updates) => {
        const { domainUpdates, runtimeUpdates, layoutUpdates, parentIds } = splitNodeUpdates(updates)
        if (Object.keys(domainUpdates).length > 0) {
          applyEngineCommand({ type: 'updateNode', nodeId: id, updates: domainUpdates, suppressEffects: true })
        }
        if (parentIds) {
          applyEngineCommand({ type: 'setNodeParents', nodeId: id, parentIds, suppressEffects: true })
        }
        if (Object.keys(runtimeUpdates).length > 0) {
          usePipelineRuntimeStore.getState().setNodeRuntime(id, runtimeUpdates)
        }
        if (Object.keys(layoutUpdates).length > 0) {
          usePipelineLayoutStore.getState().setNodeLayout(id, layoutUpdates as NodeLayout)
        }
      },

      updateNodes: (updates) => {
        for (const [nodeId, patch] of Object.entries(updates)) {
          get().updateNode(nodeId, patch)
        }
      },

      toggleNodeExpanded: (id) => {
        usePipelineLayoutStore.getState().toggleNodeExpanded(id)
      },

      setNodeParents: (id, parentIds) => {
        applyEngineCommand({ type: 'setNodeParents', nodeId: id, parentIds, suppressEffects: true })
      },

      // ----------------------------------------
      // Selection
      // ----------------------------------------

      selectNode: (id) => set({ selectedNodeId: id }),

      setActiveNode: (id) => {
        set({ activeNodeId: id })
        usePipelineUiStore.getState().markNodeViewed(id)
      },

      // ----------------------------------------
      // Tab Management
      // ----------------------------------------

      openTab: (id) => {
        set((state) => ({
          openNodeIds: state.openNodeIds.includes(id) ? state.openNodeIds : [...state.openNodeIds, id],
          activeNodeId: id,
        }))
        usePipelineUiStore.getState().markNodeViewed(id)
      },

      closeTab: (id) =>
        set((state) => {
          const newOpenIds = state.openNodeIds.filter((nid) => nid !== id)
          // If closing active tab, switch to last open tab or null
          const newActiveId =
            state.activeNodeId === id ? (newOpenIds[newOpenIds.length - 1] ?? null) : state.activeNodeId
          return {
            openNodeIds: newOpenIds,
            activeNodeId: newActiveId,
          }
        }),

      replaceActiveTab: (oldId, newId) => {
        set((state) => {
          const idx = state.openNodeIds.indexOf(oldId)
          if (idx === -1) {
            // Old tab not open, just open new one
            return {
              openNodeIds: [...state.openNodeIds, newId],
              activeNodeId: newId,
            }
          }
          // Replace in place
          const newOpenIds = [...state.openNodeIds]
          newOpenIds[idx] = newId
          return {
            openNodeIds: newOpenIds,
            activeNodeId: newId,
          }
        })
        usePipelineUiStore.getState().markNodeViewed(newId)
      },

      // ----------------------------------------
      // Cascade Delete
      // ----------------------------------------

      cascadeDelete: (nodeId) => {
        const state = get()
        const node = state.nodes[nodeId]

        if (!node) return []

        if (node.type === 'dataset') {
          return get().removeDataset(nodeId)
        } else if (node.type === 'chart' || node.type === 'export' || node.type === 'dashboard') {
          return get().removeTerminalNode(nodeId)
        } else if (node.type === 'python') {
          return get().removePythonNode(nodeId)
        } else {
          return get().removeView(nodeId)
        }
      },

      // ----------------------------------------
      // Undo/Redo (snapshot-based with Immer patches)
      // ----------------------------------------

      captureSnapshot: () => {
        const state = get()
        return {
          nodes: structuredClone(state.nodes),
          edges: structuredClone(state.edges),
          activeNodeId: state.activeNodeId,
          selectedNodeId: state.selectedNodeId,
          openNodeIds: [...state.openNodeIds],
          timestamp: Date.now(),
        }
      },

      captureLightSnapshot: () => {
        const state = get()
        return {
          activeNodeId: state.activeNodeId,
          selectedNodeId: state.selectedNodeId,
          openNodeIds: [...state.openNodeIds],
          timestamp: Date.now(),
        }
      },

      pushUndo: (snapshot) =>
        set((state) => {
          // Enforce stack size limit
          const newStack = [...state.undoStack, snapshot]
          if (newStack.length > MAX_UNDO_STACK_SIZE) {
            newStack.shift() // Remove oldest
          }
          return { undoStack: newStack }
        }),

      popUndo: () => {
        const state = get()
        if (state.undoStack.length === 0) return undefined
        const snapshot = state.undoStack[state.undoStack.length - 1]
        set({ undoStack: state.undoStack.slice(0, -1) })
        return snapshot
      },

      pushRedo: (snapshot) =>
        set((state) => {
          // Enforce stack size limit
          const newStack = [...state.redoStack, snapshot]
          if (newStack.length > MAX_UNDO_STACK_SIZE) {
            newStack.shift() // Remove oldest
          }
          return { redoStack: newStack }
        }),

      popRedo: () => {
        const state = get()
        if (state.redoStack.length === 0) return undefined
        const snapshot = state.redoStack[state.redoStack.length - 1]
        set({ redoStack: state.redoStack.slice(0, -1) })
        return snapshot
      },

      clearRedo: () => set({ redoStack: [] }),

      pushUndoAndClearRedo: (snapshot) =>
        set((state) => ({
          undoStack: [...state.undoStack, snapshot].slice(-MAX_UNDO_STACK_SIZE),
          redoStack: [],
        })),

      restoreSnapshot: (snapshot) => {
        // If snapshot has inverse patches, apply them instead of replacing state
        if (snapshot.inversePatches && snapshot.inversePatches.length > 0) {
          const state = get()
          const newNodes = applyPatches(
            state.nodes,
            snapshot.inversePatches.filter((p) => p.path[0] === 'nodes')
          )
          const newEdges = applyPatches(
            state.edges,
            snapshot.inversePatches.filter((p) => p.path[0] === 'edges')
          )
          set({
            nodes: newNodes,
            edges: newEdges,
            activeNodeId: snapshot.activeNodeId,
            selectedNodeId: snapshot.selectedNodeId,
            openNodeIds: snapshot.openNodeIds,
          })
        } else {
          // Fall back to full state replacement
          set({
            nodes: snapshot.nodes,
            edges: snapshot.edges,
            activeNodeId: snapshot.activeNodeId,
            selectedNodeId: snapshot.selectedNodeId,
            openNodeIds: snapshot.openNodeIds,
          })
        }
      },

      mutateWithPatches: (
        mutator: (draft: { nodes: Record<string, PipelineNode>; edges: PipelineEdge[] }) => void
      ): { result: { nodes: Record<string, PipelineNode>; edges: PipelineEdge[] }; snapshot: PipelineSnapshot } => {
        const state = get()
        const currentState = { nodes: state.nodes, edges: state.edges }

        // Use Immer's produceWithPatches to get both the new state and the patches
        const [nextState, patches, inversePatches] = produceWithPatches(currentState, mutator)

        // Create a lightweight snapshot with patches instead of full state clone
        const snapshot: PipelineSnapshot = {
          // Store current state for fallback compatibility
          nodes: state.nodes,
          edges: state.edges,
          activeNodeId: state.activeNodeId,
          selectedNodeId: state.selectedNodeId,
          openNodeIds: [...state.openNodeIds],
          timestamp: Date.now(),
          // Store patches for efficient undo
          patches,
          inversePatches,
        }

        // Apply the new state
        set({
          nodes: nextState.nodes,
          edges: nextState.edges,
        })

        return { result: nextState, snapshot }
      },

      // ----------------------------------------
      // State Management
      // ----------------------------------------

      reset: () => {
        set(initialState)
        usePipelineRuntimeStore.getState().reset()
        usePipelineLayoutStore.getState().reset()
      },

      // ----------------------------------------
      // Duplicate Branch
      // ----------------------------------------

      duplicateBranch: (nodeId) => {
        const state = get()
        const node = state.nodes[nodeId]
        if (!node) return null

        // Get all descendants
        const descendants = getDescendants(nodeId, state.edges)
        const allNodeIds = [nodeId, ...descendants]

        // Create ID mapping: old ID -> new ID
        const idMap: Record<string, string> = {}
        for (const id of allNodeIds) {
          const suffix = generateShortId()
          idMap[id] = `${id}_copy_${suffix}`
        }

        const runtimeState = usePipelineRuntimeStore.getState().nodes
        const layoutState = usePipelineLayoutStore.getState().nodes

        // Clone all nodes
        const newNodes: Record<string, PipelineNode> = {}
        const newRuntime: Record<string, NodeRuntime> = {}
        const newLayout: Record<string, NodeLayout> = {}

        for (const id of allNodeIds) {
          const original = state.nodes[id]
          if (!original) continue

          const newId = idMap[id]
          const baseClone = {
            ...original,
            id: newId,
            name: id === nodeId ? `${original.name} (copy)` : original.name,
            createdAt: new Date(),
          }

          if (original.type === 'view') {
            const view = original as DataView
            newNodes[newId] = {
              ...baseClone,
              type: 'view',
              operation: { ...view.operation },
            } as DataView
          } else if (original.type === 'chart') {
            const chart = original as ChartNode
            newNodes[newId] = {
              ...baseClone,
              type: 'chart',
              config: { ...chart.config },
            } as ChartNode
          } else if (original.type === 'export') {
            const exportNode = original as ExportNode
            newNodes[newId] = {
              ...baseClone,
              type: 'export',
              config: { ...exportNode.config },
            } as ExportNode
          } else if (original.type === 'dashboard') {
            const dashboard = original as DashboardNode
            newNodes[newId] = {
              ...baseClone,
              type: 'dashboard',
              chartRefs: dashboard.chartRefs.map((ref) => idMap[ref] || ref),
              config: { ...dashboard.config },
            } as DashboardNode
          } else if (original.type === 'python') {
            const pythonNode = original as PythonNode
            newNodes[newId] = {
              ...baseClone,
              type: 'python',
              code: pythonNode.code,
            } as PythonNode
          } else if (original.type === 'dataset') {
            newNodes[newId] = {
              ...baseClone,
              type: 'dataset',
            } as Dataset
          }

          const originalRuntime = runtimeState[id]
          if (originalRuntime) {
            const runtimeClone: NodeRuntime = { ...originalRuntime }
            if (runtimeClone.tableName) {
              runtimeClone.tableName = `${runtimeClone.tableName}_copy_${newId.slice(-4)}`
            }
            if (runtimeClone.outputTableName) {
              runtimeClone.outputTableName = `${runtimeClone.outputTableName}_copy_${newId.slice(-4)}`
            }
            if (original.type === 'view') {
              runtimeClone.viewSql = ''
            }
            newRuntime[newId] = runtimeClone
          }

          const originalLayout = layoutState[id]
          if (originalLayout) {
            newLayout[newId] = {
              ...originalLayout,
              position: {
                x: originalLayout.position.x + 300,
                y: originalLayout.position.y + 50,
              },
            }
          }
        }

        // Create new edges for the cloned subgraph
        const newEdges: PipelineEdge[] = []
        for (const edge of state.edges) {
          // Only clone edges within the duplicated subgraph
          if (allNodeIds.includes(edge.sourceId) && allNodeIds.includes(edge.targetId)) {
            newEdges.push({
              id: `${idMap[edge.sourceId]}-${idMap[edge.targetId]}`,
              sourceId: idMap[edge.sourceId],
              targetId: idMap[edge.targetId],
            })
          }
        }

        // Update state
        set((state) => ({
          nodes: { ...state.nodes, ...newNodes },
          edges: [...state.edges, ...newEdges],
          selectedNodeId: idMap[nodeId],
        }))
        usePipelineRuntimeStore.getState().setNodesRuntime(newRuntime)
        usePipelineLayoutStore.getState().setNodesLayout(newLayout)

        return { newRootId: idMap[nodeId], idMap }
      },

      // ----------------------------------------
      // Computed Getters
      // ----------------------------------------

      getNode: (id) => get().nodes[id],

      getHydratedNode: (id) => {
        const state = get()
        const runtime = usePipelineRuntimeStore.getState().nodes
        const layout = usePipelineLayoutStore.getState().nodes
        const node = state.nodes[id]
        return node ? hydrateNode(node, state.edges, runtime, layout) : undefined
      },

      getHydratedNodes: () => {
        const state = get()
        const runtime = usePipelineRuntimeStore.getState().nodes
        const layout = usePipelineLayoutStore.getState().nodes
        return hydrateNodes(state.nodes, state.edges, runtime, layout)
      },

      getNodeChildren: (id) => getChildren(id, get().edges),

      getNodeParents: (id) => getParents(id, get().edges),

      getNodeDescendants: (id) => getDescendants(id, get().edges),

      getAllRootNodes: () => getRootNodes(get().nodes, get().edges),

      getDatasets: () => Object.values(get().nodes).filter((n): n is Dataset => n.type === 'dataset'),

      getViews: () => Object.values(get().nodes).filter((n): n is DataView => n.type === 'view'),

      getChartNodes: () => Object.values(get().nodes).filter((n): n is ChartNode => n.type === 'chart'),

      getExportNodes: () => Object.values(get().nodes).filter((n): n is ExportNode => n.type === 'export'),

      getPythonNodes: () => Object.values(get().nodes).filter((n): n is PythonNode => n.type === 'python'),

      // ----------------------------------------
      // Cloud Sync
      // ----------------------------------------

      setRemoteState: ({ nodes, edges }) => {
        // Full replacement of state from remote (used on initial sync)
        set({
          nodes,
          edges,
          // Reset selection if nodes are completely different
          activeNodeId: null,
          selectedNodeId: null,
          openNodeIds: [],
        })
        usePipelineRuntimeStore.getState().reset()
        usePipelineLayoutStore.getState().reset()
      },

      mergeRemoteState: ({ nodes: remoteNodes, edges: remoteEdges }) => {
        // Merge remote changes into local state (remote wins for conflicts)
        set((state) => {
          const newNodes = { ...state.nodes }

          // Add/update nodes from remote
          for (const [id, node] of Object.entries(remoteNodes)) {
            newNodes[id] = node
          }

          // Remove nodes that exist locally but not remotely
          for (const id of Object.keys(state.nodes)) {
            if (!(id in remoteNodes)) {
              delete newNodes[id]
            }
          }

          // Use remote edges (they're authoritative)
          const newEdges = remoteEdges

          // Update open tabs to only include nodes that still exist
          const nodeIds = new Set(Object.keys(newNodes))
          const newOpenIds = state.openNodeIds.filter((id) => nodeIds.has(id))

          // Update active/selected if they no longer exist
          const newActiveId = state.activeNodeId && nodeIds.has(state.activeNodeId) ? state.activeNodeId : null
          const newSelectedId = state.selectedNodeId && nodeIds.has(state.selectedNodeId) ? state.selectedNodeId : null

          return {
            nodes: newNodes,
            edges: newEdges,
            openNodeIds: newOpenIds,
            activeNodeId: newActiveId,
            selectedNodeId: newSelectedId,
          }
        })
        const runtimeState = usePipelineRuntimeStore.getState()
        const layoutState = usePipelineLayoutStore.getState()
        const existingIds = new Set(Object.keys(remoteNodes))
        runtimeState.removeNodesRuntime(Object.keys(runtimeState.nodes).filter((id) => !existingIds.has(id)))
        layoutState.removeNodesLayout(Object.keys(layoutState.nodes).filter((id) => !existingIds.has(id)))
      },
    }
  })
)

// ============================================
// SELECTORS (for optimized subscriptions)
// ============================================

export const selectActiveNode = (state: PipelineState & PipelineActions) =>
  state.activeNodeId ? state.nodes[state.activeNodeId] : null
