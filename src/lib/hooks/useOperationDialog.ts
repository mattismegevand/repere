import { useCallback, useState } from 'react'

interface OperationDialogState {
  loading: boolean
  error: string | null
}

export interface UseOperationDialogReturn extends OperationDialogState {
  setError: (error: string | null) => void
  clearError: () => void
  execute: <T>(fn: () => Promise<T>) => Promise<T | null>
}

export function useOperationDialog(): UseOperationDialogReturn {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => setError(null), [])

  const execute = useCallback(async <T>(fn: () => Promise<T>): Promise<T | null> => {
    setLoading(true)
    setError(null)
    try {
      const result = await fn()
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { loading, error, setError, clearError, execute }
}
