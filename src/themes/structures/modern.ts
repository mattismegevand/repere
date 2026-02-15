import type { StructureStyle } from '../types'

export const modernStructure: StructureStyle = {
  metadata: {
    id: 'modern',
    name: 'Modern',
    description: 'Precision instrument aesthetic with refined typography',
  },
  structure: {
    radiusNone: '0',
    radiusSm: '4px',
    radiusMd: '6px',
    radiusLg: '10px',
    radiusXl: '14px',
    radiusFull: '9999px',
    borderWidth: '1px',
    borderWidthThick: '2px',
    fontUi: '"Outfit", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontMono: '"JetBrains Mono", "SF Mono", Consolas, monospace',
    fontSize: '14px',
    lineHeight: '1.5',
    textTransform: 'none',
    letterSpacing: '-0.01em',
    spacingScale: '1',
    shadowSm: '0 1px 2px rgb(0 0 0 / 0.04), 0 1px 1px rgb(0 0 0 / 0.06)',
    shadowMd: '0 2px 4px rgb(0 0 0 / 0.04), 0 4px 8px rgb(0 0 0 / 0.06)',
    shadowLg: '0 4px 8px rgb(0 0 0 / 0.04), 0 8px 24px rgb(0 0 0 / 0.08)',
  },
}
