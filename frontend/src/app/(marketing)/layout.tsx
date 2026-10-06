import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { LinkButton } from "@/components/ui/primitives";
import { MarketingDesktopNav, MarketingNav } from "@/components/marketing/nav";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const LINKS = [
  { href: "/modules", label: "Platform" },
  { href: "/agents", label: "AI Agents" },
  { href: "/colleges", label: "Colleges" },
  { href: "/apply", label: "Admissions" },
  { href: "/pricing", label: "Pricing" },
  { href: "/security", label: "Security" },
  { href: "/contact", label: "Contact" },
];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="marketing flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" aria-label="CollossusIQ home">
            <Logo />
          </Link>
          <MarketingDesktopNav links={LINKS} />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LinkButton href="/login" variant="ghost" size="sm" className="max-sm:hidden">
              Sign in
            </LinkButton>
            <LinkButton href="/apply" size="sm" variant="gold" className="max-sm:hidden">
              Apply now
            </LinkButton>
            <LinkButton href="/contact" size="sm" className="max-sm:hidden">
              Book a demo
            </LinkButton>
            <MarketingNav links={LINKS} />
          </div>
        </div>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo />
            <p className="mt-4 max-w-sm text-sm text-ink-2">One AI platform for every student, every faculty member, every department and every campus.</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Product</p>
            <ul className="mt-3 space-y-2 text-sm text-ink-2">
              {LINKS.slice(0, 3).map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-brand">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Trust</p>
            <ul className="mt-3 space-y-2 text-sm text-ink-2">
              <li>
                <Link href="/security" className="hover:text-brand">
                  Security & AI governance
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-brand">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="border-t border-line py-5 text-center text-xs text-ink-3">
          © {new Date().getFullYear()} CollossusIQ.ai · Made for Indian higher education
        </p>
      </footer>
    </div>
  );
}
