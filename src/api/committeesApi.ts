const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

export type MembershipAction = 'ASSIGN' | 'REMOVE'

export interface CommitteeSummary {
  id: string
  name: string
}

export interface CommitteeListResponse {
  items: CommitteeSummary[]
  page: number
  pageSize: number
  totalItems: number
}

export interface ProposeMembershipChangeRequest {
  committeeId: string
  memberUserId: string
  action: MembershipAction
}

export interface MembershipChangeResponse {
  id: string
  committeeId: string
  committeeName: string
  memberUserId: string
  action: MembershipAction
  proposedBy: string
  proposedAt: string
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

export async function listCommittees(accessToken: string): Promise<CommitteeListResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/committees`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw await parseErrorEnvelope(response)
  }
  return (await response.json()) as CommitteeListResponse
}

export async function proposeMembershipChange(
  accessToken: string,
  request: ProposeMembershipChangeRequest,
): Promise<MembershipChangeResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/committee-memberships`, {
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
  return (await response.json()) as MembershipChangeResponse
}

export async function getMembershipChange(accessToken: string, id: string): Promise<MembershipChangeResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/committee-memberships/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw await parseErrorEnvelope(response)
  }
  return (await response.json()) as MembershipChangeResponse
}
