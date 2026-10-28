"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  FileCheck,
  GraduationCap,
  Lightbulb,
  Plus,
  RefreshCw,
  Save,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { apiFetch, ApiError } from "@/lib/api/client";
import { ScorecardData } from "@/lib/api/schemas";
import type { Role } from "@/lib/auth/roles";
import { TemplateSkeleton } from "@/components/modules/shared";
import { LoadError } from "@/components/ui/load-error";
import {
  Badge,
  Button,
  Card,
  Progress,
  inputClass,
  toneForScore,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/* ─── helpers ─────────────────────────────────────────────── */

function gradeFromScore(score: number): { label: string; tone: "teal" | "sky" | "amber" | "neutral" } {
  if (score >= 85) return { label: "A++ (Outstanding)", tone: "teal" };
  if (score >= 75) return { label: "A+ (Excellent)", tone: "teal" };
  if (score >= 65) return { label: "A (Very Good)", tone: "sky" };
  if (score >= 55) return { label: "B++ (Good)", tone: "sky" };
  if (score >= 50) return { label: "B+ (Satisfactory)", tone: "amber" };
  if (score >= 45) return { label: "B (Adequate)", tone: "amber" };
  return { label: "C (Below Standard)", tone: "neutral" };
}

const CRITERION_ICONS: Record<string, React.ReactNode> = {
  C1: <BookOpen className="size-4" />,
  C2: <GraduationCap className="size-4" />,
  C3: <Lightbulb className="size-4" />,
  C4: <FileCheck className="size-4" />,
  C5: <Users className="size-4" />,
  C6: <Shield className="size-4" />,
  C7: <Star className="size-4" />,
};

const CRITERION_COLORS: Record<string, string> = {
  C1: "border-l-brand",
  C2: "border-l-teal",
  C3: "border-l-amber",
  C4: "border-l-sky",
  C5: "border-l-rose",
  C6: "border-l-violet",
  C7: "border-l-lime",
};

/* ─── component ───────────────────────────────────────────── */

export function NaacReadinessModule({ role: _role }: { role?: Role }) {
  const qc = useQueryClient();
  const [toast, setToast] = useState<string | null>(null);

  const [localScores, setLocalScores] = useState<Record<string, number>>({});
  const [localStrengths, setLocalStrengths] = useState<string[]>([]);
  const [localGaps, setLocalGaps] = useState<string[]>([]);
  const [localPlan, setLocalPlan] = useState<string[]>([]);

  const [newStrength, setNewStrength] = useState("");
  const [newGap, setNewGap] = useState("");
  const [newPlan, setNewPlan] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["naac-readiness"],
    queryFn: () => apiFetch("/api/v1/modules/naac-readiness", ScorecardData),
  });

  useEffect(() => {
    if (!data) return;
    const scores: Record<string, number> = {};
    data.dimensions.forEach((d) => { scores[d.name.slice(0, 2)] = d.score; });
    setLocalScores(scores);
    setLocalStrengths([...data.strengths]);
    setLocalGaps([...data.gaps]);
    setLocalPlan([...data.plan]);
  }, [data]);

  const liveOverall = useMemo(() => {
    const vals = Object.values(localScores);
    if (!vals.length) return data?.overall ?? 0;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }, [localScores, data?.overall]);

  const grade = gradeFromScore(liveOverall);

  const compliantCount = useMemo(() => {
    if (!data) return 0;
    return data.dimensions.filter((d) => (localScores[d.name.slice(0, 2)] ?? d.score) >= d.target).length;
  }, [data, localScores]);

  const criticalGaps = useMemo(
    () => localGaps.filter((g) => !g.toLowerCase().includes("outside colossusiq")).length,
    [localGaps]
  );

  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/v1/modules/naac-readiness", z.any(), {
        method: "PATCH",
        body: {
          dimensions: data?.dimensions.map((d) => ({
            name: d.name,
            score: localScores[d.name.slice(0, 2)] ?? d.score,
            target: d.target,
          })),
          strengths: localStrengths,
          gaps: localGaps,
          plan: localPlan,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["naac-readiness"] });
      showToast("NAAC readiness scorecard saved successfully!");
    },
    onError: (err) => {
      showToast(err instanceof ApiError ? err.message : "Failed to save changes.");
    },
  });

  if (isLoading) return <TemplateSkeleton />;
  if (isError || !data) return <LoadError error={error} onRetry={() => { refetch(); }} />;

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm text-surface shadow-2xl animate-in fade-in slide-in-from-bottom-2">
          <Sparkles className="size-4 text-brand shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <Card className="p-3 sm:p-4 border-l-4 border-l-brand">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-ink-3">Overall Score</span>
            <span className="rounded-lg bg-brand-soft p-1.5 text-brand"><BarChart3 className="size-4" /></span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-ink">{liveOverall}%</span>
            <Badge tone={grade.tone} className="text-[10px]">{grade.label.split(" ")[0]}</Badge>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">Live from {data.dimensions.length} criteria</p>
        </Card>

        <Card className="p-3 sm:p-4 border-l-4 border-l-teal">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-ink-3">Est. Grade</span>
            <span className="rounded-lg bg-teal-soft p-1.5 text-teal"><Award className="size-4" /></span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-ink">{grade.label.split(" ")[0]}</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">{grade.label.split(" ").slice(1).join(" ")}</p>
        </Card>

        <Card className="p-3 sm:p-4 border-l-4 border-l-rose">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-ink-3">Critical Gaps</span>
            <span className="rounded-lg bg-rose-soft p-1.5 text-rose"><AlertCircle className="size-4" /></span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-ink">{criticalGaps}</span>
            <span className="text-[11px] font-medium text-rose">to address</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">Criteria below target score</p>
        </Card>

        <Card className="p-3 sm:p-4 border-l-4 border-l-sky">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-ink-3">At Target</span>
            <span className="rounded-lg bg-sky-soft p-1.5 text-sky"><ShieldCheck className="size-4" /></span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-ink">{compliantCount}</span>
            <span className="text-xs text-ink-3">of {data.dimensions.length} criteria</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">Meeting or exceeding target</p>
        </Card>
      </div>

      {/* Headline + Save */}
      <Card className="p-4 sm:p-5 bg-gradient-to-r from-surface via-surface to-brand-soft/10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <Badge tone="brand" className="text-[10px] mb-1.5">NAAC Readiness</Badge>
            <h2 className="text-base sm:text-lg font-bold text-ink">{data.headline}</h2>
            <p className="mt-1 text-[11px] text-ink-3">Scores computed live from ColossusIQ records. Adjust sliders to model improvements.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="secondary" onClick={() => refetch()} className="h-9 px-3 text-xs gap-1.5" title="Refresh from live records">
              <RefreshCw className="size-3.5" /><span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="h-9 px-4 text-xs gap-1.5 bg-brand-gradient text-white shadow-md shadow-brand/20">
              <Save className="size-4" /><span>{saveMutation.isPending ? "Saving…" : "Save Changes"}</span>
            </Button>
          </div>
        </div>
        <div className="mt-4 space-y-1.5">
          <div className="flex justify-between text-[11px]">
            <span className="font-semibold text-ink-3 uppercase tracking-wider">Overall readiness</span>
            <span className="font-bold text-ink font-mono">{liveOverall}%</span>
          </div>
          <Progress value={liveOverall} tone={toneForScore(liveOverall)} className="h-2.5" />
          <div className="flex justify-between text-[10px] text-ink-3 font-mono">
            <span>0</span>
            <span className="text-amber font-semibold">B (50)</span>
            <span className="text-sky font-semibold">A (65)</span>
            <span className="text-teal font-semibold">A+ (75)</span>
            <span>100</span>
          </div>
        </div>
      </Card>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT: Criteria Scorecard */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between pb-3 border-b border-line mb-4">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-ink">Seven Criteria Scorecard</h3>
                <p className="text-xs text-ink-3">Adjust sliders to model changes; scores update live</p>
              </div>
              <ClipboardList className="size-5 text-brand" />
            </div>
            <div className="space-y-3">
              {data.dimensions.map((dim) => {
                const code = dim.name.slice(0, 2);
                const currentVal = localScores[code] ?? dim.score;
                const atTarget = currentVal >= dim.target;
                const gap = dim.target - currentVal;
                return (
                  <div key={dim.name} className={cn("rounded-xl border-l-4 border border-line bg-surface-2/40 p-3 sm:p-4 space-y-2.5 hover:bg-surface-2/70 transition", CRITERION_COLORS[code] ?? "border-l-line")}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <span className={cn("mt-0.5 rounded-lg p-1.5 shrink-0", atTarget ? "bg-teal-soft text-teal" : "bg-rose-soft text-rose")}>
                          {CRITERION_ICONS[code]}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-xs sm:text-sm text-ink truncate">{dim.name}</span>
                            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0", atTarget ? "bg-teal-soft text-teal" : gap <= 10 ? "bg-amber-soft text-amber" : "bg-rose-soft text-rose")}>
                              {atTarget ? "✓ On Target" : `${gap}pts below target`}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-lg font-bold text-ink font-mono">{currentVal}</span>
                        <span className="text-[10px] text-ink-3 block">target {dim.target}</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Progress value={currentVal} tone={atTarget ? "teal" : gap <= 10 ? "amber" : "rose"} className="h-1.5" />
                      <input type="range" min={0} max={100} value={currentVal}
                        onChange={(e) => setLocalScores((prev) => ({ ...prev, [code]: Number(e.target.value) }))}
                        className="w-full accent-brand cursor-pointer h-1.5 bg-surface-2 rounded-lg" />
                      <div className="flex justify-between text-[10px] text-ink-3 font-mono">
                        <span>0%</span>
                        <span className="text-brand font-semibold">NAAC Target ({dim.target}%)</span>
                        <span>100%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* RIGHT: Strengths, Gaps, Plan, Grade Scale */}
        <div className="lg:col-span-5 space-y-4">
          {/* Strengths */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between pb-2.5 border-b border-line mb-3">
              <div className="flex items-center gap-2"><CheckCircle2 className="size-4 text-teal" /><h3 className="text-xs sm:text-sm font-bold text-ink">Strengths</h3></div>
              <span className="text-[11px] text-teal font-semibold">{localStrengths.length} recorded</span>
            </div>
            <div className="space-y-2">
              {localStrengths.map((s, idx) => (
                <div key={idx} className="flex items-start justify-between gap-2 rounded-lg bg-teal-soft/20 border border-teal/20 p-2 text-xs text-ink">
                  <span className="leading-relaxed">{s}</span>
                  <button onClick={() => setLocalStrengths((prev) => prev.filter((_, i) => i !== idx))} className="text-ink-3 hover:text-rose p-0.5 transition shrink-0"><X className="size-3.5" /></button>
                </div>
              ))}
              {localStrengths.length === 0 && <p className="text-[11px] text-ink-3 italic py-1">No criteria at target yet.</p>}
              <div className="flex items-center gap-1.5 pt-1">
                <input type="text" value={newStrength} onChange={(e) => setNewStrength(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && newStrength.trim()) { e.preventDefault(); setLocalStrengths((prev) => [...prev, newStrength.trim()]); setNewStrength(""); } }}
                  placeholder="Add a strength…" className={cn(inputClass, "h-8 text-xs")} />
                <Button variant="secondary" onClick={() => { if (newStrength.trim()) { setLocalStrengths((prev) => [...prev, newStrength.trim()]); setNewStrength(""); } }} className="h-8 px-2.5 text-xs"><Plus className="size-3.5" /></Button>
              </div>
            </div>
          </Card>

          {/* Gaps */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between pb-2.5 border-b border-line mb-3">
              <div className="flex items-center gap-2"><AlertCircle className="size-4 text-rose" /><h3 className="text-xs sm:text-sm font-bold text-ink">Evidence Gaps</h3></div>
              <span className="text-[11px] text-rose font-semibold">{localGaps.length} gaps</span>
            </div>
            <div className="space-y-2">
              {localGaps.map((g, idx) => (
                <div key={idx} className={cn("flex items-start justify-between gap-2 rounded-lg border p-2 text-xs", g.toLowerCase().includes("outside colossusiq") ? "bg-surface-2/40 border-line text-ink-3" : "bg-rose-soft/20 border-rose/20 text-ink")}>
                  <span className="leading-relaxed">{g}</span>
                  <button onClick={() => setLocalGaps((prev) => prev.filter((_, i) => i !== idx))} className="text-ink-3 hover:text-rose p-0.5 transition shrink-0"><X className="size-3.5" /></button>
                </div>
              ))}
              <div className="flex items-center gap-1.5 pt-1">
                <input type="text" value={newGap} onChange={(e) => setNewGap(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && newGap.trim()) { e.preventDefault(); setLocalGaps((prev) => [...prev, newGap.trim()]); setNewGap(""); } }}
                  placeholder="Flag an evidence gap…" className={cn(inputClass, "h-8 text-xs")} />
                <Button variant="secondary" onClick={() => { if (newGap.trim()) { setLocalGaps((prev) => [...prev, newGap.trim()]); setNewGap(""); } }} className="h-8 px-2.5 text-xs"><Plus className="size-3.5" /></Button>
              </div>
            </div>
          </Card>

          {/* Action Plan */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between pb-2.5 border-b border-line mb-3">
              <div className="flex items-center gap-2"><Target className="size-4 text-brand" /><h3 className="text-xs sm:text-sm font-bold text-ink">Action Plan</h3></div>
              <span className="text-[11px] text-brand font-semibold">{localPlan.length} actions</span>
            </div>
            <div className="space-y-2">
              {localPlan.map((action, idx) => (
                <div key={idx} className="flex items-start justify-between gap-2 rounded-lg bg-surface-2 border border-line p-2 text-xs text-ink">
                  <div className="flex items-start gap-2">
                    <span className="rounded bg-brand text-white size-4 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{idx + 1}</span>
                    <span className="leading-relaxed">{action}</span>
                  </div>
                  <button onClick={() => setLocalPlan((prev) => prev.filter((_, i) => i !== idx))} className="text-ink-3 hover:text-rose p-0.5 transition shrink-0"><X className="size-3.5" /></button>
                </div>
              ))}
              <div className="flex items-center gap-1.5 pt-1">
                <input type="text" value={newPlan} onChange={(e) => setNewPlan(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && newPlan.trim()) { e.preventDefault(); setLocalPlan((prev) => [...prev, newPlan.trim()]); setNewPlan(""); } }}
                  placeholder="Add an action item…" className={cn(inputClass, "h-8 text-xs")} />
                <Button variant="secondary" onClick={() => { if (newPlan.trim()) { setLocalPlan((prev) => [...prev, newPlan.trim()]); setNewPlan(""); } }} className="h-8 px-2.5 text-xs"><Plus className="size-3.5" /></Button>
              </div>
            </div>
          </Card>

          {/* Grade Scale */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center gap-2 pb-2.5 border-b border-line mb-3">
              <TrendingUp className="size-4 text-brand" /><h3 className="text-xs sm:text-sm font-bold text-ink">NAAC Grade Scale</h3>
            </div>
            <div className="space-y-1.5">
              {([
                { min: 85, max: 100, grade: "A++", label: "Outstanding",    tone: "teal"    },
                { min: 75, max: 84,  grade: "A+",  label: "Excellent",      tone: "teal"    },
                { min: 65, max: 74,  grade: "A",   label: "Very Good",      tone: "sky"     },
                { min: 55, max: 64,  grade: "B++", label: "Good",           tone: "sky"     },
                { min: 50, max: 54,  grade: "B+",  label: "Satisfactory",   tone: "amber"   },
                { min: 45, max: 49,  grade: "B",   label: "Adequate",       tone: "amber"   },
                { min: 0,  max: 44,  grade: "C",   label: "Below Standard", tone: "neutral" },
              ] as const).map((row) => {
                const active = liveOverall >= row.min && liveOverall <= row.max;
                return (
                  <div key={row.grade} className={cn("flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs", active ? "bg-brand-soft/30 font-bold text-brand" : "text-ink-3")}>
                    <span className="font-mono">{row.min}–{row.max}</span>
                    <span className="font-bold">{row.grade}</span>
                    <span>{row.label}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
