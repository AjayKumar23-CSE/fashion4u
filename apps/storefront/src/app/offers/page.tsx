import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { api } from "@/lib/api";

export const metadata: Metadata = { title: "Offers" };

export default async function OffersPage() {
  const offers = await api.offers();

  return (
    <main className="mx-auto w-full max-w-6xl px-6">
      <header className="py-12 md:py-16">
        <h1 className="text-headline font-semibold">Offers</h1>
        <p className="mt-2 max-w-lg text-muted">
          Bundle savings apply on their own in your bag — there is no code to remember.
        </p>
      </header>

      <ul className="grid gap-6 md:grid-cols-3">
        {offers.banners.map((banner) => (
          <li key={banner.id} className="reveal">
            <Link href={banner.link} className="group block">
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-surface">
                <Image
                  src={banner.image}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 33vw, 100vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
              </div>
              <h2 className="mt-4 text-base font-semibold tracking-tight">
                {banner.title ?? banner.alt}
              </h2>
              {banner.subtitle && <p className="mt-1 text-sm text-muted">{banner.subtitle}</p>}
              <span className="mt-2 inline-block text-sm text-link">
                {banner.ctaLabel ?? "Shop now"} →
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {offers.bundles.length > 0 && (
        <section className="mt-20 rounded-2xl bg-surface p-8">
          <h2 className="text-base font-semibold tracking-tight">Applied automatically</h2>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            {offers.bundles.map((bundle) => (
              <li key={bundle.id}>{bundle.name}</li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
