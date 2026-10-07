import type { Metadata, Viewport } from "next";
import { Fraunces, Great_Vibes, JetBrains_Mono, Poppins } from "next/font/google";
import { cookies, headers } from "next/headers";
import { Providers } from "@/components/providers";
import { isLang } from "@/lib/i18n/dict";
import { ServiceWorkerRegister } from "@/components/sw-register";
// Flaticon UIcons — self-hosted icon fonts (regular + solid rounded). Credit: https://www.flaticon.com/uicons
import "@flaticon/flaticon-uicons/css/regular/rounded.css";
import "@flaticon/flaticon-uicons/css/solid/rounded.css";
import "./globals.css";

const poppins = Poppins({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-poppins", display: "swap" });
// Editorial display serif (variable optical size + softness) and a mono for labels, IDs and numbers.
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", style: ["normal", "italic"], axes: ["opsz", "SOFT"] });
// Signature script on certificates when the Principal has not uploaded a signature image.
const script = Great_Vibes({ subsets: ["latin"], weight: "400", variable: "--font-script", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap", weight: ["400", "500"] });

export const metadata: Metadata = {
  title: { default: "CollossusIQ.ai — AI-native Higher Education OS", template: "%s · CollossusIQ.ai" },
  description:
    "One AI platform for every student, faculty member, department and campus: learning, assessment, projects, careers and institutional intelligence.",
  applicationName: "CollossusIQ.ai",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon.svg" },
  formatDetection: { telephone: false, email: false, address: false },
  referrer: "strict-origin-when-cross-origin",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1e2a5a" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1320" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading headers makes every page dynamic so the per-request CSP nonce is applied to Next's scripts.
  await headers();
  const store = await cookies();
  const langCookie = store.get("ciq_lang")?.value;
  const lang = isLang(langCookie) ? langCookie : "en";
  const theme = store.get("ciq_theme")?.value === "dark" ? "dark" : "light";

  return (
    <html lang={lang} className={`${poppins.variable} ${fraunces.variable} ${script.variable} ${mono.variable} ${theme === "dark" ? "dark" : ""}`} suppressHydrationWarning>
      <body className="min-h-dvh" suppressHydrationWarning>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:shadow-card"
        >
          Skip to content
        </a>
        <Providers initialLang={lang} initialTheme={theme}>
          {children}
        </Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
