import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AppShell } from './AppShell'

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }))

vi.mock('react-oidc-context', () => ({
  useAuth: useAuthMock,
}))

function mockAuth(overrides: Partial<{ signinRedirect: () => Promise<void>; signoutRedirect: () => Promise<void> }> = {}) {
  const auth = {
    user: { profile: { preferred_username: 'story14.test', sub: 'sub-1' }, access_token: undefined },
    signinRedirect: vi.fn().mockResolvedValue(undefined),
    signoutRedirect: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  useAuthMock.mockReturnValue(auth)
  return auth
}

function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/home']}>
      <AppShell>
        <p>Page content</p>
      </AppShell>
    </MemoryRouter>,
  )
}

/** A promise the test can resolve/reject on its own schedule, to observe the pending UI state. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('AppShell', () => {
  it('shows the signed-in username in the sidebar', () => {
    mockAuth()

    renderShell()

    expect(screen.getByTitle('story14.test')).toBeInTheDocument()
  })

  it('renders the page content passed as children', () => {
    mockAuth()

    renderShell()

    expect(screen.getByText('Page content')).toBeInTheDocument()
  })

  it('redirects to the Keycloak forced-reauth + UPDATE_PASSWORD action when Change password is clicked', async () => {
    const auth = mockAuth()
    const user = userEvent.setup()

    renderShell()
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    expect(auth.signinRedirect).toHaveBeenCalledWith({
      prompt: 'login',
      extraQueryParams: { kc_action: 'UPDATE_PASSWORD' },
    })
  })

  it('shows an inline error and re-enables both buttons if the change-password redirect rejects', async () => {
    mockAuth({ signinRedirect: vi.fn().mockRejectedValue(new Error('network down')) })
    const user = userEvent.setup()

    renderShell()
    const changePasswordButton = screen.getByRole('button', { name: 'Change password' })
    await user.click(changePasswordButton)

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(changePasswordButton).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeEnabled()
  })

  it('calls signoutRedirect when Sign out is clicked', async () => {
    const auth = mockAuth()
    const user = userEvent.setup()

    renderShell()
    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(auth.signoutRedirect).toHaveBeenCalledTimes(1)
  })

  it('disables both buttons while a change-password redirect is in flight, and ignores a second click', async () => {
    const pending = deferred<void>()
    const auth = mockAuth({ signinRedirect: vi.fn().mockReturnValue(pending.promise) })
    const user = userEvent.setup()

    renderShell()
    const changePasswordButton = screen.getByRole('button', { name: 'Change password' })
    const signOutButton = screen.getByRole('button', { name: 'Sign out' })

    await user.click(changePasswordButton)
    expect(changePasswordButton).toBeDisabled()
    expect(signOutButton).toBeDisabled()

    // A second click while still pending must not fire a second redirect.
    await user.click(changePasswordButton)
    expect(auth.signinRedirect).toHaveBeenCalledTimes(1)

    pending.resolve()
  })

  it('disables both buttons while a sign-out redirect is in flight', async () => {
    const pending = deferred<void>()
    mockAuth({ signoutRedirect: vi.fn().mockReturnValue(pending.promise) })
    const user = userEvent.setup()

    renderShell()
    const changePasswordButton = screen.getByRole('button', { name: 'Change password' })
    const signOutButton = screen.getByRole('button', { name: 'Sign out' })

    await user.click(signOutButton)

    expect(signOutButton).toBeDisabled()
    expect(changePasswordButton).toBeDisabled()

    pending.resolve()
  })
})
