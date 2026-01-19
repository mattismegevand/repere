import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useDuckDB } from '@/lib/duckdb'
import { type ColumnStats, profileDataset } from '@/lib/profiling'
import { type CorrelationMatrix as CorrelationData, computeCorrelationMatrix } from '@/lib/profiling/correlation'
import { selectActiveNode, usePanelStore, usePipelineStore, useThemeStore } from '@/stores'
import { ColumnCard } from './ColumnCard'
import { CorrelationMatrix } from './CorrelationMatrix'

interface CollapsibleSectionProps {
  title: string
  count?: number
  defaultOpen?: boolean
  children: React.ReactNode
}

function CollapsibleSection({ title, count, defaultOpen = true, children }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 w-full text-left mb-2 group"
      >
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
        )}
        <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)]">
          {title}
        </span>
        {count !== undefined && <span className="text-[10px] text-[var(--color-text-muted)] ml-auto">{count}</span>}
      </button>
      {isOpen && children}
    </div>
  )
}

export function ProfilePanel() {
  const { client } = useDuckDB()
  const activeNode = usePipelineStore(selectActiveNode)
  const activeNodeId = usePipelineStore((s) => s.activeNodeId)
  const { profileOpen, toggleProfile, profilePanelWidth, setProfilePanelWidth, setCanvasMode, openChartPanel } =
    usePanelStore()
  const structureStyle = useThemeStore((s) => s.structureStyle)
  const isClassic = structureStyle === 'classic'
  const [stats, setStats] = useState<ColumnStats[]>([])
  const [correlations, setCorrelations] = useState<CorrelationData | null>(null)
  const [loading, setLoading] = useState(false)
  const [isResizing, setIsResizing] = useState(false)

  const handleCreateCorrelationChart = useCallback(() => {
    if (!activeNodeId) return
    setCanvasMode(true)
    setTimeout(() => {
      openChartPanel(activeNodeId, undefined, { x: window.innerWidth / 2, y: 100 }, 'correlationMatrix')
    }, 50)
  }, [activeNodeId, setCanvasMode, openChartPanel])

  // Refresh stats when activeNode changes (use activeNodeId to detect changes reliably)
  useEffect(() => {
    if (!client || !activeNode || !profileOpen) return

    setLoading(true)
    Promise.all([
      profileDataset(client, activeNode.tableName, activeNode.columns),
      computeCorrelationMatrix(client, activeNode.tableName, activeNode.columns),
    ])
      .then(([columnStats, corrMatrix]) => {
        setStats(columnStats)
        setCorrelations(corrMatrix)
      })
      .finally(() => setLoading(false))
  }, [client, activeNodeId, profileOpen]) // Use activeNodeId instead of activeNode for reliable change detection

  // Handle resize drag
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsResizing(true)
      const startX = e.clientX
      const startWidth = profilePanelWidth

      const handleMouseMove = (e: MouseEvent) => {
        // Moving left increases width (panel is on right side)
        const delta = startX - e.clientX
        setProfilePanelWidth(startWidth + delta)
      }

      const handleMouseUp = () => {
        setIsResizing(false)
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [profilePanelWidth, setProfilePanelWidth]
  )

  if (!profileOpen) return null
  if (!activeNode) return null

  const numericColumns = stats.filter((s) => s.type === 'number')
  const stringColumns = stats.filter((s) => s.type === 'string')
  const otherColumns = stats.filter((s) => s.type !== 'number' && s.type !== 'string')

  return (
    <div
      className={`bg-[var(--color-bg-primary)] flex flex-col h-full shrink-0 border border-[var(--color-border)] overflow-hidden relative ${isClassic ? '' : 'ml-2 rounded-lg'}`}
      style={{ width: profilePanelWidth }}
    >
      {/* Resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-[var(--color-accent)]/20 transition-colors z-10 flex items-center"
        onMouseDown={handleResizeStart}
        style={{ userSelect: isResizing ? 'none' : undefined }}
      >
        <div className="w-0.5 h-8 rounded-full bg-[var(--color-border)] ml-0.5 opacity-0 hover:opacity-100 transition-opacity" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border)] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide">Data Profile</span>
          {activeNode && (
            <span className="text-[10px] text-[var(--color-text-muted)] truncate max-w-[120px]">{activeNode.name}</span>
          )}
        </div>
        <button
          type="button"
          onClick={toggleProfile}
          className="p-1 rounded hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]"
          aria-label="Close profile panel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Summary bar */}
      {!loading && (
        <div className="px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] shrink-0">
          <div className="flex items-center gap-4 text-[10px]">
            <div>
              <span className="text-[var(--color-text-muted)]">Rows</span>
              <span className="ml-1.5 font-medium">{activeNode.rowCount?.toLocaleString() ?? '-'}</span>
            </div>
            <div>
              <span className="text-[var(--color-text-muted)]">Columns</span>
              <span className="ml-1.5 font-medium">{stats.length}</span>
            </div>
            {numericColumns.length > 0 && (
              <div>
                <span className="text-[var(--color-text-muted)]">Numeric</span>
                <span className="ml-1.5 font-medium">{numericColumns.length}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-xs text-[var(--color-text-muted)]">Computing statistics...</div>
        </div>
      ) : (
        <div className={`flex-1 overflow-auto ${isClassic ? '' : 'p-3'}`}>
          {/* Numeric columns */}
          {numericColumns.length > 0 && (
            <CollapsibleSection title="Numeric Columns" count={numericColumns.length}>
              <div className="space-y-2">
                {numericColumns.map((s) => (
                  <ColumnCard key={s.column} stats={s} compact />
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* String columns */}
          {stringColumns.length > 0 && (
            <CollapsibleSection title="Text Columns" count={stringColumns.length}>
              <div className="space-y-2">
                {stringColumns.map((s) => (
                  <ColumnCard key={s.column} stats={s} compact />
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Other columns */}
          {otherColumns.length > 0 && (
            <CollapsibleSection title="Other Columns" count={otherColumns.length}>
              <div className="space-y-2">
                {otherColumns.map((s) => (
                  <ColumnCard key={s.column} stats={s} compact />
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Correlation Matrix */}
          {correlations && correlations.columns.length >= 2 && (
            <CollapsibleSection title="Correlations" defaultOpen={correlations.columns.length <= 6}>
              <div className="bg-[var(--color-bg-secondary)] rounded-lg p-2 -mx-1">
                <CorrelationMatrix data={correlations} panelWidth={profilePanelWidth} />
                <div className="mt-2 pt-2 border-t border-[var(--color-border)] flex justify-end">
                  <button
                    type="button"
                    onClick={handleCreateCorrelationChart}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-bg)] rounded transition-colors"
                    title="Create correlation chart on canvas"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Create chart</span>
                  </button>
                </div>
              </div>
            </CollapsibleSection>
          )}
        </div>
      )}
    </div>
  )
}
