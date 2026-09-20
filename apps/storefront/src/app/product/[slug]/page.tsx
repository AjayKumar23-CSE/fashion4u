import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AddToBag } from "@/components/AddToBag";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { orNotFound } from "@/lib/or-not-found";

type Props = PageProps<"/product/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await orNotFound(api.product(slug));
  return {
    title: product.seoTitle ?? product.name,
    description: product.seoDescription ?? product.description,
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await orNotFound(api.product(slug));

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8 md:py-14">
      <div className="grid gap-10 md:grid-cols-2 md:gap-16">
        <div className="-mx-6 md:mx-0">
          {/* Swipe on a phone, a stacked column on a desktop. */}
          <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-6 [scrollbar-width:none] md:flex-col md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
            {product.images.map((image, index) => (
              <div
                key={image.id}
                className="relative aspect-[4/5] w-[85%] shrink-0 snap-center overflow-hidden rounded-2xl bg-surface md:w-full"
              >
                <Image
                  src={image.url}
                  alt={image.alt}
                  fill
                  sizes="(min-width: 768px) 50vw, 85vw"
                  preload={index === 0}
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="md:sticky md:top-20 md:self-start md:py-4">
          <Link href={`/shop/category/${product.category.path}/`} className="text-xs text-muted hover:text-ink">
            {product.category.name}
          </Link>
          <h1 className="mt-2 text-headline font-semibold">{product.name}</h1>

          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-xl font-medium">{formatPrice(product.salePrice)}</span>
            {product.discountPercent > 0 && (
              <>
                <s className="text-muted">{formatPrice(product.mrp)}</s>
                <span className="text-sm text-sale">{product.discountPercent}% off</span>
              </>
            )}
          </div>
          <p className="mt-1 text-xs text-muted">Inclusive of all taxes</p>

          <AddToBag variants={product.variants} />

          {product.sizeChart && (
            <details className="mt-6 border-t border-hairline pt-4 text-sm">
              <summary className="flex min-h-11 cursor-pointer items-center text-link">
                Size chart
              </summary>
              <Image
                src={product.sizeChart}
                alt={`Size chart for ${product.category.name}`}
                width={904}
                height={804}
                className="mt-3 h-auto w-full rounded-xl"
              />
            </details>
          )}

          <div className="mt-6 border-t border-hairline pt-6 text-sm leading-relaxed text-muted">
            <p>{product.description}</p>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
              {product.fabricTag && (
                <>
                  <dt>Fabric</dt>
                  <dd className="text-ink">{product.fabricTag}</dd>
                </>
              )}
              {product.fit && (
                <>
                  <dt>Fit</dt>
                  <dd className="text-ink">{product.fit}</dd>
                </>
              )}
            </dl>
          </div>
        </div>
      </div>
    </main>
  );
}
