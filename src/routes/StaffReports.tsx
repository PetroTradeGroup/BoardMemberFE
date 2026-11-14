import { useState, type ReactNode } from 'react'
import { useAuth } from 'react-oidc-context'
import { CheckCircle2, CircleAlert, FileSearch, Loader2, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '../components/Card/Card'
import { EmptyState, Kpi, Page, PageHeader, Section } from '../components/Page/Page'
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
} from '../api/reportsApi'

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

  return (
    <Page>
      <PageHeader title="Reports" description="Governance, attendance, payment and audit reporting. Pick a report, set a period, and run it." />
      {accessToken ? (
        <Tabs defaultValue="attendance">
          <TabsList>
            {TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="attendance"><AttendanceTab accessToken={accessToken} /></TabsContent>
          <TabsContent value="governance"><GovernanceTab accessToken={accessToken} /></TabsContent>
          <TabsContent value="payslips"><PayslipsTab accessToken={accessToken} /></TabsContent>
          <TabsContent value="paymentSchedules"><PaymentSchedulesTab accessToken={accessToken} /></TabsContent>
          <TabsContent value="workflow"><WorkflowTab accessToken={accessToken} /></TabsContent>
          <TabsContent value="audit"><AuditTab accessToken={accessToken} /></TabsContent>
        </Tabs>
      ) : null}
    </Page>
  )
}

interface Period {
  from?: string
  to?: string
}

/** Shared run-on-demand state for every report tab: date range, loading, error, result. */
function useReport<T>(fetcher: (period: Period) => Promise<T>, onError?: (err: unknown) => string | undefined) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [report, setReport] = useState<T>()
  const [error, setError] = useState<string>()
  const [isLoading, setIsLoading] = useState(false)

  async function run() {
    setIsLoading(true)
    setError(undefined)
    try {
      setReport(await fetcher({ from: from ? dateToFromInstant(from) : undefined, to: to ? dateToToInstant(to) : undefined }))
    }
    catch (err: unknown) {
      setError(onError?.(err) ?? (err instanceof Error ? err.message : 'Unable to load this report right now.'))
    }
    finally {
      setIsLoading(false)
    }
  }

  return { from, setFrom, to, setTo, report, error, isLoading, run }
}

function FilterBar({ state, extra }: { state: ReturnType<typeof useReport<unknown>>; extra?: ReactNode }) {
  return (
    <Card className="p-4">
      <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
        <FormField label="From" type="date" value={state.from} onChange={(event) => state.setFrom(event.target.value)} />
        <FormField label="To" type="date" value={state.to} onChange={(event) => state.setTo(event.target.value)} />
        {extra ?? <div className="hidden lg:block" />}
        <Button onClick={state.run} disabled={state.isLoading} className="h-10">
          {state.isLoading ? <Loader2 className="animate-spin" /> : <Play />}
          Run report
        </Button>
      </div>
      {state.error ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-destructive" role="alert">
          <CircleAlert className="size-4" /> {state.error}
        </p>
      ) : null}
    </Card>
  )
}

function NotRunYet() {
  return (
    <Card>
      <EmptyState icon={<FileSearch />}>Set a period (or leave it blank for all time) and run the report.</EmptyState>
    </Card>
  )
}

function Num({ children }: { children: ReactNode }) {
  return <TableCell className="text-right font-mono">{children}</TableCell>
}

function NoRows({ colSpan, children = 'No records for this period.' }: { colSpan: number; children?: ReactNode }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-8 text-center text-muted-foreground">
        {children}
      </TableCell>
    </TableRow>
  )
}

function AttendanceTab({ accessToken }: { accessToken: string }) {
  const [committee, setCommittee] = useState('')
  const state = useReport((period) => getAttendanceReport(accessToken, { ...period, committee: committee || undefined }))
  const pagination = usePagination(state.report?.byMeeting ?? [], 10)
  const report = state.report

  return (
    <div className="flex flex-col gap-4">
      <FilterBar state={state} extra={<FormField label="Committee" value={committee} onChange={(event) => setCommittee(event.target.value)} />} />
      {report ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi label="Physical" value={report.physicalVsVirtual.physical} />
            <Kpi label="Virtual" value={report.physicalVsVirtual.virtual} />
            <Kpi label="Meetings" value={report.byMeeting.length} />
          </div>
          <Section title="Attendance by meeting">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Meeting</TableHead>
                  <TableHead>Committee</TableHead>
                  <TableHead className="text-right">Physical</TableHead>
                  <TableHead className="text-right">Virtual</TableHead>
                  <TableHead className="text-right">Apologized</TableHead>
                  <TableHead className="text-right">No response</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.pageItems.map((row) => (
                  <TableRow key={row.meetingId}>
                    <TableCell className="font-medium">{row.meetingTitle}</TableCell>
                    <TableCell className="text-muted-foreground">{row.committee}</TableCell>
                    <Num>{row.physical}</Num>
                    <Num>{row.virtual}</Num>
                    <Num>{row.apologized}</Num>
                    <Num>{row.noResponse}</Num>
                  </TableRow>
                ))}
                {report.byMeeting.length === 0 ? <NoRows colSpan={6} /> : null}
              </TableBody>
            </Table>
            <PaginationControls {...pagination} />
          </Section>
        </>
      ) : <NotRunYet />}
    </div>
  )
}

function GovernanceTab({ accessToken }: { accessToken: string }) {
  const [committee, setCommittee] = useState('')
  const state = useReport(
    (period) => getGovernanceReport(accessToken, { ...period, committee: committee || undefined }),
    (err) => (err instanceof ApiError && err.message.toLowerCase().includes('forbidden') ? 'You do not have access to Governance Reports.' : undefined),
  )
  const report = state.report
  const coiPagination = usePagination(report?.conflictsOfInterest ?? [], 10)
  const apologyPagination = usePagination(report?.apologies ?? [], 10)
  const membershipPagination = usePagination(report?.membershipChanges ?? [], 10)
  const { displayName } = useUserDirectory(accessToken)

  return (
    <div className="flex flex-col gap-4">
      <FilterBar state={state} extra={<FormField label="Committee" value={committee} onChange={(event) => setCommittee(event.target.value)} />} />
      {report ? (
        <>
          <Section title="Conflicts of Interest" description="Declarations made by members against specific meetings">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Meeting</TableHead>
                  <TableHead>Committee</TableHead>
                  <TableHead>Declaration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coiPagination.pageItems.map((entry, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{displayName(entry.memberUserId)}</TableCell>
                    <TableCell>{entry.meetingTitle}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.committee}</TableCell>
                    <TableCell className="max-w-sm whitespace-normal">{entry.declaration}</TableCell>
                  </TableRow>
                ))}
                {report.conflictsOfInterest.length === 0 ? <NoRows colSpan={4}>No declarations for this period.</NoRows> : null}
              </TableBody>
            </Table>
            <PaginationControls {...coiPagination} />
          </Section>

          <Section title="Apologies">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Meeting</TableHead>
                  <TableHead>Committee</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apologyPagination.pageItems.map((entry, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{displayName(entry.memberUserId)}</TableCell>
                    <TableCell>{entry.meetingTitle}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.committee}</TableCell>
                    <TableCell className="max-w-sm whitespace-normal">{entry.reason}</TableCell>
                  </TableRow>
                ))}
                {report.apologies.length === 0 ? <NoRows colSpan={4}>No apologies for this period.</NoRows> : null}
              </TableBody>
            </Table>
            <PaginationControls {...apologyPagination} />
          </Section>

          <Section title="Committee Membership Changes">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Committee</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {membershipPagination.pageItems.map((change) => (
                  <TableRow key={change.id}>
                    <TableCell>
                      <Badge variant="outline">{change.action === 'ASSIGN' ? 'Assign' : change.action === 'REMOVE' ? 'Remove' : change.action}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{displayName(change.memberUserId)}</TableCell>
                    <TableCell className="text-muted-foreground">{change.committeeName}</TableCell>
                  </TableRow>
                ))}
                {report.membershipChanges.length === 0 ? <NoRows colSpan={3}>No membership changes for this period.</NoRows> : null}
              </TableBody>
            </Table>
            <PaginationControls {...membershipPagination} />
          </Section>
        </>
      ) : <NotRunYet />}
    </div>
  )
}

function PayslipsTab({ accessToken }: { accessToken: string }) {
  const state = useReport((period) => getPayslipReport(accessToken, period))
  const report = state.report
  const pagination = usePagination(report?.outstandingNotification ?? [], 10)
  const { displayName } = useUserDirectory(accessToken)

  return (
    <div className="flex flex-col gap-4">
      <FilterBar state={state} />
      {report ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi label="Issued" value={report.issued.length} />
            <Kpi label="Accessed" value={report.accessed.length} />
            <Kpi label="Outstanding notification" value={report.outstandingNotification.length} tone={report.outstandingNotification.length > 0 ? 'warning' : undefined} />
          </div>
          <Section title="Outstanding notification" description="Payslips whose availability email has not been sent yet">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Meeting</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.pageItems.map((payslip) => (
                  <TableRow key={payslip.id}>
                    <TableCell className="font-medium">{displayName(payslip.memberUserId)}</TableCell>
                    <TableCell>{payslip.meetingTitle}</TableCell>
                  </TableRow>
                ))}
                {report.outstandingNotification.length === 0 ? <NoRows colSpan={2}>Every payslip has been notified.</NoRows> : null}
              </TableBody>
            </Table>
            <PaginationControls {...pagination} />
          </Section>
        </>
      ) : <NotRunYet />}
    </div>
  )
}

function PaymentSchedulesTab({ accessToken }: { accessToken: string }) {
  const state = useReport((period) => getPaymentScheduleReport(accessToken, period))
  const report = state.report
  const pagination = usePagination(report?.reconciliation ?? [], 10)

  return (
    <div className="flex flex-col gap-4">
      <FilterBar state={state} />
      {report ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi label="Generated" value={report.generated.length} />
            <Kpi label="Pending" value={report.pending.length} tone={report.pending.length > 0 ? 'warning' : undefined} />
            <Kpi label="Approved" value={report.approved.length} />
          </div>
          <Section title="Attendance-to-payment reconciliation" description="Members present in the approved register vs. lines in the payment schedule">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Meeting</TableHead>
                  <TableHead className="text-right">Present in register</TableHead>
                  <TableHead className="text-right">Included in schedule</TableHead>
                  <TableHead>Matched</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.pageItems.map((row) => (
                  <TableRow key={row.scheduleId}>
                    <TableCell className="font-medium">{row.meetingTitle}</TableCell>
                    <Num>{row.presentInRegister}</Num>
                    <Num>{row.includedInSchedule}</Num>
                    <TableCell>
                      {row.matched ? (
                        <span className="inline-flex items-center gap-1.5 text-[var(--approved-fg)]"><CheckCircle2 className="size-4" /> Yes</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[var(--rejected-fg)]"><CircleAlert className="size-4" /> No — needs review</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {report.reconciliation.length === 0 ? <NoRows colSpan={4} /> : null}
              </TableBody>
            </Table>
            <PaginationControls {...pagination} />
          </Section>
        </>
      ) : <NotRunYet />}
    </div>
  )
}

function WorkflowTab({ accessToken }: { accessToken: string }) {
  const [recordType, setRecordType] = useState('')
  const state = useReport((period) => getWorkflowReport(accessToken, { ...period, recordType: recordType || undefined }))
  const report = state.report

  return (
    <div className="flex flex-col gap-4">
      <FilterBar state={state} extra={<FormField label="Record type" value={recordType} onChange={(event) => setRecordType(event.target.value)} />} />
      {report ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi label="Pending" value={report.pending.length} tone={report.pending.length > 0 ? 'warning' : undefined} />
            <Kpi label="Approved" value={report.approved.length} />
            <Kpi label="Rejected" value={report.rejected.length} />
          </div>
          <Section title="Processing time by record type" description="How long the Checker takes to decide, per record type">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Record type</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                  <TableHead className="text-right">Avg. hours to decide</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.processingTimeByRecordType.map((row) => (
                  <TableRow key={row.recordType}>
                    <TableCell className="font-medium">{row.recordType.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</TableCell>
                    <Num>{row.count}</Num>
                    <Num>{row.averageProcessingHours.toFixed(1)}</Num>
                  </TableRow>
                ))}
                {report.processingTimeByRecordType.length === 0 ? <NoRows colSpan={3} /> : null}
              </TableBody>
            </Table>
          </Section>
        </>
      ) : <NotRunYet />}
    </div>
  )
}

function AuditTab({ accessToken }: { accessToken: string }) {
  const [actor, setActor] = useState('')
  const state = useReport((period) => getAuditReport(accessToken, { ...period, actor: actor || undefined }))
  const report = state.report
  const pagination = usePagination(report?.userActivity ?? [], 10)
  const { displayName } = useUserDirectory(accessToken)

  return (
    <div className="flex flex-col gap-4">
      <FilterBar state={state} extra={<FormField label="Actor" value={actor} onChange={(event) => setActor(event.target.value)} />} />
      {report ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi label="Logins" value={report.loginHistory.length} />
            <Kpi label="Approval history" value={report.approvalHistory.length} />
            <Kpi label="Document access" value={report.documentAccess.length} />
          </div>
          <Section title="User activity">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Actor</TableHead>
                  <TableHead className="text-right">Events</TableHead>
                  <TableHead>Last activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.pageItems.map((row) => (
                  <TableRow key={row.actor}>
                    <TableCell className="font-medium">{displayName(row.actor)}</TableCell>
                    <Num>{row.eventCount}</Num>
                    <TableCell className="font-mono text-xs text-muted-foreground">{row.lastActivityAt ? new Date(row.lastActivityAt).toLocaleString() : '—'}</TableCell>
                  </TableRow>
                ))}
                {report.userActivity.length === 0 ? <NoRows colSpan={3} /> : null}
              </TableBody>
            </Table>
            <PaginationControls {...pagination} />
          </Section>
        </>
      ) : <NotRunYet />}
    </div>
  )
}
