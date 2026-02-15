import FileArchive from 'lucide-react/dist/esm/icons/file-archive'
import FileJson from 'lucide-react/dist/esm/icons/file-json'
import FileSpreadsheet from 'lucide-react/dist/esm/icons/file-spreadsheet'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import { useState } from 'react'

interface FormatInfo {
  id: string
  name: string
  ext: string
  Icon: typeof FileSpreadsheet
  color: string
  pros: string[]
  cons: string[]
  bestFor: string
}

const FORMATS: FormatInfo[] = [
  {
    id: 'csv',
    name: 'CSV',
    ext: '.csv',
    Icon: FileText,
    color: 'text-green-500',
    pros: ['Universal compatibility', 'Human readable', 'Easy to edit'],
    cons: ['No type info', 'Larger file size', 'No compression'],
    bestFor: 'Quick exports and simple data',
  },
  {
    id: 'parquet',
    name: 'Parquet',
    ext: '.parquet',
    Icon: FileArchive,
    color: 'text-purple-500',
    pros: ['10x smaller files', 'Type preservation', 'Columnar format'],
    cons: ['Not human readable', 'Requires special tools'],
    bestFor: 'Large datasets and analytics',
  },
  {
    id: 'json',
    name: 'JSON',
    ext: '.json',
    Icon: FileJson,
    color: 'text-amber-500',
    pros: ['Nested data support', 'Web native', 'Self-describing'],
    cons: ['Verbose', 'No native date type', 'Slower parsing'],
    bestFor: 'API data and nested structures',
  },
  {
    id: 'jsonl',
    name: 'JSONL',
    ext: '.jsonl',
    Icon: FileJson,
    color: 'text-orange-500',
    pros: ['Streamable', 'Line-by-line processing', 'Easy to append'],
    cons: ['No nested arrays', 'Less common', 'No schema'],
    bestFor: 'Log files and streaming data',
  },
  {
    id: 'xlsx',
    name: 'Excel',
    ext: '.xlsx',
    Icon: FileSpreadsheet,
    color: 'text-emerald-500',
    pros: ['Familiar format', 'Multiple sheets', 'Formatting preserved'],
    cons: ['Proprietary', 'Slower to parse', 'Size limits'],
    bestFor: 'Sharing with non-technical users',
  },
]

export function FileFormatComparison() {
  const [activeFormat, setActiveFormat] = useState<string | null>(null)
  const [displayedFormat, setDisplayedFormat] = useState<string | null>(null)

  // Keep displayed format around during exit animation
  const handleMouseEnter = (id: string) => {
    setActiveFormat(id)
    setDisplayedFormat(id)
  }

  const handleMouseLeave = () => {
    setActiveFormat(null)
    // Delay clearing displayed format to allow exit animation
    setTimeout(() => {
      setDisplayedFormat((current) => (current === activeFormat ? null : current))
    }, 300)
  }

  const activeInfo = FORMATS.find((f) => f.id === (activeFormat || displayedFormat))

  return (
    <div className="py-6">
      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Supported formats</h3>

      <div className="flex flex-wrap gap-3">
        {FORMATS.map((format) => (
          <button
            key={format.id}
            onMouseEnter={() => handleMouseEnter(format.id)}
            onMouseLeave={handleMouseLeave}
            className={`
              flex items-center gap-2 px-4 py-3 rounded-lg border transition-all
              ${
                activeFormat === format.id
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-bg)] scale-105'
                  : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-accent)]/50'
              }
            `}
          >
            <format.Icon className={`w-5 h-5 ${format.color}`} />
            <div className="text-left">
              <div className="font-medium text-[var(--color-text-primary)]">{format.name}</div>
              <div className="text-xs text-[var(--color-text-muted)]">{format.ext}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Details panel */}
      <div
        className={`
          overflow-hidden transition-all duration-300 ease-out
          ${activeFormat ? 'max-h-48 opacity-100 mt-4' : 'max-h-0 opacity-0'}
        `}
      >
        {activeInfo && (
          <div className="p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h4 className="text-xs font-medium text-[var(--color-text-muted)] mb-2 uppercase tracking-wide">
                  Pros
                </h4>
                <ul className="space-y-1">
                  {activeInfo.pros.map((pro) => (
                    <li key={pro} className="text-sm text-[var(--color-success)] flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-current" />
                      {pro}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-medium text-[var(--color-text-muted)] mb-2 uppercase tracking-wide">
                  Cons
                </h4>
                <ul className="space-y-1">
                  {activeInfo.cons.map((con) => (
                    <li key={con} className="text-sm text-[var(--color-text-muted)] flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-current" />
                      {con}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-medium text-[var(--color-text-muted)] mb-2 uppercase tracking-wide">
                  Best for
                </h4>
                <p className="text-sm text-[var(--color-text-primary)]">{activeInfo.bestFor}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
