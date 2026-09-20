import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { directDatabaseUrl } from '../src/prisma/database-url.js';

// Moves images that still live in the storefront's public folder into S3 and
// repoints the database at the bucket. Safe to re-run: rows already holding an
// absolute URL are skipped, and each key is derived from the file path, so a
// repeat run overwrites the same object instead of making a second copy.
//
//   npm run images:to-s3 -- --dry-run   # show what would be uploaded
//   npm run images:to-s3

const PUBLIC_DIR = fileURLToPath(
  new URL('../../storefront/public', import.meta.url),
);

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const dryRun = process.argv.includes('--dry-run');

const prisma = new PrismaClient({
  // Bulk writes bypass the pooler; see src/prisma/database-url.ts.
  adapter: new PrismaPg({ connectionString: directDatabaseUrl() }),
});

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name} in apps/api/.env — see docs/image-storage.md`,
    );
  }
  return value;
}

const isLocal = (url: string | null): url is string =>
  Boolean(url?.startsWith('/'));

// /seed/site-images/images/red-wings-tank-for-men/540/1772.jpg
//   -> products/red-wings-tank-for-men-1772.jpg
// /seed/site-images/images/banners/540/1155.jpg -> content/banners-1155.jpg
function keyFor(localPath: string, folder: string): string {
  const name = localPath
    .replace(/^\/seed\//, '')
    .split('/')
    .filter(
      (part) => !['site-images', 'images', 'shared', 'img'].includes(part),
    )
    // Drop the source width folders (360/, 540/): the width stops meaning
    // anything once Next.js resizes from the original.
    .filter((part) => !/^\d{3}$/.test(part))
    .join('-');
  return `${folder}/${name}`;
}

type Folder = 'products' | 'categories' | 'content';

interface Ref {
  localPath: string;
  folder: Folder;
  repoint: (url: string) => Promise<unknown>;
}

async function collectRefs(): Promise<Ref[]> {
  const refs: Ref[] = [];

  const images = await prisma.productImage.findMany({
    select: { id: true, url: true },
  });
  for (const image of images.filter((i) => isLocal(i.url))) {
    refs.push({
      localPath: image.url,
      folder: 'products',
      repoint: (url) =>
        prisma.productImage.update({ where: { id: image.id }, data: { url } }),
    });
  }

  const categories = await prisma.category.findMany({
    select: { id: true, image: true, sizeChart: true },
  });
  for (const category of categories) {
    if (isLocal(category.image)) {
      refs.push({
        localPath: category.image,
        folder: 'categories',
        repoint: (url) =>
          prisma.category.update({
            where: { id: category.id },
            data: { image: url },
          }),
      });
    }
    if (isLocal(category.sizeChart)) {
      refs.push({
        localPath: category.sizeChart,
        folder: 'categories',
        repoint: (url) =>
          prisma.category.update({
            where: { id: category.id },
            data: { sizeChart: url },
          }),
      });
    }
  }

  const banners = await prisma.banner.findMany({
    select: { id: true, image: true },
  });
  for (const banner of banners.filter((b) => isLocal(b.image))) {
    refs.push({
      localPath: banner.image,
      folder: 'content',
      repoint: (url) =>
        prisma.banner.update({
          where: { id: banner.id },
          data: { image: url },
        }),
    });
  }

  // Settings that hold an image path, such as the drawer promo image.
  for (const setting of await prisma.setting.findMany()) {
    const value = setting.value;
    if (typeof value === 'string' && isLocal(value)) {
      refs.push({
        localPath: value,
        folder: 'content',
        repoint: (url) =>
          prisma.setting.update({
            where: { key: setting.key },
            data: { value: url },
          }),
      });
    }
  }

  return refs;
}

async function main() {
  const refs = await collectRefs();
  if (refs.length === 0) {
    console.log('Nothing to do: every image already points at a URL.');
    return;
  }

  // One file can be referenced by several rows; upload it once.
  const files = new Map<string, { folder: Folder; refs: Ref[] }>();
  for (const ref of refs) {
    const entry = files.get(ref.localPath) ?? { folder: ref.folder, refs: [] };
    entry.refs.push(ref);
    files.set(ref.localPath, entry);
  }

  console.log(`${refs.length} references across ${files.size} files`);

  if (dryRun) {
    for (const [localPath, { folder }] of files) {
      console.log(`  ${localPath}\n    -> ${keyFor(localPath, folder)}`);
    }
    console.log('\nDry run: nothing uploaded, nothing changed.');
    return;
  }

  const bucket = required('S3_BUCKET');
  const publicUrl = required('S3_PUBLIC_URL').replace(/\/$/, '');
  const endpoint = process.env.S3_ENDPOINT;
  const client = new S3Client({
    region: required('AWS_REGION'),
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
  });

  let done = 0;
  for (const [localPath, { folder, refs: rows }] of files) {
    const extension = localPath.split('.').pop()!.toLowerCase();
    const contentType = CONTENT_TYPES[extension];
    if (!contentType)
      throw new Error(`${localPath}: unsupported image type .${extension}`);

    const key = keyFor(localPath, folder);
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: await readFile(`${PUBLIC_DIR}${localPath}`),
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    // The row is repointed only after its upload succeeds, so an interrupted
    // run leaves the rest on local files and can simply be run again.
    for (const ref of rows) await ref.repoint(`${publicUrl}/${key}`);

    done += 1;
    if (done % 25 === 0 || done === files.size)
      console.log(`  uploaded ${done}/${files.size}`);
  }

  console.log(`\nDone. ${refs.length} references now point at ${publicUrl}.`);
  console.log(
    'Set the same S3_PUBLIC_URL in apps/storefront/.env, then restart it.',
  );
}

main()
  .catch((error: Error) => {
    console.error(`\n${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
