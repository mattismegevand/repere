import type { Edge, Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { getLayoutedPositions } from '@/lib/graph/auto-layout'

// Helper to create a node
function createNode(id: string, type = 'view', measured?: { width: number; height: number }): Node {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: {},
    measured,
  }
}

// Helper to create an edge
function createEdge(source: string, target: string): Edge {
  return {
    id: `${source}-${target}`,
    source,
    target,
  }
}

describe('getLayoutedPositions', () => {
  describe('basic functionality', () => {
    it('returns positions for all nodes', () => {
      const nodes = [createNode('a'), createNode('b')]
      const edges = [createEdge('a', 'b')]

      const positions = getLayoutedPositions(nodes, edges)

      expect(positions.size).toBe(2)
      expect(positions.has('a')).toBe(true)
      expect(positions.has('b')).toBe(true)
    })

    it('returns x and y coordinates for each node', () => {
      const nodes = [createNode('a')]
      const edges: Edge[] = []

      const positions = getLayoutedPositions(nodes, edges)
      const pos = positions.get('a')

      expect(pos).toBeDefined()
      expect(typeof pos?.x).toBe('number')
      expect(typeof pos?.y).toBe('number')
    })

    it('handles empty graph', () => {
      const positions = getLayoutedPositions([], [])
      expect(positions.size).toBe(0)
    })

    it('handles single node', () => {
      const nodes = [createNode('a')]
      const positions = getLayoutedPositions(nodes, [])

      expect(positions.size).toBe(1)
      expect(positions.has('a')).toBe(true)
    })
  })

  describe('layout direction', () => {
    it('positions parent left of child in LR direction', () => {
      const nodes = [createNode('parent'), createNode('child')]
      const edges = [createEdge('parent', 'child')]

      const positions = getLayoutedPositions(nodes, edges, { direction: 'LR' })

      const parentPos = positions.get('parent')!
      const childPos = positions.get('child')!

      expect(parentPos.x).toBeLessThan(childPos.x)
    })

    it('positions parent above child in TB direction', () => {
      const nodes = [createNode('parent'), createNode('child')]
      const edges = [createEdge('parent', 'child')]

      const positions = getLayoutedPositions(nodes, edges, { direction: 'TB' })

      const parentPos = positions.get('parent')!
      const childPos = positions.get('child')!

      expect(parentPos.y).toBeLessThan(childPos.y)
    })
  })

  describe('node type dimensions', () => {
    it('uses larger dimensions for chart nodes', () => {
      const nodes = [createNode('chart1', 'chart'), createNode('view1', 'view')]
      const edges = [createEdge('view1', 'chart1')]

      // This should not throw - just verify it handles different node types
      const positions = getLayoutedPositions(nodes, edges)
      expect(positions.size).toBe(2)
    })

    it('uses larger dimensions for export nodes', () => {
      const nodes = [createNode('export1', 'export'), createNode('view1', 'view')]
      const edges = [createEdge('view1', 'export1')]

      const positions = getLayoutedPositions(nodes, edges)
      expect(positions.size).toBe(2)
    })

    it('uses measured dimensions when available', () => {
      const nodes = [createNode('a', 'view', { width: 500, height: 300 })]
      const edges: Edge[] = []

      // This should use the measured dimensions instead of defaults
      const positions = getLayoutedPositions(nodes, edges)
      expect(positions.size).toBe(1)
    })
  })

  describe('complex graphs', () => {
    it('handles linear chain', () => {
      const nodes = [createNode('a'), createNode('b'), createNode('c'), createNode('d')]
      const edges = [createEdge('a', 'b'), createEdge('b', 'c'), createEdge('c', 'd')]

      const positions = getLayoutedPositions(nodes, edges, { direction: 'LR' })

      const posA = positions.get('a')!
      const posB = positions.get('b')!
      const posC = positions.get('c')!
      const posD = positions.get('d')!

      // In LR direction, x should increase along the chain
      expect(posA.x).toBeLessThan(posB.x)
      expect(posB.x).toBeLessThan(posC.x)
      expect(posC.x).toBeLessThan(posD.x)
    })

    it('handles diamond pattern', () => {
      // a -> b, a -> c, b -> d, c -> d
      const nodes = [createNode('a'), createNode('b'), createNode('c'), createNode('d')]
      const edges = [createEdge('a', 'b'), createEdge('a', 'c'), createEdge('b', 'd'), createEdge('c', 'd')]

      const positions = getLayoutedPositions(nodes, edges, { direction: 'LR' })

      const posA = positions.get('a')!
      const posB = positions.get('b')!
      const posC = positions.get('c')!
      const posD = positions.get('d')!

      // a should be leftmost, d should be rightmost
      expect(posA.x).toBeLessThan(posB.x)
      expect(posA.x).toBeLessThan(posC.x)
      expect(posB.x).toBeLessThan(posD.x)
      expect(posC.x).toBeLessThan(posD.x)
    })

    it('handles multiple independent trees', () => {
      const nodes = [createNode('a1'), createNode('a2'), createNode('b1'), createNode('b2')]
      const edges = [createEdge('a1', 'a2'), createEdge('b1', 'b2')]

      const positions = getLayoutedPositions(nodes, edges)

      // All nodes should have positions
      expect(positions.size).toBe(4)
    })

    it('handles fan-out pattern', () => {
      // a -> b, a -> c, a -> d
      const nodes = [createNode('a'), createNode('b'), createNode('c'), createNode('d')]
      const edges = [createEdge('a', 'b'), createEdge('a', 'c'), createEdge('a', 'd')]

      const positions = getLayoutedPositions(nodes, edges, { direction: 'LR' })

      const posA = positions.get('a')!
      const posB = positions.get('b')!
      const posC = positions.get('c')!
      const posD = positions.get('d')!

      // a should be left of all children
      expect(posA.x).toBeLessThan(posB.x)
      expect(posA.x).toBeLessThan(posC.x)
      expect(posA.x).toBeLessThan(posD.x)

      // Children should be at similar x positions
      const childXPositions = [posB.x, posC.x, posD.x]
      const avgX = childXPositions.reduce((a, b) => a + b, 0) / 3
      for (const x of childXPositions) {
        expect(Math.abs(x - avgX)).toBeLessThan(50) // Allow some variance
      }
    })
  })

  describe('layout options', () => {
    it('respects custom nodeWidth and nodeHeight', () => {
      const nodes = [createNode('a'), createNode('b')]
      const edges = [createEdge('a', 'b')]

      // Using different node dimensions should still produce valid positions
      const positions = getLayoutedPositions(nodes, edges, {
        nodeWidth: 400,
        nodeHeight: 200,
      })

      expect(positions.size).toBe(2)
    })

    it('respects custom rankSep', () => {
      const nodes = [createNode('a'), createNode('b')]
      const edges = [createEdge('a', 'b')]

      const smallSep = getLayoutedPositions(nodes, edges, { direction: 'LR', rankSep: 50 })
      const largeSep = getLayoutedPositions(nodes, edges, { direction: 'LR', rankSep: 200 })

      const smallDist = Math.abs(smallSep.get('b')!.x - smallSep.get('a')!.x)
      const largeDist = Math.abs(largeSep.get('b')!.x - largeSep.get('a')!.x)

      // Larger rankSep should produce larger distance between nodes
      expect(largeDist).toBeGreaterThan(smallDist)
    })

    it('respects custom nodeSep', () => {
      // Fan-out to test vertical separation
      const nodes = [createNode('a'), createNode('b'), createNode('c')]
      const edges = [createEdge('a', 'b'), createEdge('a', 'c')]

      const smallSep = getLayoutedPositions(nodes, edges, { direction: 'LR', nodeSep: 20 })
      const largeSep = getLayoutedPositions(nodes, edges, { direction: 'LR', nodeSep: 100 })

      const smallVertDist = Math.abs(smallSep.get('b')!.y - smallSep.get('c')!.y)
      const largeVertDist = Math.abs(largeSep.get('b')!.y - largeSep.get('c')!.y)

      // Larger nodeSep should produce larger vertical distance between siblings
      expect(largeVertDist).toBeGreaterThan(smallVertDist)
    })
  })
})
