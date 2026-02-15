import { describe, expect, it, vi } from 'vitest'
import type { DuckDBClient } from '@/lib/duckdb/interface'
import {
  cleanupOrphanedViews,
  createSqlQueryView,
  createView,
  dropView,
  dropViews,
  getViewRowCount,
  getViewSchema,
  updateView,
} from '@/lib/duckdb/view-manager'
import type { Dataset, DataView, Operation, PipelineNode } from '@/types'
import type { NodeRuntime, RuntimeColumn } from '@/types/pipelineRuntime'

function createMockClient(overrides: Partial<DuckDBClient> = {}): DuckDBClient {
  return {
    execute: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue({ rows: [], columns: [] }),
    describe: vi.fn().mockResolvedValue([{ name: 'id', type: 'number', nullable: false, duckdbType: 'BIGINT' }]),
    count: vi.fn().mockResolvedValue(100),
    close: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function createDatasetNode(id: string, name = 'Dataset'): Dataset {
  return {
    id,
    type: 'dataset',
    name,
    fileName: `${id}.csv`,
    createdAt: new Date('2024-01-01T00:00:00Z'),
  }
}

function createViewNode(id: string, op: Operation): DataView {
  return {
    id,
    type: 'view',
    name: `View ${id}`,
    createdAt: new Date('2024-01-02T00:00:00Z'),
    operation: op,
  }
}

function runtime(tableName: string, columns?: RuntimeColumn[]): NodeRuntime {
  return {
    tableName,
    columns: columns ?? [{ name: 'id', type: 'number', nullable: false, duckdbType: 'BIGINT' }],
  }
}

describe('view-manager', () => {
  it('gets schema and row count from client', async () => {
    const client = createMockClient()

    const schema = await getViewSchema(client, 'view_test')
    const rowCount = await getViewRowCount(client, 'view_test')

    expect(client.describe).toHaveBeenCalledWith('view_test')
    expect(client.count).toHaveBeenCalledWith('view_test')
    expect(schema.length).toBeGreaterThan(0)
    expect(rowCount).toBe(100)
  })

  it('creates view and returns runtime + parent ids', async () => {
    const client = createMockClient()
    const parent = { node: createDatasetNode('ds1', 'Sales'), runtime: runtime('sales_table') }
    const operation: Operation = { type: 'distinct' }

    const result = await createView(client, parent, operation)

    expect(client.execute).toHaveBeenCalledWith(expect.stringContaining('CREATE VIEW'))
    expect(result.view.type).toBe('view')
    expect(result.view.operation).toEqual(operation)
    expect(result.runtime.tableName).toBeDefined()
    expect(result.parentIds).toEqual(['ds1'])
  })

  it('updates view using existing runtime table name', async () => {
    const client = createMockClient()
    const existingView = createViewNode('v1', { type: 'distinct' })
    const existingRuntime = runtime('view_v1')
    const parent = { node: createDatasetNode('ds1'), runtime: runtime('dataset_ds1') }

    const result = await updateView(client, existingView, { type: 'limit', limit: 10 }, existingRuntime, parent)

    expect(client.execute).toHaveBeenCalledWith(expect.stringContaining('CREATE OR REPLACE VIEW'))
    expect(client.execute).toHaveBeenCalledWith(expect.stringContaining('view_v1'))
    expect(result.runtime.tableName).toBe('view_v1')
  })

  it('creates SQL query view and detects parent nodes by runtime table names', async () => {
    const client = createMockClient()
    const nodes: Record<string, PipelineNode> = {
      ds1: createDatasetNode('ds1'),
      ds2: createDatasetNode('ds2'),
    }
    const runtimeById: Record<string, NodeRuntime> = {
      ds1: runtime('orders'),
      ds2: runtime('customers'),
    }

    const result = await createSqlQueryView(
      client,
      'SELECT * FROM orders JOIN customers ON orders.customer_id = customers.id',
      nodes,
      runtimeById
    )

    expect(result.parentIds).toContain('ds1')
    expect(result.parentIds).toContain('ds2')
    expect(result.view.operation.type).toBe('sql')
    expect(client.execute).toHaveBeenCalledWith(expect.stringContaining('CREATE VIEW'))
  })

  it('drops views in reverse order', async () => {
    const executeCalls: string[] = []
    const client = createMockClient({
      execute: vi.fn().mockImplementation(async (sql: string) => {
        executeCalls.push(sql)
      }),
    })

    await dropViews(client, ['view_a', 'view_b', 'view_c'])

    expect(executeCalls).toEqual([
      'DROP VIEW IF EXISTS "view_c"',
      'DROP VIEW IF EXISTS "view_b"',
      'DROP VIEW IF EXISTS "view_a"',
    ])
  })

  it('drops single view', async () => {
    const client = createMockClient()
    await dropView(client, 'view_test')
    expect(client.execute).toHaveBeenCalledWith('DROP VIEW IF EXISTS "view_test"')
  })

  it('cleans orphaned views', async () => {
    const client = createMockClient({
      query: vi.fn().mockResolvedValue({
        rows: [{ table_name: 'view_keep' }, { table_name: 'view_drop' }],
        columns: [],
      }),
    })

    const cleaned = await cleanupOrphanedViews(client, new Set(['view_keep']))
    expect(cleaned).toEqual(['view_drop'])
    expect(client.execute).toHaveBeenCalledWith('DROP VIEW IF EXISTS "view_drop"')
  })
})
