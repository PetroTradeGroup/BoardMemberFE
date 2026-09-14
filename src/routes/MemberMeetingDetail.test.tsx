import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MemberMeetingDetail } from './MemberMeetingDetail'
import type { MeetingResponse } from '../api/meetingsApi'

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }))

vi.mock('react-oidc-context', () => ({
  useAuth: useAuthMock,
}))

function mockAuth() {
  useAuthMock.mockReturnValue({ user: { access_token: 'member-token' } })
}

function renderAt(meeting: MeetingResponse) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: `/member/meetings/${meeting.id}`, state: { meeting } }]}>
      <Routes>
        <Route path="/member/meetings/:id" element={<MemberMeetingDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

const futureMeeting: MeetingResponse = {
  id: 'meeting-1',
  title: 'Q3 Board Meeting',
  committee: 'Main Board',
  chairpersonUserId: 'chair-1',
  scheduledAt: '2099-01-01T09:00:00Z',
  status: 'APPROVED',
}

const pastMeeting: MeetingResponse = { ...futureMeeting, id: 'meeting-2', scheduledAt: '2020-01-01T09:00:00Z' }

describe('MemberMeetingDetail', () => {
  beforeEach(() => {
    mockAuth()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('selecting Virtual records attendance', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          meetingId: 'meeting-1', memberUserId: 'member-1', attendanceType: null, attendanceRecordedAt: null,
          conflictOfInterest: null, conflictDeclaredAt: null, apologyReason: null, apologyRecordedAt: null,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          meetingId: 'meeting-1', memberUserId: 'member-1', attendanceType: 'VIRTUAL', attendanceRecordedAt: '2026-01-01T00:00:00Z',
          conflictOfInterest: null, conflictDeclaredAt: null, apologyReason: null, apologyRecordedAt: null,
        }),
      })

    renderAt(futureMeeting)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Virtual' }))

    expect(await screen.findByText('Currently set to virtual.')).toBeInTheDocument()
    const call = fetchMock.mock.calls[1]
    expect(call[0]).toContain('/api/v1/meetings/meeting-1/attendance')
    expect(JSON.parse(call[1].body)).toEqual({ attendanceType: 'VIRTUAL' })
  })

  it('shows a read-only caption once the meeting has started, with no selector', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        meetingId: 'meeting-2', memberUserId: 'member-1', attendanceType: 'PHYSICAL', attendanceRecordedAt: '2019-01-01T00:00:00Z',
        conflictOfInterest: null, conflictDeclaredAt: null, apologyReason: null, apologyRecordedAt: null,
      }),
    })

    renderAt(pastMeeting)

    expect(await screen.findByText('Attendance closed — meeting has started.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Physical' })).not.toBeInTheDocument()
  })

  it('saves a conflict-of-interest declaration', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          meetingId: 'meeting-1', memberUserId: 'member-1', attendanceType: null, attendanceRecordedAt: null,
          conflictOfInterest: null, conflictDeclaredAt: null, apologyReason: null, apologyRecordedAt: null,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          meetingId: 'meeting-1', memberUserId: 'member-1', attendanceType: null, attendanceRecordedAt: null,
          conflictOfInterest: 'Financial stake in Vendor X', conflictDeclaredAt: '2026-01-01T00:00:00Z',
          apologyReason: null, apologyRecordedAt: null,
        }),
      })

    renderAt(futureMeeting)
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText('Declaration'), 'Financial stake in Vendor X')
    await user.click(screen.getByRole('button', { name: 'Save declaration' }))

    expect(await screen.findByText('Declaration saved.')).toBeInTheDocument()
    const call = fetchMock.mock.calls[1]
    expect(call[0]).toContain('/api/v1/meetings/meeting-1/conflict-of-interest')
    expect(JSON.parse(call[1].body)).toEqual({ declaration: 'Financial stake in Vendor X' })
  })
})
