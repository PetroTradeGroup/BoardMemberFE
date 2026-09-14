import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from 'react-oidc-context'
import { Card } from '../components/Card/Card'
import { Button } from '../components/Button/Button'
import { FormField } from '../components/FormField/FormField'
import { SelectField, type SelectFieldOption } from '../components/FormField/SelectField'
import { usePagination } from '../components/Pagination/usePagination'
import { PaginationControls } from '../components/Pagination/PaginationControls'
import { listCommittees, type CommitteeSummary } from '../api/committeesApi'
import { ApiError, listCurrentRates, proposeRateChange, type Position, type RateTableEntryView } from '../api/paymentsApi'
import styles from './AdminRateTable.module.css'

const POSITION_OPTIONS: SelectFieldOption[] = [
  { value: 'CHAIRPERSON', label: 'Chairperson' },
  { value: 'VICE_CHAIRPERSON', label: 'Vice-Chairperson' },
  { value: 'MEMBER', label: 'Member' },
]

const POSITION_LABELS: Record<Position, string> = {
  CHAIRPERSON: 'Chairperson',
  VICE_CHAIRPERSON: 'Vice-Chairperson',
  MEMBER: 'Member',
}

/**
 * Story 6.1/6.2: Admin > Rate Table — propose a rate by Position x Committee (Story 6.1's
 * endpoint). Like Committee Membership, the change is Pending, not applied, until a Checker
 * decides it via the same unified Pending Approvals queue — this screen has no approve/reject
 * action of its own.
 */
export function AdminRateTable() {
  const auth = useAuth()
  const accessToken = auth.user?.access_token

  const [committees, setCommittees] = useState<CommitteeSummary[]>()
  const [rates, setRates] = useState<RateTableEntryView[]>()
  const [loadError, setLoadError] = useState<string>()

  const [committeeId, setCommitteeId] = useState('')
  const [position, setPosition] = useState<Position>('CHAIRPERSON')
  const [rate, setRate] = useState('')

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const [successMessage, setSuccessMessage] = useState<string>()
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!accessToken) {
      return
    }
    refresh(accessToken)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken])

  function refresh(token: string) {
    Promise.all([listCommittees(token), listCurrentRates(token)])
      .then(([committeeList, rateList]) => {
        setCommittees(committeeList.items)
        setRates(rateList.items)
        if (committeeList.items.length > 0) {
          setCommitteeId((existing) => existing || committeeList.items[0].id)
        }
      })
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : 'Unable to load committees or rates right now.'))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting || !accessToken || !committeeId) {
      return
    }

    setFieldErrors({})
    setFormError(undefined)
    setSuccessMessage(undefined)
    setIsSubmitting(true)

    try {
      await proposeRateChange(accessToken, { committeeId, position, rate: Number(rate) })
      setSuccessMessage('Proposed rate submitted — it now appears in the Checker’s Pending Approvals queue.')
      setRate('')
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
        setFormError(error instanceof Error ? error.message : 'Unable to propose this rate right now.')
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
  const ratePagination = usePagination(rates ?? [], 10)

  return (
    <main className={styles.page}>
      <Card className={styles.card}>
        <h1 className={styles.heading}>Rate Table</h1>
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
            label="Position"
            value={position}
            onChange={(event) => setPosition(event.target.value as Position)}
            options={POSITION_OPTIONS}
            error={fieldErrors.position}
          />
          <FormField
            label="Rate"
            type="number"
            step="0.01"
            min="0.01"
            value={rate}
            onChange={(event) => setRate(event.target.value)}
            error={fieldErrors.rate}
            required
          />
          <Button type="submit" disabled={isSubmitting || !committeeId || !rate}>
            Propose rate
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
        <h1 className={styles.heading}>Current Rates</h1>
        <ul className={styles.list}>
          {ratePagination.pageItems.map((entry) => (
            <li key={entry.id} className={styles.listItem}>
              <span>
                {POSITION_LABELS[entry.position]} &middot; {entry.committeeName}
              </span>
              <span className={styles.rateValue}>{entry.rate.toFixed(2)}</span>
            </li>
          ))}
        </ul>
        <PaginationControls {...ratePagination} />
      </Card>
    </main>
  )
}
