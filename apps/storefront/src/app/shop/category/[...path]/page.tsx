import type { Metadata } from "next";
import { ProductGrid } from "@/components/ProductGrid";
import { api, type ProductList } from "@/lib/api";
import { orNotFound } from "@/lib/or-not-found";

type Props = PageProps<"/shop/category/[...path]">;

// "Men - Regular Polos", as on the reference listing.
function listingTitle(list: ProductList): string {
  const category = list.category!;
  return category.parent ? `${category.parent} - ${category.name}` : category.name;
}

async function loadListing({ params, searchParams }: Props) {
  const [{ path }, query] = await Promise.all([params, searchParams]);
  const pick = (key: string) => (typeof query[key] === "string" ? query[key] : undefined);

  return orNotFound(
    api.products({
      category: path.join("/"),
      size: pick("size"),
      colour: pick("colour"),
      fabric: pick("fabric"),
      fit: pick("fit"),
      sort: pick("sort"),
      page: pick("page"),
    }),
  );
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const list = await loadListing(props);
  return { title: listingTitle(list), alternates: { canonical: `/shop/category/${list.category!.path}/` } };
}

export default async function CategoryPage(props: Props) {
  const list = await loadListing(props);
  return (
    <ProductGrid title={list.category!.name} subtitle={list.category!.blurb} list={list} />
  );
}
