import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'

/**
 * `redirect_uri` target. `react-oidc-context`'s `AuthProvider` performs the
 * authorization-code exchange automatically once mounted on this path; this
 * screen just shows a loading state and then navigates to `/home`.
 */
export function Callback() {
  const auth = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (auth.isAuthenticated) {
      // `SignIn` round-trips the originally-requested path (captured by `ProtectedRoute`) through
      // the OIDC `state` param; it comes back here as `auth.user.state`. Falls back to `/home` if
      // absent, or if it isn't a plausible internal path — `state` is opaque request data, so
      // require it start with `/` as a basic open-redirect guard rather than trusting it blindly.
      const state = auth.user?.state
      const target = typeof state === 'string' && state.startsWith('/') ? state : '/home'
      navigate(target, { replace: true })
    }
  }, [auth.isAuthenticated, auth.user, navigate])

  // A silent (`prompt=none`) session-restore attempt from SignIn found no live Keycloak session:
  // not a real failure, just show the normal sign-in screen.
  const silentRestoreFailed = auth.error?.message === 'login_required'
  useEffect(() => {
    if (silentRestoreFailed) {
      navigate('/', { replace: true })
    }
  }, [silentRestoreFailed, navigate])

  if (silentRestoreFailed) {
    return null
  }

  if (auth.error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <p className="text-sm text-destructive" role="alert">
          Sign-in failed: {auth.error.message}
        </p>
        <Link className="text-sm font-medium text-primary underline-offset-4 hover:underline" to="/">
          Return to sign in
        </Link>
      </main>
    )
  }

  if (auth.isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">Signing you in…</p>
      </main>
    )
  }

  // Not loading, no error, and not authenticated: the code exchange ended
  // without producing a session (e.g. this route was opened directly, or a
  // stale/mismatched `state`). Never leave the visitor on an indefinite
  // spinner with no way back.
  if (!auth.isAuthenticated) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">Sign-in didn't complete.</p>
        <Link className="text-sm font-medium text-primary underline-offset-4 hover:underline" to="/">
          Return to sign in
        </Link>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">Signing you in…</p>
    </main>
  )
}
