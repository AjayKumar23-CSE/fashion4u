import Link from "next/link";
import { BannerCarousel } from "@/components/BannerCarousel";
import { CategoryGrid } from "@/components/CategoryGrid";
import { api } from "@/lib/api";

const PROMISES = [
  { title: "Free delivery over ₹999", note: "Dispatched within 48 hours, tracked all the way." },
  { title: "Cash on delivery", note: "Available on orders up to ₹5,000, anywhere in India." },
  { title: "7-day returns", note: "Changed your mind? Send it back, no questions asked." },
];

export default async function HomePage() {
  const home = await api.home();

  return (
    <main>
      <BannerCarousel banners={home.banners} />
      <CategoryGrid tiles={home.categoryTiles} />

      {/* One dark section gives the long light page a place to breathe. */}
      <section className="bg-ink px-6 py-24 text-center text-white md:py-32">
        <h2 className="mx-auto max-w-2xl text-headline font-semibold">
          Cotton that holds its shape, wash after wash.
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-body text-white/70">
          Cut for Indian weather, in weights that survive a real summer. Nothing you have to
          treat gently.
        </p>
        <Link
          href="/shop/category/men/tank-tops/"
          className="mt-8 inline-flex h-11 items-center rounded-full bg-white px-6 text-sm font-medium text-ink transition-transform hover:scale-[1.03]"
        >
          Shop the essentials
        </Link>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-3 md:py-28">
        {PROMISES.map((promise) => (
          <div key={promise.title} className="reveal">
            <h3 className="text-base font-semibold tracking-tight">{promise.title}</h3>
            <p className="mt-1.5 text-sm text-muted">{promise.note}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
