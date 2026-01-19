import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

type DialogWidth = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl'

interface RadixDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  width?: DialogWidth
  children: ReactNode
  footer?: ReactNode
  showCloseButton?: boolean
  /** Prevent closing when clicking outside (default: false) */
  preventOutsideClose?: boolean
}

const widthStyles: Record<DialogWidth, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
}

export function RadixDialog({
  open,
  onOpenChange,
  title,
  width = 'md',
  children,
  footer,
  showCloseButton,
  preventOutsideClose = false,
}: RadixDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content
          className={`dialog-content w-full mx-4 ${widthStyles[width]}`}
          onPointerDownOutside={preventOutsideClose ? (e) => e.preventDefault() : undefined}
        >
          <div className="flex items-center justify-between mb-3 border-b border-[var(--color-border)] pb-2">
            <Dialog.Title className="text-sm font-medium">{title}</Dialog.Title>
            {showCloseButton && (
              <Dialog.Close asChild>
                <button
                  aria-label="Close dialog"
                  className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </Dialog.Close>
            )}
          </div>
          <div className="flex-1 min-h-0">{children}</div>
          {footer && (
            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-[var(--color-border)]">{footer}</div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
