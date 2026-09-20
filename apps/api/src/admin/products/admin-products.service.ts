import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthStaff } from '../../auth/staff.js';
import { compareSizes } from '../../catalog/size-order.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit.service.js';
import { slugify } from '../slug.js';
import {
  CreateProductDto,
  ListAdminProductsDto,
  ProductVariantDto,
  UpdateProductDto,
} from './dto/product.dto.js';

const detailInclude = {
  images: { orderBy: { sortOrder: 'asc' } },
  variants: true,
  category: { include: { parent: true } },
} satisfies Prisma.ProductInclude;

type ProductDetail = Prisma.ProductGetPayload<{
  include: typeof detailInclude;
}>;

function toDetail(product: ProductDetail) {
  return {
    ...product,
    variants: product.variants.sort(
      (a, b) =>
        a.colour.localeCompare(b.colour) || compareSizes(a.size, b.size),
    ),
  };
}

const skuFor = (slug: string, variant: ProductVariantDto) =>
  variant.sku?.trim() ||
  slugify(`${slug} ${variant.colour} ${variant.size}`).toUpperCase();

@Injectable()
export class AdminProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListAdminProductsDto) {
    const where: Prisma.ProductWhereInput = {
      status: query.status,
      ...(query.categoryId
        ? {
            OR: [
              { categoryId: query.categoryId },
              { category: { parentId: query.categoryId } },
            ],
          }
        : {}),
      ...(query.q
        ? {
            AND: {
              OR: [
                { name: { contains: query.q, mode: 'insensitive' } },
                { slug: { contains: query.q, mode: 'insensitive' } },
                {
                  variants: {
                    some: { sku: { contains: query.q, mode: 'insensitive' } },
                  },
                },
              ],
            },
          }
        : {}),
    };

    const [total, products] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          images: { orderBy: { sortOrder: 'asc' }, take: 1 },
          variants: { select: { stock: true, reserved: true } },
          category: { select: { name: true } },
        },
      }),
    ]);

    return {
      items: products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        status: p.status,
        category: p.category.name,
        image: p.images[0]?.url ?? null,
        mrp: p.mrp,
        salePrice: p.salePrice,
        stock: p.variants.reduce((sum, v) => sum + v.stock - v.reserved, 0),
        variantCount: p.variants.length,
        updatedAt: p.updatedAt,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async get(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: detailInclude,
    });
    if (!product) throw this.notFound();
    return toDetail(product);
  }

  async create(dto: CreateProductDto, staff: AuthStaff) {
    this.assertPrices(dto.mrp, dto.salePrice);
    this.assertDistinctVariants(dto.variants);
    await this.assertCategory(dto.categoryId);

    const { images, variants, ...fields } = dto;
    const slug = dto.slug ?? slugify(dto.name);

    return this.write(() =>
      this.prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            ...fields,
            slug,
            images: { create: this.imageRows(images, dto.name) },
            variants: {
              create: variants.map((variant) => ({
                size: variant.size,
                colour: variant.colour,
                sku: skuFor(slug, variant),
                stock: variant.stock,
                priceOverride: variant.priceOverride,
              })),
            },
          },
          include: detailInclude,
        });

        await tx.stockMovement.createMany({
          data: product.variants
            .filter((v) => v.stock > 0)
            .map((v) => ({
              variantId: v.id,
              change: v.stock,
              reason: 'Opening stock',
              staffUserId: staff.id,
            })),
        });
        await this.audit.log(
          {
            staffId: staff.id,
            entity: 'product',
            entityId: product.id,
            action: 'create',
            after: product,
          },
          tx,
        );
        return toDetail(product);
      }),
    );
  }

  async update(id: string, dto: UpdateProductDto, staff: AuthStaff) {
    const before = await this.get(id);
    this.assertPrices(dto.mrp ?? before.mrp, dto.salePrice ?? before.salePrice);
    if (dto.variants) this.assertDistinctVariants(dto.variants);
    if (dto.categoryId) await this.assertCategory(dto.categoryId);

    const { images, variants, ...fields } = dto;
    const slug = dto.slug ?? before.slug;

    return this.write(() =>
      this.prisma.$transaction(async (tx) => {
        await tx.product.update({ where: { id }, data: fields });

        if (images) {
          await tx.productImage.deleteMany({ where: { productId: id } });
          await tx.productImage.createMany({
            data: this.imageRows(images, dto.name ?? before.name).map(
              (image) => ({ ...image, productId: id }),
            ),
          });
        }

        if (variants) {
          await this.syncVariants(tx, before, variants, slug, staff);
        }

        const product = await tx.product.findUniqueOrThrow({
          where: { id },
          include: detailInclude,
        });
        await this.audit.log(
          {
            staffId: staff.id,
            entity: 'product',
            entityId: id,
            action: 'update',
            before,
            after: product,
          },
          tx,
        );
        return toDetail(product);
      }),
    );
  }

  async remove(id: string, staff: AuthStaff) {
    const before = await this.get(id);

    return this.write(() =>
      this.prisma.$transaction(async (tx) => {
        // Stock history belongs to the product and goes with it; carts and
        // orders do not, and block the delete through their foreign keys.
        await tx.stockMovement.deleteMany({
          where: { variant: { productId: id } },
        });
        await tx.product.delete({ where: { id } });
        await this.audit.log(
          {
            staffId: staff.id,
            entity: 'product',
            entityId: id,
            action: 'delete',
            before,
          },
          tx,
        );
      }),
    );
  }

  // Variants with an id are updated, new ones created, missing ones removed.
  // Stock changes are written to stock_movement so inventory stays auditable.
  private async syncVariants(
    tx: Prisma.TransactionClient,
    before: ProductDetail,
    variants: ProductVariantDto[],
    slug: string,
    staff: AuthStaff,
  ) {
    const existing = new Map(before.variants.map((v) => [v.id, v]));
    const keptIds = new Set<string>();

    for (const variant of variants) {
      const current = variant.id ? existing.get(variant.id) : undefined;
      if (variant.id && !current) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Invalid request',
          fields: {
            variants: [`Variant ${variant.id} is not on this product`],
          },
        });
      }

      const data = {
        size: variant.size,
        colour: variant.colour,
        stock: variant.stock,
        priceOverride: variant.priceOverride ?? null,
      };

      if (current) {
        keptIds.add(current.id);
        await tx.variant.update({
          where: { id: current.id },
          data: {
            ...data,
            ...(variant.sku ? { sku: variant.sku.trim() } : {}),
          },
        });
      }
      const saved =
        current ??
        (await tx.variant.create({
          data: { ...data, productId: before.id, sku: skuFor(slug, variant) },
        }));

      const change = variant.stock - (current?.stock ?? 0);
      if (change !== 0) {
        await tx.stockMovement.create({
          data: {
            variantId: saved.id,
            change,
            reason: current ? 'Manual adjustment' : 'Opening stock',
            staffUserId: staff.id,
          },
        });
      }
    }

    const removedIds = before.variants
      .map((v) => v.id)
      .filter((variantId) => !keptIds.has(variantId));
    if (removedIds.length > 0) {
      await tx.stockMovement.deleteMany({
        where: { variantId: { in: removedIds } },
      });
      await tx.variant.deleteMany({ where: { id: { in: removedIds } } });
    }
  }

  private imageRows(images: CreateProductDto['images'], productName: string) {
    return images.map((image, sortOrder) => ({
      url: image.url,
      alt: image.alt?.trim() || productName,
      colour: image.colour ?? null,
      sortOrder,
    }));
  }

  private assertPrices(mrp: number, salePrice: number) {
    if (salePrice > mrp) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        fields: { salePrice: ['Sale price cannot be higher than MRP'] },
      });
    }
  }

  private assertDistinctVariants(variants: ProductVariantDto[]) {
    const seen = new Set<string>();
    for (const variant of variants) {
      const key = `${variant.size.toLowerCase()}|${variant.colour.toLowerCase()}`;
      if (seen.has(key)) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Invalid request',
          fields: {
            variants: [`${variant.colour} / ${variant.size} is listed twice`],
          },
        });
      }
      seen.add(key);
    }
  }

  private async assertCategory(categoryId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        fields: { categoryId: ['Category not found'] },
      });
    }
  }

  private async write<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const target = JSON.stringify(error.meta?.target ?? '');
          const field = target.includes('sku') ? 'sku' : 'slug';
          throw new ConflictException({
            code: field === 'sku' ? 'SKU_TAKEN' : 'SLUG_TAKEN',
            message: `Another product already uses that ${field}`,
            fields: {
              [field === 'sku' ? 'variants' : 'slug']: ['Already in use'],
            },
          });
        }
        // A variant that sits in a cart or on an order cannot be deleted.
        if (error.code === 'P2003' || error.code === 'P2014') {
          throw new ConflictException({
            code: 'PRODUCT_IN_USE',
            message:
              'This item is in a customer bag or on an order. Set it to Draft, or set the size to 0 stock, instead of deleting it',
          });
        }
      }
      throw error;
    }
  }

  private notFound() {
    return new NotFoundException({
      code: 'PRODUCT_NOT_FOUND',
      message: 'Product not found',
    });
  }
}
