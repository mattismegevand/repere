import path from 'node:path'
import { NativeRunner } from './clients/native-runner'
import { WasmClientNode } from './clients/wasm-client-node'
import type { Backend, BenchmarkResult, DataSize, ScenarioName } from './config'
import { DEFAULT_CONFIG, SCENARIOS } from './config'
import { getScenario, type WasmScenario } from './scenarios'
import { calculateStats } from './utils/stats'
import { forceGC, measureAsync } from './utils/timer'

export interface RunnerOptions {
  backends: Backend[]
  sizes: DataSize[]
  scenarios: ScenarioName[]
  iterations: number
  warmup: number
  dataDir: string
  verbose?: boolean
}

interface RunnerProgress {
  current: number
  total: number
  scenario: string
  backend: Backend
  size: DataSize
}

type ProgressCallback = (progress: RunnerProgress) => void

export class BenchmarkRunner {
  private wasmClient: WasmClientNode | null = null
  private nativeRunner: NativeRunner
  private options: RunnerOptions

  constructor(options: Partial<RunnerOptions> = {}) {
    this.options = {
      backends: options.backends || ['wasm', 'native'],
      sizes: options.sizes || ['small', 'medium', 'large'],
      scenarios: options.scenarios || [...SCENARIOS],
      iterations: options.iterations || DEFAULT_CONFIG.iterations,
      warmup: options.warmup || DEFAULT_CONFIG.warmup,
      dataDir: options.dataDir || DEFAULT_CONFIG.dataDir,
      verbose: options.verbose || false,
    }
    this.nativeRunner = new NativeRunner()
  }

  private log(message: string): void {
    if (this.options.verbose) {
      console.log(message)
    }
  }

  async initialize(): Promise<void> {
    if (this.options.backends.includes('wasm')) {
      this.log('Initializing WASM client...')
      this.wasmClient = await WasmClientNode.create()
      this.log('WASM client ready')
    }

    if (this.options.backends.includes('native')) {
      const available = await this.nativeRunner.isAvailable()
      if (!available) {
        console.warn(
          `Native benchmark binary not found at ${this.nativeRunner.getBinaryPath()}\n` +
            'Build it with: cd src-tauri && cargo build --release --bin repere-benchmark'
        )
      }
    }
  }

  async runAll(onProgress?: ProgressCallback): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = []

    // Calculate total operations
    let total = 0
    for (const _backend of this.options.backends) {
      for (const _size of this.options.sizes) {
        for (const scenario of this.options.scenarios) {
          // Skip scenarios that need parquet data when using CSV file
          if (scenario === 'file-load-parquet') {
            // We'd need parquet files - skip for now unless generated
            continue
          }
          total++
        }
      }
    }

    let current = 0

    for (const size of this.options.sizes) {
      const dataPath = path.join(this.options.dataDir, size, 'benchmark.csv')
      const joinDataPath = path.join(this.options.dataDir, size, 'join_table.csv')

      for (const scenarioName of this.options.scenarios) {
        // Skip parquet scenarios for now (would need parquet files)
        if (scenarioName === 'file-load-parquet') {
          continue
        }

        for (const backend of this.options.backends) {
          current++
          onProgress?.({ current, total, scenario: scenarioName, backend, size })

          const result = await this.runScenario(scenarioName, backend, size, dataPath, joinDataPath)
          results.push(result)
        }
      }
    }

    return results
  }

  async runScenario(
    scenarioName: ScenarioName,
    backend: Backend,
    size: DataSize,
    dataPath: string,
    joinDataPath?: string
  ): Promise<BenchmarkResult> {
    if (backend === 'wasm') {
      return this.runWasmScenario(scenarioName, size, dataPath, joinDataPath)
    } else {
      return this.runNativeScenario(scenarioName, size, dataPath, joinDataPath)
    }
  }

  private async runWasmScenario(
    scenarioName: ScenarioName,
    size: DataSize,
    dataPath: string,
    joinDataPath?: string
  ): Promise<BenchmarkResult> {
    if (!this.wasmClient) {
      throw new Error('WASM client not initialized')
    }

    const scenario = getScenario(scenarioName)
    const tableName = `bench_${Date.now()}`

    const ctx = {
      client: this.wasmClient,
      dataPath,
      secondaryDataPath: joinDataPath,
      tableName,
    }

    // Setup
    if (scenario.setup) {
      this.log(`  Setting up ${scenarioName}...`)
      await scenario.setup(ctx)
    }

    // Warmup runs
    this.log(`  Warming up (${this.options.warmup} runs)...`)
    for (let i = 0; i < this.options.warmup; i++) {
      await this.runScenarioOnce(scenario, ctx)
      // Clean up between runs for file-loading scenarios
      if (scenario.category === 'file-loading') {
        await scenario.teardown?.(ctx)
        ctx.tableName = `bench_${Date.now()}_${i}`
      }
    }

    // Timed runs
    const timings: number[] = []
    this.log(`  Running (${this.options.iterations} iterations)...`)

    for (let i = 0; i < this.options.iterations; i++) {
      forceGC()

      // For file-loading scenarios, clean up before each run
      if (scenario.category === 'file-loading') {
        ctx.tableName = `bench_${Date.now()}_iter_${i}`
      }

      const { elapsed } = await measureAsync(() => this.runScenarioOnce(scenario, ctx))
      timings.push(elapsed)

      // Clean up after file-loading
      if (scenario.category === 'file-loading') {
        await scenario.teardown?.(ctx)
      }
    }

    // Final teardown (for non file-loading scenarios)
    if (scenario.category !== 'file-loading' && scenario.teardown) {
      await scenario.teardown(ctx)
    }

    const stats = calculateStats(timings)

    return {
      scenario: scenarioName,
      backend: 'wasm',
      size,
      iterations: this.options.iterations,
      timings,
      ...stats,
    }
  }

  private async runScenarioOnce(
    scenario: WasmScenario,
    ctx: { client: WasmClientNode; dataPath: string; secondaryDataPath?: string; tableName: string }
  ): Promise<void> {
    await scenario.run(ctx)
  }

  private async runNativeScenario(
    scenarioName: ScenarioName,
    size: DataSize,
    dataPath: string,
    joinDataPath?: string
  ): Promise<BenchmarkResult> {
    const available = await this.nativeRunner.isAvailable()
    if (!available) {
      return {
        scenario: scenarioName,
        backend: 'native',
        size,
        iterations: 0,
        timings: [],
        mean: 0,
        median: 0,
        p95: 0,
        min: 0,
        max: 0,
        stddev: 0,
      }
    }

    // Native runner handles warmup internally
    const totalIterations = this.options.warmup + this.options.iterations

    const result = await this.nativeRunner.run(
      scenarioName,
      dataPath,
      totalIterations,
      scenarioName === 'op-join' ? joinDataPath : undefined
    )

    if (!result.success) {
      console.error(`Native benchmark failed: ${result.error}`)
      return {
        scenario: scenarioName,
        backend: 'native',
        size,
        iterations: 0,
        timings: [],
        mean: 0,
        median: 0,
        p95: 0,
        min: 0,
        max: 0,
        stddev: 0,
      }
    }

    // Skip warmup iterations
    const timings = result.timings_ms.slice(this.options.warmup)
    const stats = calculateStats(timings)

    return {
      scenario: scenarioName,
      backend: 'native',
      size,
      iterations: timings.length,
      timings,
      ...stats,
    }
  }

  async close(): Promise<void> {
    if (this.wasmClient) {
      await this.wasmClient.close()
      this.wasmClient = null
    }
  }
}

/**
 * Get data paths for a specific size
 */
function getDataPaths(dataDir: string, size: DataSize): { main: string; join: string } {
  return {
    main: path.join(dataDir, size, 'benchmark.csv'),
    join: path.join(dataDir, size, 'join_table.csv'),
  }
}
