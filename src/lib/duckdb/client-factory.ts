import { getRuntime, isNativeRuntime } from '@/lib/runtime'
import type { DuckDBClient } from './interface'

let clientInstance: DuckDBClient | null = null
let initPromise: Promise<DuckDBClient> | null = null

/**
 * Get the DuckDB client instance.
 * Creates a new instance on first call, returns cached instance on subsequent calls.
 * Automatically chooses between WASM (browser) and Tauri (desktop) implementations.
 */
export async function getDuckDBClient(): Promise<DuckDBClient> {
  if (clientInstance) return clientInstance
  if (initPromise) return initPromise

  initPromise = (async () => {
    clientInstance = await getRuntime().createDuckDBClient()
    return clientInstance
  })()

  return initPromise
}

/**
 * Check if the DuckDB client is currently using the native Tauri backend.
 */
export function isNativeBackend(): boolean {
  return isNativeRuntime()
}

/**
 * Reset the client instance (mainly for testing).
 */
export function resetDuckDBClient(): void {
  clientInstance = null
  initPromise = null
}
