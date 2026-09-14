import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { AdminCommitteeMembership } from './AdminCommitteeMembership'

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }))

vi.mock('react-oidc-context', () => ({
  useAuth: useAuthMock,
}))

function mockAuth() {
  useAuthMock.mockReturnValue({ user: { access_token: 'admin-token' } })
}

const committeesResponse = {
  items: [
    { id: 'committee-1', name: 'Main Board' },
    { id: 'committee-2', name: 'Finance Committee' },
  ],
  page: 1,
  pageSize: 2,
  totalItems: 2,
}

const usersResponse = {
  items: [{ id: 'user-1', firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', enabled: true }],
  page: 1,
  pageSize: 1,
  totalItems: 1,
}

describe('AdminCommitteeMembership', () => {
  beforeEach(() => {
    mockAuth()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('loads committees and users into the form selects', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => committeesResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => usersResponse })

    render(<AdminCommitteeMembership />)

    expect(await screen.findByRole('option', { name: 'Finance Committee' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Jane Doe (jane@example.com)' })).toBeInTheDocument()
  })

  it('proposes a membership change and shows a success message referencing the Pending Approvals queue', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => committeesResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => usersResponse })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'change-1',
          committeeId: 'committee-1',
          committeeName: 'Main Board',
          memberUserId: 'user-1',
          action: 'ASSIGN',
          proposedBy: 'admin-1',
          proposedAt: '2026-08-27T00:00:00Z',
        }),
      })

    render(<AdminCommitteeMembership />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Propose change' }))

    expect(await screen.findByText(/now appears in the Checker.s Pending Approvals queue/)).toBeInTheDocument()

    const proposeCall = fetchMock.mock.calls[2]
    expect(proposeCall[0]).toContain('/api/v1/committee-memberships')
    expect(JSON.parse(proposeCall[1].body)).toEqual({
      committeeId: 'committee-1',
      memberUserId: 'user-1',
      action: 'ASSIGN',
    })
  })

  it('shows an inline, labelled validation error per field on a 400 response', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => committeesResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => usersResponse })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            fields: [{ field: 'memberUserId', message: 'must not be blank' }],
          },
        }),
      })

    render(<AdminCommitteeMembership />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Propose change' }))

    expect(await screen.findByText('must not be blank')).toBeInTheDocument()
  })
})
