import { describe, expect, it } from 'vitest'
import { PipelineEngine, type PipelineState } from '@/lib/core'
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

function createDataset(id: string): Dataset {
  return {
    id,
    type: 'dataset',
    name: `Dataset ${id}`,
    fileName: 'test.csv',
    createdAt: new Date(),
  }
}

function createView(id: string): DataView {
  return {
    id,
    type: 'view',
    name: `View ${id}`,
    createdAt: new Date(),
    operation: { type: 'select', columns: ['id'] },
  }
}

describe('PipelineEngine', () => {
  it('adds dataset and opens tab', () => {
    const state = createEmptyState()
    const dataset = createDataset('ds1')

    const { state: next, effects } = PipelineEngine.execute(state, { type: 'addDataset', dataset })

    expect(next.nodes.ds1).toEqual(dataset)
    expect(next.activeNodeId).toBe('ds1')
    expect(next.selectedNodeId).toBe('ds1')
    expect(next.openNodeIds).toContain('ds1')
    expect(effects).toContainEqual({ type: 'persist.markDirty' })
  })

  it('adds view with parent edge', () => {
    const dataset = createDataset('ds1')
    const state: PipelineState = { ...createEmptyState(), nodes: { ds1: dataset } }
    const view = createView('v1')

    const { state: next } = PipelineEngine.execute(state, {
      type: 'addView',
      view,
      parentIds: ['ds1'],
    })

    expect(next.nodes.v1).toEqual(view)
    expect(next.edges).toEqual([{ id: 'ds1-v1', sourceId: 'ds1', targetId: 'v1' }])
  })

  it('setNodeParents replaces incoming edges', () => {
    const ds1 = createDataset('ds1')
    const ds2 = createDataset('ds2')
    const view = createView('v1')
    const state: PipelineState = {
      ...createEmptyState(),
      nodes: { ds1, ds2, v1: view },
      edges: [{ id: 'ds1-v1', sourceId: 'ds1', targetId: 'v1' }],
    }

    const { state: next } = PipelineEngine.execute(state, {
      type: 'setNodeParents',
      nodeId: 'v1',
      parentIds: ['ds2'],
    })

    expect(next.edges).toEqual([{ id: 'ds2-v1', sourceId: 'ds2', targetId: 'v1' }])
  })

  it('removes node and descendants when cascading', () => {
    const ds1 = createDataset('ds1')
    const v1 = createView('v1')
    const v2 = createView('v2')
    const state: PipelineState = {
      ...createEmptyState(),
      nodes: { ds1, v1, v2 },
      edges: [
        { id: 'ds1-v1', sourceId: 'ds1', targetId: 'v1' },
        { id: 'v1-v2', sourceId: 'v1', targetId: 'v2' },
      ],
    }

    const { state: next } = PipelineEngine.execute(state, {
      type: 'removeNode',
      nodeId: 'v1',
      cascade: true,
    })

    expect(next.nodes.v1).toBeUndefined()
    expect(next.nodes.v2).toBeUndefined()
    expect(next.nodes.ds1).toBeDefined()
    expect(next.edges).toEqual([])
  })

  it('supports snapshot, undo, and redo', () => {
    const ds1 = createDataset('ds1')
    const state: PipelineState = { ...createEmptyState(), nodes: { ds1 } }
    const withSnap = PipelineEngine.execute(state, { type: 'captureSnapshot' }).state
    const withView = PipelineEngine.execute(withSnap, {
      type: 'addView',
      view: createView('v1'),
      parentIds: ['ds1'],
    }).state

    const undone = PipelineEngine.execute(withView, { type: 'undo' }).state
    expect(undone.nodes.v1).toBeUndefined()

    const redone = PipelineEngine.execute(undone, { type: 'redo' }).state
    expect(redone.redoStack).toHaveLength(0)
  })
})
