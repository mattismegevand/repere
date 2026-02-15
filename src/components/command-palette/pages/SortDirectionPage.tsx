import { Command } from 'cmdk'
import ArrowDownAZ from 'lucide-react/dist/esm/icons/arrow-down-az'
import ArrowUpAZ from 'lucide-react/dist/esm/icons/arrow-up-az'
import { usePipeline } from '@/lib/pipeline/usePipeline'
import type { SortOperation } from '@/types'
import { useCommandPalette } from '../CommandPaletteContext'
import { PageHeader } from '../components/PageHeader'

const DIRECTIONS = [
  { key: 'asc' as const, label: 'Ascending', description: 'A → Z, 1 → 9, oldest → newest', icon: ArrowUpAZ },
  { key: 'desc' as const, label: 'Descending', description: 'Z → A, 9 → 1, newest → oldest', icon: ArrowDownAZ },
]

export function SortDirectionPage() {
  const { page, close } = useCommandPalette()
  const { applyOrReplaceOperation } = usePipeline()

  // Extract page data (may be undefined if not on sort page)
  const isValidPage = page.type === 'sort' && !!page.column
  const pageColumn = page.type === 'sort' ? page.column : undefined

  // Early return for invalid page state (after hooks)
  if (!isValidPage) {
    return null
  }

  const handleSelect = async (direction: 'asc' | 'desc') => {
    const sortOp: SortOperation = {
      type: 'sort',
      sorts: [{ column: pageColumn!, direction }],
    }
    await applyOrReplaceOperation(sortOp)
    close()
  }

  return (
    <>
      <PageHeader title={pageColumn!} breadcrumbs={['Sort']} />
      <Command.List className="max-h-80 overflow-y-auto p-2">
        {DIRECTIONS.map(({ key, label, description, icon: Icon }) => (
          <Command.Item
            key={key}
            value={`${label} ${description}`}
            onSelect={() => handleSelect(key)}
            className="px-2 py-2 cursor-pointer text-sm rounded-md hover:bg-[var(--color-bg-secondary)] data-[selected=true]:bg-[var(--color-accent-bg)] flex items-center gap-3"
          >
            <Icon className="w-4 h-4 text-[var(--color-text-muted)]" />
            <div>
              <div>{label}</div>
              <div className="text-xs text-[var(--color-text-muted)]">{description}</div>
            </div>
          </Command.Item>
        ))}
      </Command.List>
    </>
  )
}
