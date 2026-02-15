import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import Check from 'lucide-react/dist/esm/icons/check'
import { formatShortcut } from '@/lib/platform'

interface MenuItemProps {
  label: string
  shortcut?: string
  value?: string
  checked?: boolean
  disabled?: boolean
  danger?: boolean
  onClick?: () => void
}

export function MenuItem({ label, shortcut, value, checked, disabled, danger, onClick }: MenuItemProps) {
  // Use CheckboxItem for items with checked state
  if (checked !== undefined) {
    return (
      <DropdownMenu.CheckboxItem
        checked={checked}
        onCheckedChange={() => onClick?.()}
        disabled={disabled}
        className={`w-full px-3 py-1.5 text-xs flex items-center justify-between gap-4 outline-none ${
          disabled
            ? 'text-[var(--color-text-muted)] cursor-not-allowed'
            : danger
              ? 'text-[var(--color-error)] hover:bg-[var(--color-error)]/10 focus:bg-[var(--color-error)]/10'
              : 'hover:bg-[var(--color-bg-secondary)] focus:bg-[var(--color-bg-secondary)]'
        }`}
      >
        <span className="flex items-center gap-2">
          <DropdownMenu.ItemIndicator className="w-4">
            <Check className="w-3.5 h-3.5" />
          </DropdownMenu.ItemIndicator>
          <span>{label}</span>
        </span>
        {(shortcut || value) && (
          <span className="text-xs text-[var(--color-text-muted)]">{shortcut ? formatShortcut(shortcut) : value}</span>
        )}
      </DropdownMenu.CheckboxItem>
    )
  }

  return (
    <DropdownMenu.Item
      onSelect={onClick}
      disabled={disabled}
      className={`w-full px-3 py-1.5 text-xs flex items-center justify-between gap-4 outline-none ${
        disabled
          ? 'text-[var(--color-text-muted)] cursor-not-allowed'
          : danger
            ? 'text-[var(--color-error)] hover:bg-[var(--color-error)]/10 focus:bg-[var(--color-error)]/10'
            : 'hover:bg-[var(--color-bg-secondary)] focus:bg-[var(--color-bg-secondary)]'
      }`}
    >
      <span>{label}</span>
      {(shortcut || value) && (
        <span className="text-xs text-[var(--color-text-muted)]">{shortcut ? formatShortcut(shortcut) : value}</span>
      )}
    </DropdownMenu.Item>
  )
}
