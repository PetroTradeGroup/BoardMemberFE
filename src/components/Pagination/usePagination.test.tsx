import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { usePagination } from './usePagination'

describe('usePagination', () => {
  it('slices items into pages of the given size', () => {
    const items = Array.from({ length: 25 }, (_, i) => i)
    const { result } = renderHook(() => usePagination(items, 10))

    expect(result.current.pageItems).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(result.current.page).toBe(1)
    expect(result.current.pageCount).toBe(3)
    expect(result.current.totalItems).toBe(25)
  })

  it('navigates forward and backward', () => {
    const items = Array.from({ length: 25 }, (_, i) => i)
    const { result } = renderHook(() => usePagination(items, 10))

    act(() => result.current.goToPage(2))
    expect(result.current.page).toBe(2)
    expect(result.current.pageItems).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19])

    act(() => result.current.goToPage(3))
    expect(result.current.pageItems).toEqual([20, 21, 22, 23, 24])
  })

  it('clamps below page 1 and above the last page', () => {
    const items = Array.from({ length: 5 }, (_, i) => i)
    const { result } = renderHook(() => usePagination(items, 10))

    act(() => result.current.goToPage(0))
    expect(result.current.page).toBe(1)

    act(() => result.current.goToPage(99))
    expect(result.current.page).toBe(1) // only one page exists for 5 items at pageSize 10
  })

  it('resets to page 1 when the underlying array is replaced (e.g. a re-fetch)', () => {
    let items = Array.from({ length: 25 }, (_, i) => i)
    const { result, rerender } = renderHook(() => usePagination(items, 10))

    act(() => result.current.goToPage(3))
    expect(result.current.page).toBe(3)

    items = Array.from({ length: 5 }, (_, i) => i + 100)
    rerender()

    expect(result.current.page).toBe(1)
    expect(result.current.pageItems).toEqual([100, 101, 102, 103, 104])
  })

  it('reports a single page and never errors on an empty list', () => {
    const { result } = renderHook(() => usePagination([] as number[], 10))

    expect(result.current.pageCount).toBe(1)
    expect(result.current.page).toBe(1)
    expect(result.current.pageItems).toEqual([])
  })
})
