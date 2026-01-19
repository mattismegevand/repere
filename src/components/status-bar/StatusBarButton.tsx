import type { ReactNode } from 'react'

interface StatusBarButtonProps {
  onClick?: () => void
  disabled?: boolean
  active?: boolean
  tooltip?: string
  'aria-label'?: string
  className?: string
  children: ReactNode
}

export function StatusBarButton({
  onClick,
  disabled,
  active,
  tooltip,
  'aria-label': ariaLabel,
  className = '',
  children,
}: StatusBarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1 px-1.5 h-full transition-colors cursor-pointer ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[var(--color-bg-tertiary)]'
      } ${
        active
          ? 'text-[var(--color-accent)] bg-[var(--color-accent-bg)]'
          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
      } ${className}`}
      title={tooltip}
      aria-label={ariaLabel ?? tooltip}
    >
      {children}
    </button>
  )
}
