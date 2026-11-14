import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Home } from './Home'

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }))

vi.mock('react-oidc-context', () => ({
  useAuth: useAuthMock,
}))

/** Builds a syntactically valid (unsigned) JWT carrying the given realm roles -- same helper
 * `ProtectedRoute.test.tsx` uses, `accessTokenHasRole` decodes the raw token, not a mock object. */
function fakeAccessToken(roles: string[]): string {
  const base64url = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${base64url({ alg: 'none' })}.${base64url({ realm_access: { roles } })}.`
}

function mockAuth(roles: string[]) {
  useAuthMock.mockReturnValue({
    user: { profile: { preferred_username: 'story14.test' }, access_token: fakeAccessToken(roles) },
  })
}

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body }
}

describe('Home', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('greets the signed-in user by name', () => {
    mockAuth([])

    render(<Home />)

    expect(screen.getByText('Welcome, story14.test')).toBeInTheDocument()
  })

  it('shows staff stat cards and charts sourced from the reports/meetings endpoints', async () => {
    mockAuth(['checker'])
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        byMeeting: [], byCommittee: [], physicalVsVirtual: { physical: 3, virtual: 1 },
      }))
      .mockResolvedValueOnce(jsonResponse({
        pending: [{ id: '1' }], approved: [{ id: '2' }, { id: '3' }], rejected: [], processingTimeByRecordType: [],
      }))
      .mockResolvedValueOnce(jsonResponse({ items: [], page: 1, pageSize: 0, totalItems: 5 }))
      .mockResolvedValueOnce(jsonResponse({ items: [], page: 1, pageSize: 0, totalItems: 0 }))

    render(<Home />)

    // Chart legends also print counts, so read each value from inside its own stat card.
    const statValue = (label: string) => screen.getByText(label).closest('.rounded-xl')?.querySelector('.font-mono')?.textContent
    await waitFor(() => expect(statValue('Meetings')).toBe('5'))
    expect(statValue('Pending Approvals')).toBe('1')
    expect(statValue('Approved Records')).toBe('2')
    expect(screen.getByText('Physical vs virtual attendance')).toBeInTheDocument()
  })

  it('shows the Users list for a Checker (widened beyond Admin so a Checker can see who a ' +
    'Keycloak user id in an approval record actually is)', async () => {
    mockAuth(['checker'])
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ byMeeting: [], byCommittee: [], physicalVsVirtual: { physical: 0, virtual: 0 } }))
      .mockResolvedValueOnce(jsonResponse({ pending: [], approved: [], rejected: [], processingTimeByRecordType: [] }))
      .mockResolvedValueOnce(jsonResponse({ items: [], page: 1, pageSize: 0, totalItems: 0 }))
      .mockResolvedValueOnce(jsonResponse({
        items: [{ id: 'u1', firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', enabled: true }],
        page: 1, pageSize: 1, totalItems: 1,
      }))

    render(<Home />)

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('jane@example.com')).toBeInTheDocument()
  })

  it('shows an inline error if the staff dashboard data fails to load', async () => {
    mockAuth(['legal_officer'])
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })

    render(<Home />)

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('shows member stat cards sourced from meetings/payslips endpoints', async () => {
    mockAuth(['board_member'])
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    const future = new Date(Date.now() + 86_400_000).toISOString()
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        items: [{ id: 'm1', scheduledAt: future }], page: 1, pageSize: 1, totalItems: 1,
      }))
      .mockResolvedValueOnce(jsonResponse({
        items: [{ id: 'p1', netAmount: 170, meetingTitle: 'X', committee: 'Main Board', position: 'MEMBER', grossAmount: 200, deductionsAmount: 30, generatedAt: future, viewed: false }],
        page: 1, pageSize: 1, totalItems: 1,
      }))

    render(<Home />)

    expect(await screen.findByText('Upcoming Meetings')).toBeInTheDocument()
    expect(screen.getByText('170.00')).toBeInTheDocument()
  })

  it('shows a fallback message for a role with no dashboard content', () => {
    mockAuth(['some_unmapped_role'])

    render(<Home />)

    expect(screen.getByText('Nothing to show here yet.')).toBeInTheDocument()
  })
})
