import { useEffect, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { accessTokenHasRole } from '../auth/accessTokenRoles'
import { Card } from '../components/Card/Card'
import { listMeetings, type MeetingResponse } from '../api/meetingsApi'
import { listPayslips, type PayslipResponse } from '../api/payslipsApi'
import { listUsers, type UserSummary } from '../api/usersApi'
import { getAttendanceReport, getWorkflowReport, type AttendanceReportResponse, type WorkflowReportResponse } from '../api/reportsApi'
import { CalendarDays, CheckCircle2, ClipboardCheck, Receipt, Users, Wallet, type LucideIcon } from 'lucide-react'

/** The landing dashboard: role-scoped summary stats and charts, not just a nav placeholder --
 * Sign out/Change password/nav now live in `AppShell`'s sidebar (shown on every screen), so this
 * page's whole job is "what's going on," matching every other role-specific screen's convention
 * of pulling real data from the same endpoints Reports/Meetings/Payslips already expose. */
export function Home() {
  const auth = useAuth()
  const accessToken = auth.user?.access_token
  const username = auth.user?.profile?.preferred_username ?? auth.user?.profile?.sub ?? 'user'
  const isAdmin = accessTokenHasRole(accessToken, 'admin')
  const isLegalOfficer = accessTokenHasRole(accessToken, 'legal_officer')
  const isChecker = accessTokenHasRole(accessToken, 'checker')
  const isMember = accessTokenHasRole(accessToken, 'board_member') || accessTokenHasRole(accessToken, 'committee_member')
  // Matches MeetingService.STAFF_AUTHORITIES / the attendance+workflow report endpoints' own role
  // gate -- all three roles get the unfiltered, system-wide dashboard view.
  const isStaff = isAdmin || isLegalOfficer || isChecker

  const [attendanceReport, setAttendanceReport] = useState<AttendanceReportResponse>()
  const [workflowReport, setWorkflowReport] = useState<WorkflowReportResponse>()
  const [meetingCount, setMeetingCount] = useState<number>()
  const [userCount, setUserCount] = useState<number>()
  const [users, setUsers] = useState<UserSummary[]>()
  const [staffError, setStaffError] = useState<string>()

  const [myMeetings, setMyMeetings] = useState<MeetingResponse[]>()
  const [myPayslips, setMyPayslips] = useState<PayslipResponse[]>()
  const [memberError, setMemberError] = useState<string>()

  useEffect(() => {
    if (!accessToken || !isStaff) {
      return
    }
    Promise.all([getAttendanceReport(accessToken, {}), getWorkflowReport(accessToken, {}), listMeetings(accessToken)])
      .then(([attendance, workflow, meetings]) => {
        setAttendanceReport(attendance)
        setWorkflowReport(workflow)
        setMeetingCount(meetings.totalItems)
      })
      .catch((error: unknown) => setStaffError(error instanceof Error ? error.message : 'Unable to load dashboard data right now.'))

    // GET /api/v1/users is Admin+Checker (account creation stays Admin-only) -- a Checker
    // reviewing approval records/attendance entries otherwise has no way to see who a Keycloak
    // user id actually is.
    if (isAdmin || isChecker) {
      listUsers(accessToken).then((response) => {
        setUserCount(response.totalItems)
        setUsers(response.items)
      }).catch(() => {
        // Non-critical stat -- a failure here shouldn't blank out the rest of an already-loaded dashboard.
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, isStaff, isAdmin, isChecker])

  useEffect(() => {
    if (!accessToken || !isMember) {
      return
    }
    Promise.all([listMeetings(accessToken), listPayslips(accessToken)])
      .then(([meetings, payslips]) => {
        setMyMeetings(meetings.items)
        setMyPayslips(payslips.items)
      })
      .catch((error: unknown) => setMemberError(error instanceof Error ? error.message : 'Unable to load your dashboard data right now.'))
  }, [accessToken, isMember])

  const workflowCounts = workflowReport
    ? [
        { name: 'Pending', value: workflowReport.pending.length, color: 'var(--color-pending-text)' },
        { name: 'Approved', value: workflowReport.approved.length, color: 'var(--color-approved-text)' },
        { name: 'Rejected', value: workflowReport.rejected.length, color: 'var(--color-rejected-text)' },
      ].filter((slice) => slice.value > 0)
    : []

  const attendanceCounts = attendanceReport
    ? [
        { name: 'Physical', value: attendanceReport.physicalVsVirtual.physical, color: 'var(--color-primary)' },
        { name: 'Virtual', value: attendanceReport.physicalVsVirtual.virtual, color: 'var(--brand-gold)' },
      ].filter((slice) => slice.value > 0)
    : []

  const upcomingMeetingCount = myMeetings?.filter((meeting) => new Date(meeting.scheduledAt).getTime() > Date.now()).length
  const latestPayslip = myPayslips && myPayslips.length > 0 ? myPayslips[0] : undefined

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6 lg:p-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome, {username}</h1>
        <p className="text-sm text-muted-foreground">{today}</p>
      </header>

      {isStaff ? (
        <>
          {staffError ? (
            <p className="text-sm text-destructive" role="alert">
              {staffError}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Meetings" value={meetingCount} icon={CalendarDays} />
            <StatCard label="Pending Approvals" value={workflowReport?.pending.length} icon={ClipboardCheck} highlight={(workflowReport?.pending.length ?? 0) > 0} />
            <StatCard label="Approved Records" value={workflowReport?.approved.length} icon={CheckCircle2} />
            {isAdmin || isChecker ? <StatCard label="Users" value={userCount} icon={Users} /> : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Approval status" description="All Maker-Checker records" data={workflowCounts} empty="No approval records yet." />
            <ChartCard title="Physical vs virtual attendance" description="Across all recorded meetings" data={attendanceCounts} empty="No attendance recorded yet." />
          </div>

          {isAdmin || isChecker ? (
            <Card className="p-6">
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="text-sm font-semibold">Users</h2>
                <span className="font-mono text-xs text-muted-foreground">{users?.length ?? 0}</span>
              </div>
              {users && users.length > 0 ? (
                <ul className="max-h-80 divide-y overflow-y-auto">
                  {users.map((user) => (
                    <li key={user.id} className="flex items-center gap-3 py-2.5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-secondary-foreground" aria-hidden>
                        {`${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{user.firstName} {user.lastName}</span>
                      <span className="hidden truncate text-xs text-muted-foreground sm:block">{user.email}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">No users yet.</p>
              )}
            </Card>
          ) : null}
        </>
      ) : null}

      {isMember ? (
        <>
          {memberError ? (
            <p className="text-sm text-destructive" role="alert">
              {memberError}
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Upcoming Meetings" value={upcomingMeetingCount} icon={CalendarDays} />
            <StatCard label="Payslips" value={myPayslips?.length} icon={Receipt} />
            <StatCard label="Latest Net Pay" value={latestPayslip ? `${latestPayslip.netAmount.toFixed(2)}` : undefined} icon={Wallet} />
          </div>
        </>
      ) : null}

      {!isStaff && !isMember ? <Card className="p-6 text-sm text-muted-foreground">Nothing to show here yet.</Card> : null}
    </main>
  )
}

function StatCard({ label, value, icon: Icon, highlight }: { label: string; value: number | string | undefined; icon: LucideIcon; highlight?: boolean }) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className={highlight ? 'rounded-md bg-[var(--pending-bg)] p-1.5 text-[var(--pending-fg)]' : 'rounded-md bg-primary/10 p-1.5 text-primary'}>
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="font-mono text-3xl font-semibold tracking-tight">{value ?? '—'}</p>
    </Card>
  )
}

function ChartCard({ title, description, data, empty }: { title: string; description: string; data: { name: string; value: number; color: string }[]; empty: string }) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0)
  return (
    <Card className="p-6">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="text-xs text-muted-foreground">{description}</p>
      {data.length > 0 ? (
        <div className="mt-4 flex items-center gap-6">
          <div className="relative h-44 w-44 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={3} strokeWidth={0}>
                  {data.map((slice) => (
                    <Cell key={slice.name} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--popover-foreground)', fontSize: 12 }}
                  itemStyle={{ color: 'var(--popover-foreground)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-2xl font-semibold">{total}</span>
              <span className="text-[11px] text-muted-foreground">total</span>
            </div>
          </div>
          <ul className="flex-1 space-y-2">
            {data.map((slice) => (
              <li key={slice.name} className="flex items-center gap-2 text-sm">
                <span className="size-2.5 rounded-full" style={{ background: slice.color }} aria-hidden />
                <span className="flex-1 text-muted-foreground">{slice.name}</span>
                <span className="font-mono">{slice.value}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="py-12 text-center text-sm text-muted-foreground">{empty}</p>
      )}
    </Card>
  )
}
