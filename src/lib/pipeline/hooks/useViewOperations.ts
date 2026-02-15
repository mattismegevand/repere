import { useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useCacheManagerOptional } from '@/lib/cache'
import { generateId } from '@/lib/id'
import { useDialogStore } from '@/stores/dialogStore'
import { usePipelineLayoutStore } from '@/stores/pipelineLayoutStore'
import { usePipelineRuntimeStore } from '@/stores/pipelineRuntimeStore'
import { getParents, usePipelineStore } from '@/stores/pipelineStore'
import { usePipelineUiStore } from '@/stores/pipelineUiStore'
import type {
  ChartConfig,
  ChartNode,
  DataView,
  DistinctOperation,
  ExportConfig,
  ExportNode,
  FilterGroup,
  FilterOperation,
  JoinOperation,
  LimitOperation,
  Operation,
  SelectOperation,
  Sort,
  SortOperation,
  SqlQueryOperation,
  UnionOperation,
} from '@/types'
import { isTerminalNode } from '@/types/pipeline'
import type { NodeLayout } from '@/types/pipelineLayout'
import type { NodeRuntime } from '@/types/pipelineRuntime'
import { mergeOperations } from '../merge-operations'
import { usePipelineServiceOptional } from '../PipelineProvider'

export function useViewOperations() {
  const service = usePipelineServiceOptional()
  const store = usePipelineStore(
    useShallow((s) => ({
      addChartNode: s.addChartNode,
      addExportNode: s.addExportNode,
      addView: s.addView,
      captureSnapshot: s.captureSnapshot,
      cascadeDelete: s.cascadeDelete,
      clearRedo: s.clearRedo,
      getNode: s.getNode,
      getNodeChildren: s.getNodeChildren,
      getNodeDescendants: s.getNodeDescendants,
      pushUndo: s.pushUndo,
      pushUndoAndClearRedo: s.pushUndoAndClearRedo,
      restoreSnapshot: s.restoreSnapshot,
      setNodeParents: s.setNodeParents,
      updateChartNode: s.updateChartNode,
      updateExportNode: s.updateExportNode,
      updateView: s.updateView,
    }))
  )
  const bumpDataVersion = usePipelineUiStore((s) => s.bumpDataVersion)
  const cacheManager = useCacheManagerOptional()

  const getRuntime = useCallback((nodeId: string) => usePipelineRuntimeStore.getState().nodes[nodeId], [])
  const getLayout = useCallback((nodeId: string) => usePipelineLayoutStore.getState().nodes[nodeId], [])

  const applyOperation = useCallback(
    async (sourceNodeId: string, operation: Operation, additionalSourceIds?: string[]): Promise<DataView | null> => {
      if (!service) return null

      const sourceNode = store.getNode(sourceNodeId)
      if (!sourceNode) return null
      const sourceRuntime = getRuntime(sourceNodeId)
      if (!sourceRuntime?.tableName || !sourceRuntime.columns) return null

      try {
        const additionalSources: Record<string, { node: typeof sourceNode; runtime: NodeRuntime }> | undefined =
          additionalSourceIds
            ? additionalSourceIds.reduce(
                (acc, id) => {
                  const node = store.getNode(id)
                  const runtime = getRuntime(id)
                  if (node && runtime?.tableName && runtime.columns) {
                    acc[id] = { node, runtime }
                  }
                  return acc
                },
                {} as Record<string, { node: typeof sourceNode; runtime: NodeRuntime }>
              )
            : undefined

        const children = store.getNodeChildren(sourceNodeId)
        const yOffset = children.length * 80
        const sourceLayout = getLayout(sourceNodeId)
        const basePosition = sourceLayout?.position ?? { x: 100, y: 100 }
        const position = {
          x: basePosition.x + 350,
          y: basePosition.y + yOffset,
        }

        const { view, runtime, parentIds } = await service.createView(
          { node: sourceNode, runtime: sourceRuntime },
          operation,
          additionalSources
        )
        const layout: NodeLayout = { position }
        store.addView(view, parentIds, runtime, layout)

        // Fetch row count (createView returns null for async fetch)
        const rowCount = runtime.tableName ? await service.getViewRowCount(runtime.tableName) : null
        if (rowCount !== null) {
          store.updateView(view.id, { rowCount })
        }

        return view
      } catch (err) {
        console.error('Failed to create view:', err)
        return null
      }
    },
    [service, store]
  )

  const applyJoin = useCallback(
    async (leftSourceId: string, operation: JoinOperation): Promise<DataView | null> => {
      return applyOperation(leftSourceId, operation, [operation.rightSourceId])
    },
    [applyOperation]
  )

  const refreshDescendants = useCallback(
    async (viewId: string) => {
      if (!service) return

      const state = usePipelineStore.getState()
      const descendants = store.getNodeDescendants(viewId)
      const viewNodeIds = descendants.filter((id) => store.getNode(id)?.type === 'view')

      // Invalidate cache for this node and all descendants
      cacheManager?.invalidateNode(viewId, state.edges)

      if (viewNodeIds.length === 0) return

      // Fetch all schemas and row counts in parallel, collect updates
      const updates: Record<string, Partial<DataView> & Partial<NodeRuntime>> = {}
      await Promise.all(
        viewNodeIds.map(async (id) => {
          try {
            const runtime = getRuntime(id)
            if (!runtime?.tableName) {
              return
            }
            const [columns, rowCount] = await Promise.all([
              service.getViewSchema(runtime.tableName),
              service.getViewRowCount(runtime.tableName),
            ])
            updates[id] = { columns, rowCount }
          } catch (err) {
            console.error(`Failed to refresh view ${id}:`, err)
            updates[id] = { rowCount: -1 }
          }
        })
      )

      // Apply all updates in a single batch
      usePipelineStore.getState().updateNodes(updates)
    },
    [service, store, cacheManager]
  )

  const applyOrReplaceOperation = useCallback(
    async (operation: Operation, sourceNodeId?: string): Promise<DataView | null> => {
      if (!service) return null

      const state = usePipelineStore.getState()
      // Use provided sourceNodeId or fall back to activeNodeId
      const targetNodeId = sourceNodeId ?? state.activeNodeId
      if (!targetNodeId) return null

      const currentNode = state.nodes[targetNodeId]
      if (!currentNode) return null

      if (isTerminalNode(currentNode)) {
        console.error('Cannot apply operations to a terminal node')
        return null
      }

      // Check for pending branch edit
      const uiState = usePipelineUiStore.getState()
      if (uiState.pendingBranchEdit && operation.type !== 'filter') {
        uiState.enterBranchingMode(
          uiState.pendingBranchEdit.viewId,
          uiState.pendingBranchEdit.snapshotBefore,
          operation
        )
        useDialogStore.getState().openDialog({ type: 'branchDecision' })
        return null
      }

      const snapshot = state.captureSnapshot()
      const isSameOpType = currentNode.type === 'view' && (currentNode as DataView).operation.type === operation.type

      if (isSameOpType) {
        // UPDATE IN PLACE
        const view = currentNode as DataView
        const parentIds = getParents(targetNodeId, state.edges)
        const parentId = parentIds[0]
        const parentNode = parentId ? state.nodes[parentId] : null
        const parentRuntime = parentId ? getRuntime(parentId) : undefined
        const viewRuntime = getRuntime(view.id)
        if (!parentNode || !parentRuntime?.tableName || !parentRuntime.columns || !viewRuntime?.tableName) return null

        const mergedOperation = mergeOperations(view.operation, operation)

        // Extract additional sources for join/union operations
        let additionalSources: Record<string, { node: typeof parentNode; runtime: NodeRuntime }> | undefined
        if (mergedOperation.type === 'join') {
          const rightId = (mergedOperation as JoinOperation).rightSourceId
          const rightNode = state.nodes[rightId]
          const rightRuntime = getRuntime(rightId)
          if (rightNode && rightRuntime?.tableName && rightRuntime.columns) {
            additionalSources = { [rightId]: { node: rightNode, runtime: rightRuntime } }
          }
        } else if (mergedOperation.type === 'union') {
          const sourceIds = (mergedOperation as UnionOperation).sourceIds
          additionalSources = sourceIds.reduce(
            (acc, id) => {
              const node = state.nodes[id]
              const runtime = getRuntime(id)
              if (node && runtime?.tableName && runtime.columns) acc[id] = { node, runtime }
              return acc
            },
            {} as Record<string, { node: typeof parentNode; runtime: NodeRuntime }>
          )
        }

        try {
          const updatedView = await service.updateView(
            view,
            viewRuntime,
            mergedOperation,
            { node: parentNode, runtime: parentRuntime },
            additionalSources
          )

          // Fetch row count (updateView returns null for async fetch)
          const rowCount = await service.getViewRowCount(viewRuntime.tableName)

          usePipelineStore.getState().updateView(view.id, {
            operation: mergedOperation,
            columns: updatedView.runtime.columns,
            rowCount,
            viewSql: updatedView.runtime.viewSql,
          })

          await refreshDescendants(view.id)

          state.pushUndoAndClearRedo(snapshot)

          return view
        } catch (err) {
          console.error('Failed to update view:', err)
          return null
        }
      } else {
        // STACK: Create child
        // Extract additional source IDs for join/union operations
        let additionalSourceIds: string[] | undefined
        if (operation.type === 'join') {
          additionalSourceIds = [(operation as JoinOperation).rightSourceId]
        } else if (operation.type === 'union') {
          additionalSourceIds = (operation as UnionOperation).sourceIds
        }

        const newView = await applyOperation(targetNodeId, operation, additionalSourceIds)
        if (newView) {
          // Only replace active tab if we're operating on the active node
          if (!sourceNodeId || sourceNodeId === state.activeNodeId) {
            usePipelineStore.getState().replaceActiveTab(targetNodeId, newView.id)
          }
          state.pushUndoAndClearRedo(snapshot)
        }
        return newView
      }
    },
    [service, applyOperation, refreshDescendants]
  )

  const deleteNode = useCallback(
    async (nodeId: string, skipSnapshot = false) => {
      const node = store.getNode(nodeId)
      if (!node) return

      // Chart and export nodes don't need DuckDB cleanup
      if (node.type === 'chart' || node.type === 'export') {
        const snapshot = !skipSnapshot ? store.captureSnapshot() : null
        store.cascadeDelete(nodeId)
        if (snapshot) {
          store.pushUndo(snapshot)
          store.clearRedo()
        }
        return
      }

      // For datasets and views, we need the service
      if (!service) return

      const shouldCaptureSnapshot = !skipSnapshot && node.type === 'view'
      const snapshot = shouldCaptureSnapshot ? store.captureSnapshot() : null

      try {
        const state = usePipelineStore.getState()
        const descendants = store.getNodeDescendants(nodeId)
        const viewNamesToDelete: string[] = []

        if (node.type === 'view') {
          const runtime = getRuntime(nodeId)
          if (runtime?.tableName) {
            viewNamesToDelete.push(runtime.tableName)
          }
        }

        for (const descendantId of descendants) {
          const descendant = store.getNode(descendantId)
          if (descendant?.type === 'view') {
            const runtime = getRuntime(descendantId)
            if (runtime?.tableName) {
              viewNamesToDelete.push(runtime.tableName)
            }
          }
        }

        // Invalidate cache for deleted node and descendants before deletion
        cacheManager?.invalidateNode(nodeId, state.edges)

        if (viewNamesToDelete.length > 0) {
          await service.dropViews(viewNamesToDelete)
        }

        if (node.type === 'dataset') {
          const runtime = getRuntime(nodeId)
          if (runtime?.tableName) {
            await service.dropDatasetTable(runtime.tableName)
          }
        }

        store.cascadeDelete(nodeId)

        if (snapshot) {
          store.pushUndo(snapshot)
          store.clearRedo()
        }
      } catch (err) {
        console.error('Failed to delete node:', err)
      }
    },
    [service, store, cacheManager]
  )

  const materializeNode = useCallback(
    async (nodeId: string): Promise<DataView | null> => {
      const node = store.getNode(nodeId)
      if (!node) return null
      const runtime = getRuntime(nodeId)
      if (!runtime?.columns) return null

      const selectOp: SelectOperation = {
        type: 'select',
        columns: runtime.columns.map((c) => c.name),
      }

      return applyOperation(nodeId, selectOp)
    },
    [store, applyOperation]
  )

  /**
   * Create a chart node - no DuckDB view needed
   */
  const createChart = useCallback(
    (sourceNodeId: string, config: ChartConfig): ChartNode | null => {
      const sourceNode = store.getNode(sourceNodeId)
      if (!sourceNode) return null
      const sourceRuntime = getRuntime(sourceNodeId)
      if (!sourceRuntime?.tableName || !sourceRuntime.columns) return null

      const snapshot = store.captureSnapshot()

      // Calculate position
      const children = store.getNodeChildren(sourceNodeId)
      const yOffset = children.length * 80
      const sourceLayout = getLayout(sourceNodeId)
      const basePosition = sourceLayout?.position ?? { x: 100, y: 100 }
      const position = {
        x: basePosition.x + 350,
        y: basePosition.y + yOffset,
      }

      const chartId = generateId('chart')
      const chartNode: ChartNode = {
        id: chartId,
        type: 'chart',
        name: `${sourceNode.name} → ${config.chartType} Chart`,
        createdAt: new Date(),
        config,
      }

      const runtime: NodeRuntime = {
        tableName: sourceRuntime.tableName,
        columns: sourceRuntime.columns,
        rowCount: sourceRuntime.rowCount ?? null,
      }
      const layout: NodeLayout = { position }

      store.addChartNode(chartNode, sourceNodeId, runtime, layout)
      store.pushUndoAndClearRedo(snapshot)

      return chartNode
    },
    [store]
  )

  /**
   * Create an export node - no DuckDB view needed
   */
  const createExport = useCallback(
    (sourceNodeId: string, config: ExportConfig): ExportNode | null => {
      const sourceNode = store.getNode(sourceNodeId)
      if (!sourceNode) return null
      const sourceRuntime = getRuntime(sourceNodeId)
      if (!sourceRuntime?.tableName || !sourceRuntime.columns) return null

      const snapshot = store.captureSnapshot()

      const children = store.getNodeChildren(sourceNodeId)
      const yOffset = children.length * 80
      const sourceLayout = getLayout(sourceNodeId)
      const basePosition = sourceLayout?.position ?? { x: 100, y: 100 }
      const position = {
        x: basePosition.x + 350,
        y: basePosition.y + yOffset,
      }

      const exportId = generateId('export')
      const exportNode: ExportNode = {
        id: exportId,
        type: 'export',
        name: `${sourceNode.name} → Export`,
        createdAt: new Date(),
        config,
      }

      const runtime: NodeRuntime = {
        tableName: sourceRuntime.tableName,
        columns: sourceRuntime.columns,
        rowCount: sourceRuntime.rowCount ?? null,
      }
      const layout: NodeLayout = { position }

      store.addExportNode(exportNode, sourceNodeId, runtime, layout)
      store.pushUndoAndClearRedo(snapshot)

      return exportNode
    },
    [store]
  )

  /**
   * Update a chart node's config
   */
  const updateChart = useCallback(
    (chartId: string, config: Partial<ChartConfig>): void => {
      const node = store.getNode(chartId)
      if (!node || node.type !== 'chart') return

      const snapshot = store.captureSnapshot()
      store.updateChartNode(chartId, { config: { ...node.config, ...config } })
      store.pushUndoAndClearRedo(snapshot)
    },
    [store]
  )

  /**
   * Update an export node's config
   */
  const updateExport = useCallback(
    (exportId: string, config: Partial<ExportConfig>): void => {
      const node = store.getNode(exportId)
      if (!node || node.type !== 'export') return

      const snapshot = store.captureSnapshot()
      store.updateExportNode(exportId, { config: { ...node.config, ...config } })
      store.pushUndoAndClearRedo(snapshot)
    },
    [store]
  )

  /**
   * Rewire a node to a new parent - changes the node's input source
   * Works for ViewNodes, ChartNodes, and ExportNodes
   */
  const rewireNode = useCallback(
    async (nodeId: string, newParentId: string): Promise<boolean> => {
      if (!service) return false

      const state = usePipelineStore.getState()
      const node = state.nodes[nodeId]
      const newParent = state.nodes[newParentId]

      if (!node || !newParent) return false

      // Cannot rewire datasets (they have no parent)
      if (node.type === 'dataset') return false

      // Cannot rewire to self
      if (nodeId === newParentId) return false

      // Cannot create cycles: newParent cannot be a descendant of node
      const descendants = store.getNodeDescendants(nodeId)
      if (descendants.includes(newParentId)) return false

      const snapshot = state.captureSnapshot()

      try {
        if (node.type === 'view') {
          // For views, regenerate SQL with same operation but new parent
          const view = node as DataView
          const viewRuntime = getRuntime(nodeId)
          const parentRuntime = getRuntime(newParentId)
          if (!viewRuntime?.tableName || !parentRuntime?.tableName || !parentRuntime.columns) return false

          const updatedView = await service.updateView(view, viewRuntime, view.operation, {
            node: newParent,
            runtime: parentRuntime,
          })

          // Fetch row count (updateView returns null for async fetch)
          const rowCount = await service.getViewRowCount(viewRuntime.tableName)

          store.setNodeParents(nodeId, [newParentId])
          store.updateView(nodeId, {
            columns: updatedView.runtime.columns,
            rowCount,
            viewSql: updatedView.runtime.viewSql,
          })

          // Refresh all descendants since their data may have changed
          await refreshDescendants(nodeId)
        } else if (node.type === 'chart') {
          // For charts, just update the parentId and refresh data references
          const parentRuntime = getRuntime(newParentId)
          if (!parentRuntime?.tableName || !parentRuntime.columns) return false
          store.setNodeParents(nodeId, [newParentId])
          store.updateChartNode(nodeId, {
            tableName: parentRuntime.tableName,
            columns: parentRuntime.columns,
            rowCount: parentRuntime.rowCount ?? null,
          })
        } else if (node.type === 'export') {
          // For exports, update parentId and data references
          const parentRuntime = getRuntime(newParentId)
          if (!parentRuntime?.tableName || !parentRuntime.columns) return false
          store.setNodeParents(nodeId, [newParentId])
          store.updateExportNode(nodeId, {
            tableName: parentRuntime.tableName,
            columns: parentRuntime.columns,
            rowCount: parentRuntime.rowCount ?? null,
          })
        }

        store.pushUndoAndClearRedo(snapshot)
        bumpDataVersion()

        return true
      } catch (err) {
        console.error('Failed to rewire node:', err)
        // Restore snapshot on failure
        store.restoreSnapshot(snapshot)
        return false
      }
    },
    [service, store, refreshDescendants, bumpDataVersion]
  )

  /**
   * Insert a new node between source and target nodes.
   * Creates a view from source with the given operation type,
   * then rewires the target to use the new view as its parent.
   */
  const insertNodeBetween = useCallback(
    async (sourceId: string, targetId: string, operationType: string): Promise<string | null> => {
      if (!service) return null

      const state = usePipelineStore.getState()
      const sourceNode = state.nodes[sourceId]
      const targetNode = state.nodes[targetId]

      if (!sourceNode || !targetNode) return null
      if (targetNode.type === 'dataset') return null // Can't insert before a dataset
      const sourceRuntime = getRuntime(sourceId)
      const targetRuntime = getRuntime(targetId)
      if (!sourceRuntime?.tableName || !sourceRuntime.columns) return null

      const snapshot = state.captureSnapshot()

      try {
        // Create default operation based on type
        let operation: Operation
        switch (operationType) {
          case 'filter': {
            // Create an empty filter group (no conditions = pass all)
            const emptyGroup: FilterGroup = { type: 'group', combineMode: 'and', children: [] }
            operation = { type: 'filter', expression: emptyGroup } as FilterOperation
            break
          }
          case 'sort': {
            // Create a sort with first column if available
            const firstCol = sourceRuntime.columns[0]?.name ?? 'id'
            const sorts: Sort[] = [{ column: firstCol, direction: 'asc' }]
            operation = { type: 'sort', sorts } as SortOperation
            break
          }
          case 'limit': {
            operation = { type: 'limit', limit: 1000 } as LimitOperation
            break
          }
          case 'select': {
            // Select all columns (pass-through)
            operation = { type: 'select', columns: sourceRuntime.columns.map((c) => c.name) } as SelectOperation
            break
          }
          case 'distinct': {
            operation = { type: 'distinct' } as DistinctOperation
            break
          }
          default: {
            // For SQL or any other type, create a simple pass-through SELECT *
            operation = {
              type: 'sql',
              sql: `SELECT * FROM {{source}}`,
              referencedTables: [],
            } as SqlQueryOperation
            break
          }
        }

        // Calculate position between source and target
        const position = {
          x: (getLayout(sourceId)?.position?.x ?? 100 + (getLayout(targetId)?.position?.x ?? 100)) / 2,
          y: (getLayout(sourceId)?.position?.y ?? 100 + (getLayout(targetId)?.position?.y ?? 100)) / 2,
        }

        // Create the new view
        const { view, runtime, parentIds } = await service.createView(
          { node: sourceNode, runtime: sourceRuntime },
          operation,
          undefined
        )
        const layout: NodeLayout = { position }
        store.addView(view, parentIds, runtime, layout)

        // Fetch row count for the new view (createView returns null for async fetch)
        const rowCount = runtime.tableName ? await service.getViewRowCount(runtime.tableName) : null
        if (rowCount !== null) {
          store.updateView(view.id, { rowCount })
        }

        // Now rewire the target to use the new view as its parent
        if (targetNode.type === 'view') {
          const targetView = targetNode as DataView
          if (!targetRuntime?.tableName) return null
          const updatedView = await service.updateView(targetView, targetRuntime, targetView.operation, {
            node: view,
            runtime: runtime,
          })

          // Fetch row count for target (updateView returns null for async fetch)
          const targetRowCount = await service.getViewRowCount(targetRuntime.tableName)

          store.setNodeParents(targetId, [view.id])
          store.updateView(targetId, {
            columns: updatedView.runtime.columns,
            rowCount: targetRowCount,
            viewSql: updatedView.runtime.viewSql,
          })

          await refreshDescendants(targetId)
        } else if (targetNode.type === 'chart') {
          store.setNodeParents(targetId, [view.id])
          store.updateChartNode(targetId, {
            tableName: runtime.tableName,
            columns: runtime.columns,
            rowCount,
          })
        } else if (targetNode.type === 'export') {
          store.setNodeParents(targetId, [view.id])
          store.updateExportNode(targetId, {
            tableName: runtime.tableName,
            columns: runtime.columns,
            rowCount,
          })
        }

        store.pushUndoAndClearRedo(snapshot)
        bumpDataVersion()

        return view.id
      } catch (err) {
        console.error('Failed to insert node between:', err)
        store.restoreSnapshot(snapshot)
        return null
      }
    },
    [service, store, refreshDescendants, bumpDataVersion]
  )

  /**
   * Delete an edge by deleting the target node (and its descendants).
   * This is a destructive operation.
   */
  const deleteEdge = useCallback(
    async (edgeId: string): Promise<void> => {
      const state = usePipelineStore.getState()
      const edge = state.edges.find((e) => e.id === edgeId)
      if (!edge) return

      // For now, we delete the target node (which cascades to descendants)
      // In the future, we could handle multi-parent nodes differently
      const targetNode = state.nodes[edge.targetId]
      if (!targetNode) return

      // Can't delete a dataset through edge deletion
      if (targetNode.type === 'dataset') return

      await deleteNode(edge.targetId)
    },
    [deleteNode]
  )

  return {
    applyOperation,
    applyJoin,
    applyOrReplaceOperation,
    deleteNode,
    materializeNode,
    refreshDescendants,
    createChart,
    createExport,
    updateChart,
    updateExport,
    rewireNode,
    insertNodeBetween,
    deleteEdge,
  }
}
