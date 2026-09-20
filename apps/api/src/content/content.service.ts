import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { categoryPath } from '../catalog/category-path.js';
import type { BannerPlacement } from '../generated/prisma/client.js';

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  // Banners that are switched on and inside their schedule window.
  private activeBanners(placement: BannerPlacement) {
    const now = new Date();
    return this.prisma.banner.findMany({
      where: {
        placement,
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        image: true,
        alt: true,
        title: true,
        subtitle: true,
        ctaLabel: true,
        link: true,
      },
    });
  }

  async getHome() {
    const [announcement, banners, tiles] = await Promise.all([
      this.prisma.setting.findUnique({ where: { key: 'announcement_bar' } }),
      this.activeBanners('HOME'),
      this.prisma.category.findMany({
        where: { isActive: true, showOnHome: true },
        orderBy: { sortOrder: 'asc' },
        include: {
          parent: true,
          // A category shows a real garment rather than a hand-made tile, so
          // the home page follows the catalog instead of drifting from it.
          products: {
            where: { status: 'ACTIVE', images: { some: {} } },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              images: {
                orderBy: { sortOrder: 'asc' },
                take: 1,
                select: { url: true },
              },
            },
          },
        },
      }),
    ]);

    return {
      announcement: (announcement?.value as string | undefined) ?? null,
      banners,
      categoryTiles: tiles.map((c) => ({
        id: c.id,
        name: c.name,
        blurb: c.blurb,
        image: c.image ?? c.products[0]?.images[0]?.url ?? null,
        url: `/shop/category/${categoryPath(c)}/`,
      })),
    };
  }

  // Offer banners plus the bundle deals that apply automatically in the bag.
  async getOffers() {
    const now = new Date();
    const [banners, bundles] = await Promise.all([
      this.activeBanners('OFFERS'),
      this.prisma.offerRule.findMany({
        where: {
          type: 'BUNDLE',
          isActive: true,
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gte: now } }],
        },
        orderBy: { priority: 'desc' },
        select: { id: true, name: true },
      }),
    ]);

    return { banners, bundles };
  }

  async getMenu() {
    const [promo, items] = await Promise.all([
      this.prisma.setting.findUnique({ where: { key: 'drawer_promo_image' } }),
      this.prisma.menuItem.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, section: true, label: true, url: true },
      }),
    ]);

    return {
      promoImage: (promo?.value as string | undefined) ?? null,
      shopByCategory: items.filter((i) => i.section === 'SHOP_BY_CATEGORY'),
      shopByStore: items.filter((i) => i.section === 'SHOP_BY_STORE'),
      links: items.filter((i) => i.section === 'LINKS'),
    };
  }

  async getPage(slug: string) {
    const page = await this.prisma.page.findUnique({ where: { slug } });
    if (!page)
      throw new NotFoundException({
        code: 'PAGE_NOT_FOUND',
        message: 'Page not found',
      });
    return page;
  }
}
