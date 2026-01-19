import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import type { ReactNode } from 'react'

interface MenuDropdownProps {
  label: string
  icon?: ReactNode
  small?: boolean
  children: ReactNode
}

export function MenuDropdown({ label, icon, small, children }: MenuDropdownProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={`flex items-center gap-1.5 px-3 py-1.5 ${small ? 'text-xs' : 'text-sm'} rounded transition-colors text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] data-[state=open]:bg-[var(--color-bg-secondary)] data-[state=open]:text-[var(--color-text-primary)]`}
        >
          {icon}
          <span className={icon ? 'font-logo font-semibold' : ''}>{label}</span>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content sideOffset={4} align="start" className="popover-content py-1 min-w-[220px]">
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

// Re-export for complex use cases
