import { useMemo } from 'react'
import { type HydratedNode, hydrateNode, hydrateNodes } from '@/lib/pipeline/hydration'
import { usePipelineLayoutStore } from '@/stores/pipelineLayoutStore'
import { usePipelineRuntimeStore } from '@/stores/pipelineRuntimeStore'
import { usePipelineStore } from '@/stores/pipelineStore'

export function useHydratedNodes(): Record<string, HydratedNode> {
  const nodes = usePipelineStore((s) => s.nodes)
  const edges = usePipelineStore((s) => s.edges)
  const runtime = usePipelineRuntimeStore((s) => s.nodes)
  const layout = usePipelineLayoutStore((s) => s.nodes)

  return useMemo(() => hydrateNodes(nodes, edges, runtime, layout), [nodes, edges, runtime, layout])
}

export function useHydratedNode(nodeId: string | null | undefined): HydratedNode | null {
  const node = usePipelineStore((s) => (nodeId ? s.nodes[nodeId] : undefined))
  const edges = usePipelineStore((s) => s.edges)
  const runtime = usePipelineRuntimeStore((s) => (nodeId ? s.nodes[nodeId] : undefined))
  const layout = usePipelineLayoutStore((s) => (nodeId ? s.nodes[nodeId] : undefined))

  return useMemo(() => {
    if (!node || !nodeId) return null
    return hydrateNode(node, edges, runtime ? { [nodeId]: runtime } : {}, layout ? { [nodeId]: layout } : {})
  }, [node, nodeId, edges, runtime, layout])
}
