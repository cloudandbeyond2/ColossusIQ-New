"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, UserCheck, FileText, TrendingUp, GraduationCap, Filter, RefreshCw, ChevronRight } from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import { DashboardData } from "@/lib/api/schemas";
import type { Role } from "@/lib/auth/roles";
import { TemplateSkeleton, LoadError } from "@/components/modules/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/* ── helpers ─────────────────────────────────────────────────── */
function toneClass(tone?: string) {
  switch (tone) {
    case "teal":   return "text-teal-600 dark:text-teal-400";
    case "gold":   return "text-amber-500 dark:text-amber-400";
    case "sky":    return "text-sky-600 dark:text-sky-400";
    case "rose":   return "text-rose-600 dark:text-rose-400";
    case "amber":  return "text-amber-600 dark:text-amber-400";
    case "neutral":return "text-slate-500 dark:text-slate-400";
    default:       return "text-brand-600 dark:text-brand-400";
  }
}

function toneBg(tone?: string) {
  switch (tone) {
    case "teal":   return "bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800";
    case "gold":   return "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800";
    case "sky":    return "bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800";
    case "rose":   return "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800";
    case "amber":  return "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800";
    default:       return "bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800";
  }
}

function kpiIcon(label: string) {
  if (label.toLowerCase().includes("enrolled")) return <UserCheck className="w-5 h-5" />;
  if (label.toLowerCase().includes("offer"))    return <FileText className="w-5 h-5" />;
  if (label.toLowerCase().includes("average"))  return <GraduationCap className="w-5 h-5" />;
  return <Users className="w-5 h-5" />;
}

/* ── mini bar chart ──────────────────────────────────────────── */
function MiniBar({ data, seriesKey, color }: { data: Record<string, string | number>[]; seriesKey: string; color: string }) {
  const values = data.map((d) => Number(d[seriesKey]) || 0);
  const max = Math.max(...values, 1);
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
            <span className="text-[9px] text-muted-foreground truncate w-full text-center leading-tight">{name.split(" ")[0]}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── funnel stage row ────────────────────────────────────────── */
function FunnelRow({ stage, count, max, prev }: { stage: string; count: number; max: number; prev?: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  const drop = prev !== undefined && prev > 0 ? Math.round(((prev - count) / prev) * 100) : null;
  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1 text-sm">
        <span className="font-medium text-foreground">{stage}</span>
        <div className="flex items-center gap-3">
          {drop !== null && drop > 0 && (
            <span className="text-xs text-rose-500 font-medium">↓ {drop}% drop</span>
          )}
          <span className="text-muted-foreground tabular-nums w-14 text-right">{count.toLocaleString()}</span>
          <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
        </div>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}

/* ── donut mini ──────────────────────────────────────────────── */
function DonutMini({ data, colors }: { data: { name: string; value: number }[]; colors: string[] }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let cum = 0;
  const r = 36;
  const cx = 44;
  const cy = 44;
  const circumference = 2 * Math.PI * r;
  const slices = data.map((d, i) => {
    const pct = d.value / total;
    const offset = -circumference * cum;
    cum += pct;
    return { ...d, pct, offset, dash: circumference * pct, color: colors[i % colors.length] };
  });
  return (
    <div className="flex items-center gap-4">
      <svg width={88} height={88} className="shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={14} className="text-muted-foreground/10" />
        {slices.map((s, i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={14}
            strokeDasharray={`${s.dash} ${circumference}`}
            strokeDashoffset={s.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            className="transition-all duration-500"
          />
        ))}
      </svg>
      <div className="flex flex-col gap-1.5 min-w-0">
        {slices.slice(0, 5).map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs min-w-0">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="truncate text-foreground">{s.name}</span>
            <span className="ml-auto text-muted-foreground tabular-nums shrink-0">{Math.round(s.pct * 100)}%</span>
          </div>
        ))}
        {slices.length > 5 && (
          <span className="text-xs text-muted-foreground">+{slices.length - 5} more</span>
        )}
      </div>
    </div>
  );
}

const DONUT_COLORS = ["#6366f1", "#22d3ee", "#f59e0b", "#10b981", "#f43f5e", "#8b5cf6", "#fb923c"];

/* ── main component ──────────────────────────────────────────── */
export function AdmissionInsightsModule({ role: _role }: { role?: Role }) {
  const [activeStage, setActiveStage] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admission-insights"],
    queryFn: () => apiFetch("/api/v1/modules/admission-insights", DashboardData),
    staleTime: 60_000,
  });

  /* ── derive sub-views from chart data ─────────────────────── */
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

  const funnelData = useMemo(
    () => funnelChart?.data ?? [],
    [funnelChart],
  );
  const funnelMax = useMemo(
    () => Math.max(...funnelData.map((d) => Number(d[funnelChart?.series[0] ?? "Applicants"] ?? 0)), 1),
    [funnelData, funnelChart],
  );

  const categoryData = useMemo(
    () => (categoryChart?.data ?? []).map((d) => ({ name: String(d.name ?? ""), value: Number(d.value ?? 0) })),
    [categoryChart],
  );

  const programData = useMemo(
    () => (programChart?.data ?? []).slice(0, 8),
    [programChart],
  );
  const programMax = useMemo(
    () => Math.max(...programData.map((d) => Number(d[programChart?.series[0] ?? "Applications"] ?? 0)), 1),
    [programData, programChart],
  );

  if (isLoading) return <TemplateSkeleton />;
  if (isError || !data) return <LoadError error={error} onRetry={() => refetch()} />;

  const { kpis, insights } = data;

  return (
    <div className="space-y-6 pb-8">

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="p-4 flex flex-col gap-2">
            <div className={cn("flex items-center gap-2", toneClass(kpi.tone))}>
              {kpiIcon(kpi.label)}
              <span className="text-xs font-medium uppercase tracking-wide">{kpi.label}</span>
            </div>
            <p className="text-3xl font-bold text-foreground tabular-nums">{kpi.value}</p>
            {kpi.delta && (
              <p className="text-xs text-muted-foreground">{kpi.delta}</p>
            )}
          </Card>
        ))}
      </div>

      {/* ── admission funnel ── */}
      {funnelData.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Admission Funnel</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Stage-by-stage applicant progression</p>
            </div>
            <Badge variant="secondary" className="text-xs">
              {funnelData.length} stages
            </Badge>
          </div>
          <div className="space-y-3">
            {funnelData.map((row, i) => {
              const seriesKey = funnelChart?.series[0] ?? "Applicants";
              const count = Number(row[seriesKey] ?? 0);
              const prev = i > 0 ? Number(funnelData[i - 1][seriesKey] ?? 0) : undefined;
              const stageName = String(row.name ?? "");
              return (
                <button
                  key={stageName}
                  className={cn(
                    "w-full text-left p-2 rounded-lg transition-colors",
                    activeStage === stageName
                      ? "bg-brand-50 dark:bg-brand-900/20 ring-1 ring-brand-300 dark:ring-brand-700"
                      : "hover:bg-muted/50",
                  )}
                  onClick={() => setActiveStage(activeStage === stageName ? null : stageName)}
                >
                  <FunnelRow stage={stageName} count={count} max={funnelMax} prev={prev} />
                  {activeStage === stageName && (
                    <div className="mt-2 pt-2 border-t border-border text-xs text-muted-foreground flex items-center gap-1">
                      <ChevronRight className="w-3 h-3" />
                      {count.toLocaleString()} applicants reached <strong className="text-foreground">{stageName}</strong>
                      {prev !== undefined && (
                        <> — {(prev - count).toLocaleString()} did not advance from previous stage</>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── bottom grid: category mix + program demand ── */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* category donut */}
        {categoryData.length > 0 && (
          <Card className="p-5">
            <h3 className="font-semibold text-foreground mb-1">{categoryChart?.title ?? "Category Mix"}</h3>
            <p className="text-xs text-muted-foreground mb-4">Applicant distribution by community</p>
            <DonutMini data={categoryData} colors={DONUT_COLORS} />
          </Card>
        )}

        {/* program demand bars */}
        {programData.length > 0 && (
          <Card className="p-5">
            <h3 className="font-semibold text-foreground mb-1">{programChart?.title ?? "Programme Demand"}</h3>
            <p className="text-xs text-muted-foreground mb-4">Applications by programme (top 8)</p>
            <div className="space-y-2">
              {programData.map((row) => {
                const seriesKey = programChart?.series[0] ?? "Applications";
                const count = Number(row[seriesKey] ?? 0);
                const name = String(row.name ?? "");
                const pct = Math.round((count / programMax) * 100);
                return (
                  <div key={name} className="group">
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="text-foreground truncate max-w-[60%]">{name}</span>
                      <span className="text-muted-foreground tabular-nums">{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
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

      {/* ── weekly trend ── */}
      {weeklyChart && weeklyChart.data.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">{weeklyChart.title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Last 6 weeks of application activity</p>
            </div>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </div>
          <MiniBar data={weeklyChart.data} seriesKey={weeklyChart.series[0] ?? "Applications"} color="#6366f1" />
        </Card>
      )}

      {/* ── insights ── */}
      {insights.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">Key Insights</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {insights.map((ins) => (
              <Card key={ins.title} className={cn("p-4 border", toneBg(ins.tone))}>
                <p className={cn("text-sm font-semibold mb-1", toneClass(ins.tone))}>{ins.title}</p>
                <p className="text-sm text-foreground mb-2">{ins.body}</p>
                <p className="text-xs text-muted-foreground italic">{ins.evidence}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── refresh hint ── */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground gap-1.5"
          onClick={() => refetch()}
        >
          <RefreshCw className="w-3 h-3" />
          Refresh data
        </Button>
      </div>
    </div>
  );
}
