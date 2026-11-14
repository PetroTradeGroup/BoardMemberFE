import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MemberMeetings } from './MemberMeetings'

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }))

vi.mock('react-oidc-context', () => ({
  useAuth: useAuthMock,
}))

function mockAuth() {
  useAuthMock.mockReturnValue({ user: { access_token: 'member-token' } })
}

function renderComponent() {
  return render(
    <MemoryRouter>
      <MemberMeetings />
    </MemoryRouter>,
  )
}

describe('MemberMeetings', () => {
  beforeEach(() => {
    mockAuth()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('shows the empty state when no meetings are visible', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ items: [], page: 1, pageSize: 0, totalItems: 0 }) })

    renderComponent()

    expect(await screen.findByText(/^No meetings yet\./)).toBeInTheDocument()
  })

  it('lists visible meetings with an Approved badge and links to the detail screen', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          { id: 'meeting-1', title: 'Q3 Board Meeting', committee: 'Main Board', chairpersonUserId: 'chair-1', scheduledAt: '2099-01-01T09:00:00Z', status: 'APPROVED' },
        ],
        page: 1,
        pageSize: 1,
        totalItems: 1,
      }),
    })

    renderComponent()

    expect(await screen.findByText('Q3 Board Meeting')).toBeInTheDocument()
    expect(screen.getByText('Approved')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Q3 Board Meeting/ })).toHaveAttribute('href', '/member/meetings/meeting-1')
  })
})
