import { createColumnHelper, tableFeatures } from '@tanstack/react-table'
import type { ColumnDef, RowData } from '@tanstack/react-table'

// Core features only: rows are paged and ordered by the API, so no
// client-side row models are pulled into the bundle.
export const tableConfig = tableFeatures({})

/**
 * A list of columns for one row type. Each column narrows the cell value it
 * reads, so the value type has to stay open here for them to sit in one
 * array — the escape hatch TanStack documents for exactly this.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Columns<TData extends RowData> = ColumnDef<typeof tableConfig, TData, any>[]

/**
 * Column definitions for a screen, bound to the same feature set the table
 * uses. Pages call this instead of reaching for TanStack directly.
 */
export const columnsFor = <TData extends RowData>() =>
  createColumnHelper<typeof tableConfig, TData>()
