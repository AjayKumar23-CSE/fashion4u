import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { api } from "@/lib/api";
import { BRAND_NAME } from "@/lib/config";
import { QueryProvider } from "@/lib/query-provider";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: `${BRAND_NAME} — Everyday essentials`, template: `%s — ${BRAND_NAME}` },
  description:
    "Polos, tanks, tees and joggers cut for Indian weather. Free delivery over ₹999, cash on delivery across India.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [home, menu] = await Promise.all([api.home(), api.menu()]);

  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="flex min-h-full flex-col font-sans text-body">
        {home.announcement && <AnnouncementBar text={home.announcement} />}
        {/* Wraps the header too, which reads the bag count from the cache, but
            stops short of <html>/<body> so the static shell stays a server
            component. */}
        <QueryProvider>
          <Header menu={menu} />
          <div className="flex-1">{children}</div>
        </QueryProvider>
        <Footer />
      </body>
    </html>
  );
}
