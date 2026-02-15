import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MiniTable } from '@/components/pipeline-canvas/nodes/MiniTable'
import { useDuckDB } from '@/lib/duckdb'
import type { HydratedNode } from '@/lib/pipeline/hydration'

interface TableOptionWithPreviewProps {
  node: HydratedNode
  selected: boolean
  onSelect: () => void
  inputType: 'radio' | 'checkbox'
  inputName?: string
}

function escapeIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

function getNodeBadge(node: HydratedNode) {
  const isDataset = node.type === 'dataset'
  return (
    <span className="flex items-center gap-2">
      <span
        className={`text-[10px] font-medium px-1 py-0.5 rounded ${
          isDataset ? 'bg-blue-500/10 text-blue-600' : 'bg-purple-500/10 text-purple-600'
        }`}
      >
        {isDataset ? 'D' : 'V'}
      </span>
      <span className="truncate">{node.name}</span>
      <span className="text-[var(--color-text-muted)] text-[10px]">
        {node.columns?.length ?? 0} cols · {node.rowCount?.toLocaleString() ?? '?'} rows
      </span>
    </span>
  )
}

export function TableOptionWithPreview({
  node,
  selected,
  onSelect,
  inputType,
  inputName,
}: TableOptionWithPreviewProps) {
  const { client } = useDuckDB()
  const [isHovered, setIsHovered] = useState(false)
  const [previewData, setPreviewData] = useState<{
    rows: Record<string, unknown>[]
    loading: boolean
    error: string | null
  }>({ rows: [], loading: false, error: null })
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const labelRef = useRef<HTMLLabelElement>(null)
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 })

  // Fetch preview data when hovering
  useEffect(() => {
    if (!isHovered || !client || !node.tableName) {
      setPreviewData({ rows: [], loading: false, error: null })
      return
    }

    setPreviewData((p) => ({ ...p, loading: true, error: null }))
    const tableName = node.tableName
    if (!tableName) return

    const fetchPreview = async () => {
      try {
        const query = `SELECT * FROM ${escapeIdentifier(tableName)} LIMIT 10`
        const result = await client.query(query)
        setPreviewData({ rows: result.rows, loading: false, error: null })
      } catch (err) {
        setPreviewData({
          rows: [],
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load preview',
        })
      }
    }

    fetchPreview()
  }, [isHovered, client, node.tableName])

  const handleMouseEnter = () => {
    // Cancel any pending close
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }

    // Small delay before showing preview to avoid flicker
    hoverTimeoutRef.current = setTimeout(() => {
      if (labelRef.current) {
        const rect = labelRef.current.getBoundingClientRect()
        const popoverWidth = 320
        const popoverHeight = 180

        // Position to the right by default
        let left = rect.right + 8
        let top = rect.top

        // If would overflow right edge, position to the left
        if (left + popoverWidth > window.innerWidth - 16) {
          left = rect.left - popoverWidth - 8
        }

        // If would overflow bottom, adjust top
        if (top + popoverHeight > window.innerHeight - 16) {
          top = window.innerHeight - popoverHeight - 16
        }

        // Ensure not above viewport
        if (top < 16) {
          top = 16
        }

        setPopoverPosition({ top, left })
      }
      setIsHovered(true)
    }, 200)
  }

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    // Delay closing to allow moving to the popover
    closeTimeoutRef.current = setTimeout(() => {
      setIsHovered(false)
    }, 100)
  }

  const handlePopoverEnter = () => {
    // Cancel pending close when entering popover
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
  }

  const handlePopoverLeave = () => {
    // Close immediately when leaving popover
    setIsHovered(false)
  }

  return (
    <div className="relative">
      <label
        ref={labelRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors text-sm ${
          selected
            ? 'bg-[var(--color-accent-bg)] border border-[var(--color-accent)]'
            : 'hover:bg-[var(--color-bg-secondary)] border border-transparent'
        }`}
      >
        <input
          type={inputType}
          name={inputName}
          checked={selected}
          onChange={onSelect}
          className={inputType === 'checkbox' ? 'rounded accent-[var(--color-accent)]' : 'sr-only'}
        />
        <span className="flex-1">{getNodeBadge(node)}</span>
      </label>

      {/* Hover preview popover - using portal to escape overflow clipping */}
      {isHovered &&
        createPortal(
          <div
            className="fixed z-[100] bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg shadow-lg overflow-hidden"
            style={{ top: popoverPosition.top, left: popoverPosition.left, width: 320, height: 180 }}
            onMouseEnter={handlePopoverEnter}
            onMouseLeave={handlePopoverLeave}
          >
            <div className="px-2 py-1.5 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <span className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
                Preview: {node.name}
              </span>
            </div>
            <div style={{ height: 'calc(100% - 28px)' }}>
              <MiniTable
                rows={previewData.rows}
                columns={node.columns ?? []}
                loading={previewData.loading}
                error={previewData.error}
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
