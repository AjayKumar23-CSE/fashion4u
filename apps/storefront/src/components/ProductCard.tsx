import Image from "next/image";
import Link from "next/link";
import type { ProductCardData } from "@/lib/api";
import { formatPrice } from "@/lib/format";

// The photograph carries the card. Price is stated once, plainly; the saving
// is mentioned in words rather than shouted from a badge.
export function ProductCard({ product }: { product: ProductCardData }) {
  return (
    <article className="group">
      <Link href={`/product/${product.slug}/`} className="block">
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-surface">
          {product.image && (
            <Image
              src={product.image.url}
              alt={product.image.alt}
              fill
              sizes="(min-width: 768px) 25vw, 50vw"
              className={`object-cover transition-transform duration-500 group-hover:scale-[1.04] ${
                product.soldOut ? "opacity-50" : ""
              }`}
            />
          )}
          {product.soldOut && (
            <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-muted">
              Sold out
            </span>
          )}
        </div>

        <div className="pt-3">
          <h3 className="truncate text-sm font-medium tracking-tight">{product.name}</h3>
          {product.fabricTag && (
            <p className="mt-0.5 text-xs text-muted">{product.fabricTag}</p>
          )}
          <p className="mt-1.5 text-sm">
            <span className="font-medium">{formatPrice(product.salePrice)}</span>
            {product.discountPercent > 0 && (
              <>
                <s className="ml-2 text-muted">{formatPrice(product.mrp)}</s>
                <span className="ml-2 text-sale">{product.discountPercent}% off</span>
              </>
            )}
          </p>
        </div>
      </Link>
    </article>
  );
}
