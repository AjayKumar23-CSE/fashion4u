import { PAGE_SIZES, pageCountFor, pageList } from '../lib/pagination'
import { secondaryButton } from './ui'

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const pageCount = pageCountFor(total, pageSize)
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <footer className="mt-4 flex flex-wrap items-center justify-between gap-4 text-sm text-neutral-600">
      <p>
        {total === 0 ? (
          'No results'
        ) : (
          <>
            Showing{' '}
            <span className="font-medium text-neutral-900">
              {first}–{last}
            </span>{' '}
            of <span className="font-medium text-neutral-900">{total}</span>
          </>
        )}
      </p>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2">
          <span className="text-xs">Per page</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-9 rounded-md border border-neutral-300 bg-white px-2 text-sm outline-none focus:border-neutral-900"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        {pageCount > 1 && (
          <nav className="flex items-center gap-1" aria-label="Pages">
            <button
              type="button"
              className={secondaryButton}
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </button>

            {pageList(page, pageCount).map((item, index) =>
              item === 'gap' ? (
                <span key={`gap-${index}`} className="px-1 text-neutral-400">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  aria-current={item === page ? 'page' : undefined}
                  onClick={() => onPageChange(item)}
                  className={`h-9 min-w-9 rounded-md px-2 text-sm ${
                    item === page
                      ? 'bg-neutral-900 font-semibold text-white'
                      : 'border border-neutral-300 bg-white hover:bg-neutral-100'
                  }`}
                >
                  {item}
                </button>
              ),
            )}

            <button
              type="button"
              className={secondaryButton}
              disabled={page >= pageCount}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </button>
          </nav>
        )}
      </div>
    </footer>
  )
}
