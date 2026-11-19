import { cn } from "@/lib/utils";

/** Original crest mark: a shield with an open book and a rising "IQ" spark. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9", className)} aria-hidden>
      <path d="M20 2 35 8v11c0 9.5-6.3 16.4-15 19-8.7-2.6-15-9.5-15-19V8L20 2Z" fill="var(--brand)" />
      <path d="M20 5.5 32 10.3v8.8c0 7.7-5 13.4-12 15.7-7-2.3-12-8-12-15.7v-8.8L20 5.5Z" fill="none" stroke="var(--gold)" strokeWidth="1.2" opacity=".9" />
      <path d="M11 22.5c3.2-1.4 6.2-1.2 9 .8 2.8-2 5.8-2.2 9-.8v-8.2c-3.2-1.4-6.2-1.2-9 .8-2.8-2-5.8-2.2-9-.8v8.2Z" fill="#fff" opacity=".95" />
      <path d="M20 15.1v8.2" stroke="var(--brand)" strokeWidth="1.1" />
      <circle cx="20" cy="10.2" r="2" fill="var(--gold)" />
    </svg>
  );
}

export function Logo({ className, compact = false, light = false }: { className?: string; compact?: boolean; light?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {compact ? null : (
        <span className="leading-none">
          <span className={cn("block text-lg font-semibold tracking-tight", light ? "text-white" : "text-ink")}>
            Colossus<span className="text-gold">IQ</span>
            <span className={light ? "text-white/60" : "text-ink-3"}>.ai</span>
          </span>
          <span className={cn("mt-0.5 block text-[10px] font-medium uppercase tracking-[0.18em]", light ? "text-white/55" : "text-ink-3")}>Higher-Education OS</span>
        </span>
      )}
    </span>
  );
}
