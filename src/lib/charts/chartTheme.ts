/**
 * Centralized chart theme system for ECharts
 * Provides consistent colors, typography, and styling across all charts
 * Integrates with the app's color palette and structure style
 */

import type { ChartColors, ColorTokens, StructureTokens } from '@/themes/types'

export interface ChartTheme {
  isDark: boolean

  colors: {
    primary: string
    primaryHover: string
    categorical: string[]
    sequential: string[]
    diverging: string[]
  }

  text: {
    primary: string
    secondary: string
    muted: string
  }

  axis: {
    line: string
    tick: string
    label: string
    splitLine: string
  }

  tooltip: {
    backgroundColor: string
    borderColor: string
    textColor: string
    shadow: string
  }

  grid: {
    small: { left: number; right: number; top: number; bottom: number }
    medium: { left: number; right: number; top: number; bottom: number }
    large: { left: number; right: number; top: number; bottom: number }
  }

  typography: {
    fontFamily: string
    axisLabel: number
    axisName: number
    legend: number
    tooltip: number
  }

  animation: {
    enabled: boolean
    duration: number
    easing: string
  }

  /** Structure style affects bar radius, shadows */
  structure: {
    barBorderRadius: number
    emphasisShadow: boolean
  }
}

export interface ChartThemeInput {
  isDark: boolean
  colors: ColorTokens
  chartColors: ChartColors
  structure: StructureTokens
}

/**
 * Generate chart theme from palette and structure
 */
export function getChartTheme(input: ChartThemeInput): ChartTheme {
  const { isDark, colors, chartColors, structure } = input
  const isClassic = structure.radiusSm === '0'

  return {
    isDark,

    colors: {
      primary: colors.accent,
      primaryHover: colors.accentHover,
      categorical: [...chartColors.categorical],
      sequential: [...chartColors.sequential],
      diverging: [...chartColors.diverging],
    },

    text: {
      primary: colors.textPrimary,
      secondary: colors.textSecondary,
      muted: colors.textMuted,
    },

    axis: {
      line: colors.border,
      tick: colors.border,
      label: colors.textSecondary,
      splitLine: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    },

    tooltip: {
      backgroundColor: colors.bgSecondary,
      borderColor: colors.border,
      textColor: colors.textPrimary,
      shadow: isClassic ? 'none' : isDark ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.08)',
    },

    grid: {
      small: { left: 40, right: 12, top: 12, bottom: 32 },
      medium: { left: 48, right: 16, top: 16, bottom: 40 },
      large: { left: 56, right: 24, top: 24, bottom: 48 },
    },

    typography: {
      fontFamily: structure.fontUi,
      axisLabel: isClassic ? 10 : 11,
      axisName: isClassic ? 10 : 12,
      legend: isClassic ? 10 : 11,
      tooltip: isClassic ? 11 : 12,
    },

    animation: {
      enabled: true,
      duration: 400,
      easing: 'cubicOut',
    },

    structure: {
      barBorderRadius: isClassic ? 0 : 3,
      emphasisShadow: !isClassic,
    },
  }
}

/**
 * Shared props for ReactECharts components
 */
export const ECHARTS_REACT_PROPS = {
  notMerge: true,
  lazyUpdate: true,
  opts: { renderer: 'canvas' as const },
}

/**
 * Shared props for ReactECharts in profiling panels (use SVG for smaller charts)
 */
export const ECHARTS_REACT_PROPS_SVG = {
  notMerge: true,
  lazyUpdate: true,
  opts: { renderer: 'svg' as const },
}
