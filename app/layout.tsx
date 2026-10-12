import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PageTransition } from "@/components/page-transition";
import { BRAND } from "@/lib/data";

const bodyFont = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

const displayFont = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const techFont = IBM_Plex_Mono({
  variable: "--font-tech",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://spockshop.com"),
  title: {
    default: "Spock's Resale Shop",
    template: "%s | Spock's Resale Shop",
  },
  description: BRAND.description,
  keywords: [
    "resale shop",
    "secondhand ecommerce",
    "curated thrift finds",
    "vintage collectibles",
  ],
  openGraph: {
    title: "Spock's Resale Shop",
    description: BRAND.description,
    siteName: "Spock's Resale Shop",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Spock's Resale Shop",
    description: BRAND.description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${bodyFont.variable} ${displayFont.variable} ${techFont.variable} h-full antialiased`}
    >
      <body className="brand-body min-h-full text-slate-900">
        <Providers>
          <PageTransition />
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-sm"
          >
            Skip to main content
          </a>
          <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <main
              id="main-content"
              className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 md:px-8 md:py-12"
            >
              {children}
            </main>
            <SiteFooter />
          </div>
        </Providers>
      </body>
    </html>
  );
}
