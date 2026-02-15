import { getParents } from '@/lib/graph'
import type { PipelineEdge, PipelineNode } from '@/types'
import type { NodeLayout } from '@/types/pipelineLayout'
import type { NodeRuntime } from '@/types/pipelineRuntime'

export type HydratedNode = PipelineNode &
  Partial<NodeRuntime> &
  Partial<NodeLayout> & {
    parentIds: string[]
    parentId?: string
  }

export function hydrateNode(
  node: PipelineNode,
  edges: PipelineEdge[],
  runtimeById: Record<string, NodeRuntime>,
  layoutById: Record<string, NodeLayout>
): HydratedNode {
  const runtime = runtimeById[node.id] ?? {}
  const layout = layoutById[node.id] ?? {}
  const parentIds = getParents(node.id, edges)
  const parentId = parentIds[0]

  return {
    ...node,
    ...runtime,
    ...layout,
    parentIds,
    parentId,
  }
}

export function hydrateNodes(
  nodes: Record<string, PipelineNode>,
  edges: PipelineEdge[],
  runtimeById: Record<string, NodeRuntime>,
  layoutById: Record<string, NodeLayout>
): Record<string, HydratedNode> {
  const result: Record<string, HydratedNode> = {}
  for (const node of Object.values(nodes)) {
    result[node.id] = hydrateNode(node, edges, runtimeById, layoutById)
  }
  return result
}
