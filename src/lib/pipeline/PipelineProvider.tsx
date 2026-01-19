import { createContext, type ReactNode, useContext, useEffect, useState } from 'react'
import { useDuckDB } from '@/lib/duckdb'
import { PipelineService } from './PipelineService'

interface PipelineServiceContextValue {
  service: PipelineService | null
  ready: boolean
}

const PipelineServiceContext = createContext<PipelineServiceContextValue>({
  service: null,
  ready: false,
})

export function PipelineServiceProvider({ children }: { children: ReactNode }) {
  const { client } = useDuckDB()
  const [service, setService] = useState<PipelineService | null>(null)

  useEffect(() => {
    if (client) {
      setService(new PipelineService(client))
    } else {
      setService(null)
    }
  }, [client])

  return (
    <PipelineServiceContext.Provider value={{ service, ready: !!service }}>{children}</PipelineServiceContext.Provider>
  )
}

export function usePipelineServiceOptional(): PipelineService | null {
  const { service } = useContext(PipelineServiceContext)
  return service
}
