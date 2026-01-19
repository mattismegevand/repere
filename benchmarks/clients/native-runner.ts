import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import path from 'node:path'

interface NativeBenchmarkResult {
  scenario: string
  timings_ms: number[]
  success: boolean
  error?: string
}

/**
 * Runner for the native Rust benchmark binary.
 * Invokes the compiled binary and parses JSON output.
 */
export class NativeRunner {
  private binaryPath: string

  constructor(binaryPath?: string) {
    // Default to release build path relative to project root
    this.binaryPath = binaryPath || path.resolve(import.meta.dir, '../../src-tauri/target/release/repere-benchmark')
  }

  /**
   * Check if the native binary exists
   */
  async isAvailable(): Promise<boolean> {
    try {
      await access(this.binaryPath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get the expected binary path
   */
  getBinaryPath(): string {
    return this.binaryPath
  }

  /**
   * Run a benchmark scenario
   */
  async run(
    scenario: string,
    dataPath: string,
    iterations: number,
    secondaryDataPath?: string
  ): Promise<NativeBenchmarkResult> {
    const args = secondaryDataPath
      ? [scenario, dataPath, secondaryDataPath, String(iterations)]
      : [scenario, dataPath, String(iterations)]

    return new Promise((resolve) => {
      const proc = spawn(this.binaryPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      let stdout = ''
      let stderr = ''

      proc.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      proc.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      proc.on('close', (code) => {
        if (code !== 0) {
          resolve({
            scenario,
            timings_ms: [],
            success: false,
            error: stderr || `Process exited with code ${code}`,
          })
          return
        }

        try {
          const result = JSON.parse(stdout) as NativeBenchmarkResult
          resolve(result)
        } catch (e) {
          resolve({
            scenario,
            timings_ms: [],
            success: false,
            error: `Failed to parse output: ${e}. Output: ${stdout}`,
          })
        }
      })

      proc.on('error', (err) => {
        resolve({
          scenario,
          timings_ms: [],
          success: false,
          error: `Failed to spawn process: ${err.message}`,
        })
      })
    })
  }
}

/**
 * Build the native benchmark binary
 */
async function buildNativeBinary(release = true): Promise<{ success: boolean; error?: string }> {
  const args = ['build', '--bin', 'repere-benchmark']
  if (release) {
    args.push('--release')
  }

  return new Promise((resolve) => {
    const proc = spawn('cargo', args, {
      cwd: path.resolve(import.meta.dir, '../../src-tauri'),
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stderr = ''

    proc.stderr.on('data', (data) => {
      stderr += data.toString()
      // Print build progress
      process.stderr.write(data)
    })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true })
      } else {
        resolve({ success: false, error: stderr })
      }
    })

    proc.on('error', (err) => {
      resolve({ success: false, error: err.message })
    })
  })
}
