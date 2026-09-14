import { useEffect, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { Link, useParams } from 'react-router-dom'
import { Card } from '../components/Card/Card'
import { Button } from '../components/Button/Button'
import { TextAreaField } from '../components/FormField/TextAreaField'
import { DraftLabel, StatusBadge } from '../components/StatusBadge/StatusBadge'
import {
  getRegister,
  recordApology,
  submitRegister,
  type AttendanceRegisterResponse,
  type MemberAttendanceStatus,
} from '../api/attendanceApi'
import { accessTokenHasRole } from '../auth/accessTokenRoles'
import { useUserDirectory } from '../hooks/useUserDirectory'
import styles from './StaffAttendanceRegister.module.css'

const STATUS_LABELS: Record<MemberAttendanceStatus, string> = {
  PHYSICAL: 'Physical',
  VIRTUAL: 'Virtual',
  APOLOGIZED: 'Apologized',
  NO_RESPONSE: 'No response',
}

/**
 * Story 5.5/5.6: Legal Officer compiles and submits the register; a Checker can browse here too
 * (read-only, no submit action) though their normal path is the Pending Approvals queue.
 * Per-member attendance facts (Physical/Virtual/Apologized/No response) are rendered as plain
 * text, not `StatusBadge` -- DESIGN.md reserves that component exclusively for Maker-Checker
 * lifecycle state, and these aren't that (the register's own DRAFT/Pending/Approved/Rejected
 * status is, and does use it below).
 */
export function StaffAttendanceRegister() {
  const { id: meetingId } = useParams<{ id: string }>()
  const auth = useAuth()
  const accessToken = auth.user?.access_token
  const isLegalOfficer = accessTokenHasRole(accessToken, 'legal_officer')
  const { displayName } = useUserDirectory(accessToken)

  const [register, setRegister] = useState<AttendanceRegisterResponse>()
  const [loadError, setLoadError] = useState<string>()
  const [submitError, setSubmitError] = useState<string>()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [apologyMemberId, setApologyMemberId] = useState<string>()
  const [apologyReason, setApologyReason] = useState('')
  const [apologyError, setApologyError] = useState<string>()
  const [isSavingApology, setIsSavingApology] = useState(false)

  useEffect(() => {
    if (!accessToken || !meetingId) {
      return
    }
    load(accessToken, meetingId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, meetingId])

  function load(token: string, id: string) {
    getRegister(token, id)
      .then(setRegister)
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : 'Unable to load the register right now.'))
  }

  async function handleSubmit() {
    if (isSubmitting || !accessToken || !meetingId) {
      return
    }
    setSubmitError(undefined)
    setIsSubmitting(true)
    try {
      const updated = await submitRegister(accessToken, meetingId)
      setRegister(updated)
    }
    catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to submit this register right now.')
    }
    finally {
      setIsSubmitting(false)
    }
  }

  function openApologyForm(memberUserId: string) {
    setApologyError(undefined)
    setApologyReason('')
    setApologyMemberId(memberUserId)
  }

  async function handleSaveApology() {
    if (isSavingApology || !accessToken || !meetingId || !apologyMemberId || apologyReason.trim() === '') {
      return
    }
    setIsSavingApology(true)
    setApologyError(undefined)
    try {
      await recordApology(accessToken, meetingId, apologyMemberId, apologyReason.trim())
      setApologyMemberId(undefined)
      load(accessToken, meetingId)
    }
    catch (error: unknown) {
      setApologyError(error instanceof Error ? error.message : 'Unable to record this apology right now.')
    }
    finally {
      setIsSavingApology(false)
    }
  }

  const canSubmit = register && (register.status === 'DRAFT' || register.status === 'REJECTED')

  return (
    <main className={styles.page}>
      <h1 className={styles.pageTitle}>Attendance Register</h1>

      {loadError ? (
        <p className={styles.error} role="alert">
          {loadError}
        </p>
      ) : null}

      {register ? (
        <Card className={styles.card}>
          <p className={styles.cardTitle}>{register.meetingTitle}</p>
          <p className={styles.caption}>{register.committee}</p>
          {register.status === 'DRAFT' ? <DraftLabel /> : <StatusBadge status={statusToBadge(register.status)} />}
          {register.rejectionReason ? <p className={styles.rejectionReason}>Reason: {register.rejectionReason}</p> : null}

          <div className={styles.entries}>
            {register.entries.map((entry) => (
              <div key={entry.memberUserId} className={styles.entryRow}>
                <div className={styles.entryHeader}>
                  <span className={styles.entryMember}>{displayName(entry.memberUserId)}</span>
                  <span className={styles.entryStatus}>{STATUS_LABELS[entry.status]}</span>
                </div>
                {entry.conflictOfInterest ? <p className={styles.coi}>COI: {entry.conflictOfInterest}</p> : null}
                {entry.apologyReason ? <p className={styles.caption}>Apology: {entry.apologyReason}</p> : null}

                {isLegalOfficer && canSubmit && entry.status === 'NO_RESPONSE' ? (
                  apologyMemberId === entry.memberUserId ? (
                    <div className={styles.apologyForm}>
                      <TextAreaField
                        label="Apology reason"
                        value={apologyReason}
                        onChange={(event) => setApologyReason(event.target.value)}
                        rows={2}
                        autoFocus
                      />
                      <div className={styles.apologyActions}>
                        <Button variant="secondary" onClick={() => setApologyMemberId(undefined)}>
                          Cancel
                        </Button>
                        <Button onClick={handleSaveApology} disabled={isSavingApology || apologyReason.trim() === ''}>
                          Save apology
                        </Button>
                      </div>
                      {apologyError ? (
                        <p className={styles.error} role="alert">
                          {apologyError}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <Button variant="secondary" onClick={() => openApologyForm(entry.memberUserId)}>
                      Record apology
                    </Button>
                  )
                ) : null}
              </div>
            ))}
          </div>

          {isLegalOfficer ? (
            canSubmit ? (
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                Submit for Approval
              </Button>
            ) : (
              <p className={styles.caption}>
                {register.status === 'PENDING_APPROVAL' ? 'Awaiting Checker decision.' : 'Register is Approved.'}
              </p>
            )
          ) : null}
          {submitError ? (
            <p className={styles.error} role="alert">
              {submitError}
            </p>
          ) : null}

          {/* Story 6.3: EXPERIENCE.md's explicit "never silently hidden" rule -- the action is
              always visible, with a caption naming the exact blocking condition when disabled. */}
          {register.status === 'APPROVED' ? (
            <Link to={`/staff/meetings/${meetingId}/payment-schedule`}>
              <Button variant="secondary">Generate Payment Schedule</Button>
            </Link>
          ) : (
            <>
              <Button variant="secondary" disabled>
                Generate Payment Schedule
              </Button>
              <p className={styles.caption}>Available once this register is approved.</p>
            </>
          )}
        </Card>
      ) : null}
    </main>
  )
}

function statusToBadge(status: AttendanceRegisterResponse['status']): 'pending' | 'approved' | 'rejected' {
  if (status === 'APPROVED') {
    return 'approved'
  }
  if (status === 'REJECTED') {
    return 'rejected'
  }
  return 'pending'
}
