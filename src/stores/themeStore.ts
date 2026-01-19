import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ColorScheme } from '@/themes'

export interface NumberFormat {
  decimals: number // 0-6
  thousandsSeparator: boolean
}

interface ThemeStoreState {
  theme: ColorScheme
  colorPalette: string
  structureStyle: string
  numberFormat: NumberFormat
  columnNumberFormats: Record<string, Partial<NumberFormat>> // Per-column overrides
}

interface ThemeStoreActions {
  setTheme: (theme: ColorScheme) => void
  toggleTheme: () => void
  setColorPalette: (palette: string) => void
  setStructureStyle: (style: string) => void
  setNumberFormat: (format: Partial<NumberFormat>) => void
  setColumnNumberFormat: (column: string, format: Partial<NumberFormat> | null) => void
}

export const useThemeStore = create<ThemeStoreState & ThemeStoreActions>()(
  persist(
    (set) => ({
      theme: 'system',
      colorPalette: 'modern',
      structureStyle: 'modern',
      numberFormat: { decimals: 2, thousandsSeparator: true },
      columnNumberFormats: {},

      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set((s) => {
          // Cycle: light → dark → system → light
          const order: ColorScheme[] = ['light', 'dark', 'system']
          const currentIndex = order.indexOf(s.theme)
          const nextIndex = (currentIndex + 1) % order.length
          return { theme: order[nextIndex] }
        }),
      setColorPalette: (palette) => set({ colorPalette: palette }),
      setStructureStyle: (style) => set({ structureStyle: style }),
      setNumberFormat: (format) => set((s) => ({ numberFormat: { ...s.numberFormat, ...format } })),
      setColumnNumberFormat: (column, format) =>
        set((s) => {
          if (format === null) {
            const { [column]: _, ...rest } = s.columnNumberFormats
            return { columnNumberFormats: rest }
          }
          return { columnNumberFormats: { ...s.columnNumberFormats, [column]: format } }
        }),
    }),
    {
      name: 'repere-theme',
      partialize: (state) => ({
        theme: state.theme,
        colorPalette: state.colorPalette,
        structureStyle: state.structureStyle,
        numberFormat: state.numberFormat,
        columnNumberFormats: state.columnNumberFormats,
      }),
    }
  )
)
