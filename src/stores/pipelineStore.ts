import { applyPatches, enablePatches, type Patch, produceWithPatches } from 'immer'
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { getChildren, getDescendants, getParents, getRootNodes } from '@/lib/graph'
import { generateId, generateShortId } from '@/lib/id'
import type { RequiredFile, SchemaValidationResult, SessionData } from '@/lib/pipeline/persistence'
import type {
  ChartNode,
  DashboardNode,
  Dataset,
  DataView,
  ExportNode,
  PipelineEdge,
  PipelineNode,
  PythonNode,
  ViewOperation,
} from '@/types'

// Enable Immer patches for efficient undo/redo
enablePatches()

// Snapshot-based undo/redo with optional Immer patches for efficiency
export interface PipelineSnapshot {
  nodes: Record<string, PipelineNode>
  edges: PipelineEdge[]
  activeNodeId: string | null
  selectedNodeId: string | null
  openNodeIds: string[]
  timestamp: number
  // Optional Immer patches for efficient storage (when using patch-based mutations)
  patches?: Patch[]
  inversePatches?: Patch[]
}

const MAX_UNDO_STACK_SIZE = 50

// Track edits made to views with children (for deferred branching)
interface PendingBranchEdit {
  viewId: string
  snapshotBefore: PipelineSnapshot
  pendingOperation?: ViewOperation // ViewOperation that was blocked and should be applied after branch decision
}

// Pending session state for when files need to be re-uploaded
interface PendingSession {
  data: SessionData
  providedFiles: Map<string, File>
}

// ============================================
// RESTORATION STATE
// ============================================

export type DatasetRestorationStatus =
  | 'embedded' // Data is embedded in session, no file needed
  | 'required' // Needs file, not yet provided
  | 'validating' // File provided, checking schema
  | 'provided' // File provided, schema valid
  | 'error' // Schema mismatch

export interface DatasetRestorationInfo {
  nodeId: string
  fileName: string
  status: DatasetRestorationStatus
  file?: File // The provided file (if any)
  validationResult?: SchemaValidationResult // Schema validation result (if validated)
  expectedColumns: RequiredFile['expectedColumns'] // Expected schema
  expectedHash?: string // Original file hash (if available)
  isExactMatch?: boolean // True if provided file hash matches original
}

export interface RestorationState {
  session: SessionData
  datasets: Map<string, DatasetRestorationInfo> // nodeId -> restoration info
  skippedDatasets: Set<string> // Datasets user chose to skip
}

// ============================================
// PIPELINE MODE (explicit state machine)
// ============================================

/**
 * Pipeline mode - only one mode can be active at a time.
 */
type PipelineMode =
  | { type: 'normal' }
  | { type: 'restoring'; state: RestorationState }
  | { type: 'branching'; viewId: string; snapshotBefore: PipelineSnapshot; pendingOperation?: ViewOperation }
  | { type: 'loading'; data: SessionData; providedFiles: Map<string, File> }

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

  // Loading/error/success state
  loading: boolean
  error: string | null
  successMessage: string | null

  // Pipeline mode (explicit state machine - only one mode active at a time)
  mode: PipelineMode

  // Version counter - incremented when data changes to trigger chart refreshes
  dataVersion: number

  // Track when nodes were last viewed (for sorting in command palette)
  nodeViewTimes: Record<string, number>

  // Current session ID for auto-save (null = no session yet, will be created on first save)
  currentSessionId: string | null
}

// ============================================
// ACTIONS INTERFACE
// ============================================

interface PipelineActions {
  // Dataset management
  addDataset: (dataset: Dataset) => void
  removeDataset: (id: string) => string[] // Returns removed view IDs for cleanup

  // View management
  addView: (view: DataView) => void
  removeView: (id: string) => string[] // Returns removed view IDs for cleanup
  updateView: (id: string, updates: Partial<DataView>) => void // Updates view and its edges

  // Chart/Export/Dashboard management (terminal nodes - no DuckDB views)
  addChartNode: (chart: ChartNode) => void
  addExportNode: (exportNode: ExportNode) => void
  addDashboardNode: (dashboard: DashboardNode) => void
  removeTerminalNode: (id: string) => string[] // Returns removed node IDs
  updateChartNode: (id: string, updates: Partial<ChartNode>) => void
  updateExportNode: (id: string, updates: Partial<ExportNode>) => void
  updateDashboardNode: (id: string, updates: Partial<DashboardNode>) => void

  // Python node management (creates DuckDB TABLE, not VIEW)
  addPythonNode: (pythonNode: PythonNode) => void
  removePythonNode: (id: string) => string[] // Returns removed node IDs
  updatePythonNode: (id: string, updates: Partial<PythonNode>) => void

  // Node operations
  updateNodePosition: (id: string, position: { x: number; y: number }) => void
  updateNodeName: (id: string, name: string) => void
  updateNodeRowCount: (id: string, rowCount: number) => void
  updateNode: (id: string, updates: Partial<PipelineNode>) => void
  updateNodes: (updates: Record<string, Partial<PipelineNode>>) => void // Batch update multiple nodes
  toggleNodeExpanded: (id: string) => void

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
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setSuccessMessage: (message: string | null) => void
  reset: () => void

  // Mode management (state machine)
  setMode: (mode: PipelineMode) => void
  enterRestorationMode: (state: RestorationState) => void
  exitRestorationMode: () => void
  enterBranchingMode: (viewId: string, snapshotBefore: PipelineSnapshot, pendingOperation?: ViewOperation) => void
  exitBranchingMode: () => void
  enterLoadingMode: (data: SessionData, providedFiles: Map<string, File>) => void
  exitLoadingMode: () => void
  updateDatasetRestoration: (nodeId: string, update: Partial<DatasetRestorationInfo>) => void
  skipDataset: (nodeId: string) => void
  unskipDataset: (nodeId: string) => void

  // Derived state from mode (computed by deriveFromMode)
  restorationState: RestorationState | null
  pendingBranchEdit: PendingBranchEdit | null
  pendingSession: PendingSession | null

  // Data version (for cache invalidation)
  bumpDataVersion: () => void

  // Session ID management
  setCurrentSessionId: (id: string | null) => void
  generateNewSessionId: () => string

  // Duplicate branch
  duplicateBranch: (nodeId: string) => { newRootId: string; idMap: Record<string, string> } | null

  // Computed getters (as functions)
  getNode: (id: string) => PipelineNode | undefined
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

// ============================================
// INITIAL STATE
// ============================================

// Helper to compute derived state from mode
function deriveFromMode(mode: PipelineMode): {
  restorationState: RestorationState | null
  pendingBranchEdit: PendingBranchEdit | null
  pendingSession: PendingSession | null
} {
  if (mode.type === 'restoring') {
    return { restorationState: mode.state, pendingBranchEdit: null, pendingSession: null }
  }
  if (mode.type === 'branching') {
    return {
      restorationState: null,
      pendingBranchEdit: {
        viewId: mode.viewId,
        snapshotBefore: mode.snapshotBefore,
        pendingOperation: mode.pendingOperation,
      },
      pendingSession: null,
    }
  }
  if (mode.type === 'loading') {
    return {
      restorationState: null,
      pendingBranchEdit: null,
      pendingSession: { data: mode.data, providedFiles: mode.providedFiles },
    }
  }
  return { restorationState: null, pendingBranchEdit: null, pendingSession: null }
}

const initialState: PipelineState & {
  restorationState: RestorationState | null
  pendingBranchEdit: PendingBranchEdit | null
  pendingSession: PendingSession | null
} = {
  nodes: {},
  edges: [],
  selectedNodeId: null,
  activeNodeId: null,
  openNodeIds: [],
  undoStack: [],
  redoStack: [],
  loading: false,
  error: null,
  successMessage: null,
  mode: { type: 'normal' },
  dataVersion: 0,
  nodeViewTimes: {},
  currentSessionId: null,
  // Derived from mode
  restorationState: null,
  pendingBranchEdit: null,
  pendingSession: null,
}

// ============================================
// STORE IMPLEMENTATION
// ============================================

export const usePipelineStore = create<PipelineState & PipelineActions>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // ----------------------------------------
    // Dataset Management
    // ----------------------------------------

    addDataset: (dataset) => {
      set((state) => ({
        nodes: { ...state.nodes, [dataset.id]: dataset },
        activeNodeId: dataset.id,
        selectedNodeId: dataset.id,
        openNodeIds: [...state.openNodeIds, dataset.id],
      }))
    },

    removeDataset: (id) => {
      const state = get()
      const descendants = getDescendants(id, state.edges)
      const allToRemove = [id, ...descendants]

      set((state) => {
        // Remove nodes
        const newNodes = { ...state.nodes }
        for (const nodeId of allToRemove) {
          delete newNodes[nodeId]
        }

        // Remove edges
        const removeSet = new Set(allToRemove)
        const newEdges = state.edges.filter((e) => !removeSet.has(e.sourceId) && !removeSet.has(e.targetId))

        // Update open tabs
        const newOpenIds = state.openNodeIds.filter((nid) => !removeSet.has(nid))

        // Update selection
        const newActiveId =
          state.activeNodeId && removeSet.has(state.activeNodeId)
            ? (newOpenIds[newOpenIds.length - 1] ?? null)
            : state.activeNodeId

        return {
          nodes: newNodes,
          edges: newEdges,
          openNodeIds: newOpenIds,
          activeNodeId: newActiveId,
          selectedNodeId: removeSet.has(state.selectedNodeId ?? '') ? null : state.selectedNodeId,
        }
      })

      return descendants // Return view IDs that need DuckDB cleanup
    },

    // ----------------------------------------
    // View Management
    // ----------------------------------------

    addView: (view) => {
      set((state) => {
        // Create edges from parents to this view
        const newEdges = [...state.edges]
        for (const parentId of view.parentIds) {
          newEdges.push({
            id: `${parentId}-${view.id}`,
            sourceId: parentId,
            targetId: view.id,
          })
        }

        return {
          nodes: { ...state.nodes, [view.id]: view },
          edges: newEdges,
          activeNodeId: view.id,
          selectedNodeId: view.id,
        }
      })
    },

    removeView: (id) => {
      const state = get()
      const node = state.nodes[id]
      if (!node || node.type !== 'view') return []

      const descendants = getDescendants(id, state.edges)
      const allToRemove = [id, ...descendants]

      set((state) => {
        // Remove nodes
        const newNodes = { ...state.nodes }
        for (const nodeId of allToRemove) {
          delete newNodes[nodeId]
        }

        // Remove edges
        const removeSet = new Set(allToRemove)
        const newEdges = state.edges.filter((e) => !removeSet.has(e.sourceId) && !removeSet.has(e.targetId))

        // Update open tabs
        const newOpenIds = state.openNodeIds.filter((nid) => !removeSet.has(nid))

        // Update selection
        const newActiveId =
          state.activeNodeId && removeSet.has(state.activeNodeId)
            ? (newOpenIds[newOpenIds.length - 1] ?? null)
            : state.activeNodeId

        return {
          nodes: newNodes,
          edges: newEdges,
          openNodeIds: newOpenIds,
          activeNodeId: newActiveId,
          selectedNodeId: removeSet.has(state.selectedNodeId ?? '') ? null : state.selectedNodeId,
        }
      })

      return allToRemove // Return all view IDs for DuckDB cleanup
    },

    updateView: (id, updates) => {
      set((state) => {
        const node = state.nodes[id]
        if (!node || node.type !== 'view') return state

        const view = node as DataView
        const updatedView = { ...view, ...updates } as DataView

        // If parentIds changed, update edges
        let newEdges = state.edges
        if (updates.parentIds) {
          // Remove old edges pointing to this view
          newEdges = state.edges.filter((e) => e.targetId !== id)
          // Add new edges from new parents
          for (const parentId of updates.parentIds) {
            newEdges.push({
              id: `${parentId}-${id}`,
              sourceId: parentId,
              targetId: id,
            })
          }
        }

        return {
          nodes: { ...state.nodes, [id]: updatedView },
          edges: newEdges,
        }
      })
    },

    // ----------------------------------------
    // Chart/Export Management (terminal nodes)
    // ----------------------------------------

    addChartNode: (chart) => {
      set((state) => {
        // Create edge from parent to chart
        const newEdge: PipelineEdge = {
          id: `${chart.parentId}-${chart.id}`,
          sourceId: chart.parentId,
          targetId: chart.id,
        }

        return {
          nodes: { ...state.nodes, [chart.id]: chart },
          edges: [...state.edges, newEdge],
          activeNodeId: chart.id,
          selectedNodeId: chart.id,
        }
      })
    },

    addExportNode: (exportNode) => {
      set((state) => {
        // Create edge from parent to export
        const newEdge: PipelineEdge = {
          id: `${exportNode.parentId}-${exportNode.id}`,
          sourceId: exportNode.parentId,
          targetId: exportNode.id,
        }

        return {
          nodes: { ...state.nodes, [exportNode.id]: exportNode },
          edges: [...state.edges, newEdge],
          activeNodeId: exportNode.id,
          selectedNodeId: exportNode.id,
        }
      })
    },

    removeTerminalNode: (id) => {
      const state = get()
      const node = state.nodes[id]
      if (!node || (node.type !== 'chart' && node.type !== 'export' && node.type !== 'dashboard')) return []

      // Terminal nodes have no descendants, just remove the node
      set((state) => {
        const newNodes = { ...state.nodes }
        delete newNodes[id]

        const newEdges = state.edges.filter((e) => e.targetId !== id)
        const newOpenIds = state.openNodeIds.filter((nid) => nid !== id)
        const newActiveId = state.activeNodeId === id ? (newOpenIds[newOpenIds.length - 1] ?? null) : state.activeNodeId

        return {
          nodes: newNodes,
          edges: newEdges,
          openNodeIds: newOpenIds,
          activeNodeId: newActiveId,
          selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
        }
      })

      return [id]
    },

    updateChartNode: (id, updates) => {
      set((state) => {
        const node = state.nodes[id]
        if (!node || node.type !== 'chart') return state

        const chart = node as ChartNode
        const updatedChart = { ...chart, ...updates } as ChartNode

        // If parentId changed, update edges
        let newEdges = state.edges
        if (updates.parentId && updates.parentId !== chart.parentId) {
          newEdges = state.edges.filter((e) => e.targetId !== id)
          newEdges.push({
            id: `${updates.parentId}-${id}`,
            sourceId: updates.parentId,
            targetId: id,
          })
        }

        return {
          nodes: { ...state.nodes, [id]: updatedChart },
          edges: newEdges,
        }
      })
    },

    updateExportNode: (id, updates) => {
      set((state) => {
        const node = state.nodes[id]
        if (!node || node.type !== 'export') return state

        const exportNode = node as ExportNode
        const updatedExport = { ...exportNode, ...updates } as ExportNode

        // If parentId changed, update edges
        let newEdges = state.edges
        if (updates.parentId && updates.parentId !== exportNode.parentId) {
          newEdges = state.edges.filter((e) => e.targetId !== id)
          newEdges.push({
            id: `${updates.parentId}-${id}`,
            sourceId: updates.parentId,
            targetId: id,
          })
        }

        return {
          nodes: { ...state.nodes, [id]: updatedExport },
          edges: newEdges,
        }
      })
    },

    addDashboardNode: (dashboard) => {
      set((state) => {
        // Create edges from all parent sources to dashboard
        const newEdges = [...state.edges]
        for (const parentId of dashboard.parentIds) {
          newEdges.push({
            id: `${parentId}-${dashboard.id}`,
            sourceId: parentId,
            targetId: dashboard.id,
          })
        }

        return {
          nodes: { ...state.nodes, [dashboard.id]: dashboard },
          edges: newEdges,
          activeNodeId: dashboard.id,
          selectedNodeId: dashboard.id,
        }
      })
    },

    updateDashboardNode: (id, updates) => {
      set((state) => {
        const node = state.nodes[id]
        if (!node || node.type !== 'dashboard') return state

        const dashboard = node as DashboardNode
        const updatedDashboard = { ...dashboard, ...updates } as DashboardNode

        // If parentIds changed, update edges
        let newEdges = state.edges
        if (updates.parentIds) {
          newEdges = state.edges.filter((e) => e.targetId !== id)
          for (const parentId of updates.parentIds) {
            newEdges.push({
              id: `${parentId}-${id}`,
              sourceId: parentId,
              targetId: id,
            })
          }
        }

        return {
          nodes: { ...state.nodes, [id]: updatedDashboard },
          edges: newEdges,
        }
      })
    },

    // ----------------------------------------
    // Python Node Management
    // ----------------------------------------

    addPythonNode: (pythonNode) => {
      set((state) => {
        // Create edge from parent to python node
        const newEdge: PipelineEdge = {
          id: `${pythonNode.parentId}-${pythonNode.id}`,
          sourceId: pythonNode.parentId,
          targetId: pythonNode.id,
        }

        return {
          nodes: { ...state.nodes, [pythonNode.id]: pythonNode },
          edges: [...state.edges, newEdge],
          activeNodeId: pythonNode.id,
          selectedNodeId: pythonNode.id,
        }
      })
    },

    removePythonNode: (id) => {
      const state = get()
      const node = state.nodes[id]
      if (!node || node.type !== 'python') return []

      // Python nodes can have descendants (they produce data)
      const descendants = getDescendants(id, state.edges)
      const allToRemove = [id, ...descendants]

      set((state) => {
        const newNodes = { ...state.nodes }
        for (const nodeId of allToRemove) {
          delete newNodes[nodeId]
        }

        const removeSet = new Set(allToRemove)
        const newEdges = state.edges.filter((e) => !removeSet.has(e.sourceId) && !removeSet.has(e.targetId))
        const newOpenIds = state.openNodeIds.filter((nid) => !removeSet.has(nid))
        const newActiveId =
          state.activeNodeId && removeSet.has(state.activeNodeId)
            ? (newOpenIds[newOpenIds.length - 1] ?? null)
            : state.activeNodeId

        return {
          nodes: newNodes,
          edges: newEdges,
          openNodeIds: newOpenIds,
          activeNodeId: newActiveId,
          selectedNodeId: removeSet.has(state.selectedNodeId ?? '') ? null : state.selectedNodeId,
        }
      })

      return allToRemove
    },

    updatePythonNode: (id, updates) => {
      set((state) => {
        const node = state.nodes[id]
        if (!node || node.type !== 'python') return state

        const pythonNode = node as PythonNode
        const updatedPythonNode = { ...pythonNode, ...updates } as PythonNode

        // If parentId changed, update edges
        let newEdges = state.edges
        if (updates.parentId && updates.parentId !== pythonNode.parentId) {
          newEdges = state.edges.filter((e) => e.targetId !== id)
          newEdges.push({
            id: `${updates.parentId}-${id}`,
            sourceId: updates.parentId,
            targetId: id,
          })
        }

        return {
          nodes: { ...state.nodes, [id]: updatedPythonNode },
          edges: newEdges,
        }
      })
    },

    // ----------------------------------------
    // Node ViewOperations
    // ----------------------------------------

    updateNodePosition: (id, position) => {
      set((state) => {
        const node = state.nodes[id]
        if (!node) return state
        return {
          nodes: {
            ...state.nodes,
            [id]: { ...node, position },
          },
        }
      })
    },

    updateNodeName: (id, name) => {
      set((state) => {
        const node = state.nodes[id]
        if (!node) return state
        return {
          nodes: {
            ...state.nodes,
            [id]: { ...node, name },
          },
        }
      })
    },

    updateNodeRowCount: (id, rowCount) => {
      set((state) => {
        const node = state.nodes[id]
        if (!node) return state
        return {
          nodes: {
            ...state.nodes,
            [id]: { ...node, rowCount },
          },
        }
      })
    },

    updateNode: (id, updates) => {
      set((state) => {
        const node = state.nodes[id]
        if (!node) return state
        return {
          nodes: {
            ...state.nodes,
            [id]: { ...node, ...updates } as PipelineNode,
          },
        }
      })
    },

    updateNodes: (updates) => {
      set((state) => {
        const newNodes = { ...state.nodes }
        for (const [id, patch] of Object.entries(updates)) {
          const node = newNodes[id]
          if (node) {
            newNodes[id] = { ...node, ...patch } as PipelineNode
          }
        }
        return { nodes: newNodes }
      })
    },

    toggleNodeExpanded: (id) => {
      set((state) => {
        const node = state.nodes[id]
        if (!node) return state
        return {
          nodes: {
            ...state.nodes,
            [id]: { ...node, isExpanded: !node.isExpanded } as PipelineNode,
          },
        }
      })
    },

    // ----------------------------------------
    // Selection
    // ----------------------------------------

    selectNode: (id) => set({ selectedNodeId: id }),

    setActiveNode: (id) =>
      set((state) => ({
        activeNodeId: id,
        nodeViewTimes: id ? { ...state.nodeViewTimes, [id]: Date.now() } : state.nodeViewTimes,
      })),

    // ----------------------------------------
    // Tab Management
    // ----------------------------------------

    openTab: (id) =>
      set((state) => ({
        openNodeIds: state.openNodeIds.includes(id) ? state.openNodeIds : [...state.openNodeIds, id],
        activeNodeId: id,
        nodeViewTimes: { ...state.nodeViewTimes, [id]: Date.now() },
      })),

    closeTab: (id) =>
      set((state) => {
        const newOpenIds = state.openNodeIds.filter((nid) => nid !== id)
        // If closing active tab, switch to last open tab or null
        const newActiveId = state.activeNodeId === id ? (newOpenIds[newOpenIds.length - 1] ?? null) : state.activeNodeId
        return {
          openNodeIds: newOpenIds,
          activeNodeId: newActiveId,
        }
      }),

    replaceActiveTab: (oldId, newId) =>
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
      }),

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

    setLoading: (loading) => set({ loading }),
    setError: (error) => set({ error }),
    setSuccessMessage: (successMessage) => set({ successMessage }),
    reset: () => set(initialState),

    // ----------------------------------------
    // Mode Management (State Machine)
    // ----------------------------------------

    setMode: (mode) => set({ mode, ...deriveFromMode(mode) }),

    enterRestorationMode: (state) => {
      const mode: PipelineMode = { type: 'restoring', state }
      set({ mode, ...deriveFromMode(mode) })
    },

    exitRestorationMode: () => {
      const mode: PipelineMode = { type: 'normal' }
      set({ mode, ...deriveFromMode(mode) })
    },

    enterBranchingMode: (viewId, snapshotBefore, pendingOperation) => {
      const mode: PipelineMode = { type: 'branching', viewId, snapshotBefore, pendingOperation }
      set({ mode, ...deriveFromMode(mode) })
    },

    exitBranchingMode: () => {
      const mode: PipelineMode = { type: 'normal' }
      set({ mode, ...deriveFromMode(mode) })
    },

    enterLoadingMode: (data, providedFiles) => {
      const mode: PipelineMode = { type: 'loading', data, providedFiles }
      set({ mode, ...deriveFromMode(mode) })
    },

    exitLoadingMode: () => {
      const mode: PipelineMode = { type: 'normal' }
      set({ mode, ...deriveFromMode(mode) })
    },

    updateDatasetRestoration: (nodeId, update) =>
      set((state) => {
        if (state.mode.type !== 'restoring') return state
        const datasets = new Map(state.mode.state.datasets)
        const existing = datasets.get(nodeId)
        if (!existing) return state
        datasets.set(nodeId, { ...existing, ...update })
        const newMode: PipelineMode = {
          type: 'restoring',
          state: {
            ...state.mode.state,
            datasets,
          },
        }
        return { mode: newMode, ...deriveFromMode(newMode) }
      }),

    skipDataset: (nodeId) =>
      set((state) => {
        if (state.mode.type !== 'restoring') return state
        const skippedDatasets = new Set(state.mode.state.skippedDatasets)
        skippedDatasets.add(nodeId)
        const newMode: PipelineMode = {
          type: 'restoring',
          state: {
            ...state.mode.state,
            skippedDatasets,
          },
        }
        return { mode: newMode, ...deriveFromMode(newMode) }
      }),

    unskipDataset: (nodeId) =>
      set((state) => {
        if (state.mode.type !== 'restoring') return state
        const skippedDatasets = new Set(state.mode.state.skippedDatasets)
        skippedDatasets.delete(nodeId)
        const newMode: PipelineMode = {
          type: 'restoring',
          state: {
            ...state.mode.state,
            skippedDatasets,
          },
        }
        return { mode: newMode, ...deriveFromMode(newMode) }
      }),

    bumpDataVersion: () => set((state) => ({ dataVersion: state.dataVersion + 1 })),

    // ----------------------------------------
    // Session ID Management
    // ----------------------------------------

    setCurrentSessionId: (id) => set({ currentSessionId: id }),
    generateNewSessionId: () => {
      const id = generateId('session', 6)
      set({ currentSessionId: id })
      return id
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

      // Clone all nodes
      const newNodes: Record<string, PipelineNode> = {}
      for (const id of allNodeIds) {
        const original = state.nodes[id]
        if (!original) continue

        const newId = idMap[id]
        const baseClone = {
          ...original,
          id: newId,
          name: id === nodeId ? `${original.name} (copy)` : original.name,
          tableName: `${original.tableName}_copy_${newId.slice(-4)}`,
          position: {
            x: original.position.x + 300,
            y: original.position.y + 50,
          },
          createdAt: new Date(),
        }

        if (original.type === 'view') {
          const view = original as DataView
          newNodes[newId] = {
            ...baseClone,
            type: 'view',
            parentIds: view.parentIds.map((pid) => idMap[pid] || pid),
            operation: { ...view.operation },
            viewSql: '', // Will need to be regenerated by the caller
          } as DataView
        } else if (original.type === 'chart') {
          const chart = original as ChartNode
          newNodes[newId] = {
            ...baseClone,
            type: 'chart',
            parentId: idMap[chart.parentId] || chart.parentId,
            config: { ...chart.config },
          } as ChartNode
        } else if (original.type === 'export') {
          const exportNode = original as ExportNode
          newNodes[newId] = {
            ...baseClone,
            type: 'export',
            parentId: idMap[exportNode.parentId] || exportNode.parentId,
            config: { ...exportNode.config },
          } as ExportNode
        } else if (original.type === 'dataset') {
          // Datasets are root nodes - keep the original parent reference
          newNodes[newId] = {
            ...baseClone,
            type: 'dataset',
          } as Dataset
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

      return { newRootId: idMap[nodeId], idMap }
    },

    // ----------------------------------------
    // Computed Getters
    // ----------------------------------------

    getNode: (id) => get().nodes[id],

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
    },
  }))
)

// ============================================
// SELECTORS (for optimized subscriptions)
// ============================================

export const selectActiveNode = (state: PipelineState & PipelineActions) =>
  state.activeNodeId ? state.nodes[state.activeNodeId] : null
