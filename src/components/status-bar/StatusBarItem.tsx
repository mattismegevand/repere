import type { ReactNode } from 'react'

interface StatusBarItemProps {
  icon?: ReactNode
  label?: string
  tooltip?: string
  className?: string
  children?: ReactNode
}

export function StatusBarItem({ icon, label, tooltip, className = '', children }: StatusBarItemProps) {
  return (
    <span
      className={`flex items-center gap-1 px-1.5 h-full text-[var(--color-text-muted)] ${className}`}
      title={tooltip}
    >
      {icon}
      {label || children}
    </span>
  )
}
