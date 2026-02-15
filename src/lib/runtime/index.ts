import type { DuckDBClient } from '@/lib/duckdb/interface'
import { isTauri } from '@/lib/platform'

export type RuntimeKind = 'web' | 'tauri'

export interface RuntimeAdapter {
  kind: RuntimeKind
  isTauri: boolean
  createDuckDBClient(): Promise<DuckDBClient>
}

class WebRuntime implements RuntimeAdapter {
  kind: RuntimeKind = 'web'
  isTauri = false

  async createDuckDBClient(): Promise<DuckDBClient> {
    const { WasmDuckDBClient } = await import('@/lib/duckdb/wasm-client')
    return WasmDuckDBClient.create()
  }
}

class TauriRuntime implements RuntimeAdapter {
  kind: RuntimeKind = 'tauri'
  isTauri = true

  async createDuckDBClient(): Promise<DuckDBClient> {
    const { TauriDuckDBClient } = await import('@/lib/duckdb/tauri-client')
    return new TauriDuckDBClient()
  }
}

let runtimeInstance: RuntimeAdapter | null = null

export function getRuntime(): RuntimeAdapter {
  if (!runtimeInstance) {
    runtimeInstance = isTauri() ? new TauriRuntime() : new WebRuntime()
  }
  return runtimeInstance
}

export function isNativeRuntime(): boolean {
  return getRuntime().isTauri
}

export function resetRuntime(): void {
  runtimeInstance = null
}
