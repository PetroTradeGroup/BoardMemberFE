import { useEffect, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { Card } from '../components/Card/Card'
import { Button } from '../components/Button/Button'
import { usePagination } from '../components/Pagination/usePagination'
import { PaginationControls } from '../components/Pagination/PaginationControls'
import { downloadPayslipPdf, getPayslip, listPayslips, type PayslipResponse } from '../api/payslipsApi'
import styles from './MemberPayslips.module.css'

/**
 * Story 7.2: a Member's own payslips, including historical ones -- server-side ownership
 * enforced. A payslip is not a Maker-Checker record, so it gets no status badge (per
 * StatusBadge's own reservation rule) -- just a plain "Viewed" text mark once opened (FR7/UX-DR9).
 */
export function MemberPayslips() {
  const auth = useAuth()
  const accessToken = auth.user?.access_token

  const [payslips, setPayslips] = useState<PayslipResponse[]>()
  const [loadError, setLoadError] = useState<string>()
  const [actionError, setActionError] = useState<{ id: string; message: string }>()
  const [busyId, setBusyId] = useState<string>()

  useEffect(() => {
    if (!accessToken) {
      return
    }
    listPayslips(accessToken)
      .then((response) => setPayslips(response.items))
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : 'Unable to load payslips right now.'))
  }, [accessToken])

  function markViewed(id: string) {
    setPayslips((existing) => existing?.map((payslip) => (payslip.id === id ? { ...payslip, viewed: true } : payslip)))
  }

  async function handleView(id: string) {
    if (!accessToken || busyId) {
      return
    }
    setActionError(undefined)
    setBusyId(id)
    try {
      await getPayslip(accessToken, id)
      markViewed(id)
    }
    catch (error: unknown) {
      setActionError({ id, message: error instanceof Error ? error.message : 'Unable to open this payslip right now.' })
    }
    finally {
      setBusyId(undefined)
    }
  }

  async function handleDownload(id: string) {
    if (!accessToken || busyId) {
      return
    }
    setActionError(undefined)
    setBusyId(id)
    try {
      await downloadPayslipPdf(accessToken, id)
      markViewed(id)
    }
    catch (error: unknown) {
      setActionError({ id, message: error instanceof Error ? error.message : 'Unable to download this payslip right now.' })
    }
    finally {
      setBusyId(undefined)
    }
  }

  const pagination = usePagination(payslips ?? [], 10)

  return (
    <main className={styles.page}>
      <h1 className={styles.pageTitle}>Payslips</h1>

      {loadError ? (
        <p className={styles.error} role="alert">
          {loadError}
        </p>
      ) : null}

      <Card className={styles.card}>
        {payslips && payslips.length === 0 ? <p className={styles.emptyState}>No payslips yet.</p> : null}

        {pagination.pageItems.map((payslip, index) => (
          <div key={payslip.id} className={`${styles.row} ${index === pagination.pageItems.length - 1 ? styles.rowLast : ''}`}>
            <div className={styles.rowTitleBlock}>
              <span className={styles.rowTitle}>{payslip.meetingTitle}</span>
              <span className={styles.rowMeta}>
                {payslip.committee} &middot; {payslip.position} &middot; {new Date(payslip.generatedAt).toLocaleDateString()}
              </span>
              {payslip.viewed ? <span className={styles.viewedMark}>Viewed</span> : null}
            </div>
            <span className={styles.netAmount}>{payslip.netAmount.toFixed(2)}</span>
            <div className={styles.actions}>
              <Button variant="secondary" onClick={() => handleView(payslip.id)} disabled={busyId === payslip.id}>
                View
              </Button>
              <Button onClick={() => handleDownload(payslip.id)} disabled={busyId === payslip.id}>
                Download
              </Button>
            </div>
            {actionError?.id === payslip.id ? (
              <p className={styles.error} role="alert">
                {actionError.message}
              </p>
            ) : null}
          </div>
        ))}
        <PaginationControls {...pagination} />
      </Card>
    </main>
  )
}
