import type { Metadata } from "next";
import { ProductGrid } from "@/components/ProductGrid";
import { api } from "@/lib/api";

type Props = PageProps<"/store/[slug]">;

// Price-point stores: /store/599/, /store/699/
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${slug} Store` };
}

export default async function StorePage({ params }: Props) {
  const { slug } = await params;
  const list = await api.products({ collection: slug });
  return (
    <ProductGrid
      title={`Everything at ₹${slug}`}
      subtitle="One price, whatever you pick."
      list={list}
    />
  );
}
