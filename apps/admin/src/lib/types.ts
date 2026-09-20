export type StaffRole = 'OWNER' | 'CATALOG_MANAGER' | 'OPERATIONS' | 'MARKETING_SUPPORT'

export interface Staff {
  id: string
  email: string
  name: string
  role: StaffRole
}

export interface Category {
  id: string
  parentId: string | null
  name: string
  slug: string
  blurb: string | null
  image: string | null
  sizeChart: string | null
  sortOrder: number
  isActive: boolean
  showOnHome: boolean
  _count: { products: number; children: number }
}

export type ProductStatus = 'DRAFT' | 'ACTIVE'

export interface ProductListItem {
  id: string
  name: string
  slug: string
  status: ProductStatus
  category: string
  image: string | null
  mrp: number
  salePrice: number
  stock: number
  variantCount: number
  updatedAt: string
}

export interface ProductList {
  items: ProductListItem[]
  page: number
  pageSize: number
  total: number
}

export interface ProductImage {
  url: string
  alt: string
  colour: string | null
}

export interface ProductVariant {
  id: string
  sku: string
  size: string
  colour: string
  stock: number
  reserved: number
  priceOverride: number | null
}

export interface Product {
  id: string
  name: string
  slug: string
  brand: string
  description: string
  mrp: number
  salePrice: number
  fabricTag: string | null
  fit: string | null
  categoryId: string
  status: ProductStatus
  images: ProductImage[]
  variants: ProductVariant[]
}
