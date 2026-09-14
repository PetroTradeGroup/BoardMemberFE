const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

export type UserRole = 'BOARD_MEMBER' | 'COMMITTEE_MEMBER' | 'LEGAL_OFFICER' | 'CHECKER' | 'ADMIN'

export interface CreateUserRequest {
  firstName: string
  lastName: string
  email: string
  role: UserRole
}

export interface UserSummary {
  id: string
  firstName: string
  lastName: string
  email: string
  enabled: boolean
}

export interface UserListResponse {
  items: UserSummary[]
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

export async function createUser(accessToken: string, request: CreateUserRequest): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/users`, {
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
}

export async function listUsers(accessToken: string): Promise<UserListResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/users`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw await parseErrorEnvelope(response)
  }

  return (await response.json()) as UserListResponse
}
