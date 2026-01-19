import { RadixDialog } from '@/components/ui/RadixDialog'
import { formatShortcut } from '@/lib/platform'

interface Props {
  onClose: () => void
}

const SHORTCUTS = [
  {
    category: 'General',
    shortcuts: [
      { keys: 'CMD+K or :', action: 'Open command palette' },
      { keys: 'CMD+O', action: 'Open file' },
      { keys: 'CMD+S', action: 'Save session' },
      { keys: 'CMD+Z or u', action: 'Undo' },
      { keys: 'CMD+SHIFT+Z or CTRL+r', action: 'Redo' },
      { keys: 'TAB', action: 'Toggle canvas/table view' },
      { keys: 'ESC', action: 'Close dialogs / Clear search' },
      { keys: 'CMD+? or ?', action: 'Show this cheatsheet' },
      { keys: 'CMD+`', action: 'Toggle SQL panel' },
      { keys: 'CMD+[', action: 'Previous tab' },
      { keys: 'CMD+]', action: 'Next tab' },
      { keys: '1-9', action: 'Jump to tab by number' },
    ],
  },
  {
    category: 'Data grid',
    shortcuts: [
      { keys: '↑↓←→ or hjkl', action: 'Navigate cells' },
      { keys: 'w / b', action: 'Next/prev column' },
      { keys: 'SHIFT+↑↓←→', action: 'Extend selection' },
      { keys: 'v', action: 'Visual selection mode (y to copy)' },
      { keys: 'V', action: 'Select entire row' },
      { keys: 'CMD+A', action: 'Select all cells' },
      { keys: 'PAGE UP/DOWN', action: 'Jump 20 rows' },
      { keys: 'CTRL+d / CTRL+u', action: 'Half-page down/up' },
      { keys: 'HOME/END or 0/$', action: 'Jump to first/last column' },
      { keys: 'CMD+HOME or gg', action: 'Jump to first cell' },
      { keys: 'CMD+END or G', action: 'Jump to last row' },
      { keys: ':number', action: 'Jump to row number' },
      { keys: 'CMD+C', action: 'Copy selection' },
      { keys: 'CMD+V', action: 'Paste into cell' },
      { keys: 'CMD+F or /', action: 'Focus search' },
      { keys: 'e / ENTER / F2', action: 'Edit cell' },
      { keys: 'RIGHT-CLICK', action: 'Context menu' },
    ],
  },
  {
    category: 'Column operations',
    shortcuts: [
      { keys: 's', action: 'Sort column (toggle asc/desc)' },
      { keys: 'S', action: 'Sort column descending' },
      { keys: 'f', action: 'Open column filter' },
      { keys: 'p', action: 'Pin/unpin column' },
      { keys: 'H', action: 'Hide column' },
    ],
  },
  {
    category: 'Row & view',
    shortcuts: [
      { keys: 'CMD+SHIFT+C or yy', action: 'Copy row as CSV' },
      { keys: 'c', action: 'Open chart panel (→ canvas)' },
      { keys: 'CMD+SHIFT+P', action: 'Toggle data profile panel' },
      { keys: 'r', action: 'Refresh data' },
      { keys: 'x', action: 'Export view' },
    ],
  },
  {
    category: 'Canvas view',
    shortcuts: [
      { keys: '↑↓←→ or hjkl', action: 'Navigate nodes' },
      { keys: 'gg', action: 'Jump to first node' },
      { keys: 'G', action: 'Jump to last node' },
      { keys: '+/-', action: 'Zoom in/out' },
      { keys: 'e / ENTER', action: 'Open node (table/download/chart)' },
      { keys: 't', action: 'Switch to table view' },
      { keys: 'f or SPACE', action: 'Fit view (zoom to see all)' },
      { keys: 'DEL / BACKSPACE', action: 'Delete selected node' },
    ],
  },
  {
    category: 'Column header (mouse)',
    shortcuts: [
      { keys: 'CLICK', action: 'Sort ascending' },
      { keys: 'CLICK (sorted)', action: 'Toggle sort direction' },
      { keys: 'SHIFT+CLICK', action: 'Multi-column sort' },
      { keys: 'F BUTTON', action: 'Open column filter' },
    ],
  },
]

export function ShortcutCheatsheet({ onClose }: Props) {
  return (
    <RadixDialog
      open={true}
      onOpenChange={(open) => !open && onClose()}
      title="Keyboard shortcuts"
      width="2xl"
      showCloseButton
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {SHORTCUTS.map((section) => (
          <div key={section.category}>
            <h3 className="text-xs font-medium text-[var(--color-text-muted)] mb-2">{section.category}</h3>
            <div className="space-y-1">
              {section.shortcuts.map(({ keys, action }) => (
                <div key={keys} className="flex justify-between text-xs py-1">
                  <span className="text-[var(--color-text-muted)] font-mono bg-[var(--color-bg-secondary)] px-1.5 py-0.5 rounded border border-[var(--color-border)]">
                    {formatShortcut(keys)}
                  </span>
                  <span className="text-[var(--color-text-secondary)]">{action}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-[var(--color-border)]">
        <p className="text-[10px] text-[var(--color-text-muted)]">
          Tip: Use {formatShortcut('CMD+K')} to access all commands and operations
        </p>
      </div>
    </RadixDialog>
  )
}
