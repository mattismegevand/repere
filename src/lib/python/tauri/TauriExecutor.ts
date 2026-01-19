/**
 * Tauri executor for native Python execution
 *
 * Uses Tauri commands to spawn Python subprocess for code execution.
 */

import { invoke } from '@tauri-apps/api/core'
import type { PythonExecutionResult, PythonExecutor, PythonServiceStatus } from '../types'

interface PythonCheckResult {
  available: boolean
  version: string
  packages_ok: boolean
  missing_packages: string[] | null
  python_path: string
}

interface TauriPythonResult {
  success: boolean
  output_data: number[] | null
  row_count: number | null
  columns: Array<{ name: string; dtype: string }> | null
  stdout: string
  stderr: string
  error: string | null
  matplotlib_output: string | null
  execution_time_ms: number
}

type StatusChangeCallback = (status: PythonServiceStatus, message?: string) => void

export class TauriExecutor implements PythonExecutor {
  private status: PythonServiceStatus = 'unavailable'
  private pythonVersion: string | null = null
  private missingPackages: string[] | null = null
  private statusCallbacks: StatusChangeCallback[] = []

  private setStatus(status: PythonServiceStatus, message?: string) {
    this.status = status
    for (const callback of this.statusCallbacks) {
      callback(status, message)
    }
  }

  onStatusChange(callback: StatusChangeCallback): () => void {
    this.statusCallbacks.push(callback)
    return () => {
      const index = this.statusCallbacks.indexOf(callback)
      if (index !== -1) {
        this.statusCallbacks.splice(index, 1)
      }
    }
  }

  async initialize(): Promise<void> {
    if (this.status === 'ready') return

    this.setStatus('loading', 'Checking Python installation...')

    try {
      const result = await invoke<PythonCheckResult>('python_check')

      if (!result.available) {
        this.setStatus('unavailable')
        throw new Error('Python 3 is not installed')
      }

      this.pythonVersion = result.version

      if (!result.packages_ok) {
        this.missingPackages = result.missing_packages ?? []
        this.setStatus('unavailable')
        throw new Error(
          `Missing Python packages: ${this.missingPackages.join(', ')}. ` +
            'Please install them with: pip install pandas numpy matplotlib pyarrow'
        )
      }

      this.setStatus('ready')
    } catch (error) {
      this.setStatus('unavailable')
      throw error
    }
  }

  async executeParquet(code: string, inputData: Uint8Array): Promise<PythonExecutionResult> {
    if (this.status !== 'ready') {
      await this.initialize()
    }

    this.setStatus('busy')

    try {
      // Convert Uint8Array to number[] for Tauri serialization
      const inputArray = Array.from(inputData)

      const result = await invoke<TauriPythonResult>('python_execute', {
        code,
        inputData: inputArray,
      })

      this.setStatus('ready')

      // Convert output_data back to Uint8Array if present
      const outputData = result.output_data ? new Uint8Array(result.output_data) : undefined

      return {
        success: result.success,
        outputData,
        rowCount: result.row_count ?? undefined,
        columns: result.columns ?? undefined,
        stdout: result.stdout,
        stderr: result.stderr,
        error: result.error ?? undefined,
        matplotlibOutput: result.matplotlib_output ?? undefined,
        executionTimeMs: result.execution_time_ms,
      }
    } catch (error) {
      this.setStatus('ready')

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stdout: '',
        stderr: '',
        executionTimeMs: 0,
      }
    }
  }

  getStatus(): PythonServiceStatus {
    return this.status
  }

  getPythonVersion(): string | null {
    return this.pythonVersion
  }

  getMissingPackages(): string[] | null {
    return this.missingPackages
  }

  dispose(): void {
    // Nothing to clean up for Tauri executor
    this.setStatus('unavailable')
  }
}
