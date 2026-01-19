// Session reference - each session has a unique ID for IDB storage
// Optional path/handleId for sessions opened from .repere files
export interface RecentSessionRef {
  sessionId: string // Unique ID (used as IDB storage key)
  path?: string // Tauri file path (for desktop)
  handleId?: string // Web File System Access API handle ID
}

// Pipeline preview info stored with recent sessions
export interface SessionPreview {
  datasets: string[] // Dataset names
  viewCount: number // Number of views/operations
}

export interface RecentSessionEntry {
  id: string
  ref: RecentSessionRef
  name: string
  openedAt: number
  size?: number
  preview?: SessionPreview
}

export const MAX_RECENT_SESSIONS = 10
