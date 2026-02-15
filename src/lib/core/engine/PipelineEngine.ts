import { getChildren, getDescendants, getParents } from '@/lib/graph'
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
import type { CommandResult, PipelineCommand, PipelineEffect, PipelineSnapshot, PipelineState } from './types'

const MAX_UNDO_STACK_SIZE = 50

/**
 * Pure pipeline engine - all mutations return { state, effects } with no side effects.
 * Side effects are executed by adapters (usePipeline, PipelineService).
 */
// biome-ignore lint/complexity/noStaticOnlyClass: intentional - groups related pure functions under a namespace
export class PipelineEngine {
  private static addEdgesForNode(edges: PipelineEdge[], nodeId: string, parentIds: string[]): PipelineEdge[] {
    if (parentIds.length === 0) return edges
    const nextEdges = [...edges]
    for (const parentId of parentIds) {
      nextEdges.push({
        id: `${parentId}-${nodeId}`,
        sourceId: parentId,
        targetId: nodeId,
      })
    }
    return nextEdges
  }

  private static replaceEdgesForNode(edges: PipelineEdge[], nodeId: string, parentIds: string[]): PipelineEdge[] {
    const nextEdges = edges.filter((edge) => edge.targetId !== nodeId)
    return PipelineEngine.addEdgesForNode(nextEdges, nodeId, parentIds)
  }

  private static addNode(
    state: PipelineState,
    node: PipelineNode,
    parentIds: string[],
    options?: { openTab?: boolean }
  ): PipelineState {
    const edges = PipelineEngine.addEdgesForNode(state.edges, node.id, parentIds)
    const openNodeIds = options?.openTab
      ? state.openNodeIds.includes(node.id)
        ? state.openNodeIds
        : [...state.openNodeIds, node.id]
      : state.openNodeIds

    return {
      ...state,
      nodes: { ...state.nodes, [node.id]: node },
      edges,
      activeNodeId: node.id,
      selectedNodeId: node.id,
      openNodeIds,
    }
  }

  /**
   * Execute a command and return the new state plus effects to execute.
   */
  static execute(state: PipelineState, command: PipelineCommand): CommandResult {
    switch (command.type) {
      case 'addDataset':
        return PipelineEngine.addDataset(state, command.dataset, command.suppressEffects)

      case 'addView':
        return PipelineEngine.addView(state, command.view, command.parentIds, command.suppressEffects)

      case 'addChartNode':
        return PipelineEngine.addChartNode(state, command.chart, command.parentId)

      case 'addExportNode':
        return PipelineEngine.addExportNode(state, command.exportNode, command.parentId)

      case 'addDashboardNode':
        return PipelineEngine.addDashboardNode(state, command.dashboard, command.parentIds, command.suppressEffects)

      case 'addPythonNode':
        return PipelineEngine.addPythonNode(state, command.pythonNode, command.parentId)

      case 'removeNode':
        return PipelineEngine.removeNode(state, command.nodeId, command.cascade, command.suppressEffects)

      case 'updateNode':
        return PipelineEngine.updateNode(state, command.nodeId, command.updates)

      case 'updateNodes':
        return PipelineEngine.updateNodes(state, command.updates, command.suppressEffects)

      case 'setNodeParents':
        return PipelineEngine.setNodeParents(state, command.nodeId, command.parentIds, command.suppressEffects)

      case 'setActiveNode':
        return PipelineEngine.setActiveNode(state, command.nodeId)

      case 'selectNode':
        return PipelineEngine.selectNode(state, command.nodeId)

      case 'openTab':
        return PipelineEngine.openTab(state, command.nodeId)

      case 'closeTab':
        return PipelineEngine.closeTab(state, command.nodeId)

      case 'undo':
        return PipelineEngine.undo(state)

      case 'redo':
        return PipelineEngine.redo(state)

      case 'captureSnapshot':
        return PipelineEngine.captureSnapshot(state)

      default:
        // Unknown command - return unchanged state
        return { state, effects: [] }
    }
  }

  /**
   * Add a dataset to the pipeline.
   */
  private static addDataset(state: PipelineState, dataset: Dataset, suppressEffects = false): CommandResult {
    const newState = PipelineEngine.addNode(state, dataset, [], { openTab: true })
    const effects: PipelineEffect[] = suppressEffects ? [] : [{ type: 'persist.markDirty' }]

    return { state: newState, effects }
  }

  /**
   * Add a view with edges from parent.
   */
  private static addView(
    state: PipelineState,
    view: DataView,
    parentIds: string[],
    suppressEffects = false
  ): CommandResult {
    const newState = PipelineEngine.addNode(state, view, parentIds)

    const effects: PipelineEffect[] = suppressEffects ? [] : [{ type: 'persist.markDirty' }]

    return { state: newState, effects }
  }

  private static addChartNode(state: PipelineState, chart: ChartNode, parentId: string): CommandResult {
    const newState = PipelineEngine.addNode(state, chart, parentId ? [parentId] : [])
    const effects: PipelineEffect[] = [{ type: 'persist.markDirty' }]

    return { state: newState, effects }
  }

  private static addExportNode(state: PipelineState, exportNode: ExportNode, parentId: string): CommandResult {
    const newState = PipelineEngine.addNode(state, exportNode, parentId ? [parentId] : [])
    const effects: PipelineEffect[] = [{ type: 'persist.markDirty' }]

    return { state: newState, effects }
  }

  private static addDashboardNode(
    state: PipelineState,
    dashboard: DashboardNode,
    parentIds: string[],
    suppressEffects = false
  ): CommandResult {
    const newState = PipelineEngine.addNode(state, dashboard, parentIds)
    const effects: PipelineEffect[] = suppressEffects ? [] : [{ type: 'persist.markDirty' }]

    return { state: newState, effects }
  }

  private static addPythonNode(state: PipelineState, pythonNode: PythonNode, parentId: string): CommandResult {
    const newState = PipelineEngine.addNode(state, pythonNode, parentId ? [parentId] : [])
    const effects: PipelineEffect[] = [{ type: 'persist.markDirty' }]

    return { state: newState, effects }
  }

  /**
   * Remove a node (and optionally cascade to descendants).
   */
  private static removeNode(
    state: PipelineState,
    nodeId: string,
    cascade = true,
    suppressEffects = false
  ): CommandResult {
    const node = state.nodes[nodeId]
    if (!node) {
      return { state, effects: [] }
    }

    const effects: PipelineEffect[] = []
    let allToRemove: string[]

    if (cascade) {
      const descendants = getDescendants(nodeId, state.edges)
      allToRemove = [nodeId, ...descendants]
    } else {
      allToRemove = [nodeId]
    }

    // Remove nodes
    const newNodes = { ...state.nodes }
    for (const id of allToRemove) {
      delete newNodes[id]
    }

    // Remove edges
    const removeSet = new Set(allToRemove)
    const newEdges = state.edges.filter((e) => !removeSet.has(e.sourceId) && !removeSet.has(e.targetId))

    // Update open tabs
    const newOpenIds = state.openNodeIds.filter((id) => !removeSet.has(id))

    // Update selection
    let newActiveId = state.activeNodeId
    if (state.activeNodeId && removeSet.has(state.activeNodeId)) {
      newActiveId = newOpenIds[newOpenIds.length - 1] ?? null
    }

    const newState: PipelineState = {
      ...state,
      nodes: newNodes,
      edges: newEdges,
      openNodeIds: newOpenIds,
      activeNodeId: newActiveId,
      selectedNodeId: removeSet.has(state.selectedNodeId ?? '') ? null : state.selectedNodeId,
    }

    if (!suppressEffects) {
      effects.push({ type: 'persist.markDirty' })
    }

    return { state: newState, effects }
  }

  /**
   * Update a node's properties.
   */
  private static updateNode(state: PipelineState, nodeId: string, updates: Partial<PipelineNode>): CommandResult {
    const node = state.nodes[nodeId]
    if (!node) {
      return { state, effects: [] }
    }

    const updatedNode = { ...node, ...updates } as PipelineNode

    const newState: PipelineState = {
      ...state,
      nodes: { ...state.nodes, [nodeId]: updatedNode },
      edges: state.edges,
    }

    const effects: PipelineEffect[] = []

    return { state: newState, effects }
  }

  private static updateNodes(
    state: PipelineState,
    updates: Record<string, Partial<PipelineNode>>,
    suppressEffects = false
  ): CommandResult {
    let nextState = state
    const effects: PipelineEffect[] = []

    for (const [nodeId, patch] of Object.entries(updates)) {
      const result = PipelineEngine.updateNode(nextState, nodeId, patch)
      nextState = result.state
      if (!suppressEffects) {
        effects.push(...result.effects)
      }
    }

    return { state: nextState, effects }
  }

  private static setNodeParents(
    state: PipelineState,
    nodeId: string,
    parentIds: string[],
    suppressEffects = false
  ): CommandResult {
    if (!state.nodes[nodeId]) {
      return { state, effects: [] }
    }

    const newEdges = PipelineEngine.replaceEdgesForNode(state.edges, nodeId, parentIds)
    const effects: PipelineEffect[] = suppressEffects ? [] : [{ type: 'persist.markDirty' }]

    return { state: { ...state, edges: newEdges }, effects }
  }

  /**
   * Set the active node.
   */
  private static setActiveNode(state: PipelineState, nodeId: string | null): CommandResult {
    const newState: PipelineState = {
      ...state,
      activeNodeId: nodeId,
    }

    return { state: newState, effects: [] }
  }

  /**
   * Select a node.
   */
  private static selectNode(state: PipelineState, nodeId: string | null): CommandResult {
    const newState: PipelineState = {
      ...state,
      selectedNodeId: nodeId,
    }

    return { state: newState, effects: [] }
  }

  /**
   * Open a tab for a node.
   */
  private static openTab(state: PipelineState, nodeId: string): CommandResult {
    const newOpenIds = state.openNodeIds.includes(nodeId) ? state.openNodeIds : [...state.openNodeIds, nodeId]

    const newState: PipelineState = {
      ...state,
      openNodeIds: newOpenIds,
      activeNodeId: nodeId,
    }

    return { state: newState, effects: [] }
  }

  /**
   * Close a tab.
   */
  private static closeTab(state: PipelineState, nodeId: string): CommandResult {
    const newOpenIds = state.openNodeIds.filter((id) => id !== nodeId)
    const newActiveId = state.activeNodeId === nodeId ? (newOpenIds[newOpenIds.length - 1] ?? null) : state.activeNodeId

    const newState: PipelineState = {
      ...state,
      openNodeIds: newOpenIds,
      activeNodeId: newActiveId,
    }

    return { state: newState, effects: [] }
  }

  /**
   * Capture current state as a snapshot (for undo).
   */
  private static captureSnapshot(state: PipelineState): CommandResult {
    const snapshot: PipelineSnapshot = {
      nodes: structuredClone(state.nodes),
      edges: structuredClone(state.edges),
      activeNodeId: state.activeNodeId,
      selectedNodeId: state.selectedNodeId,
      openNodeIds: [...state.openNodeIds],
      timestamp: Date.now(),
    }

    const newUndoStack = [...state.undoStack, snapshot]
    if (newUndoStack.length > MAX_UNDO_STACK_SIZE) {
      newUndoStack.shift()
    }

    const newState: PipelineState = {
      ...state,
      undoStack: newUndoStack,
      redoStack: [], // Clear redo on new action
    }

    return { state: newState, effects: [] }
  }

  /**
   * Undo the last action.
   */
  private static undo(state: PipelineState): CommandResult {
    if (state.undoStack.length === 0) {
      return { state, effects: [] }
    }

    // Capture current state for redo
    const currentSnapshot: PipelineSnapshot = {
      nodes: structuredClone(state.nodes),
      edges: structuredClone(state.edges),
      activeNodeId: state.activeNodeId,
      selectedNodeId: state.selectedNodeId,
      openNodeIds: [...state.openNodeIds],
      timestamp: Date.now(),
    }

    const newRedoStack = [...state.redoStack, currentSnapshot]
    if (newRedoStack.length > MAX_UNDO_STACK_SIZE) {
      newRedoStack.shift()
    }

    // Restore previous state
    const previousSnapshot = state.undoStack[state.undoStack.length - 1]
    const newUndoStack = state.undoStack.slice(0, -1)

    // Compute which views need to be recreated vs dropped
    const effects = PipelineEngine.computeViewDiffEffects(state, previousSnapshot)

    const newState: PipelineState = {
      ...state,
      nodes: previousSnapshot.nodes,
      edges: previousSnapshot.edges,
      activeNodeId: previousSnapshot.activeNodeId,
      selectedNodeId: previousSnapshot.selectedNodeId,
      openNodeIds: previousSnapshot.openNodeIds.filter((id) => id in previousSnapshot.nodes),
      undoStack: newUndoStack,
      redoStack: newRedoStack,
    }

    return { state: newState, effects }
  }

  /**
   * Redo the last undone action.
   */
  private static redo(state: PipelineState): CommandResult {
    if (state.redoStack.length === 0) {
      return { state, effects: [] }
    }

    // Capture current state for undo
    const currentSnapshot: PipelineSnapshot = {
      nodes: structuredClone(state.nodes),
      edges: structuredClone(state.edges),
      activeNodeId: state.activeNodeId,
      selectedNodeId: state.selectedNodeId,
      openNodeIds: [...state.openNodeIds],
      timestamp: Date.now(),
    }

    const newUndoStack = [...state.undoStack, currentSnapshot]
    if (newUndoStack.length > MAX_UNDO_STACK_SIZE) {
      newUndoStack.shift()
    }

    // Restore redo state
    const nextSnapshot = state.redoStack[state.redoStack.length - 1]
    const newRedoStack = state.redoStack.slice(0, -1)

    // Compute which views need to be recreated vs dropped
    const effects = PipelineEngine.computeViewDiffEffects(state, nextSnapshot)

    const newState: PipelineState = {
      ...state,
      nodes: nextSnapshot.nodes,
      edges: nextSnapshot.edges,
      activeNodeId: nextSnapshot.activeNodeId,
      selectedNodeId: nextSnapshot.selectedNodeId,
      openNodeIds: nextSnapshot.openNodeIds.filter((id) => id in nextSnapshot.nodes),
      undoStack: newUndoStack,
      redoStack: newRedoStack,
    }

    return { state: newState, effects }
  }

  /**
   * Compute effects needed to transition from current state to target snapshot.
   */
  private static computeViewDiffEffects(_current: PipelineState, _target: PipelineSnapshot): PipelineEffect[] {
    return []
  }

  // ========================================
  // Pure utility functions
  // ========================================

  /**
   * Get children of a node.
   */
  static getChildren(nodeId: string, edges: PipelineEdge[]): string[] {
    return getChildren(nodeId, edges)
  }

  /**
   * Get parents of a node.
   */
  static getParents(nodeId: string, edges: PipelineEdge[]): string[] {
    return getParents(nodeId, edges)
  }

  /**
   * Get all descendants of a node.
   */
  static getDescendants(nodeId: string, edges: PipelineEdge[]): string[] {
    return getDescendants(nodeId, edges)
  }
}
