import { useEffect, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { Link, useParams } from 'react-router-dom'
import { Card } from '../components/Card/Card'
import { ArrowLeft, Calculator, Loader2, RefreshCw, Send, UserX } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState, Kpi, Page, PageHeader, Section } from '../components/Page/Page'
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

const ATTENDANCE_LABELS: Record<string, string> = {
  PHYSICAL: 'Physical',
  VIRTUAL: 'Virtual',
  APOLOGIZED: 'Apologized — included via approved exception',
  NO_RESPONSE: 'No response',
}

const POSITION_LABELS: Record<string, string> = {
  CHAIRPERSON: 'Chairperson',
  VICE_CHAIRPERSON: 'Vice-Chairperson',
  MEMBER: 'Member',
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
    <Page>
      <PageHeader
        title="Payment Schedule"
        description={schedule ? `${schedule.committee} — ${schedule.meetingTitle}` : 'Sitting fees derived from the approved attendance register'}
        actions={
          meetingId ? (
            <Button variant="secondary" asChild>
              <Link to={`/staff/meetings/${meetingId}/register`}>
                <ArrowLeft /> Attendance register
              </Link>
            </Button>
          ) : null
        }
      />

      {loadError ? (
        <p className="text-sm text-destructive" role="alert">
          {loadError}
        </p>
      ) : null}

      {notYetGenerated ? (
        <Card>
          <EmptyState icon={<Calculator />}>No payment schedule has been generated yet for this meeting.</EmptyState>
          {isLegalOfficer ? (
            <div className="flex justify-center pb-8">
              <Button onClick={handleGenerate} disabled={isGenerating}>
                {isGenerating ? <Loader2 className="animate-spin" /> : <Calculator />}
                Generate Payment Schedule
              </Button>
            </div>
          ) : null}
          {generateError ? (
            <p className="px-6 pb-6 text-center text-sm text-destructive" role="alert">
              {generateError}
            </p>
          ) : null}
        </Card>
      ) : null}

      {schedule ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            {schedule.status === 'DRAFT' ? <DraftLabel /> : <StatusBadge status={statusToBadge(schedule.status)} />}
            <span className="text-sm text-muted-foreground">
              {schedule.lineItems.length} member{schedule.lineItems.length === 1 ? '' : 's'} paid
              {schedule.excludedMembers.length > 0 ? ` · ${schedule.excludedMembers.length} not included` : ''}
            </span>
          </div>

          {schedule.rejectionReason ? (
            <p className="rounded-md border border-[var(--rejected-border)] bg-[var(--rejected-bg)] px-3 py-2 text-sm text-[var(--rejected-fg)]">
              Rejected — {schedule.rejectionReason}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi label="Gross" value={schedule.totalGross.toFixed(2)} />
            <Kpi label="Deductions" value={schedule.totalDeductions.toFixed(2)} />
            <Kpi label="Net payable" value={schedule.totalNet.toFixed(2)} tone="success" />
          </div>

          <Section title="Payment lines" description="Rates come from the approved Rate Table; deductions are withholding tax">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Attendance</TableHead>
                  <TableHead className="text-right">Rate applied</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Deductions</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedule.lineItems.map((item) => (
                  <TableRow key={item.memberUserId}>
                    <TableCell className="font-medium">{displayName(item.memberUserId)}</TableCell>
                    <TableCell>{POSITION_LABELS[item.position] ?? item.position}</TableCell>
                    <TableCell className="whitespace-normal text-muted-foreground">{ATTENDANCE_LABELS[item.attendanceStatus] ?? item.attendanceStatus}</TableCell>
                    <TableCell className="text-right font-mono">{item.rateApplied.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono">{item.grossAmount.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">{item.deductionsAmount.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{item.netAmount.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {schedule.lineItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No members qualify for payment.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4}>Totals</TableCell>
                  <TableCell className="text-right font-mono">{schedule.totalGross.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono">{schedule.totalDeductions.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono">{schedule.totalNet.toFixed(2)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </Section>

          {schedule.excludedMembers.length > 0 ? (
            <Section title="Not included in this schedule" description="Absent or apologised members are excluded unless an Authorized Exception is approved">
              <ul className="divide-y">
                {schedule.excludedMembers.map((excluded) => {
                  const exceptionStatus = requestedExceptions[excluded.memberUserId] ?? excluded.exceptionStatus
                  return (
                    <li key={excluded.memberUserId} className="flex flex-wrap items-center gap-3 px-5 py-3">
                      <UserX className="size-4 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="font-medium">{displayName(excluded.memberUserId)}</span>
                        <span className="text-muted-foreground"> · {POSITION_LABELS[excluded.position] ?? excluded.position} · {EXCLUDED_REASON_LABELS[excluded.reason] ?? excluded.reason}</span>
                      </span>
                      {isLegalOfficer && canEdit ? (
                        exceptionStatus ? (
                          <Badge variant="outline">{EXCEPTION_STATUS_LABELS[exceptionStatus] ?? exceptionStatus}</Badge>
                        ) : (
                          <Button variant="secondary" size="sm" onClick={() => openExceptionForm(excluded.memberUserId)}>
                            Request Authorized Exception
                          </Button>
                        )
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </Section>
          ) : null}

          {isLegalOfficer ? (
            canEdit ? (
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="secondary" onClick={handleGenerate} disabled={isGenerating}>
                  <RefreshCw className={isGenerating ? 'animate-spin' : undefined} />
                  {isGenerating ? 'Regenerating…' : 'Save as Draft'}
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  <Send /> Submit for Approval
                </Button>
              </div>
            ) : (
              <p className="text-right text-sm text-muted-foreground">
                {schedule.status === 'PENDING_APPROVAL' ? 'Awaiting Checker decision.' : 'Schedule is Approved.'}
              </p>
            )
          ) : null}
          {generateError ? (
            <p className="text-sm text-destructive" role="alert">
              {generateError}
            </p>
          ) : null}
          {submitError ? (
            <p className="text-sm text-destructive" role="alert">
              {submitError}
            </p>
          ) : null}
        </>
      ) : null}

      <Dialog open={exceptionMemberId !== undefined} onOpenChange={(open) => (open ? undefined : setExceptionMemberId(undefined))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Authorized Exception</DialogTitle>
            <DialogDescription>
              {exceptionMemberId ? `Include ${displayName(exceptionMemberId)} in this schedule despite their attendance status. ` : ''}
              Goes to the Checker for approval.
            </DialogDescription>
          </DialogHeader>
          <TextAreaField
            label="Reason for exception"
            value={exceptionReason}
            onChange={(event) => setExceptionReason(event.target.value)}
            rows={3}
            autoFocus
          />
          {exceptionError ? (
            <p className="text-sm text-destructive" role="alert">
              {exceptionError}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setExceptionMemberId(undefined)}>
              Cancel
            </Button>
            <Button onClick={handleRequestException} disabled={isRequestingException || exceptionReason.trim() === ''}>
              Request exception
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
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
