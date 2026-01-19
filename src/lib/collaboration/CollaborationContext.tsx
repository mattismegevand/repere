import type { Id } from 'convex/_generated/dataModel'
import { createContext, type ReactNode, useCallback, useMemo, useState } from 'react'
import { useConvexSync } from './useConvexSync'

type CollaborationMode = 'local' | 'connected'

interface CollaborationContextValue {
  mode: CollaborationMode
  sessionId: Id<'sessions'> | null
  isAuthenticated: boolean
  userId: string | null

  // Actions
  connect: (sessionId: Id<'sessions'>) => void
  disconnect: () => void
  setAuth: (userId: string | null) => void

  // Sync functions (from useConvexSync)
  sync: ReturnType<typeof useConvexSync>
}

const CollaborationContext = createContext<CollaborationContextValue | null>(null)

interface CollaborationProviderProps {
  children: ReactNode
}

export function CollaborationProvider({ children }: CollaborationProviderProps) {
  const [sessionId, setSessionId] = useState<Id<'sessions'> | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const mode: CollaborationMode = sessionId ? 'connected' : 'local'
  const isAuthenticated = !!userId

  // Sync hook (only active when sessionId is set)
  const sync = useConvexSync(sessionId)

  const connect = useCallback((newSessionId: Id<'sessions'>) => {
    setSessionId(newSessionId)
  }, [])

  const disconnect = useCallback(() => {
    setSessionId(null)
  }, [])

  const setAuth = useCallback((newUserId: string | null) => {
    setUserId(newUserId)
    if (!newUserId) {
      // Disconnect when signing out
      setSessionId(null)
    }
  }, [])

  const value = useMemo(
    (): CollaborationContextValue => ({
      mode,
      sessionId,
      isAuthenticated,
      userId,
      connect,
      disconnect,
      setAuth,
      sync,
    }),
    [mode, sessionId, isAuthenticated, userId, connect, disconnect, setAuth, sync]
  )

  return <CollaborationContext.Provider value={value}>{children}</CollaborationContext.Provider>
}
