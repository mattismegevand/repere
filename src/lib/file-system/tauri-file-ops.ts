import { open, save } from '@tauri-apps/plugin-dialog'
import { readFile, writeFile } from '@tauri-apps/plugin-fs'

export interface TauriFileSelection {
  name: string
  path: string
}

export async function pickFilesTauri(multiple = false): Promise<TauriFileSelection[]> {
  const selected = await open({
    multiple,
    filters: [
      {
        name: 'Data Files',
        extensions: ['csv', 'json', 'jsonl', 'parquet', 'xlsx', 'repere'],
      },
    ],
  })

  if (!selected) return []

  const paths = Array.isArray(selected) ? selected : [selected]

  return paths.map((path) => ({
    name: path.split(/[/\\]/).pop() || 'unknown',
    path,
  }))
}

/**
 * Read file contents from path. Used for session files that need content access.
 */
export async function readFileTauri(path: string): Promise<Uint8Array> {
  return await readFile(path)
}

export async function saveFileTauri(
  defaultName: string,
  contents: Uint8Array | Blob,
  filters: Array<{ name: string; extensions: string[] }>
): Promise<string | null> {
  const path = await save({
    defaultPath: defaultName,
    filters,
  })

  if (!path) return null

  let data: Uint8Array
  if (contents instanceof Blob) {
    data = new Uint8Array(await contents.arrayBuffer())
  } else {
    data = contents
  }

  await writeFile(path, data)
  return path
}
