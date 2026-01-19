/**
 * Color scheme affects light/dark colors
 */
export type ColorScheme = 'light' | 'dark' | 'system'

/**
 * Color tokens - vary by light/dark
 */
export interface ColorTokens {
  bgPrimary: string
  bgSecondary: string
  bgTertiary: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  border: string
  borderLight: string
  accent: string
  accentHover: string
  accentBg: string
  error: string
  errorBg: string
  success: string
  successBg: string
  warning: string
  warningBg: string
}

/**
 * Structure tokens - vary by structure style (modern/classic)
 */
export interface StructureTokens {
  // Border radius
  radiusNone: string
  radiusSm: string
  radiusMd: string
  radiusLg: string
  radiusXl: string
  radiusFull: string

  // Border width
  borderWidth: string
  borderWidthThick: string

  // Typography
  fontUi: string
  fontMono: string
  fontSize: string
  lineHeight: string

  // Text transform for UI elements
  textTransform: string
  letterSpacing: string

  // Spacing scale multiplier (1 = default, 0.8 = tighter)
  spacingScale: string

  // Shadows
  shadowSm: string
  shadowMd: string
  shadowLg: string
}

/**
 * Metadata for display in theme picker
 */
export interface ThemeMetadata {
  id: string
  name: string
  description: string
}

/**
 * Chart colors for ECharts - 8 categorical, 7 sequential, 6 diverging
 */
export interface ChartColors {
  /** 8 colors for multi-series charts (bar, line, pie, etc.) */
  categorical: [string, string, string, string, string, string, string, string]
  /** 7-step gradient for heatmaps (light to dark) */
  sequential: [string, string, string, string, string, string, string]
  /** 6-step diverging for correlation (-1 to +1): red → neutral → green */
  diverging: [string, string, string, string, string, string]
}

/**
 * Color palette - colors with chart colors and metadata
 */
export interface ColorPalette {
  metadata: ThemeMetadata
  colors: {
    light: ColorTokens
    dark: ColorTokens
  }
  /** Chart-specific colors for ECharts */
  chart: {
    light: ChartColors
    dark: ChartColors
  }
}

/**
 * Structure style - just structure tokens with metadata
 */
export interface StructureStyle {
  metadata: ThemeMetadata
  structure: StructureTokens
}
