import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { StaffAttendanceRegister } from './StaffAttendanceRegister'

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }))

vi.mock('react-oidc-context', () => ({
  useAuth: useAuthMock,
}))

function mockAuth(token = 'lo-token') {
  useAuthMock.mockReturnValue({ user: { access_token: token } })
}

function renderAt(meetingId: string) {
  return render(
    <MemoryRouter initialEntries={[`/staff/meetings/${meetingId}/register`]}>
      <Routes>
        <Route path="/staff/meetings/:id/register" element={<StaffAttendanceRegister />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** A fake LO access token carrying the legal_officer realm role, so accessTokenHasRole resolves. */
function loAccessToken(): string {
  const base64url = (value: object) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${base64url({ alg: 'none' })}.${base64url({ realm_access: { roles: ['legal_officer'] } })}.`
}

/** URL-substring-routed fetch mock -- resilient to the exact number/order of requests a render
 * fires (e.g. the user-directory lookup runs alongside the register fetch). Routes are checked in
 * the order given, so list more specific paths (e.g. .../register/submit) before their prefixes
 * (e.g. .../register). A route's body may be an array, consumed one response per matching call
 * (repeating the last entry once exhausted) -- for endpoints hit more than once with different
 * results, like a register reloaded after an apology is saved. Any route not listed defaults to
 * an empty user directory. */
function mockFetch(routes: [string, unknown][]) {
  const fetchMock = fetch as ReturnType<typeof vi.fn>
  const allRoutes: [string, unknown][] = [
    ...routes,
    ['/api/v1/users', { items: [], page: 1, pageSize: 0, totalItems: 0 }],
  ]
  const cursors = new Map<string, number>()
  fetchMock.mockImplementation(async (url: string) => {
    for (const [substring, body] of allRoutes) {
      if (url.includes(substring)) {
        if (Array.isArray(body)) {
          const index = cursors.get(substring) ?? 0
          cursors.set(substring, Math.min(index + 1, body.length - 1))
          return { ok: true, json: async () => body[Math.min(index, body.length - 1)] }
        }
        return { ok: true, json: async () => body }
      }
    }
    return { ok: false, json: async () => ({ error: { message: `Unmocked fetch: ${url}` } }) }
  })
}

function findCall(fetchMock: ReturnType<typeof vi.fn>, urlSubstring: string) {
  return fetchMock.mock.calls.find((call) => String(call[0]).includes(urlSubstring))
}

const draftRegister = {
  id: 'register-1',
  meetingId: 'meeting-1',
  meetingTitle: 'Q3 Board Meeting',
  committee: 'Main Board',
  status: 'DRAFT',
  rejectionReason: null,
  entries: [
    { memberUserId: 'member-1', status: 'PHYSICAL', attendanceType: 'PHYSICAL', conflictOfInterest: null, apologyReason: null },
    { memberUserId: 'member-2', status: 'NO_RESPONSE', attendanceType: null, conflictOfInterest: null, apologyReason: null },
  ],
}

describe('StaffAttendanceRegister', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('loads and displays the compiled register, including a Draft label not a status badge', async () => {
    mockAuth(loAccessToken())
    mockFetch([['/api/v1/meetings/meeting-1/register', draftRegister]])

    renderAt('meeting-1')

    expect(await screen.findByText('Q3 Board Meeting')).toBeInTheDocument()
    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(screen.getByText('Physical')).toBeInTheDocument()
    expect(screen.getByText('No response')).toBeInTheDocument()
    // Only the no-response member gets a Record apology action -- not the one who already
    // recorded their own attendance type.
    expect(screen.getAllByRole('button', { name: 'Record apology' })).toHaveLength(1)
  })

  it('Legal Officer records an apology for a member with no response', async () => {
    mockAuth(loAccessToken())
    const apologizedRegister = {
      ...draftRegister,
      entries: [
        draftRegister.entries[0],
        { memberUserId: 'member-2', status: 'APOLOGIZED', attendanceType: null, conflictOfInterest: null, apologyReason: 'Travelling' },
      ],
    }
    mockFetch([
      ['/api/v1/meetings/meeting-1/apology/member-2', {
        meetingId: 'meeting-1', memberUserId: 'member-2', attendanceType: null, attendanceRecordedAt: null,
        conflictOfInterest: null, conflictDeclaredAt: null, apologyReason: 'Travelling', apologyRecordedAt: '2026-01-01T00:00:00Z',
      }],
      ['/api/v1/meetings/meeting-1/register', [draftRegister, apologizedRegister]],
    ])

    renderAt('meeting-1')
    const user = userEvent.setup()

    await screen.findByText('Q3 Board Meeting')
    await user.click(screen.getByRole('button', { name: 'Record apology' }))
    await user.type(screen.getByLabelText('Apology reason'), 'Travelling')
    await user.click(screen.getByRole('button', { name: 'Save apology' }))

    expect(await screen.findByText('Apologized')).toBeInTheDocument()
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    const apologyCall = findCall(fetchMock, '/api/v1/meetings/meeting-1/apology/member-2')
    expect(apologyCall).toBeDefined()
    expect(JSON.parse((apologyCall as [string, RequestInit])[1].body as string)).toEqual({ reason: 'Travelling' })
  })

  it('Legal Officer submits the register for approval', async () => {
    mockAuth(loAccessToken())
    mockFetch([
      ['/api/v1/meetings/meeting-1/register/submit', { ...draftRegister, status: 'PENDING_APPROVAL' }],
      ['/api/v1/meetings/meeting-1/register', draftRegister],
    ])

    renderAt('meeting-1')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Submit for Approval' }))

    expect(await screen.findByText('Pending Approval')).toBeInTheDocument()
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    expect(findCall(fetchMock, '/api/v1/meetings/meeting-1/register/submit')).toBeDefined()
  })
})
