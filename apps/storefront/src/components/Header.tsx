"use client";

import Link from "next/link";
import type { MenuContent } from "@/lib/api";
import { useBagCount } from "@/lib/cart-queries";
import { BRAND_NAME } from "@/lib/config";
import { useUiStore } from "@/lib/ui-store";
import { DrawerMenu } from "./DrawerMenu";
import { AccountIcon, BagIcon, MenuIcon, SearchIcon } from "./icons";

const iconLink = "flex h-11 w-10 items-center justify-center text-ink/80 hover:text-ink";

export function Header({ menu }: { menu: MenuContent }) {
  const openMenu = useUiStore((state) => state.openMenu);
  const bagCount = useBagCount();
  const categories = menu.shopByCategory.slice(0, 5);

  return (
    <>
      {/* Translucent and thin, so the page scrolls under it rather than
          being pushed down by it. */}
      <header className="sticky top-0 z-30 border-b border-hairline bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-12 max-w-6xl items-center px-2 md:px-6">
          <button
            type="button"
            className={`${iconLink} md:hidden`}
            aria-label="Open menu"
            onClick={openMenu}
          >
            <MenuIcon width={20} height={20} />
          </button>

          <Link
            href="/"
            className="px-2 text-[15px] font-semibold tracking-tight md:pl-0 md:pr-8"
          >
            {BRAND_NAME}
          </Link>

          {/* On wider screens the categories sit inline, the way a desktop
              store is browsed; on a phone they live in the drawer. */}
          <nav className="hidden flex-1 items-center gap-7 md:flex" aria-label="Categories">
            {categories.map((link) => (
              <Link
                key={link.id}
                href={link.url}
                className="text-xs text-ink/80 transition-colors hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center">
            <Link href="/search" className={iconLink} aria-label="Search">
              <SearchIcon width={18} height={18} />
            </Link>
            <Link href="/account/" className={iconLink} aria-label="Account">
              <AccountIcon width={18} height={18} />
            </Link>
            <Link
              href="/bag/"
              className={`${iconLink} relative`}
              aria-label={bagCount > 0 ? `Bag, ${bagCount} ${bagCount === 1 ? "item" : "items"}` : "Bag"}
            >
              <BagIcon width={18} height={18} />
              {bagCount > 0 && (
                <span className="absolute right-0.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-semibold tabular-nums text-white">
                  {bagCount > 9 ? "9+" : bagCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>
      <DrawerMenu menu={menu} />
    </>
  );
}
