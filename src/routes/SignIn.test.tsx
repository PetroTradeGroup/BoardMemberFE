import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { SignIn } from './SignIn'

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }))

vi.mock('react-oidc-context', () => ({
  useAuth: useAuthMock,
}))

function renderSignIn(initialEntry: string | { pathname: string; state?: unknown } = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <SignIn />
    </MemoryRouter>,
  )
}

describe('SignIn', () => {
  it('calls auth.signinRedirect with no state when there is no originally-requested path', async () => {
    const signinRedirect = vi.fn().mockResolvedValue(undefined)
    useAuthMock.mockReturnValue({ signinRedirect })
    const user = userEvent.setup()

    renderSignIn()
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(signinRedirect).toHaveBeenCalledWith(undefined)
  })

  it('silently restores the session (prompt=none) when bounced here from a protected page', async () => {
    const signinRedirect = vi.fn().mockResolvedValue(undefined)
    useAuthMock.mockReturnValue({ signinRedirect })

    renderSignIn({ pathname: '/', state: { from: '/staff/meetings' } })

    expect(signinRedirect).toHaveBeenCalledWith({ state: '/staff/meetings', prompt: 'none' })
  })

  it('passes the originally-requested path through as signinRedirect state on a manual sign-in', async () => {
    // Silent attempt fails (e.g. Keycloak unreachable) -> button re-enabled for a manual try.
    const signinRedirect = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValue(undefined)
    useAuthMock.mockReturnValue({ signinRedirect })
    const user = userEvent.setup()

    renderSignIn({ pathname: '/', state: { from: '/staff/meetings' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(signinRedirect).toHaveBeenLastCalledWith({ state: '/staff/meetings' })
  })

  it('shows a friendly inline error and re-enables the button if signinRedirect rejects', async () => {
    const signinRedirect = vi.fn().mockRejectedValue(new Error('network down'))
    useAuthMock.mockReturnValue({ signinRedirect })
    const user = userEvent.setup()

    renderSignIn()
    const button = screen.getByRole('button', { name: 'Sign in' })
    await user.click(button)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Unable to reach the sign-in service. Check your connection and try again.')
    expect(alert).not.toHaveTextContent('network down')
    expect(button).toBeEnabled()
  })
})
