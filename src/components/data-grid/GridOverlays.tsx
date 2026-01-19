import { useState } from 'react'

interface SelectionStats {
  count: number
  unique: number
  sum: number | null
  avg: number | null
  median: number | null
  stdDev: number | null
  min: string | number | null
  max: string | number | null
}

function StatValue({ label, value }: { label: string; value: string | number }) {
  const [copied, setCopied] = useState(false)
  const handleClick = () => {
    navigator.clipboard.writeText(String(value))
    setCopied(true)
    setTimeout(() => setCopied(false), 1000)
  }
  return (
    <button
      onClick={handleClick}
      className={`cursor-pointer transition-colors ${copied ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
      title={copied ? 'Copied!' : `Click to copy ${value}`}
      aria-label={copied ? `${label} copied` : `Copy ${label} value: ${value}`}
    >
      {label}: <span className="font-medium">{copied ? 'Copied!' : value}</span>
    </button>
  )
}

interface GridOverlaysProps {
  selectionStats: SelectionStats | null
}

export function GridOverlays({ selectionStats }: GridOverlaysProps) {
  if (!selectionStats) {
    return null
  }

  const isSingleCell = selectionStats.count === 1

  return (
    <div className="absolute bottom-0 right-4 bg-[var(--color-bg-primary)] border-l border-t border-[var(--color-border)] rounded-tl px-2 py-1 text-[10px] z-30">
      <div className="flex items-center gap-2">
        {isSingleCell ? (
          selectionStats.min !== null && <StatValue label="Value" value={selectionStats.min} />
        ) : (
          <>
            <StatValue label="Count" value={selectionStats.count} />
            {selectionStats.unique !== selectionStats.count && (
              <StatValue label="Unique" value={selectionStats.unique} />
            )}
            {selectionStats.sum !== null && (
              <StatValue
                label="Sum"
                value={selectionStats.sum.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              />
            )}
            {selectionStats.avg !== null && <StatValue label="Avg" value={selectionStats.avg.toFixed(2)} />}
            {selectionStats.min !== null && <StatValue label="Min" value={selectionStats.min} />}
            {selectionStats.max !== null && <StatValue label="Max" value={selectionStats.max} />}
          </>
        )}
      </div>
    </div>
  )
}
