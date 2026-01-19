import { useInView } from '@/hooks'
import { formatShortcut } from '@/lib/platform'

const OPERATIONS = [
  {
    category: 'Query',
    ops: [
      { name: 'Filter', example: "status = 'active'" },
      { name: 'Sort', example: 'ORDER BY date DESC' },
      { name: 'Limit', example: 'LIMIT 1000' },
    ],
  },
  {
    category: 'Column',
    ops: [
      { name: 'Select', example: 'Choose columns' },
      { name: 'Add', example: 'price * quantity' },
      { name: 'Remove', example: 'Drop columns' },
      { name: 'Rename', example: 'New names' },
      { name: 'Cast', example: 'VARCHAR → INT' },
    ],
  },
  {
    category: 'Transform',
    ops: [
      { name: 'Fill Null', example: 'COALESCE(val, 0)' },
      { name: 'Replace', example: "REPLACE(col, 'a', 'b')" },
      { name: 'Edit Cell', example: 'Direct edit' },
    ],
  },
  {
    category: 'Combine',
    ops: [
      { name: 'Join', example: '5 types: inner, left...' },
      { name: 'Union', example: 'Stack datasets' },
      { name: 'Distinct', example: 'Remove duplicates' },
    ],
  },
  {
    category: 'Aggregate',
    ops: [
      { name: 'Pivot', example: 'Rows → columns' },
      { name: 'Unpivot', example: 'Columns → rows' },
      { name: 'Group By', example: 'SUM, AVG, COUNT...' },
    ],
  },
  {
    category: 'Window',
    ops: [
      { name: 'ROW_NUMBER', example: 'Sequential ranking' },
      { name: 'RANK', example: 'Rank with gaps' },
      { name: 'LAG/LEAD', example: 'Prev/next values' },
      { name: 'Running', example: 'SUM, AVG, COUNT...' },
    ],
  },
  {
    category: 'Advanced',
    ops: [
      { name: 'Custom SQL', example: 'Full DuckDB SQL' },
      { name: 'Python', example: 'pandas, numpy, matplotlib' },
      { name: 'Charts', example: 'Bar, line, scatter, pie...' },
    ],
  },
]

const SHORTCUTS = [
  { keys: '⌘K', action: 'Command palette' },
  { keys: '⌘O', action: 'Open file' },
  { keys: '⌘Z', action: 'Undo' },
  { keys: '⌘⇧Z', action: 'Redo' },
  { keys: 'Tab', action: 'Toggle canvas' },
  { keys: '⌘/', action: 'All shortcuts' },
]

export function OperationsGrid() {
  const { ref, isInView } = useInView<HTMLElement>({ threshold: 0.1 })

  return (
    <section
      ref={ref}
      className="py-16 transition-all duration-700 ease-out"
      style={{
        opacity: isInView ? 1 : 0,
        transform: isInView ? 'translateY(0)' : 'translateY(20px)',
      }}
    >
      <div className="grid md:grid-cols-2 gap-12">
        {/* Operations */}
        <div>
          <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-6">Everything you need</h2>
          <div className="space-y-4">
            {OPERATIONS.map(({ category, ops }) => (
              <div key={category}>
                <h3 className="text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
                  {category}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {ops.map(({ name, example }) => (
                    <div key={name} className="group relative">
                      <span className="inline-block px-3 py-1.5 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] cursor-default hover:border-[var(--color-accent)] transition-colors">
                        {name}
                      </span>
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded bg-[var(--color-text-primary)] text-[var(--color-bg-primary)] text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        <code className="font-mono">{example}</code>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Shortcuts */}
        <div>
          <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-2">Power users welcome</h2>
          <p className="text-[var(--color-text-secondary)] mb-6">
            Vim-style navigation, command palette, and keyboard shortcuts for everything.
          </p>
          <div className="space-y-2">
            {SHORTCUTS.map(({ keys, action }, index) => (
              <div
                key={keys}
                className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/30 hover:bg-[var(--color-accent-bg)]/30 transition-all duration-200 group"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <span className="text-sm text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors duration-200">
                  {action}
                </span>
                <kbd className="font-mono px-2.5 py-1 rounded-md bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] text-sm border border-[var(--color-border)] group-hover:border-[var(--color-accent)]/40 group-hover:bg-[var(--color-bg-primary)] shadow-sm transition-all duration-200">
                  {formatShortcut(keys)}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
