import { isTauri } from '@/lib/platform'
import { pickFilesTauri, readFileTauri } from './tauri-file-ops'

const FILE_TYPES = [
  { description: 'Data files', accept: { 'text/csv': ['.csv'] } },
  { description: 'JSON files', accept: { 'application/json': ['.json', '.jsonl'] } },
  { description: 'Parquet files', accept: { 'application/octet-stream': ['.parquet'] } },
  {
    description: 'Excel files',
    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
  },
  { description: 'repere sessions', accept: { 'application/json': ['.repere'] } },
]

/**
 * Unified type for picked files across platforms.
 * - Browser: File object with contents in memory
 * - Tauri: Path reference (file stays on disk until needed)
 */
export type PickedFile = { type: 'file'; file: File } | { type: 'path'; path: string; name: string }

/**
 * Get the file name from a picked file.
 */
function getPickedFileName(picked: PickedFile): string {
  return picked.type === 'file' ? picked.file.name : picked.name
}

/**
 * Check if a picked file is a session file (.repere)
 */
export function isSessionFile(picked: PickedFile): boolean {
  const name = getPickedFileName(picked)
  return name.toLowerCase().endsWith('.repere')
}

/**
 * Pick files using native dialog (Tauri) or browser file picker.
 * Returns PickedFile objects that can be either File objects or path references.
 */
export async function pickFiles(multiple = false): Promise<PickedFile[]> {
  // Use Tauri native dialog when running in desktop app
  if (isTauri()) {
    const selections = await pickFilesTauri(multiple)
    return selections.map((s) => ({ type: 'path', path: s.path, name: s.name }))
  }

  // Browser: use showOpenFilePicker with fallback
  if ('showOpenFilePicker' in window) {
    try {
      const handles = await (window as any).showOpenFilePicker({
        multiple,
        types: FILE_TYPES,
      })
      const files = await Promise.all(handles.map((h: any) => h.getFile()))
      return files.map((file: File) => ({ type: 'file', file }))
    } catch (err) {
      if ((err as Error).name === 'AbortError') return []
      throw err
    }
  }

  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv,.json,.jsonl,.parquet,.xlsx,.repere'
    input.multiple = multiple
    input.onchange = () => {
      const files = Array.from(input.files ?? [])
      resolve(files.map((file) => ({ type: 'file', file })))
    }
    input.click()
  })
}

/**
 * Convert a PickedFile to a File object.
 * For path-based files (Tauri), this reads the file contents from disk.
 * Use sparingly - prefer passing paths directly to the backend when possible.
 */
export async function pickedFileToFile(picked: PickedFile): Promise<File> {
  if (picked.type === 'file') {
    return picked.file
  }
  // Read file from disk in Tauri mode
  const contents = await readFileTauri(picked.path)
  return new File([contents.buffer as ArrayBuffer], picked.name)
}

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? ''
}

/**
 * Compute SHA-256 hash of a file, returns first 16 hex chars (64 bits)
 * Uses Web Crypto API for fast, native hashing
 */
export async function computeFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  // Return first 16 chars (64 bits) - enough for collision resistance in this context
  return hashHex.slice(0, 16)
}
