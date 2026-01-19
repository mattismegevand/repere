import { useCallback, useMemo } from 'react'
import { getChildren, getParents, usePipelineStore } from '@/stores/pipelineStore'
import type { DataView } from '@/types'
import { useDatasets } from './hooks/useDatasets'
import { useSession } from './hooks/useSession'
import { useUndoRedo } from './hooks/useUndoRedo'
import { useViewOperations } from './hooks/useViewOperations'
import { usePipelineServiceOptional } from './PipelineProvider'

/**
 * Composed hook that provides the same interface as the old usePipeline.
 * Uses focused hooks internally for better organization.
 */
export function usePipeline() {
  const service = usePipelineServiceOptional()
  const store = usePipelineStore()
  const { loading, error, successMessage, setLoading, setError, setSuccessMessage } = usePipelineStore()

  // Compose focused hooks
  const datasets = useDatasets()
  const views = useViewOperations()
  const history = useUndoRedo()
  const session = useSession()

  // Get active node
  const activeNode = store.activeNodeId ? store.nodes[store.activeNodeId] : null
  const selectedNode = store.selectedNodeId ? store.nodes[store.selectedNodeId] : null

  // Get path to active node for breadcrumb
  const getPathToNode = useCallback(
    (nodeId: string): string[] => {
      const path: string[] = []
      let currentId: string | undefined = nodeId

      while (currentId) {
        path.unshift(currentId)
        const parents = store.getNodeParents(currentId)
        currentId = parents[0]
      }

      return path
    },
    [store]
  )

  const activeNodePath = useMemo(
    () => (store.activeNodeId ? getPathToNode(store.activeNodeId) : []),
    [store.activeNodeId, getPathToNode]
  )

  // Navigation
  const goToParent = useCallback(() => {
    if (!store.activeNodeId) return

    const parents = store.getNodeParents(store.activeNodeId)
    if (parents.length > 0) {
      store.setActiveNode(parents[0])
    }
  }, [store])

  const canDeleteSafely = useCallback(
    (nodeId: string): boolean => {
      const children = store.getNodeChildren(nodeId)
      return children.length === 0
    },
    [store]
  )

  // Remove current operation
  const removeCurrentOperation = useCallback(async (): Promise<{
    success: boolean
    needsConfirmation?: boolean
    descendantCount?: number
  }> => {
    const state = usePipelineStore.getState()
    const currentActiveNodeId = state.activeNodeId

    if (!currentActiveNodeId) return { success: false }

    const currentNode = state.nodes[currentActiveNodeId]
    if (!currentNode || currentNode.type !== 'view') {
      return { success: false }
    }

    const children = getChildren(currentActiveNodeId, state.edges)
    if (children.length > 0) {
      const descendants = store.getNodeDescendants(currentActiveNodeId)
      return {
        success: false,
        needsConfirmation: true,
        descendantCount: descendants.length,
      }
    }

    const parentIds = getParents(currentActiveNodeId, state.edges)
    const parentId = parentIds[0]

    await views.deleteNode(currentActiveNodeId)

    if (parentId) {
      store.setActiveNode(parentId)
    }

    return { success: true }
  }, [views, store])

  const forceRemoveCurrentOperation = useCallback(async (): Promise<boolean> => {
    const state = usePipelineStore.getState()
    const currentActiveNodeId = state.activeNodeId

    if (!currentActiveNodeId) return false

    const currentNode = state.nodes[currentActiveNodeId]
    if (!currentNode || currentNode.type !== 'view') return false

    const parentIds = getParents(currentActiveNodeId, state.edges)
    const parentId = parentIds[0]

    await views.deleteNode(currentActiveNodeId)

    if (parentId) {
      store.setActiveNode(parentId)
    }

    return true
  }, [views, store])

  // Delete node and reconnect children (for collapsing node chains)
  const deleteNodeAndReconnect = useCallback(
    async (nodeId: string): Promise<boolean> => {
      if (!service) return false

      const node = store.getNode(nodeId)
      if (!node || node.type !== 'view') return false

      const view = node as DataView
      const parents = store.getNodeParents(nodeId)
      if (parents.length !== 1) return false

      const parentId = parents[0]
      const parent = store.getNode(parentId)
      if (!parent) return false

      const children = store.getNodeChildren(nodeId)
      if (children.length === 0) {
        await views.deleteNode(nodeId)
        return true
      }

      setLoading(true)
      setError(null)

      try {
        for (const childId of children) {
          const child = store.getNode(childId)
          if (!child || child.type !== 'view') continue

          const childView = child as DataView
          const operation = childView.operation
          const otherParents = childView.parentIds.filter((id) => id !== nodeId)

          const newView = await views.applyOperation(parentId, operation, otherParents)
          if (newView) {
            usePipelineStore.getState().replaceActiveTab(childId, newView.id)

            const grandchildren = store.getNodeChildren(childId)
            for (const gcId of grandchildren) {
              const gc = store.getNode(gcId)
              if (gc && gc.type === 'view') {
                const gcView = gc as DataView
                const newParentIds = gcView.parentIds.map((pid) => (pid === childId ? newView.id : pid))
                usePipelineStore.getState().updateView(gcId, { parentIds: newParentIds })
              }
            }
          }

          await service.dropView(childView.tableName)
        }

        await service.dropView(view.tableName)

        const state = usePipelineStore.getState()
        const newNodes = { ...state.nodes }
        delete newNodes[nodeId]

        const newEdges = state.edges.filter((e) => e.sourceId !== nodeId && e.targetId !== nodeId)

        usePipelineStore.setState({ nodes: newNodes, edges: newEdges })

        if (state.activeNodeId === nodeId) {
          usePipelineStore.getState().setActiveNode(parentId)
        }
        if (state.selectedNodeId === nodeId) {
          usePipelineStore.getState().selectNode(null)
        }

        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to reconnect children')
        return false
      } finally {
        setLoading(false)
      }
    },
    [service, store, views, setLoading, setError]
  )

  // Cleanup orphans
  const cleanupOrphans = useCallback(async () => {
    if (!service) return

    try {
      const trackedViewNames = new Set(
        Object.values(store.nodes)
          .filter((n): n is DataView => n.type === 'view')
          .map((v) => v.tableName)
      )

      await service.cleanupOrphanedViews(trackedViewNames)
    } catch (err) {
      console.error('Failed to cleanup orphaned views:', err)
    }
  }, [service, store])

  // Clear all data
  const clearAllData = useCallback(async () => {
    if (!service) {
      store.reset()
      return
    }

    setLoading(true)
    try {
      await service.clearAll(store.nodes)
    } catch (err) {
      console.error('Error clearing data:', err)
    } finally {
      setLoading(false)
      store.reset()
    }
  }, [service, store, setLoading])

  // Branch from snapshot (for deferred branching)
  const createBranchFromSnapshot = useCallback(
    async (
      snapshot: Parameters<typeof history.restoreSnapshotWithDuckDB>[0],
      modifiedOperation: Parameters<typeof views.applyOperation>[1]
    ): Promise<DataView | null> => {
      if (!service) return null

      const state = usePipelineStore.getState()
      const pendingEdit = state.pendingBranchEdit
      if (!pendingEdit) return null

      const viewId = pendingEdit.viewId
      const currentView = state.nodes[viewId] as DataView | undefined
      if (!currentView || currentView.type !== 'view') return null

      const parentIds = getParents(viewId, state.edges)
      const parentId = parentIds[0]
      if (!parentId) return null

      const restored = await history.restoreSnapshotWithDuckDB(snapshot)
      if (!restored) return null

      const parentNode = usePipelineStore.getState().nodes[parentId]
      if (!parentNode) return null

      const children = getChildren(parentId, usePipelineStore.getState().edges)
      const yOffset = children.length * 80
      const position = {
        x: parentNode.position.x + 350,
        y: parentNode.position.y + yOffset,
      }

      try {
        const view = await service.createView(parentNode, modifiedOperation, undefined, position)
        store.addView(view)
        usePipelineStore.getState().replaceActiveTab(viewId, view.id)
        return view
      } catch (err) {
        console.error('Failed to create branch:', err)
        return null
      }
    },
    [service, store, history, views]
  )

  return {
    // State
    serviceReady: !!service,
    nodes: store.nodes,
    edges: store.edges,
    activeNodeId: store.activeNodeId,
    selectedNodeId: store.selectedNodeId,
    activeNode,
    selectedNode,
    loading,
    error,
    successMessage,

    // Dataset actions
    loadDataset: datasets.loadDataset,
    loadDatasetFromPicked: datasets.loadDatasetFromPicked,
    fillPlaceholder: datasets.fillPlaceholder,
    replaceDataset: datasets.replaceDataset,

    // View actions
    applyOperation: views.applyOperation,
    applyJoin: views.applyJoin,
    deleteNode: views.deleteNode,
    deleteNodeAndReconnect,
    materializeNode: views.materializeNode,
    applyOrReplaceOperation: views.applyOrReplaceOperation,

    // Chart/Export actions
    createChart: views.createChart,
    createExport: views.createExport,
    updateChart: views.updateChart,
    updateExport: views.updateExport,

    // Rewiring
    rewireNode: views.rewireNode,
    insertNodeBetween: views.insertNodeBetween,
    deleteEdge: views.deleteEdge,

    // Selection
    setActiveNode: store.setActiveNode,
    selectNode: store.selectNode,

    // Tabs
    openNodeIds: store.openNodeIds,
    openTab: store.openTab,
    closeTab: store.closeTab,
    replaceActiveTab: store.replaceActiveTab,

    // Node updates
    updateNodePosition: store.updateNodePosition,
    updateNodeName: store.updateNodeName,

    // Helpers
    getNode: store.getNode,
    getNodeChildren: store.getNodeChildren,
    getNodeParents: store.getNodeParents,
    getNodeDescendants: store.getNodeDescendants,
    getAllRootNodes: store.getAllRootNodes,
    getDatasets: store.getDatasets,
    getViews: store.getViews,

    // Navigation
    getPathToNode,
    goToParent,
    canDeleteSafely,
    activeNodePath,

    // Smart operation handling
    removeCurrentOperation,
    forceRemoveCurrentOperation,

    // Undo/redo
    undo: history.undo,
    redo: history.redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    undoDescription: history.undoDescription,
    redoDescription: history.redoDescription,

    // Branching
    createBranchFromSnapshot,

    // Cleanup
    cleanupOrphans,
    clearAllData,

    // Session export/load
    exportSession: session.exportSession,
    loadSession: session.loadSession,
    openRecentSession: session.openRecentSession,
    generateShareUrl: session.generateShareUrl,
    pendingSession: store.pendingSession,
    continuePendingSession: session.continuePendingSession,
    cancelPendingSession: session.cancelPendingSession,

    // Draft recovery
    checkForDraft: session.checkForDraft,
    getDraftInfo: session.getDraftInfo,
    recoverDraft: session.recoverDraft,
    discardDraft: session.discardDraft,

    // Pending session recovery
    checkForPendingSession: session.checkForPendingSession,
    getPendingSessionInfo: session.getPendingSessionInfo,
    restorePendingSession: session.restorePendingSession,

    // Visual restoration mode
    restorationState: store.restorationState,
    startRestorationMode: session.startRestorationMode,
    provideFileForRestoration: session.provideFileForRestoration,
    completeRestoration: session.completeRestoration,
    cancelRestoration: session.cancelRestoration,
    skipDatasetRestoration: store.skipDataset,
    unskipDatasetRestoration: store.unskipDataset,
    isRestorationReady: session.isRestorationReady,
    getRestorationProgress: session.getRestorationProgress,

    // Auto-save
    forceSave: session.forceSave,

    // Error handling
    setError,
    setSuccessMessage,
  }
}
