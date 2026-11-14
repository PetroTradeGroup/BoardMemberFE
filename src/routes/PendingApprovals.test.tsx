import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { PendingApprovals } from './PendingApprovals'

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }))

vi.mock('react-oidc-context', () => ({
  useAuth: useAuthMock,
}))

function mockAuth(sub = 'checker-1') {
  useAuthMock.mockReturnValue({ user: { access_token: 'checker-token', profile: { sub } } })
}

/** URL-substring-routed fetch mock -- resilient to the exact number/order of requests a render
 * fires (e.g. the user-directory lookup runs alongside the pending-approvals fetch). The user
 * directory is deliberately left unmocked (fails), since tests here assert the raw id fallback
 * a failed lookup produces. */
function mockFetch(routes: Record<string, unknown>) {
  const fetchMock = fetch as ReturnType<typeof vi.fn>
  const allRoutes: Record<string, unknown> = routes
  fetchMock.mockImplementation(async (url: string) => {
    for (const [substring, body] of Object.entries(allRoutes)) {
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

const pendingRecord = {
  id: 'approval-1',
  recordType: 'MEETING',
  recordId: 'meeting-1',
  status: 'PENDING_APPROVAL',
  submittedBy: 'lo-user-1',
  submittedAt: '2026-08-01T09:00:00Z',
  decidedBy: null,
  decidedAt: null,
  rejectionReason: null,
}

const meetingDetail = {
  id: 'meeting-1',
  title: 'Q3 Board Meeting',
  committee: 'Main Board',
  chairpersonUserId: 'chair-1',
  scheduledAt: '2026-09-15T10:00:00Z',
  status: 'PENDING_APPROVAL',
}

const membershipRecord = {
  id: 'approval-2',
  recordType: 'COMMITTEE_MEMBERSHIP',
  recordId: 'change-1',
  status: 'PENDING_APPROVAL',
  submittedBy: 'admin-1',
  submittedAt: '2026-08-01T09:00:00Z',
  decidedBy: null,
  decidedAt: null,
  rejectionReason: null,
}

const membershipChangeDetail = {
  id: 'change-1',
  committeeId: 'committee-1',
  committeeName: 'Finance Committee',
  memberUserId: 'member-1',
  action: 'ASSIGN',
  proposedBy: 'admin-1',
  proposedAt: '2026-08-01T09:00:00Z',
}

const registerRecord = {
  id: 'approval-3',
  recordType: 'ATTENDANCE_REGISTER',
  recordId: 'register-1',
  status: 'PENDING_APPROVAL',
  submittedBy: 'lo-user-1',
  submittedAt: '2026-08-01T09:00:00Z',
  decidedBy: null,
  decidedAt: null,
  rejectionReason: null,
}

const registerDetail = {
  id: 'register-1',
  meetingId: 'meeting-1',
  meetingTitle: 'Q3 Board Meeting',
  committee: 'Main Board',
  status: 'PENDING_APPROVAL',
  rejectionReason: null,
  entries: [
    { memberUserId: 'member-1', status: 'PHYSICAL', attendanceType: 'PHYSICAL', conflictOfInterest: null, apologyReason: null },
    { memberUserId: 'member-2', status: 'APOLOGIZED', attendanceType: null, conflictOfInterest: null, apologyReason: 'Travelling' },
  ],
}

describe('PendingApprovals', () => {
  beforeEach(() => {
    mockAuth()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('shows the empty state when nothing is pending', async () => {
    mockFetch({ '/api/v1/approvals/pending': [] })

    render(<PendingApprovals />)

    expect(await screen.findByText('Nothing pending your review.')).toBeInTheDocument()
  })

  it('lists a pending record and expands it to show Approve/Reject actions', async () => {
    mockFetch({
      '/api/v1/approvals/pending': [pendingRecord],
      '/api/v1/meetings/meeting-1': meetingDetail,
    })

    render(<PendingApprovals />)
    const user = userEvent.setup()

    expect(await screen.findByText(/submitted by lo-user-1/)).toBeInTheDocument()
    // Details are prefetched, so the collapsed row already shows the readable title.
    expect(await screen.findByText('Q3 Board Meeting')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
    await user.click(screen.getByText(/submitted by lo-user-1/))

    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument()
  })

  it('SoD guard: replaces actions with explanatory text when the Checker is also the submitter', async () => {
    mockAuth('lo-user-1')
    mockFetch({
      '/api/v1/approvals/pending': [pendingRecord],
      '/api/v1/meetings/meeting-1': meetingDetail,
    })

    render(<PendingApprovals />)
    const user = userEvent.setup()

    await user.click(await screen.findByText(/submitted by lo-user-1/))

    expect(await screen.findByText('You submitted this — a different reviewer must approve it.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
  })

  it('approving removes the record from the queue', async () => {
    mockFetch({
      '/api/v1/approvals/pending': [pendingRecord],
      '/api/v1/meetings/meeting-1': meetingDetail,
      '/api/v1/approvals/MEETING/meeting-1/approve': { ...pendingRecord, status: 'APPROVED' },
    })

    render(<PendingApprovals />)
    const user = userEvent.setup()

    await user.click(await screen.findByText(/submitted by lo-user-1/))
    await user.click(await screen.findByRole('button', { name: 'Approve' }))

    await waitFor(() => expect(screen.queryByText('Q3 Board Meeting')).not.toBeInTheDocument())
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    expect(findCall(fetchMock, '/api/v1/approvals/MEETING/meeting-1/approve')).toBeDefined()
  })

  it('rejecting requires a reason and sends it in the request body', async () => {
    mockFetch({
      '/api/v1/approvals/pending': [pendingRecord],
      '/api/v1/meetings/meeting-1': meetingDetail,
      '/api/v1/approvals/MEETING/meeting-1/reject': { ...pendingRecord, status: 'REJECTED', rejectionReason: 'Missing chairperson' },
    })

    render(<PendingApprovals />)
    const user = userEvent.setup()

    await user.click(await screen.findByText(/submitted by lo-user-1/))
    await user.click(await screen.findByRole('button', { name: 'Reject' }))

    const rejectButtonInDialog = within(screen.getByRole('dialog')).getByRole('button', { name: 'Reject' })
    expect(rejectButtonInDialog).toBeDisabled()

    await user.type(screen.getByLabelText('Reason'), 'Missing chairperson')
    expect(rejectButtonInDialog).not.toBeDisabled()

    await user.click(rejectButtonInDialog)

    await waitFor(() => expect(screen.queryByText('Q3 Board Meeting')).not.toBeInTheDocument())
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    const rejectCall = findCall(fetchMock, '/api/v1/approvals/MEETING/meeting-1/reject')
    expect(rejectCall).toBeDefined()
    expect(JSON.parse((rejectCall as [string, RequestInit])[1].body as string)).toEqual({ reason: 'Missing chairperson' })
  })

  it('renders a COMMITTEE_MEMBERSHIP record in the same unified queue, expanding to show its detail', async () => {
    mockFetch({
      '/api/v1/approvals/pending': [membershipRecord],
      '/api/v1/committee-memberships/change-1': membershipChangeDetail,
    })

    render(<PendingApprovals />)
    const user = userEvent.setup()

    expect(await screen.findByText(/submitted by admin-1/)).toBeInTheDocument()
    await user.click(screen.getByText(/submitted by admin-1/))

    expect(await screen.findByText('Assign to Finance Committee')).toBeInTheDocument()
    // Details render as label/value pairs (dt/dd) now, not "Label: value" strings.
    expect(await screen.findByText('member-1')).toBeInTheDocument()
    expect(screen.getByText('Assign')).toBeInTheDocument()
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    expect(findCall(fetchMock, '/api/v1/committee-memberships/change-1')).toBeDefined()
  })

  it('renders an ATTENDANCE_REGISTER record, expanding to show every member and their status', async () => {
    mockFetch({
      '/api/v1/approvals/pending': [registerRecord],
      '/api/v1/attendance-registers/register-1': registerDetail,
    })

    render(<PendingApprovals />)
    const user = userEvent.setup()

    expect(await screen.findByText(/submitted by lo-user-1/)).toBeInTheDocument()
    await user.click(screen.getByText(/submitted by lo-user-1/))

    expect(await screen.findByText('Attendance Register: Q3 Board Meeting')).toBeInTheDocument()
    expect(await screen.findByRole('row', { name: /member-1 Physical/ })).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /member-2 Apologized Apology: Travelling/ })).toBeInTheDocument()
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    expect(findCall(fetchMock, '/api/v1/attendance-registers/register-1')).toBeDefined()
  })

  it('renders a RATE_TABLE record, expanding to show the proposed position and rate', async () => {
    const rateTableRecord = {
      id: 'approval-5', recordType: 'RATE_TABLE', recordId: 'rate-change-1', status: 'PENDING_APPROVAL',
      submittedBy: 'admin-1', submittedAt: '2026-08-01T09:00:00Z', decidedBy: null, decidedAt: null, rejectionReason: null,
    }
    const rateChangeDetail = {
      id: 'rate-change-1', committeeId: 'committee-1', committeeName: 'Main Board', position: 'CHAIRPERSON',
      rate: 350, proposedBy: 'admin-1', proposedAt: '2026-08-01T09:00:00Z',
    }
    mockFetch({
      '/api/v1/approvals/pending': [rateTableRecord],
      '/api/v1/rate-table/rate-change-1': rateChangeDetail,
    })

    render(<PendingApprovals />)
    const user = userEvent.setup()

    expect(await screen.findByText(/submitted by admin-1/)).toBeInTheDocument()
    await user.click(screen.getByText(/submitted by admin-1/))

    expect(await screen.findByText('Rate: Chairperson — Main Board')).toBeInTheDocument()
    expect(screen.getByText('350.00')).toBeInTheDocument()
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    expect(findCall(fetchMock, '/api/v1/rate-table/rate-change-1')).toBeDefined()
  })

  it('renders a PAYMENT_SCHEDULE record, expanding to show line items and the total net', async () => {
    const scheduleRecord = {
      id: 'approval-6', recordType: 'PAYMENT_SCHEDULE', recordId: 'schedule-1', status: 'PENDING_APPROVAL',
      submittedBy: 'lo-1', submittedAt: '2026-08-01T09:00:00Z', decidedBy: null, decidedAt: null, rejectionReason: null,
    }
    const scheduleDetail = {
      id: 'schedule-1', meetingId: 'meeting-1', meetingTitle: 'Q3 Board Meeting', committee: 'Main Board',
      registerId: 'register-1', status: 'PENDING_APPROVAL', rejectionReason: null,
      lineItems: [{
        memberUserId: 'chair-1', position: 'CHAIRPERSON', attendanceStatus: 'PHYSICAL', includedViaException: false,
        rateApplied: 350, grossAmount: 350, deductionsAmount: 52.5, netAmount: 297.5,
      }],
      excludedMembers: [], totalGross: 350, totalDeductions: 52.5, totalNet: 297.5,
    }
    mockFetch({
      '/api/v1/approvals/pending': [scheduleRecord],
      '/api/v1/payment-schedules/schedule-1': scheduleDetail,
    })

    render(<PendingApprovals />)
    const user = userEvent.setup()

    expect(await screen.findByText(/submitted by lo-1/)).toBeInTheDocument()
    await user.click(screen.getByText(/submitted by lo-1/))

    expect(await screen.findByText('Payment Schedule: Q3 Board Meeting')).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /chair-1 Chairperson 297.50/ })).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /Total net 297.50/ })).toBeInTheDocument()
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    expect(findCall(fetchMock, '/api/v1/payment-schedules/schedule-1')).toBeDefined()
  })

  it('renders an AUTHORIZED_EXCEPTION record, expanding to show the member and reason', async () => {
    const exceptionRecord = {
      id: 'approval-7', recordType: 'AUTHORIZED_EXCEPTION', recordId: 'exception-1', status: 'PENDING_APPROVAL',
      submittedBy: 'lo-1', submittedAt: '2026-08-01T09:00:00Z', decidedBy: null, decidedAt: null, rejectionReason: null,
    }
    const exceptionDetail = {
      id: 'exception-1', meetingId: 'meeting-1', memberUserId: 'member-4', reason: 'Late-recorded attendance',
      status: 'PENDING_APPROVAL', rejectionReason: null, requestedBy: 'lo-1', requestedAt: '2026-08-01T09:00:00Z',
    }
    mockFetch({
      '/api/v1/approvals/pending': [exceptionRecord],
      '/api/v1/authorized-exceptions/exception-1': exceptionDetail,
    })

    render(<PendingApprovals />)
    const user = userEvent.setup()

    expect(await screen.findByText(/submitted by lo-1/)).toBeInTheDocument()
    await user.click(screen.getByText(/submitted by lo-1/))

    expect(await screen.findByText('Authorized Exception: member-4')).toBeInTheDocument()
    expect(screen.getByText('Late-recorded attendance')).toBeInTheDocument()
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    expect(findCall(fetchMock, '/api/v1/authorized-exceptions/exception-1')).toBeDefined()
  })
})
