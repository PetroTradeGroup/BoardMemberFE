import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ProtectedRoute } from './ProtectedRoute'

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }))

vi.mock('react-oidc-context', () => ({
  useAuth: useAuthMock,
}))

function renderAtHome() {
  return render(
    <MemoryRouter initialEntries={['/home']}>
      <Routes>
        <Route path="/" element={<p>Sign in screen</p>} />
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <p>Home screen</p>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

function renderAdminRouteAt(initialEntry: string, accessToken: string | undefined) {
  useAuthMock.mockReturnValue({ isAuthenticated: true, isLoading: false, user: { access_token: accessToken } })

  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/home" element={<p>Home screen</p>} />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute requiredRole="admin">
              <p>Admin screen</p>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

/** Builds a syntactically valid (unsigned) JWT carrying the given realm roles. */
function fakeAccessToken(roles: string[]): string {
  const base64url = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${base64url({ alg: 'none' })}.${base64url({ realm_access: { roles } })}.`
}

describe('ProtectedRoute', () => {
  it('redirects to / when the visitor is unauthenticated', () => {
    useAuthMock.mockReturnValue({ isAuthenticated: false, isLoading: false })

    renderAtHome()

    expect(screen.getByText('Sign in screen')).toBeInTheDocument()
    expect(screen.queryByText('Home screen')).not.toBeInTheDocument()
  })

  it('renders the protected children when authenticated', () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true, isLoading: false })

    renderAtHome()

    expect(screen.getByText('Home screen')).toBeInTheDocument()
  })

  it('renders nothing (no redirect yet) while auth is still loading', () => {
    useAuthMock.mockReturnValue({ isAuthenticated: false, isLoading: true })

    renderAtHome()

    expect(screen.queryByText('Sign in screen')).not.toBeInTheDocument()
    expect(screen.queryByText('Home screen')).not.toBeInTheDocument()
  })

  it('renders the protected children when the access token carries requiredRole', () => {
    renderAdminRouteAt('/admin/users', fakeAccessToken(['admin']))

    expect(screen.getByText('Admin screen')).toBeInTheDocument()
  })

  it('redirects to /home when the access token lacks requiredRole', () => {
    renderAdminRouteAt('/admin/users', fakeAccessToken(['board_member']))

    expect(screen.getByText('Home screen')).toBeInTheDocument()
    expect(screen.queryByText('Admin screen')).not.toBeInTheDocument()
  })

  it('renders the protected children when requiredRole is an array and the token carries any one of them', () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { access_token: fakeAccessToken(['committee_member']) },
    })

    render(
      <MemoryRouter initialEntries={['/member/meetings']}>
        <Routes>
          <Route path="/home" element={<p>Home screen</p>} />
          <Route
            path="/member/meetings"
            element={
              <ProtectedRoute requiredRole={['board_member', 'committee_member']}>
                <p>Member meetings screen</p>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Member meetings screen')).toBeInTheDocument()
  })
})
