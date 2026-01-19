import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react'
import type { FilterOperator } from '@/types'

// Page state types
export type CommandPalettePage =
  | { type: 'root' }
  | { type: 'filter'; column?: string; operator?: FilterOperator }
  | { type: 'sort'; column?: string }

interface CommandPaletteContextValue {
  // State
  page: CommandPalettePage
  history: CommandPalettePage[]
  searchValue: string

  // Navigation
  pushPage: (page: CommandPalettePage) => void
  popPage: () => void
  resetToRoot: () => void

  // Search
  setSearchValue: (value: string) => void

  // Actions
  close: () => void
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null)

interface CommandPaletteProviderProps {
  children: ReactNode
  initialPage?: CommandPalettePage
  onClose: () => void
}

export function CommandPaletteProvider({ children, initialPage, onClose }: CommandPaletteProviderProps) {
  const [page, setPage] = useState<CommandPalettePage>(initialPage ?? { type: 'root' })
  const [history, setHistory] = useState<CommandPalettePage[]>([])
  const [searchValue, setSearchValue] = useState('')

  const pushPage = useCallback(
    (nextPage: CommandPalettePage) => {
      setHistory((prev) => [...prev, page])
      setPage(nextPage)
      setSearchValue('') // Clear search when navigating
    },
    [page]
  )

  const popPage = useCallback(() => {
    if (history.length > 0) {
      const prevPage = history[history.length - 1]
      setHistory((prev) => prev.slice(0, -1))
      setPage(prevPage)
      setSearchValue('')
    } else {
      onClose()
    }
  }, [history, onClose])

  const resetToRoot = useCallback(() => {
    setPage({ type: 'root' })
    setHistory([])
    setSearchValue('')
  }, [])

  const value = useMemo(
    () => ({
      page,
      history,
      searchValue,
      pushPage,
      popPage,
      resetToRoot,
      setSearchValue,
      close: onClose,
    }),
    [page, history, searchValue, pushPage, popPage, resetToRoot, onClose]
  )

  return <CommandPaletteContext.Provider value={value}>{children}</CommandPaletteContext.Provider>
}

export function useCommandPalette() {
  const context = useContext(CommandPaletteContext)
  if (!context) {
    throw new Error('useCommandPalette must be used within CommandPaletteProvider')
  }
  return context
}
