/**
 * Shared types for Python execution across platforms
 */

export type PythonServiceStatus = 'unavailable' | 'loading' | 'ready' | 'busy'

export interface PythonExecutionResult {
  success: boolean
  // Output data as JSON string (for web/Pyodide)
  outputJson?: string
  // Output data as Parquet bytes (for Tauri/native)
  outputData?: Uint8Array
  // Row count of the result DataFrame
  rowCount?: number
  // Column info from the result DataFrame
  columns?: Array<{ name: string; dtype: string }>
  // Stdout from Python execution
  stdout: string
  // Stderr from Python execution
  stderr: string
  // Error message if execution failed
  error?: string
  // Matplotlib output as base64 PNG
  matplotlibOutput?: string
  // Execution time in milliseconds
  executionTimeMs: number
}

/**
 * Interface for Python executors (Pyodide or Tauri)
 */
export interface PythonExecutor {
  /**
   * Initialize the Python environment (lazy-loaded)
   */
  initialize(): Promise<void>

  /**
   * Execute Python code with a DataFrame input (JSON format - for Pyodide)
   * @param code Python code to execute (should set `result` variable)
   * @param inputJson JSON string representing the DataFrame
   * @returns Execution result with output DataFrame as JSON
   */
  executeJson?(code: string, inputJson: string): Promise<PythonExecutionResult>

  /**
   * Execute Python code with a DataFrame input (Parquet format - for Tauri)
   * @param code Python code to execute (should set `result` variable)
   * @param inputData Parquet bytes from DuckDB
   * @returns Execution result with output DataFrame as Parquet
   */
  executeParquet?(code: string, inputData: Uint8Array): Promise<PythonExecutionResult>

  /**
   * Get current executor status
   */
  getStatus(): PythonServiceStatus

  /**
   * Cleanup resources
   */
  dispose(): void
}
