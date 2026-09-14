import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'
import { accessTokenHasRole } from './accessTokenRoles'
import { AppShell } from '../components/AppShell/AppShell'

export interface ProtectedRouteProps {
  children: ReactNode
  /** UI-only gate (Story 2.2) — see accessTokenRoles.ts. An array is an OR (any one role grants
   * access) — e.g. Story 5.2's Member screens are shared by both `board_member` and
   * `committee_member`. */
  requiredRole?: string | string[]
}

/**
 * Renders `children` when `auth.isAuthenticated`; otherwise redirects to
 * `/` instead of exposing the protected placeholder content. When
 * `requiredRole` is set and the signed-in user lacks it, redirects to
 * `/home` instead — they're authenticated, just not authorized for this
 * particular route.
 * <p>
 * The unauthenticated redirect carries the originally-requested path in router state
 * (`{ from: location.pathname }`) so {@code SignIn}/{@code Callback} can send the visitor back to
 * their actual destination after login instead of always landing on `/home` — this app now has
 * many protected routes across Admin/Staff/Member areas, so a deep link (e.g. a shared meeting
 * URL) losing its destination through the login round-trip is a real, not hypothetical, gap.
 */
export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const auth = useAuth()
  const location = useLocation()

  if (auth.isLoading) {
    return null
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/" state={{ from: location.pathname }} replace />
  }

  const requiredRoles = requiredRole === undefined ? [] : Array.isArray(requiredRole) ? requiredRole : [requiredRole]
  if (requiredRoles.length > 0 && !requiredRoles.some((role) => accessTokenHasRole(auth.user?.access_token, role))) {
    return <Navigate to="/home" replace />
  }

  return <AppShell>{children}</AppShell>
}
