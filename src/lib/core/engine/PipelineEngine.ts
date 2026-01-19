import { getChildren, getDescendants, getParents } from '@/lib/graph'
import type { Dataset, DataView, PipelineEdge, PipelineNode } from '@/types'
import type { CommandResult, PipelineCommand, PipelineEffect, PipelineSnapshot, PipelineState } from './types'

const MAX_UNDO_STACK_SIZE = 50

/**
 * Pure pipeline engine - all mutations return { state, effects } with no side effects.
 * Side effects are executed by adapters (usePipeline, PipelineService).
 */
// biome-ignore lint/complexity/noStaticOnlyClass: intentional - groups related pure functions under a namespace
export class PipelineEngine {
  /**
   * Execute a command and return the new state plus effects to execute.
   */
  static execute(state: PipelineState, command: PipelineCommand): CommandResult {
    switch (command.type) {
      case 'addDataset':
        return PipelineEngine.addDataset(state, command.dataset)

      case 'addView':
        return PipelineEngine.addView(state, command.view, command.parentId)

      case 'removeNode':
        return PipelineEngine.removeNode(state, command.nodeId, command.cascade)

      case 'updateNode':
        return PipelineEngine.updateNode(state, command.nodeId, command.updates)

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
  private static addDataset(state: PipelineState, dataset: Dataset): CommandResult {
    const newState: PipelineState = {
      ...state,
      nodes: { ...state.nodes, [dataset.id]: dataset },
      activeNodeId: dataset.id,
      selectedNodeId: dataset.id,
      openNodeIds: [...state.openNodeIds, dataset.id],
    }

    const effects: PipelineEffect[] = [{ type: 'persist.markDirty' }]

    return { state: newState, effects }
  }

  /**
   * Add a view with edges from parent.
   */
  private static addView(state: PipelineState, view: DataView, parentId: string): CommandResult {
    // Create edges from all parents to this view
    const newEdges = [...state.edges]
    for (const pid of view.parentIds) {
      newEdges.push({
        id: `${pid}-${view.id}`,
        sourceId: pid,
        targetId: view.id,
      })
    }

    const newState: PipelineState = {
      ...state,
      nodes: { ...state.nodes, [view.id]: view },
      edges: newEdges,
      activeNodeId: view.id,
      selectedNodeId: view.id,
    }

    const effects: PipelineEffect[] = [
      {
        type: 'duckdb.createView',
        viewName: view.tableName,
        sql: view.viewSql,
        parentTableName: parentId,
      },
      { type: 'persist.markDirty' },
    ]

    return { state: newState, effects }
  }

  /**
   * Remove a node (and optionally cascade to descendants).
   */
  private static removeNode(state: PipelineState, nodeId: string, cascade = true): CommandResult {
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

    // Collect views to drop
    const viewsToDrop: string[] = []
    for (const id of allToRemove) {
      const n = state.nodes[id]
      if (n && n.type === 'view') {
        viewsToDrop.push((n as DataView).tableName)
      }
    }

    if (viewsToDrop.length > 0) {
      effects.push({ type: 'duckdb.dropViews', viewNames: viewsToDrop })
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

    effects.push({ type: 'persist.markDirty' })

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

    // If parentIds changed for a view, update edges
    let newEdges = state.edges
    if ('parentIds' in updates && node.type === 'view') {
      newEdges = state.edges.filter((e) => e.targetId !== nodeId)
      for (const parentId of (updates as Partial<DataView>).parentIds!) {
        newEdges.push({
          id: `${parentId}-${nodeId}`,
          sourceId: parentId,
          targetId: nodeId,
        })
      }
    }

    const newState: PipelineState = {
      ...state,
      nodes: { ...state.nodes, [nodeId]: updatedNode },
      edges: newEdges,
    }

    const effects: PipelineEffect[] = []

    // If view SQL changed, update the DuckDB view
    if ('viewSql' in updates && node.type === 'view') {
      effects.push({
        type: 'duckdb.updateView',
        viewName: (node as DataView).tableName,
        sql: (updates as Partial<DataView>).viewSql!,
      })
    }

    return { state: newState, effects }
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
  private static computeViewDiffEffects(current: PipelineState, target: PipelineSnapshot): PipelineEffect[] {
    const effects: PipelineEffect[] = []

    const currentViews = new Map<string, DataView>()
    const targetViews = new Map<string, DataView>()

    for (const node of Object.values(current.nodes)) {
      if (node.type === 'view') {
        currentViews.set(node.id, node as DataView)
      }
    }

    for (const node of Object.values(target.nodes)) {
      if (node.type === 'view') {
        targetViews.set(node.id, node as DataView)
      }
    }

    // Views to drop (in current but not in target)
    const viewsToDrop: string[] = []
    for (const [id, view] of currentViews) {
      if (!targetViews.has(id)) {
        viewsToDrop.push(view.tableName)
      }
    }

    if (viewsToDrop.length > 0) {
      effects.push({ type: 'duckdb.dropViews', viewNames: viewsToDrop })
    }

    // Views to create (in target but not in current)
    for (const [id, view] of targetViews) {
      if (!currentViews.has(id)) {
        const parentId = view.parentIds[0]
        const parent = target.nodes[parentId]
        const parentTableName =
          parent?.type === 'dataset' ? (parent as Dataset).tableName : (parent as DataView)?.tableName

        if (parentTableName) {
          effects.push({
            type: 'duckdb.createView',
            viewName: view.tableName,
            sql: view.viewSql,
            parentTableName,
          })
        }
      }
    }

    return effects
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
