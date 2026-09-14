const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

export type Position = 'CHAIRPERSON' | 'VICE_CHAIRPERSON' | 'MEMBER'
export type PaymentScheduleStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'
export type AuthorizedExceptionStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'
export type ExcludedReason = 'APOLOGY_RECORDED' | 'ABSENT'

export interface RateTableEntryView {
  id: string
  position: Position
  committeeId: string
  committeeName: string
  rate: number
}

export interface RateTableListResponse {
  items: RateTableEntryView[]
  page: number
  pageSize: number
  totalItems: number
}

export interface ProposeRateChangeRequest {
  committeeId: string
  position: Position
  rate: number
}

export interface RateChangeResponse {
  id: string
  committeeId: string
  committeeName: string
  position: Position
  rate: number
  proposedBy: string
  proposedAt: string
}

export interface PaymentScheduleLineItemView {
  memberUserId: string
  position: Position
  attendanceStatus: string
  includedViaException: boolean
  rateApplied: number
  grossAmount: number
  deductionsAmount: number
  netAmount: number
}

export interface PaymentScheduleExcludedMemberView {
  memberUserId: string
  position: Position
  reason: ExcludedReason
  exceptionStatus: AuthorizedExceptionStatus | null
}

export interface PaymentScheduleResponse {
  id: string
  meetingId: string
  meetingTitle: string
  committee: string
  registerId: string
  status: PaymentScheduleStatus
  rejectionReason: string | null
  lineItems: PaymentScheduleLineItemView[]
  excludedMembers: PaymentScheduleExcludedMemberView[]
  totalGross: number
  totalDeductions: number
  totalNet: number
}

export interface RequestExceptionRequest {
  meetingId: string
  memberUserId: string
  reason: string
}

export interface AuthorizedExceptionResponse {
  id: string
  meetingId: string
  memberUserId: string
  reason: string
  status: AuthorizedExceptionStatus
  rejectionReason: string | null
  requestedBy: string
  requestedAt: string
}

export interface FieldError {
  field: string
  message: string
}

/** Thrown for the AD-5 `{error: {code, message, fields?}}` envelope on a non-2xx response. */
export class ApiError extends Error {
  fields: FieldError[]

  constructor(message: string, fields: FieldError[] = []) {
    super(message)
    this.fields = fields
  }
}

async function parseErrorEnvelope(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as { error?: { message?: string; fields?: FieldError[] } }
    return new ApiError(body.error?.message ?? `Request failed (${response.status})`, body.error?.fields ?? [])
  }
  catch {
    return new ApiError(`Request failed (${response.status})`)
  }
}

export async function listCurrentRates(accessToken: string): Promise<RateTableListResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/rate-table`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw await parseErrorEnvelope(response)
  }
  return (await response.json()) as RateTableListResponse
}

export async function proposeRateChange(accessToken: string, request: ProposeRateChangeRequest): Promise<RateChangeResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/rate-table`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(request),
  })
  if (!response.ok) {
    throw await parseErrorEnvelope(response)
  }
  return (await response.json()) as RateChangeResponse
}

export async function getRateChange(accessToken: string, id: string): Promise<RateChangeResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/rate-table/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw await parseErrorEnvelope(response)
  }
  return (await response.json()) as RateChangeResponse
}

export async function generateSchedule(accessToken: string, meetingId: string): Promise<PaymentScheduleResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/payment-schedules`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ meetingId }),
  })
  if (!response.ok) {
    throw await parseErrorEnvelope(response)
  }
  return (await response.json()) as PaymentScheduleResponse
}

export async function submitSchedule(accessToken: string, scheduleId: string): Promise<PaymentScheduleResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/payment-schedules/${scheduleId}/submit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw await parseErrorEnvelope(response)
  }
  return (await response.json()) as PaymentScheduleResponse
}

export async function getScheduleByMeeting(accessToken: string, meetingId: string): Promise<PaymentScheduleResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/meetings/${meetingId}/payment-schedule`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw await parseErrorEnvelope(response)
  }
  return (await response.json()) as PaymentScheduleResponse
}

export async function getScheduleById(accessToken: string, scheduleId: string): Promise<PaymentScheduleResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/payment-schedules/${scheduleId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw await parseErrorEnvelope(response)
  }
  return (await response.json()) as PaymentScheduleResponse
}

export async function requestException(accessToken: string, request: RequestExceptionRequest): Promise<AuthorizedExceptionResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/authorized-exceptions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(request),
  })
  if (!response.ok) {
    throw await parseErrorEnvelope(response)
  }
  return (await response.json()) as AuthorizedExceptionResponse
}

export async function getException(accessToken: string, id: string): Promise<AuthorizedExceptionResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/authorized-exceptions/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw await parseErrorEnvelope(response)
  }
  return (await response.json()) as AuthorizedExceptionResponse
}
