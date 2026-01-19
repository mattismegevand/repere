import { describe, expect, it } from 'vitest'
import { filterSessionBySkippedNodes, validateSchema } from '@/lib/pipeline/persistence'
import type { Column, Dataset, DataView, PipelineEdge, PipelineNode } from '@/types'

const expectedColumns: Column[] = [
  { name: 'id', type: 'number', nullable: false },
  { name: 'name', type: 'string', nullable: false },
  { name: 'active', type: 'boolean', nullable: true },
]

describe('validateSchema', () => {
  it('accepts files with extra columns', () => {
    const fileColumns: Column[] = [...expectedColumns, { name: 'extra', type: 'string', nullable: true }]

    expect(validateSchema(fileColumns, expectedColumns)).toEqual({ valid: true })
  })

  it('returns missing column errors', () => {
    const fileColumns: Column[] = [
      { name: 'id', type: 'number', nullable: false },
      { name: 'name', type: 'string', nullable: false },
    ]

    const result = validateSchema(fileColumns, expectedColumns)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.missingColumns).toEqual(['active'])
      expect(result.typeMismatches).toEqual([])
    }
  })

  it('returns type mismatch errors', () => {
    const fileColumns: Column[] = [
      { name: 'id', type: 'string', nullable: false },
      { name: 'name', type: 'string', nullable: false },
      { name: 'active', type: 'boolean', nullable: true },
    ]

    const result = validateSchema(fileColumns, expectedColumns)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.missingColumns).toEqual([])
      expect(result.typeMismatches).toEqual([{ column: 'id', expected: 'number', actual: 'string' }])
    }
  })

  it('treats compatible numeric and string types as valid', () => {
    const fileColumns: Column[] = [
      { name: 'id', type: 'bigint', nullable: false },
      { name: 'name', type: 'varchar', nullable: false },
      { name: 'active', type: 'boolean', nullable: true },
    ]

    expect(validateSchema(fileColumns, expectedColumns)).toEqual({ valid: true })
  })

  describe('type compatibility', () => {
    it('INT → BIGINT is compatible', () => {
      const expected: Column[] = [{ name: 'col', type: 'int', nullable: false }]
      const actual: Column[] = [{ name: 'col', type: 'bigint', nullable: false }]
      expect(validateSchema(actual, expected)).toEqual({ valid: true })
    })

    it('BIGINT → INTEGER is compatible', () => {
      const expected: Column[] = [{ name: 'col', type: 'bigint', nullable: false }]
      const actual: Column[] = [{ name: 'col', type: 'integer', nullable: false }]
      expect(validateSchema(actual, expected)).toEqual({ valid: true })
    })

    it('VARCHAR(50) → VARCHAR is compatible', () => {
      const expected: Column[] = [{ name: 'col', type: 'varchar(50)', nullable: false }]
      const actual: Column[] = [{ name: 'col', type: 'varchar', nullable: false }]
      expect(validateSchema(actual, expected)).toEqual({ valid: true })
    })

    it('TEXT → VARCHAR is compatible', () => {
      const expected: Column[] = [{ name: 'col', type: 'text', nullable: false }]
      const actual: Column[] = [{ name: 'col', type: 'varchar', nullable: false }]
      expect(validateSchema(actual, expected)).toEqual({ valid: true })
    })

    it('DATE → TIMESTAMP is compatible', () => {
      const expected: Column[] = [{ name: 'col', type: 'date', nullable: false }]
      const actual: Column[] = [{ name: 'col', type: 'timestamp', nullable: false }]
      expect(validateSchema(actual, expected)).toEqual({ valid: true })
    })

    it('TIMESTAMP → DATE is compatible', () => {
      const expected: Column[] = [{ name: 'col', type: 'timestamp', nullable: false }]
      const actual: Column[] = [{ name: 'col', type: 'date', nullable: false }]
      expect(validateSchema(actual, expected)).toEqual({ valid: true })
    })

    it('DOUBLE → FLOAT is compatible', () => {
      const expected: Column[] = [{ name: 'col', type: 'double', nullable: false }]
      const actual: Column[] = [{ name: 'col', type: 'float', nullable: false }]
      expect(validateSchema(actual, expected)).toEqual({ valid: true })
    })

    it('DECIMAL → NUMERIC is compatible', () => {
      const expected: Column[] = [{ name: 'col', type: 'decimal', nullable: false }]
      const actual: Column[] = [{ name: 'col', type: 'numeric', nullable: false }]
      expect(validateSchema(actual, expected)).toEqual({ valid: true })
    })

    it('number → string is NOT compatible', () => {
      const expected: Column[] = [{ name: 'col', type: 'number', nullable: false }]
      const actual: Column[] = [{ name: 'col', type: 'string', nullable: false }]
      const result = validateSchema(actual, expected)
      expect(result.valid).toBe(false)
    })

    it('boolean → number is NOT compatible', () => {
      const expected: Column[] = [{ name: 'col', type: 'boolean', nullable: false }]
      const actual: Column[] = [{ name: 'col', type: 'number', nullable: false }]
      const result = validateSchema(actual, expected)
      expect(result.valid).toBe(false)
    })

    it('date → string is NOT compatible', () => {
      const expected: Column[] = [{ name: 'col', type: 'date', nullable: false }]
      const actual: Column[] = [{ name: 'col', type: 'string', nullable: false }]
      const result = validateSchema(actual, expected)
      expect(result.valid).toBe(false)
    })
  })

  describe('multiple errors', () => {
    it('returns both missing columns and type mismatches', () => {
      const expected: Column[] = [
        { name: 'a', type: 'number', nullable: false },
        { name: 'b', type: 'string', nullable: false },
        { name: 'c', type: 'boolean', nullable: false },
      ]
      const actual: Column[] = [
        { name: 'a', type: 'string', nullable: false }, // type mismatch
        // 'b' is missing
        { name: 'c', type: 'boolean', nullable: false }, // ok
      ]

      const result = validateSchema(actual, expected)
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.missingColumns).toEqual(['b'])
        expect(result.typeMismatches).toHaveLength(1)
        expect(result.typeMismatches[0].column).toBe('a')
      }
    })
  })

  describe('edge cases', () => {
    it('handles empty expected columns', () => {
      const actual: Column[] = [{ name: 'extra', type: 'string', nullable: false }]
      expect(validateSchema(actual, [])).toEqual({ valid: true })
    })

    it('handles empty actual columns with expected columns', () => {
      const expected: Column[] = [{ name: 'col', type: 'string', nullable: false }]
      const result = validateSchema([], expected)
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.missingColumns).toEqual(['col'])
      }
    })

    it('handles both empty', () => {
      expect(validateSchema([], [])).toEqual({ valid: true })
    })

    it('is case-sensitive for column names', () => {
      const expected: Column[] = [{ name: 'MyColumn', type: 'string', nullable: false }]
      const actual: Column[] = [{ name: 'mycolumn', type: 'string', nullable: false }]
      const result = validateSchema(actual, expected)
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.missingColumns).toEqual(['MyColumn'])
      }
    })
  })
})

describe('filterSessionBySkippedNodes', () => {
  // Helper to create test data
  function createTestSessionData() {
    const nodes: Record<string, PipelineNode> = {
      ds1: {
        id: 'ds1',
        type: 'dataset',
        name: 'Dataset 1',
        tableName: 'ds1',
        columns: [],
        rowCount: 100,
        position: { x: 0, y: 0 },
        createdAt: new Date(),
        fileName: 'data.csv',
        fileSize: 1000,
      } as Dataset,
      ds2: {
        id: 'ds2',
        type: 'dataset',
        name: 'Dataset 2',
        tableName: 'ds2',
        columns: [],
        rowCount: 200,
        position: { x: 0, y: 100 },
        createdAt: new Date(),
        fileName: 'data2.csv',
        fileSize: 2000,
      } as Dataset,
      v1: {
        id: 'v1',
        type: 'view',
        name: 'View 1',
        tableName: 'v1',
        columns: [],
        rowCount: 50,
        position: { x: 100, y: 0 },
        createdAt: new Date(),
        parentIds: ['ds1'],
        operation: { type: 'distinct' },
        viewSql: '',
      } as DataView,
      v2: {
        id: 'v2',
        type: 'view',
        name: 'View 2',
        tableName: 'v2',
        columns: [],
        rowCount: 25,
        position: { x: 200, y: 0 },
        createdAt: new Date(),
        parentIds: ['v1'],
        operation: { type: 'distinct' },
        viewSql: '',
      } as DataView,
    }

    const edges: PipelineEdge[] = [
      { id: 'ds1-v1', sourceId: 'ds1', targetId: 'v1' },
      { id: 'v1-v2', sourceId: 'v1', targetId: 'v2' },
    ]

    return {
      nodes,
      edges,
      activeNodeId: 'v1',
      openNodeIds: ['ds1', 'v1', 'v2'],
      embeddedFiles: new Map<string, File>([['ds1', new File([], 'ds1.parquet')]]),
      requiredFiles: [{ nodeId: 'ds2', fileName: 'data2.csv', expectedColumns: [] }],
    }
  }

  it('returns unchanged data when no nodes are skipped', () => {
    const data = createTestSessionData()
    const result = filterSessionBySkippedNodes(data, new Set())

    expect(result).toBe(data) // Should be exact same reference
  })

  it('removes skipped node and its descendants', () => {
    const data = createTestSessionData()
    const result = filterSessionBySkippedNodes(data, new Set(['ds1']))

    expect(result.nodes.ds1).toBeUndefined()
    expect(result.nodes.v1).toBeUndefined() // child
    expect(result.nodes.v2).toBeUndefined() // grandchild
    expect(result.nodes.ds2).toBeDefined() // unrelated
  })

  it('removes edges connected to skipped nodes', () => {
    const data = createTestSessionData()
    const result = filterSessionBySkippedNodes(data, new Set(['v1']))

    expect(result.edges).toHaveLength(0) // Both edges involve v1 or v2
  })

  it('filters openNodeIds', () => {
    const data = createTestSessionData()
    const result = filterSessionBySkippedNodes(data, new Set(['v1']))

    expect(result.openNodeIds).toEqual(['ds1'])
  })

  it('clears activeNodeId if it was removed', () => {
    const data = createTestSessionData()
    data.activeNodeId = 'v1'
    const result = filterSessionBySkippedNodes(data, new Set(['v1']))

    expect(result.activeNodeId).toBeNull()
  })

  it('preserves activeNodeId if not removed', () => {
    const data = createTestSessionData()
    data.activeNodeId = 'ds2'
    const result = filterSessionBySkippedNodes(data, new Set(['ds1']))

    expect(result.activeNodeId).toBe('ds2')
  })

  it('filters embedded files', () => {
    const data = createTestSessionData()
    const result = filterSessionBySkippedNodes(data, new Set(['ds1']))

    expect(result.embeddedFiles.has('ds1')).toBe(false)
  })

  it('filters required files', () => {
    const data = createTestSessionData()
    const result = filterSessionBySkippedNodes(data, new Set(['ds2']))

    expect(result.requiredFiles.find((r) => r.nodeId === 'ds2')).toBeUndefined()
  })
})
