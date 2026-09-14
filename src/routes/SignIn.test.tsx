import { render, screen } from '@testing-library/react'
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

  it('passes the originally-requested path through as signinRedirect state', async () => {
    const signinRedirect = vi.fn().mockResolvedValue(undefined)
    useAuthMock.mockReturnValue({ signinRedirect })
    const user = userEvent.setup()

    renderSignIn({ pathname: '/', state: { from: '/staff/meetings' } })
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(signinRedirect).toHaveBeenCalledWith({ state: '/staff/meetings' })
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
