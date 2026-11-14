import { createRoot } from 'react-dom/client'
import { AuthProvider } from 'react-oidc-context'
import { missingEnvVars, oidcConfig } from './auth/oidcConfig'
import './index.css'
import App from './App.tsx'

// Strips `?code=&state=` (and restores the pre-redirect path) once the code
// exchange completes, so refreshing/bookmarking /callback never resubmits
// the single-use authorization code back to Keycloak.
function onSigninCallback() {
  window.history.replaceState({}, document.title, window.location.pathname)
}

const missing = missingEnvVars()

createRoot(document.getElementById('root')!).render(
  missing.length > 0 ? (
    // Fails clearly at startup rather than letting a missing/blank var propagate as `undefined`
    // deep into oidc-client-ts, where it would otherwise surface as an opaque, hard-to-diagnose
    // failure far from its actual cause (deferred-work.md, spec-1-2a).
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Configuration error</h1>
      <p>This app is missing required environment variable(s):</p>
      <ul>
        {missing.map((name) => (
          <li key={name}>
            <code>{name}</code>
          </li>
        ))}
      </ul>
      <p>Set these in your <code>.env</code> file (see <code>.env.example</code>) and reload.</p>
    </main>
  ) : (
    // No <StrictMode> here (deliberately removed): its dev-only double-invoke of effects makes
    // react-oidc-context/oidc-client-ts process the same signin callback twice -- the first pass
    // consumes (removes) the single-use OIDC signin state from InMemoryStateStore for CSRF
    // matching, so the second pass finds nothing there and fails with "No matching state found in
    // storage" on every single sign-in attempt in dev mode. A known interaction between this
    // library and StrictMode, not a bug in this app's own state store (see InMemoryStateStore.ts).
    <AuthProvider {...oidcConfig} onSigninCallback={onSigninCallback}>
      <App />
    </AuthProvider>
  ),
)
