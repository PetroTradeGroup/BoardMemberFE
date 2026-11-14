import { useEffect, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { TextAreaField } from '../components/FormField/TextAreaField'
import { declareConflictOfInterest, getMyAttendance, recordAttendance, type AttendanceType } from '../api/attendanceApi'
import { listMeetings, type MeetingResponse } from '../api/meetingsApi'
import { ArrowLeft, Lock, MapPin, ShieldCheck, Video } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FormMessage, Page, PageHeader, Section } from '../components/Page/Page'

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
  const stateMeeting = (location.state as { meeting?: MeetingResponse } | null)?.meeting
  const [fetchedMeeting, setFetchedMeeting] = useState<MeetingResponse>()
  const meeting = stateMeeting ?? fetchedMeeting

  const auth = useAuth()
  const accessToken = auth.user?.access_token

  // Direct link / page refresh: no router state, so find the meeting in the Member's own
  // (already committee-filtered) list -- the single-meeting endpoint is staff-only.
  useEffect(() => {
    if (stateMeeting || !accessToken || !meetingId) {
      return
    }
    listMeetings(accessToken)
      .then((response) => setFetchedMeeting(response.items.find((item) => item.id === meetingId)))
      .catch(() => {
        // Non-fatal: the attendance/COI controls still work without the summary header.
      })
  }, [stateMeeting, accessToken, meetingId])

  const [attendanceType, setAttendanceType] = useState<AttendanceType>()
  const [loadError, setLoadError] = useState<string>()
  const [attendanceError, setAttendanceError] = useState<string>()
  const [isSavingAttendance, setIsSavingAttendance] = useState(false)

  const [declaration, setDeclaration] = useState('')
  const [coiSuccess, setCoiSuccess] = useState(false)
  const [coiError, setCoiError] = useState<string>()
  const [isSavingCoi, setIsSavingCoi] = useState(false)

  // "Now" captured once via a lazy initializer (not an impure Date.now() during render); the
  // comparison is derived so it also works when the meeting summary arrives after mount.
  const [now] = useState(() => Date.now())
  const meetingHasStarted = meeting ? new Date(meeting.scheduledAt).getTime() <= now : false

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
    <Page>
      <PageHeader
        title={meeting?.title ?? 'Meeting'}
        description={meeting ? `${meeting.committee} · ${new Date(meeting.scheduledAt).toLocaleString()}` : undefined}
        actions={
          <Button variant="outline" asChild>
            <Link to="/member/meetings">
              <ArrowLeft /> Meetings
            </Link>
          </Button>
        }
      />

      {loadError ? <FormMessage error={loadError} /> : null}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Section title="Attendance" description="How you will attend. You can change this until the meeting starts.">
          <div className="space-y-3 p-5">
            {meetingHasStarted ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="size-4" /> Attendance closed — meeting has started.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {(['PHYSICAL', 'VIRTUAL'] as const).map((type) => {
                  const selected = attendanceType === type
                  const Icon = type === 'PHYSICAL' ? MapPin : Video
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleSelectAttendance(type)}
                      disabled={isSavingAttendance}
                      aria-pressed={selected}
                      className={cn(
                        'flex flex-col items-center gap-2 rounded-lg border p-4 text-sm font-medium transition-colors disabled:opacity-50',
                        selected ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20' : 'hover:bg-accent',
                      )}
                    >
                      <Icon className="size-5" aria-hidden />
                      {type === 'PHYSICAL' ? 'Physical' : 'Virtual'}
                    </button>
                  )
                })}
              </div>
            )}
            {attendanceType && !meetingHasStarted ? (
              <p className="text-sm text-muted-foreground">Currently set to {attendanceType.toLowerCase()}.</p>
            ) : null}
            <FormMessage error={attendanceError} />
          </div>
        </Section>

        <Section title="Conflict of Interest" description="Visible only to you, the Legal Officer, and the Checker.">
          <div className="space-y-4 p-5">
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
              <ShieldCheck /> Save declaration
            </Button>
            <FormMessage error={coiError} success={coiSuccess ? 'Declaration saved.' : undefined} />
          </div>
        </Section>
      </div>
    </Page>
  )
}
