import { useEffect, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { Card } from '../components/Card/Card'
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
import styles from './PendingApprovals.module.css'

const MEMBER_STATUS_LABELS: Record<string, string> = {
  PHYSICAL: 'Physical',
  VIRTUAL: 'Virtual',
  APOLOGIZED: 'Apologized',
  NO_RESPONSE: 'No response',
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
      .then(setPending)
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : 'Unable to load pending approvals right now.'))
  }, [accessToken])

  async function toggleExpand(record: ApprovalRecordView) {
    if (expandedId === record.id) {
      setExpandedId(undefined)
      return
    }
    setExpandedId(record.id)
    if (!accessToken) {
      return
    }
    setDetailError(undefined)
    try {
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
    catch (error: unknown) {
      setDetailError(error instanceof Error ? error.message : 'Unable to load this record right now.')
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
    <main className={styles.page}>
      <h1 className={styles.pageTitle}>Pending Approvals</h1>

      {loadError ? (
        <p className={styles.error} role="alert">
          {loadError}
        </p>
      ) : null}

      <Card className={styles.card}>
        {pending && pending.length === 0 ? (
          <p className={styles.emptyState}>Nothing pending your review.</p>
        ) : null}

        {pagination.pageItems.map((record, index) => {
          const meeting = record.recordType === 'MEETING' ? meetingDetails[record.recordId] : undefined
          const membershipChange =
            record.recordType === 'COMMITTEE_MEMBERSHIP' ? membershipDetails[record.recordId] : undefined
          const register = record.recordType === 'ATTENDANCE_REGISTER' ? registerDetails[record.recordId] : undefined
          const rateChange = record.recordType === 'RATE_TABLE' ? rateChangeDetails[record.recordId] : undefined
          const schedule = record.recordType === 'PAYMENT_SCHEDULE' ? scheduleDetails[record.recordId] : undefined
          const exception = record.recordType === 'AUTHORIZED_EXCEPTION' ? exceptionDetails[record.recordId] : undefined
          const isExpanded = expandedId === record.id
          const isSelfSubmitted = currentUserId !== undefined && currentUserId === record.submittedBy
          const isLast = index === pagination.pageItems.length - 1

          const title = meeting?.title
            ?? (membershipChange ? `${membershipChange.action === 'ASSIGN' ? 'Assign to' : 'Remove from'} ${membershipChange.committeeName}` : undefined)
            ?? (register ? `Attendance Register: ${register.meetingTitle}` : undefined)
            ?? (rateChange ? `Rate: ${POSITION_LABELS[rateChange.position] ?? rateChange.position} — ${rateChange.committeeName}` : undefined)
            ?? (schedule ? `Payment Schedule: ${schedule.meetingTitle}` : undefined)
            ?? (exception ? `Authorized Exception: ${displayName(exception.memberUserId)}` : undefined)
            ?? `${record.recordType} ${record.recordId}`
          const metaCommittee = meeting?.committee ?? membershipChange?.committeeName ?? register?.committee
            ?? rateChange?.committeeName ?? schedule?.committee

          return (
            <div
              key={record.id}
              className={`${styles.row} ${isLast ? styles.rowLast : ''}`}
            >
              <button type="button" className={styles.rowHeader} onClick={() => toggleExpand(record)}>
                <span className={styles.rowTitleBlock}>
                  <span className={styles.rowTitle}>{title}</span>
                  <span className={styles.rowMeta}>
                    {metaCommittee ? `${metaCommittee} · ` : ''}
                    submitted by {displayName(record.submittedBy)} · {new Date(record.submittedAt).toLocaleString()}
                  </span>
                </span>
                <StatusBadge status="pending" />
              </button>

              {isExpanded ? (
                <div className={styles.detail}>
                  {detailError ? (
                    <p className={styles.error} role="alert">
                      {detailError}
                    </p>
                  ) : null}

                  {meeting ? (
                    <div className={styles.detailMeta}>
                      <p>Chairperson: {displayName(meeting.chairpersonUserId)}</p>
                      <p>Scheduled: {new Date(meeting.scheduledAt).toLocaleString()}</p>
                    </div>
                  ) : null}

                  {membershipChange ? (
                    <div className={styles.detailMeta}>
                      <p>Member: {displayName(membershipChange.memberUserId)}</p>
                      <p>Action: {membershipChange.action === 'ASSIGN' ? 'Assign' : 'Remove'}</p>
                    </div>
                  ) : null}

                  {register ? (
                    <div className={styles.detailMeta}>
                      {register.entries.map((entry) => (
                        <p key={entry.memberUserId}>
                          {displayName(entry.memberUserId)}: {MEMBER_STATUS_LABELS[entry.status] ?? entry.status}
                          {entry.conflictOfInterest ? ` (COI: ${entry.conflictOfInterest})` : ''}
                          {entry.apologyReason ? ` (Apology: ${entry.apologyReason})` : ''}
                        </p>
                      ))}
                    </div>
                  ) : null}

                  {rateChange ? (
                    <div className={styles.detailMeta}>
                      <p>Position: {POSITION_LABELS[rateChange.position] ?? rateChange.position}</p>
                      <p>Rate: {rateChange.rate.toFixed(2)}</p>
                    </div>
                  ) : null}

                  {schedule ? (
                    <div className={styles.detailMeta}>
                      {schedule.lineItems.map((item) => (
                        <p key={item.memberUserId}>
                          {displayName(item.memberUserId)}: {POSITION_LABELS[item.position] ?? item.position} &middot; net {item.netAmount.toFixed(2)}
                        </p>
                      ))}
                      <p>Total net: {schedule.totalNet.toFixed(2)}</p>
                    </div>
                  ) : null}

                  {exception ? (
                    <div className={styles.detailMeta}>
                      <p>Member: {displayName(exception.memberUserId)}</p>
                      <p>Reason: {exception.reason}</p>
                    </div>
                  ) : null}

                  {isSelfSubmitted ? (
                    <p className={styles.sodNotice}>You submitted this — a different reviewer must approve it.</p>
                  ) : (
                    <div className={styles.actions}>
                      <Button onClick={() => handleApprove(record)} disabled={decidingId === record.id}>
                        Approve
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => openRejectDialog(record)}
                        disabled={decidingId === record.id}
                      >
                        Reject
                      </Button>
                    </div>
                  )}

                  {decisionError?.recordId === record.id ? (
                    <p className={styles.error} role="alert">
                      {decisionError.message}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          )
        })}
        <PaginationControls {...pagination} />
      </Card>

      {rejectingRecord ? (
        <div className={styles.overlay} role="presentation" onClick={closeRejectDialog}>
          <div
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <p id="reject-dialog-title" className={styles.dialogTitle}>
              Reject this record
            </p>
            <TextAreaField
              label="Reason"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              rows={4}
              autoFocus
              required
            />
            <div className={styles.dialogActions}>
              <Button variant="secondary" onClick={closeRejectDialog}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirmReject}
                disabled={rejectReason.trim() === '' || decidingId === rejectingRecord.id}
              >
                Reject
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
