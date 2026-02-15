import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle'
import Database from 'lucide-react/dist/esm/icons/database'
import FilterX from 'lucide-react/dist/esm/icons/filter-x'
import SearchX from 'lucide-react/dist/esm/icons/search-x'

type EmptyStateType = 'no-data' | 'filtered-empty' | 'search-empty' | 'error'

interface GridEmptyStateProps {
  type: EmptyStateType
  error?: string
  onClearFilters?: () => void
  onClearSearch?: () => void
}

const stateConfig: Record<
  EmptyStateType,
  { icon: typeof Database; title: string; description: string; actionLabel?: string }
> = {
  'no-data': {
    icon: Database,
    title: 'No data',
    description: 'This dataset contains no rows.',
  },
  'filtered-empty': {
    icon: FilterX,
    title: 'No matching rows',
    description: 'Current filters returned no results.',
    actionLabel: 'Clear filters',
  },
  'search-empty': {
    icon: SearchX,
    title: 'No search matches',
    description: 'No rows match your search query.',
    actionLabel: 'Clear search',
  },
  error: {
    icon: AlertCircle,
    title: 'Error loading data',
    description: 'An error occurred while loading the data.',
  },
}

export function GridEmptyState({ type, error, onClearFilters, onClearSearch }: GridEmptyStateProps) {
  const config = stateConfig[type]
  const Icon = config.icon

  const handleAction = () => {
    if (type === 'filtered-empty' && onClearFilters) {
      onClearFilters()
    } else if (type === 'search-empty' && onClearSearch) {
      onClearSearch()
    }
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon
        className={`w-10 h-10 mb-3 ${type === 'error' ? 'text-[var(--color-error)]' : 'text-[var(--color-text-muted)]'}`}
      />
      <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">{config.title}</h3>
      <p className="text-xs text-[var(--color-text-muted)] max-w-[240px]">
        {type === 'error' && error ? error : config.description}
      </p>
      {config.actionLabel && (
        <button
          onClick={handleAction}
          className="mt-3 px-3 py-1 text-xs text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 rounded-md transition-colors"
        >
          {config.actionLabel}
        </button>
      )}
    </div>
  )
}
