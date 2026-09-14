import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from 'react-oidc-context'
import { Card } from '../components/Card/Card'
import { Button } from '../components/Button/Button'
import { SelectField, type SelectFieldOption } from '../components/FormField/SelectField'
import { ApiError, listCommittees, proposeMembershipChange, type CommitteeSummary, type MembershipAction } from '../api/committeesApi'
import { listUsers, type UserSummary } from '../api/usersApi'
import styles from './AdminCommitteeMembership.module.css'

const ACTION_OPTIONS: SelectFieldOption[] = [
  { value: 'ASSIGN', label: 'Assign to committee' },
  { value: 'REMOVE', label: 'Remove from committee' },
]

/**
 * Story 4.3: Admin > Committee Membership — propose an assign/remove change (Story 4.1's
 * endpoint). The change is Pending, not applied, until a Checker decides it via the same unified
 * Pending Approvals queue as Meetings (Story 4.2) — this screen has no approve/reject action of
 * its own.
 */
export function AdminCommitteeMembership() {
  const auth = useAuth()
  const accessToken = auth.user?.access_token

  const [committees, setCommittees] = useState<CommitteeSummary[]>()
  const [users, setUsers] = useState<UserSummary[]>()
  const [loadError, setLoadError] = useState<string>()

  const [committeeId, setCommitteeId] = useState('')
  const [memberUserId, setMemberUserId] = useState('')
  const [action, setAction] = useState<MembershipAction>('ASSIGN')

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const [successMessage, setSuccessMessage] = useState<string>()
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!accessToken) {
      return
    }
    Promise.all([listCommittees(accessToken), listUsers(accessToken)])
      .then(([committeeList, userList]) => {
        setCommittees(committeeList.items)
        setUsers(userList.items)
        if (committeeList.items.length > 0) {
          setCommitteeId(committeeList.items[0].id)
        }
        if (userList.items.length > 0) {
          setMemberUserId(userList.items[0].id)
        }
      })
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : 'Unable to load committees or users right now.'))
  }, [accessToken])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting || !accessToken || !committeeId || !memberUserId) {
      return
    }

    setFieldErrors({})
    setFormError(undefined)
    setSuccessMessage(undefined)
    setIsSubmitting(true)

    try {
      await proposeMembershipChange(accessToken, { committeeId, memberUserId, action })
      setSuccessMessage('Proposed change submitted — it now appears in the Checker’s Pending Approvals queue.')
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
        setFormError(error instanceof Error ? error.message : 'Unable to propose this change right now.')
      }
    }
    finally {
      setIsSubmitting(false)
    }
  }

  const committeeOptions: SelectFieldOption[] = (committees ?? []).map((committee) => ({
    value: committee.id,
    label: committee.name,
  }))
  const memberOptions: SelectFieldOption[] = (users ?? []).map((user) => ({
    value: user.id,
    label: `${user.firstName} ${user.lastName} (${user.email})`,
  }))

  return (
    <main className={styles.page}>
      <Card className={styles.card}>
        <h1 className={styles.heading}>Committee Membership</h1>
        {loadError ? (
          <p className={styles.error} role="alert">
            {loadError}
          </p>
        ) : null}
        <form className={styles.form} onSubmit={handleSubmit}>
          <SelectField
            label="Committee"
            value={committeeId}
            onChange={(event) => setCommitteeId(event.target.value)}
            options={committeeOptions}
            error={fieldErrors.committeeId}
          />
          <SelectField
            label="Member"
            value={memberUserId}
            onChange={(event) => setMemberUserId(event.target.value)}
            options={memberOptions}
            error={fieldErrors.memberUserId}
          />
          <SelectField
            label="Action"
            value={action}
            onChange={(event) => setAction(event.target.value as MembershipAction)}
            options={ACTION_OPTIONS}
          />
          <Button type="submit" disabled={isSubmitting || !committeeId || !memberUserId}>
            Propose change
          </Button>
          {formError ? (
            <p className={styles.error} role="alert">
              {formError}
            </p>
          ) : null}
          {successMessage ? <p className={styles.success}>{successMessage}</p> : null}
        </form>
      </Card>
    </main>
  )
}
