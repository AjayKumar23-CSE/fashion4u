"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Banner } from "@/lib/api";

const AUTO_SLIDE_MS = 6000;

// The words live in the database, not inside the image, so a slide is a
// photograph with type set over it: editable, translatable, and readable to a
// screen reader or a crawler.
export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const goTo = (index: number) => {
    const track = trackRef.current;
    if (track) track.scrollTo({ left: index * track.clientWidth, behavior: "smooth" });
  };

  useEffect(() => {
    if (banners.length < 2) return;
    const timer = setInterval(() => goTo((active + 1) % banners.length), AUTO_SLIDE_MS);
    return () => clearInterval(timer);
  }, [active, banners.length]);

  if (banners.length === 0) return null;

  return (
    <section className="relative" aria-roledescription="carousel" aria-label="Featured">
      <div
        ref={trackRef}
        onScroll={(e) =>
          setActive(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))
        }
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {banners.map((banner, index) => (
          <article
            key={banner.id}
            className="w-full shrink-0 snap-center md:grid md:grid-cols-2 md:items-center md:bg-surface"
          >
            {/* Product photography is portrait, so on a wide screen the image
                keeps its shape beside the text instead of being cropped into a
                letterbox. On a phone the text sits over it. */}
            <div className="relative aspect-[4/5] md:order-2 md:aspect-[5/6]">
              <Image
                src={banner.image}
                alt={banner.alt}
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                preload={index === 0}
                className="object-cover object-top"
              />
              <div className="absolute inset-x-0 top-0 h-3/5 bg-gradient-to-b from-black/55 to-transparent md:hidden" />
              <div className="absolute inset-x-0 top-0 px-6 pt-10 text-center text-white md:hidden">
                <Copy banner={banner} />
              </div>
            </div>

            <div className="hidden md:block md:px-16 md:py-20">
              <Copy banner={banner} />
            </div>
          </article>
        ))}
      </div>

      {banners.length > 1 && (
        <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1 md:bottom-6">
          {banners.map((banner, index) => (
            <button
              key={banner.id}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Show slide ${index + 1}`}
              aria-current={index === active}
              className="flex h-11 w-7 items-end justify-center pb-2"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  index === active
                    ? "bg-white md:bg-ink"
                    : "bg-white/45 md:bg-ink/25"
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

// Same words in both layouts: white over the photo on a phone, dark beside it
// on a desktop.
function Copy({ banner }: { banner: Banner }) {
  return (
    <>
      <h2 className="text-display font-semibold md:text-ink">{banner.title ?? banner.alt}</h2>
      {banner.subtitle && (
        <p className="mx-auto mt-3 max-w-md text-body text-white/90 md:mx-0 md:mt-5 md:text-muted">
          {banner.subtitle}
        </p>
      )}
      <Link
        href={banner.link}
        className="mt-6 inline-flex h-11 items-center rounded-full bg-white px-6 text-sm font-medium text-ink transition-transform hover:scale-[1.03] md:mt-8 md:bg-ink md:text-white"
      >
        {banner.ctaLabel ?? "Shop now"}
      </Link>
    </>
  );
}
