import type { StructureStyle } from '../types'

export const modernStructure: StructureStyle = {
  metadata: {
    id: 'modern',
    name: 'Modern',
    description: 'Rounded corners, system fonts, subtle shadows',
  },
  structure: {
    radiusNone: '0',
    radiusSm: '4px',
    radiusMd: '6px',
    radiusLg: '8px',
    radiusXl: '12px',
    radiusFull: '9999px',
    borderWidth: '1px',
    borderWidthThick: '2px',
    fontUi: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontMono: '"SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
    fontSize: '14px',
    lineHeight: '1.5',
    textTransform: 'none',
    letterSpacing: 'normal',
    spacingScale: '1',
    shadowSm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    shadowMd: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    shadowLg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  },
}
