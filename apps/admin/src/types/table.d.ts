import '@tanstack/react-table'

// Column-level layout hints, so a page can say "this column is numeric"
// without the table needing to know about any particular screen.
declare module '@tanstack/react-table' {
  interface ColumnMeta {
    align?: 'left' | 'right'
  }
}
