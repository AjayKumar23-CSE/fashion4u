import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import { DataTable } from '../components/DataTable'
import { Pagination } from '../components/Pagination'
import { Badge, PageHeader, Select, TextInput, Thumbnail, primaryButton } from '../components/ui'
import { api } from '../lib/api'
import { imageSrc } from '../lib/images'
import { discountPercent, formatPrice } from '../lib/money'
import { usePrefs } from '../lib/prefs'
import { columnsFor, type Columns } from '../lib/table'
import type { Category, ProductList, ProductListItem } from '../lib/types'

const column = columnsFor<ProductListItem>()

export function ProductsPage() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = usePrefs((state) => state.pageSize)
  const setPageSize = usePrefs((state) => state.setPageSize)

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api<Category[]>('/admin/categories'),
  })

  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (q.trim()) params.set('q', q.trim())
  if (categoryId) params.set('categoryId', categoryId)
  if (status) params.set('status', status)

  const { data, isLoading } = useQuery({
    queryKey: ['products', params.toString()],
    queryFn: () => api<ProductList>(`/admin/products?${params}`),
    // The previous page stays on screen while the next loads, so the table
    // does not collapse and jump on every click.
    placeholderData: keepPreviousData,
  })

  const columns = useMemo<Columns<ProductListItem>>(
    () => [
      column.accessor('name', {
        header: 'Product',
        cell: (info) => (
          <div className="flex items-center gap-3">
            <Thumbnail src={info.row.original.image ? imageSrc(info.row.original.image) : null} />
            <span className="font-medium">{info.getValue()}</span>
          </div>
        ),
      }),
      column.accessor('category', {
        header: 'Category',
        cell: (info) => <span className="text-neutral-600">{info.getValue()}</span>,
      }),
      column.accessor('salePrice', {
        header: 'Price',
        meta: { align: 'right' },
        cell: (info) => {
          const { mrp, salePrice } = info.row.original
          return (
            <>
              {formatPrice(salePrice)} <s className="text-xs text-neutral-400">{formatPrice(mrp)}</s>{' '}
              <span className="text-xs text-red-700">{discountPercent(mrp, salePrice)}%</span>
            </>
          )
        },
      }),
      column.accessor('stock', {
        header: 'Stock',
        meta: { align: 'right' },
        cell: (info) =>
          info.getValue() <= 0 ? (
            <span className="font-semibold text-red-700">Sold out</span>
          ) : (
            info.getValue()
          ),
      }),
      column.accessor('status', {
        header: 'Status',
        cell: (info) => (
          <Badge tone={info.getValue() === 'ACTIVE' ? 'positive' : 'neutral'}>
            {info.getValue() === 'ACTIVE' ? 'Active' : 'Draft'}
          </Badge>
        ),
      }),
    ],
    [],
  )

  // Anything that changes what is being listed starts again from page one.
  const filter = (apply: () => void) => {
    apply()
    setPage(1)
  }

  const changePageSize = (size: number) => {
    setPageSize(size)
    setPage(1)
  }

  const emptyBecausePaged = data && data.items.length === 0 && data.total > 0

  return (
    <>
      <PageHeader
        title="Products"
        actions={
          <Link to="/products/new" className={primaryButton}>
            New product
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <TextInput
          type="search"
          placeholder="Search name, slug or SKU"
          value={q}
          onChange={(e) => filter(() => setQ(e.target.value))}
          className="max-w-xs"
        />
        <Select
          value={categoryId}
          onChange={(e) => filter(() => setCategoryId(e.target.value))}
          className="max-w-52"
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.parentId ? '— ' : ''}
              {category.name}
            </option>
          ))}
        </Select>
        <Select
          value={status}
          onChange={(e) => filter(() => setStatus(e.target.value))}
          className="max-w-36"
        >
          <option value="">Any status</option>
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Draft</option>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : (
        <DataTable
          data={data?.items ?? []}
          columns={columns}
          getRowId={(row) => row.id}
          onRowClick={(row) => navigate(`/products/${row.id}`)}
          empty={
            emptyBecausePaged
              ? 'This page is empty — the list got shorter while you were on it.'
              : 'No products match.'
          }
        />
      )}

      {data && (
        <Pagination
          page={data.page}
          pageSize={pageSize}
          total={data.total}
          onPageChange={setPage}
          onPageSizeChange={changePageSize}
        />
      )}
    </>
  )
}
