/**
 * Maps a caught OIDC/network error to a short, user-appropriate message. Never render
 * `error.message` directly for an auth-flow failure — it can leak raw technical/internal text (a
 * fetch failure reason, an OIDC protocol detail) to an end user.
 * <p>
 * Deliberately narrow in scope: covers only the three raw OIDC/auth-flow error renders (SignIn's
 * `signinRedirect`, Home's `signoutRedirect`/change-password `signinRedirect`) — the many other
 * places in this app already handle `ApiError`/business-validation errors from the backend via a
 * separate, already-fine pattern this helper does not touch.
 */
export function friendlyError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    if (message.includes('fetch') || message.includes('network') || message.includes('unreachable')) {
      return 'Unable to reach the sign-in service. Check your connection and try again.'
    }
    if (message.includes('timeout')) {
      return 'The sign-in service took too long to respond. Please try again.'
    }
  }
  return 'Something went wrong. Please try again.'
}
