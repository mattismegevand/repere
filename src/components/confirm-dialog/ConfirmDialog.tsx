import { Button } from '@/components/ui'
import { RadixDialog } from '@/components/ui/RadixDialog'

interface Props {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: Props) {
  return (
    <RadixDialog
      open={true}
      onOpenChange={(open) => !open && onCancel()}
      title={title}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={variant === 'danger' ? 'danger' : 'primary'} size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-xs text-[var(--color-text-secondary)]">{message}</p>
    </RadixDialog>
  )
}
