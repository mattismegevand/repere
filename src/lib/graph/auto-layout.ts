import Dagre from '@dagrejs/dagre'
import type { Edge, Node } from '@xyflow/react'

interface LayoutOptions {
  direction?: 'LR' | 'TB'
  nodeWidth?: number
  nodeHeight?: number
  rankSep?: number
  nodeSep?: number
}

export function getLayoutedPositions(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): Map<string, { x: number; y: number }> {
  const { direction = 'LR', nodeWidth = 280, nodeHeight = 150, rankSep = 80, nodeSep = 40 } = options

  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: direction, ranksep: rankSep, nodesep: nodeSep })

  for (const node of nodes) {
    let defaultW = nodeWidth
    let defaultH = nodeHeight
    if (node.type === 'chart') {
      defaultW = 340
      defaultH = 300
    } else if (node.type === 'export') {
      defaultW = 300
      defaultH = 200
    }

    const width = node.measured?.width ?? defaultW
    const height = node.measured?.height ?? defaultH
    g.setNode(node.id, { width, height })
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target)
  }

  Dagre.layout(g)

  const positions = new Map<string, { x: number; y: number }>()
  for (const node of nodes) {
    const layoutNode = g.node(node.id)
    const width = node.measured?.width ?? nodeWidth
    const height = node.measured?.height ?? nodeHeight
    positions.set(node.id, {
      x: layoutNode.x - width / 2,
      y: layoutNode.y - height / 2,
    })
  }

  return positions
}
