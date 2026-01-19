import { Download, X } from 'lucide-react'
import { useState } from 'react'

interface MatplotlibPreviewProps {
  base64Image: string
  onClose?: () => void
}

export function MatplotlibPreview({ base64Image, onClose }: MatplotlibPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = `data:image/png;base64,${base64Image}`
    link.download = `matplotlib_${Date.now()}.png`
    link.click()
  }

  return (
    <div className="relative">
      {/* Thumbnail view */}
      <div className="cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setIsExpanded(true)}>
        <img
          src={`data:image/png;base64,${base64Image}`}
          alt="Matplotlib output"
          className="max-w-full max-h-[200px] object-contain rounded border border-[var(--color-border)]"
        />
      </div>

      {/* Action buttons */}
      <div className="absolute top-1 right-1 flex gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleDownload()
          }}
          className="p-1 rounded bg-[var(--color-bg-secondary)]/80 hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          title="Download image"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
        {onClose && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            className="p-1 rounded bg-[var(--color-bg-secondary)]/80 hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            title="Clear image"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Expanded modal */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setIsExpanded(false)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <img
              src={`data:image/png;base64,${base64Image}`}
              alt="Matplotlib output (expanded)"
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            />
            <button
              onClick={() => setIsExpanded(false)}
              className="absolute top-2 right-2 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleDownload()
              }}
              className="absolute top-2 right-12 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white"
              title="Download image"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
