import { ConfirmDialog } from '@/components/confirm-dialog'
import type { Column } from '@/types'
import { ColumnFilter } from './ColumnFilter'

interface ConfirmDeleteState {
  descendantCount: number
}

interface RowJumpPromptProps {
  value: string
  totalCount: number
  inputRef: React.RefObject<HTMLInputElement | null>
  onValueChange: (value: string) => void
  onJump: (rowNum: number) => void
  onClose: () => void
}

export function RowJumpPrompt({ value, totalCount, inputRef, onValueChange, onJump, onClose }: RowJumpPromptProps) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg shadow-lg px-3 py-2 flex items-center gap-2">
      <span className="text-sm font-mono text-[var(--color-text-muted)]">:</span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onValueChange(e.target.value.replace(/[^0-9]/g, ''))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            const rowNum = parseInt(value, 10)
            if (!Number.isNaN(rowNum) && rowNum >= 1 && rowNum <= totalCount) {
              onJump(rowNum)
            }
            onClose()
          } else if (e.key === 'Escape') {
            onClose()
          }
          e.stopPropagation()
        }}
        onBlur={onClose}
        placeholder="row number"
        className="w-24 px-1 py-0.5 text-sm font-mono bg-transparent border-none outline-none"
        autoComplete="off"
      />
      <span className="text-[10px] text-[var(--color-text-muted)]">/ {totalCount.toLocaleString()}</span>
    </div>
  )
}

interface ImagePreviewModalProps {
  url: string
  onClose: () => void
}

export function ImagePreviewModal({ url, onClose }: ImagePreviewModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <img
        src={url}
        alt="Preview"
        className="max-w-[90vw] max-h-[90vh] object-contain rounded shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}

interface FilterColumnPopupProps {
  filterColumn: { column: string; position: { x: number; y: number } }
  columns: Column[]
  onClose: () => void
}

export function FilterColumnPopup({ filterColumn, columns, onClose }: FilterColumnPopupProps) {
  const col = columns.find((c) => c.name === filterColumn.column)
  if (!col) return null
  return <ColumnFilter column={col} onClose={onClose} position={filterColumn.position} />
}

interface DeleteConfirmDialogProps {
  confirmDelete: ConfirmDeleteState
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteConfirmDialog({ confirmDelete, onConfirm, onCancel }: DeleteConfirmDialogProps) {
  return (
    <ConfirmDialog
      title="Delete view with children?"
      message={`This will also delete ${confirmDelete.descendantCount} derived view${confirmDelete.descendantCount > 1 ? 's' : ''}.`}
      confirmLabel="Delete All"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}

interface VisualModeIndicatorProps {
  visible: boolean
}

export function VisualModeIndicator({ visible }: VisualModeIndicatorProps) {
  if (!visible) return null
  return (
    <div className="absolute bottom-2 left-2 z-30 px-2 py-1 bg-[var(--color-accent)] text-white text-[10px] font-medium rounded-md shadow-md">
      VISUAL
    </div>
  )
}
