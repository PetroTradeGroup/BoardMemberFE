import { useEffect, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { accessTokenHasRole } from '../auth/accessTokenRoles'
import { Card } from '../components/Card/Card'
import { listMeetings, type MeetingResponse } from '../api/meetingsApi'
import { listPayslips, type PayslipResponse } from '../api/payslipsApi'
import { listUsers, type UserSummary } from '../api/usersApi'
import { getAttendanceReport, getWorkflowReport, type AttendanceReportResponse, type WorkflowReportResponse } from '../api/reportsApi'
import styles from './Home.module.css'

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
        { name: 'Virtual', value: attendanceReport.physicalVsVirtual.virtual, color: 'var(--color-pending-border)' },
      ].filter((slice) => slice.value > 0)
    : []

  const upcomingMeetingCount = myMeetings?.filter((meeting) => new Date(meeting.scheduledAt).getTime() > Date.now()).length
  const latestPayslip = myPayslips && myPayslips.length > 0 ? myPayslips[0] : undefined

  return (
    <main className={styles.page}>
      <h1 className={styles.pageTitle}>Welcome, {username}</h1>

      {isStaff ? (
        <>
          {staffError ? (
            <p className={styles.error} role="alert">
              {staffError}
            </p>
          ) : null}

          <div className={styles.statRow}>
            <StatCard label="Meetings" value={meetingCount} />
            <StatCard label="Pending Approvals" value={workflowReport?.pending.length} />
            <StatCard label="Approved Records" value={workflowReport?.approved.length} />
            {isAdmin || isChecker ? <StatCard label="Users" value={userCount} /> : null}
          </div>

          <div className={styles.chartRow}>
            <Card className={styles.chartCard}>
              <p className={styles.chartTitle}>Approval status</p>
              {workflowCounts.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={workflowCounts} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {workflowCounts.map((slice) => (
                        <Cell key={slice.name} fill={slice.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className={styles.emptyChart}>No approval records yet.</p>
              )}
            </Card>

            <Card className={styles.chartCard}>
              <p className={styles.chartTitle}>Physical vs virtual attendance</p>
              {attendanceCounts.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={attendanceCounts} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {attendanceCounts.map((slice) => (
                        <Cell key={slice.name} fill={slice.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className={styles.emptyChart}>No attendance recorded yet.</p>
              )}
            </Card>
          </div>

          {isAdmin || isChecker ? (
            <Card className={styles.card}>
              <p className={styles.chartTitle}>Users</p>
              {users && users.length > 0 ? (
                <ul className={styles.userList}>
                  {users.map((user) => (
                    <li key={user.id} className={styles.userListItem}>
                      <span>{user.firstName} {user.lastName}</span>
                      <span className={styles.userEmail}>{user.email}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.emptyChart}>No users yet.</p>
              )}
            </Card>
          ) : null}
        </>
      ) : null}

      {isMember ? (
        <>
          {memberError ? (
            <p className={styles.error} role="alert">
              {memberError}
            </p>
          ) : null}
          <div className={styles.statRow}>
            <StatCard label="Upcoming Meetings" value={upcomingMeetingCount} />
            <StatCard label="Payslips" value={myPayslips?.length} />
            <StatCard label="Latest Net Pay" value={latestPayslip ? `${latestPayslip.netAmount.toFixed(2)}` : undefined} />
          </div>
        </>
      ) : null}

      {!isStaff && !isMember ? <Card className={styles.card}>Nothing to show here yet.</Card> : null}
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: number | string | undefined }) {
  return (
    <Card className={styles.statCard}>
      <p className={styles.statValue}>{value ?? '—'}</p>
      <p className={styles.statLabel}>{label}</p>
    </Card>
  )
}
