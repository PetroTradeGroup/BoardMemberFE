import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MemberPayslips } from './MemberPayslips'

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }))

vi.mock('react-oidc-context', () => ({
  useAuth: useAuthMock,
}))

function mockAuth() {
  useAuthMock.mockReturnValue({ user: { access_token: 'member-token' } })
}

const payslip = {
  id: 'payslip-1',
  meetingTitle: 'Q3 Board Meeting',
  committee: 'Main Board',
  position: 'MEMBER',
  grossAmount: 200,
  deductionsAmount: 30,
  netAmount: 170,
  generatedAt: '2026-08-27T00:00:00Z',
  viewed: false,
}

describe('MemberPayslips', () => {
  beforeEach(() => {
    mockAuth()
    vi.stubGlobal('fetch', vi.fn())
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() })
  })

  it('shows the empty state when there are no payslips', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ items: [], page: 1, pageSize: 0, totalItems: 0 }) })

    render(<MemberPayslips />)

    expect(await screen.findByText('No payslips yet.')).toBeInTheDocument()
  })

  it('lists a payslip without a Viewed mark until opened', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ items: [payslip], page: 1, pageSize: 1, totalItems: 1 }) })

    render(<MemberPayslips />)

    expect(await screen.findByText('Q3 Board Meeting')).toBeInTheDocument()
    expect(screen.getByText('170.00')).toBeInTheDocument()
    expect(screen.queryByText('Viewed')).not.toBeInTheDocument()
  })

  it('viewing a payslip marks it Viewed', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [payslip], page: 1, pageSize: 1, totalItems: 1 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...payslip, viewed: true }) })

    render(<MemberPayslips />)
    await screen.findByText('Q3 Board Meeting')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'View' }))

    expect(await screen.findByText('Viewed')).toBeInTheDocument()
    expect(fetchMock.mock.calls[1][0]).toContain('/api/v1/payslips/payslip-1')
  })

  it('downloading a payslip marks it Viewed', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [payslip], page: 1, pageSize: 1, totalItems: 1 }) })
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['%PDF'], { type: 'application/pdf' }) })

    render(<MemberPayslips />)
    await screen.findByText('Q3 Board Meeting')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Download' }))

    await waitFor(() => expect(screen.getByText('Viewed')).toBeInTheDocument())
    expect(fetchMock.mock.calls[1][0]).toContain('/api/v1/payslips/payslip-1/pdf')
  })
})
