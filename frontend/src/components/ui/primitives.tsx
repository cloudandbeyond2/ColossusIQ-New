import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/api/schemas";

/* ── Button ─────────────────────────────────────── */
type Variant = "primary" | "secondary" | "ghost" | "gold" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-brand-gradient text-white shadow-md shadow-brand/20 hover:brightness-110",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  gold: "bg-gold text-[#1b2233] hover:brightness-95 shadow-sm",
  danger: "bg-rose text-white hover:brightness-95",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center rounded-xl font-medium transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

/* ── Card ───────────────────────────────────────── */
export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-2xl border border-line bg-surface shadow-card", className)} {...props} />;
}

export function CardHeader({ title, subtitle, action, className }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-5 pt-5", className)}>
      <div className="min-w-0">
        <h3 className="font-sans text-[15px] font-semibold tracking-tight text-ink">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-sm text-ink-3">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-5", className)} {...props} />;
}

/* ── Badge ──────────────────────────────────────── */
export const toneClasses: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand",
  gold: "bg-gold-soft text-amber",
  teal: "bg-teal-soft text-teal",
  rose: "bg-rose-soft text-rose",
  amber: "bg-amber-soft text-amber",
  sky: "bg-sky-soft text-sky",
  neutral: "bg-surface-2 text-ink-2",
};
export const toneBar: Record<Tone, string> = {
  brand: "bg-brand",
  gold: "bg-gold",
  teal: "bg-teal",
  rose: "bg-rose",
  amber: "bg-amber",
  sky: "bg-sky",
  neutral: "bg-ink-3",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap shrink-0", toneClasses[tone], className)}>
      {children}
    </span>
  );
}

export { RoleBadge, toneForRole, getRoleConfig } from "./role-badge";

/** Picks a badge tone from common status words so list data needs no styling hints. */
export function toneForStatus(value: string): Tone {
  const v = value.toLowerCase();
  if (/(rejected|withdrawn|suspended|resigned|cancelled|revoked|closed|full|failed|missing|not enrolled|overdue)/.test(v)) return "rose";
  if (/(archived|retired)/.test(v)) return "neutral";
  if (/(enrolled|fee paid|active|approved|verified|completed|enabled|connected|paid|published|open|resolved|earned|high|good|none)/.test(v)) return "teal";
  if (/(offer sent|shortlisted)/.test(v)) return "sky";
  if (/(pending|draft|trial|pilot|limited|review|medium|in progress|scheduled|upcoming|onboarding|beta|improve|invited|on leave|enquiry)/.test(v)) return "amber";
  return "brand";
}

/* ── Progress ───────────────────────────────────── */
export function Progress({ value, tone = "brand", className, label }: { value: number; tone?: Tone; className?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-2", className)}
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-500", toneBar[tone])} style={{ width: `${v}%` }} />
    </div>
  );
}

export function toneForScore(v: number): Tone {
  if (v >= 75) return "teal";
  if (v >= 55) return "brand";
  if (v >= 40) return "amber";
  return "rose";
}

/** Rounded icon chip used on cards, KPIs and headers. */
export function IconChip({ children, tone = "brand", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <span className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-lg", toneClasses[tone], className)}>{children}</span>;
}

/* ── Misc ───────────────────────────────────────── */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent", className)}
      role="status"
      aria-label="Loading"
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-surface-2", className)} aria-hidden />;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wider text-ink-3">{eyebrow}</div> : null}
        <h1 className="text-2xl font-semibold text-ink sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1.5 max-w-3xl text-sm text-ink-2 sm:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="bg-notebook flex flex-col items-center justify-center rounded-xl border border-dashed border-line px-6 py-12 text-center">
      <p className="font-medium text-ink">{title}</p>
      {body ? <p className="mt-1 max-w-md text-sm text-ink-3">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Field({ label, htmlFor, hint, error, children }: { label: string; htmlFor: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-rose" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

export const inputClass =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-3 transition-colors hover:border-brand/30 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 disabled:opacity-60 aria-[invalid=true]:border-rose aria-[invalid=true]:ring-rose/10";

export const selectFilterClass =
  "rounded-xl border border-line bg-surface px-3 py-2 text-xs sm:text-sm text-ink transition-colors hover:border-brand/30 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 disabled:opacity-60 cursor-pointer";

