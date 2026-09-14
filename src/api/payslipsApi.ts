const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

export type Position = 'CHAIRPERSON' | 'VICE_CHAIRPERSON' | 'MEMBER'

export interface PayslipResponse {
  id: string
  meetingTitle: string
  committee: string
  position: Position
  grossAmount: number
  deductionsAmount: number
  netAmount: number
  generatedAt: string
  viewed: boolean
}

export interface PayslipListResponse {
  items: PayslipResponse[]
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

export async function listPayslips(accessToken: string): Promise<PayslipListResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/payslips`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw await parseErrorEnvelope(response)
  }
  return (await response.json()) as PayslipListResponse
}

export async function getPayslip(accessToken: string, id: string): Promise<PayslipResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/payslips/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw await parseErrorEnvelope(response)
  }
  return (await response.json()) as PayslipResponse
}

/** Fetches the PDF and triggers a browser download -- no library needed, just a synthetic
 * `<a download>` click against an object URL. */
export async function downloadPayslipPdf(accessToken: string, id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/payslips/${id}/pdf`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw await parseErrorEnvelope(response)
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `payslip-${id}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
