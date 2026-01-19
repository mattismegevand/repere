import { beforeEach, describe, expect, it } from 'vitest'
import { usePipelineStore } from '@/stores/pipelineStore'
import type { Dataset, DataView, FilterOperation } from '@/types'

const columns = [
  { name: 'id', type: 'number', nullable: false },
  { name: 'category', type: 'string', nullable: false },
]

const createDataset = (id: string): Dataset => ({
  id,
  type: 'dataset',
  name: `Dataset ${id}`,
  fileName: `file_${id}.csv`,
  fileSize: 1000,
  rowCount: 10,
  columns,
  tableName: `dataset_${id}`,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  position: { x: 0, y: 0 },
})

const createView = (id: string, parentId: string): DataView => ({
  id,
  type: 'view',
  name: `View ${id}`,
  tableName: `view_${id}`,
  columns,
  rowCount: 5,
  createdAt: new Date('2024-01-02T00:00:00Z'),
  position: { x: 100, y: 0 },
  parentIds: [parentId],
  operation: {
    type: 'filter',
    filters: [{ column: 'category', operator: 'eq', value: 'A' }],
    combineMode: 'and',
  } satisfies FilterOperation,
  viewSql: `CREATE VIEW "view_${id}" AS SELECT * FROM "dataset_${parentId}"`,
})

describe('pipelineStore', () => {
  beforeEach(() => {
    usePipelineStore.getState().reset()
  })

  it('adds a view and wires edges to parents', () => {
    const dataset = createDataset('1')
    const view = createView('v1', dataset.id)

    usePipelineStore.getState().addDataset(dataset)
    usePipelineStore.getState().addView(view)

    const state = usePipelineStore.getState()
    expect(state.nodes[view.id]).toEqual(view)
    expect(state.activeNodeId).toBe(view.id)
    expect(state.selectedNodeId).toBe(view.id)
    expect(state.edges).toEqual([{ id: `${dataset.id}-${view.id}`, sourceId: dataset.id, targetId: view.id }])
  })

  it('updates parent edges when a view changes parents', () => {
    const datasetA = createDataset('a')
    const datasetB = createDataset('b')
    const view = createView('v1', datasetA.id)

    usePipelineStore.getState().addDataset(datasetA)
    usePipelineStore.getState().addDataset(datasetB)
    usePipelineStore.getState().addView(view)
    usePipelineStore.getState().updateView(view.id, { parentIds: [datasetB.id] })

    const { edges } = usePipelineStore.getState()
    expect(edges).toEqual([{ id: `${datasetB.id}-${view.id}`, sourceId: datasetB.id, targetId: view.id }])
  })

  it('cascades dataset deletion through views', () => {
    const dataset = createDataset('1')
    const view = createView('v1', dataset.id)

    usePipelineStore.getState().addDataset(dataset)
    usePipelineStore.getState().addView(view)

    const deleted = usePipelineStore.getState().cascadeDelete(dataset.id)
    const state = usePipelineStore.getState()

    expect(deleted).toEqual([view.id])
    expect(Object.keys(state.nodes)).toHaveLength(0)
    expect(state.edges).toHaveLength(0)
    expect(state.openNodeIds).toHaveLength(0)
    expect(state.activeNodeId).toBeNull()
  })

  it('tracks descendants in topological order', () => {
    const dataset = createDataset('1')
    const viewA = createView('a', dataset.id)
    const viewB = createView('b', viewA.id)

    usePipelineStore.getState().addDataset(dataset)
    usePipelineStore.getState().addView(viewA)
    usePipelineStore.getState().addView(viewB)

    const descendants = usePipelineStore.getState().getNodeDescendants(dataset.id)
    expect(descendants).toEqual([viewA.id, viewB.id])
  })

  it('manages open tabs without duplicates', () => {
    const dataset = createDataset('1')
    const view = createView('v1', dataset.id)

    usePipelineStore.getState().addDataset(dataset)
    usePipelineStore.getState().addView(view)

    usePipelineStore.getState().openTab(dataset.id)
    usePipelineStore.getState().openTab(view.id)
    usePipelineStore.getState().openTab(view.id)

    const state = usePipelineStore.getState()
    expect(state.openNodeIds).toEqual([dataset.id, view.id])
    expect(state.activeNodeId).toBe(view.id)
  })

  it('handles undo/redo stack operations', () => {
    const dataset = createDataset('1')
    const viewA = createView('a', dataset.id)
    const viewB = createView('b', dataset.id)

    usePipelineStore.getState().pushUndo({ view: viewA, parentId: dataset.id })
    usePipelineStore.getState().pushUndo({ view: viewB, parentId: dataset.id })

    const popped = usePipelineStore.getState().popUndo()
    expect(popped?.view.id).toBe(viewB.id)
    expect(usePipelineStore.getState().undoStack).toHaveLength(1)

    usePipelineStore.getState().pushRedo({ view: viewB, parentId: dataset.id })
    expect(usePipelineStore.getState().popRedo()?.view.id).toBe(viewB.id)

    usePipelineStore.getState().pushRedo({ view: viewA, parentId: dataset.id })
    usePipelineStore.getState().clearRedo()
    expect(usePipelineStore.getState().redoStack).toHaveLength(0)
  })

  it('updates active tab on close and replace', () => {
    const dataset = createDataset('1')
    const view = createView('v1', dataset.id)

    usePipelineStore.getState().addDataset(dataset)
    usePipelineStore.getState().addView(view)

    usePipelineStore.getState().openTab(view.id)
    usePipelineStore.getState().closeTab(view.id)

    expect(usePipelineStore.getState().openNodeIds).toEqual([dataset.id])
    expect(usePipelineStore.getState().activeNodeId).toBe(dataset.id)

    usePipelineStore.getState().replaceActiveTab(dataset.id, view.id)
    expect(usePipelineStore.getState().openNodeIds).toEqual([view.id])
    expect(usePipelineStore.getState().activeNodeId).toBe(view.id)
  })

  it('updates restoration state and skipped datasets', () => {
    const restorationState = {
      session: { nodes: [], edges: [], datasets: [] },
      datasets: new Map([
        [
          'dataset-1',
          {
            nodeId: 'dataset-1',
            fileName: 'file.csv',
            status: 'required',
            expectedColumns: [],
          },
        ],
      ]),
      skippedDatasets: new Set<string>(),
    }

    usePipelineStore.getState().enterRestorationMode(restorationState)
    usePipelineStore.getState().updateDatasetRestoration('dataset-1', { status: 'provided' })

    const stored = usePipelineStore.getState().restorationState
    const updated = stored?.datasets.get('dataset-1')
    expect(updated?.status).toBe('provided')

    usePipelineStore.getState().skipDataset('dataset-1')
    expect(usePipelineStore.getState().restorationState?.skippedDatasets.has('dataset-1')).toBe(true)

    usePipelineStore.getState().unskipDataset('dataset-1')
    expect(usePipelineStore.getState().restorationState?.skippedDatasets.has('dataset-1')).toBe(false)
  })

  it('exposes parents, children, and root nodes', () => {
    const dataset = createDataset('1')
    const view = createView('v1', dataset.id)

    usePipelineStore.getState().addDataset(dataset)
    usePipelineStore.getState().addView(view)

    expect(usePipelineStore.getState().getNodeChildren(dataset.id)).toEqual([view.id])
    expect(usePipelineStore.getState().getNodeParents(view.id)).toEqual([dataset.id])
    expect(
      usePipelineStore
        .getState()
        .getAllRootNodes()
        .map((node) => node.id)
    ).toEqual([dataset.id])
  })

  describe('duplicateBranch', () => {
    it('duplicates a single node', () => {
      const dataset = createDataset('1')
      usePipelineStore.getState().addDataset(dataset)

      const result = usePipelineStore.getState().duplicateBranch(dataset.id)

      expect(result).not.toBeNull()
      expect(result?.newRootId).toContain('copy')
      expect(Object.keys(usePipelineStore.getState().nodes)).toHaveLength(2)
    })

    it('duplicates node with children (preserves structure)', () => {
      const dataset = createDataset('1')
      const viewA = createView('a', dataset.id)
      const viewB = createView('b', viewA.id)

      usePipelineStore.getState().addDataset(dataset)
      usePipelineStore.getState().addView(viewA)
      usePipelineStore.getState().addView(viewB)

      const result = usePipelineStore.getState().duplicateBranch(viewA.id)

      expect(result).not.toBeNull()
      // Original: dataset, viewA, viewB. After copy: + viewA_copy, viewB_copy
      expect(Object.keys(usePipelineStore.getState().nodes)).toHaveLength(5)
      // The copy should have mapped IDs
      expect(Object.keys(result!.idMap)).toContain('a')
      expect(Object.keys(result!.idMap)).toContain('b')
    })

    it('maintains ID mapping consistency', () => {
      const dataset = createDataset('1')
      const viewA = createView('a', dataset.id)

      usePipelineStore.getState().addDataset(dataset)
      usePipelineStore.getState().addView(viewA)

      const result = usePipelineStore.getState().duplicateBranch(viewA.id)

      expect(result).not.toBeNull()
      const newId = result!.idMap.a
      expect(usePipelineStore.getState().nodes[newId]).toBeDefined()
    })

    it('offsets position of duplicated nodes', () => {
      const dataset = createDataset('1')
      dataset.position = { x: 100, y: 100 }

      usePipelineStore.getState().addDataset(dataset)

      const result = usePipelineStore.getState().duplicateBranch(dataset.id)
      const newNode = usePipelineStore.getState().nodes[result!.newRootId]

      expect(newNode.position.x).toBeGreaterThan(100)
      expect(newNode.position.y).toBeGreaterThan(100)
    })

    it('returns null for non-existent node', () => {
      const result = usePipelineStore.getState().duplicateBranch('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('undo/redo stack limits', () => {
    it('enforces 50-item undo stack limit', () => {
      const dataset = createDataset('1')
      usePipelineStore.getState().addDataset(dataset)

      // Push 60 items to exceed limit
      for (let i = 0; i < 60; i++) {
        const snapshot = usePipelineStore.getState().captureSnapshot()
        usePipelineStore.getState().pushUndo(snapshot)
      }

      expect(usePipelineStore.getState().undoStack.length).toBeLessThanOrEqual(50)
    })

    it('enforces 50-item redo stack limit', () => {
      const dataset = createDataset('1')
      usePipelineStore.getState().addDataset(dataset)

      // Push 60 items to exceed limit
      for (let i = 0; i < 60; i++) {
        const snapshot = usePipelineStore.getState().captureSnapshot()
        usePipelineStore.getState().pushRedo(snapshot)
      }

      expect(usePipelineStore.getState().redoStack.length).toBeLessThanOrEqual(50)
    })

    it('returns undefined when popping empty undo stack', () => {
      const result = usePipelineStore.getState().popUndo()
      expect(result).toBeUndefined()
    })

    it('returns undefined when popping empty redo stack', () => {
      const result = usePipelineStore.getState().popRedo()
      expect(result).toBeUndefined()
    })
  })

  describe('node position updates', () => {
    it('updates node position', () => {
      const dataset = createDataset('1')
      usePipelineStore.getState().addDataset(dataset)

      usePipelineStore.getState().updateNodePosition(dataset.id, { x: 500, y: 300 })

      expect(usePipelineStore.getState().nodes[dataset.id].position).toEqual({ x: 500, y: 300 })
    })

    it('ignores position update for non-existent node', () => {
      const initialNodes = { ...usePipelineStore.getState().nodes }
      usePipelineStore.getState().updateNodePosition('nonexistent', { x: 100, y: 100 })
      expect(usePipelineStore.getState().nodes).toEqual(initialNodes)
    })
  })

  describe('toggleNodeExpanded', () => {
    it('toggles expanded state', () => {
      const dataset = createDataset('1')
      usePipelineStore.getState().addDataset(dataset)

      expect(usePipelineStore.getState().nodes[dataset.id].isExpanded).toBeFalsy()

      usePipelineStore.getState().toggleNodeExpanded(dataset.id)
      expect(usePipelineStore.getState().nodes[dataset.id].isExpanded).toBe(true)

      usePipelineStore.getState().toggleNodeExpanded(dataset.id)
      expect(usePipelineStore.getState().nodes[dataset.id].isExpanded).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('handles adding view when no datasets exist', () => {
      const view = createView('v1', 'nonexistent')
      usePipelineStore.getState().addView(view)

      // View should be added but with edges to non-existent parent
      expect(usePipelineStore.getState().nodes[view.id]).toBeDefined()
    })

    it('handles removing last remaining dataset', () => {
      const dataset = createDataset('1')
      usePipelineStore.getState().addDataset(dataset)
      usePipelineStore.getState().removeDataset(dataset.id)

      expect(Object.keys(usePipelineStore.getState().nodes)).toHaveLength(0)
      expect(usePipelineStore.getState().activeNodeId).toBeNull()
    })

    it('handles cascadeDelete on non-existent node', () => {
      const deleted = usePipelineStore.getState().cascadeDelete('nonexistent')
      expect(deleted).toEqual([])
    })
  })

  describe('snapshot capture and restore', () => {
    it('captures complete state snapshot', () => {
      const dataset = createDataset('1')
      const view = createView('v1', dataset.id)

      usePipelineStore.getState().addDataset(dataset)
      usePipelineStore.getState().addView(view)

      const snapshot = usePipelineStore.getState().captureSnapshot()

      expect(snapshot.nodes).toHaveProperty(dataset.id)
      expect(snapshot.nodes).toHaveProperty(view.id)
      expect(snapshot.edges.length).toBeGreaterThan(0)
      expect(snapshot.timestamp).toBeGreaterThan(0)
    })

    it('restores state from snapshot', () => {
      const dataset = createDataset('1')
      usePipelineStore.getState().addDataset(dataset)

      const snapshot = usePipelineStore.getState().captureSnapshot()

      // Modify state
      usePipelineStore.getState().removeDataset(dataset.id)
      expect(Object.keys(usePipelineStore.getState().nodes)).toHaveLength(0)

      // Restore
      usePipelineStore.getState().restoreSnapshot(snapshot)
      expect(usePipelineStore.getState().nodes[dataset.id]).toBeDefined()
    })
  })

  describe('mode management', () => {
    it('enters and exits restoration mode', () => {
      const restorationState = {
        session: { nodes: [], edges: [], datasets: [] },
        datasets: new Map(),
        skippedDatasets: new Set<string>(),
      }

      usePipelineStore.getState().enterRestorationMode(restorationState)
      expect(usePipelineStore.getState().mode.type).toBe('restoring')

      usePipelineStore.getState().exitRestorationMode()
      expect(usePipelineStore.getState().mode.type).toBe('normal')
    })

    it('enters and exits branching mode', () => {
      const snapshot = usePipelineStore.getState().captureSnapshot()

      usePipelineStore.getState().enterBranchingMode('view1', snapshot)
      expect(usePipelineStore.getState().mode.type).toBe('branching')
      expect(usePipelineStore.getState().pendingBranchEdit?.viewId).toBe('view1')

      usePipelineStore.getState().exitBranchingMode()
      expect(usePipelineStore.getState().mode.type).toBe('normal')
    })

    it('enters and exits loading mode', () => {
      const sessionData = { nodes: [], edges: [], datasets: [] }
      const providedFiles = new Map<string, File>()

      usePipelineStore.getState().enterLoadingMode(sessionData, providedFiles)
      expect(usePipelineStore.getState().mode.type).toBe('loading')

      usePipelineStore.getState().exitLoadingMode()
      expect(usePipelineStore.getState().mode.type).toBe('normal')
    })
  })

  describe('batch updates', () => {
    it('updates multiple nodes at once', () => {
      const dataset1 = createDataset('1')
      const dataset2 = createDataset('2')

      usePipelineStore.getState().addDataset(dataset1)
      usePipelineStore.getState().addDataset(dataset2)

      usePipelineStore.getState().updateNodes({
        [dataset1.id]: { rowCount: 100 },
        [dataset2.id]: { rowCount: 200 },
      })

      expect(usePipelineStore.getState().nodes[dataset1.id].rowCount).toBe(100)
      expect(usePipelineStore.getState().nodes[dataset2.id].rowCount).toBe(200)
    })

    it('ignores updates for non-existent nodes', () => {
      const dataset = createDataset('1')
      usePipelineStore.getState().addDataset(dataset)

      usePipelineStore.getState().updateNodes({
        [dataset.id]: { rowCount: 100 },
        nonexistent: { rowCount: 999 },
      })

      expect(usePipelineStore.getState().nodes[dataset.id].rowCount).toBe(100)
      expect(usePipelineStore.getState().nodes.nonexistent).toBeUndefined()
    })
  })

  describe('data version', () => {
    it('increments data version', () => {
      const initialVersion = usePipelineStore.getState().dataVersion

      usePipelineStore.getState().bumpDataVersion()

      expect(usePipelineStore.getState().dataVersion).toBe(initialVersion + 1)
    })
  })
})
