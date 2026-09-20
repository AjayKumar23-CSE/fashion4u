import type { Metadata } from "next";
import { api } from "@/lib/api";
import { orNotFound } from "@/lib/or-not-found";

type Props = PageProps<"/[pageSlug]">;

// Static pages edited from admin: /about-us/, /contact/, /shipping-policy/,
// /returns/, /privacy-policy/, /terms-and-conditions/
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pageSlug } = await params;
  const page = await orNotFound(api.page(pageSlug));
  return { title: page.title };
}

export default async function StaticPage({ params }: Props) {
  const { pageSlug } = await params;
  const page = await orNotFound(api.page(pageSlug));

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 md:py-16">
      <h1 className="text-headline font-semibold">{page.title}</h1>
      <p className="mt-6 whitespace-pre-line leading-relaxed text-muted">{page.body}</p>
    </main>
  );
}
