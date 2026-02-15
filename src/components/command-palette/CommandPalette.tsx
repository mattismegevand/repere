import { Command } from 'cmdk'
import { useCallback, useEffect, useRef, useState } from 'react'
import { isModKey } from '@/lib/platform'
import { usePanelStore } from '@/stores/panelStore'
import { CommandPaletteProvider, useCommandPalette } from './CommandPaletteContext'
import { FilterOperatorPage } from './pages/FilterOperatorPage'
import { FilterPage } from './pages/FilterPage'
import { FilterValuePage } from './pages/FilterValuePage'
import { RootPage } from './pages/RootPage'
import { SortDirectionPage } from './pages/SortDirectionPage'
import { SortPage } from './pages/SortPage'

function CommandPaletteContent() {
  const { page, popPage, searchValue, setSearchValue } = useCommandPalette()
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedValue, setSelectedValue] = useState('')

  // Handle keyboard navigation (Escape, Arrow Left/Right)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape or Arrow Left: go back
      if (e.key === 'Escape' || e.key === 'ArrowLeft') {
        // Don't intercept ArrowLeft if in a text input with cursor not at start
        if (e.key === 'ArrowLeft') {
          const input = document.activeElement as HTMLInputElement
          if (input?.tagName === 'INPUT' && input.selectionStart !== 0) {
            return
          }
        }
        e.preventDefault()
        popPage()
        return
      }

      // Arrow Right: select current item (same as Enter)
      if (e.key === 'ArrowRight') {
        // Don't intercept if in a text input with cursor not at end
        const input = document.activeElement as HTMLInputElement
        if (input?.tagName === 'INPUT' && input.selectionStart !== input.value?.length) {
          return
        }
        // Find and click the currently selected item using controlled value
        if (selectedValue) {
          const selectedItem = document.querySelector(
            `[cmdk-item][data-value="${CSS.escape(selectedValue)}"]`
          ) as HTMLElement
          if (selectedItem) {
            e.preventDefault()
            selectedItem.click()
          }
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [popPage, selectedValue])

  // Focus input when page changes (except value page which has its own input)
  useEffect(() => {
    if (page.type !== 'filter' || !page.operator) {
      inputRef.current?.focus()
    }
  }, [page])

  // Show visible search input only on pages that need it
  const showSearchInput =
    page.type === 'root' || (page.type === 'filter' && !page.column) || (page.type === 'sort' && !page.column)
  // Pages that need hidden input for keyboard navigation (no visible search but need arrow keys)
  const needsHiddenInput =
    (page.type === 'filter' && page.column && !page.operator) || (page.type === 'sort' && page.column)

  // Use key to reset cmdk selection state when page changes
  const getPageKey = () => {
    if (page.type === 'filter') return `filter-${page.column ?? ''}-${page.operator ?? ''}`
    if (page.type === 'sort') return `sort-${page.column ?? ''}`
    return page.type
  }
  const pageKey = getPageKey()

  return (
    <Command
      key={pageKey}
      value={selectedValue}
      onValueChange={setSelectedValue}
      className="relative w-full max-w-2xl bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl shadow-2xl overflow-hidden"
      loop
    >
      {showSearchInput && (
        <Command.Input
          ref={inputRef}
          value={searchValue}
          onValueChange={setSearchValue}
          placeholder={
            page.type === 'root'
              ? 'Type a command...'
              : page.type === 'filter' || page.type === 'sort'
                ? 'Search columns...'
                : ''
          }
          className="w-full px-4 py-3 text-sm bg-transparent border-b border-[var(--color-border)] outline-none placeholder:text-[var(--color-text-muted)]"
          autoFocus
        />
      )}
      {/* Hidden input for keyboard navigation on pages without search */}
      {needsHiddenInput ? <Command.Input ref={inputRef} className="sr-only" autoFocus aria-hidden="true" /> : null}

      {/* Page Router */}
      {page.type === 'root' && (
        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-sm text-[var(--color-text-muted)]">
            No results found
          </Command.Empty>
          <RootPage />
        </Command.List>
      )}

      {page.type === 'filter' && !page.column ? <FilterPage /> : null}

      {page.type === 'filter' && page.column && !page.operator ? <FilterOperatorPage /> : null}

      {page.type === 'filter' && page.column && page.operator ? <FilterValuePage /> : null}

      {page.type === 'sort' && !page.column ? <SortPage /> : null}

      {page.type === 'sort' && page.column ? <SortDirectionPage /> : null}
    </Command>
  )
}

export function CommandPalette() {
  const commandPaletteOpen = usePanelStore((s) => s.commandPaletteOpen)
  const commandPaletteInitialPage = usePanelStore((s) => s.commandPaletteInitialPage)
  const setCommandPalette = usePanelStore((s) => s.setCommandPalette)
  const clearCommandPaletteInitialPage = usePanelStore((s) => s.clearCommandPaletteInitialPage)

  const handleClose = useCallback(() => {
    setCommandPalette(false)
  }, [setCommandPalette])

  // Handle CMD+K global shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isModKey(e) && e.key === 'k') {
        e.preventDefault()
        setCommandPalette(!commandPaletteOpen)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [commandPaletteOpen, setCommandPalette])

  // Clear initial page after using it
  useEffect(() => {
    if (commandPaletteOpen && commandPaletteInitialPage) {
      // Small delay to let provider read it first
      const timer = setTimeout(() => {
        clearCommandPaletteInitialPage()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [commandPaletteOpen, commandPaletteInitialPage, clearCommandPaletteInitialPage])

  if (!commandPaletteOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div className="fixed inset-0" onClick={handleClose} />
      <CommandPaletteProvider initialPage={commandPaletteInitialPage ?? undefined} onClose={handleClose}>
        <CommandPaletteContent />
      </CommandPaletteProvider>
    </div>
  )
}
