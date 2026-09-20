export const PAGE_SIZES = [10, 25, 50, 100]
export const DEFAULT_PAGE_SIZE = 10

export const pageCountFor = (total: number, pageSize: number) =>
  Math.max(1, Math.ceil(total / pageSize))

/**
 * Page numbers with gaps, so a long list stays on one line: always the first
 * and last page, plus a window of two either side of the current one.
 *   page 1 of 20  ->  1 2 3 … 20
 *   page 9 of 20  ->  1 … 7 8 9 10 11 … 20
 *   page 20 of 20 ->  1 … 18 19 20
 */
export function pageList(current: number, count: number): (number | 'gap')[] {
  if (count <= 7) return Array.from({ length: count }, (_, index) => index + 1)

  const window = [current - 2, current - 1, current, current + 1, current + 2]
  const wanted = [1, ...window, count]
    .filter((page) => page >= 1 && page <= count)
    .sort((a, b) => a - b)

  const items: (number | 'gap')[] = []
  let previous = 0
  for (const page of wanted) {
    if (page === previous) continue
    if (previous && page - previous > 1) items.push('gap')
    items.push(page)
    previous = page
  }
  return items
}
