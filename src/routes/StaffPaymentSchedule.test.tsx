import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { StaffPaymentSchedule } from './StaffPaymentSchedule'

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }))

vi.mock('react-oidc-context', () => ({
  useAuth: useAuthMock,
}))

function loAccessToken(): string {
  const base64url = (value: object) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${base64url({ alg: 'none' })}.${base64url({ realm_access: { roles: ['legal_officer'] } })}.`
}

function mockAuth() {
  useAuthMock.mockReturnValue({ user: { access_token: loAccessToken() } })
}

function renderAt(meetingId: string) {
  return render(
    <MemoryRouter initialEntries={[`/staff/meetings/${meetingId}/payment-schedule`]}>
      <Routes>
        <Route path="/staff/meetings/:id/payment-schedule" element={<StaffPaymentSchedule />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** URL-substring-routed fetch mock -- resilient to the exact number/order of requests a render
 * fires (e.g. the user-directory lookup runs alongside the schedule fetch). Routes are checked in
 * the order given, so list more specific paths before their prefixes. A route's body may be
 * `{ status, body }` to simulate a non-2xx response. Any route not listed defaults to an empty
 * user directory. */
function mockFetch(routes: [string, unknown][]) {
  const fetchMock = fetch as ReturnType<typeof vi.fn>
  const allRoutes: [string, unknown][] = [
    ...routes,
    ['/api/v1/users', { items: [], page: 1, pageSize: 0, totalItems: 0 }],
  ]
  fetchMock.mockImplementation(async (url: string) => {
    for (const [substring, body] of allRoutes) {
      if (url.includes(substring)) {
        if (body && typeof body === 'object' && 'status' in body && 'body' in body) {
          const failure = body as { status: number; body: unknown }
          return { ok: false, status: failure.status, json: async () => failure.body }
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

const draftSchedule = {
  id: 'schedule-1',
  meetingId: 'meeting-1',
  meetingTitle: 'Q3 Board Meeting',
  committee: 'Main Board',
  registerId: 'register-1',
  status: 'DRAFT',
  rejectionReason: null,
  lineItems: [
    {
      memberUserId: 'chair-1', position: 'CHAIRPERSON', attendanceStatus: 'PHYSICAL', includedViaException: false,
      rateApplied: 350, grossAmount: 350, deductionsAmount: 52.5, netAmount: 297.5,
    },
  ],
  excludedMembers: [
    { memberUserId: 'member-4', position: 'MEMBER', reason: 'APOLOGY_RECORDED', exceptionStatus: null },
  ],
  totalGross: 350,
  totalDeductions: 52.5,
  totalNet: 297.5,
}

describe('StaffPaymentSchedule', () => {
  beforeEach(() => {
    mockAuth()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('offers to generate a schedule when none exists yet', async () => {
    mockFetch([
      ['/api/v1/meetings/meeting-1/payment-schedule', {
        status: 404,
        body: { error: { code: 'PAYMENT_SCHEDULE_NOT_FOUND', message: 'No payment schedule has been generated yet for meeting meeting-1' } },
      }],
    ])

    renderAt('meeting-1')

    expect(await screen.findByRole('button', { name: 'Generate Payment Schedule' })).toBeInTheDocument()
  })

  it('renders the schedule table with correct totals and an excluded member row', async () => {
    mockFetch([['/api/v1/meetings/meeting-1/payment-schedule', draftSchedule]])

    renderAt('meeting-1')

    expect(await screen.findAllByText('297.50')).not.toHaveLength(0)
    expect(screen.getByText('Not included in this schedule')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Request Authorized Exception' })).toBeInTheDocument()
  })

  it('requests an Authorized Exception for an excluded member', async () => {
    mockFetch([
      ['/api/v1/meetings/meeting-1/payment-schedule', draftSchedule],
      ['/api/v1/authorized-exceptions', {
        id: 'exception-1', meetingId: 'meeting-1', memberUserId: 'member-4', reason: 'Late-recorded attendance',
        status: 'PENDING_APPROVAL', rejectionReason: null, requestedBy: 'lo-1', requestedAt: '2026-08-27T00:00:00Z',
      }],
    ])

    renderAt('meeting-1')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Request Authorized Exception' }))
    await user.type(screen.getByLabelText('Reason for exception'), 'Late-recorded attendance')
    await user.click(screen.getByRole('button', { name: 'Request exception' }))

    expect(await screen.findByText('Exception pending')).toBeInTheDocument()
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    const exceptionCall = findCall(fetchMock, '/api/v1/authorized-exceptions')
    expect(exceptionCall).toBeDefined()
    expect(JSON.parse((exceptionCall as [string, RequestInit])[1].body as string)).toEqual({
      meetingId: 'meeting-1', memberUserId: 'member-4', reason: 'Late-recorded attendance',
    })
  })

  it('submits the schedule for approval', async () => {
    mockFetch([
      ['/api/v1/payment-schedules/schedule-1/submit', { ...draftSchedule, status: 'PENDING_APPROVAL' }],
      ['/api/v1/meetings/meeting-1/payment-schedule', draftSchedule],
    ])

    renderAt('meeting-1')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Submit for Approval' }))

    expect(await screen.findByText('Awaiting Checker decision.')).toBeInTheDocument()
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    expect(findCall(fetchMock, '/api/v1/payment-schedules/schedule-1/submit')).toBeDefined()
  })
})
