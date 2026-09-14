import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { Callback } from './Callback'

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }))

vi.mock('react-oidc-context', () => ({
  useAuth: useAuthMock,
}))

function renderAtCallback() {
  return render(
    <MemoryRouter initialEntries={['/callback']}>
      <Routes>
        <Route path="/" element={<p>Sign in screen</p>} />
        <Route path="/callback" element={<Callback />} />
        <Route path="/home" element={<p>Home screen</p>} />
        <Route path="/staff/meetings" element={<p>Staff meetings screen</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Callback', () => {
  it('shows a loading message while the code exchange is in flight', () => {
    useAuthMock.mockReturnValue({ isLoading: true, isAuthenticated: false, error: undefined })

    renderAtCallback()

    expect(screen.getByText('Signing you in…')).toBeInTheDocument()
  })

  it('navigates to /home once authenticated when no originally-requested path was carried through', () => {
    useAuthMock.mockReturnValue({ isLoading: false, isAuthenticated: true, error: undefined, user: {} })

    renderAtCallback()

    expect(screen.getByText('Home screen')).toBeInTheDocument()
  })

  it('navigates to the originally-requested path when auth.user.state carries one', () => {
    useAuthMock.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      error: undefined,
      user: { state: '/staff/meetings' },
    })

    renderAtCallback()

    expect(screen.getByText('Staff meetings screen')).toBeInTheDocument()
    expect(screen.queryByText('Home screen')).not.toBeInTheDocument()
  })

  it('falls back to /home when auth.user.state is not a plausible internal path', () => {
    useAuthMock.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      error: undefined,
      user: { state: 'https://evil.example.com' },
    })

    renderAtCallback()

    expect(screen.getByText('Home screen')).toBeInTheDocument()
  })

  it('shows the error message and a way back to sign-in when auth.error is set', () => {
    useAuthMock.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
      error: new Error('invalid_grant'),
    })

    renderAtCallback()

    expect(screen.getByRole('alert')).toHaveTextContent('invalid_grant')
    expect(screen.getByRole('link', { name: 'Return to sign in' })).toBeInTheDocument()
  })

  it('offers a way back to sign-in if the exchange ends with no error and no session', () => {
    useAuthMock.mockReturnValue({ isLoading: false, isAuthenticated: false, error: undefined })

    renderAtCallback()

    expect(screen.getByText("Sign-in didn't complete.")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Return to sign in' })).toBeInTheDocument()
  })
})
