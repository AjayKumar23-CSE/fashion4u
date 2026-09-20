"use client";

import Link from "next/link";
import type { MenuContent, MenuLink } from "@/lib/api";
import { useUiStore } from "@/lib/ui-store";
import { CloseIcon } from "./icons";

function Section({ title, links }: { title: string; links: MenuLink[] }) {
  const closeMenu = useUiStore((state) => state.closeMenu);
  if (links.length === 0) return null;
  return (
    <section className="border-b border-hairline py-4">
      <h2 className="px-6 pb-1 text-xs text-muted">{title}</h2>
      <ul>
        {links.map((link) => (
          <li key={link.id}>
            <Link href={link.url} onClick={closeMenu} className="flex min-h-11 items-center px-6 text-[15px]">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DrawerMenu({ menu }: { menu: MenuContent }) {
  const open = useUiStore((state) => state.menuOpen);
  const closeMenu = useUiStore((state) => state.closeMenu);

  return (
    <div className={`fixed inset-0 z-40 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open} inert={!open}>
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
        onClick={closeMenu}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={`absolute inset-y-0 left-0 flex w-[82%] max-w-sm flex-col overflow-y-auto bg-white transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          type="button"
          onClick={closeMenu}
          aria-label="Close menu"
          className="absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/90"
        >
          <CloseIcon />
        </button>

        <p className="px-6 pb-4 pt-6 text-sm font-semibold tracking-tight">Shop</p>

        <Section title="Shop By Category" links={menu.shopByCategory} />
        <Section title="Shop By Store" links={menu.shopByStore} />
        <Section title="More" links={menu.links} />

        <Link href="/account/" onClick={closeMenu} className="flex min-h-11 items-center px-6 py-3 text-[15px]">
          Login
        </Link>
      </aside>
    </div>
  );
}
