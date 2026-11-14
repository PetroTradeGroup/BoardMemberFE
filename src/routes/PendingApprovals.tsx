import { useEffect, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { CalendarDays, Check, ChevronDown, FileText, Inbox, Network, Receipt, ShieldAlert, ShieldCheck, Users, X, type LucideIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { Card } from '../components/Card/Card'
import { EmptyState, Page, PageHeader } from '../components/Page/Page'
import { Button } from '../components/Button/Button'
import { TextAreaField } from '../components/FormField/TextAreaField'
import { StatusBadge } from '../components/StatusBadge/StatusBadge'
import { usePagination } from '../components/Pagination/usePagination'
import { PaginationControls } from '../components/Pagination/PaginationControls'
import { approveRecord, listPendingApprovals, rejectRecord, type ApprovalRecordView } from '../api/approvalsApi'
import { useUserDirectory } from '../hooks/useUserDirectory'
import { getMeeting, type MeetingResponse } from '../api/meetingsApi'
import { getMembershipChange, type MembershipChangeResponse } from '../api/committeesApi'
import { getRegisterById, type AttendanceRegisterResponse } from '../api/attendanceApi'
import { getRateChange, getScheduleById, getException, type RateChangeResponse, type PaymentScheduleResponse, type AuthorizedExceptionResponse } from '../api/paymentsApi'

const MEMBER_STATUS_LABELS: Record<string, string> = {
  PHYSICAL: 'Physical',
  VIRTUAL: 'Virtual',
  APOLOGIZED: 'Apologized',
  NO_RESPONSE: 'No response',
}

const RECORD_TYPE_LABELS: Record<string, string> = {
  MEETING: 'Meeting',
  COMMITTEE_MEMBERSHIP: 'Committee Membership Change',
  ATTENDANCE_REGISTER: 'Attendance Register',
  RATE_TABLE: 'Rate Change',
  PAYMENT_SCHEDULE: 'Payment Schedule',
  AUTHORIZED_EXCEPTION: 'Authorized Exception',
}

const RECORD_TYPE_ICONS: Record<string, LucideIcon> = {
  MEETING: CalendarDays,
  COMMITTEE_MEMBERSHIP: Network,
  ATTENDANCE_REGISTER: Users,
  RATE_TABLE: FileText,
  PAYMENT_SCHEDULE: Receipt,
  AUTHORIZED_EXCEPTION: ShieldCheck,
}

const POSITION_LABELS: Record<string, string> = {
  CHAIRPERSON: 'Chairperson',
  VICE_CHAIRPERSON: 'Vice-Chairperson',
  MEMBER: 'Member',
}

/**
 * Story 3.4/4.2/5.6/6.1/6.4/6.5: Checker > Pending Approvals -- the unified queue across all six
 * Maker-Checker record types (MEETING, COMMITTEE_MEMBERSHIP, ATTENDANCE_REGISTER, RATE_TABLE,
 * PAYMENT_SCHEDULE, AUTHORIZED_EXCEPTION). Row click expands the record's detail inline rather
 * than acting from the collapsed row itself, per EXPERIENCE.md's anti-rubber-stamp rule
 * ("decisions are never made from the list row itself").
 */
export function PendingApprovals() {
  const auth = useAuth()
  const accessToken = auth.user?.access_token
  const currentUserId = auth.user?.profile.sub

  const [pending, setPending] = useState<ApprovalRecordView[]>()
  const [loadError, setLoadError] = useState<string>()
  const [expandedId, setExpandedId] = useState<string>()
  const [meetingDetails, setMeetingDetails] = useState<Record<string, MeetingResponse>>({})
  const [membershipDetails, setMembershipDetails] = useState<Record<string, MembershipChangeResponse>>({})
  const [registerDetails, setRegisterDetails] = useState<Record<string, AttendanceRegisterResponse>>({})
  const [rateChangeDetails, setRateChangeDetails] = useState<Record<string, RateChangeResponse>>({})
  const [scheduleDetails, setScheduleDetails] = useState<Record<string, PaymentScheduleResponse>>({})
  const [exceptionDetails, setExceptionDetails] = useState<Record<string, AuthorizedExceptionResponse>>({})
  const [detailError, setDetailError] = useState<string>()
  const [decidingId, setDecidingId] = useState<string>()
  const [decisionError, setDecisionError] = useState<{ recordId: string; message: string }>()
  const [rejectingRecord, setRejectingRecord] = useState<ApprovalRecordView>()
  const [rejectReason, setRejectReason] = useState('')
  const { displayName } = useUserDirectory(accessToken)

  useEffect(() => {
    if (!accessToken) {
      return
    }
    listPendingApprovals(accessToken)
      .then((records) => {
        setPending(records)
        // Prefetch every row's details so collapsed rows show a readable title, not "TYPE <uuid>".
        // ponytail: one request per row; add a batch summary endpoint if queues get long.
        records.forEach((record) => loadDetails(record).catch(() => {}))
      })
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : 'Unable to load pending approvals right now.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken])

  async function toggleExpand(record: ApprovalRecordView) {
    if (expandedId === record.id) {
      setExpandedId(undefined)
      return
    }
    setExpandedId(record.id)
    setDetailError(undefined)
    try {
      await loadDetails(record)
    }
    catch (error: unknown) {
      setDetailError(error instanceof Error ? error.message : 'Unable to load this record right now.')
    }
  }

  async function loadDetails(record: ApprovalRecordView) {
    if (!accessToken) {
      return
    }
    {
      if (record.recordType === 'MEETING' && !meetingDetails[record.recordId]) {
        const meeting = await getMeeting(accessToken, record.recordId)
        setMeetingDetails((existing) => ({ ...existing, [record.recordId]: meeting }))
      }
      else if (record.recordType === 'COMMITTEE_MEMBERSHIP' && !membershipDetails[record.recordId]) {
        const change = await getMembershipChange(accessToken, record.recordId)
        setMembershipDetails((existing) => ({ ...existing, [record.recordId]: change }))
      }
      else if (record.recordType === 'ATTENDANCE_REGISTER' && !registerDetails[record.recordId]) {
        const register = await getRegisterById(accessToken, record.recordId)
        setRegisterDetails((existing) => ({ ...existing, [record.recordId]: register }))
      }
      else if (record.recordType === 'RATE_TABLE' && !rateChangeDetails[record.recordId]) {
        const change = await getRateChange(accessToken, record.recordId)
        setRateChangeDetails((existing) => ({ ...existing, [record.recordId]: change }))
      }
      else if (record.recordType === 'PAYMENT_SCHEDULE' && !scheduleDetails[record.recordId]) {
        const schedule = await getScheduleById(accessToken, record.recordId)
        setScheduleDetails((existing) => ({ ...existing, [record.recordId]: schedule }))
      }
      else if (record.recordType === 'AUTHORIZED_EXCEPTION' && !exceptionDetails[record.recordId]) {
        const exception = await getException(accessToken, record.recordId)
        setExceptionDetails((existing) => ({ ...existing, [record.recordId]: exception }))
      }
    }
  }

  function removeFromQueue(recordId: string) {
    setPending((existing) => existing?.filter((record) => record.id !== recordId))
    setExpandedId(undefined)
  }

  async function handleApprove(record: ApprovalRecordView) {
    if (decidingId || !accessToken) {
      return
    }
    setDecisionError(undefined)
    setDecidingId(record.id)
    try {
      await approveRecord(accessToken, record.recordType, record.recordId)
      removeFromQueue(record.id)
    }
    catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to approve this record right now.'
      setDecisionError({ recordId: record.id, message })
    }
    finally {
      setDecidingId(undefined)
    }
  }

  function openRejectDialog(record: ApprovalRecordView) {
    setDecisionError(undefined)
    setRejectReason('')
    setRejectingRecord(record)
  }

  function closeRejectDialog() {
    setRejectingRecord(undefined)
    setRejectReason('')
  }

  async function handleConfirmReject() {
    if (!rejectingRecord || !accessToken || rejectReason.trim() === '') {
      return
    }
    const record = rejectingRecord
    setDecidingId(record.id)
    try {
      await rejectRecord(accessToken, record.recordType, record.recordId, rejectReason.trim())
      closeRejectDialog()
      removeFromQueue(record.id)
    }
    catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to reject this record right now.'
      setDecisionError({ recordId: record.id, message })
      closeRejectDialog()
    }
    finally {
      setDecidingId(undefined)
    }
  }

  const pagination = usePagination(pending ?? [], 10)

  return (
    <Page>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            Pending Approvals
            {pending && pending.length > 0 ? (
              <span className="rounded-full bg-[var(--pending-bg)] px-2.5 py-0.5 font-mono text-sm text-[var(--pending-fg)]">{pending.length}</span>
            ) : null}
          </span>
        }
        description="Every record awaiting a Checker decision. Open a record to review its details before approving or rejecting."
      />

      {loadError ? (
        <p className="text-sm text-destructive" role="alert">
          {loadError}
        </p>
      ) : null}

      <Card className="overflow-hidden">
        {pending && pending.length === 0 ? (
          <EmptyState icon={<Inbox />}>Nothing pending your review.</EmptyState>
        ) : null}

        <ul className="divide-y">
          {pagination.pageItems.map((record) => {
            const meeting = record.recordType === 'MEETING' ? meetingDetails[record.recordId] : undefined
            const membershipChange =
              record.recordType === 'COMMITTEE_MEMBERSHIP' ? membershipDetails[record.recordId] : undefined
            const register = record.recordType === 'ATTENDANCE_REGISTER' ? registerDetails[record.recordId] : undefined
            const rateChange = record.recordType === 'RATE_TABLE' ? rateChangeDetails[record.recordId] : undefined
            const schedule = record.recordType === 'PAYMENT_SCHEDULE' ? scheduleDetails[record.recordId] : undefined
            const exception = record.recordType === 'AUTHORIZED_EXCEPTION' ? exceptionDetails[record.recordId] : undefined
            const isExpanded = expandedId === record.id
            const isSelfSubmitted = currentUserId !== undefined && currentUserId === record.submittedBy
            const TypeIcon = RECORD_TYPE_ICONS[record.recordType] ?? FileText

            const title = meeting?.title
              ?? (membershipChange ? `${membershipChange.action === 'ASSIGN' ? 'Assign to' : 'Remove from'} ${membershipChange.committeeName}` : undefined)
              ?? (register ? `Attendance Register: ${register.meetingTitle}` : undefined)
              ?? (rateChange ? `Rate: ${POSITION_LABELS[rateChange.position] ?? rateChange.position} — ${rateChange.committeeName}` : undefined)
              ?? (schedule ? `Payment Schedule: ${schedule.meetingTitle}` : undefined)
              ?? (exception ? `Authorized Exception: ${displayName(exception.memberUserId)}` : undefined)
              ?? RECORD_TYPE_LABELS[record.recordType] ?? record.recordType
            const metaCommittee = meeting?.committee ?? membershipChange?.committeeName ?? register?.committee
              ?? rateChange?.committeeName ?? schedule?.committee

            return (
              <li key={record.id} className={cn(isExpanded && 'bg-muted/40')}>
                <button
                  type="button"
                  className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/50"
                  onClick={() => toggleExpand(record)}
                  aria-expanded={isExpanded}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <TypeIcon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {metaCommittee ? `${metaCommittee} · ` : ''}
                      submitted by {displayName(record.submittedBy)} · {new Date(record.submittedAt).toLocaleString()}
                    </span>
                  </span>
                  <span className="hidden sm:block">
                    <StatusBadge status="pending" />
                  </span>
                  <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', isExpanded && 'rotate-180')} aria-hidden />
                </button>

                {isExpanded ? (
                  <div className="space-y-4 px-5 pb-5 sm:pl-[4.25rem]">
                    {detailError ? (
                      <p className="text-sm text-destructive" role="alert">
                        {detailError}
                      </p>
                    ) : null}

                    {meeting ? (
                      <DetailList
                        items={[
                          ['Chairperson', displayName(meeting.chairpersonUserId)],
                          ['Scheduled', new Date(meeting.scheduledAt).toLocaleString()],
                        ]}
                      />
                    ) : null}

                    {membershipChange ? (
                      <DetailList
                        items={[
                          ['Member', displayName(membershipChange.memberUserId)],
                          ['Action', membershipChange.action === 'ASSIGN' ? 'Assign' : 'Remove'],
                        ]}
                      />
                    ) : null}

                    {register ? (
                      <div className="overflow-hidden rounded-lg border bg-card">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Member</TableHead>
                              <TableHead>Attendance</TableHead>
                              <TableHead>Notes</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {register.entries.map((entry) => (
                              <TableRow key={entry.memberUserId}>
                                <TableCell className="font-medium">{displayName(entry.memberUserId)}</TableCell>
                                <TableCell>{MEMBER_STATUS_LABELS[entry.status] ?? entry.status}</TableCell>
                                <TableCell className="whitespace-normal text-muted-foreground">
                                  {[
                                    entry.conflictOfInterest ? `Conflict: ${entry.conflictOfInterest}` : '',
                                    entry.apologyReason ? `Apology: ${entry.apologyReason}` : '',
                                  ].filter(Boolean).join(' · ') || '—'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : null}

                    {rateChange ? (
                      <DetailList
                        items={[
                          ['Position', POSITION_LABELS[rateChange.position] ?? rateChange.position],
                          ['Rate', rateChange.rate.toFixed(2)],
                        ]}
                      />
                    ) : null}

                    {schedule ? (
                      <div className="overflow-hidden rounded-lg border bg-card">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Member</TableHead>
                              <TableHead>Position</TableHead>
                              <TableHead className="text-right">Net</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {schedule.lineItems.map((item) => (
                              <TableRow key={item.memberUserId}>
                                <TableCell className="font-medium">{displayName(item.memberUserId)}</TableCell>
                                <TableCell>{POSITION_LABELS[item.position] ?? item.position}</TableCell>
                                <TableCell className="text-right font-mono">{item.netAmount.toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                          <TableFooter>
                            <TableRow>
                              <TableCell colSpan={2}>Total net</TableCell>
                              <TableCell className="text-right font-mono">{schedule.totalNet.toFixed(2)}</TableCell>
                            </TableRow>
                          </TableFooter>
                        </Table>
                      </div>
                    ) : null}

                    {exception ? (
                      <DetailList
                        items={[
                          ['Member', displayName(exception.memberUserId)],
                          ['Reason', exception.reason],
                        ]}
                      />
                    ) : null}

                    {isSelfSubmitted ? (
                      <p className="flex items-center gap-2 rounded-md border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-sm text-[var(--warning-fg)]">
                        <ShieldAlert className="size-4 shrink-0" aria-hidden />
                        You submitted this — a different reviewer must approve it.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => handleApprove(record)} disabled={decidingId === record.id}>
                          <Check /> Approve
                        </Button>
                        <Button variant="secondary" onClick={() => openRejectDialog(record)} disabled={decidingId === record.id}>
                          <X /> Reject
                        </Button>
                      </div>
                    )}

                    {decisionError?.recordId === record.id ? (
                      <p className="text-sm text-destructive" role="alert">
                        {decisionError.message}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
        <PaginationControls {...pagination} />
      </Card>

      <Dialog open={rejectingRecord !== undefined} onOpenChange={(open) => (open ? undefined : closeRejectDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this record</DialogTitle>
            <DialogDescription>The record goes back to its Maker with your reason.</DialogDescription>
          </DialogHeader>
          <TextAreaField
            label="Reason"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            rows={4}
            autoFocus
            required
          />
          <DialogFooter>
            <Button variant="secondary" onClick={closeRejectDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmReject}
              disabled={rejectReason.trim() === '' || (rejectingRecord !== undefined && decidingId === rejectingRecord.id)}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  )
}

function DetailList({ items }: { items: [string, string][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
      {items.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
