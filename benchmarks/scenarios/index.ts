import type { WasmClientNode } from '../clients/wasm-client-node'
import type { ScenarioName } from '../config'

export interface ScenarioContext {
  client: WasmClientNode
  dataPath: string
  secondaryDataPath?: string
  tableName: string
}

export interface WasmScenario {
  name: ScenarioName
  description: string
  category: 'file-loading' | 'query' | 'operation' | 'view'
  requiresSecondaryData?: boolean
  setup?: (ctx: ScenarioContext) => Promise<void>
  run: (ctx: ScenarioContext) => Promise<void>
  teardown?: (ctx: ScenarioContext) => Promise<void>
}

// File loading scenarios
const fileLoadCsv: WasmScenario = {
  name: 'file-load-csv',
  description: 'Load CSV file into table',
  category: 'file-loading',
  run: async (ctx) => {
    await ctx.client.loadFile(ctx.tableName, ctx.dataPath, 'csv')
  },
  teardown: async (ctx) => {
    await ctx.client.dropTable(ctx.tableName)
  },
}

const fileLoadParquet: WasmScenario = {
  name: 'file-load-parquet',
  description: 'Load Parquet file into table',
  category: 'file-loading',
  run: async (ctx) => {
    await ctx.client.loadFile(ctx.tableName, ctx.dataPath, 'parquet')
  },
  teardown: async (ctx) => {
    await ctx.client.dropTable(ctx.tableName)
  },
}

// Query scenarios
const querySelectAll: WasmScenario = {
  name: 'query-select-all',
  description: 'SELECT * from entire table',
  category: 'query',
  setup: async (ctx) => {
    await ctx.client.loadFile(ctx.tableName, ctx.dataPath)
  },
  run: async (ctx) => {
    await ctx.client.query(`SELECT * FROM "${ctx.tableName}"`)
  },
  teardown: async (ctx) => {
    await ctx.client.dropTable(ctx.tableName)
  },
}

const queryFilter: WasmScenario = {
  name: 'query-filter',
  description: 'Filter with compound conditions',
  category: 'query',
  setup: async (ctx) => {
    await ctx.client.loadFile(ctx.tableName, ctx.dataPath)
  },
  run: async (ctx) => {
    await ctx.client.query(
      `SELECT * FROM "${ctx.tableName}" WHERE value > 5000 AND category IN ('Electronics', 'Clothing', 'Food') AND active = true`
    )
  },
  teardown: async (ctx) => {
    await ctx.client.dropTable(ctx.tableName)
  },
}

const querySort: WasmScenario = {
  name: 'query-sort',
  description: 'Sort by multiple columns',
  category: 'query',
  setup: async (ctx) => {
    await ctx.client.loadFile(ctx.tableName, ctx.dataPath)
  },
  run: async (ctx) => {
    await ctx.client.query(`SELECT * FROM "${ctx.tableName}" ORDER BY value DESC, name ASC`)
  },
  teardown: async (ctx) => {
    await ctx.client.dropTable(ctx.tableName)
  },
}

const queryAggregate: WasmScenario = {
  name: 'query-aggregate',
  description: 'GROUP BY with multiple aggregations',
  category: 'query',
  setup: async (ctx) => {
    await ctx.client.loadFile(ctx.tableName, ctx.dataPath)
  },
  run: async (ctx) => {
    await ctx.client.query(
      `SELECT category, region, COUNT(*) as cnt, SUM(value) as total, AVG(score) as avg_score FROM "${ctx.tableName}" GROUP BY category, region`
    )
  },
  teardown: async (ctx) => {
    await ctx.client.dropTable(ctx.tableName)
  },
}

// Operation scenarios
const opFilter: WasmScenario = {
  name: 'op-filter',
  description: 'Filter operation via view',
  category: 'operation',
  setup: async (ctx) => {
    await ctx.client.loadFile(ctx.tableName, ctx.dataPath)
  },
  run: async (ctx) => {
    await ctx.client.execute('DROP VIEW IF EXISTS filter_view')
    await ctx.client.execute(
      `CREATE VIEW filter_view AS SELECT * FROM "${ctx.tableName}" WHERE value > 5000 AND active = true`
    )
    await ctx.client.query('SELECT * FROM filter_view')
  },
  teardown: async (ctx) => {
    await ctx.client.execute('DROP VIEW IF EXISTS filter_view')
    await ctx.client.dropTable(ctx.tableName)
  },
}

const opSort: WasmScenario = {
  name: 'op-sort',
  description: 'Sort operation via view',
  category: 'operation',
  setup: async (ctx) => {
    await ctx.client.loadFile(ctx.tableName, ctx.dataPath)
  },
  run: async (ctx) => {
    await ctx.client.execute('DROP VIEW IF EXISTS sort_view')
    await ctx.client.execute(`CREATE VIEW sort_view AS SELECT * FROM "${ctx.tableName}" ORDER BY value DESC, date ASC`)
    await ctx.client.query('SELECT * FROM sort_view')
  },
  teardown: async (ctx) => {
    await ctx.client.execute('DROP VIEW IF EXISTS sort_view')
    await ctx.client.dropTable(ctx.tableName)
  },
}

const opJoin: WasmScenario = {
  name: 'op-join',
  description: 'Inner join operation',
  category: 'operation',
  requiresSecondaryData: true,
  setup: async (ctx) => {
    await ctx.client.loadFile(ctx.tableName, ctx.dataPath)
    if (ctx.secondaryDataPath) {
      await ctx.client.loadFile('join_table', ctx.secondaryDataPath)
    }
  },
  run: async (ctx) => {
    await ctx.client.execute('DROP VIEW IF EXISTS join_view')
    await ctx.client.execute(
      `CREATE VIEW join_view AS SELECT b.*, j.extra_value, j.description FROM "${ctx.tableName}" b INNER JOIN join_table j ON b.id = j.id`
    )
    await ctx.client.query('SELECT * FROM join_view')
  },
  teardown: async (ctx) => {
    await ctx.client.execute('DROP VIEW IF EXISTS join_view')
    await ctx.client.dropTable(ctx.tableName)
    await ctx.client.dropTable('join_table')
  },
}

const opPivot: WasmScenario = {
  name: 'op-pivot',
  description: 'Pivot aggregation',
  category: 'operation',
  setup: async (ctx) => {
    await ctx.client.loadFile(ctx.tableName, ctx.dataPath)
  },
  run: async (ctx) => {
    await ctx.client.query(
      `SELECT category, SUM(CASE WHEN region = 'North' THEN value ELSE 0 END) as North, SUM(CASE WHEN region = 'South' THEN value ELSE 0 END) as South, SUM(CASE WHEN region = 'East' THEN value ELSE 0 END) as East, SUM(CASE WHEN region = 'West' THEN value ELSE 0 END) as West FROM "${ctx.tableName}" GROUP BY category`
    )
  },
  teardown: async (ctx) => {
    await ctx.client.dropTable(ctx.tableName)
  },
}

const opWindow: WasmScenario = {
  name: 'op-window',
  description: 'Window functions',
  category: 'operation',
  setup: async (ctx) => {
    await ctx.client.loadFile(ctx.tableName, ctx.dataPath)
  },
  run: async (ctx) => {
    await ctx.client.query(
      `SELECT *, ROW_NUMBER() OVER (PARTITION BY category ORDER BY value DESC) as rank, SUM(value) OVER (PARTITION BY category ORDER BY date ROWS UNBOUNDED PRECEDING) as running_total FROM "${ctx.tableName}"`
    )
  },
  teardown: async (ctx) => {
    await ctx.client.dropTable(ctx.tableName)
  },
}

// View scenarios
const viewCreate: WasmScenario = {
  name: 'view-create',
  description: 'Create a simple view',
  category: 'view',
  setup: async (ctx) => {
    await ctx.client.loadFile(ctx.tableName, ctx.dataPath)
  },
  run: async (ctx) => {
    await ctx.client.execute('DROP VIEW IF EXISTS test_view')
    await ctx.client.execute(`CREATE VIEW test_view AS SELECT * FROM "${ctx.tableName}" WHERE value > 5000`)
  },
  teardown: async (ctx) => {
    await ctx.client.execute('DROP VIEW IF EXISTS test_view')
    await ctx.client.dropTable(ctx.tableName)
  },
}

const viewChain5: WasmScenario = {
  name: 'view-chain-5',
  description: 'Query through 5 chained views',
  category: 'view',
  setup: async (ctx) => {
    await ctx.client.loadFile(ctx.tableName, ctx.dataPath)
  },
  run: async (ctx) => {
    // Create 5 chained views
    for (let i = 1; i <= 5; i++) {
      const prev = i === 1 ? `"${ctx.tableName}"` : `chain_view_${i - 1}`
      await ctx.client.execute(`DROP VIEW IF EXISTS chain_view_${i}`)
      await ctx.client.execute(`CREATE VIEW chain_view_${i} AS SELECT * FROM ${prev} WHERE value > ${i * 1000}`)
    }
    // Query through the chain
    await ctx.client.query('SELECT * FROM chain_view_5')
  },
  teardown: async (ctx) => {
    for (let i = 5; i >= 1; i--) {
      await ctx.client.execute(`DROP VIEW IF EXISTS chain_view_${i}`)
    }
    await ctx.client.dropTable(ctx.tableName)
  },
}

// Registry of all scenarios
const WASM_SCENARIOS: Record<ScenarioName, WasmScenario> = {
  'file-load-csv': fileLoadCsv,
  'file-load-parquet': fileLoadParquet,
  'query-select-all': querySelectAll,
  'query-filter': queryFilter,
  'query-sort': querySort,
  'query-aggregate': queryAggregate,
  'op-filter': opFilter,
  'op-sort': opSort,
  'op-join': opJoin,
  'op-pivot': opPivot,
  'op-window': opWindow,
  'view-create': viewCreate,
  'view-chain-5': viewChain5,
}

export function getScenario(name: ScenarioName): WasmScenario {
  const scenario = WASM_SCENARIOS[name]
  if (!scenario) {
    throw new Error(`Unknown scenario: ${name}`)
  }
  return scenario
}

function getScenariosByCategory(category: 'file-loading' | 'query' | 'operation' | 'view'): WasmScenario[] {
  return Object.values(WASM_SCENARIOS).filter((s) => s.category === category)
}
