import { classicPalette, forestPalette, modernPalette, oceanPalette, rosePalette } from './palettes'
import { classicStructure, modernStructure } from './structures'
import type { ColorPalette, ColorScheme, ColorTokens, StructureStyle, StructureTokens, ThemeMetadata } from './types'

export type { ColorScheme }
export { useTheme } from './useTheme'

export const colorPalettes: Record<string, ColorPalette> = {
  modern: modernPalette,
  classic: classicPalette,
  ocean: oceanPalette,
  rose: rosePalette,
  forest: forestPalette,
}

export const structureStyles: Record<string, StructureStyle> = {
  modern: modernStructure,
  classic: classicStructure,
}

export function getColorPaletteList(): ThemeMetadata[] {
  return Object.values(colorPalettes).map((p) => p.metadata)
}

export function getStructureStyleList(): ThemeMetadata[] {
  return Object.values(structureStyles).map((s) => s.metadata)
}

/**
 * Convert color tokens to CSS custom properties
 */
function colorTokensToCss(tokens: ColorTokens): Record<string, string> {
  return {
    '--color-bg-primary': tokens.bgPrimary,
    '--color-bg-secondary': tokens.bgSecondary,
    '--color-bg-tertiary': tokens.bgTertiary,
    '--color-text-primary': tokens.textPrimary,
    '--color-text-secondary': tokens.textSecondary,
    '--color-text-muted': tokens.textMuted,
    '--color-border': tokens.border,
    '--color-border-light': tokens.borderLight,
    '--color-accent': tokens.accent,
    '--color-accent-hover': tokens.accentHover,
    '--color-accent-bg': tokens.accentBg,
    '--color-error': tokens.error,
    '--color-error-bg': tokens.errorBg,
    '--color-success': tokens.success,
    '--color-success-bg': tokens.successBg,
    '--color-warning': tokens.warning,
    '--color-warning-bg': tokens.warningBg,
  }
}

/**
 * Convert structure tokens to CSS custom properties
 */
function structureTokensToCss(tokens: StructureTokens): Record<string, string> {
  return {
    '--radius-none': tokens.radiusNone,
    '--radius-sm': tokens.radiusSm,
    '--radius-md': tokens.radiusMd,
    '--radius-lg': tokens.radiusLg,
    '--radius-xl': tokens.radiusXl,
    '--radius-full': tokens.radiusFull,
    '--border-width': tokens.borderWidth,
    '--border-width-thick': tokens.borderWidthThick,
    '--font-ui': tokens.fontUi,
    '--font-mono': tokens.fontMono,
    '--font-size': tokens.fontSize,
    '--line-height': tokens.lineHeight,
    '--text-transform': tokens.textTransform,
    '--letter-spacing': tokens.letterSpacing,
    '--spacing-scale': tokens.spacingScale,
    '--shadow-sm': tokens.shadowSm,
    '--shadow-md': tokens.shadowMd,
    '--shadow-lg': tokens.shadowLg,
  }
}

/**
 * Get the effective color scheme based on user preference and system setting
 */
export function getEffectiveColorScheme(scheme: ColorScheme): 'light' | 'dark' {
  if (scheme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return scheme
}

/**
 * Apply theme to the document root
 */
export function applyTheme(paletteId: string, structureId: string, colorScheme: ColorScheme): void {
  const palette = colorPalettes[paletteId] ?? colorPalettes.modern
  const structure = structureStyles[structureId] ?? structureStyles.modern
  const effectiveScheme = getEffectiveColorScheme(colorScheme)
  const root = document.documentElement

  // Apply color tokens
  const colorCss = colorTokensToCss(palette.colors[effectiveScheme])
  for (const [prop, value] of Object.entries(colorCss)) {
    root.style.setProperty(prop, value)
  }

  // Apply structure tokens
  const structureCss = structureTokensToCss(structure.structure)
  for (const [prop, value] of Object.entries(structureCss)) {
    root.style.setProperty(prop, value)
  }

  // Update body classes for Tailwind dark mode
  root.classList.remove('light', 'dark')
  root.classList.add(effectiveScheme)

  // Remove old palette/structure classes and add new ones
  for (const id of Object.keys(colorPalettes)) {
    root.classList.remove(id)
  }
  for (const id of Object.keys(structureStyles)) {
    root.classList.remove(`structure-${id}`)
  }
  root.classList.add(paletteId)
  root.classList.add(`structure-${structureId}`)
}
