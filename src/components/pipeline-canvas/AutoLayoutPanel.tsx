import { Panel, useReactFlow } from '@xyflow/react'
import LayoutGrid from 'lucide-react/dist/esm/icons/layout-grid'
import { useCallback } from 'react'

import { getLayoutedPositions } from '@/lib/graph/auto-layout'
import { usePipelineStore } from '@/stores/pipelineStore'

export function AutoLayoutPanel() {
  const { getNodes, getEdges, setNodes, fitView } = useReactFlow()
  const updateNodePosition = usePipelineStore((s) => s.updateNodePosition)

  const onLayout = useCallback(() => {
    const nodes = getNodes()
    const edges = getEdges()

    if (nodes.length === 0) return

    const positions = getLayoutedPositions(nodes, edges)

    // Update React Flow nodes directly for immediate visual feedback
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        const newPosition = positions.get(node.id)
        if (newPosition) {
          return { ...node, position: newPosition }
        }
        return node
      })
    )

    // Sync positions to pipeline store for persistence
    for (const [nodeId, position] of positions) {
      updateNodePosition(nodeId, position)
    }

    // Fit view after layout
    setTimeout(() => {
      fitView({ padding: 0.2, duration: 200 })
    }, 50)
  }, [getNodes, getEdges, setNodes, updateNodePosition, fitView])

  return (
    <Panel position="top-right">
      <button
        type="button"
        onClick={onLayout}
        className="flex items-center gap-1.5 rounded-md bg-[var(--color-bg-primary)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-primary)] shadow-sm ring-1 ring-[var(--color-border)] transition-colors hover:bg-[var(--color-bg-secondary)]"
        title="Auto-layout (Shift+L)"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Layout
      </button>
    </Panel>
  )
}
