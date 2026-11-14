import { useEffect, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
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
import { ArrowLeft, Calculator, Send } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { FormMessage, Page, PageHeader, Section } from '../components/Page/Page'

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
    <Page>
      <PageHeader
        title="Attendance Register"
        description={register ? register.meetingTitle : undefined}
        actions={
          <Button variant="outline" asChild>
            <Link to="/staff/meetings">
              <ArrowLeft /> Meetings
            </Link>
          </Button>
        }
      />

      {loadError ? <FormMessage error={loadError} /> : null}

      {register ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            {register.status === 'DRAFT' ? <DraftLabel /> : <StatusBadge status={statusToBadge(register.status)} />}
            <span className="text-sm text-muted-foreground">{register.committee}</span>
          </div>

          {register.rejectionReason ? (
            <p className="rounded-md border border-[var(--rejected-border)] bg-[var(--rejected-bg)] px-3 py-2 text-sm text-[var(--rejected-fg)]">
              Rejected — {register.rejectionReason}
            </p>
          ) : null}

          <Section title="Members" description="Attendance is recorded by each member; apologies are recorded here">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Attendance</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {register.entries.map((entry) => (
                  <TableRow key={entry.memberUserId}>
                    <TableCell className="font-medium">{displayName(entry.memberUserId)}</TableCell>
                    <TableCell>
                      <span className={cn('inline-flex items-center gap-1.5', entry.status === 'NO_RESPONSE' && 'text-muted-foreground')}>
                        <span className={cn('size-1.5 rounded-full', STATUS_DOTS[entry.status] ?? 'bg-muted-foreground')} aria-hidden />
                        {STATUS_LABELS[entry.status]}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-xs whitespace-normal text-xs text-muted-foreground">
                      {entry.conflictOfInterest ? <p className="text-[var(--warning-fg)]">COI: {entry.conflictOfInterest}</p> : null}
                      {entry.apologyReason ? <p>Apology: {entry.apologyReason}</p> : null}
                      {!entry.conflictOfInterest && !entry.apologyReason ? '—' : null}
                    </TableCell>
                    <TableCell className="text-right">
                      {isLegalOfficer && canSubmit && entry.status === 'NO_RESPONSE' ? (
                        <Button size="sm" variant="outline" onClick={() => openApologyForm(entry.memberUserId)}>
                          Record apology
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {isLegalOfficer ? (
              canSubmit ? (
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  <Send /> Submit for Approval
                </Button>
              ) : (
                <span className="text-sm text-muted-foreground">
                  {register.status === 'PENDING_APPROVAL' ? 'Awaiting Checker decision.' : 'Register is Approved.'}
                </span>
              )
            ) : null}

            {/* Story 6.3: EXPERIENCE.md's explicit "never silently hidden" rule -- the action is
                always visible, with a caption naming the exact blocking condition when disabled. */}
            {register.status === 'APPROVED' ? (
              <Button variant="outline" asChild>
                <Link to={`/staff/meetings/${meetingId}/payment-schedule`}>
                  <Calculator /> Generate Payment Schedule
                </Link>
              </Button>
            ) : (
              <span className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">Available once this register is approved.</span>
                <Button variant="outline" disabled>
                  <Calculator /> Generate Payment Schedule
                </Button>
              </span>
            )}
          </div>
          <FormMessage error={submitError} />
        </>
      ) : null}

      <Dialog open={apologyMemberId !== undefined} onOpenChange={(open) => (open ? undefined : setApologyMemberId(undefined))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record apology</DialogTitle>
            <DialogDescription>{apologyMemberId ? `For ${displayName(apologyMemberId)}. ` : ''}Included in the register and the governance report.</DialogDescription>
          </DialogHeader>
          <TextAreaField
            label="Apology reason"
            value={apologyReason}
            onChange={(event) => setApologyReason(event.target.value)}
            rows={3}
            autoFocus
          />
          <FormMessage error={apologyError} />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setApologyMemberId(undefined)}>
              Cancel
            </Button>
            <Button onClick={handleSaveApology} disabled={isSavingApology || apologyReason.trim() === ''}>
              Save apology
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  )
}

const STATUS_DOTS: Record<string, string> = {
  PHYSICAL: 'bg-primary',
  VIRTUAL: 'bg-brand-gold',
  APOLOGIZED: 'bg-[var(--pending-fg)]',
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
