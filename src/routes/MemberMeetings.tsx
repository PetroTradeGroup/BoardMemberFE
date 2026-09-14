import { useEffect, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { Link } from 'react-router-dom'
import { Card } from '../components/Card/Card'
import { StatusBadge } from '../components/StatusBadge/StatusBadge'
import { usePagination } from '../components/Pagination/usePagination'
import { PaginationControls } from '../components/Pagination/PaginationControls'
import { listMeetings, type MeetingResponse } from '../api/meetingsApi'
import styles from './MemberMeetings.module.css'

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
    <main className={styles.page}>
      <h1 className={styles.pageTitle}>Meetings</h1>

      {loadError ? (
        <p className={styles.error} role="alert">
          {loadError}
        </p>
      ) : null}

      <Card className={styles.card}>
        {meetings && meetings.length === 0 ? <p className={styles.emptyState}>No meetings yet.</p> : null}

        {pagination.pageItems.map((meeting) => (
          <Link key={meeting.id} to={`/member/meetings/${meeting.id}`} state={{ meeting }} className={styles.row}>
            <span className={styles.rowTitleBlock}>
              <span className={styles.rowTitle}>{meeting.title}</span>
              <span className={styles.rowMeta}>
                {meeting.committee} &middot; {new Date(meeting.scheduledAt).toLocaleString()}
              </span>
            </span>
            <StatusBadge status="approved" />
          </Link>
        ))}
        <PaginationControls {...pagination} />
      </Card>
    </main>
  )
}
