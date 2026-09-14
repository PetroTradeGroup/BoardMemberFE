import { useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { useLocation } from 'react-router-dom'
import { Card } from '../components/Card/Card'
import { Button } from '../components/Button/Button'
import { friendlyError } from '../auth/friendlyError'
import logo from '../assets/petrotrade-logo.png'
import styles from './SignIn.module.css'

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

  function handleSignIn() {
    setRedirectError(undefined)
    setIsRedirecting(true)
    // `ProtectedRoute` stashes the originally-requested path in router state before bouncing an
    // unauthenticated visitor here; round-trip it through the OIDC `state` param so `Callback` can
    // send them back to their actual destination instead of always landing on `/home`.
    const fromPath = (location.state as { from?: string } | null)?.from
    auth.signinRedirect(fromPath ? { state: fromPath } : undefined).catch((error: unknown) => {
      // Only reached if signinRedirect fails before the browser navigates
      // away (e.g. Keycloak unreachable) — on success the page unloads.
      setIsRedirecting(false)
      setRedirectError(friendlyError(error))
    })
  }

  return (
    <main className={styles.page}>
      <Card className={styles.card}>
        <img src={logo} alt="Petrotrade" className={styles.logo} />
        <h1 className={styles.title}>Board and Committee Management System</h1>
        <p className={styles.subtitle}>Sign in with your organization account to continue.</p>
        <Button variant="primary" onClick={handleSignIn} disabled={isRedirecting}>
          Sign in
        </Button>
        {redirectError ? (
          <p className={styles.error} role="alert">
            {redirectError}
          </p>
        ) : null}
      </Card>
    </main>
  )
}
