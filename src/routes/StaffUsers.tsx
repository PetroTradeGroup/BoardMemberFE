import { useEffect, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { Card } from '../components/Card/Card'
import { usePagination } from '../components/Pagination/usePagination'
import { PaginationControls } from '../components/Pagination/PaginationControls'
import { listUsers, type UserSummary } from '../api/usersApi'
import styles from './StaffUsers.module.css'

/** Checker > Users -- read-only (account creation stays Admin-only, `AdminUsers.tsx`'s own
 * screen). A Checker reviewing approval records/attendance entries otherwise has no way to see
 * who a Keycloak user id actually is, beyond the compact list already on the Home dashboard --
 * this is that same data as its own full page, reachable from the sidebar. */
export function StaffUsers() {
  const auth = useAuth()
  const accessToken = auth.user?.access_token

  const [users, setUsers] = useState<UserSummary[]>()
  const [listError, setListError] = useState<string>()

  useEffect(() => {
    if (!accessToken) {
      return
    }
    listUsers(accessToken)
      .then((response) => setUsers(response.items))
      .catch((error: unknown) => setListError(error instanceof Error ? error.message : 'Unable to load the user list right now.'))
  }, [accessToken])

  const pagination = usePagination(users ?? [], 10)

  return (
    <main className={styles.page}>
      <h1 className={styles.pageTitle}>Users</h1>

      <Card className={styles.card}>
        {listError ? (
          <p className={styles.error} role="alert">
            {listError}
          </p>
        ) : null}
        {users && users.length === 0 ? <p className={styles.empty}>No users yet.</p> : null}
        <ul className={styles.list}>
          {pagination.pageItems.map((summary) => (
            <li key={summary.id} className={styles.listItem}>
              <span>
                {summary.firstName} {summary.lastName}
              </span>
              <span className={styles.email}>{summary.email}</span>
            </li>
          ))}
        </ul>
        <PaginationControls {...pagination} />
      </Card>
    </main>
  )
}
