import type { StateStore } from 'oidc-client-ts'

/**
 * `oidc-client-ts` `StateStore` backed by a plain in-memory `Map`.
 *
 * AD-7: the signed-in `User` (which carries the live access/refresh token) must never be
 * persisted to `localStorage`/`sessionStorage` (an XSS payload could read either and reuse a
 * live bearer token) — this backs `oidcConfig.ts`'s `userStore` only. This store only ever lives
 * in JS memory, so a full page reload loses the in-app session entirely — the user lands back on
 * the Sign-in screen and must sign in again. (Automatic silent renewal via Keycloak's SSO cookie
 * is not wired up in this spec — see deferred-work.md.)
 * <p>
 * NOT used for `oidcConfig.ts`'s `stateStore` (the ephemeral signin-handshake data) — that one
 * must survive `signinRedirect()`'s full top-level navigation away to Keycloak and back, which an
 * in-memory store cannot (caught live: every real sign-in failed with "No matching state found in
 * storage" until this was split out). See `oidcConfig.ts`'s comment for why `sessionStorage` is
 * an acceptable, much narrower exception to the Web-Storage-avoidance rule for that one value.
 */
export class InMemoryStateStore implements StateStore {
  private readonly store = new Map<string, string>()

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value)
  }

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null
  }

  async remove(key: string): Promise<string | null> {
    const value = this.store.get(key) ?? null
    this.store.delete(key)
    return value
  }

  async getAllKeys(): Promise<string[]> {
    return Array.from(this.store.keys())
  }
}
