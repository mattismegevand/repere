import { useAuth } from '@workos-inc/authkit-react'
import LogIn from 'lucide-react/dist/esm/icons/log-in'
import LogOut from 'lucide-react/dist/esm/icons/log-out'

// Only render if WorkOS is configured
const isWorkOSConfigured = !!import.meta.env.VITE_WORKOS_CLIENT_ID

function SignInButtonInner() {
  const { user, signIn, signOut, isLoading } = useAuth()

  if (isLoading) {
    return null
  }

  const isSignedIn = !!user

  return (
    <button
      onClick={() => (isSignedIn ? signOut() : signIn())}
      aria-label={isSignedIn ? 'Sign out' : 'Sign in'}
      title={isSignedIn ? 'Sign out' : 'Sign in to sync'}
      className="px-2 py-1 text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] rounded-md border border-[var(--color-border)] flex items-center gap-1.5"
    >
      {isSignedIn ? <LogOut className="h-3.5 w-3.5" /> : <LogIn className="h-3.5 w-3.5" />}
      {isSignedIn ? 'Sign out' : 'Sign in'}
    </button>
  )
}

export function SignInButton() {
  // Don't render anything if WorkOS is not configured
  if (!isWorkOSConfigured) {
    return null
  }

  return <SignInButtonInner />
}
