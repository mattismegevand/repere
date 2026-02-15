import type { PipelineEdge, PipelineNode } from '@/types'

// Adjacency map types for O(1) lookups
export type AdjacencyMap = Map<string, Set<string>>

/**
 * Get all direct children of a node (immediate descendants).
 * Uses adjacency map if provided for O(1) lookup, otherwise O(E) filter.
 */
export function getChildren(nodeId: string, edges: PipelineEdge[], outgoing?: AdjacencyMap): string[] {
  if (outgoing) {
    return [...(outgoing.get(nodeId) ?? [])]
  }
  return edges.filter((edge) => edge.sourceId === nodeId).map((edge) => edge.targetId)
}

/**
 * Get all direct parents of a node.
 * Uses adjacency map if provided for O(1) lookup, otherwise O(E) filter.
 */
export function getParents(nodeId: string, edges: PipelineEdge[], incoming?: AdjacencyMap): string[] {
  if (incoming) {
    return [...(incoming.get(nodeId) ?? [])]
  }
  return edges.filter((edge) => edge.targetId === nodeId).map((edge) => edge.sourceId)
}

/**
 * Get all descendants (recursive children) of a node.
 * Returns in breadth-first order (children before grandchildren).
 * Uses adjacency map if provided for O(1) child lookups.
 */
export function getDescendants(nodeId: string, edges: PipelineEdge[], outgoing?: AdjacencyMap): string[] {
  const descendants: string[] = []
  const visited = new Set<string>()

  function traverse(id: string) {
    const children = getChildren(id, edges, outgoing)
    for (const childId of children) {
      if (!visited.has(childId)) {
        visited.add(childId)
        descendants.push(childId)
        traverse(childId)
      }
    }
  }

  traverse(nodeId)
  return descendants
}

/**
 * Get all root nodes (nodes with no parents).
 * Uses incoming adjacency map if provided.
 */
export function getRootNodes(
  nodes: Record<string, PipelineNode>,
  edges: PipelineEdge[],
  incoming?: AdjacencyMap
): PipelineNode[] {
  if (incoming) {
    return Object.values(nodes).filter((node) => !incoming.has(node.id) || incoming.get(node.id)!.size === 0)
  }
  const nodesWithParents = new Set(edges.map((e) => e.targetId))
  return Object.values(nodes).filter((node) => !nodesWithParents.has(node.id))
}

/**
 * Sort nodes in topological order for recreation.
 * Datasets come first, then views in dependency order.
 * Parent views must be created before their children.
 * Uses adjacency map if provided for O(1) child lookups.
 */
export function getTopologicalOrder(
  nodes: Record<string, PipelineNode>,
  edges: PipelineEdge[],
  outgoing?: AdjacencyMap,
  incoming?: AdjacencyMap
): string[] {
  const order: string[] = []
  const visited = new Set<string>()

  // Get datasets first (no dependencies)
  for (const node of Object.values(nodes)) {
    if (node.type === 'dataset') {
      order.push(node.id)
      visited.add(node.id)
    }
  }

  // Start with views whose parents are all datasets
  const queue: string[] = []
  for (const node of Object.values(nodes)) {
    if (node.type === 'view') {
      const parentIds = getParents(node.id, edges, incoming)
      const parentCount = parentIds.filter((pid) => nodes[pid]?.type === 'view').length
      if (parentCount === 0) {
        queue.push(node.id)
      }
    }
  }

  // Process views in dependency order
  while (queue.length > 0) {
    const nodeId = queue.shift()!
    if (visited.has(nodeId)) continue

    visited.add(nodeId)
    order.push(nodeId)

    // Add children whose all parents are now visited - use adjacency map if available
    const children = getChildren(nodeId, edges, outgoing)
    for (const childId of children) {
      if (visited.has(childId)) continue
      const targetNode = nodes[childId]
      if (targetNode?.type === 'view') {
        const parentIds = getParents(childId, edges, incoming)
        const allParentsVisited = parentIds.every((pid) => visited.has(pid))
        if (allParentsVisited) {
          queue.push(childId)
        }
      }
    }
  }

  return order
}
