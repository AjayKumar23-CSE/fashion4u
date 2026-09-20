import type { ProductList } from "@/lib/api";
import { ProductCard } from "./ProductCard";

export function ProductGrid({
  title,
  subtitle,
  list,
}: {
  title: string;
  subtitle?: string | null;
  list: ProductList;
}) {
  return (
    <main className="mx-auto w-full max-w-6xl px-6">
      <header className="py-12 md:py-16">
        <h1 className="text-headline font-semibold">{title}</h1>
        {subtitle && <p className="mt-2 max-w-lg text-muted">{subtitle}</p>}
        <p className="mt-3 text-sm text-muted">
          {list.total} {list.total === 1 ? "item" : "items"}
        </p>
      </header>

      {list.items.length === 0 ? (
        <p className="py-24 text-center text-muted">Nothing here yet.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-x-5 gap-y-12 md:grid-cols-4">
          {list.items.map((product) => (
            <li key={product.id} className="reveal">
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
