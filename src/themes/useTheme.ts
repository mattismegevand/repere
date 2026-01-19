import { useEffect } from 'react'
import { useThemeStore } from '@/stores'
import { applyTheme, getEffectiveColorScheme } from './index'

/**
 * Hook that applies the current theme to the document.
 * Should be called once at the app root.
 */
export function useTheme() {
  const { theme, colorPalette, structureStyle } = useThemeStore()

  useEffect(() => {
    // Apply theme immediately
    applyTheme(colorPalette, structureStyle, theme)

    // Listen for system color scheme changes when using 'system' theme
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = () => applyTheme(colorPalette, structureStyle, theme)
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [theme, colorPalette, structureStyle])

  return {
    theme,
    colorPalette,
    structureStyle,
    effectiveColorScheme: getEffectiveColorScheme(theme),
  }
}
