import { Command } from 'cmdk'
import { useMemo, useState } from 'react'
import { useDuckDB } from '@/lib/duckdb'
import { isSessionFile, pickFiles } from '@/lib/file-system'
import { usePipeline } from '@/lib/pipeline/usePipeline'
import { formatShortcut } from '@/lib/platform'
import { useDialogStore, usePanelStore, usePipelineStore } from '@/stores'
import { isTerminalNode } from '@/types'
import { useCommandPalette } from '../CommandPaletteContext'

const MAX_VISIBLE_NODES = 5

const groupHeadingClass =
  'mb-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-[var(--color-text-muted)] [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5'

const itemClass =
  'px-2 py-2 cursor-pointer text-sm rounded-md hover:bg-[var(--color-bg-secondary)] data-[selected=true]:bg-[var(--color-accent-bg)] data-[selected=true]:text-[var(--color-text-primary)]'

const itemWithShortcutClass = `${itemClass} flex justify-between items-center`

export function RootPage() {
  const { client } = useDuckDB()
  const { openDialog } = useDialogStore()
  const { openPivotPanel, toggleSqlPanel, setCanvasMode } = usePanelStore()
  const { close, pushPage } = useCommandPalette()
  const { activeNodeId, nodes, loadDatasetFromPicked, openTab, exportSession, loadSession } = usePipeline()
  const nodeViewTimes = usePipelineStore((s) => s.nodeViewTimes)

  const [showAllNodes, setShowAllNodes] = useState(false)

  // Sort nodes by most recently viewed
  const sortedNodes = useMemo(() => {
    return Object.values(nodes).sort((a, b) => {
      const timeA = nodeViewTimes[a.id] ?? 0
      const timeB = nodeViewTimes[b.id] ?? 0
      return timeB - timeA // Most recent first
    })
  }, [nodes, nodeViewTimes])

  const nodeCount = sortedNodes.length
  const hasMoreNodes = nodeCount > MAX_VISIBLE_NODES
  const visibleNodes = showAllNodes || !hasMoreNodes ? sortedNodes : sortedNodes.slice(0, MAX_VISIBLE_NODES)

  const handleOpenFile = async () => {
    if (!client) return
    close()
    const pickedFiles = await pickFiles()
    if (!pickedFiles.length) return
    const picked = pickedFiles[0]
    // Skip session files, use "Load session" instead
    if (isSessionFile(picked)) return
    await loadDatasetFromPicked(picked)
  }

  const handleExportSession = async () => {
    close()
    await exportSession()
  }

  const handleLoadSession = async () => {
    close()
    const result = await loadSession()
    if (result.needsFiles) {
      openDialog({ type: 'loadSession' })
    }
  }

  return (
    <>
      {/* Go to - Navigation is primary use case */}
      {nodeCount > 1 && (
        <Command.Group heading="Go to" className={groupHeadingClass}>
          {visibleNodes.map((node) => {
            const handleSelect = () => {
              close()
              if (node.type === 'chart') {
                setCanvasMode(true)
                openDialog({ type: 'chartModal', nodeId: node.id })
              } else if (node.type === 'export') {
                setCanvasMode(true)
              } else {
                openTab(node.id)
              }
            }

            const getTypeBadge = () => {
              if (node.type === 'dataset') return { label: 'Dataset', className: 'bg-blue-500/10 text-blue-600' }
              if (node.type === 'chart') return { label: 'Chart', className: 'bg-orange-500/10 text-orange-600' }
              if (node.type === 'export') return { label: 'Export', className: 'bg-green-500/10 text-green-600' }
              return { label: 'View', className: 'bg-purple-500/10 text-purple-600' }
            }

            const badge = getTypeBadge()

            return (
              <Command.Item key={node.id} onSelect={handleSelect} className={itemWithShortcutClass}>
                <span className="flex items-center gap-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${badge.className}`}>{badge.label}</span>
                  {node.name}
                </span>
                {node.id === activeNodeId && !isTerminalNode(node) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />
                )}
              </Command.Item>
            )
          })}
          {hasMoreNodes && (
            <Command.Item
              onSelect={() => setShowAllNodes(!showAllNodes)}
              className={`${itemClass} text-[var(--color-text-muted)]`}
            >
              {showAllNodes ? 'Show less' : `Show all ${nodeCount} nodes...`}
            </Command.Item>
          )}
        </Command.Group>
      )}

      {/* Transform - Contextual operations */}
      {activeNodeId && (
        <Command.Group heading="Transform" className={groupHeadingClass}>
          <Command.Item onSelect={() => pushPage({ type: 'filter' })} className={itemWithShortcutClass}>
            <span>Filter</span>
            <span className="text-xs text-[var(--color-text-muted)]">f</span>
          </Command.Item>
          <Command.Item onSelect={() => pushPage({ type: 'sort' })} className={itemWithShortcutClass}>
            <span>Sort</span>
            <span className="text-xs text-[var(--color-text-muted)]">s</span>
          </Command.Item>
          <Command.Item
            onSelect={() => {
              close()
              if (activeNodeId) {
                openPivotPanel(activeNodeId)
              }
            }}
            className={itemClass}
          >
            Group by / Pivot
          </Command.Item>
          <Command.Item
            onSelect={() => {
              close()
              openDialog({ type: 'addColumn' })
            }}
            className={itemClass}
          >
            Add column
          </Command.Item>
          <Command.Item
            onSelect={() => {
              close()
              openDialog({ type: 'window' })
            }}
            className={itemClass}
          >
            Window function
          </Command.Item>
          <Command.Item
            onSelect={() => {
              close()
              toggleSqlPanel()
            }}
            className={itemClass}
          >
            Custom SQL
          </Command.Item>
        </Command.Group>
      )}

      {/* File - Global actions */}
      <Command.Group heading="File" className={groupHeadingClass}>
        <Command.Item onSelect={handleOpenFile} className={itemWithShortcutClass}>
          <span>Open file</span>
          <span className="text-xs text-[var(--color-text-muted)]">{formatShortcut('⌘O')}</span>
        </Command.Item>
        {nodeCount > 0 && (
          <Command.Item onSelect={handleExportSession} className={itemWithShortcutClass}>
            <span>Export session</span>
            <span className="text-xs text-[var(--color-text-muted)]">{formatShortcut('⌘⇧S')}</span>
          </Command.Item>
        )}
        <Command.Item onSelect={handleLoadSession} className={itemClass}>
          Load session
        </Command.Item>
      </Command.Group>
    </>
  )
}
