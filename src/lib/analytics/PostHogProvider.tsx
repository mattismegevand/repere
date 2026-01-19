import { PostHogProvider as PHProvider } from 'posthog-js/react'
import type { ReactNode } from 'react'

const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY
const posthogHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

const options = {
  api_host: posthogHost,
  person_profiles: 'identified_only' as const,
  capture_pageview: true,
  capture_pageleave: true,
  // Session replay config
  session_recording: {
    maskAllInputs: true,
    maskTextSelector: '[data-ph-mask]', // Add this attribute to sensitive elements
  },
}

export function PostHogProvider({ children }: { children: ReactNode }) {
  if (!posthogKey) {
    return <>{children}</>
  }

  return (
    <PHProvider apiKey={posthogKey} options={options}>
      {children}
    </PHProvider>
  )
}
