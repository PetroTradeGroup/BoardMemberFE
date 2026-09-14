const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

export type AttendanceType = 'PHYSICAL' | 'VIRTUAL'
export type MemberAttendanceStatus = 'PHYSICAL' | 'VIRTUAL' | 'APOLOGIZED' | 'NO_RESPONSE'
export type AttendanceRegisterStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'

export interface AttendanceResponse {
  meetingId: string
  memberUserId: string
  attendanceType: AttendanceType | null
  attendanceRecordedAt: string | null
  conflictOfInterest: string | null
  conflictDeclaredAt: string | null
  apologyReason: string | null
  apologyRecordedAt: string | null
}

export interface AttendanceRegisterEntryView {
  memberUserId: string
  status: MemberAttendanceStatus
  attendanceType: AttendanceType | null
  conflictOfInterest: string | null
  apologyReason: string | null
}

export interface AttendanceRegisterResponse {
  id: string | null
  meetingId: string
  meetingTitle: string
  committee: string
  status: AttendanceRegisterStatus
  rejectionReason: string | null
  entries: AttendanceRegisterEntryView[]
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

export async function recordAttendance(
  accessToken: string,
  meetingId: string,
  attendanceType: AttendanceType,
): Promise<AttendanceResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/meetings/${meetingId}/attendance`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ attendanceType }),
  })

  if (!response.ok) {
    throw await parseErrorEnvelope(response)
  }
  return (await response.json()) as AttendanceResponse
}

export async function getMyAttendance(accessToken: string, meetingId: string): Promise<AttendanceResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/meetings/${meetingId}/attendance`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw await parseErrorEnvelope(response)
  }
  return (await response.json()) as AttendanceResponse
}

export async function declareConflictOfInterest(
  accessToken: string,
  meetingId: string,
  declaration: string,
): Promise<AttendanceResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/meetings/${meetingId}/conflict-of-interest`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ declaration }),
  })

  if (!response.ok) {
    throw await parseErrorEnvelope(response)
  }
  return (await response.json()) as AttendanceResponse
}

export async function recordApology(
  accessToken: string,
  meetingId: string,
  memberUserId: string,
  reason: string,
): Promise<AttendanceResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/meetings/${meetingId}/apology/${memberUserId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ reason }),
  })

  if (!response.ok) {
    throw await parseErrorEnvelope(response)
  }
  return (await response.json()) as AttendanceResponse
}

export async function getRegister(accessToken: string, meetingId: string): Promise<AttendanceRegisterResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/meetings/${meetingId}/register`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw await parseErrorEnvelope(response)
  }
  return (await response.json()) as AttendanceRegisterResponse
}

export async function getRegisterById(accessToken: string, registerId: string): Promise<AttendanceRegisterResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/attendance-registers/${registerId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw await parseErrorEnvelope(response)
  }
  return (await response.json()) as AttendanceRegisterResponse
}

export async function submitRegister(accessToken: string, meetingId: string): Promise<AttendanceRegisterResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/meetings/${meetingId}/register/submit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw await parseErrorEnvelope(response)
  }
  return (await response.json()) as AttendanceRegisterResponse
}
