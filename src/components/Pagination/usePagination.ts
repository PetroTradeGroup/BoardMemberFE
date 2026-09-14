import { useEffect, useMemo, useState } from 'react'

export interface Pagination<T> {
  pageItems: T[]
  page: number
  pageCount: number
  totalItems: number
  goToPage: (page: number) => void
}

/** Client-side pagination over an already-fully-fetched array. This app's backend list
 * endpoints all already return their complete result set in one response (documented
 * "no pagination yet" in every list service -- current data volumes never approach the point
 * where that's a real cost); this hook just breaks up the RENDERING so a long list doesn't dump
 * everything on screen at once. Resets to page 1 whenever the array identity changes (a fresh
 * fetch or a filter re-query), so switching filters never silently leaves you on a page number
 * left over from a previous, unrelated result set. */
export function usePagination<T>(items: T[], pageSize = 10): Pagination<T> {
  const [page, setPage] = useState(1)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setPage(1), [items])

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(page, pageCount)

  const pageItems = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize],
  )

  return {
    pageItems,
    page: safePage,
    pageCount,
    totalItems: items.length,
    goToPage: (next: number) => setPage(Math.min(Math.max(1, next), pageCount)),
  }
}
