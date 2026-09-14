import { useState, type ReactNode } from 'react'
import { useAuth } from 'react-oidc-context'
import { Card } from '../components/Card/Card'
import { Button } from '../components/Button/Button'
import { FormField } from '../components/FormField/FormField'
import { usePagination } from '../components/Pagination/usePagination'
import { PaginationControls } from '../components/Pagination/PaginationControls'
import { useUserDirectory } from '../hooks/useUserDirectory'
import {
  ApiError,
  dateToFromInstant,
  dateToToInstant,
  getAttendanceReport,
  getAuditReport,
  getGovernanceReport,
  getPaymentScheduleReport,
  getPayslipReport,
  getWorkflowReport,
  type AttendanceReportResponse,
  type AuditReportResponse,
  type GovernanceReportResponse,
  type PaymentScheduleReportResponse,
  type PayslipReportResponse,
  type WorkflowReportResponse,
} from '../api/reportsApi'
import styles from './StaffReports.module.css'

type ReportTab = 'attendance' | 'governance' | 'payslips' | 'paymentSchedules' | 'workflow' | 'audit'

const TABS: { id: ReportTab; label: string }[] = [
  { id: 'attendance', label: 'Attendance' },
  { id: 'governance', label: 'Governance' },
  { id: 'payslips', label: 'Payslips' },
  { id: 'paymentSchedules', label: 'Payment Schedules' },
  { id: 'workflow', label: 'Workflow' },
  { id: 'audit', label: 'Audit' },
]

/**
 * Epic 8: the six report clusters (Stories 8.1-8.6), each backed by its own
 * `GET /api/v1/reports/*` endpoint. Legal Officer/Checker only -- the Governance tab bundles
 * Conflict-of-Interest text, which even the backend excludes Admin from reading (FR12).
 */
export function StaffReports() {
  const auth = useAuth()
  const accessToken = auth.user?.access_token
  const [activeTab, setActiveTab] = useState<ReportTab>('attendance')

  return (
    <main className={styles.page}>
      <h1 className={styles.pageTitle}>Reports</h1>

      <Card className={styles.card}>
        <div className={styles.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {accessToken ? (
          <>
            {activeTab === 'attendance' ? <AttendanceTab accessToken={accessToken} /> : null}
            {activeTab === 'governance' ? <GovernanceTab accessToken={accessToken} /> : null}
            {activeTab === 'payslips' ? <PayslipsTab accessToken={accessToken} /> : null}
            {activeTab === 'paymentSchedules' ? <PaymentSchedulesTab accessToken={accessToken} /> : null}
            {activeTab === 'workflow' ? <WorkflowTab accessToken={accessToken} /> : null}
            {activeTab === 'audit' ? <AuditTab accessToken={accessToken} /> : null}
          </>
        ) : null}
      </Card>
    </main>
  )
}

function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
  extra,
}: {
  from: string
  to: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
  extra?: ReactNode
}) {
  return (
    <div className={styles.filters}>
      <FormField label="From" type="date" value={from} onChange={(event) => onFromChange(event.target.value)} />
      <FormField label="To" type="date" value={to} onChange={(event) => onToChange(event.target.value)} />
      {extra}
    </div>
  )
}

function AttendanceTab({ accessToken }: { accessToken: string }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [committee, setCommittee] = useState('')
  const [report, setReport] = useState<AttendanceReportResponse>()
  const [error, setError] = useState<string>()
  const [isLoading, setIsLoading] = useState(false)

  async function load() {
    setIsLoading(true)
    setError(undefined)
    try {
      const result = await getAttendanceReport(accessToken, {
        from: from ? dateToFromInstant(from) : undefined,
        to: to ? dateToToInstant(to) : undefined,
        committee: committee || undefined,
      })
      setReport(result)
    }
    catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load this report right now.')
    }
    finally {
      setIsLoading(false)
    }
  }

  const byMeetingPagination = usePagination(report?.byMeeting ?? [], 10)

  return (
    <div className={styles.tabContent}>
      <DateRangeFilter
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        extra={<FormField label="Committee" value={committee} onChange={(event) => setCommittee(event.target.value)} />}
      />
      <Button onClick={load} disabled={isLoading}>Run report</Button>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {report ? (
        <>
          <p className={styles.summaryLine}>
            Physical: {report.physicalVsVirtual.physical} &middot; Virtual: {report.physicalVsVirtual.virtual}
          </p>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Meeting</th>
                  <th>Committee</th>
                  <th className={styles.num}>Physical</th>
                  <th className={styles.num}>Virtual</th>
                  <th className={styles.num}>Apologized</th>
                  <th className={styles.num}>No response</th>
                </tr>
              </thead>
              <tbody>
                {byMeetingPagination.pageItems.map((row) => (
                  <tr key={row.meetingId}>
                    <td>{row.meetingTitle}</td>
                    <td>{row.committee}</td>
                    <td className={styles.num}>{row.physical}</td>
                    <td className={styles.num}>{row.virtual}</td>
                    <td className={styles.num}>{row.apologized}</td>
                    <td className={styles.num}>{row.noResponse}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls {...byMeetingPagination} />
        </>
      ) : null}
    </div>
  )
}

function GovernanceTab({ accessToken }: { accessToken: string }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [committee, setCommittee] = useState('')
  const [report, setReport] = useState<GovernanceReportResponse>()
  const [error, setError] = useState<string>()
  const [isLoading, setIsLoading] = useState(false)

  async function load() {
    setIsLoading(true)
    setError(undefined)
    try {
      const result = await getGovernanceReport(accessToken, {
        from: from ? dateToFromInstant(from) : undefined,
        to: to ? dateToToInstant(to) : undefined,
        committee: committee || undefined,
      })
      setReport(result)
    }
    catch (err: unknown) {
      if (err instanceof ApiError && err.message.toLowerCase().includes('forbidden')) {
        setError('You do not have access to Governance Reports.')
      }
      else {
        setError(err instanceof Error ? err.message : 'Unable to load this report right now.')
      }
    }
    finally {
      setIsLoading(false)
    }
  }

  const coiPagination = usePagination(report?.conflictsOfInterest ?? [], 10)
  const apologyPagination = usePagination(report?.apologies ?? [], 10)
  const membershipPagination = usePagination(report?.membershipChanges ?? [], 10)
  const { displayName } = useUserDirectory(accessToken)

  return (
    <div className={styles.tabContent}>
      <DateRangeFilter
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        extra={<FormField label="Committee" value={committee} onChange={(event) => setCommittee(event.target.value)} />}
      />
      <Button onClick={load} disabled={isLoading}>Run report</Button>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {report ? (
        <>
          <p className={styles.sectionTitle}>Conflicts of Interest</p>
          <ul className={styles.list}>
            {coiPagination.pageItems.map((entry, index) => (
              <li key={index} className={styles.listItem}>
                {displayName(entry.memberUserId)} &middot; {entry.meetingTitle} ({entry.committee}): {entry.declaration}
              </li>
            ))}
          </ul>
          <PaginationControls {...coiPagination} />
          <p className={styles.sectionTitle}>Apologies</p>
          <ul className={styles.list}>
            {apologyPagination.pageItems.map((entry, index) => (
              <li key={index} className={styles.listItem}>
                {displayName(entry.memberUserId)} &middot; {entry.meetingTitle} ({entry.committee}): {entry.reason}
              </li>
            ))}
          </ul>
          <PaginationControls {...apologyPagination} />
          <p className={styles.sectionTitle}>Committee Membership Changes</p>
          <ul className={styles.list}>
            {membershipPagination.pageItems.map((change) => (
              <li key={change.id} className={styles.listItem}>
                {change.action} &middot; {displayName(change.memberUserId)} &middot; {change.committeeName}
              </li>
            ))}
          </ul>
          <PaginationControls {...membershipPagination} />
        </>
      ) : null}
    </div>
  )
}

function PayslipsTab({ accessToken }: { accessToken: string }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [report, setReport] = useState<PayslipReportResponse>()
  const [error, setError] = useState<string>()
  const [isLoading, setIsLoading] = useState(false)

  async function load() {
    setIsLoading(true)
    setError(undefined)
    try {
      const result = await getPayslipReport(accessToken, {
        from: from ? dateToFromInstant(from) : undefined,
        to: to ? dateToToInstant(to) : undefined,
      })
      setReport(result)
    }
    catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load this report right now.')
    }
    finally {
      setIsLoading(false)
    }
  }

  const outstandingPagination = usePagination(report?.outstandingNotification ?? [], 10)
  const { displayName } = useUserDirectory(accessToken)

  return (
    <div className={styles.tabContent}>
      <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
      <Button onClick={load} disabled={isLoading}>Run report</Button>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {report ? (
        <p className={styles.summaryLine}>
          Issued: {report.issued.length} &middot; Accessed: {report.accessed.length} &middot; Outstanding notification: {report.outstandingNotification.length}
        </p>
      ) : null}
      {report && report.outstandingNotification.length > 0 ? (
        <>
          <p className={styles.sectionTitle}>Outstanding notification</p>
          <ul className={styles.list}>
            {outstandingPagination.pageItems.map((payslip) => (
              <li key={payslip.id} className={styles.listItem}>
                {displayName(payslip.memberUserId)} &middot; {payslip.meetingTitle}
              </li>
            ))}
          </ul>
          <PaginationControls {...outstandingPagination} />
        </>
      ) : null}
    </div>
  )
}

function PaymentSchedulesTab({ accessToken }: { accessToken: string }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [report, setReport] = useState<PaymentScheduleReportResponse>()
  const [error, setError] = useState<string>()
  const [isLoading, setIsLoading] = useState(false)

  async function load() {
    setIsLoading(true)
    setError(undefined)
    try {
      const result = await getPaymentScheduleReport(accessToken, {
        from: from ? dateToFromInstant(from) : undefined,
        to: to ? dateToToInstant(to) : undefined,
      })
      setReport(result)
    }
    catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load this report right now.')
    }
    finally {
      setIsLoading(false)
    }
  }

  const reconciliationPagination = usePagination(report?.reconciliation ?? [], 10)

  return (
    <div className={styles.tabContent}>
      <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
      <Button onClick={load} disabled={isLoading}>Run report</Button>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {report ? (
        <>
          <p className={styles.summaryLine}>
            Generated: {report.generated.length} &middot; Pending: {report.pending.length} &middot; Approved: {report.approved.length}
          </p>
          <p className={styles.sectionTitle}>Attendance-to-payment reconciliation</p>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Meeting</th>
                  <th className={styles.num}>Present in register</th>
                  <th className={styles.num}>Included in schedule</th>
                  <th>Matched</th>
                </tr>
              </thead>
              <tbody>
                {reconciliationPagination.pageItems.map((row) => (
                  <tr key={row.scheduleId}>
                    <td>{row.meetingTitle}</td>
                    <td className={styles.num}>{row.presentInRegister}</td>
                    <td className={styles.num}>{row.includedInSchedule}</td>
                    <td>{row.matched ? 'Yes' : 'No — needs review'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls {...reconciliationPagination} />
        </>
      ) : null}
    </div>
  )
}

function WorkflowTab({ accessToken }: { accessToken: string }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [recordType, setRecordType] = useState('')
  const [report, setReport] = useState<WorkflowReportResponse>()
  const [error, setError] = useState<string>()
  const [isLoading, setIsLoading] = useState(false)

  async function load() {
    setIsLoading(true)
    setError(undefined)
    try {
      const result = await getWorkflowReport(accessToken, {
        from: from ? dateToFromInstant(from) : undefined,
        to: to ? dateToToInstant(to) : undefined,
        recordType: recordType || undefined,
      })
      setReport(result)
    }
    catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load this report right now.')
    }
    finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={styles.tabContent}>
      <DateRangeFilter
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        extra={<FormField label="Record type" value={recordType} onChange={(event) => setRecordType(event.target.value)} />}
      />
      <Button onClick={load} disabled={isLoading}>Run report</Button>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {report ? (
        <>
          <p className={styles.summaryLine}>
            Pending: {report.pending.length} &middot; Approved: {report.approved.length} &middot; Rejected: {report.rejected.length}
          </p>
          <p className={styles.sectionTitle}>Processing time by record type</p>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Record type</th>
                  <th className={styles.num}>Completed</th>
                  <th className={styles.num}>Avg. hours to decide</th>
                </tr>
              </thead>
              <tbody>
                {report.processingTimeByRecordType.map((row) => (
                  <tr key={row.recordType}>
                    <td>{row.recordType}</td>
                    <td className={styles.num}>{row.count}</td>
                    <td className={styles.num}>{row.averageProcessingHours.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  )
}

function AuditTab({ accessToken }: { accessToken: string }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [actor, setActor] = useState('')
  const [report, setReport] = useState<AuditReportResponse>()
  const [error, setError] = useState<string>()
  const [isLoading, setIsLoading] = useState(false)

  async function load() {
    setIsLoading(true)
    setError(undefined)
    try {
      const result = await getAuditReport(accessToken, {
        from: from ? dateToFromInstant(from) : undefined,
        to: to ? dateToToInstant(to) : undefined,
        actor: actor || undefined,
      })
      setReport(result)
    }
    catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load this report right now.')
    }
    finally {
      setIsLoading(false)
    }
  }

  const userActivityPagination = usePagination(report?.userActivity ?? [], 10)
  const { displayName } = useUserDirectory(accessToken)

  return (
    <div className={styles.tabContent}>
      <DateRangeFilter
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        extra={<FormField label="Actor" value={actor} onChange={(event) => setActor(event.target.value)} />}
      />
      <Button onClick={load} disabled={isLoading}>Run report</Button>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {report ? (
        <>
          <p className={styles.sectionTitle}>User activity</p>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Actor</th>
                  <th className={styles.num}>Events</th>
                  <th>Last activity</th>
                </tr>
              </thead>
              <tbody>
                {userActivityPagination.pageItems.map((row) => (
                  <tr key={row.actor}>
                    <td>{displayName(row.actor)}</td>
                    <td className={styles.num}>{row.eventCount}</td>
                    <td>{row.lastActivityAt ? new Date(row.lastActivityAt).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls {...userActivityPagination} />
          <p className={styles.summaryLine}>
            Logins: {report.loginHistory.length} &middot; Approval history: {report.approvalHistory.length} &middot; Document access: {report.documentAccess.length}
          </p>
        </>
      ) : null}
    </div>
  )
}
