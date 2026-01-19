import type { ReactNode } from 'react'

export interface NodeContentProps {
  children: ReactNode
}

export function NodeContent({ children }: NodeContentProps) {
  return <div className="px-3 py-2 text-xs text-[var(--color-text-muted)] space-y-1">{children}</div>
}
