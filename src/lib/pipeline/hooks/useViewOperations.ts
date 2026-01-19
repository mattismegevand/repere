import { useCallback } from 'react'
import { useCacheManagerOptional } from '@/lib/cache'
import { generateId } from '@/lib/id'
import { useDialogStore } from '@/stores'
import { getParents, usePipelineStore } from '@/stores/pipelineStore'
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
import { mergeOperations } from '../merge-operations'
import { usePipelineServiceOptional } from '../PipelineProvider'

export function useViewOperations() {
  const service = usePipelineServiceOptional()
  const store = usePipelineStore()
  const cacheManager = useCacheManagerOptional()

  const applyOperation = useCallback(
    async (sourceNodeId: string, operation: Operation, additionalSourceIds?: string[]): Promise<DataView | null> => {
      if (!service) return null

      const sourceNode = store.getNode(sourceNodeId)
      if (!sourceNode) return null

      try {
        const additionalSources: Record<string, { node: typeof sourceNode }> | undefined = additionalSourceIds
          ? additionalSourceIds.reduce(
              (acc, id) => {
                const node = store.getNode(id)
                if (node) acc[id] = { node }
                return acc
              },
              {} as Record<string, { node: typeof sourceNode }>
            )
          : undefined

        const children = store.getNodeChildren(sourceNodeId)
        const yOffset = children.length * 80
        const position = {
          x: sourceNode.position.x + 350,
          y: sourceNode.position.y + yOffset,
        }

        const view = await service.createView(sourceNode, operation, additionalSources, position)
        store.addView(view)

        // Fetch row count (createView returns null for async fetch)
        const rowCount = await service.getViewRowCount(view.tableName)
        store.updateView(view.id, { rowCount })

        return { ...view, rowCount }
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
      const viewNodes = descendants
        .map((id) => ({ id, node: store.getNode(id) }))
        .filter((item): item is { id: string; node: DataView } => item.node?.type === 'view')

      // Invalidate cache for this node and all descendants
      cacheManager?.invalidateNode(viewId, state.edges)

      if (viewNodes.length === 0) return

      // Fetch all schemas and row counts in parallel, collect updates
      const updates: Record<string, Partial<DataView>> = {}
      await Promise.all(
        viewNodes.map(async ({ id, node }) => {
          try {
            const [columns, rowCount] = await Promise.all([
              service.getViewSchema(node.tableName),
              service.getViewRowCount(node.tableName),
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
      if (state.pendingBranchEdit && operation.type !== 'filter') {
        state.enterBranchingMode(state.pendingBranchEdit.viewId, state.pendingBranchEdit.snapshotBefore, operation)
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
        if (!parentNode) return null

        const mergedOperation = mergeOperations(view.operation, operation)

        // Extract additional sources for join/union operations
        let additionalSources: Record<string, { node: typeof parentNode }> | undefined
        if (mergedOperation.type === 'join') {
          const rightId = (mergedOperation as JoinOperation).rightSourceId
          const rightNode = state.nodes[rightId]
          if (rightNode) additionalSources = { [rightId]: { node: rightNode } }
        } else if (mergedOperation.type === 'union') {
          const sourceIds = (mergedOperation as UnionOperation).sourceIds
          additionalSources = sourceIds.reduce(
            (acc, id) => {
              const node = state.nodes[id]
              if (node) acc[id] = { node }
              return acc
            },
            {} as Record<string, { node: typeof parentNode }>
          )
        }

        try {
          const updatedView = await service.updateView(view, mergedOperation, parentNode, additionalSources)

          // Fetch row count (updateView returns null for async fetch)
          const rowCount = await service.getViewRowCount(view.tableName)

          usePipelineStore.getState().updateView(view.id, {
            operation: mergedOperation,
            columns: updatedView.columns,
            rowCount,
            viewSql: updatedView.viewSql,
          })

          await refreshDescendants(view.id)

          state.pushUndoAndClearRedo(snapshot)

          return { ...view, ...updatedView, rowCount }
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
          viewNamesToDelete.push(node.tableName)
        }

        for (const descendantId of descendants) {
          const descendant = store.getNode(descendantId)
          if (descendant?.type === 'view') {
            viewNamesToDelete.push(descendant.tableName)
          }
        }

        // Invalidate cache for deleted node and descendants before deletion
        cacheManager?.invalidateNode(nodeId, state.edges)

        if (viewNamesToDelete.length > 0) {
          await service.dropViews(viewNamesToDelete)
        }

        if (node.type === 'dataset') {
          await service.dropDatasetTable(node.tableName)
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

      const selectOp: SelectOperation = {
        type: 'select',
        columns: node.columns.map((c) => c.name),
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

      const snapshot = store.captureSnapshot()

      // Calculate position
      const children = store.getNodeChildren(sourceNodeId)
      const yOffset = children.length * 80
      const position = {
        x: sourceNode.position.x + 350,
        y: sourceNode.position.y + yOffset,
      }

      const chartId = generateId('chart')
      const chartNode: ChartNode = {
        id: chartId,
        type: 'chart',
        name: `${sourceNode.name} → ${config.chartType} Chart`,
        tableName: sourceNode.tableName, // Reference parent's table for queries
        columns: sourceNode.columns,
        rowCount: sourceNode.rowCount,
        createdAt: new Date(),
        position,
        parentId: sourceNodeId,
        config,
      }

      store.addChartNode(chartNode)
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

      const snapshot = store.captureSnapshot()

      const children = store.getNodeChildren(sourceNodeId)
      const yOffset = children.length * 80
      const position = {
        x: sourceNode.position.x + 350,
        y: sourceNode.position.y + yOffset,
      }

      const exportId = generateId('export')
      const exportNode: ExportNode = {
        id: exportId,
        type: 'export',
        name: `${sourceNode.name} → Export`,
        tableName: sourceNode.tableName,
        columns: sourceNode.columns,
        rowCount: sourceNode.rowCount,
        createdAt: new Date(),
        position,
        parentId: sourceNodeId,
        config,
      }

      store.addExportNode(exportNode)
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
          const updatedView = await service.updateView(view, view.operation, newParent)

          // Fetch row count (updateView returns null for async fetch)
          const rowCount = await service.getViewRowCount(view.tableName)

          store.updateView(nodeId, {
            parentIds: [newParentId],
            columns: updatedView.columns,
            rowCount,
            viewSql: updatedView.viewSql,
          })

          // Refresh all descendants since their data may have changed
          await refreshDescendants(nodeId)
        } else if (node.type === 'chart') {
          // For charts, just update the parentId and refresh data references
          store.updateChartNode(nodeId, {
            parentId: newParentId,
            tableName: newParent.tableName,
            columns: newParent.columns,
            rowCount: newParent.rowCount,
          })
        } else if (node.type === 'export') {
          // For exports, update parentId and data references
          store.updateExportNode(nodeId, {
            parentId: newParentId,
            tableName: newParent.tableName,
            columns: newParent.columns,
            rowCount: newParent.rowCount,
          })
        }

        store.pushUndoAndClearRedo(snapshot)
        store.bumpDataVersion()

        return true
      } catch (err) {
        console.error('Failed to rewire node:', err)
        // Restore snapshot on failure
        store.restoreSnapshot(snapshot)
        return false
      }
    },
    [service, store, refreshDescendants]
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
            const firstCol = sourceNode.columns[0]?.name ?? 'id'
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
            operation = { type: 'select', columns: sourceNode.columns.map((c) => c.name) } as SelectOperation
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
          x: (sourceNode.position.x + targetNode.position.x) / 2,
          y: (sourceNode.position.y + targetNode.position.y) / 2,
        }

        // Create the new view
        const view = await service.createView(sourceNode, operation, undefined, position)
        store.addView(view)

        // Fetch row count for the new view (createView returns null for async fetch)
        const rowCount = await service.getViewRowCount(view.tableName)
        store.updateView(view.id, { rowCount })

        // Now rewire the target to use the new view as its parent
        if (targetNode.type === 'view') {
          const targetView = targetNode as DataView
          const updatedView = await service.updateView(targetView, targetView.operation, view)

          // Fetch row count for target (updateView returns null for async fetch)
          const targetRowCount = await service.getViewRowCount(targetView.tableName)

          store.updateView(targetId, {
            parentIds: [view.id],
            columns: updatedView.columns,
            rowCount: targetRowCount,
            viewSql: updatedView.viewSql,
          })

          await refreshDescendants(targetId)
        } else if (targetNode.type === 'chart') {
          store.updateChartNode(targetId, {
            parentId: view.id,
            tableName: view.tableName,
            columns: view.columns,
            rowCount,
          })
        } else if (targetNode.type === 'export') {
          store.updateExportNode(targetId, {
            parentId: view.id,
            tableName: view.tableName,
            columns: view.columns,
            rowCount,
          })
        }

        store.pushUndoAndClearRedo(snapshot)
        store.bumpDataVersion()

        return view.id
      } catch (err) {
        console.error('Failed to insert node between:', err)
        store.restoreSnapshot(snapshot)
        return null
      }
    },
    [service, store, refreshDescendants]
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
