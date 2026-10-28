"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  UserCheck,
  FileText,
  TrendingUp,
  GraduationCap,
  RefreshCw,
  ChevronRight,
  Lightbulb,
} from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import { DashboardData } from "@/lib/api/schemas";
import type { Role } from "@/lib/auth/roles";
import { TemplateSkeleton } from "@/components/modules/shared";
import { LoadError } from "@/components/ui/load-error";
import { Badge, Button, Card, Progress } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

function toneText(tone?: string) {
  switch (tone) {
    case "teal":    return "text-teal-600 dark:text-teal-400";
    case "gold":    return "text-amber-500 dark:text-amber-400";
    case "sky":     return "text-sky-600 dark:text-sky-400";
    case "rose":    return "text-rose-600 dark:text-rose-400";
    case "amber":   return "text-amber-600 dark:text-amber-400";
    case "neutral": return "text-ink-3";
    default:        return "text-brand-600 dark:text-brand-400";
  }
}

function toneBg(tone?: string) {
  switch (tone) {
    case "teal":  return "bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800";
    case "gold":  return "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800";
    case "sky":   return "bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800";
    case "amber": return "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800";
    default:      return "bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800";
  }
}

function kpiIcon(label: string) {
  const l = label.toLowerCase();
  if (l.includes("enrolled")) return <UserCheck className="w-5 h-5" />;
  if (l.includes("offer"))    return <FileText className="w-5 h-5" />;
  if (l.includes("average"))  return <GraduationCap className="w-5 h-5" />;
  return <Users className="w-5 h-5" />;
}

function MiniBar({ data, seriesKey, color }: {
  data: Record<string, string | number>[];
  seriesKey: string;
  color: string;
}) {
  const values = data.map((d) => Number(d[seriesKey]) || 0);
  const max = values.reduce((a, b) => (b > a ? b : a), 1);
  return (
    <div className="flex items-end gap-1 h-16">
      {data.map((d, i) => {
        const h = Math.round((values[i] / max) * 100);
        const name = String(d.name ?? "");
        return (
          <div key={i} className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
            <div
              className="w-full rounded-t transition-all duration-500"
              style={{ height: `${h}%`, backgroundColor: color, minHeight: values[i] > 0 ? 4 : 0 }}
              title={`${name}: ${values[i]}`}
            />
            <span className="text-[9px] text-ink-3 truncate w-full text-center leading-tight">
              {name.split(" ")[0]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function FunnelRow({ stage, count, max, prev, active, onClick }: {
  stage: string; count: number; max: number; prev?: number; active: boolean; onClick: () => void;
}) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  const drop = prev !== undefined && prev > 0 ? Math.round(((prev - count) / prev) * 100) : null;
  return (
    <button
      className={cn(
        "w-full text-left p-2 rounded-lg transition-colors",
        active
          ? "bg-brand-50 dark:bg-brand-900/20 ring-1 ring-brand-300 dark:ring-brand-700"
          : "hover:bg-surface-1",
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-1 text-sm">
        <span className="font-medium text-ink">{stage}</span>
        <div className="flex items-center gap-3">
          {drop !== null && drop > 0 && (
            <span className="text-xs text-rose-500 font-medium">-{drop}% drop</span>
          )}
          <span className="text-ink-2 tabular-nums w-14 text-right">{count.toLocaleString()}</span>
          <span className="text-xs text-ink-3 w-10 text-right">{pct}%</span>
        </div>
      </div>
      <Progress value={pct} className="h-2" />
      {active && (
        <div className="mt-2 pt-2 border-t border-line text-xs text-ink-3 flex items-center gap-1">
          <ChevronRight className="w-3 h-3 shrink-0" />
          <span>
            <strong className="text-ink">{count.toLocaleString()}</strong> applicants reached{" "}
            <strong className="text-ink">{stage}</strong>
            {prev !== undefined && (
              <> &mdash; {(prev - count).toLocaleString()} did not advance from the previous stage</>
            )}
          </span>
        </div>
      )}
    </button>
  );
}

const DONUT_COLORS = ["#6366f1","#22d3ee","#f59e0b","#10b981","#f43f5e","#8b5cf6","#fb923c"];

function DonutMini({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = 36; const cx = 44; const cy = 44;
  const circumference = 2 * Math.PI * r;
  let cum = 0;
  const slices = data.map((d, i) => {
    const pct = d.value / total;
    const offset = -circumference * cum;
    cum += pct;
    return { ...d, pct, offset, dash: circumference * pct, color: DONUT_COLORS[i % DONUT_COLORS.length] };
  });
  return (
    <div className="flex items-center gap-4">
      <svg width={88} height={88} className="shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={14} className="text-ink-3/10" />
        {slices.map((s, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={14}
            strokeDasharray={`${s.dash} ${circumference}`} strokeDashoffset={s.offset}
            transform={`rotate(-90 ${cx} ${cy})`} className="transition-all duration-500" />
        ))}
      </svg>
      <div className="flex flex-col gap-1.5 min-w-0">
        {slices.slice(0, 5).map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs min-w-0">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="truncate text-ink">{s.name}</span>
            <span className="ml-auto text-ink-3 tabular-nums shrink-0">{Math.round(s.pct * 100)}%</span>
          </div>
        ))}
        {slices.length > 5 && <span className="text-xs text-ink-3">+{slices.length - 5} more</span>}
      </div>
    </div>
  );
}

export function AdmissionInsightsModule({ role: _role }: { role?: Role }) {
  const [activeStage, setActiveStage] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admission-insights"],
    queryFn: () => apiFetch("/api/v1/modules/admission-insights", DashboardData),
    staleTime: 60_000,
  });

  const funnelChart = useMemo(
    () => data?.charts.find((c) => c.title.toLowerCase().includes("funnel")),
    [data],
  );
  const categoryChart = useMemo(
    () => data?.charts.find((c) => c.title.toLowerCase().includes("category") || c.title.toLowerCase().includes("community")),
    [data],
  );
  const programChart = useMemo(
    () => data?.charts.find((c) => c.title.toLowerCase().includes("programme") || c.title.toLowerCase().includes("program")),
    [data],
  );
  const weeklyChart = useMemo(
    () => data?.charts.find((c) => c.title.toLowerCase().includes("week")),
    [data],
  );

  const funnelData = funnelChart?.data ?? [];
  const funnelSeriesKey = funnelChart?.series[0] ?? "Applicants";
  const funnelMax = funnelData.reduce((a, d) => { const v = Number(d[funnelSeriesKey] ?? 0); return v > a ? v : a; }, 1);

  const categoryData = useMemo(
    () => (categoryChart?.data ?? []).map((d) => ({ name: String(d.name ?? ""), value: Number(d.value ?? 0) })),
    [categoryChart],
  );

  const programData = (programChart?.data ?? []).slice(0, 8);
  const programSeriesKey = programChart?.series[0] ?? "Applications";
  const programMax = programData.reduce((a, d) => { const v = Number(d[programSeriesKey] ?? 0); return v > a ? v : a; }, 1);

  if (isLoading) return <TemplateSkeleton />;
  if (isError || !data) return <LoadError error={error} onRetry={() => refetch()} />;

  const { kpis, insights } = data;

  return (
    <div className="space-y-6 pb-8">

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="p-4 flex flex-col gap-2">
            <div className={cn("flex items-center gap-2", toneText(kpi.tone))}>
              {kpiIcon(kpi.label)}
              <span className="text-xs font-medium uppercase tracking-wide">{kpi.label}</span>
            </div>
            <p className="text-3xl font-bold text-ink tabular-nums">{kpi.value}</p>
            {(kpi.delta || kpi.hint) && (
              <p className="text-xs text-ink-3">{kpi.delta ?? kpi.hint}</p>
            )}
          </Card>
        ))}
      </div>

      {/* Admission funnel */}
      {funnelData.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-ink">Admission Funnel</h3>
              <p className="text-xs text-ink-3 mt-0.5">Click a stage to inspect drop-off</p>
            </div>
            <Badge tone="neutral">{funnelData.length} stages</Badge>
          </div>
          <div className="space-y-1">
            {funnelData.map((row, i) => {
              const count = Number(row[funnelSeriesKey] ?? 0);
              const prev = i > 0 ? Number(funnelData[i - 1][funnelSeriesKey] ?? 0) : undefined;
              const stageName = String(row.name ?? "");
              return (
                <FunnelRow
                  key={stageName}
                  stage={stageName}
                  count={count}
                  max={funnelMax}
                  prev={prev}
                  active={activeStage === stageName}
                  onClick={() => setActiveStage(activeStage === stageName ? null : stageName)}
                />
              );
            })}
          </div>
        </Card>
      )}

      {/* Category mix + programme demand */}
      <div className="grid md:grid-cols-2 gap-4">
        {categoryData.length > 0 && (
          <Card className="p-5">
            <h3 className="font-semibold text-ink mb-1">{categoryChart?.title ?? "Category Mix"}</h3>
            <p className="text-xs text-ink-3 mb-4">Applicant distribution by community</p>
            <DonutMini data={categoryData} />
          </Card>
        )}
        {programData.length > 0 && (
          <Card className="p-5">
            <h3 className="font-semibold text-ink mb-1">{programChart?.title ?? "Programme Demand"}</h3>
            <p className="text-xs text-ink-3 mb-4">Applications by programme (top 8)</p>
            <div className="space-y-2.5">
              {programData.map((row) => {
                const count = Number(row[programSeriesKey] ?? 0);
                const name = String(row.name ?? "");
                const pct = Math.round((count / programMax) * 100);
                return (
                  <div key={name}>
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="text-ink truncate max-w-[65%]">{name}</span>
                      <span className="text-ink-3 tabular-nums">{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-1 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand-500 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>

      {/* Weekly trend */}
      {weeklyChart && weeklyChart.data.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-ink">{weeklyChart.title}</h3>
              <p className="text-xs text-ink-3 mt-0.5">Last 6 weeks of application activity</p>
            </div>
            <TrendingUp className="w-4 h-4 text-ink-3" />
          </div>
          <MiniBar
            data={weeklyChart.data}
            seriesKey={weeklyChart.series[0] ?? "Applications"}
            color="#6366f1"
          />
        </Card>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-ink-3" />
            <h3 className="font-semibold text-ink">Key Insights</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {insights.map((ins) => (
              <Card key={ins.title} className={cn("p-4 border", toneBg(ins.tone))}>
                <p className={cn("text-sm font-semibold mb-1", toneText(ins.tone))}>{ins.title}</p>
                <p className="text-sm text-ink mb-2">{ins.body}</p>
                <p className="text-xs text-ink-3 italic">Evidence: {ins.evidence}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Refresh */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-ink-3 gap-1.5"
          onClick={() => refetch()}
        >
          <RefreshCw className="w-3 h-3" />
          Refresh data
        </Button>
      </div>
    </div>
  );
}
