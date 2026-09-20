import { z } from 'zod'

/**
 * Every admin form is described here, once. The same schema gives the form its
 * validation, its TypeScript types and the shape sent to the API, so the three
 * cannot drift apart.
 *
 * Forms hold strings because that is what inputs produce; each schema converts
 * to the types the API expects (paise, numbers, nulls) as it validates.
 */

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

const slugField = z
  .string()
  .trim()
  .refine((value) => value === '' || SLUG.test(value), {
    message: 'Use lowercase letters, numbers and hyphens only',
  })
  // Blank means "generate it from the name", which the API does.
  .transform((value) => value || undefined)

/** Rupees in the form, integer paise over the wire. */
const rupees = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((value) => Number.isFinite(Number(value)) && Number(value) > 0, {
      message: `${label} must be a number above zero`,
    })
    .transform((value) => Math.round(Number(value) * 100))

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .transform((value) => value || null)

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').pipe(z.email('Enter a valid email')),
  password: z.string().min(1, 'Password is required'),
})

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80, 'Keep the name under 80 characters'),
  slug: slugField,
  // The select uses "" for no parent; the API wants null.
  parentId: z.string().transform((value) => value || null),
  blurb: optionalText(120),
  image: z.string().nullable(),
  sizeChart: z.string().nullable(),
  sortOrder: z
    .string()
    .trim()
    .refine((value) => value === '' || Number.isInteger(Number(value)), {
      message: 'Sort order must be a whole number',
    })
    .transform((value) => (value === '' ? 0 : Number(value))),
  isActive: z.boolean(),
  showOnHome: z.boolean(),
})

export const variantSchema = z.object({
  id: z.string().optional(),
  sku: z.string().optional(),
  size: z.string().trim().min(1, 'Size is required').max(20),
  colour: z.string().trim().min(1, 'Colour is required').max(40),
  stock: z
    .string()
    .trim()
    .refine((value) => Number.isInteger(Number(value)) && Number(value) >= 0, {
      message: 'Stock must be zero or more',
    })
    .transform((value) => Number(value)),
})

export const productSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(160),
    slug: slugField,
    brand: z.string().trim().min(1, 'Brand is required').max(80),
    description: z.string().trim(),
    mrp: rupees('MRP'),
    salePrice: rupees('Sale price'),
    fabricTag: optionalText(40),
    fit: optionalText(40),
    categoryId: z.string().min(1, 'Choose a category'),
    status: z.enum(['DRAFT', 'ACTIVE']),
    images: z.array(z.string()).max(12, 'Up to 12 images'),
    variants: z.array(variantSchema).min(1, 'Add at least one size'),
  })
  // Checked here as well as on the server, so the mistake is caught before a
  // round trip rather than only after one.
  .refine((product) => product.salePrice <= product.mrp, {
    message: 'Sale price cannot be higher than MRP',
    path: ['salePrice'],
  })
  .refine(
    (product) =>
      new Set(product.variants.map((v) => `${v.size.toLowerCase()}|${v.colour.toLowerCase()}`))
        .size === product.variants.length,
    { message: 'The same colour and size is listed twice', path: ['variants'] },
  )

export type LoginInput = z.input<typeof loginSchema>
export type CategoryInput = z.input<typeof categorySchema>
export type CategoryPayload = z.output<typeof categorySchema>
export type ProductInput = z.input<typeof productSchema>
export type ProductPayload = z.output<typeof productSchema>
export type VariantInput = z.input<typeof variantSchema>
