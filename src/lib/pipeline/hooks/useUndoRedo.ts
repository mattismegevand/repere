import { useCallback, useMemo } from 'react'
import { useCacheManagerOptional } from '@/lib/cache'
import { getTopologicalOrder } from '@/lib/graph'
import { usePipelineRuntimeStore } from '@/stores/pipelineRuntimeStore'
import { usePipelineStore } from '@/stores/pipelineStore'
import type { PipelineSnapshot } from '@/stores/pipelineTypes'
import type { DataView } from '@/types'
import { getRedoDescription, getUndoDescription } from '../history-descriptions'
import { usePipelineServiceOptional } from '../PipelineProvider'

export function useUndoRedo() {
  const service = usePipelineServiceOptional()
  const cacheManager = useCacheManagerOptional()
  const nodes = usePipelineStore((s) => s.nodes)
  const undoStack = usePipelineStore((s) => s.undoStack)
  const redoStack = usePipelineStore((s) => s.redoStack)
  const captureSnapshot = usePipelineStore((s) => s.captureSnapshot)
  const popUndo = usePipelineStore((s) => s.popUndo)
  const pushUndo = usePipelineStore((s) => s.pushUndo)
  const popRedo = usePipelineStore((s) => s.popRedo)
  const pushRedo = usePipelineStore((s) => s.pushRedo)
  const restoreSnapshot = usePipelineStore((s) => s.restoreSnapshot)

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
          .flatMap((v) => {
            const tableName = usePipelineRuntimeStore.getState().nodes[v.id]?.tableName
            return tableName ? [tableName] : []
          })

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
              const runtime = usePipelineRuntimeStore.getState().nodes[nodeId]
              if (!runtime?.viewSql) continue
              try {
                await service.recreateView(runtime.viewSql)
              } catch (err) {
                console.error(`Failed to recreate view ${snapshot.nodes[nodeId]?.name ?? nodeId}:`, err)
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
