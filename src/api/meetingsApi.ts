const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

export type MeetingStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'

export interface CreateMeetingRequest {
  title: string
  committee: string
  chairpersonUserId: string
  scheduledAt: string
}

export interface MeetingResponse {
  id: string
  title: string
  committee: string
  chairpersonUserId: string
  scheduledAt: string
  status: MeetingStatus
}

export interface MeetingListResponse {
  items: MeetingResponse[]
  page: number
  pageSize: number
  totalItems: number
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

export async function createMeeting(accessToken: string, request: CreateMeetingRequest): Promise<MeetingResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/meetings`, {
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
  return (await response.json()) as MeetingResponse
}

export async function submitMeetingForApproval(accessToken: string, meetingId: string): Promise<MeetingResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/meetings/${meetingId}/submit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw await parseErrorEnvelope(response)
  }
  return (await response.json()) as MeetingResponse
}

export async function getMeeting(accessToken: string, meetingId: string): Promise<MeetingResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/meetings/${meetingId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw await parseErrorEnvelope(response)
  }
  return (await response.json()) as MeetingResponse
}

/** Story 4.4: committee-scoped for Members, unfiltered for staff -- enforced server-side. */
export async function listMeetings(accessToken: string): Promise<MeetingListResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/meetings`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw await parseErrorEnvelope(response)
  }
  return (await response.json()) as MeetingListResponse
}
