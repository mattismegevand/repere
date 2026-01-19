import type { ReactNode } from 'react'

interface StatusBarSectionProps {
  position: 'left' | 'center' | 'right'
  children: ReactNode
}

export function StatusBarSection({ position, children }: StatusBarSectionProps) {
  const positionStyles = {
    left: 'justify-start',
    center: 'flex-1 justify-center',
    right: 'justify-end',
  }

  return <div className={`flex items-center gap-0.5 ${positionStyles[position]}`}>{children}</div>
}
