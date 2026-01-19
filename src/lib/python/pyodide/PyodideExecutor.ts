/**
 * Pyodide executor for web platform
 *
 * Manages a Web Worker that runs Python code using Pyodide (Python in WebAssembly).
 */

import type { PythonExecutionResult, PythonExecutor, PythonServiceStatus } from '../types'

interface PendingExecution {
  resolve: (result: PythonExecutionResult) => void
  reject: (error: Error) => void
}

type StatusChangeCallback = (status: PythonServiceStatus, message?: string) => void

export class PyodideExecutor implements PythonExecutor {
  private worker: Worker | null = null
  private status: PythonServiceStatus = 'unavailable'
  private pendingExecutions = new Map<number, PendingExecution>()
  private nextId = 1
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
    if (this.worker) {
      // Already initialized or initializing
      if (this.status === 'ready') return
      if (this.status === 'loading') {
        // Wait for initialization to complete
        return new Promise((resolve, reject) => {
          const checkStatus = () => {
            if (this.status === 'ready') {
              resolve()
            } else if (this.status === 'unavailable') {
              reject(new Error('Pyodide initialization failed'))
            } else {
              setTimeout(checkStatus, 100)
            }
          }
          checkStatus()
        })
      }
    }

    this.setStatus('loading', 'Creating worker...')

    // Load worker from public folder (not bundled) to support importScripts from CDN
    this.worker = new Worker('/pyodide-worker.js')

    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Failed to create worker'))
        return
      }

      const handleMessage = (event: MessageEvent) => {
        const message = event.data

        switch (message.type) {
          case 'init-complete':
            this.setStatus('ready')
            resolve()
            break

          case 'init-error':
            this.setStatus('unavailable')
            reject(new Error(message.error))
            break

          case 'loading-progress':
            this.setStatus('loading', message.stage)
            break

          case 'execute-result': {
            const pending = this.pendingExecutions.get(message.id)
            if (pending) {
              this.pendingExecutions.delete(message.id)
              if (this.pendingExecutions.size === 0) {
                this.setStatus('ready')
              }
              pending.resolve(message.result)
            }
            break
          }

          case 'status':
            this.setStatus(message.status)
            break
        }
      }

      this.worker.addEventListener('message', handleMessage)
      this.worker.addEventListener('error', (error) => {
        this.setStatus('unavailable')
        reject(new Error(`Worker error: ${error.message}`))
      })

      // Start initialization
      this.worker.postMessage({ type: 'init' })
    })
  }

  async executeJson(code: string, inputJson: string): Promise<PythonExecutionResult> {
    if (!this.worker) {
      await this.initialize()
    }

    if (!this.worker) {
      return {
        success: false,
        error: 'Pyodide worker not available',
        stdout: '',
        stderr: '',
        executionTimeMs: 0,
      }
    }

    const id = this.nextId++
    this.setStatus('busy')

    return new Promise((resolve) => {
      this.pendingExecutions.set(id, { resolve, reject: () => {} })

      this.worker!.postMessage({ type: 'execute', id, code, inputJson })

      // Timeout after 5 minutes
      setTimeout(() => {
        const pending = this.pendingExecutions.get(id)
        if (pending) {
          this.pendingExecutions.delete(id)
          if (this.pendingExecutions.size === 0) {
            this.setStatus('ready')
          }
          pending.resolve({
            success: false,
            error: 'Execution timed out after 5 minutes',
            stdout: '',
            stderr: '',
            executionTimeMs: 300000,
          })
        }
      }, 300000)
    })
  }

  getStatus(): PythonServiceStatus {
    return this.status
  }

  dispose(): void {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    this.pendingExecutions.clear()
    this.setStatus('unavailable')
  }
}
