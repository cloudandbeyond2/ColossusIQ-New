"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export interface NavLinkItem {
  href: string;
  label: string;
}

export function MarketingDesktopNav({ links }: { links: NavLinkItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-1 xl:flex" aria-label="Main">
      {links.map((l) => {
        const isActive = pathname === l.href || (l.href !== "/" && pathname.startsWith(`${l.href}/`));
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-brand-soft font-semibold text-brand shadow-xs ring-1 ring-brand/10 dark:ring-brand/25"
                : "text-ink-2 hover:bg-surface-2 hover:text-ink"
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MarketingNav({ links }: { links: NavLinkItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  const isLinkActive = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

  return (
    <div className="xl:hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg p-2 text-ink-2 hover:bg-surface-2"
        aria-expanded={open}
        aria-label="Menu"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>
      {open ? (
        <nav className="absolute inset-x-0 top-16 border-b border-line bg-surface px-4 py-3 shadow-card" aria-label="Mobile">
          {[...links, { href: "/login", label: "Sign in" }].map((l) => {
            const active = isLinkActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-brand-soft font-semibold text-brand ring-1 ring-brand/10 dark:ring-brand/25"
                    : "text-ink hover:bg-surface-2"
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}

