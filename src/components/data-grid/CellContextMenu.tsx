import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useGridColumnStore, useGridUIStore } from '@/components/data-grid/stores'
import { formatShortcut } from '@/lib/platform'
import { useGridActions } from './context'

export interface CellContextMenuState {
  x: number
  y: number
  row: number
  col: number
  colName: string
  value: unknown
}

const itemClass = 'menu-item w-full text-left flex justify-between'

export function CellContextMenu() {
  const menuRef = useRef<HTMLDivElement>(null)

  // Read menu state from store
  const contextMenu = useGridUIStore((s) => s.contextMenu)
  const closeAllMenus = useGridUIStore((s) => s.closeAllMenus)
  const isPinned = useGridColumnStore((s) => (contextMenu ? s.pinnedColumns.has(contextMenu.colName) : false))

  // Get actions from context
  const { copyCell, copyRowCsv, copyRowJson, filterByValue, hideColumn, togglePinColumn } = useGridActions()

  // Close on click outside or escape
  useEffect(() => {
    if (!contextMenu) return

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeAllMenus()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeAllMenus()
      }
    }

    // Use mousedown to close before any other click handlers fire
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [contextMenu, closeAllMenus])

  if (!contextMenu) return null

  const handleAction = (action: () => void) => {
    action()
    closeAllMenus()
  }

  return createPortal(
    <div
      ref={menuRef}
      className="popover-content py-1 min-w-44"
      style={{
        position: 'fixed',
        top: contextMenu.y,
        left: contextMenu.x,
        zIndex: 50,
      }}
    >
      <button type="button" onClick={() => handleAction(copyCell)} className={itemClass}>
        <span>Copy cell</span>
        <span className="text-xs text-[var(--color-text-muted)]">{formatShortcut('⌘C')}</span>
      </button>
      <button type="button" onClick={() => handleAction(copyRowCsv)} className={itemClass}>
        Copy row (CSV)
      </button>
      <button type="button" onClick={() => handleAction(copyRowJson)} className={itemClass}>
        Copy row (JSON)
      </button>

      <div className="h-px bg-[var(--color-border)] my-1" />

      <button type="button" onClick={() => handleAction(filterByValue)} className={itemClass}>
        Filter by value
      </button>
      <button type="button" onClick={() => handleAction(hideColumn)} className={itemClass}>
        Hide column
      </button>
      <button type="button" onClick={() => handleAction(togglePinColumn)} className={itemClass}>
        {isPinned ? 'Unpin column' : 'Pin column'}
      </button>
    </div>,
    document.body
  )
}
