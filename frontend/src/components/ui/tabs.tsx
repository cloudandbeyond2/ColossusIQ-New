"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A row of tabs (pill style) with an optional count badge on each. */
export function Tabs<T extends string>({ tabs, value, onChange, className, label }: { tabs: Array<{ id: T; label: ReactNode; count?: number; icon?: ReactNode }>; value: T; onChange: (id: T) => void; className?: string; label: string }) {
  return (
    <div role="tablist" aria-label={label} className={cn("flex flex-wrap gap-1 rounded-2xl border border-line bg-surface p-1", className)}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn("inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition", value === t.id ? "bg-brand text-white shadow-sm" : "text-ink-2 hover:bg-surface-2 hover:text-ink")}
        >
          {t.icon}
          {t.label}
          {t.count ? <span className={cn("rounded-full px-1.5 text-[11px] font-semibold", value === t.id ? "bg-white/25 text-white" : "bg-brand-soft text-brand")}>{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** A compact segmented choice (e.g. priority or audience). */
export function Segmented<T extends string>({ options, value, onChange, label, id }: { options: Array<{ id: T; label: string; tone?: string }>; value: T; onChange: (v: T) => void; label: string; id?: string }) {
  return (
    <div id={id} role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-surface-2/50 p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn("rounded-lg px-3 py-1.5 text-sm transition", value === o.id ? cn("bg-surface font-medium text-ink shadow-sm ring-1 ring-line", o.tone) : "text-ink-3 hover:text-ink")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
