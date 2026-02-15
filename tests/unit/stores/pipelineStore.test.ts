import { beforeEach, describe, expect, it } from 'vitest'
import { usePipelineLayoutStore } from '@/stores/pipelineLayoutStore'
import { usePipelineRuntimeStore } from '@/stores/pipelineRuntimeStore'
import { usePipelineStore } from '@/stores/pipelineStore'
import type { Dataset, DataView } from '@/types'
import type { NodeLayout } from '@/types/pipelineLayout'
import type { NodeRuntime } from '@/types/pipelineRuntime'

const baseRuntime: NodeRuntime = {
  tableName: 'table_1',
  columns: [{ name: 'id', type: 'number', nullable: false, duckdbType: 'BIGINT' }],
  rowCount: 10,
}

const baseLayout: NodeLayout = {
  position: { x: 0, y: 0 },
  isExpanded: false,
}

const createDataset = (id: string): Dataset => ({
  id,
  type: 'dataset',
  name: `Dataset ${id}`,
  fileName: `file_${id}.csv`,
  createdAt: new Date('2024-01-01T00:00:00Z'),
})

const createView = (id: string): DataView => ({
  id,
  type: 'view',
  name: `View ${id}`,
  createdAt: new Date('2024-01-02T00:00:00Z'),
  operation: {
    type: 'filter',
    expression: { type: 'condition', filter: { column: 'id', operator: 'gt', value: 0 } },
  },
})

describe('pipelineStore', () => {
  beforeEach(() => {
    usePipelineStore.getState().reset()
    usePipelineRuntimeStore.getState().reset()
    usePipelineLayoutStore.getState().reset()
  })

  it('adds dataset with runtime and layout state', () => {
    const dataset = createDataset('ds1')
    usePipelineStore.getState().addDataset(dataset, baseRuntime, baseLayout)

    expect(usePipelineStore.getState().nodes[dataset.id]).toEqual(dataset)
    expect(usePipelineRuntimeStore.getState().nodes[dataset.id]).toEqual(baseRuntime)
    expect(usePipelineLayoutStore.getState().nodes[dataset.id]).toEqual(baseLayout)
  })

  it('adds view with parent edges', () => {
    const dataset = createDataset('ds1')
    const view = createView('v1')

    usePipelineStore.getState().addDataset(dataset, baseRuntime, baseLayout)
    usePipelineStore
      .getState()
      .addView(
        view,
        [dataset.id],
        { ...baseRuntime, tableName: 'view_v1', viewSql: 'CREATE VIEW view_v1 AS SELECT 1' },
        { position: { x: 300, y: 0 } }
      )

    expect(usePipelineStore.getState().edges).toEqual([{ id: 'ds1-v1', sourceId: 'ds1', targetId: 'v1' }])
  })

  it('updateNode splits domain/runtime/layout and parent updates', () => {
    const ds1 = createDataset('ds1')
    const ds2 = createDataset('ds2')
    const view = createView('v1')

    usePipelineStore.getState().addDataset(ds1, { ...baseRuntime, tableName: 'table_ds1' }, baseLayout)
    usePipelineStore.getState().addDataset(ds2, { ...baseRuntime, tableName: 'table_ds2' }, baseLayout)
    usePipelineStore.getState().addView(view, [ds1.id], { ...baseRuntime, tableName: 'view_v1' }, baseLayout)

    usePipelineStore.getState().updateNode(view.id, {
      name: 'Renamed',
      tableName: 'view_v1_new',
      rowCount: 123,
      position: { x: 900, y: 200 },
      parentIds: [ds2.id],
    })

    expect(usePipelineStore.getState().nodes[view.id].name).toBe('Renamed')
    expect(usePipelineRuntimeStore.getState().nodes[view.id].tableName).toBe('view_v1_new')
    expect(usePipelineRuntimeStore.getState().nodes[view.id].rowCount).toBe(123)
    expect(usePipelineLayoutStore.getState().nodes[view.id].position).toEqual({ x: 900, y: 200 })
    expect(usePipelineStore.getState().edges).toEqual([{ id: 'ds2-v1', sourceId: 'ds2', targetId: 'v1' }])
  })

  it('cascadeDelete removes descendants and side stores', () => {
    const dataset = createDataset('ds1')
    const view = createView('v1')

    usePipelineStore.getState().addDataset(dataset, baseRuntime, baseLayout)
    usePipelineStore.getState().addView(view, [dataset.id], { ...baseRuntime, tableName: 'view_v1' }, baseLayout)

    const removed = usePipelineStore.getState().cascadeDelete(dataset.id)

    expect(removed).toEqual(['v1'])
    expect(usePipelineStore.getState().nodes[dataset.id]).toBeUndefined()
    expect(usePipelineStore.getState().nodes[view.id]).toBeUndefined()
    expect(usePipelineRuntimeStore.getState().nodes[dataset.id]).toBeUndefined()
    expect(usePipelineLayoutStore.getState().nodes[view.id]).toBeUndefined()
  })

  it('duplicates branch and offsets layout positions', () => {
    const dataset = createDataset('ds1')
    usePipelineStore
      .getState()
      .addDataset(dataset, { ...baseRuntime, tableName: 'table_ds1' }, { position: { x: 100, y: 100 } })

    const result = usePipelineStore.getState().duplicateBranch(dataset.id)
    expect(result).not.toBeNull()
    expect(result?.newRootId).toBeDefined()

    const clonedLayout = usePipelineLayoutStore.getState().nodes[result!.newRootId]
    expect(clonedLayout.position.x).toBeGreaterThan(100)
    expect(clonedLayout.position.y).toBeGreaterThan(100)
  })

  it('captures and restores snapshot', () => {
    const dataset = createDataset('ds1')
    usePipelineStore.getState().addDataset(dataset, baseRuntime, baseLayout)

    const snapshot = usePipelineStore.getState().captureSnapshot()
    usePipelineStore.getState().removeDataset(dataset.id)
    expect(usePipelineStore.getState().nodes[dataset.id]).toBeUndefined()

    usePipelineStore.getState().restoreSnapshot(snapshot)
    expect(usePipelineStore.getState().nodes[dataset.id]).toBeDefined()
  })
})
