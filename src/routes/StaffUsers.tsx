import { useEffect, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { usePagination } from '../components/Pagination/usePagination'
import { PaginationControls } from '../components/Pagination/PaginationControls'
import { listUsers, type UserSummary } from '../api/usersApi'
import { Users } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState, FormMessage, Page, PageHeader, PersonCell, Section } from '../components/Page/Page'

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
    <Page>
      <PageHeader title="Users" description="Everyone with an account, for reference when reviewing approvals." />
      <Section title="All users" actions={<span className="font-mono text-xs text-muted-foreground">{users?.length ?? 0}</span>}>
        {listError ? <div className="p-5"><FormMessage error={listError} /></div> : null}
        {users && users.length === 0 ? <EmptyState icon={<Users />}>No users yet.</EmptyState> : null}
        {users && users.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagination.pageItems.map((summary) => (
                <TableRow key={summary.id}>
                  <TableCell><PersonCell firstName={summary.firstName} lastName={summary.lastName} /></TableCell>
                  <TableCell className="text-muted-foreground">{summary.email}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
        <PaginationControls {...pagination} />
      </Section>
    </Page>
  )
}
