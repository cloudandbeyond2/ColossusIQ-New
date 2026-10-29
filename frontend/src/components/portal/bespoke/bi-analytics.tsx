"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart2,
  BookOpen,
  Briefcase,
  Users,
  Award,
  TrendingUp,
  RefreshCw,
  Lightbulb,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import { DashboardData } from "@/lib/api/schemas";
import type { Role } from "@/lib/auth/roles";
import { TemplateSkeleton } from "@/components/modules/shared";
import { LoadError } from "@/components/ui/load-error";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

// ── colour helpers ────────────────────────────────────────────────────────────

function toneText(tone?: string) {
  switch (tone) {
    case "teal":    return "text-teal-600 dark:text-teal-400";
    case "gold":    return "text-amber-500 dark:text-amber-400";
    case "sky":     return "text-sky-600 dark:text-sky-400";
    case "rose":    return "text-rose-600 dark:text-rose-400";
    case "amber":   return "text-amber-600 dark:text-amber-400";
    case "green":   return "text-emerald-600 dark:text-emerald-400";
    case "purple":  return "text-purple-600 dark:text-purple-400";
    case "neutral": return "text-ink-3";
    default:        return "text-brand-600 dark:text-brand-400";
  }
}

function toneBg(tone?: string) {
  switch (tone) {
    case "teal":   return "bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800";
    case "gold":   return "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800";
    case "sky":    return "bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800";
    case "rose":   return "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800";
    case "green":  return "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800";
    case "purple": return "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800";
    default:       return "bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800";
  }
}

function toneBar(tone?: string) {
  switch (tone) {
    case "teal":   return "bg-teal-500";
    case "gold":   return "bg-amber-400";
    case "sky":    return "bg-sky-500";
    case "rose":   return "bg-rose-500";
    case "green":  return "bg-emerald-500";
    case "purple": return "bg-purple-500";
    default:       return "bg-brand-500";
  }
}

function toneRing(tone?: string) {
  switch (tone) {
    case "teal":   return "#14b8a6";
    case "gold":   return "#f59e0b";
    case "sky":    return "#0ea5e9";
    case "rose":   return "#f43f5e";
    case "green":  return "#10b981";
    case "purple": return "#a855f7";
    default:       return "#6366f1";
  }
}

// ── SVG ring meter ────────────────────────────────────────────────────────────

function RingMeter({ pct, color, label, value }: {
  pct: number;
  color: string;
  label: string;
  value: string;
}) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(pct / 100, 1) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor"
          strokeWidth="8" className="text-surface-2" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={color}
          strokeWidth="8" strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round" transform="rotate(-90 40 40)" />
        <text x="40" y="44" textAnchor="middle"
          className="fill-ink-1 font-bold" fontSize="14">{value}</text>
      </svg>
      <span className="text-xs text-ink-3 text-center leading-tight max-w-[80px]">{label}</span>
    </div>
  );
}

// ── sparkline mini-bars ───────────────────────────────────────────────────────

function SparkBar({ data, seriesKey, color }: {
  data: Record<string, string | number>[];
  seriesKey: string;
  color: string;
}) {
  const values = data.map((d) => Number(d[seriesKey]) || 0);
  const max = values.reduce((a, b) => (b > a ? b : a), 1);
  return (
    <div className="flex items-end gap-0.5 h-10">
      {values.map((v, i) => (
        <div
          key={i}
          className={cn("flex-1 rounded-sm min-h-[2px]", color)}
          style={{ height: `${(v / max) * 100}%`, opacity: i === values.length - 1 ? 1 : 0.5 }}
        />
      ))}
    </div>
  );
}

// ── horizontal bar ────────────────────────────────────────────────────────────

function HBar({ label, value, max, color }: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-ink-2 truncate max-w-[180px]">{label}</span>
        <span className="text-ink-1 font-medium tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "academic",      label: "Academic",      icon: BookOpen },
  { id: "employability", label: "Employability",  icon: Briefcase },
  { id: "engagement",   label: "Engagement",     icon: Users },
  { id: "faculty",      label: "Faculty",        icon: Award },
] as const;
type TabId = typeof TABS[number]["id"];

const TAB_PREFIXES: Record<TabId, string[]> = {
  academic:      ["academic", "pass", "attendance", "result", "student", "cgpa", "gpa"],
  employability: ["employ", "placement", "offer", "package", "lpa", "hired", "recruit"],
  engagement:    ["engage", "active", "club", "event", "course", "quiz", "certif", "login"],
  faculty:       ["faculty", "staff", "ai", "skill", "development", "training", "load"],
};

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, delta, tone }: {
  label: string;
  value: string;
  delta?: string;
  tone?: string;
}) {
  const dNum = Number(String(delta ?? "0").replace(/[^0-9.-]/g, ""));
  return (
    <Card className={cn("p-4 border rounded-xl flex flex-col gap-1", toneBg(tone))}>
      <span className="text-xs text-ink-3 font-medium uppercase tracking-wide leading-tight">{label}</span>
      <span className={cn("text-2xl font-bold", toneText(tone))}>{value}</span>
      {delta && (
        <span className={cn("text-xs font-medium", dNum >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400")}>
          {delta}
        </span>
      )}
    </Card>
  );
}

// ── insight card ──────────────────────────────────────────────────────────────

function InsightCard({ text, tone }: { text: string; tone?: string }) {
  return (
    <div className={cn("rounded-xl border px-4 py-3 flex gap-3 items-start", toneBg(tone))}>
      <Lightbulb className={cn("w-4 h-4 mt-0.5 shrink-0", toneText(tone))} />
      <p className="text-sm text-ink-2 leading-relaxed">{text}</p>
    </div>
  );
}

// ── collapsible chart card ────────────────────────────────────────────────────

interface ChartDef {
  title: string;
  kind: string;
  tone?: string;
  xAxis?: string;
  yAxis?: string;
  series?: { key: string; label: string; color?: string }[];
  data?: Record<string, string | number>[];
}

function ChartCard({ chart }: { chart: ChartDef }) {
  const [open, setOpen] = useState(true);

  const xKey = chart.xAxis ?? "label";
  const series = chart.series?.length
    ? chart.series
    : [{ key: chart.yAxis ?? "value", label: chart.title, color: chart.tone }];
  const data = chart.data ?? [];

  const maxVal = series.reduce((topMax, s) => {
    const m = data.reduce((a, d) => {
      const v = Number(d[s.key]) || 0;
      return v > a ? v : a;
    }, 0);
    return m > topMax ? m : topMax;
  }, 1);

  const isBar = chart.kind === "bar";

  return (
    <Card className="rounded-xl border p-4 space-y-3">
      <button className="w-full flex items-center justify-between text-left" onClick={() => setOpen((o) => !o)}>
        <span className="text-sm font-semibold text-ink-1">{chart.title}</span>
        {open
          ? <ChevronUp className="w-4 h-4 text-ink-3" />
          : <ChevronDown className="w-4 h-4 text-ink-3" />}
      </button>

      {open && (
        <>
          {/* x-axis label row */}
          {data.length > 0 && !isBar && (
            <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)` }}>
              {data.map((d, i) => (
                <span key={i} className="text-center text-[10px] text-ink-3 truncate">{d[xKey]}</span>
              ))}
            </div>
          )}

          {/* sparklines for line / trend */}
          {!isBar && series.map((s) => (
            <div key={s.key} className="space-y-1">
              <div className="flex items-center gap-1.5">
                <div className={cn("w-2 h-2 rounded-full", toneBar(s.color ?? chart.tone))} />
                <span className="text-xs text-ink-3">{s.label}</span>
              </div>
              <SparkBar data={data} seriesKey={s.key} color={toneBar(s.color ?? chart.tone)} />
            </div>
          ))}

          {/* horizontal bars for bar kind */}
          {isBar && data.length > 0 && (
            <div className="space-y-2 pt-1">
              {data.map((d, i) => (
                <HBar
                  key={i}
                  label={String(d[xKey])}
                  value={Number(d[series[0]?.key ?? "value"]) || 0}
                  max={maxVal}
                  color={toneBar(chart.tone)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

// ── main component ────────────────────────────────────────────────────────────

interface Props { role: Role }

export function BiAnalyticsModule({ role: _role }: Props) {
  const [tab, setTab] = useState<TabId>("academic");

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["bi-analytics"],
    queryFn: () => apiFetch("/api/v1/modules/bi-analytics", DashboardData),
    staleTime: 5 * 60 * 1000,
  });

  const kpis    = useMemo(() => data?.kpis    ?? [], [data]);
  const charts  = useMemo(() => data?.charts  ?? [], [data]);
  const insights = useMemo(() => data?.insights ?? [], [data]);

  // filter KPIs and charts to current tab
  const filteredKpis = useMemo(() => {
    const prefixes = TAB_PREFIXES[tab];
    const matched = kpis.filter((k) =>
      prefixes.some((p) => k.label.toLowerCase().includes(p))
    );
    return matched.length > 0 ? matched : kpis.slice(0, 4);
  }, [kpis, tab]);

  const filteredCharts = useMemo(() => {
    const prefixes = TAB_PREFIXES[tab];
    const matched = charts.filter((c) =>
      prefixes.some((p) => c.title.toLowerCase().includes(p))
    );
    return matched.length > 0 ? matched : charts.slice(0, 2);
  }, [charts, tab]);

  // separate ring-meter KPIs (percentage values) from count KPIs
  const ringKpis = useMemo(() =>
    filteredKpis.filter((k) => {
      const s = String(k.value);
      return s.includes("%") || (Number(s.replace(/[^0-9.]/g, "")) <= 100 && s !== "0");
    }).slice(0, 5),
  [filteredKpis]);

  const countKpis = useMemo(() =>
    filteredKpis.filter((k) => !ringKpis.includes(k)),
  [filteredKpis, ringKpis]);

  // ── render ────────────────────────────────────────────────────────────────

  if (isLoading) return <TemplateSkeleton />;
  if (isError)   return (
    <LoadError
      message={String((error as Error)?.message ?? "Failed to load analytics.")}
      onRetry={() => refetch()}
    />
  );

  const empty = filteredKpis.length === 0 && filteredCharts.length === 0 && insights.length === 0;

  return (
    <div className="space-y-6 pb-8">

      {/* header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <h1 className="text-xl font-bold text-ink-1">Analytics & BI</h1>
          </div>
          <p className="text-sm text-ink-3">
            Live academic, employability, engagement and faculty KPIs across your institution.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="shrink-0"
        >
          <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
          <span className="ml-1.5 hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* tab bar */}
      <div className="flex gap-0 border-b border-surface-3 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
              tab === id
                ? "border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400"
                : "border-transparent text-ink-3 hover:text-ink-1"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ring meters */}
      {ringKpis.length > 0 && (
        <div className="flex flex-wrap justify-center gap-6 py-4 border rounded-xl bg-surface-1">
          {ringKpis.map((k, i) => {
            const raw = Number(String(k.value).replace(/[^0-9.]/g, ""));
            const tones = ["teal", "sky", "gold", "green", "purple", "rose"];
            const tone = k.tone ?? tones[i % tones.length];
            return (
              <RingMeter
                key={k.label}
                pct={raw}
                color={toneRing(tone)}
                label={k.label}
                value={String(k.value)}
              />
            );
          })}
        </div>
      )}

      {/* count KPI cards */}
      {countKpis.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {countKpis.map((k) => (
            <KpiCard
              key={k.label}
              label={k.label}
              value={String(k.value)}
              delta={k.delta}
              tone={k.tone}
            />
          ))}
        </div>
      )}

      {/* charts */}
      {filteredCharts.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xs font-semibold text-ink-3 uppercase tracking-wider">Trends</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredCharts.map((c, i) => (
              <ChartCard key={c.title ?? i} chart={c} />
            ))}
          </div>
        </div>
      )}

      {/* insights */}
      {insights.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-ink-3 uppercase tracking-wider">Insights</h2>
          <div className="space-y-2">
            {insights.map((ins, i) => (
              <InsightCard key={i} text={ins.text} tone={ins.tone} />
            ))}
          </div>
        </div>
      )}

      {/* empty state */}
      {empty && (
        <div className="text-center py-16 text-ink-3">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            No analytics data yet for this view. Data populates as students, faculty
            and placements are recorded across the institution.
          </p>
        </div>
      )}
    </div>
  );
}
