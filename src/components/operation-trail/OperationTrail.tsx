import { ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { usePipeline } from '@/lib/pipeline/usePipeline'
import { usePipelineStore } from '@/stores'
import type { Dataset, DataView } from '@/types'
import { OperationChip } from './OperationChip'

export function OperationTrail() {
  const { activeNode, activeNodePath, getNode } = usePipeline()
  const { setActiveNode, openTab } = usePipelineStore()

  // Build the path of nodes from root to active
  const pathNodes = useMemo(() => {
    return activeNodePath
      .map((nodeId) => getNode(nodeId))
      .filter((node): node is Dataset | DataView => {
        if (!node) return false
        // Filter out incomplete view nodes (missing operation)
        if (node.type === 'view' && !(node as DataView).operation) return false
        return true
      })
  }, [activeNodePath, getNode])

  // Don't render if no active node or only the root dataset
  if (!activeNode || pathNodes.length <= 1) {
    return null
  }

  const handleChipClick = (nodeId: string) => {
    setActiveNode(nodeId)
    openTab(nodeId)
  }

  return (
    <div className="flex items-center gap-1 px-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] overflow-x-auto h-[28px]">
      {pathNodes.map((node, index) => (
        <div key={node.id} className="flex items-center shrink-0">
          {index > 0 && <ChevronRight className="w-3 h-3 text-[var(--color-text-muted)] mx-0.5" />}
          <OperationChip node={node} isActive={node.id === activeNode.id} onClick={() => handleChipClick(node.id)} />
        </div>
      ))}
    </div>
  )
}
