import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Filter, Hash, ListOrdered, Scissors, SquareCode, Table2, Trash2 } from 'lucide-react'
import { useCallback } from 'react'
import { usePipeline } from '@/lib/pipeline'
import type { EdgeContextMenuState } from '@/stores'
import { usePanelStore, usePipelineStore } from '@/stores'

interface EdgeContextMenuProps {
  menu: EdgeContextMenuState
  onClose: () => void
}

const INSERT_OPTIONS = [
  { type: 'filter', label: 'Filter', icon: Filter, description: 'Filter rows by condition' },
  { type: 'sort', label: 'Sort', icon: ListOrdered, description: 'Sort by columns' },
  { type: 'limit', label: 'Limit', icon: Hash, description: 'Limit number of rows' },
  { type: 'select', label: 'Select', icon: Table2, description: 'Select specific columns' },
  { type: 'distinct', label: 'Distinct', icon: Scissors, description: 'Remove duplicate rows' },
  { type: 'sql', label: 'Custom SQL', icon: SquareCode, description: 'Write custom SQL query' },
] as const

const itemClass = 'menu-item w-full text-left'

export function EdgeContextMenu({ menu, onClose }: EdgeContextMenuProps) {
  const { nodes } = usePipelineStore()
  const { insertNodeBetween, deleteEdge } = usePipeline()
  const { openSqlPanelForNode, setFilterEditor } = usePanelStore()

  const sourceNode = nodes[menu.sourceId]
  const targetNode = nodes[menu.targetId]

  const handleInsert = useCallback(
    async (operationType: string) => {
      const newNodeId = await insertNodeBetween(menu.sourceId, menu.targetId, operationType)
      onClose()

      // Open relevant editor for the new node
      if (newNodeId) {
        if (operationType === 'sql') {
          openSqlPanelForNode(newNodeId)
        } else if (operationType === 'filter') {
          // Select the new node and open filter editor
          usePipelineStore.getState().selectNode(newNodeId)
          setFilterEditor(true)
        }
      }
    },
    [menu.sourceId, menu.targetId, insertNodeBetween, onClose, openSqlPanelForNode, setFilterEditor]
  )

  const handleDeleteEdge = useCallback(() => {
    deleteEdge(menu.edgeId)
    onClose()
  }, [menu.edgeId, deleteEdge, onClose])

  return (
    <DropdownMenu.Root open onOpenChange={(open) => !open && onClose()}>
      <DropdownMenu.Trigger asChild>
        <div
          style={{
            position: 'fixed',
            left: menu.x,
            top: menu.y,
            width: 0,
            height: 0,
          }}
        />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" sideOffset={0} className="popover-content py-1 min-w-48">
          {/* Header showing connection info */}
          <DropdownMenu.Label className="px-3 py-1.5 border-b border-[var(--color-border)]">
            <div className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-1">
              Insert between
            </div>
            <div className="text-xs text-[var(--color-text-secondary)] truncate">
              {sourceNode?.name ?? 'Source'} → {targetNode?.name ?? 'Target'}
            </div>
          </DropdownMenu.Label>

          {/* Insert options */}
          <DropdownMenu.Group className="py-1">
            {INSERT_OPTIONS.map(({ type, label, icon: Icon, description }) => (
              <DropdownMenu.Item
                key={type}
                onSelect={() => handleInsert(type)}
                className={itemClass}
                title={description}
              >
                <Icon className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                <span>{label}</span>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Group>

          <DropdownMenu.Separator className="h-px bg-[var(--color-border)] my-1" />

          {/* Delete edge option */}
          <DropdownMenu.Item
            onSelect={handleDeleteEdge}
            className="w-full px-3 py-1.5 text-xs text-left outline-none hover:bg-red-500/10 focus:bg-red-500/10 text-red-500 flex items-center gap-2 cursor-default"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete connection</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
