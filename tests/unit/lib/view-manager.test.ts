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
import type { Column, DataView, Operation, PipelineNode } from '@/types'

// Mock DuckDB client
function createMockClient(overrides: Partial<DuckDBClient> = {}): DuckDBClient {
  return {
    execute: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue({ rows: [], columns: [] }),
    describe: vi.fn().mockResolvedValue([
      { name: 'id', type: 'INTEGER' },
      { name: 'name', type: 'VARCHAR' },
    ]),
    count: vi.fn().mockResolvedValue(100),
    close: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

// Helper to create a mock dataset node
function createDatasetNode(overrides: Partial<PipelineNode> = {}): PipelineNode {
  return {
    id: 'dataset_1',
    type: 'dataset',
    name: 'Test Dataset',
    tableName: 'test_table',
    columns: [
      { name: 'id', type: 'INTEGER' },
      { name: 'name', type: 'VARCHAR' },
      { name: 'value', type: 'DOUBLE' },
    ],
    rowCount: 1000,
    position: { x: 0, y: 0 },
    createdAt: new Date(),
    ...overrides,
  } as PipelineNode
}

// Helper to create a mock view node
function createViewNode(overrides: Partial<DataView> = {}): DataView {
  return {
    id: 'view_filter_123',
    type: 'view',
    name: 'Test View',
    tableName: 'view_filter_123',
    columns: [
      { name: 'id', type: 'INTEGER' },
      { name: 'name', type: 'VARCHAR' },
    ],
    rowCount: 50,
    position: { x: 300, y: 0 },
    createdAt: new Date(),
    parentIds: ['dataset_1'],
    operation: {
      type: 'filter',
      expression: { type: 'condition', filter: { column: 'id', operator: 'gt', value: 0 } },
    },
    viewSql: 'CREATE VIEW "view_filter_123" AS SELECT * FROM "test_table" WHERE "id" > 0',
    ...overrides,
  }
}

describe('getViewSchema', () => {
  it('returns columns from client.describe', async () => {
    const expectedColumns: Column[] = [
      { name: 'col1', type: 'INTEGER' },
      { name: 'col2', type: 'VARCHAR' },
    ]
    const client = createMockClient({
      describe: vi.fn().mockResolvedValue(expectedColumns),
    })

    const result = await getViewSchema(client, 'test_view')

    expect(client.describe).toHaveBeenCalledWith('test_view')
    expect(result).toEqual(expectedColumns)
  })

  it('handles empty schema', async () => {
    const client = createMockClient({
      describe: vi.fn().mockResolvedValue([]),
    })

    const result = await getViewSchema(client, 'empty_view')

    expect(result).toEqual([])
  })
})

describe('getViewRowCount', () => {
  it('returns count from client.count', async () => {
    const client = createMockClient({
      count: vi.fn().mockResolvedValue(500),
    })

    const result = await getViewRowCount(client, 'test_view')

    expect(client.count).toHaveBeenCalledWith('test_view')
    expect(result).toBe(500)
  })

  it('returns 0 for empty view', async () => {
    const client = createMockClient({
      count: vi.fn().mockResolvedValue(0),
    })

    const result = await getViewRowCount(client, 'empty_view')

    expect(result).toBe(0)
  })
})

describe('createView', () => {
  it('creates view with valid filter operation', async () => {
    const client = createMockClient()
    const parentNode = createDatasetNode()
    const operation: Operation = {
      type: 'filter',
      expression: { type: 'condition', filter: { column: 'id', operator: 'gt', value: 0 } },
    }

    const result = await createView(client, parentNode, operation)

    expect(client.execute).toHaveBeenCalledWith(expect.stringContaining('CREATE VIEW'))
    expect(client.execute).toHaveBeenCalledWith(expect.stringContaining('WHERE "id" > 0'))
    expect(result.type).toBe('view')
    expect(result.parentIds).toEqual([parentNode.id])
    expect(result.operation).toBe(operation)
    // View name uses parent base name (test_table -> test) + operation abbreviation (flt)
    expect(result.tableName).toMatch(/^test_flt_[a-z0-9]{4}$/)
  })

  it('creates view with sort operation', async () => {
    const client = createMockClient()
    const parentNode = createDatasetNode()
    const operation: Operation = {
      type: 'sort',
      sorts: [{ column: 'name', direction: 'asc' }],
    }

    const result = await createView(client, parentNode, operation)

    expect(client.execute).toHaveBeenCalledWith(expect.stringContaining('ORDER BY'))
    expect(result.tableName).toMatch(/^test_srt_[a-z0-9]{4}$/)
  })

  it('creates view with custom position', async () => {
    const client = createMockClient()
    const parentNode = createDatasetNode()
    const operation: Operation = { type: 'distinct' }
    const position = { x: 500, y: 200 }

    const result = await createView(client, parentNode, operation, undefined, position)

    expect(result.position).toEqual(position)
  })

  it('calculates default position from parent', async () => {
    const client = createMockClient()
    const parentNode = createDatasetNode({ position: { x: 100, y: 50 } })
    const operation: Operation = { type: 'distinct' }

    const result = await createView(client, parentNode, operation)

    expect(result.position).toEqual({ x: 400, y: 50 }) // x + 300
  })

  it('includes parent ID for simple operations', async () => {
    const client = createMockClient()
    const parentNode = createDatasetNode({ id: 'parent_123' })
    const operation: Operation = { type: 'distinct' }

    const result = await createView(client, parentNode, operation)

    expect(result.parentIds).toEqual(['parent_123'])
  })

  it('includes multiple parent IDs for join operation', async () => {
    const client = createMockClient()
    const leftNode = createDatasetNode({ id: 'left_table', tableName: 'left_data' })
    const rightNode = createDatasetNode({ id: 'right_table', tableName: 'right_data' })
    const operation: Operation = {
      type: 'join',
      rightSourceId: 'right_table',
      joinType: 'inner',
      conditions: [{ leftColumn: 'id', operator: '=', rightColumn: 'id' }],
    }
    const additionalSources = {
      right_table: { node: rightNode },
    }

    const result = await createView(client, leftNode, operation, additionalSources)

    expect(result.parentIds).toContain('left_table')
    expect(result.parentIds).toContain('right_table')
  })

  it('includes multiple parent IDs for union operation', async () => {
    const client = createMockClient()
    const table1 = createDatasetNode({ id: 'table1', tableName: 'data1' })
    const table2 = createDatasetNode({ id: 'table2', tableName: 'data2' })
    const table3 = createDatasetNode({ id: 'table3', tableName: 'data3' })
    const operation: Operation = {
      type: 'union',
      sourceIds: ['table2', 'table3'],
      mode: 'all',
    }
    const additionalSources = {
      table2: { node: table2 },
      table3: { node: table3 },
    }

    const result = await createView(client, table1, operation, additionalSources)

    expect(result.parentIds).toContain('table1')
    expect(result.parentIds).toContain('table2')
    expect(result.parentIds).toContain('table3')
  })

  it('generates descriptive name from operation', async () => {
    const client = createMockClient()
    const parentNode = createDatasetNode({ name: 'Sales Data' })
    const operation: Operation = {
      type: 'filter',
      expression: { type: 'condition', filter: { column: 'amount', operator: 'gt', value: 100 } },
    }

    const result = await createView(client, parentNode, operation)

    expect(result.name).toBe('Sales Data → Filtered')
  })

  it('returns null rowCount (async fetching by caller)', async () => {
    const client = createMockClient()
    const parentNode = createDatasetNode()
    const operation: Operation = { type: 'distinct' }

    const result = await createView(client, parentNode, operation)

    expect(result.rowCount).toBeNull()
  })
})

describe('updateView', () => {
  it('updates view with CREATE OR REPLACE', async () => {
    const client = createMockClient()
    const existingView = createViewNode({ tableName: 'view_filter_456' })
    const parentNode = createDatasetNode()
    const newOperation: Operation = {
      type: 'filter',
      expression: { type: 'condition', filter: { column: 'id', operator: 'lt', value: 100 } },
    }

    const result = await updateView(client, existingView, newOperation, parentNode)

    expect(client.execute).toHaveBeenCalledWith(expect.stringContaining('CREATE OR REPLACE VIEW'))
    expect(client.execute).toHaveBeenCalledWith(expect.stringContaining('"view_filter_456"'))
    expect(result.operation).toBe(newOperation)
  })

  it('preserves view ID and position', async () => {
    const client = createMockClient()
    const existingView = createViewNode({
      id: 'my_view_id',
      tableName: 'my_view_table',
      position: { x: 123, y: 456 },
    })
    const parentNode = createDatasetNode()
    const newOperation: Operation = { type: 'distinct' }

    const result = await updateView(client, existingView, newOperation, parentNode)

    expect(result.id).toBe('my_view_id')
    expect(result.tableName).toBe('my_view_table')
    expect(result.position).toEqual({ x: 123, y: 456 })
  })

  it('updates schema after operation change', async () => {
    const newColumns: Column[] = [{ name: 'new_col', type: 'VARCHAR' }]
    const client = createMockClient({
      describe: vi.fn().mockResolvedValue(newColumns),
    })
    const existingView = createViewNode()
    const parentNode = createDatasetNode()
    const newOperation: Operation = { type: 'distinct' }

    const result = await updateView(client, existingView, newOperation, parentNode)

    expect(result.columns).toEqual(newColumns)
  })

  it('handles additional sources for join update', async () => {
    const client = createMockClient()
    const existingView = createViewNode()
    const leftNode = createDatasetNode({ tableName: 'left_data' })
    const rightNode = createDatasetNode({ id: 'right_id', tableName: 'right_data' })
    const newOperation: Operation = {
      type: 'join',
      rightSourceId: 'right_id',
      joinType: 'left',
      conditions: [{ leftColumn: 'id', operator: '=', rightColumn: 'id' }],
    }
    const additionalSources = {
      right_id: { node: rightNode },
    }

    await updateView(client, existingView, newOperation, leftNode, additionalSources)

    expect(client.execute).toHaveBeenCalledWith(expect.stringContaining('LEFT JOIN'))
    expect(client.execute).toHaveBeenCalledWith(expect.stringContaining('"right_data"'))
  })
})

describe('dropView', () => {
  it('executes DROP VIEW IF EXISTS', async () => {
    const client = createMockClient()

    await dropView(client, 'test_view')

    expect(client.execute).toHaveBeenCalledWith('DROP VIEW IF EXISTS "test_view"')
  })

  it('escapes view name with special characters', async () => {
    const client = createMockClient()

    await dropView(client, 'view"with"quotes')

    expect(client.execute).toHaveBeenCalledWith('DROP VIEW IF EXISTS "view""with""quotes"')
  })
})

describe('dropViews', () => {
  it('drops views in reverse order', async () => {
    const client = createMockClient()
    const executeCalls: string[] = []
    client.execute = vi.fn().mockImplementation((sql: string) => {
      executeCalls.push(sql)
      return Promise.resolve()
    })

    await dropViews(client, ['view_a', 'view_b', 'view_c'])

    // Should drop in reverse order (children first)
    expect(executeCalls).toEqual([
      'DROP VIEW IF EXISTS "view_c"',
      'DROP VIEW IF EXISTS "view_b"',
      'DROP VIEW IF EXISTS "view_a"',
    ])
  })

  it('handles empty array', async () => {
    const client = createMockClient()

    await dropViews(client, [])

    expect(client.execute).not.toHaveBeenCalled()
  })

  it('handles single view', async () => {
    const client = createMockClient()

    await dropViews(client, ['only_view'])

    expect(client.execute).toHaveBeenCalledTimes(1)
    expect(client.execute).toHaveBeenCalledWith('DROP VIEW IF EXISTS "only_view"')
  })
})

describe('createSqlQueryView', () => {
  it('creates view from custom SQL', async () => {
    const client = createMockClient()
    const nodes: Record<string, PipelineNode> = {
      ds1: createDatasetNode({ id: 'ds1', tableName: 'users' }),
    }
    const sql = 'SELECT * FROM users WHERE active = true'

    const result = await createSqlQueryView(client, sql, nodes)

    expect(client.execute).toHaveBeenCalledWith(expect.stringContaining('CREATE VIEW'))
    expect(client.execute).toHaveBeenCalledWith(expect.stringContaining(sql))
    expect(result.type).toBe('view')
    expect(result.name).toBe('SQL Query')
    expect(result.operation.type).toBe('sql')
  })

  it('extracts table names from simple SELECT', async () => {
    const client = createMockClient()
    const nodes: Record<string, PipelineNode> = {
      ds1: createDatasetNode({ id: 'ds1', tableName: 'orders' }),
    }
    const sql = 'SELECT * FROM orders'

    const result = await createSqlQueryView(client, sql, nodes)

    expect(result.parentIds).toContain('ds1')
    expect((result.operation as any).referencedTables).toContain('orders')
  })

  it('extracts table names from JOIN query', async () => {
    const client = createMockClient()
    const nodes: Record<string, PipelineNode> = {
      ds1: createDatasetNode({ id: 'ds1', tableName: 'orders' }),
      ds2: createDatasetNode({ id: 'ds2', tableName: 'customers' }),
    }
    const sql = 'SELECT * FROM orders JOIN customers ON orders.customer_id = customers.id'

    const result = await createSqlQueryView(client, sql, nodes)

    expect(result.parentIds).toContain('ds1')
    expect(result.parentIds).toContain('ds2')
  })

  it('handles quoted table names', async () => {
    const client = createMockClient()
    const nodes: Record<string, PipelineNode> = {
      ds1: createDatasetNode({ id: 'ds1', tableName: 'My Table' }),
    }
    const sql = 'SELECT * FROM "My Table"'

    const result = await createSqlQueryView(client, sql, nodes)

    expect(result.parentIds).toContain('ds1')
  })

  it('uses custom position when provided', async () => {
    const client = createMockClient()
    const nodes: Record<string, PipelineNode> = {}
    const sql = 'SELECT 1 AS value'
    const position = { x: 800, y: 400 }

    const result = await createSqlQueryView(client, sql, nodes, position)

    expect(result.position).toEqual(position)
  })

  it('calculates position from first parent node', async () => {
    const client = createMockClient()
    const nodes: Record<string, PipelineNode> = {
      ds1: createDatasetNode({ id: 'ds1', tableName: 'data', position: { x: 200, y: 100 } }),
    }
    const sql = 'SELECT * FROM data'

    const result = await createSqlQueryView(client, sql, nodes)

    expect(result.position).toEqual({ x: 500, y: 100 }) // parent.x + 300
  })

  it('uses default position when no parent nodes found', async () => {
    const client = createMockClient()
    const nodes: Record<string, PipelineNode> = {}
    const sql = 'SELECT 1 + 1 AS result'

    const result = await createSqlQueryView(client, sql, nodes)

    expect(result.position).toEqual({ x: 400, y: 200 }) // default
  })

  it('stores SQL and referenced tables in operation', async () => {
    const client = createMockClient()
    const nodes: Record<string, PipelineNode> = {
      ds1: createDatasetNode({ id: 'ds1', tableName: 'sales' }),
    }
    const sql = 'SELECT SUM(amount) FROM sales GROUP BY category'

    const result = await createSqlQueryView(client, sql, nodes)

    expect((result.operation as any).sql).toBe(sql)
    expect((result.operation as any).referencedTables).toContain('sales')
  })
})

describe('cleanupOrphanedViews', () => {
  it('drops views not in tracked set', async () => {
    const client = createMockClient({
      query: vi.fn().mockResolvedValue({
        rows: [{ table_name: 'view_filter_1' }, { table_name: 'view_sort_2' }, { table_name: 'view_pivot_3' }],
        columns: [],
      }),
    })
    const trackedViewNames = new Set(['view_filter_1'])

    const cleaned = await cleanupOrphanedViews(client, trackedViewNames)

    expect(cleaned).toContain('view_sort_2')
    expect(cleaned).toContain('view_pivot_3')
    expect(cleaned).not.toContain('view_filter_1')
    expect(client.execute).toHaveBeenCalledWith('DROP VIEW IF EXISTS "view_sort_2"')
    expect(client.execute).toHaveBeenCalledWith('DROP VIEW IF EXISTS "view_pivot_3"')
  })

  it('does nothing when all views are tracked', async () => {
    const client = createMockClient({
      query: vi.fn().mockResolvedValue({
        rows: [{ table_name: 'view_a' }, { table_name: 'view_b' }],
        columns: [],
      }),
    })
    const trackedViewNames = new Set(['view_a', 'view_b'])

    const cleaned = await cleanupOrphanedViews(client, trackedViewNames)

    expect(cleaned).toEqual([])
    expect(client.execute).not.toHaveBeenCalled()
  })

  it('handles empty views list', async () => {
    const client = createMockClient({
      query: vi.fn().mockResolvedValue({ rows: [], columns: [] }),
    })
    const trackedViewNames = new Set(['some_view'])

    const cleaned = await cleanupOrphanedViews(client, trackedViewNames)

    expect(cleaned).toEqual([])
  })

  it('handles empty tracked set', async () => {
    const client = createMockClient({
      query: vi.fn().mockResolvedValue({
        rows: [{ table_name: 'view_orphan_1' }, { table_name: 'view_orphan_2' }],
        columns: [],
      }),
    })
    const trackedViewNames = new Set<string>()

    const cleaned = await cleanupOrphanedViews(client, trackedViewNames)

    expect(cleaned).toHaveLength(2)
    expect(client.execute).toHaveBeenCalledTimes(2)
  })
})
