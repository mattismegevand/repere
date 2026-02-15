import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateDuckDBClient = vi.fn()
const mockIsNativeRuntime = vi.fn(() => false)

vi.mock('@/lib/runtime', () => ({
  getRuntime: () => ({
    kind: 'web',
    isTauri: false,
    createDuckDBClient: mockCreateDuckDBClient,
  }),
  isNativeRuntime: () => mockIsNativeRuntime(),
}))

import { getDuckDBClient, isNativeBackend, resetDuckDBClient } from '@/lib/duckdb/client-factory'

describe('client-factory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetDuckDBClient()
    mockIsNativeRuntime.mockReturnValue(false)
    mockCreateDuckDBClient.mockResolvedValue({
      execute: vi.fn(),
      query: vi.fn(),
      describe: vi.fn(),
      count: vi.fn(),
      close: vi.fn(),
    })
  })

  afterEach(() => {
    resetDuckDBClient()
  })

  it('creates and caches a client instance', async () => {
    const client1 = await getDuckDBClient()
    const client2 = await getDuckDBClient()

    expect(client1).toBe(client2)
    expect(mockCreateDuckDBClient).toHaveBeenCalledTimes(1)
  })

  it('deduplicates concurrent initialization', async () => {
    const [a, b, c] = await Promise.all([getDuckDBClient(), getDuckDBClient(), getDuckDBClient()])

    expect(a).toBe(b)
    expect(b).toBe(c)
    expect(mockCreateDuckDBClient).toHaveBeenCalledTimes(1)
  })

  it('resets cache and allows re-creation', async () => {
    await getDuckDBClient()
    resetDuckDBClient()
    await getDuckDBClient()

    expect(mockCreateDuckDBClient).toHaveBeenCalledTimes(2)
  })

  it('proxies isNativeBackend to runtime module', () => {
    mockIsNativeRuntime.mockReturnValue(true)
    expect(isNativeBackend()).toBe(true)

    mockIsNativeRuntime.mockReturnValue(false)
    expect(isNativeBackend()).toBe(false)
  })
})
