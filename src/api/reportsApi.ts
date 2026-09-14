const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

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

async function get<T>(path: string, accessToken: string, params: Record<string, string | undefined>): Promise<T> {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      query.set(key, value)
    }
  }
  const queryString = query.toString()
  const response = await fetch(`${API_BASE_URL}${path}${queryString ? `?${queryString}` : ''}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw await parseErrorEnvelope(response)
  }
  return (await response.json()) as T
}

/** A plain `YYYY-MM-DD` date-input value has no time/zone -- the backend's `Instant.parse` needs a
 * full ISO-8601 instant, so a `from` bound anchors to the start of that day (UTC) and a `to` bound
 * anchors to the end of it. */
export function dateToFromInstant(date: string): string {
  return `${date}T00:00:00Z`
}
export function dateToToInstant(date: string): string {
  return `${date}T23:59:59Z`
}

export interface MeetingAttendanceSummary {
  meetingId: string
  meetingTitle: string
  committee: string
  physical: number
  virtual: number
  apologized: number
  noResponse: number
}
export interface CommitteeAttendanceSummary {
  committee: string
  physical: number
  virtual: number
  apologized: number
  noResponse: number
}
export interface PhysicalVsVirtualSummary {
  physical: number
  virtual: number
}
export interface AttendanceReportResponse {
  byMeeting: MeetingAttendanceSummary[]
  byCommittee: CommitteeAttendanceSummary[]
  physicalVsVirtual: PhysicalVsVirtualSummary
}

export async function getAttendanceReport(
  accessToken: string,
  params: { from?: string; to?: string; committee?: string },
): Promise<AttendanceReportResponse> {
  return get('/api/v1/reports/attendance', accessToken, params)
}

export interface ConflictOfInterestReportEntry {
  meetingId: string
  meetingTitle: string
  committee: string
  memberUserId: string
  declaration: string
}
export interface ApologyReportEntry {
  meetingId: string
  meetingTitle: string
  committee: string
  memberUserId: string
  reason: string
}
export interface MembershipChangeResponse {
  id: string
  committeeId: string
  committeeName: string
  memberUserId: string
  action: 'ASSIGN' | 'REMOVE'
  proposedBy: string
  proposedAt: string
}
export interface GovernanceReportResponse {
  conflictsOfInterest: ConflictOfInterestReportEntry[]
  apologies: ApologyReportEntry[]
  membershipChanges: MembershipChangeResponse[]
}

export async function getGovernanceReport(
  accessToken: string,
  params: { from?: string; to?: string; committee?: string },
): Promise<GovernanceReportResponse> {
  return get('/api/v1/reports/governance', accessToken, params)
}

export interface PayslipReportView {
  id: string
  memberUserId: string
  meetingTitle: string
  committee: string
  netAmount: number
  generatedAt: string
  viewedAt: string | null
  notificationSentAt: string | null
}
export interface PayslipReportResponse {
  issued: PayslipReportView[]
  accessed: PayslipReportView[]
  outstandingNotification: PayslipReportView[]
}

export async function getPayslipReport(
  accessToken: string,
  params: { from?: string; to?: string },
): Promise<PayslipReportResponse> {
  return get('/api/v1/reports/payslips', accessToken, params)
}

export interface PaymentScheduleSummary {
  id: string
  meetingTitle: string
  committee: string
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'
  totalNet: number
}
export interface ReconciliationEntry {
  scheduleId: string
  meetingTitle: string
  presentInRegister: number
  includedInSchedule: number
  matched: boolean
}
export interface PaymentScheduleReportResponse {
  generated: PaymentScheduleSummary[]
  pending: PaymentScheduleSummary[]
  approved: PaymentScheduleSummary[]
  reconciliation: ReconciliationEntry[]
}

export async function getPaymentScheduleReport(
  accessToken: string,
  params: { from?: string; to?: string },
): Promise<PaymentScheduleReportResponse> {
  return get('/api/v1/reports/payment-schedules', accessToken, params)
}

export interface ApprovalRecordView {
  id: string
  recordType: string
  recordId: string
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'
  submittedBy: string
  submittedAt: string
  decidedBy: string | null
  decidedAt: string | null
  rejectionReason: string | null
}
export interface ProcessingTimeStat {
  recordType: string
  count: number
  averageProcessingHours: number
}
export interface WorkflowReportResponse {
  pending: ApprovalRecordView[]
  approved: ApprovalRecordView[]
  rejected: ApprovalRecordView[]
  processingTimeByRecordType: ProcessingTimeStat[]
}

export async function getWorkflowReport(
  accessToken: string,
  params: { from?: string; to?: string; recordType?: string },
): Promise<WorkflowReportResponse> {
  return get('/api/v1/reports/workflow', accessToken, params)
}

export interface AuditEventView {
  actor: string | null
  action: string
  recordType: string | null
  recordId: string | null
  occurredAt: string
  outcome: 'SUCCESS' | 'FAILURE'
  detail: string | null
}
export interface UserActivitySummary {
  actor: string
  eventCount: number
  lastActivityAt: string | null
}
export interface AuditReportResponse {
  userActivity: UserActivitySummary[]
  loginHistory: AuditEventView[]
  approvalHistory: AuditEventView[]
  documentAccess: AuditEventView[]
}

export async function getAuditReport(
  accessToken: string,
  params: { from?: string; to?: string; actor?: string; recordType?: string; action?: string },
): Promise<AuditReportResponse> {
  return get('/api/v1/reports/audit', accessToken, params)
}
