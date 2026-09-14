import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { StaffUsers } from './StaffUsers'

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }))

vi.mock('react-oidc-context', () => ({
  useAuth: useAuthMock,
}))

function mockAuth() {
  useAuthMock.mockReturnValue({ user: { access_token: 'checker-token' } })
}

describe('StaffUsers', () => {
  beforeEach(() => {
    mockAuth()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('shows the page heading', () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [], page: 1, pageSize: 0, totalItems: 0 }),
    })

    render(<StaffUsers />)

    expect(screen.getByRole('heading', { name: 'Users' })).toBeInTheDocument()
  })

  it('loads and displays the user list', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{ id: '1', firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', enabled: true }],
        page: 1,
        pageSize: 1,
        totalItems: 1,
      }),
    })

    render(<StaffUsers />)

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('jane@example.com')).toBeInTheDocument()
  })

  it('shows an empty state when there are no users', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [], page: 1, pageSize: 0, totalItems: 0 }),
    })

    render(<StaffUsers />)

    expect(await screen.findByText('No users yet.')).toBeInTheDocument()
  })

  it('shows an inline error if the list fails to load', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: { code: 'INTERNAL_ERROR', message: 'Something broke' } }),
    })

    render(<StaffUsers />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Something broke')
  })
})
