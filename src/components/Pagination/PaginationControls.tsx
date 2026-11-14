import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Pagination } from './usePagination'

/** Renders nothing when everything fits on one page -- a lone "Page 1 of 1" bar under a
 * 3-item list is noise, not a control. */
export function PaginationControls({ page, pageCount, totalItems, goToPage }: Pagination<unknown>) {
  if (pageCount <= 1) {
    return null
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <Button variant="outline" size="sm" onClick={() => goToPage(page - 1)} disabled={page <= 1}>
        <ChevronLeft /> Previous
      </Button>
      <span className="font-mono text-xs text-muted-foreground">
        Page {page} of {pageCount} · {totalItems} total
      </span>
      <Button variant="outline" size="sm" onClick={() => goToPage(page + 1)} disabled={page >= pageCount}>
        Next <ChevronRight />
      </Button>
    </div>
  )
}
