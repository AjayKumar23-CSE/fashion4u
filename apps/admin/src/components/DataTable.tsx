import { flexRender, useTable } from '@tanstack/react-table'
import type { RowData } from '@tanstack/react-table'
import { tableConfig, type Columns } from '../lib/table'
import { EmptyState } from './ui'

interface DataTableProps<TData extends RowData> {
  data: TData[]
  columns: Columns<TData>
  getRowId: (row: TData) => string
  onRowClick?: (row: TData) => void
  empty?: React.ReactNode
  /** Rows scroll under the heading row, which stays pinned. */
  stickyHeader?: boolean
}

/**
 * One table for the whole admin. A screen supplies its columns and what a row
 * click means; layout, empty state and sticky headings are handled here.
 */
export function DataTable<TData extends RowData>({
  data,
  columns,
  getRowId,
  onRowClick,
  empty = 'Nothing to show.',
  stickyHeader = true,
}: DataTableProps<TData>) {
  const table = useTable({
    features: tableConfig,
    data,
    columns,
    getRowId: (row) => getRowId(row),
  })

  if (data.length === 0) return <EmptyState>{empty}</EmptyState>

  return (
    <table className="w-full border-collapse rounded-lg border border-neutral-200 bg-white text-sm">
      <thead
        className={`text-left text-xs uppercase tracking-wider text-neutral-500 ${
          stickyHeader ? '[&_th]:sticky [&_th]:top-0 [&_th]:z-10' : ''
        } [&_th]:bg-neutral-100`}
      >
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th
                key={header.id}
                className={`px-3 py-2 font-semibold ${
                  header.column.columnDef.meta?.align === 'right' ? 'text-right' : ''
                }`}
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>

      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr
            key={row.id}
            onClick={onRowClick ? () => onRowClick(row.original) : undefined}
            className={`border-t border-neutral-200 ${
              onRowClick ? 'cursor-pointer hover:bg-neutral-50' : ''
            }`}
          >
            {row.getAllCells().map((cell) => (
              <td
                key={cell.id}
                className={`px-3 py-2 ${
                  cell.column.columnDef.meta?.align === 'right' ? 'text-right tabular-nums' : ''
                }`}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
