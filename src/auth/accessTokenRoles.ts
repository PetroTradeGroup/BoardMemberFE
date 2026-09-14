/**
 * UI-only role check (Story 2.2 route gating) — the backend's `@PreAuthorize` is the real
 * enforcement (AD-4/AD-5); this only decides whether to show/hide the admin nav and route, so a
 * wrong guess here is a UX annoyance, not a security hole. Keycloak's default protocol mapper
 * puts `realm_access.roles` on the access token, not necessarily the ID token, so this decodes
 * the raw access token JWT directly rather than relying on `user.profile`.
 */
export function accessTokenHasRole(accessToken: string | undefined, role: string): boolean {
  if (!accessToken) {
    return false
  }
  const payload = decodeJwtPayload(accessToken)
  const roles = payload?.realm_access?.roles
  return Array.isArray(roles) && roles.includes(role)
}

function decodeJwtPayload(token: string): { realm_access?: { roles?: unknown } } | undefined {
  const parts = token.split('.')
  if (parts.length !== 3) {
    return undefined
  }
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    return JSON.parse(atob(padded))
  }
  catch {
    return undefined
  }
}
