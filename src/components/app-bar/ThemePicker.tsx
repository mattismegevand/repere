import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import Monitor from 'lucide-react/dist/esm/icons/monitor'
import Moon from 'lucide-react/dist/esm/icons/moon'
import Sun from 'lucide-react/dist/esm/icons/sun'
import { useThemeStore } from '@/stores/themeStore'
import type { ColorScheme } from '@/themes'
import { colorPalettes, getColorPaletteList, getEffectiveColorScheme, getStructureStyleList } from '@/themes'

interface ThemeMiniPreviewProps {
  paletteId: string
  isSelected: boolean
  onClick: () => void
}

function ThemeMiniPreview({ paletteId, isSelected, onClick }: ThemeMiniPreviewProps) {
  const theme = useThemeStore((s) => s.theme)
  const effectiveScheme = getEffectiveColorScheme(theme)
  const palette = colorPalettes[paletteId]
  if (!palette) return null

  const colors = palette.colors[effectiveScheme]
  const radius = 3

  return (
    <button
      onClick={(e) => {
        e.preventDefault()
        onClick()
      }}
      className={`flex flex-col items-center gap-1 p-1 rounded transition-all ${
        isSelected
          ? 'ring-2 ring-[var(--color-accent)] ring-offset-1 ring-offset-[var(--color-bg-primary)]'
          : 'hover:bg-[var(--color-bg-secondary)]'
      }`}
    >
      <svg
        width="56"
        height="36"
        viewBox="0 0 56 36"
        className="shrink-0"
        role="img"
        aria-label={`${palette.metadata.name} theme preview`}
      >
        {/* Background */}
        <rect x="0" y="0" width="56" height="36" rx={radius} fill={colors.bgPrimary} />

        {/* Top bar */}
        <rect x="0" y="0" width="56" height="8" rx={radius} fill={colors.accent} />
        <rect x="0" y="4" width="56" height="4" fill={colors.accent} />

        {/* Sidebar */}
        <rect x="0" y="8" width="14" height="28" fill={colors.bgSecondary} />
        <rect x="0" y="32" width="14" height="4" rx={radius} fill={colors.bgSecondary} />

        {/* Content area lines (simulating data grid) */}
        <rect x="16" y="12" width="38" height="1" fill={colors.border} />
        <rect x="16" y="18" width="38" height="1" fill={colors.border} />
        <rect x="16" y="24" width="38" height="1" fill={colors.border} />
        <rect x="16" y="30" width="38" height="1" fill={colors.border} />

        {/* Border */}
        <rect x="0.5" y="0.5" width="55" height="35" rx={radius} fill="none" stroke={colors.border} strokeWidth="1" />
      </svg>
      <span className="text-[10px] text-[var(--color-text-secondary)]">{palette.metadata.name}</span>
    </button>
  )
}

export function ThemeSubmenu() {
  const colorPalette = useThemeStore((s) => s.colorPalette)
  const setColorPalette = useThemeStore((s) => s.setColorPalette)
  const palettes = getColorPaletteList()

  return (
    <div className="px-2 py-2" onPointerDown={(e) => e.stopPropagation()}>
      <div className="grid grid-cols-3 gap-1">
        {palettes.map((p) => (
          <ThemeMiniPreview
            key={p.id}
            paletteId={p.id}
            isSelected={colorPalette === p.id}
            onClick={() => setColorPalette(p.id)}
          />
        ))}
      </div>
    </div>
  )
}

export function StyleSubmenu() {
  const structureStyle = useThemeStore((s) => s.structureStyle)
  const setStructureStyle = useThemeStore((s) => s.setStructureStyle)
  const structures = getStructureStyleList()

  return (
    <DropdownMenu.Item
      onSelect={(e) => e.preventDefault()}
      className="w-full px-3 py-1.5 text-xs flex items-center justify-between gap-4 outline-none"
    >
      <span>Style</span>
      <div className="flex gap-1">
        {structures.map((s) => (
          <button
            key={s.id}
            onClick={() => setStructureStyle(s.id)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              structureStyle === s.id
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>
    </DropdownMenu.Item>
  )
}

interface AppearanceButtonProps {
  scheme: ColorScheme
  currentScheme: ColorScheme
  onClick: () => void
  icon: React.ReactNode
  label: string
}

function AppearanceButton({ scheme, currentScheme, onClick, icon, label }: AppearanceButtonProps) {
  const isSelected = currentScheme === scheme
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
        isSelected
          ? 'bg-[var(--color-accent)] text-white'
          : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

export function AppearanceSubmenu() {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)

  return (
    <DropdownMenu.Item
      onSelect={(e) => e.preventDefault()}
      className="w-full px-3 py-1.5 text-xs flex items-center justify-between gap-4 outline-none"
    >
      <span>Appearance</span>
      <div className="flex gap-1">
        <AppearanceButton
          scheme="light"
          currentScheme={theme}
          onClick={() => setTheme('light')}
          icon={<Sun className="w-3 h-3" />}
          label="Light"
        />
        <AppearanceButton
          scheme="dark"
          currentScheme={theme}
          onClick={() => setTheme('dark')}
          icon={<Moon className="w-3 h-3" />}
          label="Dark"
        />
        <AppearanceButton
          scheme="system"
          currentScheme={theme}
          onClick={() => setTheme('system')}
          icon={<Monitor className="w-3 h-3" />}
          label="System"
        />
      </div>
    </DropdownMenu.Item>
  )
}
