import { ConvexProviderWithAuthKit } from '@convex-dev/workos'
import { AuthKitProvider, useAuth } from '@workos-inc/authkit-react'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { PostHogProvider } from '@/lib/analytics'
import { CacheProvider } from '@/lib/cache'
import { CollaborationProvider } from '@/lib/collaboration'
import { DuckDBProvider } from '@/lib/duckdb'
import { PipelineServiceProvider } from '@/lib/pipeline/PipelineProvider'

import App from './App.tsx'
import './index.css'

// Initialize Convex client (only if URL is configured)
const convexUrl = import.meta.env.VITE_CONVEX_URL
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null

// WorkOS config (optional - app works without auth)
const workosClientId = import.meta.env.VITE_WORKOS_CLIENT_ID
const workosRedirectUri = import.meta.env.VITE_WORKOS_REDIRECT_URI || `${window.location.origin}/callback`

function Providers({ children }: { children: React.ReactNode }) {
  // If Convex is not configured, render without cloud sync
  if (!convex) {
    return (
      <DuckDBProvider>
        <CacheProvider>
          <PipelineServiceProvider>{children}</PipelineServiceProvider>
        </CacheProvider>
      </DuckDBProvider>
    )
  }

  // If WorkOS is not configured, render with Convex but without auth
  if (!workosClientId) {
    return (
      <ConvexProvider client={convex}>
        <DuckDBProvider>
          <CacheProvider>
            <PipelineServiceProvider>
              <CollaborationProvider>{children}</CollaborationProvider>
            </PipelineServiceProvider>
          </CacheProvider>
        </DuckDBProvider>
      </ConvexProvider>
    )
  }

  // Full setup with Convex + WorkOS auth
  return (
    <AuthKitProvider clientId={workosClientId} redirectUri={workosRedirectUri}>
      <ConvexProviderWithAuthKit client={convex} useAuth={useAuth}>
        <DuckDBProvider>
          <CacheProvider>
            <PipelineServiceProvider>
              <CollaborationProvider>{children}</CollaborationProvider>
            </PipelineServiceProvider>
          </CacheProvider>
        </DuckDBProvider>
      </ConvexProviderWithAuthKit>
    </AuthKitProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PostHogProvider>
      <Providers>
        <App />
      </Providers>
    </PostHogProvider>
  </StrictMode>
)
