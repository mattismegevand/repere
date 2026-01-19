import { Command } from 'cmdk'
import { usePipeline } from '@/lib/pipeline/usePipeline'
import { useCommandPalette } from '../CommandPaletteContext'
import { PageHeader } from '../components/PageHeader'

const TYPE_BADGES: Record<string, { bg: string; text: string }> = {
  string: { bg: 'bg-green-500/10', text: 'text-green-600' },
  number: { bg: 'bg-blue-500/10', text: 'text-blue-600' },
  boolean: { bg: 'bg-yellow-500/10', text: 'text-yellow-600' },
  date: { bg: 'bg-purple-500/10', text: 'text-purple-600' },
  timestamp: { bg: 'bg-purple-500/10', text: 'text-purple-600' },
  time: { bg: 'bg-purple-500/10', text: 'text-purple-600' },
  unknown: { bg: 'bg-gray-500/10', text: 'text-gray-600' },
}

export function FilterPage() {
  const { activeNode } = usePipeline()
  const { pushPage, searchValue } = useCommandPalette()

  const columns = activeNode?.columns ?? []
  const filteredColumns = columns.filter((c) => c.name.toLowerCase().includes(searchValue.toLowerCase()))

  return (
    <>
      <PageHeader title="Filter by column" />
      <Command.List className="max-h-80 overflow-y-auto p-2">
        <Command.Empty className="py-6 text-center text-sm text-[var(--color-text-muted)]">
          No columns found
        </Command.Empty>
        {filteredColumns.map((column) => {
          const badge = TYPE_BADGES[column.type] ?? TYPE_BADGES.unknown
          return (
            <Command.Item
              key={column.name}
              value={column.name}
              onSelect={() => pushPage({ type: 'filter', column: column.name })}
              className="px-2 py-2 cursor-pointer text-sm rounded-md hover:bg-[var(--color-bg-secondary)] data-[selected=true]:bg-[var(--color-accent-bg)] flex justify-between items-center"
            >
              <span className="font-mono">{column.name}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${badge.bg} ${badge.text}`}>{column.type}</span>
            </Command.Item>
          )
        })}
      </Command.List>
    </>
  )
}
