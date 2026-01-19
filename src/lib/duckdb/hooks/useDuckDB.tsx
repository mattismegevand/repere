import { createContext, type ReactNode, useContext, useEffect, useState } from 'react'
import { getDuckDBClient } from '../client-factory'
import type { DuckDBClient } from '../interface'

interface DuckDBContextValue {
  /** The unified DuckDB client (works for both WASM and Tauri) */
  client: DuckDBClient | null
  loading: boolean
  error: Error | null
}

const DuckDBContext = createContext<DuckDBContextValue | null>(null)

export function DuckDBProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DuckDBContextValue>({
    client: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    let mounted = true

    getDuckDBClient()
      .then((client) => {
        if (!mounted) return
        setState({ client, loading: false, error: null })
      })
      .catch((error) => {
        if (!mounted) return
        setState({ client: null, loading: false, error })
      })

    return () => {
      mounted = false
    }
  }, [])

  return <DuckDBContext.Provider value={state}>{children}</DuckDBContext.Provider>
}

export function useDuckDB() {
  const ctx = useContext(DuckDBContext)
  if (!ctx) throw new Error('useDuckDB must be used within DuckDBProvider')
  return ctx
}
