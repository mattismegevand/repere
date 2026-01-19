import { describe, expect, it } from 'vitest'
import type { PipelineState } from '@/lib/core'
import { PipelineEngine } from '@/lib/core'
import type { Dataset, DataView } from '@/types'

function createEmptyState(): PipelineState {
  return {
    nodes: {},
    edges: [],
    activeNodeId: null,
    selectedNodeId: null,
    openNodeIds: [],
    undoStack: [],
    redoStack: [],
  }
}

function createDataset(id: string, name: string): Dataset {
  return {
    id,
    type: 'dataset',
    name,
    tableName: `dataset_${id}`,
    columns: [{ name: 'id', type: 'integer', nullable: false }],
    rowCount: 100,
    createdAt: new Date(),
    position: { x: 0, y: 0 },
    fileName: 'test.csv',
  }
}

function createView(id: string, name: string, parentIds: string[]): DataView {
  return {
    id,
    type: 'view',
    name,
    tableName: `view_${id}`,
    columns: [{ name: 'id', type: 'integer', nullable: false }],
    rowCount: 50,
    createdAt: new Date(),
    position: { x: 100, y: 0 },
    parentIds,
    viewSql: `CREATE VIEW view_${id} AS SELECT * FROM source`,
    operation: { type: 'select', columns: ['id'] },
  }
}

describe('PipelineEngine', () => {
  describe('addDataset', () => {
    it('adds a dataset to state', () => {
      const state = createEmptyState()
      const dataset = createDataset('ds1', 'Test Dataset')

      const { state: newState, effects } = PipelineEngine.execute(state, {
        type: 'addDataset',
        dataset,
      })

      expect(newState.nodes.ds1).toEqual(dataset)
      expect(newState.activeNodeId).toBe('ds1')
      expect(newState.selectedNodeId).toBe('ds1')
      expect(newState.openNodeIds).toContain('ds1')
      expect(effects).toContainEqual({ type: 'persist.markDirty' })
    })
  })

  describe('addView', () => {
    it('adds a view with edge to parent', () => {
      const dataset = createDataset('ds1', 'Test Dataset')
      const state: PipelineState = {
        ...createEmptyState(),
        nodes: { ds1: dataset },
      }
      const view = createView('v1', 'Test View', ['ds1'])

      const { state: newState, effects } = PipelineEngine.execute(state, {
        type: 'addView',
        view,
        parentId: 'ds1',
      })

      expect(newState.nodes.v1).toEqual(view)
      expect(newState.edges).toContainEqual({
        id: 'ds1-v1',
        sourceId: 'ds1',
        targetId: 'v1',
      })
      expect(newState.activeNodeId).toBe('v1')
      expect(effects).toContainEqual({ type: 'persist.markDirty' })
      expect(effects).toContainEqual(expect.objectContaining({ type: 'duckdb.createView', viewName: 'view_v1' }))
    })
  })

  describe('removeNode', () => {
    it('removes a node and its descendants', () => {
      const dataset = createDataset('ds1', 'Dataset')
      const view1 = createView('v1', 'View 1', ['ds1'])
      const view2 = createView('v2', 'View 2', ['v1'])
      const state: PipelineState = {
        ...createEmptyState(),
        nodes: { ds1: dataset, v1: view1, v2: view2 },
        edges: [
          { id: 'ds1-v1', sourceId: 'ds1', targetId: 'v1' },
          { id: 'v1-v2', sourceId: 'v1', targetId: 'v2' },
        ],
        activeNodeId: 'v2',
        selectedNodeId: 'v2',
      }

      const { state: newState, effects } = PipelineEngine.execute(state, {
        type: 'removeNode',
        nodeId: 'v1',
        cascade: true,
      })

      expect(newState.nodes.v1).toBeUndefined()
      expect(newState.nodes.v2).toBeUndefined()
      expect(newState.nodes.ds1).toBeDefined()
      expect(newState.edges).toHaveLength(0)
      expect(effects).toContainEqual(
        expect.objectContaining({ type: 'duckdb.dropViews', viewNames: ['view_v1', 'view_v2'] })
      )
    })

    it('only removes specified node when cascade is false', () => {
      const dataset = createDataset('ds1', 'Dataset')
      const view1 = createView('v1', 'View 1', ['ds1'])
      const state: PipelineState = {
        ...createEmptyState(),
        nodes: { ds1: dataset, v1: view1 },
        edges: [{ id: 'ds1-v1', sourceId: 'ds1', targetId: 'v1' }],
      }

      const { state: newState } = PipelineEngine.execute(state, {
        type: 'removeNode',
        nodeId: 'v1',
        cascade: false,
      })

      expect(newState.nodes.v1).toBeUndefined()
      expect(newState.nodes.ds1).toBeDefined()
    })
  })

  describe('setActiveNode', () => {
    it('sets the active node', () => {
      const state: PipelineState = {
        ...createEmptyState(),
        nodes: { ds1: createDataset('ds1', 'Dataset') },
      }

      const { state: newState, effects } = PipelineEngine.execute(state, {
        type: 'setActiveNode',
        nodeId: 'ds1',
      })

      expect(newState.activeNodeId).toBe('ds1')
      expect(effects).toHaveLength(0)
    })
  })

  describe('selectNode', () => {
    it('selects a node', () => {
      const state: PipelineState = {
        ...createEmptyState(),
        nodes: { ds1: createDataset('ds1', 'Dataset') },
      }

      const { state: newState, effects } = PipelineEngine.execute(state, {
        type: 'selectNode',
        nodeId: 'ds1',
      })

      expect(newState.selectedNodeId).toBe('ds1')
      expect(effects).toHaveLength(0)
    })
  })

  describe('openTab / closeTab', () => {
    it('opens a tab for a node', () => {
      const state: PipelineState = {
        ...createEmptyState(),
        nodes: { ds1: createDataset('ds1', 'Dataset') },
      }

      const { state: newState } = PipelineEngine.execute(state, {
        type: 'openTab',
        nodeId: 'ds1',
      })

      expect(newState.openNodeIds).toContain('ds1')
      expect(newState.activeNodeId).toBe('ds1')
    })

    it('does not duplicate open tabs', () => {
      const state: PipelineState = {
        ...createEmptyState(),
        nodes: { ds1: createDataset('ds1', 'Dataset') },
        openNodeIds: ['ds1'],
      }

      const { state: newState } = PipelineEngine.execute(state, {
        type: 'openTab',
        nodeId: 'ds1',
      })

      expect(newState.openNodeIds).toHaveLength(1)
    })

    it('closes a tab', () => {
      const state: PipelineState = {
        ...createEmptyState(),
        nodes: {
          ds1: createDataset('ds1', 'Dataset 1'),
          ds2: createDataset('ds2', 'Dataset 2'),
        },
        openNodeIds: ['ds1', 'ds2'],
        activeNodeId: 'ds1',
      }

      const { state: newState } = PipelineEngine.execute(state, {
        type: 'closeTab',
        nodeId: 'ds1',
      })

      expect(newState.openNodeIds).not.toContain('ds1')
      expect(newState.activeNodeId).toBe('ds2')
    })
  })

  describe('undo / redo', () => {
    it('captures and restores snapshots', () => {
      const dataset = createDataset('ds1', 'Dataset')
      const state: PipelineState = {
        ...createEmptyState(),
        nodes: { ds1: dataset },
        activeNodeId: 'ds1',
        selectedNodeId: 'ds1',
        openNodeIds: ['ds1'],
      }

      // Capture snapshot
      const { state: stateWithSnapshot } = PipelineEngine.execute(state, {
        type: 'captureSnapshot',
      })

      expect(stateWithSnapshot.undoStack).toHaveLength(1)
      expect(stateWithSnapshot.redoStack).toHaveLength(0)

      // Add another node
      const view = createView('v1', 'View', ['ds1'])
      const { state: stateWithView } = PipelineEngine.execute(stateWithSnapshot, {
        type: 'addView',
        view,
        parentId: 'ds1',
      })

      expect(stateWithView.nodes.v1).toBeDefined()

      // Undo
      const { state: undoneState, effects } = PipelineEngine.execute(stateWithView, {
        type: 'undo',
      })

      expect(undoneState.nodes.v1).toBeUndefined()
      expect(undoneState.undoStack).toHaveLength(0)
      expect(undoneState.redoStack).toHaveLength(1)
      // Should have effect to drop the view
      expect(effects.some((e) => e.type === 'duckdb.dropViews')).toBe(true)

      // Redo
      const { state: redoneState } = PipelineEngine.execute(undoneState, {
        type: 'redo',
      })

      expect(redoneState.undoStack).toHaveLength(1)
      expect(redoneState.redoStack).toHaveLength(0)
    })

    it('does nothing when undo stack is empty', () => {
      const state = createEmptyState()

      const { state: newState, effects } = PipelineEngine.execute(state, {
        type: 'undo',
      })

      expect(newState).toEqual(state)
      expect(effects).toHaveLength(0)
    })
  })

  describe('updateNode', () => {
    it('updates node properties', () => {
      const dataset = createDataset('ds1', 'Original Name')
      const state: PipelineState = {
        ...createEmptyState(),
        nodes: { ds1: dataset },
      }

      const { state: newState } = PipelineEngine.execute(state, {
        type: 'updateNode',
        nodeId: 'ds1',
        updates: { name: 'New Name' },
      })

      expect(newState.nodes.ds1.name).toBe('New Name')
    })

    it('updates view SQL and emits effect', () => {
      const view = createView('v1', 'View', ['ds1'])
      const dataset = createDataset('ds1', 'Dataset')
      const state: PipelineState = {
        ...createEmptyState(),
        nodes: { ds1: dataset, v1: view },
        edges: [{ id: 'ds1-v1', sourceId: 'ds1', targetId: 'v1' }],
      }

      const { effects } = PipelineEngine.execute(state, {
        type: 'updateNode',
        nodeId: 'v1',
        updates: { viewSql: 'SELECT id FROM source WHERE id > 10' },
      })

      expect(effects).toContainEqual(
        expect.objectContaining({
          type: 'duckdb.updateView',
          viewName: 'view_v1',
        })
      )
    })
  })

  describe('graph utilities', () => {
    it('gets children of a node', () => {
      const edges = [
        { id: 'ds1-v1', sourceId: 'ds1', targetId: 'v1' },
        { id: 'ds1-v2', sourceId: 'ds1', targetId: 'v2' },
      ]

      const children = PipelineEngine.getChildren('ds1', edges)
      expect(children).toContain('v1')
      expect(children).toContain('v2')
    })

    it('gets parents of a node', () => {
      const edges = [
        { id: 'ds1-v1', sourceId: 'ds1', targetId: 'v1' },
        { id: 'ds2-v1', sourceId: 'ds2', targetId: 'v1' },
      ]

      const parents = PipelineEngine.getParents('v1', edges)
      expect(parents).toContain('ds1')
      expect(parents).toContain('ds2')
    })

    it('gets descendants of a node', () => {
      const edges = [
        { id: 'ds1-v1', sourceId: 'ds1', targetId: 'v1' },
        { id: 'v1-v2', sourceId: 'v1', targetId: 'v2' },
        { id: 'v2-v3', sourceId: 'v2', targetId: 'v3' },
      ]

      const descendants = PipelineEngine.getDescendants('ds1', edges)
      expect(descendants).toContain('v1')
      expect(descendants).toContain('v2')
      expect(descendants).toContain('v3')
    })
  })
})
