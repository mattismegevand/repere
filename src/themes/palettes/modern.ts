import type { ColorPalette } from '../types'

export const modernPalette: ColorPalette = {
  metadata: {
    id: 'modern',
    name: 'Modern',
    description: 'Precision instrument with warm amber accent',
  },
  colors: {
    light: {
      // Refined warm neutrals with slight warmth
      bgPrimary: '#fafaf9',
      bgSecondary: '#f5f5f4',
      bgTertiary: '#e7e5e4',
      // Rich, readable text colors
      textPrimary: '#1c1917',
      textSecondary: '#57534e',
      textMuted: '#a8a29e',
      // Subtle warm borders
      border: '#d6d3d1',
      borderLight: '#e7e5e4',
      // Warm amber accent - like brass instruments
      accent: '#b45309',
      accentHover: '#92400e',
      accentBg: '#fef3c7',
      // Semantic colors
      error: '#dc2626',
      errorBg: '#fef2f2',
      success: '#059669',
      successBg: '#ecfdf5',
      warning: '#d97706',
      warningBg: '#fffbeb',
    },
    dark: {
      // Deep, rich dark backgrounds
      bgPrimary: '#0c0a09',
      bgSecondary: '#1c1917',
      bgTertiary: '#292524',
      // Clean white text with warm undertones
      textPrimary: '#fafaf9',
      textSecondary: '#a8a29e',
      textMuted: '#78716c',
      // Subtle borders that don't compete
      border: '#292524',
      borderLight: '#1c1917',
      // Brighter amber for dark mode visibility
      accent: '#f59e0b',
      accentHover: '#fbbf24',
      accentBg: '#451a03',
      // Semantic colors adjusted for dark
      error: '#f87171',
      errorBg: '#450a0a',
      success: '#34d399',
      successBg: '#052e16',
      warning: '#fbbf24',
      warningBg: '#451a03',
    },
  },
  chart: {
    light: {
      // Warm, sophisticated palette
      categorical: ['#b45309', '#0891b2', '#059669', '#7c3aed', '#dc2626', '#0369a1', '#c026d3', '#475569'],
      sequential: ['#fef3c7', '#fde68a', '#fcd34d', '#fbbf24', '#f59e0b', '#d97706', '#b45309'],
      diverging: ['#dc2626', '#fca5a5', '#fef2f2', '#ecfdf5', '#6ee7b7', '#059669'],
    },
    dark: {
      categorical: ['#fbbf24', '#22d3ee', '#34d399', '#a78bfa', '#f87171', '#38bdf8', '#e879f9', '#94a3b8'],
      sequential: ['#451a03', '#78350f', '#92400e', '#b45309', '#d97706', '#f59e0b', '#fbbf24'],
      diverging: ['#f87171', '#fecaca', '#292524', '#1c1917', '#6ee7b7', '#34d399'],
    },
  },
}
