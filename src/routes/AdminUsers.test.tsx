import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { AdminUsers } from './AdminUsers'

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }))

vi.mock('react-oidc-context', () => ({
  useAuth: useAuthMock,
}))

function mockAuth() {
  useAuthMock.mockReturnValue({ user: { access_token: 'admin-token' } })
}

async function fillForm() {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('First name'), 'Jane')
  await user.type(screen.getByLabelText('Last name'), 'Doe')
  await user.type(screen.getByLabelText('Email'), 'jane@example.com')
  return user
}

describe('AdminUsers', () => {
  beforeEach(() => {
    mockAuth()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('loads and displays the existing user list on mount', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{ id: '1', firstName: 'Existing', lastName: 'User', email: 'existing@example.com', enabled: true }],
        page: 1,
        pageSize: 1,
        totalItems: 1,
      }),
    })

    render(<AdminUsers />)

    expect(await screen.findByText('existing@example.com')).toBeInTheDocument()
  })

  it('creates a user, shows success, and refreshes the list', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [], page: 1, pageSize: 0, totalItems: 0 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{ id: '2', firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', enabled: true }],
          page: 1,
          pageSize: 1,
          totalItems: 1,
        }),
      })

    render(<AdminUsers />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const user = await fillForm()
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('Jane Doe was created and can now sign in.')).toBeInTheDocument()
    expect(await screen.findByText('jane@example.com')).toBeInTheDocument()

    const createCall = fetchMock.mock.calls[1]
    expect(createCall[0]).toContain('/api/v1/users')
    expect(JSON.parse(createCall[1].body)).toEqual({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      role: 'BOARD_MEMBER',
    })
  })

  it('shows an inline, labelled validation error per field on a 400 response', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [], page: 1, pageSize: 0, totalItems: 0 }) })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            fields: [{ field: 'email', message: 'must be a well-formed email address' }],
          },
        }),
      })

    render(<AdminUsers />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const user = await fillForm()
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('must be a well-formed email address')).toBeInTheDocument()
  })
})
