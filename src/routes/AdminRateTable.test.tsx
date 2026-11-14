import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { AdminRateTable } from './AdminRateTable'

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

const ratesResponse = {
  items: [{ id: 'rate-1', position: 'CHAIRPERSON', committeeId: 'committee-1', committeeName: 'Main Board', rate: 350 }],
  page: 1,
  pageSize: 1,
  totalItems: 1,
}

describe('AdminRateTable', () => {
  beforeEach(() => {
    mockAuth()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('loads committees and the current rate table', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => committeesResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => ratesResponse })

    render(<AdminRateTable />)

    expect(await screen.findByRole('row', { name: /Main Board Chairperson 350.00/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Finance Committee' })).toBeInTheDocument()
  })

  it('proposes a rate change and shows a success message referencing the Pending Approvals queue', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => committeesResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => ratesResponse })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'change-1', committeeId: 'committee-1', committeeName: 'Main Board', position: 'CHAIRPERSON',
          rate: 400, proposedBy: 'admin-1', proposedAt: '2026-08-27T00:00:00Z',
        }),
      })

    render(<AdminRateTable />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Rate'), '400')
    await user.click(screen.getByRole('button', { name: 'Propose rate' }))

    expect(await screen.findByText(/now appears in the Checker.s Pending Approvals queue/)).toBeInTheDocument()

    const proposeCall = fetchMock.mock.calls[2]
    expect(proposeCall[0]).toContain('/api/v1/rate-table')
    expect(JSON.parse(proposeCall[1].body)).toEqual({ committeeId: 'committee-1', position: 'CHAIRPERSON', rate: 400 })
  })

  it('shows an inline, labelled validation error per field on a 400 response', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => committeesResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => ratesResponse })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', fields: [{ field: 'rate', message: 'must be positive' }] },
        }),
      })

    render(<AdminRateTable />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Rate'), '400')
    await user.click(screen.getByRole('button', { name: 'Propose rate' }))

    expect(await screen.findByText('must be positive')).toBeInTheDocument()
  })
})
