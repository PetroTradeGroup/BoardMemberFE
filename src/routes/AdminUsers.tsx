import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from 'react-oidc-context'
import { Card } from '../components/Card/Card'
import { Button } from '../components/Button/Button'
import { FormField } from '../components/FormField/FormField'
import { SelectField } from '../components/FormField/SelectField'
import { usePagination } from '../components/Pagination/usePagination'
import { PaginationControls } from '../components/Pagination/PaginationControls'
import { ApiError, createUser, listUsers, type UserRole, type UserSummary } from '../api/usersApi'
import styles from './AdminUsers.module.css'

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'BOARD_MEMBER', label: 'Board Member' },
  { value: 'COMMITTEE_MEMBER', label: 'Committee Member' },
  { value: 'LEGAL_OFFICER', label: 'Legal Officer' },
  { value: 'CHECKER', label: 'Checker' },
  { value: 'ADMIN', label: 'System Administrator' },
]

/** Story 2.2: Admin > Users — create an account (Story 2.1's endpoint) and see it in the list. */
export function AdminUsers() {
  const auth = useAuth()
  const accessToken = auth.user?.access_token

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('BOARD_MEMBER')

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const [successMessage, setSuccessMessage] = useState<string>()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [users, setUsers] = useState<UserSummary[]>()
  const [listError, setListError] = useState<string>()

  useEffect(() => {
    if (!accessToken) {
      return
    }
    void refreshList(accessToken)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken])

  async function refreshList(token: string) {
    try {
      const response = await listUsers(token)
      setUsers(response.items)
      setListError(undefined)
    }
    catch (error: unknown) {
      setListError(error instanceof Error ? error.message : 'Unable to load the user list right now.')
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting || !accessToken) {
      return
    }

    setFieldErrors({})
    setFormError(undefined)
    setSuccessMessage(undefined)
    setIsSubmitting(true)

    try {
      await createUser(accessToken, { firstName, lastName, email, role })
      setSuccessMessage(`${firstName} ${lastName} was created and can now sign in.`)
      setFirstName('')
      setLastName('')
      setEmail('')
      setRole('BOARD_MEMBER')
      await refreshList(accessToken)
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
        setFormError(error instanceof Error ? error.message : 'Unable to create this account right now.')
      }
    }
    finally {
      setIsSubmitting(false)
    }
  }

  const userPagination = usePagination(users ?? [], 10)

  return (
    <main className={styles.page}>
      <Card className={styles.card}>
        <h1 className={styles.heading}>Create user account</h1>
        <form className={styles.form} onSubmit={handleSubmit}>
          <FormField
            label="First name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            error={fieldErrors.firstName}
            required
          />
          <FormField
            label="Last name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            error={fieldErrors.lastName}
            required
          />
          <FormField
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={fieldErrors.email}
            required
          />
          <SelectField
            label="Role"
            value={role}
            onChange={(event) => setRole(event.target.value as UserRole)}
            options={ROLE_OPTIONS}
          />
          <Button type="submit" disabled={isSubmitting}>
            Create account
          </Button>
          {formError ? (
            <p className={styles.error} role="alert">
              {formError}
            </p>
          ) : null}
          {successMessage ? <p className={styles.success}>{successMessage}</p> : null}
        </form>
      </Card>

      <Card className={styles.card}>
        <h1 className={styles.heading}>Users</h1>
        {listError ? (
          <p className={styles.error} role="alert">
            {listError}
          </p>
        ) : null}
        <ul className={styles.list}>
          {userPagination.pageItems.map((summary) => (
            <li key={summary.id} className={styles.listItem}>
              <span>
                {summary.firstName} {summary.lastName}
              </span>
              <span>{summary.email}</span>
            </li>
          ))}
        </ul>
        <PaginationControls {...userPagination} />
      </Card>
    </main>
  )
}
