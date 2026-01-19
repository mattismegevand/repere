import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, ChevronRight, Database, GitBranch } from 'lucide-react'
import { useMemo, useState } from 'react'
import { usePipelineStore } from '@/stores'
import type { Dataset, DataView } from '@/types'

export function DatasetDropdown() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const nodes = usePipelineStore((s) => s.nodes)
  const edges = usePipelineStore((s) => s.edges)
  const setActiveNode = usePipelineStore((s) => s.setActiveNode)
  const openTab = usePipelineStore((s) => s.openTab)

  const datasets = useMemo(() => Object.values(nodes).filter((n): n is Dataset => n.type === 'dataset'), [nodes])

  // Get direct children of a node
  const getChildren = (nodeId: string): DataView[] => {
    const childIds = edges.filter((e) => e.sourceId === nodeId).map((e) => e.targetId)
    return childIds.map((id) => nodes[id]).filter((n): n is DataView => n?.type === 'view')
  }

  const handleSelect = (nodeId: string) => {
    openTab(nodeId)
    setActiveNode(nodeId)
  }

  const toggleExpand = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }

  const renderNode = (node: Dataset | DataView, depth: number = 0) => {
    const children = getChildren(node.id)
    const isDataset = node.type === 'dataset'
    const hasChildren = children.length > 0
    const isExpanded = expanded.has(node.id)

    return (
      <div key={node.id}>
        <DropdownMenu.Item
          onSelect={() => handleSelect(node.id)}
          className="w-full flex items-center gap-1.5 px-2 py-1 text-[11px] text-left outline-none hover:bg-[var(--color-bg-secondary)] focus:bg-[var(--color-bg-secondary)] cursor-default"
          style={{ paddingLeft: `${8 + depth * 12}px` }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => toggleExpand(node.id, e)}
              className="shrink-0 hover:text-[var(--color-accent)]"
            >
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
          ) : (
            <span className="w-3 shrink-0" />
          )}
          {isDataset ? (
            <Database className="w-3 h-3 shrink-0 text-[var(--color-accent)]" />
          ) : (
            <GitBranch className="w-3 h-3 shrink-0 text-[var(--color-text-muted)]" />
          )}
          <span className="truncate flex-1">{node.name}</span>
          <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">
            {node.rowCount !== null ? node.rowCount.toLocaleString() : '...'}
          </span>
        </DropdownMenu.Item>
        {isExpanded && children.map((child) => renderNode(child, depth + 1))}
      </div>
    )
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="flex items-center gap-1 px-1.5 h-full transition-colors cursor-pointer hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] data-[state=open]:text-[var(--color-accent)] data-[state=open]:bg-[var(--color-accent-bg)]"
          title={`${datasets.length} dataset${datasets.length !== 1 ? 's' : ''}`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>{datasets.length}</span>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="top"
          sideOffset={4}
          align="start"
          className="popover-content py-1 min-w-48 max-w-72 max-h-80 overflow-y-auto"
        >
          {datasets.length === 0 ? (
            <div className="px-3 py-2 text-[11px] text-[var(--color-text-muted)]">No datasets loaded</div>
          ) : (
            datasets.map((dataset) => renderNode(dataset))
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
