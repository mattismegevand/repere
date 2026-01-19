import type { LucideIcon } from 'lucide-react'

export interface NodeActionButtonProps {
  icon: LucideIcon
  onClick: (e: React.MouseEvent) => void
  title: string
  ariaLabel?: string
  ariaExpanded?: boolean
  /** Always show the button (not just on hover) */
  alwaysVisible?: boolean
}

export function NodeActionButton({
  icon: Icon,
  onClick,
  title,
  ariaLabel,
  ariaExpanded,
  alwaysVisible,
}: NodeActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`p-1 rounded hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] nopan nodrag ${
        alwaysVisible ? '' : 'opacity-0 group-hover:opacity-100'
      } transition-opacity`}
      title={title}
      aria-label={ariaLabel ?? title}
      aria-expanded={ariaExpanded}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  )
}
