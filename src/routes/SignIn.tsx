import { useEffect, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { useLocation } from 'react-router-dom'
import { Card } from '../components/Card/Card'
import { Button } from '../components/Button/Button'
import { friendlyError } from '../auth/friendlyError'
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import logo from '../assets/petrotrade-logo.png'

/**
 * Unauthenticated entry point (`/`): a Card with a primary "Sign in" Button
 * that redirects to Keycloak's hosted login page (Authorization Code +
 * PKCE). No password field lives in React — Keycloak collects it (AD-4).
 */
export function SignIn() {
  const auth = useAuth()
  const location = useLocation()
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [redirectError, setRedirectError] = useState<string>()

  // `ProtectedRoute` stashes the originally-requested path in router state before bouncing an
  // unauthenticated visitor here; round-trip it through the OIDC `state` param so `Callback` can
  // send them back to their actual destination instead of always landing on `/home`.
  const fromPath = (location.state as { from?: string } | null)?.from

  // Tokens live in memory only (AD-7), so a page reload drops the in-app session. When we got
  // here by being bounced off a protected page (the reload case), try a `prompt=none` redirect:
  // if Keycloak's SSO session is still alive it hands back a code with no login screen; if not,
  // it returns `login_required` and Callback sends the visitor back here (with no `from`, so
  // this can't loop). Plain visits to `/` and post-logout landings carry no `from` and are skipped.
  useEffect(() => {
    if (fromPath && !auth.isAuthenticated && !auth.isLoading) {
      setIsRedirecting(true)
      auth.signinRedirect({ state: fromPath, prompt: 'none' }).catch(() => setIsRedirecting(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSignIn() {
    setRedirectError(undefined)
    setIsRedirecting(true)
    auth.signinRedirect(fromPath ? { state: fromPath } : undefined).catch((error: unknown) => {
      // Only reached if signinRedirect fails before the browser navigates
      // away (e.g. Keycloak unreachable) — on success the page unloads.
      setIsRedirecting(false)
      setRedirectError(friendlyError(error))
    })
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      {/* Soft brand glow -- the one decorative surface in the app. */}
      <div
        className="pointer-events-none absolute left-1/3 top-1/4 size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-lime/15 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute right-0 bottom-0 size-[480px] translate-x-1/4 translate-y-1/4 rounded-full bg-brand-gold/15 blur-3xl"
        aria-hidden
      />
      <Card className="relative w-full max-w-sm overflow-hidden p-8">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-green via-brand-lime to-brand-gold" aria-hidden />
        <div className="flex flex-col items-center gap-6 text-center">
          <img src={logo} alt="Petrotrade" className="h-16 w-auto" />
          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight">Board and Committee Management System</h1>
            <p className="text-sm text-muted-foreground">Sign in with your organization account to continue.</p>
          </div>
          <Button variant="primary" className="h-10 w-full" onClick={handleSignIn} disabled={isRedirecting}>
            {isRedirecting ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
            Sign in
          </Button>
          {redirectError ? (
            <Alert variant="destructive" className="text-left">
              <AlertCircle />
              <AlertDescription>{redirectError}</AlertDescription>
            </Alert>
          ) : null}
          <p className="text-xs text-muted-foreground">Secured by Petrotrade single sign-on</p>
        </div>
      </Card>
    </main>
  )
}
