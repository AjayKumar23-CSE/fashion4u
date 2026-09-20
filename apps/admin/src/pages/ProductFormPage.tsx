import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'
import { ImageUploader } from '../components/ImageUploader'
import {
  Button,
  ErrorBanner,
  Field,
  Form,
  Section,
  Select,
  TextArea,
  TextInput,
} from '../components/ui'
import { api } from '../lib/api'
import { discountPercent, formatPrice, toPaise, toRupees } from '../lib/money'
import { productSchema, type ProductInput, type VariantInput } from '../lib/schemas'
import { useZodForm } from '../lib/useZodForm'
import type { Category, Product, ProductStatus } from '../lib/types'

const COMMON_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '28', '30', '32', '34', '36', '38']

const BLANK: ProductInput = {
  name: '',
  slug: '',
  brand: '',
  description: '',
  mrp: '',
  salePrice: '',
  fabricTag: '',
  fit: '',
  categoryId: '',
  status: 'DRAFT',
  images: [],
  variants: [],
}

const toForm = (product: Product): ProductInput => ({
  name: product.name,
  slug: product.slug,
  brand: product.brand,
  description: product.description,
  mrp: toRupees(product.mrp),
  salePrice: toRupees(product.salePrice),
  fabricTag: product.fabricTag ?? '',
  fit: product.fit ?? '',
  categoryId: product.categoryId,
  status: product.status,
  images: product.images.map((image) => image.url),
  variants: product.variants.map((variant) => ({
    id: variant.id,
    sku: variant.sku,
    size: variant.size,
    colour: variant.colour,
    stock: String(variant.stock),
  })),
})

export function ProductFormPage() {
  const { id } = useParams()
  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => api<Product>(`/admin/products/${id}`),
    enabled: Boolean(id),
  })

  if (id && isLoading) return <p className="text-sm text-neutral-500">Loading…</p>
  if (id && !product) return <p className="text-sm text-neutral-500">Product not found.</p>

  // Keyed so the form state starts fresh from the loaded product.
  return <ProductEditor key={product?.id ?? 'new'} product={product ?? null} />
}

function ProductEditor({ product }: { product: Product | null }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const form = useZodForm(productSchema, product ? toForm(product) : BLANK)
  const [newColour, setNewColour] = useState('')
  const [newSizes, setNewSizes] = useState<string[]>([])

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api<Category[]>('/admin/categories'),
  })

  const done = () => {
    queryClient.invalidateQueries({ queryKey: ['products'] })
    queryClient.invalidateQueries({ queryKey: ['product'] })
    queryClient.invalidateQueries({ queryKey: ['categories'] })
    navigate('/products')
  }

  const submit = form.handleSubmit(async (payload) => {
    await api<Product>(product ? `/admin/products/${product.id}` : '/admin/products', {
      method: product ? 'PATCH' : 'POST',
      // The schema already converted rupees to paise and trimmed the strings;
      // only the image shape differs from what the API expects.
      body: { ...payload, images: payload.images.map((url) => ({ url })) },
    })
    done()
  })

  const remove = useMutation({
    mutationFn: () => api<void>(`/admin/products/${product!.id}`, { method: 'DELETE' }),
    onSuccess: done,
    onError: (error: Error) => form.setErrors({ _form: [error.message] }),
  })

  // Adds one row per ticked size for the typed colour, skipping duplicates.
  function addVariants() {
    const colour = newColour.trim()
    if (!colour || newSizes.length === 0) return
    const exists = (size: string) =>
      form.values.variants.some(
        (variant) =>
          variant.size.toLowerCase() === size.toLowerCase() &&
          variant.colour.toLowerCase() === colour.toLowerCase(),
      )

    form.setField('variants', [
      ...form.values.variants,
      ...newSizes
        .filter((size) => !exists(size))
        .map<VariantInput>((size) => ({ size, colour, stock: '0' })),
    ])
    setNewSizes([])
  }

  const setStock = (index: number, stock: string) =>
    form.setField(
      'variants',
      form.values.variants.map((variant, i) => (i === index ? { ...variant, stock } : variant)),
    )

  const discount = discountPercent(toPaise(form.values.mrp), toPaise(form.values.salePrice))
  const totalStock = form.values.variants.reduce(
    (sum, variant) => sum + (Number(variant.stock) || 0),
    0,
  )

  return (
    <Form onSubmit={submit} className="max-w-4xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <Link to="/products" className="text-xs text-neutral-500 hover:underline">
            ← Products
          </Link>
          <h1 className="text-2xl font-bold">{product ? product.name : 'New product'}</h1>
        </div>
        <div className="flex gap-2">
          {product && (
            <Button
              variant="danger"
              disabled={remove.isPending}
              onClick={() =>
                window.confirm(`Delete "${product.name}"? This cannot be undone.`) && remove.mutate()
              }
            >
              Delete
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={form.submitting}>
            {form.submitting ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </header>

      <ErrorBanner message={form.formError} />

      <Section title="Details">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Name" errors={form.errors.name}>
            {({ invalid, describedBy }) => (
              <TextInput
                invalid={invalid}
                aria-describedby={describedBy}
                placeholder="Slim Fit Indigo Jeans"
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
                value={form.values.slug}
                onChange={(e) => form.setField('slug', e.target.value)}
              />
            )}
          </Field>
          <Field label="Brand" errors={form.errors.brand}>
            {({ invalid, describedBy }) => (
              <TextInput
                invalid={invalid}
                aria-describedby={describedBy}
                value={form.values.brand}
                onChange={(e) => form.setField('brand', e.target.value)}
              />
            )}
          </Field>
          <Field label="Category" errors={form.errors.categoryId}>
            {({ invalid }) => (
              <Select
                invalid={invalid}
                value={form.values.categoryId}
                onChange={(e) => form.setField('categoryId', e.target.value)}
              >
                <option value="">Choose a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.parentId ? '— ' : ''}
                    {category.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field
            label="Fabric tag"
            hint="Shown on the product card, e.g. 100% Cotton."
            errors={form.errors.fabricTag}
          >
            {({ invalid, describedBy }) => (
              <TextInput
                invalid={invalid}
                aria-describedby={describedBy}
                value={form.values.fabricTag}
                onChange={(e) => form.setField('fabricTag', e.target.value)}
              />
            )}
          </Field>
          <Field label="Fit" errors={form.errors.fit}>
            {({ invalid, describedBy }) => (
              <TextInput
                invalid={invalid}
                aria-describedby={describedBy}
                placeholder="Regular"
                value={form.values.fit}
                onChange={(e) => form.setField('fit', e.target.value)}
              />
            )}
          </Field>
        </div>
        <Field label="Description" errors={form.errors.description}>
          {({ invalid }) => (
            <TextArea
              rows={4}
              invalid={invalid}
              value={form.values.description}
              onChange={(e) => form.setField('description', e.target.value)}
            />
          )}
        </Field>
      </Section>

      <Section title="Price">
        <div className="grid grid-cols-3 items-start gap-4">
          <Field label="MRP (₹)" errors={form.errors.mrp}>
            {({ invalid, describedBy }) => (
              <TextInput
                type="number"
                min="1"
                step="0.01"
                invalid={invalid}
                aria-describedby={describedBy}
                value={form.values.mrp}
                onChange={(e) => form.setField('mrp', e.target.value)}
              />
            )}
          </Field>
          <Field label="Sale price (₹)" errors={form.errors.salePrice}>
            {({ invalid, describedBy }) => (
              <TextInput
                type="number"
                min="1"
                step="0.01"
                invalid={invalid}
                aria-describedby={describedBy}
                value={form.values.salePrice}
                onChange={(e) => form.setField('salePrice', e.target.value)}
              />
            )}
          </Field>
          <div>
            <span className="mb-1 block text-xs font-semibold text-neutral-700">
              Badge on the storefront
            </span>
            <span className="inline-block bg-red-600 px-2 py-1 text-xs font-bold text-white">
              {discount > 0 ? `${discount}% OFF` : 'No discount'}
            </span>
          </div>
        </div>
      </Section>

      <Section title="Images">
        <ImageUploader
          folder="products"
          multiple
          value={form.values.images}
          onChange={(urls) => form.setField('images', urls)}
        />
      </Section>

      <Section title={`Sizes and stock · ${totalStock} in total`}>
        <ErrorBanner message={form.errors.variants?.join(' · ') ?? null} />

        {form.values.variants.length > 0 && (
          <table className="w-full border-collapse text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="py-1 pr-3">Colour</th>
                <th className="py-1 pr-3">Size</th>
                <th className="py-1 pr-3">SKU</th>
                <th className="w-28 py-1 pr-3">Stock</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {form.values.variants.map((variant, index) => (
                <tr key={`${variant.colour}-${variant.size}`} className="border-t border-neutral-200">
                  <td className="py-1.5 pr-3">{variant.colour}</td>
                  <td className="py-1.5 pr-3 font-semibold">{variant.size}</td>
                  <td className="py-1.5 pr-3 font-mono text-xs text-neutral-500">
                    {variant.sku ?? 'Generated on save'}
                  </td>
                  <td className="py-1.5 pr-3">
                    <TextInput
                      type="number"
                      min="0"
                      aria-label={`Stock for ${variant.colour} ${variant.size}`}
                      invalid={Boolean(form.errors[`variants.${index}.stock`])}
                      value={variant.stock}
                      onChange={(e) => setStock(index, e.target.value)}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      aria-label={`Remove ${variant.colour} ${variant.size}`}
                      onClick={() =>
                        form.setField(
                          'variants',
                          form.values.variants.filter((_, i) => i !== index),
                        )
                      }
                      className="flex h-8 w-8 items-center justify-center rounded text-lg hover:bg-red-50 hover:text-red-700"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="rounded-md bg-neutral-50 p-4">
          <p className="mb-2 text-xs font-semibold text-neutral-700">Add sizes for a colour</p>
          <div className="flex flex-wrap items-center gap-2">
            <TextInput
              placeholder="Colour, e.g. Black"
              value={newColour}
              onChange={(e) => setNewColour(e.target.value)}
              className="max-w-44"
            />
            {COMMON_SIZES.map((size) => {
              const selected = newSizes.includes(size)
              return (
                <button
                  key={size}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    setNewSizes(
                      selected ? newSizes.filter((s) => s !== size) : [...newSizes, size],
                    )
                  }
                  className={`h-9 min-w-9 rounded-md border px-2 text-xs font-semibold ${
                    selected
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : 'border-neutral-300 bg-white hover:border-neutral-900'
                  }`}
                >
                  {size}
                </button>
              )
            })}
            <Button disabled={!newColour.trim() || newSizes.length === 0} onClick={addVariants}>
              Add
            </Button>
          </div>
        </div>
      </Section>

      <Section title="Visibility">
        <Field label="Status" hint="Draft products are hidden from the storefront.">
          {() => (
            <Select
              value={form.values.status}
              onChange={(e) => form.setField('status', e.target.value as ProductStatus)}
              className="max-w-44"
            >
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
            </Select>
          )}
        </Field>
      </Section>

      <p className="text-xs text-neutral-500">
        Total stock across sizes: {totalStock} · Sale price {formatPrice(toPaise(form.values.salePrice))}
      </p>
    </Form>
  )
}
