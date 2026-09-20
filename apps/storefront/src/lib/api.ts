import { API_URL } from "./config";

export interface Banner {
  id: string;
  image: string;
  alt: string;
  title: string | null;
  subtitle: string | null;
  ctaLabel: string | null;
  link: string;
}

export interface CategoryTile {
  id: string;
  name: string;
  blurb: string | null;
  image: string | null;
  url: string;
}

export interface HomeContent {
  announcement: string | null;
  banners: Banner[];
  categoryTiles: CategoryTile[];
}

export interface OffersContent {
  banners: Banner[];
  bundles: { id: string; name: string }[];
}

export interface MenuLink {
  id: string;
  label: string;
  url: string;
}

export interface MenuContent {
  promoImage: string | null;
  shopByCategory: MenuLink[];
  shopByStore: MenuLink[];
  links: MenuLink[];
}

export interface ProductCardData {
  id: string;
  slug: string;
  name: string;
  brand: string;
  image: { url: string; alt: string } | null;
  mrp: number;
  salePrice: number;
  discountPercent: number;
  fabricTag: string | null;
  soldOut: boolean;
}

export interface ProductList {
  category: {
    id: string;
    name: string;
    blurb: string | null;
    path: string;
    parent: string | null;
  } | null;
  items: ProductCardData[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ProductDetail extends Omit<ProductCardData, "image" | "soldOut"> {
  description: string;
  fit: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  category: { name: string; path: string };
  sizeChart: string | null;
  images: { id: string; url: string; alt: string; colour: string | null }[];
  variants: { id: string; sku: string; size: string; colour: string; price: number; available: number }[];
}

export interface OrderView {
  orderNo: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  placedAt: string;
  address: { name: string; phone: string; line1: string; line2: string | null; city: string; state: string; pincode: string };
  items: { name: string; qty: number; price: number; lineTotal: number }[];
  subtotal: number;
  discount: number;
  shipping: number;
  codFee: number;
  total: number;
}

export interface StaticPage {
  slug: string;
  title: string;
  body: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function get<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
  const url = new URL(`${API_URL}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) url.searchParams.set(key, value);
  }

  // Content is edited from the admin panel, so nothing is cached yet.
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json();
    throw new ApiError(res.status, body.code, body.message);
  }
  return res.json();
}

export const api = {
  home: () => get<HomeContent>("/content/home"),
  offers: () => get<OffersContent>("/content/offers"),
  menu: () => get<MenuContent>("/content/menu"),
  page: (slug: string) => get<StaticPage>(`/pages/${slug}`),
  products: (params: Record<string, string | undefined>) => get<ProductList>("/products", params),
  product: (slug: string) => get<ProductDetail>(`/products/${slug}`),
  order: (orderNo: string) => get<OrderView>(`/orders/${orderNo}`),
};
