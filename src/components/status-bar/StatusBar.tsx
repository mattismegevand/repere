import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3'
import Database from 'lucide-react/dist/esm/icons/database'
import Grid3X3 from 'lucide-react/dist/esm/icons/grid-3-x-3'
import Redo2 from 'lucide-react/dist/esm/icons/redo-2'
import Undo2 from 'lucide-react/dist/esm/icons/undo-2'
import Workflow from 'lucide-react/dist/esm/icons/workflow'
import { PythonIcon } from '@/components/icons/PythonIcon'
import { useCanvasToggle } from '@/lib/hooks/useCanvasToggle'
import { usePipeline } from '@/lib/pipeline/usePipeline'
import { usePanelStore } from '@/stores/panelStore'
import { DatasetDropdown } from './DatasetDropdown'
import { StatusBarButton } from './StatusBarButton'
import { StatusBarDivider } from './StatusBarDivider'
import { StatusBarItem } from './StatusBarItem'
import { StatusBarSection } from './StatusBarSection'

interface StatusBarProps {
  className?: string
  selectionStats?: {
    description: string
    count: number
    unique?: number
    sum?: number
    avg?: number
    median?: number
    min?: number | string
    max?: number | string
  } | null
}

export function StatusBar({ className = '', selectionStats }: StatusBarProps) {
  const { activeNode, canUndo, canRedo, undo, redo, undoDescription, redoDescription } = usePipeline()
  const activeEditingPanel = usePanelStore((s) => s.activeEditingPanel)
  const toggleSqlPanel = usePanelStore((s) => s.toggleSqlPanel)
  const togglePythonPanel = usePanelStore((s) => s.togglePythonPanel)
  const profileOpen = usePanelStore((s) => s.profileOpen)
  const toggleProfile = usePanelStore((s) => s.toggleProfile)
  const { isCanvasMode, toggleCanvasMode } = useCanvasToggle()

  // Derive panel states from discriminated union
  const sqlPanelOpen = activeEditingPanel.type === 'sql'
  const pythonPanelOpen = activeEditingPanel.type === 'python'

  // Don't render on homepage (no active node)
  if (!activeNode) return null

  return (
    <div
      className={`h-[22px] flex items-center text-[11px] bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)] px-2 ${className}`}
    >
      {/* Left: Mode Toggle */}
      <StatusBarSection position="left">
        <StatusBarButton
          onClick={toggleCanvasMode}
          tooltip={isCanvasMode ? 'Switch to Table view' : 'Switch to Canvas view'}
        >
          {isCanvasMode ? (
            <>
              <Workflow className="w-3.5 h-3.5" />
              <span>Canvas</span>
            </>
          ) : (
            <>
              <Grid3X3 className="w-3.5 h-3.5" />
              <span>Table</span>
            </>
          )}
        </StatusBarButton>
      </StatusBarSection>

      {/* Center: Current Node Info & Selection Stats */}
      <StatusBarSection position="center">
        <StatusBarItem>
          <span className="text-[var(--color-text-secondary)]">
            {typeof activeNode.rowCount === 'number' ? activeNode.rowCount.toLocaleString() : '...'} rows
          </span>
        </StatusBarItem>
        <StatusBarItem>
          <span className="text-[var(--color-text-secondary)]">{activeNode.columns?.length ?? 0} cols</span>
        </StatusBarItem>

        {selectionStats && (
          <>
            <StatusBarDivider />
            <StatusBarItem className="text-[var(--color-accent)]">{selectionStats.description}</StatusBarItem>
            <StatusBarItem>Count: {selectionStats.count}</StatusBarItem>
            {selectionStats.unique !== undefined ? (
              <StatusBarItem>Unique: {selectionStats.unique}</StatusBarItem>
            ) : null}
            {selectionStats.sum !== undefined && (
              <StatusBarItem>Sum: {selectionStats.sum.toLocaleString()}</StatusBarItem>
            )}
            {selectionStats.avg !== undefined ? (
              <StatusBarItem>Avg: {selectionStats.avg.toFixed(2)}</StatusBarItem>
            ) : null}
          </>
        )}
      </StatusBarSection>

      {/* Right: Actions & Status */}
      <StatusBarSection position="right">
        {/* Pipeline stats - clickable to jump to datasets/views */}
        <DatasetDropdown />

        <StatusBarDivider />

        {/* Undo/Redo */}
        <StatusBarButton
          onClick={undo}
          disabled={!canUndo}
          tooltip={canUndo ? `${undoDescription} (Cmd+Z)` : 'Nothing to undo'}
        >
          <Undo2 className="w-3.5 h-3.5" />
        </StatusBarButton>
        <StatusBarButton
          onClick={redo}
          disabled={!canRedo}
          tooltip={canRedo ? `${redoDescription} (Cmd+Shift+Z)` : 'Nothing to redo'}
        >
          <Redo2 className="w-3.5 h-3.5" />
        </StatusBarButton>

        <StatusBarDivider />

        {/* Profile toggle */}
        <StatusBarButton onClick={toggleProfile} active={profileOpen} tooltip="Toggle data profile (Cmd+Shift+P)">
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Profile</span>
        </StatusBarButton>

        {/* SQL toggle */}
        <StatusBarButton onClick={toggleSqlPanel} active={sqlPanelOpen} tooltip="Toggle SQL panel (Cmd+`)">
          <Database className="w-3.5 h-3.5" />
          <span>SQL</span>
        </StatusBarButton>

        {/* Python toggle */}
        <StatusBarButton onClick={togglePythonPanel} active={pythonPanelOpen} tooltip="Toggle Python panel">
          <PythonIcon className="w-3.5 h-3.5" />
          <span>Python</span>
        </StatusBarButton>
      </StatusBarSection>
    </div>
  )
}
