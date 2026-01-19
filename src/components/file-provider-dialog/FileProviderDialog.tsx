import { useCallback, useRef, useState } from 'react'
import { Button } from '@/components/ui'
import { RadixDialog } from '@/components/ui/RadixDialog'
import { computeFileHash } from '@/lib/file-system'

interface RequiredFile {
  id: string
  fileName: string
  fileSize?: number // May not be available when loaded via path in Tauri mode
  fileHash?: string // SHA-256 hash for verification
}

export type FileStatus = 'pending' | 'provided' | 'skipped' | 'verifying' | 'mismatch'

export interface FileProviderResult {
  providedFiles: Map<string, File>
  skippedIds: Set<string>
}

interface Props {
  title: string
  description: string
  requiredFiles: RequiredFile[]
  allowSkip?: boolean
  allowPartialRestore?: boolean
  loading?: boolean
  onConfirm: (result: FileProviderResult) => void
  onCancel: () => void
  confirmLabel?: string
  cancelLabel?: string
}

function formatFileSize(bytes: number | undefined): string {
  if (bytes === undefined) return 'Unknown size'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileProviderDialog({
  title,
  description,
  requiredFiles,
  allowSkip = true,
  allowPartialRestore = true,
  loading = false,
  onConfirm,
  onCancel,
  confirmLabel = 'Continue',
  cancelLabel = 'Cancel',
}: Props) {
  const [providedFiles, setProvidedFiles] = useState<Map<string, File>>(new Map())
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set())
  const [verifyingIds, setVerifyingIds] = useState<Set<string>>(new Set())
  const [mismatchIds, setMismatchIds] = useState<Set<string>>(new Set())
  const [dragOver, setDragOver] = useState<string | null>(null)
  const fileInputRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  const handleFileSelect = useCallback(
    async (id: string, file: File) => {
      // Get expected hash for this file
      const req = requiredFiles.find((r) => r.id === id)
      const expectedHash = req?.fileHash

      // If hash exists, verify it
      if (expectedHash) {
        setVerifyingIds((prev) => new Set(prev).add(id))
        setMismatchIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })

        try {
          const actualHash = await computeFileHash(file)
          if (actualHash !== expectedHash) {
            setMismatchIds((prev) => new Set(prev).add(id))
            setVerifyingIds((prev) => {
              const next = new Set(prev)
              next.delete(id)
              return next
            })
            return // Don't add mismatched file
          }
        } finally {
          setVerifyingIds((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        }
      }

      setProvidedFiles((prev) => {
        const next = new Map(prev)
        next.set(id, file)
        return next
      })
      // Remove from skipped if it was skipped
      setSkippedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      // Remove from mismatch if it was there
      setMismatchIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    },
    [requiredFiles]
  )

  const handleSkip = useCallback((id: string) => {
    setSkippedIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
    // Remove from provided if it was provided
    setProvidedFiles((prev) => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }, [])

  const handleUnskip = useCallback((id: string) => {
    setSkippedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const handleDrop = useCallback(
    (id: string, e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(null)
      const file = e.dataTransfer.files[0]
      if (file) {
        handleFileSelect(id, file)
      }
    },
    [handleFileSelect]
  )

  const handleDragOver = (id: string, e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(id)
  }

  const handleDragLeave = () => {
    setDragOver(null)
  }

  const handleConfirm = () => {
    onConfirm({ providedFiles, skippedIds })
  }

  const getFileStatus = (id: string): FileStatus => {
    if (verifyingIds.has(id)) return 'verifying'
    if (mismatchIds.has(id)) return 'mismatch'
    if (providedFiles.has(id)) return 'provided'
    if (skippedIds.has(id)) return 'skipped'
    return 'pending'
  }

  // Can confirm if all files are either provided or skipped (when partial restore allowed)
  const allResolved = requiredFiles.every((req) => {
    const status = getFileStatus(req.id)
    return status === 'provided' || (allowPartialRestore && status === 'skipped')
  })

  // At least one file must be provided or session must have embedded data to restore
  const hasAtLeastOneProvided = providedFiles.size > 0 || requiredFiles.length === 0

  const canConfirm = allowPartialRestore ? allResolved : allResolved && hasAtLeastOneProvided

  return (
    <RadixDialog
      open={true}
      onOpenChange={(open) => !open && onCancel()}
      title={title}
      width="lg"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            disabled={!canConfirm || loading}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-xs text-[var(--color-text-secondary)] mb-4">{description}</p>

      <div className="space-y-3">
        {requiredFiles.map((req) => {
          const status = getFileStatus(req.id)
          const provided = providedFiles.get(req.id)
          const isOver = dragOver === req.id

          return (
            <div
              key={req.id}
              onDrop={(e) => handleDrop(req.id, e)}
              onDragOver={(e) => handleDragOver(req.id, e)}
              onDragLeave={handleDragLeave}
              className={`border-2 border-dashed p-3 transition-colors ${
                status === 'skipped'
                  ? 'border-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] opacity-50'
                  : status === 'mismatch'
                    ? 'border-[var(--color-error)] bg-[var(--color-error)]/10'
                    : status === 'verifying'
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                      : isOver
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                        : status === 'provided'
                          ? 'border-[var(--color-success)] bg-[var(--color-success)]/10'
                          : 'border-[var(--color-border)]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-medium truncate ${status === 'skipped' ? 'line-through' : ''}`}>
                    {req.fileName}
                  </p>
                  <p className="text-[10px] text-[var(--color-text-muted)]">{formatFileSize(req.fileSize)}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {status === 'verifying' ? (
                    <span className="text-xs text-[var(--color-accent)]">Verifying...</span>
                  ) : status === 'mismatch' ? (
                    <>
                      <span className="text-xs text-[var(--color-error)]">Wrong file</span>
                      <Button variant="secondary" size="xs" onClick={() => fileInputRefs.current.get(req.id)?.click()}>
                        Retry
                      </Button>
                    </>
                  ) : status === 'provided' ? (
                    <span className="text-xs text-[var(--color-success)]">Verified</span>
                  ) : status === 'skipped' ? (
                    <Button variant="secondary" size="xs" onClick={() => handleUnskip(req.id)}>
                      Undo skip
                    </Button>
                  ) : (
                    <>
                      <Button variant="secondary" size="xs" onClick={() => fileInputRefs.current.get(req.id)?.click()}>
                        Select
                      </Button>
                      {allowSkip && (
                        <Button variant="ghost" size="xs" onClick={() => handleSkip(req.id)}>
                          Skip
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
              {provided && (
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1 truncate">
                  {provided.name} ({formatFileSize(provided.size)})
                </p>
              )}
              <input
                ref={(el) => {
                  if (el) fileInputRefs.current.set(req.id, el)
                }}
                type="file"
                className="hidden"
                accept=".csv,.parquet,.xlsx"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFileSelect(req.id, file)
                }}
              />
            </div>
          )
        })}
      </div>

      {skippedIds.size > 0 && (
        <p className="text-[10px] text-[var(--color-text-muted)] mt-3">
          {skippedIds.size} file{skippedIds.size > 1 ? 's' : ''} will be excluded from restore.
        </p>
      )}
    </RadixDialog>
  )
}
