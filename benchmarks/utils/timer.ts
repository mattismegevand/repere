/**
 * High-resolution timer for benchmarking
 */
class Timer {
  private startTime: number = 0
  private endTime: number = 0

  start(): void {
    this.startTime = performance.now()
  }

  stop(): number {
    this.endTime = performance.now()
    return this.elapsed()
  }

  elapsed(): number {
    return this.endTime - this.startTime
  }

  reset(): void {
    this.startTime = 0
    this.endTime = 0
  }
}

/**
 * Measure execution time of an async function
 */
export async function measureAsync<T>(fn: () => Promise<T>): Promise<{ result: T; elapsed: number }> {
  const start = performance.now()
  const result = await fn()
  const elapsed = performance.now() - start
  return { result, elapsed }
}

/**
 * Run garbage collection if available (Bun)
 */
export function forceGC(): void {
  if (typeof Bun !== 'undefined' && typeof Bun.gc === 'function') {
    Bun.gc(true)
  }
}
