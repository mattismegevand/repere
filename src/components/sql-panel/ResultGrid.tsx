import { useVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useRef } from 'react'

interface ResultColumn {
  name: string
  type: string
}

interface ResultGridProps {
  columns: ResultColumn[]
  rows: Record<string, unknown>[]
  maxHeight?: number
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '∅'

  if (typeof value === 'number') {
    return Number.isInteger(value) ? value.toString() : value.toFixed(4)
  }
  if (typeof value === 'bigint') {
    return value.toString()
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }
  if (value instanceof Date) {
    return value.toISOString().replace('T', ' ').split('.')[0]
  }
  if (Array.isArray(value)) {
    const preview = value
      .slice(0, 3)
      .map((v) => String(v))
      .join(', ')
    return value.length > 3 ? `[${preview}, ...]` : `[${preview}]`
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

const ROW_HEIGHT = 24
const HEADER_HEIGHT = 24
const COL_WIDTH = 120

export function ResultGrid({ columns, rows, maxHeight = 400 }: ResultGridProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  // Sync horizontal scroll between header and body
  const handleScroll = useCallback(() => {
    if (parentRef.current && headerRef.current) {
      headerRef.current.scrollLeft = parentRef.current.scrollLeft
    }
  }, [])

  const handleCopyCell = useCallback((value: unknown) => {
    const text = formatCell(value)
    navigator.clipboard.writeText(text === '∅' ? '' : text)
  }, [])

  if (columns.length === 0) {
    return <div className="text-[11px] text-[var(--color-text-muted)] p-3">No columns in result</div>
  }

  const totalWidth = columns.length * COL_WIDTH

  return (
    <div
      className="flex flex-col h-full rounded overflow-hidden border border-[var(--color-border)]"
      style={{ maxHeight }}
    >
      {/* Header - synced scroll */}
      <div
        ref={headerRef}
        className="overflow-hidden border-b border-[var(--color-border)] shrink-0"
        style={{ height: HEADER_HEIGHT }}
      >
        <div className="flex" style={{ width: totalWidth }}>
          {columns.map((col, colIdx) => (
            <div
              key={colIdx}
              className="flex items-center px-2 text-[10px] font-medium text-[var(--color-text-secondary)] shrink-0"
              style={{ width: COL_WIDTH, height: HEADER_HEIGHT }}
              title={`${col.name} (${col.type})`}
            >
              {col.name}
            </div>
          ))}
        </div>
      </div>

      {/* Rows - scrollable */}
      <div ref={parentRef} className="overflow-auto flex-1" onScroll={handleScroll}>
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: totalWidth,
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index]
            const isEven = virtualRow.index % 2 === 0
            return (
              <div
                key={virtualRow.index}
                className={`flex absolute ${isEven ? '' : 'bg-[var(--color-bg-secondary)]/50'} hover:bg-[var(--color-accent)]/5`}
                style={{
                  height: ROW_HEIGHT,
                  width: totalWidth,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {columns.map((col, colIdx) => {
                  const value = row[col.name]
                  const formatted = formatCell(value)
                  return (
                    <div
                      key={colIdx}
                      className="flex items-center px-2 text-[11px] truncate cursor-pointer shrink-0"
                      style={{ width: COL_WIDTH, height: ROW_HEIGHT }}
                      title={`${formatted} (click to copy)`}
                      onClick={() => handleCopyCell(value)}
                    >
                      <span
                        className={
                          value === null || value === undefined
                            ? 'text-[var(--color-text-muted)] italic text-[10px]'
                            : 'text-[var(--color-text-primary)]'
                        }
                      >
                        {formatted}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
