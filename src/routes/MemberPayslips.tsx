import { useEffect, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { Card } from '../components/Card/Card'
import { Button } from '@/components/ui/button'
import { usePagination } from '../components/Pagination/usePagination'
import { PaginationControls } from '../components/Pagination/PaginationControls'
import { downloadPayslipPdf, getPayslip, listPayslips, type PayslipResponse } from '../api/payslipsApi'
import { Download, Eye, Receipt } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { EmptyState, FormMessage, Page, PageHeader } from '../components/Page/Page'

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
  const [openPayslip, setOpenPayslip] = useState<PayslipResponse>()

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
    if (openPayslip?.id === id) {
      setOpenPayslip(undefined)
      return
    }
    setActionError(undefined)
    setBusyId(id)
    try {
      setOpenPayslip(await getPayslip(accessToken, id))
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
    <Page>
      <PageHeader title="Payslips" description="Your sitting-fee payslips, newest first. Only you can see these." />

      {loadError ? <FormMessage error={loadError} /> : null}

      <Card className="overflow-hidden">
        {payslips && payslips.length === 0 ? <EmptyState icon={<Receipt />}>No payslips yet.</EmptyState> : null}

        <ul className="divide-y">
          {pagination.pageItems.map((payslip) => (
            <li key={payslip.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden>
                  <Receipt className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{payslip.meetingTitle}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {payslip.committee} &middot; {POSITION_LABELS[payslip.position] ?? payslip.position} &middot; {new Date(payslip.generatedAt).toLocaleDateString()}
                  </p>
                </div>
                {payslip.viewed ? (
                  <Badge variant="secondary" className="gap-1 text-muted-foreground">
                    <Eye className="size-3" aria-hidden />
                    Viewed
                  </Badge>
                ) : null}
                <span className="font-mono text-lg font-semibold">{payslip.netAmount.toFixed(2)}</span>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => handleView(payslip.id)}
                    disabled={busyId === payslip.id}
                    aria-expanded={openPayslip?.id === payslip.id}
                  >
                    {openPayslip?.id === payslip.id ? 'Hide' : 'View'}
                  </Button>
                  <Button onClick={() => handleDownload(payslip.id)} disabled={busyId === payslip.id}>
                    <Download /> Download
                  </Button>
                </div>
              </div>
              {openPayslip?.id === payslip.id ? (
                <dl className="mt-4 grid max-w-md grid-cols-2 gap-x-6 gap-y-1.5 rounded-lg border bg-muted/40 p-4 text-sm sm:ml-14">
                  <dt className="text-muted-foreground">Position</dt>
                  <dd className="text-right">{POSITION_LABELS[openPayslip.position] ?? openPayslip.position}</dd>
                  <dt className="text-muted-foreground">Gross</dt>
                  <dd className="text-right font-mono">{openPayslip.grossAmount.toFixed(2)}</dd>
                  <dt className="text-muted-foreground">Deductions</dt>
                  <dd className="text-right font-mono">{openPayslip.deductionsAmount.toFixed(2)}</dd>
                  <dt className="border-t pt-1.5 font-medium">Net</dt>
                  <dd className="border-t pt-1.5 text-right font-mono font-semibold">{openPayslip.netAmount.toFixed(2)}</dd>
                </dl>
              ) : null}
              {actionError?.id === payslip.id ? (
                <p className="mt-2 text-sm text-destructive" role="alert">
                  {actionError.message}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
        <PaginationControls {...pagination} />
      </Card>
    </Page>
  )
}

const POSITION_LABELS: Record<string, string> = {
  CHAIRPERSON: 'Chairperson',
  VICE_CHAIRPERSON: 'Vice-Chairperson',
  MEMBER: 'Member',
}
