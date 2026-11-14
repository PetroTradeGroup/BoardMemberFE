import { useEffect, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { Link } from 'react-router-dom'
import { Card } from '../components/Card/Card'
import { StatusBadge } from '../components/StatusBadge/StatusBadge'
import { usePagination } from '../components/Pagination/usePagination'
import { PaginationControls } from '../components/Pagination/PaginationControls'
import { listMeetings, type MeetingResponse } from '../api/meetingsApi'
import { CalendarDays, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmptyState, FormMessage, Page, PageHeader } from '../components/Page/Page'

/**
 * Story 5.2 (and the read half of Story 4.4): a Member's own meetings list -- server-side
 * committee-scoped and Approved-only (Story 4.4 AC1), so every row here is one this Member is
 * actually invited to. Row click opens the detail screen (attendance/COI).
 */
export function MemberMeetings() {
  const auth = useAuth()
  const accessToken = auth.user?.access_token

  const [meetings, setMeetings] = useState<MeetingResponse[]>()
  const [loadError, setLoadError] = useState<string>()

  useEffect(() => {
    if (!accessToken) {
      return
    }
    listMeetings(accessToken)
      .then((response) => setMeetings(response.items))
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : 'Unable to load meetings right now.'))
  }, [accessToken])

  const pagination = usePagination(meetings ?? [], 10)

  return (
    <Page>
      <PageHeader title="Meetings" description="Approved meetings of the committees you belong to. Open one to confirm your attendance." />

      {loadError ? <FormMessage error={loadError} /> : null}

      {meetings && meetings.length === 0 ? (
        <Card>
          <EmptyState icon={<CalendarDays />}>
            No meetings yet. Meetings appear here once they're approved and you're a member of that committee — contact an administrator if you expected to see one.
          </EmptyState>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {pagination.pageItems.map((meeting) => {
          const when = new Date(meeting.scheduledAt)
          const upcoming = when.getTime() > Date.now()
          return (
            <Link
              key={meeting.id}
              to={`/member/meetings/${meeting.id}`}
              state={{ meeting }}
              className="group flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/40"
            >
              <span className={cn('flex w-14 shrink-0 flex-col items-center rounded-lg py-1.5', upcoming ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')} aria-hidden>
                <span className="text-[11px] font-semibold uppercase">{when.toLocaleDateString(undefined, { month: 'short' })}</span>
                <span className="font-mono text-xl font-semibold leading-tight">{when.getDate()}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{meeting.title}</span>
                <span className="block truncate text-sm text-muted-foreground">
                  {meeting.committee} &middot; {when.toLocaleString()}
                </span>
              </span>
              <StatusBadge status="approved" />
              <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          )
        })}
      </div>
      <PaginationControls {...pagination} />
    </Page>
  )
}
