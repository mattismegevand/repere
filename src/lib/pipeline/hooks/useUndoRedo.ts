import { useCallback, useMemo } from 'react'
import { useCacheManagerOptional } from '@/lib/cache'
import { getTopologicalOrder } from '@/lib/graph'
import { type PipelineSnapshot, usePipelineStore } from '@/stores/pipelineStore'
import type { DataView } from '@/types'
import { getRedoDescription, getUndoDescription } from '../history-descriptions'
import { usePipelineServiceOptional } from '../PipelineProvider'

export function useUndoRedo() {
  const service = usePipelineServiceOptional()
  const cacheManager = useCacheManagerOptional()
  const { nodes, undoStack, redoStack, captureSnapshot, popUndo, pushUndo, popRedo, pushRedo, restoreSnapshot } =
    usePipelineStore()

  const canUndo = undoStack.length > 0
  const canRedo = redoStack.length > 0

  const undoDescription = useMemo(() => getUndoDescription(undoStack, nodes), [undoStack, nodes])
  const redoDescription = useMemo(() => getRedoDescription(redoStack, nodes), [redoStack, nodes])

  const restoreSnapshotWithDuckDB = useCallback(
    async (snapshot: PipelineSnapshot): Promise<boolean> => {
      if (!service) return false

      const currentState = usePipelineStore.getState()

      try {
        const currentViewIds = new Set(
          Object.values(currentState.nodes)
            .filter((n): n is DataView => n.type === 'view')
            .map((v) => v.id)
        )
        const snapshotViewIds = new Set(
          Object.values(snapshot.nodes)
            .filter((n): n is DataView => n.type === 'view')
            .map((v) => v.id)
        )

        const viewsToDrop = Object.values(currentState.nodes)
          .filter((n): n is DataView => n.type === 'view' && !snapshotViewIds.has(n.id))
          .map((v) => v.tableName)

        const viewsToCreate = Object.values(snapshot.nodes).filter(
          (n): n is DataView => n.type === 'view' && !currentViewIds.has(n.id)
        )

        if (viewsToDrop.length > 0) {
          await service.dropViews(viewsToDrop)
        }

        // Restore Zustand state first
        restoreSnapshot(snapshot)

        // Recreate missing views in topological order
        if (viewsToCreate.length > 0) {
          const order = getTopologicalOrder(snapshot.nodes, snapshot.edges)
          const viewsToCreateSet = new Set(viewsToCreate.map((v) => v.id))

          for (const nodeId of order) {
            if (viewsToCreateSet.has(nodeId)) {
              const view = snapshot.nodes[nodeId] as DataView
              try {
                await service.recreateView(view.viewSql)
              } catch (err) {
                console.error(`Failed to recreate view ${view.name}:`, err)
              }
            }
          }
        }

        // Update views with changed SQL
        for (const nodeId of snapshotViewIds) {
          if (currentViewIds.has(nodeId)) {
            const currentView = currentState.nodes[nodeId] as DataView
            const snapshotView = snapshot.nodes[nodeId] as DataView
            if (currentView.viewSql !== snapshotView.viewSql) {
              try {
                await service.recreateView(snapshotView.viewSql)
              } catch (err) {
                console.error(`Failed to update view ${snapshotView.name}:`, err)
              }
            }
          }
        }

        return true
      } catch (err) {
        console.error('Snapshot restore failed:', err)
        return false
      }
    },
    [service, restoreSnapshot]
  )

  const undo = useCallback(async (): Promise<boolean> => {
    const state = usePipelineStore.getState()
    if (!service || state.undoStack.length === 0) return false

    const currentSnapshot = captureSnapshot()
    const snapshotToRestore = popUndo()
    if (!snapshotToRestore) return false

    const success = await restoreSnapshotWithDuckDB(snapshotToRestore)

    if (success) {
      pushRedo(currentSnapshot)
      // Clear all cache entries since undo/redo can affect any node
      cacheManager?.clear()
      return true
    } else {
      pushUndo(snapshotToRestore)
      return false
    }
  }, [service, cacheManager, captureSnapshot, popUndo, pushUndo, pushRedo, restoreSnapshotWithDuckDB])

  const redo = useCallback(async (): Promise<boolean> => {
    const state = usePipelineStore.getState()
    if (!service || state.redoStack.length === 0) return false

    const currentSnapshot = captureSnapshot()
    const snapshotToRestore = popRedo()
    if (!snapshotToRestore) return false

    const success = await restoreSnapshotWithDuckDB(snapshotToRestore)

    if (success) {
      pushUndo(currentSnapshot)
      // Clear all cache entries since undo/redo can affect any node
      cacheManager?.clear()
      return true
    } else {
      pushRedo(snapshotToRestore)
      return false
    }
  }, [service, cacheManager, captureSnapshot, popUndo, popRedo, pushUndo, pushRedo, restoreSnapshotWithDuckDB])

  return {
    undo,
    redo,
    canUndo,
    canRedo,
    undoDescription,
    redoDescription,
    restoreSnapshotWithDuckDB,
  }
}
