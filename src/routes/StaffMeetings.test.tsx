import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { StaffMeetings } from './StaffMeetings'

function renderStaffMeetings() {
  return render(
    <MemoryRouter>
      <StaffMeetings />
    </MemoryRouter>,
  )
}

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }))

vi.mock('react-oidc-context', () => ({
  useAuth: useAuthMock,
}))

function mockAuth() {
  useAuthMock.mockReturnValue({ user: { access_token: 'lo-token' } })
}

const emptyList = { ok: true, json: async () => ({ items: [], page: 1, pageSize: 0, totalItems: 0 }) }

async function fillAndSubmitForm() {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Title'), 'Q3 Board Meeting')
  fireEvent.change(screen.getByLabelText('Date and time'), { target: { value: '2099-01-01T09:00' } })
  await user.type(screen.getByLabelText('Chairperson (user ID)'), 'chair-1')
  await user.click(screen.getByRole('button', { name: 'Save as Draft' }))
  return user
}

describe('StaffMeetings', () => {
  beforeEach(() => {
    mockAuth()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('loads the existing meeting list on mount, mapping each status to the right badge', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          { id: 'm-approved', title: 'Approved Meeting', committee: 'Main Board', chairpersonUserId: 'chair-1', scheduledAt: '2099-01-01T09:00:00Z', status: 'APPROVED' },
          { id: 'm-rejected', title: 'Rejected Meeting', committee: 'Main Board', chairpersonUserId: 'chair-1', scheduledAt: '2099-01-01T09:00:00Z', status: 'REJECTED' },
        ],
        page: 1,
        pageSize: 2,
        totalItems: 2,
      }),
    })

    renderStaffMeetings()

    expect(await screen.findByText('Approved')).toBeInTheDocument()
    expect(screen.getByText('Rejected')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View Register' })).toBeInTheDocument()
  })

  it('creates a meeting and shows it with a Draft label, not a status badge', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    fetchMock
      .mockResolvedValueOnce(emptyList)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'meeting-1',
          title: 'Q3 Board Meeting',
          committee: 'Main Board',
          chairpersonUserId: 'chair-1',
          scheduledAt: '2099-01-01T09:00:00Z',
          status: 'DRAFT',
        }),
      })

    renderStaffMeetings()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await fillAndSubmitForm()

    expect(await screen.findByText('Draft')).toBeInTheDocument()
    expect(screen.queryByText('Pending Approval')).not.toBeInTheDocument()

    const createCall = fetchMock.mock.calls[1]
    expect(createCall[0]).toContain('/api/v1/meetings')
    expect(JSON.parse(createCall[1].body)).toEqual({
      title: 'Q3 Board Meeting',
      committee: 'Main Board',
      chairpersonUserId: 'chair-1',
      scheduledAt: new Date('2099-01-01T09:00').toISOString(),
    })
  })

  it('submitting a Draft meeting for approval changes the label to a Pending Approval badge', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    fetchMock
      .mockResolvedValueOnce(emptyList)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'meeting-1',
          title: 'Q3 Board Meeting',
          committee: 'Main Board',
          chairpersonUserId: 'chair-1',
          scheduledAt: '2099-01-01T09:00:00Z',
          status: 'DRAFT',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'meeting-1',
          title: 'Q3 Board Meeting',
          committee: 'Main Board',
          chairpersonUserId: 'chair-1',
          scheduledAt: '2099-01-01T09:00:00Z',
          status: 'PENDING_APPROVAL',
        }),
      })

    renderStaffMeetings()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const user = await fillAndSubmitForm()
    expect(await screen.findByText('Draft')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Submit for Approval' }))

    expect(await screen.findByText('Pending Approval')).toBeInTheDocument()
    expect(screen.queryByText('Draft')).not.toBeInTheDocument()
    expect(fetchMock.mock.calls[2][0]).toContain('/api/v1/meetings/meeting-1/submit')
  })

  it('shows an inline, labelled validation error per field on a 400 response', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    fetchMock
      .mockResolvedValueOnce(emptyList)
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            fields: [{ field: 'scheduledAt', message: 'must be a future date' }],
          },
        }),
      })

    renderStaffMeetings()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await fillAndSubmitForm()

    expect(await screen.findByText('must be a future date')).toBeInTheDocument()
  })
})
