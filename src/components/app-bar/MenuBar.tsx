import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as echarts from 'echarts'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button, Logo } from '@/components/ui'
import { RadixDialog } from '@/components/ui/RadixDialog'
import { useDuckDB } from '@/lib/duckdb'
import { downloadAllAsZip, exportData } from '@/lib/export/exporter'
import { useCanvasToggle } from '@/lib/hooks/useCanvasToggle'
import { usePipeline } from '@/lib/pipeline'
import { clearDraft } from '@/lib/storage/idb'
import { useDialogStore, usePanelStore, usePipelineStore, useThemeStore } from '@/stores'
import { isTerminalNode } from '@/types'
import { MenuDivider } from './MenuDivider'
import { MenuDropdown } from './MenuDropdown'
import { MenuItem } from './MenuItem'
import { MenuSubmenu } from './MenuSubmenu'
import { AppearanceSubmenu, StyleSubmenu, ThemeSubmenu } from './ThemePicker'

interface MenuBarProps {
  onOpenFile: () => void
  onLoadSession: () => void
}

export function MenuBar({ onOpenFile, onLoadSession }: MenuBarProps) {
  const { client } = useDuckDB()
  const { activeNode, exportSession, clearAllData } = usePipeline()
  const nodes = usePipelineStore((state) => state.nodes)
  const { numberFormat, setNumberFormat } = useThemeStore()
  const { toggleSqlPanel, toggleProfile, showHomepage, setShowHomepage } = usePanelStore()
  const { openDialog } = useDialogStore()
  const { isCanvasMode, toggleCanvasMode } = useCanvasToggle()

  const [showAbout, setShowAbout] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const hasData = activeNode !== null

  const handleExport = async (format: 'csv' | 'parquet' | 'json' | 'jsonl') => {
    if (!client || !activeNode) return
    try {
      await exportData({
        client,
        tableName: activeNode.tableName,
        format,
        filename: activeNode.name,
      })
    } catch (err) {
      console.error('Export failed:', err)
    }
  }

  const handleClearSession = async () => {
    // Clear IndexedDB draft
    await clearDraft()
    // Clear all DuckDB tables and reset pipeline state
    await clearAllData()
    // Go to homepage
    setShowHomepage(true)
    setShowClearConfirm(false)
  }

  // Check if there are any terminal nodes (charts or exports)
  const terminalNodes = Object.values(nodes).filter((node) => isTerminalNode(node))
  const hasTerminalNodes = terminalNodes.length > 0

  const handleDownloadAll = async () => {
    if (!client) return

    // Collect chart data URLs from the DOM using ECharts API
    const chartDataUrls: Array<{ name: string; dataUrl: string }> = []
    const chartNodes = terminalNodes.filter((n) => n.type === 'chart')

    // Find all ECharts instances in the DOM (charts must be visible in canvas mode)
    const chartContainers = document.querySelectorAll('[_echarts_instance_]')
    const instances = Array.from(chartContainers)
      .map((el) => echarts.getInstanceByDom(el as HTMLElement))
      .filter((inst): inst is echarts.ECharts => inst !== undefined)

    // Match instances to chart nodes (best effort - uses order)
    for (let i = 0; i < chartNodes.length && i < instances.length; i++) {
      const instance = instances[i]
      try {
        const dataUrl = instance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' })
        chartDataUrls.push({ name: chartNodes[i].name, dataUrl })
      } catch {
        // Ignore errors
      }
    }

    try {
      await downloadAllAsZip({ client, nodes, chartDataUrls })
    } catch (err) {
      console.error('Download all failed:', err)
    }
  }

  return (
    <>
      <div className="flex items-center">
        {/* Logo button - clears session and goes to homepage */}
        <button
          onClick={() => setShowClearConfirm(true)}
          aria-label="Clear session and go to homepage"
          className="px-3 py-1.5 text-sm rounded transition-colors text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
        >
          <Logo size="sm" />
        </button>

        {/* File Menu */}
        <MenuDropdown label="File" small>
          <MenuItem label="Open file..." shortcut="CMD+O" onClick={onOpenFile} />
          <MenuItem label="Export session..." shortcut="CMD+SHIFT+S" onClick={exportSession} disabled={!hasData} />
          <MenuItem label="Load session..." onClick={onLoadSession} />
          <MenuDivider />
          <MenuSubmenu label="Export" disabled={!hasData}>
            <MenuItem label="CSV" onClick={() => handleExport('csv')} />
            <MenuItem label="JSON" onClick={() => handleExport('json')} />
            <MenuItem label="JSONL" onClick={() => handleExport('jsonl')} />
            <MenuItem label="Parquet" onClick={() => handleExport('parquet')} />
          </MenuSubmenu>
          <MenuItem label="Download All (ZIP)" onClick={handleDownloadAll} disabled={!hasTerminalNodes} />
          <MenuDivider />
          <MenuItem label="Share URL..." onClick={() => openDialog({ type: 'shareUrl' })} disabled={!hasData} />
          <MenuDivider />
          <MenuItem label="Clear session" onClick={() => setShowClearConfirm(true)} disabled={!hasData} danger />
        </MenuDropdown>

        {/* View Menu */}
        <MenuDropdown label="View" small>
          <MenuItem
            label="Table view"
            checked={!isCanvasMode}
            onClick={() => isCanvasMode && toggleCanvasMode()}
            disabled={!hasData || showHomepage}
          />
          <MenuItem
            label="Canvas view"
            checked={isCanvasMode}
            onClick={() => !isCanvasMode && toggleCanvasMode()}
            disabled={!hasData || showHomepage}
          />
          <MenuDivider />
          <MenuSubmenu label="Panels" disabled={!hasData || showHomepage}>
            <MenuItem label="SQL panel" shortcut="CMD+`" onClick={toggleSqlPanel} />
            <MenuItem label="Data profile" shortcut="CMD+SHIFT+P" onClick={toggleProfile} />
          </MenuSubmenu>
          <MenuDivider />
          <MenuSubmenu label="Theme">
            <ThemeSubmenu />
          </MenuSubmenu>
          <StyleSubmenu />
          <AppearanceSubmenu />
          <MenuDivider />
          <MenuSubmenu label="Number format">
            <DropdownMenu.Item
              onSelect={(e) => e.preventDefault()}
              className="w-full px-3 py-1.5 text-xs flex items-center justify-between gap-4 outline-none"
            >
              <span>Decimals</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setNumberFormat({ decimals: Math.max(0, numberFormat.decimals - 1) })}
                  disabled={numberFormat.decimals <= 0}
                  aria-label="Decrease decimal places"
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  −
                </button>
                <span className="w-4 text-center text-[var(--color-text-muted)]">{numberFormat.decimals}</span>
                <button
                  onClick={() => setNumberFormat({ decimals: Math.min(6, numberFormat.decimals + 1) })}
                  disabled={numberFormat.decimals >= 6}
                  aria-label="Increase decimal places"
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => setNumberFormat({ thousandsSeparator: !numberFormat.thousandsSeparator })}
              className="w-full px-3 py-1.5 text-xs flex items-center justify-between gap-4 outline-none hover:bg-[var(--color-bg-secondary)] focus:bg-[var(--color-bg-secondary)]"
            >
              <span>Thousands separator</span>
              <span className="text-xs text-[var(--color-text-muted)]">
                {numberFormat.thousandsSeparator ? 'On' : 'Off'}
              </span>
            </DropdownMenu.Item>
          </MenuSubmenu>
          <MenuDivider />
          <MenuItem
            label="Keyboard shortcuts"
            shortcut="CMD+?"
            onClick={() => openDialog({ type: 'shortcutCheatsheet' })}
          />
          <MenuItem label="About repere" onClick={() => setShowAbout(true)} />
        </MenuDropdown>
      </div>

      {/* About Modal */}
      {showAbout && (
        <RadixDialog
          open={true}
          onOpenChange={(open) => !open && setShowAbout(false)}
          title="About repere"
          width="sm"
          footer={
            <Button variant="secondary" size="md" onClick={() => setShowAbout(false)} className="w-full">
              Close
            </Button>
          }
        >
          <div className="mb-4">
            <Logo size="md" />
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-[var(--color-text-muted)]">Description</span>
              <div className="text-sm">In-browser data exploration for datasets too large for spreadsheets</div>
            </div>

            <div>
              <span className="text-[var(--color-text-muted)]">Author</span>
              <div className="text-sm">
                <a
                  href="https://mattismegevand.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-accent)] hover:underline"
                >
                  Mattis Megevand
                </a>
              </div>
            </div>

            <div>
              <span className="text-[var(--color-text-muted)]">Source code</span>
              <div className="text-sm">
                <a
                  href="https://github.com/mattismegevand/repere"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-accent)] hover:underline"
                >
                  github.com/mattismegevand/repere
                </a>
              </div>
            </div>

            <div className="pt-2 text-[var(--color-text-muted)]">Your data never leaves your browser</div>
          </div>
        </RadixDialog>
      )}

      {/* Clear Session Confirmation */}
      {showClearConfirm && (
        <ConfirmDialog
          title="Clear Session"
          message="This will permanently delete your current session and all unsaved data. This action cannot be undone."
          confirmLabel="Clear Session"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={handleClearSession}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}
    </>
  )
}
