import { describe, expect, it } from 'vitest'
import { getChildren, getDescendants, getParents, getRootNodes, getTopologicalOrder } from '@/lib/graph/dag-operations'
import type { Dataset, DataView, PipelineEdge, PipelineNode } from '@/types'

// Helper to create a dataset node
function createDataset(id: string): Dataset {
  return {
    id,
    type: 'dataset',
    tableName: `table_${id}`,
    label: `Dataset ${id}`,
    fileName: `file_${id}.csv`,
    columns: [],
  }
}

// Helper to create a view node
function createView(id: string, parentIds: string[]): DataView {
  return {
    id,
    type: 'view',
    tableName: `view_${id}`,
    label: `View ${id}`,
    parentIds,
    operation: { type: 'filter', expression: { type: 'group', combineMode: 'and', children: [] } },
    viewSql: `CREATE VIEW view_${id} AS SELECT * FROM parent`,
    columns: [],
  }
}

// Helper to create an edge
function createEdge(sourceId: string, targetId: string): PipelineEdge {
  return { id: `${sourceId}-${targetId}`, sourceId, targetId }
}

describe('getChildren', () => {
  it('returns direct children only', () => {
    const edges = [createEdge('a', 'b'), createEdge('b', 'c')]
    const result = getChildren('a', edges)

    expect(result).toEqual(['b'])
  })

  it('returns empty array for leaf nodes', () => {
    const edges = [createEdge('a', 'b')]
    const result = getChildren('b', edges)

    expect(result).toEqual([])
  })

  it('returns multiple children', () => {
    const edges = [createEdge('a', 'b'), createEdge('a', 'c'), createEdge('a', 'd')]
    const result = getChildren('a', edges)

    expect(result).toEqual(['b', 'c', 'd'])
  })

  it('returns empty array for unknown node', () => {
    const edges = [createEdge('a', 'b')]
    const result = getChildren('unknown', edges)

    expect(result).toEqual([])
  })

  it('handles empty edges array', () => {
    const result = getChildren('a', [])

    expect(result).toEqual([])
  })
})

describe('getParents', () => {
  it('returns direct parents only', () => {
    const edges = [createEdge('a', 'b'), createEdge('b', 'c')]
    const result = getParents('b', edges)

    expect(result).toEqual(['a'])
  })

  it('returns empty array for root nodes', () => {
    const edges = [createEdge('a', 'b')]
    const result = getParents('a', edges)

    expect(result).toEqual([])
  })

  it('returns multiple parents (join scenario)', () => {
    const edges = [createEdge('a', 'c'), createEdge('b', 'c')]
    const result = getParents('c', edges)

    expect(result).toEqual(['a', 'b'])
  })

  it('returns empty array for unknown node', () => {
    const edges = [createEdge('a', 'b')]
    const result = getParents('unknown', edges)

    expect(result).toEqual([])
  })

  it('handles empty edges array', () => {
    const result = getParents('a', [])

    expect(result).toEqual([])
  })
})

describe('getDescendants', () => {
  it('returns all descendants recursively', () => {
    // a -> b -> c -> d
    const edges = [createEdge('a', 'b'), createEdge('b', 'c'), createEdge('c', 'd')]
    const result = getDescendants('a', edges)

    expect(result).toContain('b')
    expect(result).toContain('c')
    expect(result).toContain('d')
    expect(result).toHaveLength(3)
  })

  it('handles diamond pattern (A->B, A->C, B->D, C->D)', () => {
    const edges = [createEdge('a', 'b'), createEdge('a', 'c'), createEdge('b', 'd'), createEdge('c', 'd')]
    const result = getDescendants('a', edges)

    expect(result).toContain('b')
    expect(result).toContain('c')
    expect(result).toContain('d')
    // d should only appear once despite two paths
    expect(result.filter((id) => id === 'd')).toHaveLength(1)
  })

  it('returns empty array for leaf nodes', () => {
    const edges = [createEdge('a', 'b')]
    const result = getDescendants('b', edges)

    expect(result).toEqual([])
  })

  it('returns all descendants including branched paths', () => {
    // a -> b, a -> c, b -> d
    const edges = [createEdge('a', 'b'), createEdge('a', 'c'), createEdge('b', 'd')]
    const result = getDescendants('a', edges)

    // All descendants should be included
    expect(result).toContain('b')
    expect(result).toContain('c')
    expect(result).toContain('d')
    expect(result).toHaveLength(3)
    // b must come before d (parent before child)
    expect(result.indexOf('b')).toBeLessThan(result.indexOf('d'))
  })

  it('handles empty edges array', () => {
    const result = getDescendants('a', [])

    expect(result).toEqual([])
  })
})

describe('getRootNodes', () => {
  it('returns nodes with no incoming edges', () => {
    const nodes: Record<string, PipelineNode> = {
      a: createDataset('a'),
      b: createView('b', ['a']),
    }
    const edges = [createEdge('a', 'b')]
    const result = getRootNodes(nodes, edges)

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('a')
  })

  it('handles multiple root nodes (datasets)', () => {
    const nodes: Record<string, PipelineNode> = {
      a: createDataset('a'),
      b: createDataset('b'),
      c: createView('c', ['a', 'b']),
    }
    const edges = [createEdge('a', 'c'), createEdge('b', 'c')]
    const result = getRootNodes(nodes, edges)

    expect(result).toHaveLength(2)
    expect(result.map((n) => n.id).sort()).toEqual(['a', 'b'])
  })

  it('returns all nodes when no edges exist', () => {
    const nodes: Record<string, PipelineNode> = {
      a: createDataset('a'),
      b: createDataset('b'),
    }
    const result = getRootNodes(nodes, [])

    expect(result).toHaveLength(2)
  })

  it('returns empty array when all nodes have parents', () => {
    // This is an unusual case (circular or external reference)
    const nodes: Record<string, PipelineNode> = {
      a: createView('a', ['external']),
    }
    const edges = [createEdge('external', 'a')]
    const result = getRootNodes(nodes, edges)

    expect(result).toHaveLength(0)
  })

  it('handles empty nodes object', () => {
    const result = getRootNodes({}, [])

    expect(result).toEqual([])
  })
})

describe('getTopologicalOrder', () => {
  it('places datasets first', () => {
    const nodes: Record<string, PipelineNode> = {
      v1: createView('v1', ['d1']),
      d1: createDataset('d1'),
    }
    const edges = [createEdge('d1', 'v1')]
    const result = getTopologicalOrder(nodes, edges)

    expect(result.indexOf('d1')).toBeLessThan(result.indexOf('v1'))
  })

  it('orders views by dependencies', () => {
    // d1 -> v1 -> v2 -> v3
    const nodes: Record<string, PipelineNode> = {
      d1: createDataset('d1'),
      v1: createView('v1', ['d1']),
      v2: createView('v2', ['v1']),
      v3: createView('v3', ['v2']),
    }
    const edges = [createEdge('d1', 'v1'), createEdge('v1', 'v2'), createEdge('v2', 'v3')]
    const result = getTopologicalOrder(nodes, edges)

    expect(result).toEqual(['d1', 'v1', 'v2', 'v3'])
  })

  it('handles diamond dependencies correctly', () => {
    // d1 -> v1 -> v3
    // d1 -> v2 -> v3
    const nodes: Record<string, PipelineNode> = {
      d1: createDataset('d1'),
      v1: createView('v1', ['d1']),
      v2: createView('v2', ['d1']),
      v3: createView('v3', ['v1', 'v2']),
    }
    const edges = [createEdge('d1', 'v1'), createEdge('d1', 'v2'), createEdge('v1', 'v3'), createEdge('v2', 'v3')]
    const result = getTopologicalOrder(nodes, edges)

    // d1 must come first
    expect(result[0]).toBe('d1')
    // v1 and v2 must come before v3
    expect(result.indexOf('v1')).toBeLessThan(result.indexOf('v3'))
    expect(result.indexOf('v2')).toBeLessThan(result.indexOf('v3'))
    // All nodes should be included
    expect(result).toHaveLength(4)
  })

  it('handles multiple independent trees', () => {
    // Tree 1: d1 -> v1
    // Tree 2: d2 -> v2
    const nodes: Record<string, PipelineNode> = {
      d1: createDataset('d1'),
      d2: createDataset('d2'),
      v1: createView('v1', ['d1']),
      v2: createView('v2', ['d2']),
    }
    const edges = [createEdge('d1', 'v1'), createEdge('d2', 'v2')]
    const result = getTopologicalOrder(nodes, edges)

    // Datasets should come first
    expect(result.slice(0, 2).sort()).toEqual(['d1', 'd2'])
    // All nodes should be included
    expect(result).toHaveLength(4)
  })

  it('includes all nodes in output', () => {
    const nodes: Record<string, PipelineNode> = {
      d1: createDataset('d1'),
      d2: createDataset('d2'),
      v1: createView('v1', ['d1']),
    }
    const edges = [createEdge('d1', 'v1')]
    const result = getTopologicalOrder(nodes, edges)

    expect(result).toContain('d1')
    expect(result).toContain('d2')
    expect(result).toContain('v1')
  })

  it('handles empty graph', () => {
    const result = getTopologicalOrder({}, [])

    expect(result).toEqual([])
  })

  it('handles single dataset', () => {
    const nodes: Record<string, PipelineNode> = {
      d1: createDataset('d1'),
    }
    const result = getTopologicalOrder(nodes, [])

    expect(result).toEqual(['d1'])
  })

  it('handles complex multi-level DAG', () => {
    // d1 -> v1 -> v3 -> v5
    // d2 -> v2 -> v4 -> v5
    const nodes: Record<string, PipelineNode> = {
      d1: createDataset('d1'),
      d2: createDataset('d2'),
      v1: createView('v1', ['d1']),
      v2: createView('v2', ['d2']),
      v3: createView('v3', ['v1']),
      v4: createView('v4', ['v2']),
      v5: createView('v5', ['v3', 'v4']),
    }
    const edges = [
      createEdge('d1', 'v1'),
      createEdge('d2', 'v2'),
      createEdge('v1', 'v3'),
      createEdge('v2', 'v4'),
      createEdge('v3', 'v5'),
      createEdge('v4', 'v5'),
    ]
    const result = getTopologicalOrder(nodes, edges)

    // Verify dependencies are respected
    expect(result.indexOf('d1')).toBeLessThan(result.indexOf('v1'))
    expect(result.indexOf('d2')).toBeLessThan(result.indexOf('v2'))
    expect(result.indexOf('v1')).toBeLessThan(result.indexOf('v3'))
    expect(result.indexOf('v2')).toBeLessThan(result.indexOf('v4'))
    expect(result.indexOf('v3')).toBeLessThan(result.indexOf('v5'))
    expect(result.indexOf('v4')).toBeLessThan(result.indexOf('v5'))
    expect(result).toHaveLength(7)
  })
})
