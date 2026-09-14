import { WebStorageStateStore, type UserManagerSettings } from 'oidc-client-ts'
import { InMemoryStateStore } from './InMemoryStateStore'

// `userStore` (the signed-in User, including its live access/refresh token) is the one AD-7 is
// actually about — an XSS payload reading Web Storage could steal a reusable bearer token, so
// this never leaves JS memory.
const inMemoryStateStore = new InMemoryStateStore()

// `stateStore` (the ephemeral signin-handshake data: PKCE code verifier + CSRF nonce, no bearer
// token) CANNOT be in-memory-only, unlike userStore above -- `signinRedirect()` does a full
// top-level browser navigation to Keycloak (that's what "Redirect" means, as opposed to
// `signinPopup`/`signinSilent`), which tears down this page's JS heap entirely. An in-memory
// store is empty by the time Keycloak redirects back to /callback on a fresh page load, so every
// signin would fail with oidc-client-ts's "No matching state found in storage" -- caught live,
// not in review; the original in-memory choice here was never actually exercised through a real
// browser redirect round-trip before now (every live verification this project ran used the
// direct-grant/password client instead, which never redirects at all). sessionStorage survives
// that exact navigation while still being cleared when the tab closes, and never holds a token --
// an XSS payload reading it only gets a single-use, short-window signin correlation value, not
// live credential material.
const sessionScopedStateStore = new WebStorageStateStore({ store: window.sessionStorage })

export const REQUIRED_ENV_VARS = ['VITE_KEYCLOAK_ISSUER', 'VITE_KEYCLOAK_CLIENT_ID', 'VITE_API_BASE_URL'] as const

/**
 * A missing/blank required `VITE_*` var otherwise propagates as `undefined` deep into
 * `oidc-client-ts`, surfacing as an opaque failure far from its actual cause. Checked once at
 * startup (see `main.tsx`) so a misconfigured environment fails with a clear, readable message
 * instead.
 */
export function missingEnvVars(): string[] {
  return REQUIRED_ENV_VARS.filter((name) => {
    const value = import.meta.env[name]
    return typeof value !== 'string' || value.trim() === ''
  })
}

export const oidcConfig: UserManagerSettings = {
  authority: import.meta.env.VITE_KEYCLOAK_ISSUER,
  client_id: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
  redirect_uri: `${window.location.origin}/callback`,
  post_logout_redirect_uri: `${window.location.origin}/`,
  response_type: 'code',
  scope: 'openid profile email',
  stateStore: sessionScopedStateStore,
  userStore: inMemoryStateStore,
  // Otherwise the access/refresh token stays valid at Keycloak until its natural expiry after a
  // local "sign out" — signoutRedirect() only clears this app's own in-memory session state.
  revokeTokensOnSignout: true,
}
