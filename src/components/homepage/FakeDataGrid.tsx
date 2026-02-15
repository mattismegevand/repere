import ArrowDown from 'lucide-react/dist/esm/icons/arrow-down'
import ArrowUp from 'lucide-react/dist/esm/icons/arrow-up'
import Filter from 'lucide-react/dist/esm/icons/filter'

interface Column {
  name: string
  type: string
  width: number
  sorted?: 'asc' | 'desc'
  filtered?: boolean
  align?: 'left' | 'right'
}

const FAKE_COLUMNS: Column[] = [
  { name: 'id', type: 'INT', width: 50, align: 'right' },
  { name: 'name', type: 'VARCHAR', width: 120 },
  { name: 'status', type: 'VARCHAR', width: 80, filtered: true },
  { name: 'revenue', type: 'DOUBLE', width: 100, sorted: 'desc', align: 'right' },
  { name: 'created_at', type: 'DATE', width: 100, sorted: 'asc' },
]

const FAKE_ROWS = [
  { id: 1, name: 'Acme Corp', status: 'active', revenue: 250000, created_at: '2024-03-12' },
  { id: 2, name: 'Wayne Ent', status: 'active', revenue: 180000, created_at: '2024-03-20' },
  { id: 3, name: 'Stark Ind', status: 'active', revenue: 125000, created_at: '2024-01-15' },
  { id: 4, name: 'Globex Inc', status: 'active', revenue: 89000, created_at: '2024-02-03' },
  { id: 5, name: 'Oscorp', status: 'pending', revenue: 67000, created_at: '2024-04-05' },
  { id: 6, name: 'Initech', status: 'pending', revenue: 45000, created_at: '2024-02-18' },
]

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-500/10 text-green-600',
    pending: 'bg-amber-500/10 text-amber-600',
    inactive: 'bg-gray-500/10 text-gray-500',
  }
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[status] || colors.inactive}`}>
      {status}
    </span>
  )
}

function ColumnHeader({ col }: { col: Column }) {
  return (
    <div
      className="px-2 py-1.5 text-[11px] font-medium text-[var(--color-text-secondary)] border-r border-[var(--color-border)] last:border-r-0 flex items-center gap-1 shrink-0"
      style={{ width: col.width }}
    >
      <span className="truncate">{col.name}</span>
      {col.sorted && (
        <span className="text-[var(--color-accent)]">
          {col.sorted === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
        </span>
      )}
      {col.filtered && (
        <span className="text-[var(--color-accent)]">
          <Filter className="w-3 h-3" />
        </span>
      )}
    </div>
  )
}

function Cell({ col, value }: { col: Column; value: unknown }) {
  const baseClass = `px-2 py-1.5 text-[11px] border-r border-[var(--color-border)] last:border-r-0 truncate shrink-0 ${
    col.align === 'right' ? 'text-right' : 'text-left'
  }`

  if (col.name === 'status') {
    return (
      <div className={baseClass} style={{ width: col.width }}>
        <StatusBadge status={value as string} />
      </div>
    )
  }

  if (col.name === 'revenue') {
    return (
      <div className={`${baseClass} font-mono text-[var(--color-text-primary)]`} style={{ width: col.width }}>
        ${(value as number).toLocaleString()}
      </div>
    )
  }

  if (col.name === 'id') {
    return (
      <div className={`${baseClass} text-[var(--color-text-muted)]`} style={{ width: col.width }}>
        {String(value)}
      </div>
    )
  }

  if (col.type === 'DATE') {
    return (
      <div className={`${baseClass} font-mono text-[var(--color-text-muted)]`} style={{ width: col.width }}>
        {String(value)}
      </div>
    )
  }

  return (
    <div className={`${baseClass} text-[var(--color-text-primary)]`} style={{ width: col.width }}>
      {String(value)}
    </div>
  )
}

export function FakeDataGrid() {
  return (
    <div className="border border-[var(--color-border)] rounded-lg overflow-hidden bg-[var(--color-bg-primary)] min-w-[500px]">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-1.5 py-1 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <div className="flex items-center gap-1 px-2 py-0.5 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] shadow-sm border border-[var(--color-border-light)] rounded-md text-[11px]">
          <span className="text-[10px] text-[var(--color-text-muted)]">Dataset &rarr; Filter</span>
          <span className="font-medium">companies</span>
        </div>
        <div className="flex items-center gap-1 px-2 py-0.5 text-[var(--color-text-muted)] rounded-md text-[11px]">
          <span className="text-[10px]">Dataset</span>
          <span className="font-medium">raw_data</span>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50">
        <span className="text-[10px] text-[var(--color-text-muted)]">Filters:</span>
        <div className="flex items-center gap-1 px-2 py-0.5 bg-[var(--color-accent-bg)] border border-[var(--color-accent)]/30 rounded text-[10px] text-[var(--color-accent)]">
          <Filter className="w-3 h-3" />
          status = &apos;active&apos; OR status = &apos;pending&apos;
          <button className="ml-1 hover:text-[var(--color-accent-hover)]">&times;</button>
        </div>
      </div>

      {/* Header row */}
      <div className="flex border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <div className="w-8 px-2 py-1.5 text-[10px] text-[var(--color-text-muted)] border-r border-[var(--color-border)] text-right shrink-0">
          #
        </div>
        {FAKE_COLUMNS.map((col) => (
          <ColumnHeader key={col.name} col={col} />
        ))}
      </div>

      {/* Data rows */}
      {FAKE_ROWS.map((row, idx) => (
        <div
          key={row.id}
          className={`flex border-b border-[var(--color-border)] last:border-b-0 ${idx % 2 === 1 ? 'bg-[var(--color-bg-secondary)]/50' : ''}`}
        >
          <div className="w-8 px-2 py-1.5 text-[10px] text-[var(--color-text-muted)] border-r border-[var(--color-border)] text-right shrink-0">
            {idx + 1}
          </div>
          {FAKE_COLUMNS.map((col) => (
            <Cell key={col.name} col={col} value={row[col.name as keyof typeof row]} />
          ))}
        </div>
      ))}

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)]">
        <span>6 of 7 rows (filtered)</span>
        <div className="flex items-center gap-3">
          <span>Sorted: revenue DESC</span>
          <span>5 columns</span>
        </div>
      </div>
    </div>
  )
}
