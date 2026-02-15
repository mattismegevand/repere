import { useMemo } from 'react'
import { useThemeStore } from '@/stores/themeStore'
import { colorPalettes, getEffectiveColorScheme, structureStyles } from '@/themes'
import { getChartTheme } from './chartTheme'

/**
 * Hook that provides the current chart theme based on the app's color palette,
 * structure style, and color scheme. Automatically updates when any of these change.
 */
export function useChartTheme() {
  const colorScheme = useThemeStore((s) => s.theme)
  const paletteId = useThemeStore((s) => s.colorPalette)
  const structureId = useThemeStore((s) => s.structureStyle)

  const chartTheme = useMemo(() => {
    const effectiveScheme = getEffectiveColorScheme(colorScheme)
    const isDark = effectiveScheme === 'dark'
    const palette = colorPalettes[paletteId] ?? colorPalettes.modern
    const structure = structureStyles[structureId] ?? structureStyles.modern

    return getChartTheme({
      isDark,
      colors: palette.colors[effectiveScheme],
      chartColors: palette.chart[effectiveScheme],
      structure: structure.structure,
    })
  }, [colorScheme, paletteId, structureId])

  return chartTheme
}
