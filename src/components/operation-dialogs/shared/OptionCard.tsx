import type { ReactNode } from 'react'

interface OptionCardProps {
  selected: boolean
  onClick: () => void
  title: string
  description?: string
  children?: ReactNode
}

export function OptionCard({ selected, onClick, title, description, children }: OptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 p-3 border rounded-lg text-left transition-colors ${
        selected
          ? 'border-[var(--color-accent)] bg-[var(--color-accent-bg)]'
          : 'border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]'
      }`}
    >
      {children}
      <div className="font-medium text-sm">{title}</div>
      {description ? <div className="text-xs text-[var(--color-text-muted)] mt-1">{description}</div> : null}
    </button>
  )
}
