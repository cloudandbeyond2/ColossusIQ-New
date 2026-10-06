"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { ModuleDef } from "@/config/modules";
import type { Role } from "@/lib/auth/roles";
import { Notice } from "@/components/ui/notices";
import { Fi, ModuleIcon } from "@/components/ui/icon";
import { usePrefs } from "@/components/providers";
import { tGroup, tModule } from "@/lib/i18n/dict";

export function ModuleHeader({
  mod,
  role,
  actions,
  crumbs = [],
  title,
  description,
}: {
  mod: ModuleDef;
  role: Role;
  actions?: ReactNode;
  /** Extra breadcrumb levels for inner pages (e.g. "New application"). */
  crumbs?: Array<{ label: string; href?: string }>;
  title?: string;
  description?: string;
}) {
  const { t, lang } = usePrefs();
  const localizedGroup = tGroup(mod.group, lang);
  const localizedTitle = title ?? tModule(mod.slug, mod.title, lang);
  const trail = [
    { label: t("nav.home"), href: `/${role}` },
    { label: localizedGroup },
    { label: localizedTitle, href: crumbs.length ? `/${role}/${mod.slug}` : undefined },
    ...crumbs,
  ];

  return (
    <>
      <section className="bg-hero-glow relative mb-6 overflow-hidden rounded-3xl px-5 py-6 text-white shadow-lg shadow-brand/20 sm:px-8 sm:py-7">
        <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:28px_28px]" aria-hidden />
        <ModuleIcon name={mod.icon} className="pointer-events-none absolute -bottom-6 right-4 text-[140px] text-white/[0.06]" />
        <nav aria-label="Breadcrumb" className="relative mb-4 flex flex-wrap items-center gap-1.5 text-xs text-white/65">
          {trail.map((c, i) => (
            <span key={`${c.label}-${i}`} className="inline-flex items-center gap-1.5">
              {i > 0 ? <Fi name="angle-small-right" className="text-[11px] text-white/40" /> : null}
              {c.href ? (
                <Link href={c.href} className="hover:text-white hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span className={i === trail.length - 1 ? "font-medium text-white" : ""} aria-current={i === trail.length - 1 ? "page" : undefined}>
                  {c.label}
                </span>
              )}
            </span>
          ))}
        </nav>
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-2xl text-gold ring-1 ring-white/20 backdrop-blur">
              <ModuleIcon name={mod.icon} solid />
            </span>
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-white/85">{localizedGroup}</span>
                <span className={mod.phase === "MVP" ? "rounded-full bg-teal/90 px-2.5 py-0.5 text-[11px] font-semibold text-white" : "rounded-full bg-gold/90 px-2.5 py-0.5 text-[11px] font-semibold text-[#1b2233]"}>
                  {mod.phase}
                </span>
              </div>
              <h1 className="text-2xl font-semibold leading-tight sm:text-[28px]">{localizedTitle}</h1>
              <p className="mt-1.5 max-w-3xl text-sm text-white/75 sm:text-[15px]">{description ?? mod.description}</p>
            </div>
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </div>
      </section>
      {mod.notice ? (
        <Notice tone="amber" className="mb-6">
          {mod.notice}
        </Notice>
      ) : null}
    </>
  );
}
