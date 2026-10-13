import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { hasAdminSession } from "@/lib/auth/session";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BottomNav } from "@/components/bottom-nav";
import { CartDrawer } from "@/components/cart-drawer";
import { communitySellersEnabled } from "@/lib/features";

// Feature flags and Stripe keys are read at request time, not baked in at build.
export const dynamic = "force-dynamic";

const bodyFont = Inter({ variable: "--font-body", subsets: ["latin"] });
const displayFont = Space_Grotesk({ variable: "--font-display", subsets: ["latin"] });

const DESCRIPTION = "Spock's Resale Shop: one-of-a-kind secondhand finds from Bentonville, Arkansas, plus Amazon picks we recommend.";

export const metadata: Metadata = {
  metadataBase: new URL("https://spockshop.com"),
  title: { default: "Spock's Resale Shop", template: "%s | Spock's Resale Shop" },
  description: DESCRIPTION,
  openGraph: { title: "Spock's Resale Shop", description: DESCRIPTION, siteName: "Spock's Resale Shop", type: "website", locale: "en_US" },
  twitter: { card: "summary_large_image", title: "Spock's Resale Shop", description: DESCRIPTION },
};

export const viewport: Viewport = { themeColor: "#04060d", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const isAdmin = await hasAdminSession();
  return (
    <html lang="en" className={`${bodyFont.variable} ${displayFont.variable} antialiased`}>
      <body className="min-h-dvh">
        <div className="space-backdrop" aria-hidden />
        <Providers>
          <a href="#main-content" className="sr-only-focusable fixed left-4 top-3 z-50 rounded-full bg-[var(--gold)] px-4 py-2 font-semibold text-[var(--on-gold)]">Skip to content</a>
          <div className="has-bottom-nav flex min-h-dvh flex-col">
            <SiteHeader isAdmin={isAdmin} />
            <main id="main-content" className="container-x flex-1 py-6 md:py-10">{children}</main>
            <SiteFooter />
          </div>
          <BottomNav sellersEnabled={communitySellersEnabled()} isAdmin={isAdmin} />
          <CartDrawer />
        </Providers>
      </body>
    </html>
  );
}
