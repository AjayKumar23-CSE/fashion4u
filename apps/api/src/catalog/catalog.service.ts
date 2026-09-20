import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { categoryPath } from './category-path.js';
import { ListProductsDto, ProductSort } from './dto/list-products.dto.js';
import { discountPercent } from './pricing.js';
import { compareSizes } from './size-order.js';

const SORT_ORDER: Record<ProductSort, Prisma.ProductOrderByWithRelationInput> =
  {
    newest: { createdAt: 'desc' },
    price_asc: { salePrice: 'asc' },
    price_desc: { salePrice: 'desc' },
  };

const cardInclude = {
  images: {
    orderBy: { sortOrder: 'asc' },
    take: 1,
    select: { url: true, alt: true },
  },
  variants: { select: { stock: true, reserved: true } },
} satisfies Prisma.ProductInclude;

type ProductForCard = Prisma.ProductGetPayload<{ include: typeof cardInclude }>;

function toCard(product: ProductForCard) {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    image: product.images[0] ?? null,
    mrp: product.mrp,
    salePrice: product.salePrice,
    discountPercent: discountPercent(product.mrp, product.salePrice),
    fabricTag: product.fabricTag,
    soldOut: product.variants.every((v) => v.stock - v.reserved <= 0),
  };
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async getCategoryTree() {
    const roots = await this.prisma.category.findMany({
      where: { parentId: null, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        children: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
      },
    });

    return roots.map((root) => ({
      id: root.id,
      name: root.name,
      slug: root.slug,
      image: root.image,
      path: root.slug,
      children: root.children.map((child) => ({
        id: child.id,
        name: child.name,
        slug: child.slug,
        image: child.image,
        path: categoryPath({ slug: child.slug, parent: root }),
      })),
    }));
  }

  async getCategoryByPath(path: string) {
    const [first, second] = path.split('/').filter(Boolean);
    const category = second
      ? await this.prisma.category.findFirst({
          where: { slug: second, isActive: true, parent: { slug: first } },
          include: { parent: true },
        })
      : await this.prisma.category.findFirst({
          where: { slug: first, isActive: true, parentId: null },
          include: { parent: true },
        });

    if (!category) {
      throw new NotFoundException({
        code: 'CATEGORY_NOT_FOUND',
        message: 'Category not found',
      });
    }
    return category;
  }

  async listProducts(query: ListProductsDto) {
    const where: Prisma.ProductWhereInput = { status: 'ACTIVE' };
    let category: Awaited<
      ReturnType<CatalogService['getCategoryByPath']>
    > | null = null;

    if (query.category) {
      category = await this.getCategoryByPath(query.category);
      // A parent category lists everything under it.
      where.OR = [
        { categoryId: category.id },
        { category: { parentId: category.id } },
      ];
    }
    if (query.collection) {
      where.collections = {
        some: { collection: { slug: query.collection, isActive: true } },
      };
    }
    if (query.fabric) where.fabricTag = query.fabric;
    if (query.fit) where.fit = query.fit;
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.salePrice = { gte: query.minPrice, lte: query.maxPrice };
    }
    if (query.size || query.colour) {
      where.variants = { some: { size: query.size, colour: query.colour } };
    }

    const [total, products] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: SORT_ORDER[query.sort],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: cardInclude,
      }),
    ]);

    return {
      category: category
        ? {
            id: category.id,
            name: category.name,
            blurb: category.blurb,
            path: categoryPath(category),
            parent: category.parent?.name ?? null,
          }
        : null,
      items: products.map(toCard),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async getProduct(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: 'ACTIVE' },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        variants: true,
        category: { include: { parent: true } },
      },
    });

    if (!product) {
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: 'Product not found',
      });
    }

    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      description: product.description,
      mrp: product.mrp,
      salePrice: product.salePrice,
      discountPercent: discountPercent(product.mrp, product.salePrice),
      fabricTag: product.fabricTag,
      fit: product.fit,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      category: {
        name: product.category.name,
        path: categoryPath(product.category),
      },
      sizeChart: product.category.sizeChart,
      images: product.images.map(({ id, url, alt, colour }) => ({
        id,
        url,
        alt,
        colour,
      })),
      variants: product.variants
        .sort(
          (a, b) =>
            a.colour.localeCompare(b.colour) || compareSizes(a.size, b.size),
        )
        .map((v) => ({
          id: v.id,
          sku: v.sku,
          size: v.size,
          colour: v.colour,
          price: v.priceOverride ?? product.salePrice,
          available: Math.max(v.stock - v.reserved, 0),
        })),
    };
  }

  // Suggestions start after 2 characters (C-05).
  async suggest(q: string) {
    const term = q.trim();
    if (term.length < 2) return { products: [], categories: [] };

    const [products, categories] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          status: 'ACTIVE',
          name: { contains: term, mode: 'insensitive' },
        },
        take: 6,
        select: { slug: true, name: true },
      }),
      this.prisma.category.findMany({
        where: {
          isActive: true,
          name: { contains: term, mode: 'insensitive' },
        },
        take: 4,
        include: { parent: true },
      }),
    ]);

    return {
      products,
      categories: categories.map((c) => ({
        name: c.name,
        path: categoryPath(c),
      })),
    };
  }
}
