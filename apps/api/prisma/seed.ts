import 'dotenv/config';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../src/auth/password.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { directDatabaseUrl } from '../src/prisma/database-url.js';

const prisma = new PrismaClient({
  // Bulk writes bypass the pooler; see src/prisma/database-url.ts.
  adapter: new PrismaPg({ connectionString: directDatabaseUrl() }),
});

// The catalog is built from the photo folders in the storefront:
// images/{product-slug}/360/{id}.jpg is the listing thumbnail and
// images/{product-slug}/540/*.jpg are the gallery shots.
const IMAGES_DIR = fileURLToPath(
  new URL('../../storefront/public/seed/site-images/images/', import.meta.url),
);
const IMAGES_URL = '/seed/site-images/images';
const SHARED_URL = '/seed/site-images/shared/img';

const BRAND = 'Fashion4U';
const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
const SOLD_OUT = new Set(['heavy-weight-black-tank-for-men']);
const rupees = (amount: number) => amount * 100;

interface SeedCategory {
  name: string;
  slug: string;
  /** One-line pitch shown under the category name on the home page. */
  blurb?: string;
  // Folder names containing this keyword belong to the category.
  keyword?: string;
  mrp?: number;
  salePrice?: number;
  fabricTag?: string;
  fit?: string;
  store?: '599' | '699';
  sizeChart?: string;
}

const TOPS_SIZE_CHART = `${SHARED_URL}/kwabey/sizecharts/men-t-shirts-sizechart.jpg`;

// Home tile order follows the reference home screen.
const CATEGORIES: SeedCategory[] = [
  {
    name: 'Regular Polos',
    slug: 'regular-polos',
  },
  {
    name: 'Designer Polos',
    slug: 'designer-polos',
  },
  {
    name: 'Summer Tanks',
    slug: 'tank-tops',
    blurb: 'Cut for heat. Cotton that breathes.',
    keyword: 'tank',
    mrp: rupees(999),
    salePrice: rupees(449),
    fabricTag: '100% Cotton',
    fit: 'Relaxed',
    sizeChart: TOPS_SIZE_CHART,
  },
  {
    name: 'Compression T-Shirts',
    slug: 'compression-t-shirts',
    blurb: 'Second-skin fit. Built for the gym floor.',
    keyword: 'compression',
    mrp: rupees(1499),
    salePrice: rupees(699),
    fabricTag: 'Poly Spandex',
    fit: 'Compression',
    store: '699',
    sizeChart: TOPS_SIZE_CHART,
  },
  {
    name: 'Rugby Polos',
    slug: 'rugby-polos',
  },
  {
    name: 'Sweatshirts',
    slug: 'sweatshirts',
    blurb: 'Heavyweight fleece. Room to move.',
    keyword: 'sweatshirt',
    mrp: rupees(2499),
    salePrice: rupees(899),
    fabricTag: 'Cotton Fleece',
    fit: 'Relaxed',
    sizeChart: TOPS_SIZE_CHART,
  },
  {
    name: 'Boxy Fit Polos',
    slug: 'boxy-fit-polos',
  },
  {
    name: 'Joggers',
    slug: 'joggers',
    blurb: 'Tapered, not tight. All day, every day.',
    keyword: 'jogger',
    mrp: rupees(1999),
    salePrice: rupees(799),
    fabricTag: 'Cotton Blend',
    fit: 'Straight',
  },
  {
    name: 'Full Sleeve Boxy T-Shirts',
    slug: 'full-sleeve-boxy-t-shirts',
    blurb: 'Boxy shoulders. Relaxed drop.',
    keyword: 'boxy-fit',
    mrp: rupees(1299),
    salePrice: rupees(599),
    fabricTag: '100% Cotton',
    fit: 'Boxy',
    store: '599',
    sizeChart: TOPS_SIZE_CHART,
  },
];

// Longest names first so "coffee-brown" wins over "brown".
const COLOURS = [
  'coffee-brown',
  'ash-brown',
  'off-white',
  'navy-blue',
  'stone-grey',
  'stone-blue',
  'denim-blue',
  'olive-green',
  'bottle-green',
  'military',
  'black',
  'white',
  'grey',
  'red',
  'beige',
  'lilac',
  'olive',
  'blue',
];

const STATIC_PAGES = [
  ['about-us', 'About Us'],
  ['contact', 'Contact'],
  ['shipping-policy', 'Shipping Policy'],
  ['returns', 'Returns & Exchanges'],
  ['privacy-policy', 'Privacy Policy'],
  ['terms-and-conditions', 'Terms & Conditions'],
] as const;

const NAME_FIXES: Record<string, string> = {
  tshirt: 'T-Shirt',
  fullsleeve: 'Full Sleeve',
  nyc: 'NYC',
};

const titleCase = (slug: string) =>
  slug
    .replace(/t-shirt/g, 'tshirt')
    .split('-')
    .map((word) => NAME_FIXES[word] ?? word[0].toUpperCase() + word.slice(1))
    .join(' ');

const colourOf = (slug: string) =>
  titleCase(COLOURS.find((colour) => slug.includes(colour)) ?? 'multicolour');

const jpgsIn = (dir: string) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.jpg')) : [];

// Gallery images for a product folder, listing thumbnail first.
function galleryOf(slug: string): string[] {
  const [thumb] = jpgsIn(`${IMAGES_DIR}${slug}/360`);
  const gallery = jpgsIn(`${IMAGES_DIR}${slug}/540`).sort(
    (a, b) => Number(b === thumb) - Number(a === thumb) || a.localeCompare(b),
  );
  return gallery.map((file) => `${IMAGES_URL}/${slug}/540/${file}`);
}

async function reset() {
  // Anything that points at a variant or product has to go first, or the
  // deletes below trip a foreign key.
  await prisma.stockMovement.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.review.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.collectionProduct.deleteMany();
  await prisma.collection.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.variant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany({ where: { parentId: { not: null } } });
  await prisma.category.deleteMany();
  await prisma.offerRule.deleteMany();
  await prisma.banner.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.page.deleteMany();
  await prisma.setting.deleteMany();
}

async function main() {
  // Re-seeding rebuilds the catalog, which real orders reference. Better to
  // stop with an explanation than to fail on a foreign key halfway through.
  const orders = await prisma.order.count();
  if (orders > 0) {
    throw new Error(
      `${orders} order(s) exist and reference this catalog. Clear them first if this is test data, or skip re-seeding.`,
    );
  }

  await reset();

  const productSlugs = readdirSync(IMAGES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name !== 'banners' && name !== 'offer-banners')
    .sort();

  const stores = {
    '599': await prisma.collection.create({
      data: { name: '599 Store', slug: '599', fixedPrice: rupees(599) },
    }),
    '699': await prisma.collection.create({
      data: { name: '699 Store', slug: '699', fixedPrice: rupees(699) },
    }),
  };
  const tanksBundle = await prisma.collection.create({
    data: { name: 'Summer Tanks Bundle', slug: 'summer-tanks-bundle' },
  });

  const men = await prisma.category.create({
    data: { name: 'Men', slug: 'men' },
  });

  for (const [index, seedCategory] of CATEGORIES.entries()) {
    const category = await prisma.category.create({
      data: {
        parentId: men.id,
        name: seedCategory.name,
        slug: seedCategory.slug,
        image: null,
        sortOrder: index,
        sizeChart: seedCategory.sizeChart,
        blurb: seedCategory.blurb,
        // Only categories that actually have items are offered on the home page.
        showOnHome: Boolean(seedCategory.keyword),
      },
    });

    const { keyword } = seedCategory;
    if (!keyword) continue;

    for (const slug of productSlugs.filter((s) => s.includes(keyword))) {
      const name = titleCase(slug);
      const colour = colourOf(slug);
      const product = await prisma.product.create({
        data: {
          name,
          slug,
          brand: BRAND,
          description: `${name} in ${seedCategory.fabricTag!.toLowerCase()}, ${seedCategory.fit!.toLowerCase()} fit.`,
          mrp: seedCategory.mrp!,
          salePrice: seedCategory.salePrice!,
          fabricTag: seedCategory.fabricTag,
          fit: seedCategory.fit,
          categoryId: category.id,
          hsnCode: '6109',
          status: 'ACTIVE',
          images: {
            create: galleryOf(slug).map((url, sortOrder) => ({
              url,
              alt: name,
              colour,
              sortOrder,
            })),
          },
          variants: {
            create: SIZES.map((size) => ({
              sku: `${slug}-${size}`.toUpperCase(),
              size,
              colour,
              stock: SOLD_OUT.has(slug) ? 0 : 25,
            })),
          },
        },
      });

      if (seedCategory.store) {
        await prisma.collectionProduct.create({
          data: {
            collectionId: stores[seedCategory.store].id,
            productId: product.id,
          },
        });
      }
      if (seedCategory.slug === 'tank-tops') {
        await prisma.collectionProduct.create({
          data: { collectionId: tanksBundle.id, productId: product.id },
        });
      }
    }
  }

  await prisma.offerRule.create({
    data: {
      type: 'BUNDLE',
      name: 'Buy any 4 Summer Tanks at ₹999',
      config: { collectionId: tanksBundle.id, qty: 4, price: rupees(999) },
      priority: 10,
      startsAt: new Date(),
    },
  });

  await prisma.setting.createMany({
    data: [
      {
        key: 'announcement_bar',
        value: 'Free delivery over ₹999 · Cash on delivery across India',
      },
    ],
  });

  const HERO = [
    {
      slug: 'white-boxy-fit-for-men',
      title: 'Built for the everyday.',
      subtitle: 'Heavyweight cotton, cut boxy, made to keep its shape.',
      ctaLabel: 'Shop full sleeves',
      link: '/shop/category/men/full-sleeve-boxy-t-shirts/',
    },
    {
      slug: 'heavy-weight-black-tank-for-men',
      title: 'Four tanks. ₹999.',
      subtitle: 'Mix any four Summer Tanks. The discount applies in your bag.',
      ctaLabel: 'Shop tanks',
      link: '/shop/category/men/tank-tops/',
    },
    {
      slug: 'ultimate-grey-everyday-jogger',
      title: 'Move freely.',
      subtitle: 'Tapered joggers in a soft cotton blend, for the whole day.',
      ctaLabel: 'Shop joggers',
      link: '/shop/category/men/joggers/',
    },
  ];

  const OFFER_BANNERS = [
    {
      slug: 'black-spider-tank-for-men',
      title: 'Any 4 Summer Tanks at ₹999',
      subtitle: 'Applied automatically once four tanks are in your bag.',
      ctaLabel: 'Shop tanks',
      link: '/shop/category/men/tank-tops/',
    },
    {
      slug: 'grey-oversized-sweatshirt-for-men',
      title: 'Sweatshirts from ₹899',
      subtitle: 'Heavyweight fleece, cut relaxed.',
      ctaLabel: 'Shop sweatshirts',
      link: '/shop/category/men/sweatshirts/',
    },
    {
      slug: 'coffee-brown-everyday-jogger',
      title: '5% off every prepaid order',
      subtitle: 'Pay by UPI or card and the discount comes off at checkout.',
      ctaLabel: 'Start shopping',
      link: '/shop/category/men/joggers/',
    },
  ];

  const bannerRow = (
    entry: (typeof HERO)[number],
    placement: 'HOME' | 'OFFERS',
    sortOrder: number,
  ) => ({
    placement,
    image: galleryOf(entry.slug)[0],
    alt: entry.title,
    title: entry.title,
    subtitle: entry.subtitle,
    ctaLabel: entry.ctaLabel,
    link: entry.link,
    sortOrder,
  });

  await prisma.banner.createMany({
    data: [
      ...HERO.map((entry, index) => bannerRow(entry, 'HOME', index)),
      ...OFFER_BANNERS.map((entry, index) => bannerRow(entry, 'OFFERS', index)),
    ],
  });

  await prisma.menuItem.createMany({
    data: [
      // Only categories that actually hold items are linked, so no menu entry
      // leads to an empty listing.
      ...CATEGORIES.filter((category) => category.keyword).map(
        (category, sortOrder) => ({
          section: 'SHOP_BY_CATEGORY' as const,
          label: category.name,
          url: `/shop/category/men/${category.slug}/`,
          sortOrder,
        }),
      ),
      {
        section: 'SHOP_BY_STORE',
        label: '599 Store',
        url: '/store/599/',
        sortOrder: 0,
      },
      {
        section: 'SHOP_BY_STORE',
        label: '699 Store',
        url: '/store/699/',
        sortOrder: 1,
      },
      {
        section: 'LINKS',
        label: 'Bulk Orders Query',
        url: '/bulk-orders/',
        sortOrder: 0,
      },
      { section: 'LINKS', label: 'Offers', url: '/offers/', sortOrder: 1 },
    ],
  });

  await prisma.page.createMany({
    data: STATIC_PAGES.map(([slug, title]) => ({
      slug,
      title,
      body: `${title} content goes here. Edit it from the admin panel.`,
    })),
  });

  // First admin account. Left alone if it already exists, so re-seeding the
  // catalog never resets a password that was changed later.
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env');
  }
  const existingAdmin = await prisma.staffUser.findUnique({
    where: { email: adminEmail },
  });
  if (!existingAdmin) {
    await prisma.staffUser.create({
      data: {
        email: adminEmail,
        name: 'Owner',
        role: 'OWNER',
        passwordHash: await hashPassword(adminPassword),
      },
    });
    console.log(`Created owner account ${adminEmail}`);
  }

  const [products, images, variants] = await Promise.all([
    prisma.product.count(),
    prisma.productImage.count(),
    prisma.variant.count(),
  ]);
  console.log(
    `Seeded ${products} products, ${images} images, ${variants} variants`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
