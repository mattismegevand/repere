import { memo, useEffect, useRef, useState } from 'react'
import type { ColumnStats } from '@/lib/profiling'
import { Histogram } from './Histogram'

interface Props {
  stats: ColumnStats
  compact?: boolean
}

// Lazy histogram that only renders when visible (IntersectionObserver)
function LazyHistogram({ data, height }: { data: { bin: string; count: number }[]; height: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect() // Only need to render once
        }
      },
      { rootMargin: '100px' } // Start loading slightly before visible
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} style={{ height }}>
      {isVisible ? <Histogram data={data} height={height} /> : null}
    </div>
  )
}

const TYPE_COLORS: Record<string, string> = {
  number: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
  string: 'bg-green-500/20 text-green-600 dark:text-green-400',
  boolean: 'bg-purple-500/20 text-purple-600 dark:text-purple-400',
  date: 'bg-orange-500/20 text-orange-600 dark:text-orange-400',
  unknown: 'bg-gray-500/20 text-gray-500',
}

export const ColumnCard = memo(function ColumnCard({ stats, compact = false }: Props) {
  const nullPct = stats.count > 0 ? (stats.nullCount / stats.count) * 100 : 0
  const uniquePct = stats.count > 0 ? (stats.uniqueCount / stats.count) * 100 : 0
  const outlierPct = stats.count > 0 && stats.outlierCount !== undefined ? (stats.outlierCount / stats.count) * 100 : 0

  if (compact) {
    return (
      <div className="p-2.5 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)] hover:border-[var(--color-border-hover)] transition-colors">
        {/* Header row */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium truncate flex-1 mr-2">{stats.column}</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS[stats.type]}`}>
            {stats.type}
          </span>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-[10px] mb-2">
          <div className="flex items-center gap-1">
            <span className="text-[var(--color-text-muted)]">Null</span>
            <span className={nullPct > 10 ? 'text-orange-500' : ''}>{nullPct.toFixed(0)}%</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[var(--color-text-muted)]">Unique</span>
            <span>{uniquePct.toFixed(0)}%</span>
          </div>
          {stats.type === 'number' && stats.mean !== undefined && (
            <div className="flex items-center gap-1">
              <span className="text-[var(--color-text-muted)]">Mean</span>
              <span>{formatNumber(stats.mean)}</span>
            </div>
          )}
          {stats.type === 'number' && stats.outlierCount !== undefined && stats.outlierCount > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-[var(--color-text-muted)]">Outliers</span>
              <span className={outlierPct > 5 ? 'text-orange-500' : ''}>{stats.outlierCount}</span>
            </div>
          )}
        </div>

        {/* Range for numbers */}
        {stats.type === 'number' && stats.min !== undefined && stats.max !== undefined && (
          <div className="text-[9px] text-[var(--color-text-muted)] mb-2">
            Range: {formatNumber(stats.min as number)} → {formatNumber(stats.max as number)}
          </div>
        )}

        {/* Histogram - lazy loaded for performance */}
        {stats.histogram && stats.histogram.length > 0 && (
          <div className="mt-1">
            <LazyHistogram data={stats.histogram} height={60} />
          </div>
        )}
      </div>
    )
  }

  // Full version (original)
  return (
    <div className="p-3 border border-[var(--color-border)] rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium truncate">{stats.column}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded ${TYPE_COLORS[stats.type]}`}>{stats.type}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div>
          <span className="text-[var(--color-text-muted)]">Count</span>
          <div>{stats.count.toLocaleString()}</div>
        </div>
        <div>
          <span className="text-[var(--color-text-muted)]">Unique</span>
          <div>
            {stats.uniqueCount.toLocaleString()} ({uniquePct.toFixed(1)}%)
          </div>
        </div>
        <div>
          <span className="text-[var(--color-text-muted)]">Null</span>
          <div className={nullPct > 10 ? 'text-orange-500' : ''}>
            {stats.nullCount.toLocaleString()} ({nullPct.toFixed(1)}%)
          </div>
        </div>
        {stats.type === 'number' && stats.mean !== undefined && (
          <div>
            <span className="text-[var(--color-text-muted)]">Mean</span>
            <div>{stats.mean.toFixed(2)}</div>
          </div>
        )}
        {stats.type === 'number' && stats.outlierCount !== undefined && (
          <div>
            <span className="text-[var(--color-text-muted)]">Outliers</span>
            <div className={outlierPct > 5 ? 'text-orange-500' : ''}>
              {stats.outlierCount.toLocaleString()} ({outlierPct.toFixed(1)}%)
            </div>
          </div>
        )}
      </div>

      {stats.type === 'number' && stats.min !== undefined && stats.max !== undefined && (
        <div className="text-xs mb-2 text-[var(--color-text-muted)]">
          Range: {stats.min} - {stats.max}
        </div>
      )}

      {stats.histogram && stats.histogram.length > 0 && <LazyHistogram data={stats.histogram} height={80} />}
    </div>
  )
})

function formatNumber(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return (value / 1000000).toFixed(1) + 'M'
  }
  if (Math.abs(value) >= 1000) {
    return (value / 1000).toFixed(1) + 'K'
  }
  if (Number.isInteger(value)) {
    return value.toString()
  }
  return value.toFixed(2)
}
