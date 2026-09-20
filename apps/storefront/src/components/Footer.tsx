import Link from "next/link";
import { BRAND_NAME } from "@/lib/config";

const GROUPS = [
  {
    title: "Shop",
    links: [
      ["Summer Tanks", "/shop/category/men/tank-tops/"],
      ["Compression T-Shirts", "/shop/category/men/compression-t-shirts/"],
      ["Sweatshirts", "/shop/category/men/sweatshirts/"],
      ["Joggers", "/shop/category/men/joggers/"],
      ["Offers", "/offers/"],
    ],
  },
  {
    title: "Help",
    links: [
      ["Contact", "/contact/"],
      ["Shipping Policy", "/shipping-policy/"],
      ["Returns & Exchanges", "/returns/"],
      ["Bulk Orders", "/bulk-orders/"],
    ],
  },
  {
    title: "About",
    links: [
      ["About Us", "/about-us/"],
      ["Privacy Policy", "/privacy-policy/"],
      ["Terms & Conditions", "/terms-and-conditions/"],
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="mt-24 border-t border-hairline bg-surface text-xs text-muted">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <p className="text-sm font-semibold tracking-tight text-ink">{BRAND_NAME}</p>
            <p className="mt-2 max-w-xs leading-relaxed">
              Everyday essentials cut for Indian weather. Free delivery over ₹999, cash on
              delivery across India.
            </p>
          </div>

          {GROUPS.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2 className="font-semibold text-ink">{group.title}</h2>
              <ul className="mt-3 space-y-2.5">
                {group.links.map(([label, href]) => (
                  <li key={href}>
                    <Link href={href} className="transition-colors hover:text-ink">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <p className="mt-10 border-t border-hairline pt-6">
          © {new Date().getFullYear()} {BRAND_NAME}. Prices include GST.
        </p>
      </div>
    </footer>
  );
}
