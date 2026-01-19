import { ChevronLeft } from 'lucide-react'
import { useCommandPalette } from '../CommandPaletteContext'

interface PageHeaderProps {
  title: string
  breadcrumbs?: string[]
}

export function PageHeader({ title, breadcrumbs }: PageHeaderProps) {
  const { popPage } = useCommandPalette()

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)] text-sm">
      <button
        type="button"
        onClick={popPage}
        className="p-0.5 -ml-1 rounded hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]"
        title="Back (Esc)"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span>{crumb}</span>
              <span className="text-[var(--color-text-muted)]/50">›</span>
            </span>
          ))}
          <span className="text-[var(--color-text-primary)] font-medium">{title}</span>
        </div>
      ) : (
        <span className="font-medium">{title}</span>
      )}
      <span className="ml-auto text-xs text-[var(--color-text-muted)]">esc</span>
    </div>
  )
}
