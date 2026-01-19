import { readFileTauri } from '@/lib/file-system/tauri-file-ops'
import { isTauri } from '@/lib/platform'
import { loadFileHandle, loadSessionBlob, removeFileHandle, removeSessionBlob } from '@/lib/storage/idb'
import type { RecentSessionRef } from './types'

export type ResolveResult = { blob: Blob } | { error: 'not-found' | 'permission-denied' | 'corrupted' }

export function canUseFileHandles(): boolean {
  return !isTauri() && 'showSaveFilePicker' in window
}

export async function resolveSession(ref: RecentSessionRef): Promise<ResolveResult> {
  // Try file-based resolution first if available (for sessions loaded from .repere files)
  if (ref.path) {
    return resolveTauriPath(ref.path)
  }
  if (ref.handleId) {
    return resolveFileHandle(ref.handleId)
  }
  // Fall back to IDB blob storage (for auto-saved sessions)
  return resolveIdbBlob(ref.sessionId)
}

async function resolveTauriPath(path: string): Promise<ResolveResult> {
  try {
    const data = await readFileTauri(path)
    // Slice the buffer to get just the portion used by this Uint8Array
    const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
    return { blob: new Blob([buffer]) }
  } catch {
    return { error: 'not-found' }
  }
}

async function resolveFileHandle(handleId: string): Promise<ResolveResult> {
  const handle = await loadFileHandle(handleId)
  if (!handle) {
    return { error: 'not-found' }
  }

  try {
    // Check if we have permission
    const permission = await handle.queryPermission({ mode: 'read' })
    if (permission === 'denied') {
      return { error: 'permission-denied' }
    }

    // Request permission if needed
    if (permission === 'prompt') {
      const requested = await handle.requestPermission({ mode: 'read' })
      if (requested !== 'granted') {
        return { error: 'permission-denied' }
      }
    }

    const file = await handle.getFile()
    return { blob: file }
  } catch {
    // Handle might be stale (file moved/deleted)
    await removeFileHandle(handleId)
    return { error: 'not-found' }
  }
}

async function resolveIdbBlob(key: string): Promise<ResolveResult> {
  const blob = await loadSessionBlob(key)
  if (!blob) {
    return { error: 'not-found' }
  }
  return { blob }
}

// Cleanup functions for removing stored data when session is removed
export async function cleanupSessionRef(ref: RecentSessionRef): Promise<void> {
  // Clean up IDB blob storage
  await removeSessionBlob(ref.sessionId)
  // Clean up file handle if present
  if (ref.handleId) {
    await removeFileHandle(ref.handleId)
  }
  // path (Tauri) doesn't need cleanup - it's just a file path reference
}
