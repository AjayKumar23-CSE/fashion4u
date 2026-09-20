import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DataTable } from '../components/DataTable'
import { ImageUploader } from '../components/ImageUploader'
import {
  Badge,
  Button,
  Checkbox,
  ErrorBanner,
  Field,
  Form,
  PageHeader,
  Select,
  TextInput,
  Thumbnail,
} from '../components/ui'
import { api } from '../lib/api'
import { imageSrc } from '../lib/images'
import { categorySchema, type CategoryInput, type CategoryPayload } from '../lib/schemas'
import { columnsFor, type Columns } from '../lib/table'
import { useZodForm } from '../lib/useZodForm'
import type { Category } from '../lib/types'

const column = columnsFor<Category>()

const BLANK: CategoryInput = {
  name: '',
  slug: '',
  parentId: '',
  blurb: '',
  image: null,
  sizeChart: null,
  sortOrder: '0',
  isActive: true,
  showOnHome: false,
}

const toForm = (category: Category): CategoryInput => ({
  name: category.name,
  slug: category.slug,
  parentId: category.parentId ?? '',
  blurb: category.blurb ?? '',
  image: category.image,
  sizeChart: category.sizeChart,
  sortOrder: String(category.sortOrder),
  isActive: category.isActive,
  showOnHome: category.showOnHome,
})

export function CategoriesPage() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Category | 'new' | null>(null)

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api<Category[]>('/admin/categories'),
  })

  const roots = categories.filter((category) => !category.parentId)

  const columns = useMemo<Columns<Category>>(
    () => [
      column.accessor('name', {
        header: 'Category',
        cell: (info) => {
          const category = info.row.original
          return (
            <div className={`flex items-center gap-3 ${category.parentId ? 'pl-6' : 'font-semibold'}`}>
              <Thumbnail src={category.image ? imageSrc(category.image) : null} />
              <span>
                {info.getValue()}
                {category.blurb && (
                  <span className="block text-xs font-normal text-neutral-500">{category.blurb}</span>
                )}
              </span>
            </div>
          )
        },
      }),
      column.accessor('slug', {
        header: 'URL',
        cell: (info) => {
          const category = info.row.original
          const parent = roots.find((root) => root.id === category.parentId)
          return (
            <span className="font-mono text-xs text-neutral-500">
              /{parent ? `${parent.slug}/` : ''}
              {info.getValue()}/
            </span>
          )
        },
      }),
      column.display({
        id: 'products',
        header: 'Items',
        meta: { align: 'right' },
        cell: (info) => info.row.original._count.products,
      }),
      column.accessor('showOnHome', {
        header: 'Home tile',
        cell: (info) => (info.getValue() ? 'Yes' : '—'),
      }),
      column.accessor('isActive', {
        header: 'Status',
        cell: (info) => (
          <Badge tone={info.getValue() ? 'positive' : 'neutral'}>
            {info.getValue() ? 'Visible' : 'Hidden'}
          </Badge>
        ),
      }),
    ],
    // `roots` changes with the data, and the URL column reads it.
    [roots],
  )

  return (
    <div className="flex gap-8">
      <section className="min-w-0 flex-1">
        <PageHeader
          title="Categories"
          actions={
            <Button variant="primary" onClick={() => setEditing('new')}>
              New category
            </Button>
          }
        />

        {isLoading ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : (
          <DataTable
            data={categories}
            columns={columns}
            getRowId={(row) => row.id}
            onRowClick={setEditing}
            empty="No categories yet."
          />
        )}
      </section>

      {editing && (
        <CategoryForm
          key={editing === 'new' ? 'new' : editing.id}
          category={editing === 'new' ? null : editing}
          roots={roots}
          onClose={() => setEditing(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['categories'] })
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function CategoryForm({
  category,
  roots,
  onClose,
  onSaved,
}: {
  category: Category | null
  roots: Category[]
  onClose: () => void
  onSaved: () => void
}) {
  const form = useZodForm(categorySchema, category ? toForm(category) : BLANK)

  const save = (payload: CategoryPayload) =>
    api<Category>(category ? `/admin/categories/${category.id}` : '/admin/categories', {
      method: category ? 'PATCH' : 'POST',
      body: payload,
    })

  const remove = useMutation({
    mutationFn: () => api<void>(`/admin/categories/${category!.id}`, { method: 'DELETE' }),
    onSuccess: onSaved,
    onError: (error: Error) => form.setErrors({ _form: [error.message] }),
  })

  const submit = form.handleSubmit(async (payload) => {
    await save(payload)
    onSaved()
  })

  return (
    <Form
      onSubmit={submit}
      className="w-80 shrink-0 space-y-4 self-start rounded-lg border border-neutral-200 bg-white p-5"
    >
      <h2 className="text-lg font-bold">{category ? 'Edit category' : 'New category'}</h2>
      <ErrorBanner message={form.formError} />

      <Field label="Name" errors={form.errors.name}>
        {({ invalid, describedBy }) => (
          <TextInput
            invalid={invalid}
            aria-describedby={describedBy}
            placeholder="Jeans"
            value={form.values.name}
            onChange={(e) => form.setField('name', e.target.value)}
          />
        )}
      </Field>

      <Field
        label="URL slug"
        hint="Leave empty to generate it from the name."
        errors={form.errors.slug}
      >
        {({ invalid, describedBy }) => (
          <TextInput
            invalid={invalid}
            aria-describedby={describedBy}
            placeholder="jeans"
            value={form.values.slug}
            onChange={(e) => form.setField('slug', e.target.value)}
          />
        )}
      </Field>

      <Field label="Parent" errors={form.errors.parentId}>
        {({ invalid }) => (
          <Select
            invalid={invalid}
            value={form.values.parentId}
            onChange={(e) => form.setField('parentId', e.target.value)}
          >
            <option value="">None (top level)</option>
            {roots
              .filter((root) => root.id !== category?.id)
              .map((root) => (
                <option key={root.id} value={root.id}>
                  {root.name}
                </option>
              ))}
          </Select>
        )}
      </Field>

      <Field
        label="Blurb"
        hint="One line shown under the name on the home page."
        errors={form.errors.blurb}
      >
        {({ invalid, describedBy }) => (
          <TextInput
            invalid={invalid}
            aria-describedby={describedBy}
            placeholder="Cut for heat. Cotton that breathes."
            value={form.values.blurb}
            onChange={(e) => form.setField('blurb', e.target.value)}
          />
        )}
      </Field>

      <Field label="Tile image">
        {() => (
          <ImageUploader
            folder="categories"
            value={form.values.image ? [form.values.image] : []}
            onChange={([url]) => form.setField('image', url ?? null)}
          />
        )}
      </Field>

      <Field label="Size chart">
        {() => (
          <ImageUploader
            folder="categories"
            value={form.values.sizeChart ? [form.values.sizeChart] : []}
            onChange={([url]) => form.setField('sizeChart', url ?? null)}
          />
        )}
      </Field>

      <Field label="Sort order" hint="Lower numbers come first." errors={form.errors.sortOrder}>
        {({ invalid, describedBy }) => (
          <TextInput
            type="number"
            invalid={invalid}
            aria-describedby={describedBy}
            value={form.values.sortOrder}
            onChange={(e) => form.setField('sortOrder', e.target.value)}
          />
        )}
      </Field>

      <Checkbox
        label="Visible on the storefront"
        checked={form.values.isActive}
        onChange={(e) => form.setField('isActive', e.target.checked)}
      />
      <Checkbox
        label="Show as a tile on the home page"
        checked={form.values.showOnHome}
        onChange={(e) => form.setField('showOnHome', e.target.checked)}
      />

      <div className="flex flex-wrap gap-2 pt-2">
        <Button type="submit" variant="primary" disabled={form.submitting}>
          {form.submitting ? 'Saving…' : 'Save'}
        </Button>
        <Button onClick={onClose}>Cancel</Button>
        {category && (
          <Button
            variant="danger"
            className="ml-auto"
            disabled={remove.isPending}
            onClick={() => {
              if (window.confirm(`Delete "${category.name}"? This cannot be undone.`)) {
                remove.mutate()
              }
            }}
          >
            Delete
          </Button>
        )}
      </div>
    </Form>
  )
}
