import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useGridColumnStore, useGridUIStore } from '@/components/data-grid/stores'
import {
  DATE_BUCKET_LABELS,
  DATE_DIFF_LABELS,
  DATE_PART_LABELS,
  type DateBucket,
  type DateDiffUnit,
  type DatePart,
  isDateTimeType,
  supportsBucketing,
  supportsTimeExtraction,
} from '@/lib/date-helpers'
import { useThemeStore } from '@/stores/themeStore'
import type { Column } from '@/types'
import { useGridActions } from './context'

export interface ColumnHeaderMenuState {
  x: number
  y: number
  colName: string
  colType: Column['type']
}

const itemClass = 'menu-item w-full text-left'
const subTriggerClass =
  'menu-item w-full text-left flex justify-between data-[state=open]:bg-[var(--color-bg-secondary)]'
const subContentClass = 'popover-content min-w-32 py-1'

export function ColumnHeaderMenu() {
  const menuRef = useRef<HTMLDivElement>(null)

  // Read menu state from store
  const menu = useGridUIStore((s) => s.columnHeaderMenu)
  const closeAllMenus = useGridUIStore((s) => s.closeAllMenus)
  const isPinned = useGridColumnStore((s) => (menu ? s.pinnedColumns.has(menu.colName) : false))

  // Read number format from theme store
  const numberFormat = useThemeStore((s) => s.numberFormat)
  const columnNumberFormats = useThemeStore((s) => s.columnNumberFormats)

  // Get actions from context
  const {
    sortAsc,
    sortDesc,
    openFilter,
    hideHeaderColumn,
    togglePinHeaderColumn,
    setDecimals,
    toggleThousandsSeparator,
    resetFormat,
    renameColumn,
    dropColumn,
    dateBucket,
    dateExtract,
    dateParse,
    dateDiff,
    dateAdd,
    openWindowFunction,
  } = useGridActions()

  // Close on click outside or escape
  useEffect(() => {
    if (!menu) return

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

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menu, closeAllMenus])

  // Calculate position to ensure menu stays within viewport
  const position = useMemo(() => {
    if (!menu) return { x: 0, y: 0 }

    const menuWidth = 192
    const menuHeight = 400
    const padding = 8

    let x = menu.x
    let y = menu.y

    if (x + menuWidth > window.innerWidth - padding) {
      x = window.innerWidth - menuWidth - padding
    }
    if (x < padding) x = padding
    if (y + menuHeight > window.innerHeight - padding) {
      y = window.innerHeight - menuHeight - padding
    }
    if (y < padding) y = padding

    return { x, y }
  }, [menu])

  if (!menu) return null

  const hasNumberFormatOverride = menu.colName in columnNumberFormats
  const override = columnNumberFormats[menu.colName]
  const effectiveFormat = override ? { ...numberFormat, ...override } : numberFormat
  const isDateTime = isDateTimeType(menu.colType)
  const canBucket = supportsBucketing(menu.colType)
  const canExtractTime = supportsTimeExtraction(menu.colType)
  const isString = menu.colType === 'string'
  const isBlob = menu.colType === 'blob'

  return createPortal(
    <div
      ref={menuRef}
      className="popover-content py-1 min-w-48"
      style={{
        position: 'fixed',
        top: position.y,
        left: position.x,
        zIndex: 50,
      }}
    >
      {/* Header */}
      <div className="px-3 py-2 text-xs text-[var(--color-text-muted)] border-b border-[var(--color-border)] mb-1">
        <span className="font-medium text-[var(--color-text-primary)]">{menu.colName}</span>
        <span className="ml-2">{menu.colType}</span>
      </div>

      {!isBlob && (
        <>
          <button type="button" onClick={sortAsc} className={itemClass}>
            Sort ascending
          </button>
          <button type="button" onClick={sortDesc} className={itemClass}>
            Sort descending
          </button>
          <div className="h-px bg-[var(--color-border)] my-1" />
          <button type="button" onClick={openFilter} className={itemClass}>
            Filter...
          </button>
          <div className="h-px bg-[var(--color-border)] my-1" />
        </>
      )}

      <button type="button" onClick={hideHeaderColumn} className={itemClass}>
        Hide column
      </button>
      <button type="button" onClick={togglePinHeaderColumn} className={itemClass}>
        {isPinned ? 'Unpin column' : 'Pin column'}
      </button>

      {/* Number format section */}
      {menu.colType === 'number' && (
        <>
          <div className="h-px bg-[var(--color-border)] my-1" />
          <div className="px-3 py-1.5 text-xs text-[var(--color-text-muted)] flex justify-between">
            <span>Number format</span>
            {hasNumberFormatOverride ? <span className="text-[var(--color-accent)]">•</span> : null}
          </div>
          <div className="px-2 py-1 flex items-center justify-between text-xs">
            <span>Decimals</span>
            <select
              value={effectiveFormat.decimals}
              onChange={(e) => setDecimals(Number(e.target.value))}
              className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-xs px-2 py-0.5 rounded"
            >
              {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <button type="button" onClick={toggleThousandsSeparator} className={`${itemClass} flex justify-between`}>
            <span>Thousands separator</span>
            <span className="text-[var(--color-text-muted)]">{effectiveFormat.thousandsSeparator ? 'On' : 'Off'}</span>
          </button>
          {hasNumberFormatOverride && (
            <button type="button" onClick={resetFormat} className={`${itemClass} text-[var(--color-text-muted)]`}>
              Reset to global
            </button>
          )}
        </>
      )}

      {/* Date helpers for date/time columns */}
      {isDateTime && (
        <>
          <div className="h-px bg-[var(--color-border)] my-1" />
          <div className="px-3 py-1.5 text-xs text-[var(--color-text-muted)]">Date helpers</div>

          {/* Bucket by submenu */}
          {canBucket && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button type="button" className={subTriggerClass}>
                  <span>Bucket by</span>
                  <ChevronRight className="w-3 h-3 text-[var(--color-text-muted)]" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content side="right" align="start" sideOffset={2} className={subContentClass}>
                  {(Object.entries(DATE_BUCKET_LABELS) as [DateBucket, string][]).map(([bucket, label]) => (
                    <DropdownMenu.Item key={bucket} onSelect={() => dateBucket(bucket)} className={itemClass}>
                      {label}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}

          {/* Extract submenu */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button type="button" className={subTriggerClass}>
                <span>Extract</span>
                <ChevronRight className="w-3 h-3 text-[var(--color-text-muted)]" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content side="right" align="start" sideOffset={2} className={subContentClass}>
                {(Object.entries(DATE_PART_LABELS) as [DatePart, string][])
                  .filter(([part]) => {
                    if (!canExtractTime && ['hour', 'minute'].includes(part)) return false
                    return true
                  })
                  .map(([part, label]) => (
                    <DropdownMenu.Item key={part} onSelect={() => dateExtract(part)} className={itemClass}>
                      {label}
                    </DropdownMenu.Item>
                  ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          {/* Calculate submenu */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button type="button" className={subTriggerClass}>
                <span>Calculate</span>
                <ChevronRight className="w-3 h-3 text-[var(--color-text-muted)]" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content side="right" align="start" sideOffset={2} className={subContentClass}>
                {(Object.entries(DATE_DIFF_LABELS) as [DateDiffUnit, string][]).map(([unit, label]) => (
                  <DropdownMenu.Item key={unit} onSelect={() => dateDiff(unit)} className={itemClass}>
                    {label}
                  </DropdownMenu.Item>
                ))}
                <DropdownMenu.Separator className="h-px bg-[var(--color-border)] my-1" />
                <DropdownMenu.Item onSelect={() => dateAdd(7, 'day')} className={itemClass}>
                  + 7 days
                </DropdownMenu.Item>
                <DropdownMenu.Item onSelect={() => dateAdd(1, 'month')} className={itemClass}>
                  + 1 month
                </DropdownMenu.Item>
                <DropdownMenu.Item onSelect={() => dateAdd(1, 'year')} className={itemClass}>
                  + 1 year
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </>
      )}

      {/* Parse as date for string columns */}
      {isString && (
        <>
          <div className="h-px bg-[var(--color-border)] my-1" />
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button type="button" className={subTriggerClass}>
                <span>Parse as date</span>
                <ChevronRight className="w-3 h-3 text-[var(--color-text-muted)]" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content side="right" align="start" sideOffset={2} className={subContentClass}>
                <DropdownMenu.Item onSelect={() => dateParse('DATE')} className={itemClass}>
                  DATE
                </DropdownMenu.Item>
                <DropdownMenu.Item onSelect={() => dateParse('TIMESTAMP')} className={itemClass}>
                  TIMESTAMP
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </>
      )}

      {/* Window function */}
      <div className="h-px bg-[var(--color-border)] my-1" />
      <button type="button" onClick={openWindowFunction} className={itemClass}>
        Window function...
      </button>

      <div className="h-px bg-[var(--color-border)] my-1" />
      <button type="button" onClick={renameColumn} className={itemClass}>
        Rename column...
      </button>
      <button type="button" onClick={dropColumn} className={`${itemClass} text-[var(--color-error)]`}>
        Drop column
      </button>
    </div>,
    document.body
  )
}
