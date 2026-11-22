import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed, Martian_Mono, Spectral } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { AppShell } from "@/components/shell/AppShell";
import "./globals.css";

const sans = Barlow({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-barlow", display: "swap" });
const display = Barlow_Condensed({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-barlow-condensed", display: "swap" });
const serif = Spectral({ subsets: ["latin"], weight: ["400", "500"], style: ["italic", "normal"], variable: "--font-spectral", display: "swap" });
const mono = Martian_Mono({ subsets: ["latin"], variable: "--font-martian", display: "swap" });

export const metadata: Metadata = {
  title: { default: "OneAtlas - a survey of machine intelligence", template: "%s · OneAtlas" },
  description: "Discover, compare and evaluate 470+ AI models across labs and providers, with explainable scoring, provider price comparison and a live change ledger.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ebe4d1" },
    { media: "(prefers-color-scheme: dark)", color: "#14110d" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable} ${display.variable} ${serif.variable}`}>
      <head>
        {/* mark return visits / reduced motion / automation before paint so the survey loader never flashes */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(sessionStorage.getItem('oneatlas.surveyed')||navigator.webdriver||matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.dataset.surveyed='1'}}catch(e){}`,
          }}
        />
      </head>
      <body>
        {/* next-themes injects a blocking script that sets the class before paint: no theme flash */}
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange storageKey="oneatlas.theme">
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
