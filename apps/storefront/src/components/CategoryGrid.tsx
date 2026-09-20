import Image from "next/image";
import Link from "next/link";
import type { CategoryTile } from "@/lib/api";

// Photograph, name, one line of why. No text burned into the artwork, so the
// same photo works anywhere and the words stay editable.
export function CategoryGrid({ tiles }: { tiles: CategoryTile[] }) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
      <h2 className="text-headline font-semibold">Find your fit.</h2>

      <ul className="mt-10 grid grid-cols-2 gap-x-5 gap-y-12 md:grid-cols-3">
        {tiles.map((tile) => (
          <li key={tile.id} className="reveal">
            <Link href={tile.url} className="group block">
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-surface">
                {tile.image && (
                  <Image
                    src={tile.image}
                    alt=""
                    fill
                    sizes="(min-width: 768px) 33vw, 50vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                )}
              </div>
              <h3 className="mt-4 text-base font-semibold tracking-tight">{tile.name}</h3>
              {tile.blurb && <p className="mt-1 text-sm text-muted">{tile.blurb}</p>}
              <span className="mt-2 inline-block text-sm text-link">Shop →</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
