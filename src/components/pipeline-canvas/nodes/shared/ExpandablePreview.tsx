import { useUpdateNodeInternals } from '@xyflow/react'
import { memo, useEffect } from 'react'
import type { Column } from '@/types'
import { MiniTable } from '../MiniTable'

interface ExpandablePreviewProps {
  nodeId: string
  isExpanded: boolean
  rows: Record<string, unknown>[]
  columns: Column[]
  loading: boolean
  error: string | null
}

export const ExpandablePreview = memo(function ExpandablePreview({
  nodeId,
  isExpanded,
  rows,
  columns,
  loading,
  error,
}: ExpandablePreviewProps) {
  const updateNodeInternals = useUpdateNodeInternals()

  // Notify React Flow after animation completes
  useEffect(() => {
    // Wait for CSS transition to complete (200ms) plus a small buffer
    const timeout = setTimeout(() => updateNodeInternals(nodeId), 220)
    return () => clearTimeout(timeout)
  }, [isExpanded, nodeId, updateNodeInternals])

  return (
    <div
      className="mx-3 overflow-hidden transition-[max-height,opacity] duration-200 ease-out"
      style={{
        maxHeight: isExpanded ? '130px' : '0px',
        opacity: isExpanded ? 1 : 0,
        maxWidth: '400px',
      }}
    >
      <div className="pt-2 pb-3 border-t border-[var(--color-border)]" style={{ height: '120px' }}>
        <MiniTable rows={rows} columns={columns} loading={loading} error={error} />
      </div>
    </div>
  )
})
