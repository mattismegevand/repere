import { useRef } from 'react'
import { useGridColumnStore, useGridUIStore } from '@/components/data-grid/stores'
import { Checkbox } from '@/components/ui'
import { formatShortcut } from '@/lib/platform'
import { useQueryStore } from '@/stores/queryStore'
import type { Column, Sort } from '@/types'

interface GridToolbarProps {
  // Data (passed because GridToolbar is outside DataGridProvider)
  columns: Column[]
  totalCount: number

  // Sorts (operation-specific)
  currentSorts: Sort[]
  onSortChipClick: (column: string) => void
  onSortChipRemove: (column: string) => void

  // Filters (operation-specific)
  currentFilters: unknown[]
  onOpenFilterEditor: () => void

  // Focus (optional)
  searchInputRef?: React.RefObject<HTMLInputElement | null>
}

export function GridToolbar({
  columns,
  totalCount,
  currentSorts,
  onSortChipClick,
  onSortChipRemove,
  currentFilters,
  onOpenFilterEditor,
  searchInputRef: externalSearchRef,
}: GridToolbarProps) {
  // Read from stores directly
  const search = useQueryStore((s) => s.search)
  const setSearch = useQueryStore((s) => s.setSearch)
  const searchCaseSensitive = useQueryStore((s) => s.searchCaseSensitive)
  const toggleSearchCaseSensitive = useQueryStore((s) => s.toggleSearchCaseSensitive)

  const pinnedColumns = useGridColumnStore((s) => s.pinnedColumns)
  const hiddenColumns = useGridColumnStore((s) => s.hiddenColumns)
  const toggleColumnVisibility = useGridColumnStore((s) => s.toggleColumnVisibility)
  const toggleColumnPin = useGridColumnStore((s) => s.toggleColumnPin)
  const unpinAllColumns = useGridColumnStore((s) => s.unpinAllColumns)
  const showAllColumns = useGridColumnStore((s) => s.showAllColumns)

  const showColumnPicker = useGridUIStore((s) => s.showColumnPicker)
  const toggleColumnPicker = useGridUIStore((s) => s.toggleColumnPicker)
  const showSparklines = useGridUIStore((s) => s.showSparklines)
  const toggleSparklines = useGridUIStore((s) => s.toggleSparklines)

  const internalSearchRef = useRef<HTMLInputElement>(null)
  const searchRef = externalSearchRef ?? internalSearchRef

  return (
    <div className="flex items-center gap-2 px-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] h-[28px]">
      {/* Search input */}
      <div className="relative flex items-center">
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search... (/ or ${formatShortcut('⌘F')})`}
          aria-label="Search grid"
          className="px-1.5 py-0.5 text-[11px] bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-md w-40 pr-6"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            title="Clear search"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Case sensitive toggle */}
      <button
        onClick={toggleSearchCaseSensitive}
        className={`px-1.5 py-0.5 text-[11px] rounded-md border border-[var(--color-border)] ${
          searchCaseSensitive
            ? 'bg-[var(--color-accent)] text-white'
            : 'bg-[var(--color-bg-primary)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)]'
        }`}
        title="Case sensitive"
      >
        Aa
      </button>

      {/* Search match count */}
      {search && (
        <span className="text-[11px] text-[var(--color-text-muted)]">
          {totalCount.toLocaleString()} match{totalCount !== 1 ? 'es' : ''}
        </span>
      )}

      {/* Sort chips */}
      {currentSorts.length > 0 && (
        <div className="flex items-center gap-1">
          {currentSorts.map((sort, idx) => (
            <div
              key={idx}
              className="group inline-flex items-center bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 rounded-md overflow-hidden text-[10px]"
            >
              <button
                onClick={() => onSortChipClick(sort.column)}
                className="px-1.5 py-0.5 font-mono text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors"
                title={`Click to sort ${sort.direction === 'asc' ? 'descending' : 'ascending'}`}
              >
                {sort.column} {sort.direction === 'asc' ? '↑' : '↓'}
              </button>
              <button
                onClick={() => onSortChipRemove(sort.column)}
                className="px-1 py-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-colors"
                title="Remove sort"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1" />

      {/* Pinned/hidden indicators */}
      {pinnedColumns.size > 0 && (
        <button
          onClick={unpinAllColumns}
          className="text-[11px] text-[var(--color-accent)] hover:underline"
          title="Click to unpin all"
        >
          {pinnedColumns.size} pinned
        </button>
      )}
      {hiddenColumns.size > 0 && (
        <span className="text-[11px] text-[var(--color-text-muted)]">{hiddenColumns.size} hidden</span>
      )}

      {/* Settings dropdown */}
      <div className="relative">
        <button
          onClick={() => toggleColumnPicker()}
          className={`p-1.5 rounded-md border border-[var(--color-border)] transition-colors ${
            showColumnPicker
              ? 'bg-[var(--color-accent)] text-white'
              : 'bg-[var(--color-bg-primary)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]'
          }`}
          title="View settings"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        {showColumnPicker && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => toggleColumnPicker()} />
            <div className="absolute right-0 top-full mt-1 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg shadow-lg z-50 min-w-56">
              {/* Quick actions */}
              <div className="p-2 border-b border-[var(--color-border)]">
                <button
                  onClick={() => {
                    onOpenFilterEditor()
                    toggleColumnPicker()
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-[11px] rounded hover:bg-[var(--color-bg-secondary)] transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                    />
                  </svg>
                  <span>Edit filters</span>
                  {currentFilters.length > 0 && (
                    <span className="ml-auto px-1.5 py-0.5 text-[10px] bg-[var(--color-accent)] text-white rounded-full">
                      {currentFilters.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Toggles */}
              <div className="p-2 border-b border-[var(--color-border)]">
                <label className="flex items-center gap-2 px-2 py-1.5 text-[11px] rounded hover:bg-[var(--color-bg-secondary)] cursor-pointer transition-colors">
                  <Checkbox checked={showSparklines} onCheckedChange={() => toggleSparklines()} />
                  <svg
                    className="w-3.5 h-3.5 text-[var(--color-text-muted)]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                  <span>Show sparklines</span>
                </label>
              </div>

              {/* Columns section */}
              <div className="p-2">
                <div className="flex items-center justify-between px-2 py-1 mb-1">
                  <span className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
                    Columns
                  </span>
                  <div className="flex gap-2">
                    {pinnedColumns.size > 0 && (
                      <button
                        onClick={unpinAllColumns}
                        className="text-[10px] text-[var(--color-accent)] hover:underline"
                      >
                        Unpin all
                      </button>
                    )}
                    {hiddenColumns.size > 0 && (
                      <button
                        onClick={showAllColumns}
                        className="text-[10px] text-[var(--color-accent)] hover:underline"
                      >
                        Show all
                      </button>
                    )}
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {columns.map((col) => {
                    const isPinned = pinnedColumns.has(col.name)
                    const isHidden = hiddenColumns.has(col.name)
                    return (
                      <div
                        key={col.name}
                        className="flex items-center gap-1.5 px-2 py-1 text-[11px] rounded hover:bg-[var(--color-bg-secondary)]"
                      >
                        <Checkbox checked={!isHidden} onCheckedChange={() => toggleColumnVisibility(col.name)} />
                        <span className={`truncate flex-1 ${isHidden ? 'text-[var(--color-text-muted)]' : ''}`}>
                          {col.name}
                        </span>
                        <button
                          onClick={() => toggleColumnPin(col.name)}
                          className={`p-0.5 rounded transition-colors ${
                            isPinned
                              ? 'text-[var(--color-accent)]'
                              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                          }`}
                          title={isPinned ? 'Unpin' : 'Pin'}
                        >
                          <svg
                            className="w-3 h-3"
                            fill={isPinned ? 'currentColor' : 'none'}
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                            />
                          </svg>
                        </button>
                        <span className="text-[9px] text-[var(--color-text-muted)] w-10 text-right">{col.type}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
