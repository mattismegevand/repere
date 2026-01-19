import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock platform detection
let mockIsTauri = false
vi.mock('@/lib/platform', () => ({
  isTauri: () => mockIsTauri,
}))

// Mock the client implementations
const mockTauriClient = {
  isReady: vi.fn(() => true),
  query: vi.fn(),
}

const mockWasmClient = {
  isReady: vi.fn(() => true),
  query: vi.fn(),
}

// Use a proper class mock for TauriDuckDBClient
class MockTauriDuckDBClient {
  isReady = mockTauriClient.isReady
  query = mockTauriClient.query
}

vi.mock('@/lib/duckdb/tauri-client', () => ({
  TauriDuckDBClient: MockTauriDuckDBClient,
}))

vi.mock('@/lib/duckdb/wasm-client', () => ({
  WasmDuckDBClient: {
    create: vi.fn(() => Promise.resolve(mockWasmClient)),
  },
}))

import { getDuckDBClient, isNativeBackend, resetDuckDBClient } from '@/lib/duckdb/client-factory'
import { WasmDuckDBClient } from '@/lib/duckdb/wasm-client'

describe('client-factory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetDuckDBClient()
    mockIsTauri = false
  })

  afterEach(() => {
    resetDuckDBClient()
  })

  describe('getDuckDBClient', () => {
    it('should return TauriDuckDBClient when running in Tauri', async () => {
      mockIsTauri = true

      const client = await getDuckDBClient()

      expect(client).toBeInstanceOf(MockTauriDuckDBClient)
    })

    it('should return WasmDuckDBClient when running in browser', async () => {
      mockIsTauri = false

      const client = await getDuckDBClient()

      expect(WasmDuckDBClient.create).toHaveBeenCalled()
      expect(client).toBe(mockWasmClient)
    })

    it('should cache and return same instance on subsequent calls', async () => {
      mockIsTauri = false

      const client1 = await getDuckDBClient()
      const client2 = await getDuckDBClient()

      expect(client1).toBe(client2)
      expect(WasmDuckDBClient.create).toHaveBeenCalledTimes(1)
    })

    it('should cache and return same Tauri instance on subsequent calls', async () => {
      mockIsTauri = true

      const client1 = await getDuckDBClient()
      const client2 = await getDuckDBClient()

      expect(client1).toBe(client2)
      expect(client1).toBeInstanceOf(MockTauriDuckDBClient)
    })

    it('should handle concurrent initialization calls', async () => {
      mockIsTauri = false

      // Start multiple initializations concurrently
      const [client1, client2, client3] = await Promise.all([getDuckDBClient(), getDuckDBClient(), getDuckDBClient()])

      // All should return the same instance
      expect(client1).toBe(client2)
      expect(client2).toBe(client3)
      // Should only create once
      expect(WasmDuckDBClient.create).toHaveBeenCalledTimes(1)
    })
  })

  describe('isNativeBackend', () => {
    it('should return true when in Tauri', () => {
      mockIsTauri = true
      expect(isNativeBackend()).toBe(true)
    })

    it('should return false when in browser', () => {
      mockIsTauri = false
      expect(isNativeBackend()).toBe(false)
    })
  })

  describe('resetDuckDBClient', () => {
    it('should clear cached instance', async () => {
      mockIsTauri = false

      await getDuckDBClient()
      resetDuckDBClient()
      await getDuckDBClient()

      // Create should be called twice since cache was cleared
      expect(WasmDuckDBClient.create).toHaveBeenCalledTimes(2)
    })

    it('should allow switching between client types after reset', async () => {
      mockIsTauri = false
      const wasmClient = await getDuckDBClient()
      expect(wasmClient).toBe(mockWasmClient)

      resetDuckDBClient()
      mockIsTauri = true

      const tauriClient = await getDuckDBClient()
      expect(tauriClient).toBeInstanceOf(MockTauriDuckDBClient)
    })
  })
})
