import type { Pagination } from './usePagination'
import styles from './PaginationControls.module.css'

/** Renders nothing when everything fits on one page -- a lone "Page 1 of 1" bar under a
 * 3-item list is noise, not a control. */
export function PaginationControls({ page, pageCount, totalItems, goToPage }: Pagination<unknown>) {
  if (pageCount <= 1) {
    return null
  }

  return (
    <div className={styles.controls}>
      <button type="button" className={styles.button} onClick={() => goToPage(page - 1)} disabled={page <= 1}>
        Previous
      </button>
      <span className={styles.status}>
        Page {page} of {pageCount} · {totalItems} total
      </span>
      <button type="button" className={styles.button} onClick={() => goToPage(page + 1)} disabled={page >= pageCount}>
        Next
      </button>
    </div>
  )
}
