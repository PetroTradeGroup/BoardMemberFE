import { useEffect, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { useLocation, useParams } from 'react-router-dom'
import { Card } from '../components/Card/Card'
import { Button } from '../components/Button/Button'
import { TextAreaField } from '../components/FormField/TextAreaField'
import { declareConflictOfInterest, getMyAttendance, recordAttendance, type AttendanceType } from '../api/attendanceApi'
import type { MeetingResponse } from '../api/meetingsApi'
import styles from './MemberMeetingDetail.module.css'

/**
 * Story 5.2/5.3: attendance type selector (Physical/Virtual, read-only with an explanatory
 * caption once the meeting starts -- FR11/UX-DR9) and the confidential conflict-of-interest
 * declaration (FR12). Meeting summary (title/committee/scheduledAt) comes from the router state
 * `MemberMeetings` passes on navigation, since `GET /api/v1/meetings/{id}` is staff-only --
 * Members only ever reach a meeting's detail via their own already-filtered list.
 */
export function MemberMeetingDetail() {
  const { id: meetingId } = useParams<{ id: string }>()
  const location = useLocation()
  const meeting = (location.state as { meeting?: MeetingResponse } | null)?.meeting

  const auth = useAuth()
  const accessToken = auth.user?.access_token

  const [attendanceType, setAttendanceType] = useState<AttendanceType>()
  const [loadError, setLoadError] = useState<string>()
  const [attendanceError, setAttendanceError] = useState<string>()
  const [isSavingAttendance, setIsSavingAttendance] = useState(false)

  const [declaration, setDeclaration] = useState('')
  const [coiSuccess, setCoiSuccess] = useState(false)
  const [coiError, setCoiError] = useState<string>()
  const [isSavingCoi, setIsSavingCoi] = useState(false)

  // Computed once via a lazy initializer, not inline during render (an impure Date.now() call) --
  // a reload naturally recomputes it, and this screen doesn't need to flip live mid-session.
  const [meetingHasStarted] = useState(() => (meeting ? new Date(meeting.scheduledAt).getTime() <= Date.now() : false))

  useEffect(() => {
    if (!accessToken || !meetingId) {
      return
    }
    getMyAttendance(accessToken, meetingId)
      .then((response) => {
        if (response.attendanceType) {
          setAttendanceType(response.attendanceType)
        }
        if (response.conflictOfInterest) {
          setDeclaration(response.conflictOfInterest)
        }
      })
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : 'Unable to load your attendance right now.'))
  }, [accessToken, meetingId])

  async function handleSelectAttendance(type: AttendanceType) {
    if (isSavingAttendance || !accessToken || !meetingId || meetingHasStarted) {
      return
    }
    setAttendanceError(undefined)
    setIsSavingAttendance(true)
    try {
      const response = await recordAttendance(accessToken, meetingId, type)
      setAttendanceType(response.attendanceType ?? type)
    }
    catch (error: unknown) {
      setAttendanceError(error instanceof Error ? error.message : 'Unable to save your attendance right now.')
    }
    finally {
      setIsSavingAttendance(false)
    }
  }

  async function handleSaveCoi() {
    if (isSavingCoi || !accessToken || !meetingId || declaration.trim() === '') {
      return
    }
    setCoiError(undefined)
    setCoiSuccess(false)
    setIsSavingCoi(true)
    try {
      await declareConflictOfInterest(accessToken, meetingId, declaration.trim())
      setCoiSuccess(true)
    }
    catch (error: unknown) {
      setCoiError(error instanceof Error ? error.message : 'Unable to save your declaration right now.')
    }
    finally {
      setIsSavingCoi(false)
    }
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.pageTitle}>{meeting?.title ?? 'Meeting'}</h1>
      {meeting ? (
        <p className={styles.meta}>
          {meeting.committee} &middot; {new Date(meeting.scheduledAt).toLocaleString()}
        </p>
      ) : null}

      {loadError ? (
        <p className={styles.error} role="alert">
          {loadError}
        </p>
      ) : null}

      <Card className={styles.card}>
        <p className={styles.cardTitle}>Attendance</p>
        {meetingHasStarted ? (
          <p className={styles.caption}>Attendance closed — meeting has started.</p>
        ) : (
          <div className={styles.attendanceOptions}>
            <Button
              variant={attendanceType === 'PHYSICAL' ? 'primary' : 'secondary'}
              onClick={() => handleSelectAttendance('PHYSICAL')}
              disabled={isSavingAttendance}
            >
              Physical
            </Button>
            <Button
              variant={attendanceType === 'VIRTUAL' ? 'primary' : 'secondary'}
              onClick={() => handleSelectAttendance('VIRTUAL')}
              disabled={isSavingAttendance}
            >
              Virtual
            </Button>
          </div>
        )}
        {attendanceType && !meetingHasStarted ? <p className={styles.caption}>Currently set to {attendanceType.toLowerCase()}.</p> : null}
        {attendanceError ? (
          <p className={styles.error} role="alert">
            {attendanceError}
          </p>
        ) : null}
      </Card>

      <Card className={styles.card}>
        <p className={styles.cardTitle}>Conflict of Interest</p>
        <p className={styles.caption}>Visible only to you, the Legal Officer, and the Checker.</p>
        <TextAreaField
          label="Declaration"
          value={declaration}
          onChange={(event) => {
            setDeclaration(event.target.value)
            setCoiSuccess(false)
          }}
          rows={4}
        />
        <Button onClick={handleSaveCoi} disabled={isSavingCoi || declaration.trim() === ''}>
          Save declaration
        </Button>
        {coiSuccess ? <p className={styles.success}>Declaration saved.</p> : null}
        {coiError ? (
          <p className={styles.error} role="alert">
            {coiError}
          </p>
        ) : null}
      </Card>
    </main>
  )
}
