import { WebStorageStateStore } from 'oidc-client-ts'
import { describe, expect, it } from 'vitest'
import { oidcConfig } from './oidcConfig'
import { InMemoryStateStore } from './InMemoryStateStore'

describe('oidcConfig', () => {
  it('keeps the User (live bearer token) in-memory-only, per AD-7', () => {
    expect(oidcConfig.userStore).toBeInstanceOf(InMemoryStateStore)
  })

  it('backs the signin-handshake state with sessionStorage, not memory -- it must survive ' +
    'signinRedirect()\'s full top-level navigation away to Keycloak and back, which an ' +
    'in-memory-only store cannot (caught live: every real sign-in failed with "No matching ' +
    'state found in storage" until this was split from userStore)', () => {
    expect(oidcConfig.stateStore).toBeInstanceOf(WebStorageStateStore)
    expect(oidcConfig.stateStore).not.toBeInstanceOf(InMemoryStateStore)
  })

  it('uses the Authorization Code flow', () => {
    expect(oidcConfig.response_type).toBe('code')
  })
})
