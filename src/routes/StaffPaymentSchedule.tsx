import { useEffect, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { useParams } from 'react-router-dom'
import { Card } from '../components/Card/Card'
import { Button } from '../components/Button/Button'
import { TextAreaField } from '../components/FormField/TextAreaField'
import { DraftLabel, StatusBadge } from '../components/StatusBadge/StatusBadge'
import { accessTokenHasRole } from '../auth/accessTokenRoles'
import { useUserDirectory } from '../hooks/useUserDirectory'
import {
  ApiError,
  generateSchedule,
  getScheduleByMeeting,
  requestException,
  submitSchedule,
  type PaymentScheduleResponse,
} from '../api/paymentsApi'
import styles from './StaffPaymentSchedule.module.css'

const ATTENDANCE_LABELS: Record<string, string> = {
  PHYSICAL: 'Physical',
  VIRTUAL: 'Virtual',
  APOLOGIZED: 'Apologized — included via approved exception',
  NO_RESPONSE: 'No response',
}

const EXCLUDED_REASON_LABELS: Record<string, string> = {
  APOLOGY_RECORDED: 'Apology recorded',
  ABSENT: 'Absent',
}

const EXCEPTION_STATUS_LABELS: Record<string, string> = {
  PENDING_APPROVAL: 'Exception pending',
  APPROVED: 'Exception approved',
  REJECTED: 'Exception rejected',
}

/**
 * Story 6.3/6.4/6.5: Legal Officer generates a schedule from the meeting's Approved register and
 * the current Rate Table, requests Authorized Exceptions for excluded members, then submits for
 * Checker approval. Never reachable by Members (Story 6.3 AC3) -- the route itself is gated
 * legal_officer/checker, matching the backend's own role restriction.
 */
export function StaffPaymentSchedule() {
  const { id: meetingId } = useParams<{ id: string }>()
  const auth = useAuth()
  const accessToken = auth.user?.access_token
  const isLegalOfficer = accessTokenHasRole(accessToken, 'legal_officer')
  const { displayName } = useUserDirectory(accessToken)

  const [schedule, setSchedule] = useState<PaymentScheduleResponse>()
  const [notYetGenerated, setNotYetGenerated] = useState(false)
  const [loadError, setLoadError] = useState<string>()
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string>()

  const [exceptionMemberId, setExceptionMemberId] = useState<string>()
  const [exceptionReason, setExceptionReason] = useState('')
  const [exceptionError, setExceptionError] = useState<string>()
  const [isRequestingException, setIsRequestingException] = useState(false)
  const [requestedExceptions, setRequestedExceptions] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!accessToken || !meetingId) {
      return
    }
    load(accessToken, meetingId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, meetingId])

  function load(token: string, id: string) {
    setLoadError(undefined)
    setNotYetGenerated(false)
    getScheduleByMeeting(token, id)
      .then(setSchedule)
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.message.toLowerCase().includes('no payment schedule')) {
          setNotYetGenerated(true)
          return
        }
        setLoadError(error instanceof Error ? error.message : 'Unable to load the payment schedule right now.')
      })
  }

  async function handleGenerate() {
    if (isGenerating || !accessToken || !meetingId) {
      return
    }
    setGenerateError(undefined)
    setIsGenerating(true)
    try {
      const updated = await generateSchedule(accessToken, meetingId)
      setSchedule(updated)
      setNotYetGenerated(false)
    }
    catch (error: unknown) {
      setGenerateError(error instanceof Error ? error.message : 'Unable to generate this schedule right now.')
    }
    finally {
      setIsGenerating(false)
    }
  }

  async function handleSubmit() {
    if (isSubmitting || !accessToken || !schedule) {
      return
    }
    setSubmitError(undefined)
    setIsSubmitting(true)
    try {
      const updated = await submitSchedule(accessToken, schedule.id)
      setSchedule(updated)
    }
    catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to submit this schedule right now.')
    }
    finally {
      setIsSubmitting(false)
    }
  }

  function openExceptionForm(memberUserId: string) {
    setExceptionError(undefined)
    setExceptionReason('')
    setExceptionMemberId(memberUserId)
  }

  async function handleRequestException() {
    if (isRequestingException || !accessToken || !meetingId || !exceptionMemberId || exceptionReason.trim() === '') {
      return
    }
    setIsRequestingException(true)
    setExceptionError(undefined)
    try {
      const response = await requestException(accessToken, {
        meetingId,
        memberUserId: exceptionMemberId,
        reason: exceptionReason.trim(),
      })
      setRequestedExceptions((existing) => ({ ...existing, [exceptionMemberId]: response.status }))
      setExceptionMemberId(undefined)
    }
    catch (error: unknown) {
      setExceptionError(error instanceof Error ? error.message : 'Unable to request this exception right now.')
    }
    finally {
      setIsRequestingException(false)
    }
  }

  const canEdit = schedule && (schedule.status === 'DRAFT' || schedule.status === 'REJECTED')

  return (
    <main className={styles.page}>
      <h1 className={styles.pageTitle}>Payment Schedule</h1>

      {loadError ? (
        <p className={styles.error} role="alert">
          {loadError}
        </p>
      ) : null}

      {notYetGenerated ? (
        <Card className={styles.card}>
          <p className={styles.caption}>No payment schedule has been generated yet for this meeting.</p>
          {isLegalOfficer ? (
            <Button onClick={handleGenerate} disabled={isGenerating}>
              Generate Payment Schedule
            </Button>
          ) : null}
          {generateError ? (
            <p className={styles.error} role="alert">
              {generateError}
            </p>
          ) : null}
        </Card>
      ) : null}

      {schedule ? (
        <Card className={styles.card}>
          <div className={styles.topbar}>
            <p className={styles.cardTitle}>
              {schedule.committee} — {schedule.meetingTitle}
            </p>
            {schedule.status === 'DRAFT' ? <DraftLabel /> : <StatusBadge status={statusToBadge(schedule.status)} />}
          </div>
          {schedule.rejectionReason ? <p className={styles.rejectionReason}>Reason: {schedule.rejectionReason}</p> : null}

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Position</th>
                  <th>Attendance</th>
                  <th className={styles.num}>Rate Applied</th>
                  <th className={styles.num}>Gross</th>
                  <th className={styles.num}>Deductions</th>
                  <th className={styles.num}>Net</th>
                </tr>
              </thead>
              <tbody>
                {schedule.lineItems.map((item) => (
                  <tr key={item.memberUserId}>
                    <td>{displayName(item.memberUserId)}</td>
                    <td>{item.position}</td>
                    <td>{ATTENDANCE_LABELS[item.attendanceStatus] ?? item.attendanceStatus}</td>
                    <td className={styles.num}>{item.rateApplied.toFixed(2)}</td>
                    <td className={styles.num}>{item.grossAmount.toFixed(2)}</td>
                    <td className={styles.num}>{item.deductionsAmount.toFixed(2)}</td>
                    <td className={styles.num}>{item.netAmount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>Totals</td>
                  <td className={styles.num}>{schedule.totalGross.toFixed(2)}</td>
                  <td className={styles.num}>{schedule.totalDeductions.toFixed(2)}</td>
                  <td className={styles.num}>{schedule.totalNet.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {schedule.excludedMembers.length > 0 ? (
            <div className={styles.excludedSection}>
              <p className={styles.excludedTitle}>Not included in this schedule</p>
              {schedule.excludedMembers.map((excluded) => {
                const exceptionStatus = requestedExceptions[excluded.memberUserId] ?? excluded.exceptionStatus
                return (
                  <div key={excluded.memberUserId} className={styles.excludedRow}>
                    <span>
                      {displayName(excluded.memberUserId)} &middot; {excluded.position}
                      <span className={styles.excludedNote}> — Not included &middot; {EXCLUDED_REASON_LABELS[excluded.reason]}</span>
                    </span>
                    {isLegalOfficer && canEdit ? (
                      exceptionStatus ? (
                        <span className={styles.caption}>{EXCEPTION_STATUS_LABELS[exceptionStatus] ?? exceptionStatus}</span>
                      ) : exceptionMemberId === excluded.memberUserId ? null : (
                        <Button variant="secondary" onClick={() => openExceptionForm(excluded.memberUserId)}>
                          Request Authorized Exception
                        </Button>
                      )
                    ) : null}
                  </div>
                )
              })}
              {exceptionMemberId ? (
                <div className={styles.exceptionForm}>
                  <TextAreaField
                    label="Reason for exception"
                    value={exceptionReason}
                    onChange={(event) => setExceptionReason(event.target.value)}
                    rows={2}
                    autoFocus
                  />
                  <div className={styles.exceptionActions}>
                    <Button variant="secondary" onClick={() => setExceptionMemberId(undefined)}>
                      Cancel
                    </Button>
                    <Button onClick={handleRequestException} disabled={isRequestingException || exceptionReason.trim() === ''}>
                      Request exception
                    </Button>
                  </div>
                  {exceptionError ? (
                    <p className={styles.error} role="alert">
                      {exceptionError}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {isLegalOfficer ? (
            canEdit ? (
              <div className={styles.actions}>
                <Button variant="secondary" onClick={handleGenerate} disabled={isGenerating}>
                  {isGenerating ? 'Regenerating…' : 'Save as Draft'}
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  Submit for Approval
                </Button>
              </div>
            ) : (
              <p className={styles.caption}>
                {schedule.status === 'PENDING_APPROVAL' ? 'Awaiting Checker decision.' : 'Schedule is Approved.'}
              </p>
            )
          ) : null}
          {generateError ? (
            <p className={styles.error} role="alert">
              {generateError}
            </p>
          ) : null}
          {submitError ? (
            <p className={styles.error} role="alert">
              {submitError}
            </p>
          ) : null}
        </Card>
      ) : null}
    </main>
  )
}

function statusToBadge(status: PaymentScheduleResponse['status']): 'pending' | 'approved' | 'rejected' {
  if (status === 'APPROVED') {
    return 'approved'
  }
  if (status === 'REJECTED') {
    return 'rejected'
  }
  return 'pending'
}
