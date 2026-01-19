import { del, get, set } from 'idb-keyval'

const KEYS = {
  DRAFT_SESSION: 'repere-draft-session',
  DRAFT_TIMESTAMP: 'repere-draft-timestamp',
  PENDING_SESSION: 'repere-pending-session',
  RECENT_FILE_HANDLES: 'repere-recent-file-handles',
  RECENT_SESSION_BLOBS: 'repere-recent-session-blobs',
} as const

export async function loadDraft(): Promise<Blob | null> {
  return (await get<Blob>(KEYS.DRAFT_SESSION)) ?? null
}

export async function clearDraft(): Promise<void> {
  await del(KEYS.DRAFT_SESSION)
  await del(KEYS.DRAFT_TIMESTAMP)
}

export async function hasDraft(): Promise<boolean> {
  const draft = await get(KEYS.DRAFT_SESSION)
  return draft !== undefined
}

// Pending session (for .repere files that need file re-upload, stored as ZIP blob)
export async function savePendingSession(blob: Blob): Promise<void> {
  await set(KEYS.PENDING_SESSION, blob)
}

export async function loadPendingSession(): Promise<Blob | null> {
  return (await get<Blob>(KEYS.PENDING_SESSION)) ?? null
}

export async function clearPendingSession(): Promise<void> {
  await del(KEYS.PENDING_SESSION)
}

export async function hasPendingSession(): Promise<boolean> {
  const pending = await get(KEYS.PENDING_SESSION)
  return pending !== undefined
}

// File handle storage (for File System Access API)
export async function saveFileHandle(handleId: string, handle: FileSystemFileHandle): Promise<void> {
  const handles = (await get<Map<string, FileSystemFileHandle>>(KEYS.RECENT_FILE_HANDLES)) ?? new Map()
  handles.set(handleId, handle)
  await set(KEYS.RECENT_FILE_HANDLES, handles)
}

export async function loadFileHandle(handleId: string): Promise<FileSystemFileHandle | null> {
  const handles = await get<Map<string, FileSystemFileHandle>>(KEYS.RECENT_FILE_HANDLES)
  return handles?.get(handleId) ?? null
}

export async function removeFileHandle(handleId: string): Promise<void> {
  const handles = await get<Map<string, FileSystemFileHandle>>(KEYS.RECENT_FILE_HANDLES)
  if (handles) {
    handles.delete(handleId)
    await set(KEYS.RECENT_FILE_HANDLES, handles)
  }
}

// Session blob storage (fallback for browsers without file handles)
export async function saveSessionBlob(key: string, blob: Blob): Promise<void> {
  const blobs = (await get<Map<string, Blob>>(KEYS.RECENT_SESSION_BLOBS)) ?? new Map()
  blobs.set(key, blob)
  await set(KEYS.RECENT_SESSION_BLOBS, blobs)
}

export async function loadSessionBlob(key: string): Promise<Blob | null> {
  const blobs = await get<Map<string, Blob>>(KEYS.RECENT_SESSION_BLOBS)
  return blobs?.get(key) ?? null
}

export async function removeSessionBlob(key: string): Promise<void> {
  const blobs = await get<Map<string, Blob>>(KEYS.RECENT_SESSION_BLOBS)
  if (blobs) {
    blobs.delete(key)
    await set(KEYS.RECENT_SESSION_BLOBS, blobs)
  }
}
