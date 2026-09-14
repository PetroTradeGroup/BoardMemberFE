const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

export type ApprovalStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'

export interface ApprovalRecordView {
  id: string
  recordType: string
  recordId: string
  status: ApprovalStatus
  submittedBy: string
  submittedAt: string
  decidedBy: string | null
  decidedAt: string | null
  rejectionReason: string | null
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

export async function listPendingApprovals(accessToken: string): Promise<ApprovalRecordView[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/approvals/pending`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw await parseErrorEnvelope(response)
  }
  return (await response.json()) as ApprovalRecordView[]
}

export async function approveRecord(
  accessToken: string,
  recordType: string,
  recordId: string,
): Promise<ApprovalRecordView> {
  const response = await fetch(`${API_BASE_URL}/api/v1/approvals/${recordType}/${recordId}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw await parseErrorEnvelope(response)
  }
  return (await response.json()) as ApprovalRecordView
}

export async function rejectRecord(
  accessToken: string,
  recordType: string,
  recordId: string,
  reason: string,
): Promise<ApprovalRecordView> {
  const response = await fetch(`${API_BASE_URL}/api/v1/approvals/${recordType}/${recordId}/reject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ reason }),
  })

  if (!response.ok) {
    throw await parseErrorEnvelope(response)
  }
  return (await response.json()) as ApprovalRecordView
}
