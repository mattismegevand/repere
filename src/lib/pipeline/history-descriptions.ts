import type { PipelineSnapshot } from '@/stores/pipelineTypes'
import type { DataView, PipelineNode } from '@/types'

/**
 * Get a description of what the undo action will restore
 */
export function getUndoDescription(undoStack: PipelineSnapshot[], nodes: Record<string, PipelineNode>): string | null {
  if (undoStack.length === 0) return null

  const snapshot = undoStack[undoStack.length - 1]
  const currentNodes = nodes
  const snapshotNodes = snapshot.nodes

  // Find what changed: views added, removed, or modified
  const currentViewIds = new Set(Object.keys(currentNodes).filter((id) => currentNodes[id].type === 'view'))
  const snapshotViewIds = new Set(Object.keys(snapshotNodes).filter((id) => snapshotNodes[id].type === 'view'))

  // Views that exist now but not in snapshot (were added)
  const addedViews = [...currentViewIds].filter((id) => !snapshotViewIds.has(id))
  if (addedViews.length > 0) {
    const view = currentNodes[addedViews[0]] as DataView
    const opType = view.operation.type
    return `Undo: Add ${opType}`
  }

  // Views that exist in snapshot but not now (were deleted)
  const deletedViews = [...snapshotViewIds].filter((id) => !currentViewIds.has(id))
  if (deletedViews.length > 0) {
    const view = snapshotNodes[deletedViews[0]] as DataView
    return `Undo: Delete ${view.name}`
  }

  // Check for modified views (same ID but different operation)
  for (const id of currentViewIds) {
    if (snapshotViewIds.has(id)) {
      const current = currentNodes[id] as DataView
      const prev = snapshotNodes[id] as DataView
      if (JSON.stringify(current.operation) !== JSON.stringify(prev.operation)) {
        return `Undo: Update ${current.operation.type}`
      }
    }
  }

  return 'Undo'
}

/**
 * Get a description of what the redo action will restore
 */
export function getRedoDescription(redoStack: PipelineSnapshot[], nodes: Record<string, PipelineNode>): string | null {
  if (redoStack.length === 0) return null

  const snapshot = redoStack[redoStack.length - 1]
  const currentNodes = nodes
  const snapshotNodes = snapshot.nodes

  // Find what changed: views added, removed, or modified
  const currentViewIds = new Set(Object.keys(currentNodes).filter((id) => currentNodes[id].type === 'view'))
  const snapshotViewIds = new Set(Object.keys(snapshotNodes).filter((id) => snapshotNodes[id].type === 'view'))

  // Views that exist in snapshot but not now (will be added back)
  const viewsToAdd = [...snapshotViewIds].filter((id) => !currentViewIds.has(id))
  if (viewsToAdd.length > 0) {
    const view = snapshotNodes[viewsToAdd[0]] as DataView
    const opType = view.operation.type
    return `Redo: Add ${opType}`
  }

  // Views that exist now but not in snapshot (will be deleted)
  const viewsToDelete = [...currentViewIds].filter((id) => !snapshotViewIds.has(id))
  if (viewsToDelete.length > 0) {
    const view = currentNodes[viewsToDelete[0]] as DataView
    return `Redo: Delete ${view.name}`
  }

  // Check for modified views
  for (const id of snapshotViewIds) {
    if (currentViewIds.has(id)) {
      const current = currentNodes[id] as DataView
      const next = snapshotNodes[id] as DataView
      if (JSON.stringify(current.operation) !== JSON.stringify(next.operation)) {
        return `Redo: Update ${next.operation.type}`
      }
    }
  }

  return 'Redo'
}
