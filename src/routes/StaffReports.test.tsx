import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { StaffReports } from './StaffReports'

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }))

vi.mock('react-oidc-context', () => ({
  useAuth: useAuthMock,
}))

function mockAuth() {
  useAuthMock.mockReturnValue({ user: { access_token: 'checker-token' } })
}

/** URL-substring-routed fetch mock -- resilient to the exact number/order of requests a render
 * fires (some report tabs also run a user-directory lookup for name resolution). Any route not
 * listed defaults to an empty user directory. */
function mockFetch(routes: [string, unknown][]) {
  const fetchMock = fetch as ReturnType<typeof vi.fn>
  const allRoutes: [string, unknown][] = [
    ...routes,
    ['/api/v1/users', { items: [], page: 1, pageSize: 0, totalItems: 0 }],
  ]
  fetchMock.mockImplementation(async (url: string) => {
    for (const [substring, body] of allRoutes) {
      if (url.includes(substring)) {
        return { ok: true, json: async () => body }
      }
    }
    return { ok: false, json: async () => ({ error: { message: `Unmocked fetch: ${url}` } }) }
  })
}

function findCall(fetchMock: ReturnType<typeof vi.fn>, urlSubstring: string) {
  return fetchMock.mock.calls.find((call) => String(call[0]).includes(urlSubstring))
}

describe('StaffReports', () => {
  beforeEach(() => {
    mockAuth()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('runs the Attendance report and shows the byMeeting table', async () => {
    mockFetch([
      ['/api/v1/reports/attendance', {
        byMeeting: [{ meetingId: 'm1', meetingTitle: 'Q3 Board Meeting', committee: 'Main Board', physical: 2, virtual: 1, apologized: 0, noResponse: 1 }],
        byCommittee: [],
        physicalVsVirtual: { physical: 2, virtual: 1 },
      }],
    ])

    render(<StaffReports />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Run report' }))

    expect(await screen.findByText('Q3 Board Meeting')).toBeInTheDocument()
    expect(screen.getByLabelText('Physical: 2')).toBeInTheDocument()
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    expect(findCall(fetchMock, '/api/v1/reports/attendance')).toBeDefined()
  })

  it('switches to the Governance tab and runs its own report', async () => {
    mockFetch([
      ['/api/v1/reports/governance', { conflictsOfInterest: [], apologies: [], membershipChanges: [] }],
    ])

    render(<StaffReports />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: 'Governance' }))
    await user.click(screen.getByRole('button', { name: 'Run report' }))

    expect(await screen.findByText('Conflicts of Interest')).toBeInTheDocument()
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    expect(findCall(fetchMock, '/api/v1/reports/governance')).toBeDefined()
  })
})
