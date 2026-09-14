import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from 'react-oidc-context'
import { Link } from 'react-router-dom'
import { Card } from '../components/Card/Card'
import { Button } from '../components/Button/Button'
import { FormField } from '../components/FormField/FormField'
import { SelectField } from '../components/FormField/SelectField'
import { DraftLabel, StatusBadge, type BadgeStatus } from '../components/StatusBadge/StatusBadge'
import { usePagination } from '../components/Pagination/usePagination'
import { PaginationControls } from '../components/Pagination/PaginationControls'
import {
  ApiError,
  createMeeting,
  listMeetings,
  submitMeetingForApproval,
  type MeetingResponse,
  type MeetingStatus,
} from '../api/meetingsApi'
import styles from './StaffMeetings.module.css'

const STATUS_BADGES: Partial<Record<MeetingStatus, BadgeStatus>> = {
  PENDING_APPROVAL: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
}

// Petrotrade's 6-body structure (Main Board + five committees), per the UX design mockup
// (key-meeting-create.html) -- the only place these real committee names are specified. The
// backend stores this as free text for now (Epic 4 introduces a real Committee entity/id).
const COMMITTEE_OPTIONS = [
  'Main Board',
  'Finance Committee',
  'Audit Committee',
  'Human Resources Committee',
  'Risk Management and Compliance Committee',
  'Operations Committee',
].map((name) => ({ value: name, label: name }))

/** Story 3.3: Staff > Meetings -- create a Draft meeting, then submit it for approval. */
export function StaffMeetings() {
  const auth = useAuth()
  const accessToken = auth.user?.access_token

  const [title, setTitle] = useState('')
  const [committee, setCommittee] = useState(COMMITTEE_OPTIONS[0].value)
  const [chairpersonUserId, setChairpersonUserId] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const [isSaving, setIsSaving] = useState(false)

  const [meetings, setMeetings] = useState<MeetingResponse[]>([])
  const [listError, setListError] = useState<string>()
  const [submittingId, setSubmittingId] = useState<string>()
  const [submitError, setSubmitError] = useState<{ meetingId: string; message: string }>()

  useEffect(() => {
    if (!accessToken) {
      return
    }
    listMeetings(accessToken)
      .then((response) => setMeetings(response.items))
      .catch((error: unknown) => setListError(error instanceof Error ? error.message : 'Unable to load meetings right now.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken])

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSaving || !accessToken) {
      return
    }

    setFieldErrors({})
    setFormError(undefined)
    setIsSaving(true)

    try {
      // datetime-local has no timezone; interpreted in the browser's local zone, same as a user
      // reading a wall-clock meeting time would expect.
      const scheduledAtIso = scheduledAt ? new Date(scheduledAt).toISOString() : ''
      const created = await createMeeting(accessToken, { title, committee, chairpersonUserId, scheduledAt: scheduledAtIso })
      setMeetings((existing) => [created, ...existing])
      setTitle('')
      setChairpersonUserId('')
      setScheduledAt('')
    }
    catch (error: unknown) {
      if (error instanceof ApiError) {
        const nextFieldErrors: Record<string, string> = {}
        for (const fieldError of error.fields) {
          nextFieldErrors[fieldError.field] = fieldError.message
        }
        setFieldErrors(nextFieldErrors)
        if (error.fields.length === 0) {
          setFormError(error.message)
        }
      }
      else {
        setFormError(error instanceof Error ? error.message : 'Unable to create this meeting right now.')
      }
    }
    finally {
      setIsSaving(false)
    }
  }

  async function handleSubmitForApproval(meetingId: string) {
    if (submittingId || !accessToken) {
      return
    }
    setSubmitError(undefined)
    setSubmittingId(meetingId)
    try {
      const updated = await submitMeetingForApproval(accessToken, meetingId)
      setMeetings((existing) => existing.map((meeting) => (meeting.id === meetingId ? updated : meeting)))
    }
    catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to submit this meeting for approval right now.'
      setSubmitError({ meetingId, message })
    }
    finally {
      setSubmittingId(undefined)
    }
  }

  const pagination = usePagination(meetings, 10)

  return (
    <main className={styles.page}>
      <h1 className={styles.pageTitle}>Meetings</h1>

      <Card className={styles.card}>
        <p className={styles.cardTitle}>Create Meeting</p>
        <form className={styles.form} onSubmit={handleCreate}>
          <FormField
            label="Title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            error={fieldErrors.title}
            required
          />
          <FormField
            label="Date and time"
            type="datetime-local"
            value={scheduledAt}
            onChange={(event) => setScheduledAt(event.target.value)}
            error={fieldErrors.scheduledAt}
            required
          />
          <SelectField
            label="Committee"
            value={committee}
            onChange={(event) => setCommittee(event.target.value)}
            options={COMMITTEE_OPTIONS}
            error={fieldErrors.committee}
          />
          <FormField
            label="Chairperson (user ID)"
            value={chairpersonUserId}
            onChange={(event) => setChairpersonUserId(event.target.value)}
            error={fieldErrors.chairpersonUserId}
            required
          />
          <p className={styles.caption}>Not visible to Members until approved.</p>
          <Button type="submit" variant="secondary" disabled={isSaving}>
            Save as Draft
          </Button>
          {formError ? (
            <p className={styles.error} role="alert">
              {formError}
            </p>
          ) : null}
        </form>
      </Card>

      {listError ? (
        <p className={styles.error} role="alert">
          {listError}
        </p>
      ) : null}

      {pagination.pageItems.map((meeting) => (
        <Card key={meeting.id} className={styles.card}>
          <p className={styles.cardTitle}>{meeting.title}</p>
          {meeting.status === 'DRAFT' ? <DraftLabel /> : <StatusBadge status={STATUS_BADGES[meeting.status] ?? 'pending'} />}
          <div className={styles.metaBlock}>
            {meeting.committee} &middot; {new Date(meeting.scheduledAt).toLocaleString()}
          </div>
          {meeting.status === 'DRAFT' ? (
            <Button
              onClick={() => handleSubmitForApproval(meeting.id)}
              disabled={submittingId === meeting.id}
            >
              Submit for Approval
            </Button>
          ) : meeting.status === 'PENDING_APPROVAL' ? (
            <p className={styles.caption}>Appears in the Checker&apos;s Pending Approvals queue.</p>
          ) : meeting.status === 'APPROVED' ? (
            <Link to={`/staff/meetings/${meeting.id}/register`}>
              <Button variant="secondary">View Register</Button>
            </Link>
          ) : null}
          {submitError?.meetingId === meeting.id ? (
            <p className={styles.error} role="alert">
              {submitError.message}
            </p>
          ) : null}
        </Card>
      ))}
      {meetings.length > 0 ? (
        <Card className={styles.card}>
          <PaginationControls {...pagination} />
        </Card>
      ) : null}
    </main>
  )
}
