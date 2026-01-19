import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { formatCell } from '@/lib/formatters'
import type { Column } from '@/types'

const ROW_HEIGHT = 22
const HEADER_HEIGHT = 26
const INDEX_COL_WIDTH = 32
const MIN_COL_WIDTH = 60
const MAX_COL_WIDTH = 120

interface Props {
  rows: Record<string, unknown>[]
  columns: Column[]
  loading: boolean
  error: string | null
}

function isNumericType(type: string): boolean {
  const t = type.toUpperCase()
  return t.includes('INT') || t.includes('FLOAT') || t.includes('DOUBLE') || t.includes('DECIMAL') || t.includes('NUM')
}

function getColumnWidth(col: Column, rows: Record<string, unknown>[]): number {
  // Estimate width based on column name and sample values
  const nameLen = col.name.length
  const isNum = isNumericType(col.type)

  // Sample first few rows to estimate content width
  let maxContentLen = nameLen
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const val = rows[i]?.[col.name]
    const formatted = formatCell(val, col.type)
    maxContentLen = Math.max(maxContentLen, formatted.length)
  }

  // Character width estimate (monospace-ish)
  const charWidth = isNum ? 7 : 6.5
  const estimated = maxContentLen * charWidth + 16 // padding

  return Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, estimated))
}

export const MiniTable = memo(function MiniTable({ rows, columns, loading, error }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(150)

  // Track viewport size with ResizeObserver
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height ?? 150
      setViewportHeight(height)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    e.stopPropagation()
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation()
  }, [])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-[var(--color-text-muted)]">
        <div className="animate-pulse">Loading preview...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-red-500 px-2 text-center" title={error}>
        {error.length > 50 ? `${error.slice(0, 50)}...` : error}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-[var(--color-text-muted)]">
        No rows to display
      </div>
    )
  }

  // Calculate column widths
  const colWidths = columns.map((col) => getColumnWidth(col, rows))
  const totalWidth = INDEX_COL_WIDTH + colWidths.reduce((a, b) => a + b, 0)

  // Virtual scrolling
  const bodyHeight = Math.max(0, viewportHeight - HEADER_HEIGHT)
  const totalHeight = rows.length * ROW_HEIGHT
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 3)
  const endIndex = Math.min(rows.length, Math.ceil((scrollTop + bodyHeight) / ROW_HEIGHT) + 3)
  const visibleRows = rows.slice(startIndex, endIndex)
  const offsetY = startIndex * ROW_HEIGHT

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-auto nopan nowheel nodrag rounded-sm border border-[var(--color-border)] mini-table-scroll"
      onScroll={handleScroll}
      onWheel={handleWheel}
    >
      <div style={{ width: totalWidth }}>
        {/* Sticky header */}
        <div
          className="flex border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)]"
          style={{ height: HEADER_HEIGHT, position: 'sticky', top: 0, zIndex: 10 }}
        >
          {/* Index column header */}
          <div
            className="flex-shrink-0 px-1 text-[10px] font-medium text-[var(--color-text-muted)] border-r border-[var(--color-border)] flex items-center justify-center"
            style={{ width: INDEX_COL_WIDTH }}
          >
            #
          </div>
          {columns.map((col, i) => (
            <div
              key={col.name}
              className="flex-shrink-0 px-2 text-[10px] font-semibold text-[var(--color-text-secondary)] truncate flex items-center"
              style={{ width: colWidths[i] }}
              title={`${col.name} (${col.type})`}
            >
              {col.name}
            </div>
          ))}
        </div>

        {/* Virtual rows */}
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div style={{ position: 'absolute', top: offsetY, left: 0, right: 0 }}>
            {visibleRows.map((row, i) => {
              const idx = startIndex + i
              return (
                <div
                  key={idx}
                  className={`flex ${idx % 2 === 0 ? 'bg-[var(--color-bg-primary)]' : 'bg-[var(--color-bg-secondary)]'} hover:bg-[var(--color-accent-bg)]`}
                  style={{ height: ROW_HEIGHT }}
                >
                  {/* Row index */}
                  <div
                    className="flex-shrink-0 px-1 text-[10px] text-[var(--color-text-muted)] border-r border-[var(--color-border)]/50 flex items-center justify-center tabular-nums"
                    style={{ width: INDEX_COL_WIDTH }}
                  >
                    {idx + 1}
                  </div>
                  {columns.map((col, colIdx) => {
                    const value = row[col.name]
                    const isNull = value === null || value === undefined
                    const formatted = formatCell(value, col.type)
                    const isNum = isNumericType(col.type)
                    return (
                      <div
                        key={col.name}
                        className={`flex-shrink-0 px-2 text-[11px] truncate flex items-center ${
                          isNull ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-secondary)]'
                        } ${isNum ? 'tabular-nums' : ''}`}
                        style={{ width: colWidths[colIdx] }}
                        title={formatted}
                      >
                        {formatted}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
})
