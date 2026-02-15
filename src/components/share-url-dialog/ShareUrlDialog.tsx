import { useCallback, useState } from 'react'
import { Button, Checkbox } from '@/components/ui'
import { RadixDialog } from '@/components/ui/RadixDialog'
import type { UrlShareResult } from '@/lib/url-sharing'
import type { Dataset } from '@/types'

const EMBED_SIZE_LIMIT = 1 * 1024 * 1024 // 1MB per dataset for URL sharing

interface Props {
  datasets: Dataset[]
  onGenerate: (embedDatasetIds: Set<string>) => Promise<UrlShareResult>
  onClose: () => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ShareUrlDialog({ datasets, onGenerate, onClose }: Props) {
  const [selectedDatasets, setSelectedDatasets] = useState<Set<string>>(
    () => new Set(datasets.filter((d) => (d.fileSize ?? 0) <= EMBED_SIZE_LIMIT).map((d) => d.id))
  )
  const [result, setResult] = useState<UrlShareResult | null>(null)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleGenerate = useCallback(async () => {
    setGenerating(true)
    try {
      const res = await onGenerate(selectedDatasets)
      setResult(res)
    } finally {
      setGenerating(false)
    }
  }, [onGenerate, selectedDatasets])

  const handleCopy = useCallback(async () => {
    if (!result?.url) return
    try {
      await navigator.clipboard.writeText(result.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
    }
  }, [result?.url])

  const toggleDataset = useCallback((id: string) => {
    setSelectedDatasets((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedDatasets(new Set(datasets.filter((d) => (d.fileSize ?? 0) <= EMBED_SIZE_LIMIT).map((d) => d.id)))
  }, [datasets])

  const selectNone = useCallback(() => {
    setSelectedDatasets(new Set())
  }, [])

  // Show result view
  if (result) {
    const isLongUrl = result.url && result.url.length > 8000

    if (!result.success) {
      return (
        <RadixDialog
          open={true}
          onOpenChange={(open) => !open && onClose()}
          title="Share session"
          width="md"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setResult(null)}>
                Back
              </Button>
              <Button variant="secondary" size="sm" onClick={onClose}>
                Close
              </Button>
            </>
          }
        >
          <div className="text-sm text-[var(--color-error)]">{result.error}</div>
          {result.tooLarge && (
            <p className="text-xs text-[var(--color-text-muted)] mt-2">
              Try embedding fewer datasets, or use "Save session" to download as a file instead.
            </p>
          )}
        </RadixDialog>
      )
    }

    return (
      <RadixDialog
        open={true}
        onOpenChange={(open) => !open && onClose()}
        title="Share session"
        width="lg"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setResult(null)}>
              Back
            </Button>
            <Button variant="primary" size="sm" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy to clipboard'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-[var(--color-text-muted)]">
            Share this URL to let others open your session. They may need to upload data files if they weren't embedded.
          </p>
          <div className="relative">
            <input
              type="text"
              readOnly
              value={result.url}
              className="w-full px-3 py-2 text-xs font-mono bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded select-all"
              onClick={(e) => e.currentTarget.select()}
            />
          </div>
          {isLongUrl && (
            <p className="text-xs text-[var(--color-warning)]">
              This URL is very long ({Math.round((result.url?.length ?? 0) / 1024)}KB). It may not work in all browsers
              or messaging apps.
            </p>
          )}
          <div className="text-xs text-[var(--color-text-muted)] flex gap-4">
            {result.compressedSize ? <span>Compressed: {formatSize(result.compressedSize)}</span> : null}
            {result.uncompressedSize ? <span>Uncompressed: {formatSize(result.uncompressedSize)}</span> : null}
          </div>
        </div>
      </RadixDialog>
    )
  }

  // Show configuration view
  return (
    <RadixDialog
      open={true}
      onOpenChange={(open) => !open && onClose()}
      title="Share session URL"
      width="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleGenerate} loading={generating}>
            Generate URL
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {datasets.length > 0 ? (
          <>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">Embed data</label>
              <div className="flex gap-1">
                <Button variant="ghost" size="xs" onClick={selectAll}>
                  All
                </Button>
                <Button variant="ghost" size="xs" onClick={selectNone}>
                  None
                </Button>
              </div>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {datasets.map((dataset) => {
                const fileSize = dataset.fileSize ?? 0
                const tooLarge = fileSize > EMBED_SIZE_LIMIT
                return (
                  <label
                    key={dataset.id}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
                      tooLarge ? 'opacity-50' : 'hover:bg-[var(--color-bg-secondary)] cursor-pointer'
                    }`}
                  >
                    <Checkbox
                      checked={selectedDatasets.has(dataset.id)}
                      onCheckedChange={() => toggleDataset(dataset.id)}
                      disabled={tooLarge}
                    />
                    <span className="flex-1 truncate">{dataset.name}</span>
                    <span className="text-[var(--color-text-muted)]">
                      {formatSize(fileSize)}
                      {tooLarge && ' (too large)'}
                    </span>
                  </label>
                )
              })}
            </div>
            <p className="text-[10px] text-[var(--color-text-muted)]">
              Unchecked datasets will require recipients to upload the file.
            </p>
          </>
        ) : (
          <p className="text-xs text-[var(--color-text-muted)]">No datasets in session.</p>
        )}
      </div>
    </RadixDialog>
  )
}
