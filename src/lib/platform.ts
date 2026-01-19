export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
}

export const isMacPlatform = () => {
  if (typeof navigator === 'undefined') return false
  const platform = navigator.platform || navigator.userAgent
  return /Mac|iPhone|iPad|iPod/.test(platform)
}

export const formatShortcut = (keys: string, isMac = isMacPlatform()) => {
  if (isMac) {
    return keys.replace(/CMD\+/g, '⌘').replace(/SHIFT\+/g, '⇧')
  }
  return keys
    .replace(/⌘/g, 'Ctrl+')
    .replace(/⇧/g, 'Shift+')
    .replace(/CMD\+/g, 'Ctrl+')
    .replace(/SHIFT\+/g, 'Shift+')
}

/** Check if the platform-appropriate modifier key is pressed (Cmd on Mac, Ctrl on Windows/Linux) */
export const isModKey = (e: KeyboardEvent | React.KeyboardEvent) => {
  return isMacPlatform() ? e.metaKey : e.ctrlKey
}
