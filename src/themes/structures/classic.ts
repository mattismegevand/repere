import type { StructureStyle } from '../types'

export const classicStructure: StructureStyle = {
  metadata: {
    id: 'classic',
    name: 'Classic',
    description: 'Bloomberg terminal style - dense, monospace, no shadows',
  },
  structure: {
    radiusNone: '0',
    radiusSm: '0',
    radiusMd: '0',
    radiusLg: '0',
    radiusXl: '0',
    radiusFull: '0',
    borderWidth: '1px',
    borderWidthThick: '2px',
    fontUi: '"IBM Plex Mono", "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
    fontMono: '"IBM Plex Mono", "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
    fontSize: '11px',
    lineHeight: '1.15',
    textTransform: 'none',
    letterSpacing: '0.02em',
    spacingScale: '0.4',
    shadowSm: 'none',
    shadowMd: 'none',
    shadowLg: 'none',
  },
}
