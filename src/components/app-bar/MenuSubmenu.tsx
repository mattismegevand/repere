import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

interface MenuSubmenuProps {
  label: string
  disabled?: boolean
  children: ReactNode
}

export function MenuSubmenu({ label, disabled, children }: MenuSubmenuProps) {
  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger
        disabled={disabled}
        className={`w-full px-3 py-1.5 text-xs flex items-center justify-between gap-4 outline-none ${
          disabled
            ? 'text-[var(--color-text-muted)] cursor-not-allowed'
            : 'hover:bg-[var(--color-bg-secondary)] focus:bg-[var(--color-bg-secondary)] data-[state=open]:bg-[var(--color-bg-secondary)]'
        }`}
      >
        <span>{label}</span>
        <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
      </DropdownMenu.SubTrigger>

      <DropdownMenu.Portal>
        <DropdownMenu.SubContent sideOffset={2} alignOffset={-4} className="popover-content py-1 min-w-[200px]">
          {children}
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
  )
}
