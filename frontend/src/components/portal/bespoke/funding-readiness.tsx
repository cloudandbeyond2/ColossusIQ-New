"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Award,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  Download,
  ExternalLink,
  FileCheck,
  FileText,
  Filter,
  GraduationCap,
  Handshake,
  Lightbulb,
  Plus,
  RefreshCw,
  Rocket,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  User,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { apiFetch, ApiError } from "@/lib/api/client";
import {
  FundingReadinessOverview,
  READINESS_TIERS,
  ScoreDimension,
  VentureFundingReadiness,
  type DiligenceCheckItem,
  type ReadinessTier,
  type UpdateReadinessInput,
} from "@/lib/api/funding-readiness-schemas";
import type { Role } from "@/lib/auth/roles";
import { TemplateSkeleton } from "@/components/modules/shared";
import { LoadError } from "@/components/ui/load-error";
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Progress,
  inputClass,
  toneForScore,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const TIER_TONES: Record<ReadinessTier, "neutral" | "amber" | "sky" | "teal"> = {
  "Early Stage / Grant Ready": "neutral",
  "Incubation Seed Ready": "amber",
  "Angel / Pre-Series A Ready": "sky",
  "Institutional VC Ready": "teal",
};

export function FundingReadinessModule({ role: _role }: { role?: Role }) {
  const qc = useQueryClient();
  const [selectedVentureId, setSelectedVentureId] = useState<string>("stu-agrisoil");
  const [toast, setToast] = useState<string | null>(null);

  // Local editable state for current evaluation
  const [localScores, setLocalScores] = useState<Record<string, number>>({});
  const [localFundingTarget, setLocalFundingTarget] = useState<string>("");
  const [localStrengths, setLocalStrengths] = useState<string[]>([]);
  const [localGaps, setLocalGaps] = useState<string[]>([]);
  const [localActionPlan, setLocalActionPlan] = useState<string[]>([]);
  const [localDiligence, setLocalDiligence] = useState<DiligenceCheckItem[]>([]);
  const [localNotes, setLocalNotes] = useState<string>("");

  // Input states for adding new items
  const [newStrengthInput, setNewStrengthInput] = useState("");
  const [newGapInput, setNewGapInput] = useState("");
  const [newActionInput, setNewActionInput] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch Funding Readiness Overview
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["funding-readiness", selectedVentureId],
    queryFn: () =>
      apiFetch(
        `/api/v1/incubation/funding-readiness?ventureId=${encodeURIComponent(selectedVentureId)}`,
        FundingReadinessOverview
      ),
  });

  // Sync server data to local editable state when loaded or when venture changes
  useEffect(() => {
    if (data?.currentEvaluation) {
      const evalData = data.currentEvaluation;
      const scoreMap: Record<string, number> = {};
      evalData.dimensions.forEach((d) => {
        scoreMap[d.id] = d.score;
      });
      setLocalScores(scoreMap);
      setLocalFundingTarget(evalData.fundingTarget);
      setLocalStrengths([...evalData.strengths]);
      setLocalGaps([...evalData.investorGaps]);
      setLocalActionPlan([...evalData.actionPlan]);
      setLocalDiligence([...evalData.diligenceChecklist]);
      setLocalNotes(evalData.evaluatorNotes);
    }
  }, [data?.currentEvaluation]);

  // Compute live local average score
  const computedLiveScore = useMemo(() => {
    const scores = Object.values(localScores);
    if (!scores.length) return data?.currentEvaluation?.readinessScore ?? 0;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [localScores, data?.currentEvaluation?.readinessScore]);

  const computedLiveTier: ReadinessTier = useMemo(() => {
    if (computedLiveScore >= 90) return "Institutional VC Ready";
    if (computedLiveScore >= 75) return "Angel / Pre-Series A Ready";
    if (computedLiveScore >= 60) return "Incubation Seed Ready";
    return "Early Stage / Grant Ready";
  }, [computedLiveScore]);

  // Save Evaluation Mutation
  const saveMutation = useMutation({
    mutationFn: (input: UpdateReadinessInput) =>
      apiFetch(`/api/v1/incubation/funding-readiness/${selectedVentureId}`, z.any(), {
        method: "PATCH",
        body: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["funding-readiness"] });
      showToast("Evaluation and diligence scorecard successfully saved!");
    },
    onError: (err) => {
      showToast(err instanceof ApiError ? err.message : "Failed to save evaluation.");
    },
  });

  const handleSaveEvaluation = () => {
    if (!data?.currentEvaluation) return;
    const dimensionPayload = Object.entries(localScores).map(([id, score]) => ({
      id,
      score,
    }));

    saveMutation.mutate({
      dimensions: dimensionPayload,
      fundingTarget: localFundingTarget,
      strengths: localStrengths,
      investorGaps: localGaps,
      actionPlan: localActionPlan,
      diligenceChecklist: localDiligence.map((d) => ({
        id: d.id,
        verified: d.verified,
        notes: d.notes,
      })),
      evaluatorNotes: localNotes,
    });
  };

  // Toggle Diligence item
  const handleToggleDiligence = (id: string) => {
    setLocalDiligence((prev) =>
      prev.map((it) => (it.id === id ? { ...it, verified: !it.verified } : it))
    );
  };

  // Export Diligence Summary (CSV / One-pager)
  const handleExportBrief = () => {
    if (!data?.currentEvaluation) return;
    const curr = data.currentEvaluation;
    const text = [
      `INVESTMENT READINESS BRIEF: ${curr.ventureName.toUpperCase()}`,
      `Domain: ${curr.domain}`,
      `Stage: ${curr.stage}`,
      `Lead Founder: ${curr.leadFounder} (${curr.department})`,
      `Target Round: ${localFundingTarget || curr.fundingTarget}`,
      `Current Funding: ${curr.currentFunding}`,
      `Overall Readiness Score: ${computedLiveScore}% (${computedLiveTier})`,
      `Last Evaluated: ${new Date().toISOString()}`,
      "",
      "--- DIMENSIONAL EVALUATION ---",
      ...curr.dimensions.map(
        (d) => `${d.name}: ${localScores[d.id] ?? d.score}/100 (Benchmark: ${d.benchmark}%)`
      ),
      "",
      "--- KEY INVESTOR STRENGTHS ---",
      ...localStrengths.map((s, i) => `${i + 1}. ${s}`),
      "",
      "--- DILIGENCE GAPS & RISKS ---",
      ...localGaps.map((g, i) => `${i + 1}. ${g}`),
      "",
      "--- INCUBATION ACTION PLAN ---",
      ...localActionPlan.map((a, i) => `${i + 1}. ${a}`),
      "",
      "--- DILIGENCE VERIFICATION STATUS ---",
      ...localDiligence.map((d) => `[${d.verified ? "VERIFIED" : "PENDING"}] ${d.title}: ${d.notes}`),
    ].join("\n");

    const element = document.createElement("a");
    const file = new Blob([text], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `${curr.ventureName.toLowerCase().replace(/\s+/g, "-")}-funding-readiness-brief.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    showToast("Downloaded investor readiness brief.");
  };

  if (isLoading) return <TemplateSkeleton />;
  if (isError || !data) return <LoadError error={error} onRetry={() => { refetch(); }} />;

  const currentEval = data.currentEvaluation;
  if (!currentEval) {
    return (
      <EmptyState
        title="No startups to evaluate yet"
        body="Funding readiness is scored per startup. Add a startup in the Startups portfolio and it will appear here for evaluation."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm text-surface shadow-2xl animate-in fade-in slide-in-from-bottom-2">
          <Sparkles className="size-4 text-brand shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* TOP KPI CARDS */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {/* KPI 1: Average Score */}
        <Card className="p-3 sm:p-4 border-l-4 border-l-brand">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-ink-3">
              Avg Portfolio Score
            </span>
            <span className="rounded-lg bg-brand-soft p-1.5 text-brand">
              <BarChart3 className="size-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
              {data.averageReadinessScore}%
            </span>
            <Badge tone="teal" className="text-[10px]">
              Campus Benchmark
            </Badge>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">Across ventures that have been evaluated</p>
        </Card>

        {/* KPI 2: Angel / VC Ready */}
        <Card className="p-3 sm:p-4 border-l-4 border-l-teal">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-ink-3">
              Angel / VC Ready
            </span>
            <span className="rounded-lg bg-teal-soft p-1.5 text-teal">
              <Award className="size-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
              {data.angelReadyCount}
            </span>
            <span className="text-xs text-ink-3">of {data.allVentures.length} ventures</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">Scoring &ge;75% investor threshold</p>
        </Card>

        {/* KPI 3: Funding Target */}
        <Card className="p-3 sm:p-4 border-l-4 border-l-amber">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-ink-3">
              Funding Target
            </span>
            <span className="rounded-lg bg-amber-soft p-1.5 text-amber">
              <Coins className="size-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-ink truncate">
              {data.totalFundingTarget}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">Combined portfolio seed pipeline</p>
        </Card>

        {/* KPI 4: Critical Gaps */}
        <Card className="p-3 sm:p-4 border-l-4 border-l-rose">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-ink-3">
              Critical Diligence Gaps
            </span>
            <span className="rounded-lg bg-rose-soft p-1.5 text-rose">
              <AlertCircle className="size-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
              {data.criticalGapsCount}
            </span>
            <span className="text-[11px] font-medium text-rose">Action Items</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">Flagged for incubation mentorship</p>
        </Card>
      </div>

      {/* VENTURE SELECTOR TABS / CAROUSEL */}
      <Card className="p-3 sm:p-4">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-line">
          <div className="flex items-center gap-2">
            <Rocket className="size-4 text-brand" />
            <h3 className="text-xs sm:text-sm font-bold text-ink">
              Select Campus Venture for Funding Diligence
            </h3>
          </div>
          <span className="text-[11px] text-ink-3">
            {data.allVentures.length} ventures evaluated
          </span>
        </div>

        {/* Horizontal scrollable venture pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {data.allVentures.map((v) => {
            const isSelected = v.ventureId === selectedVentureId;
            return (
              <button
                key={v.ventureId}
                onClick={() => setSelectedVentureId(v.ventureId)}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition shrink-0 min-w-[200px]",
                  isSelected
                    ? "border-brand bg-brand-soft/30 shadow-xs"
                    : "border-line bg-surface hover:bg-surface-2"
                )}
              >
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                    isSelected ? "bg-brand text-white" : "bg-surface-2 text-ink"
                  )}
                >
                  {v.readinessScore}%
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "font-semibold text-xs truncate",
                      isSelected ? "text-brand" : "text-ink"
                    )}
                  >
                    {v.ventureName}
                  </p>
                  <p className="text-[10px] text-ink-3 truncate">
                    {v.domain} · {v.stage}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* VENTURE HERO BANNER */}
      <Card className="p-4 sm:p-6 bg-gradient-to-r from-surface via-surface to-brand-soft/10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <Badge tone="brand" className="text-xs font-semibold">
                {currentEval.domain}
              </Badge>
              <Badge tone="neutral" className="text-[11px]">
                {currentEval.stage}
              </Badge>
              <Badge tone={TIER_TONES[computedLiveTier]} className="text-[11px] font-bold">
                {computedLiveTier}
              </Badge>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
              {currentEval.ventureName}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3">
              <span className="flex items-center gap-1">
                <User className="size-3.5" /> Lead Founder:{" "}
                <strong className="text-ink font-semibold">{currentEval.leadFounder}</strong>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Building2 className="size-3.5" /> {currentEval.department}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Coins className="size-3.5 text-amber" /> Raised:{" "}
                <strong className="text-ink font-semibold">{currentEval.currentFunding}</strong>
              </span>
            </div>
          </div>

          {/* Overall Readiness Gauge & Actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-xs">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white text-xl font-bold shadow-md shadow-brand/20">
                {computedLiveScore}%
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-ink-3 block">
                  Readiness Index
                </span>
                <span className="font-bold text-xs text-ink block">{computedLiveTier}</span>
                <span className="text-[10px] text-teal font-medium">
                  {computedLiveScore >= 75 ? "Eligible for VC Pitch" : "Pre-Seed Milestone Target"}
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                onClick={handleExportBrief}
                className="h-10 px-3 text-xs gap-1.5"
                title="Export investor readiness one-pager brief"
              >
                <Download className="size-3.5" />
                <span className="hidden sm:inline">Export Brief</span>
              </Button>
              <Button
                onClick={handleSaveEvaluation}
                disabled={saveMutation.isPending}
                className="h-10 px-4 text-xs gap-1.5 bg-brand-gradient text-white shadow-md shadow-brand/20"
              >
                <Save className="size-4" />
                <span>{saveMutation.isPending ? "Saving..." : "Save Evaluation"}</span>
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* MAIN TWO-COLUMN SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: 6-DIMENSION SCORECARD RUBRIC (7 COLS) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between pb-3 border-b border-line mb-4">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-ink">
                  Investor Readiness Rubric (6 Core Dimensions)
                </h3>
                <p className="text-xs text-ink-3">
                  Benchmark thresholds set by institutional angel networks & seed grants
                </p>
              </div>
              <Target className="size-5 text-brand" />
            </div>

            {/* Dimensional Sliders */}
            <div className="space-y-4">
              {currentEval.dimensions.map((dim) => {
                const currentVal = localScores[dim.id] ?? dim.score;
                const status =
                  currentVal > dim.benchmark + 5
                    ? "Exceeds Benchmark"
                    : currentVal < dim.benchmark - 5
                    ? "Below Benchmark"
                    : "On Target";

                return (
                  <div
                    key={dim.id}
                    className="rounded-xl border border-line bg-surface-2/40 p-3 sm:p-4 space-y-2 hover:bg-surface-2/70 transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs sm:text-sm text-ink">{dim.name}</span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              status === "Exceeds Benchmark"
                                ? "bg-teal-soft text-teal"
                                : status === "On Target"
                                ? "bg-brand-soft text-brand"
                                : "bg-rose-soft text-rose"
                            )}
                          >
                            {status}
                          </span>
                        </div>
                        <p className="text-[11px] text-ink-3 mt-0.5">{dim.description}</p>
                      </div>

                      {/* Score Badge */}
                      <div className="text-right shrink-0">
                        <span className="text-lg font-bold text-ink font-mono">{currentVal}</span>
                        <span className="text-[10px] text-ink-3 block">
                          target {dim.benchmark}%
                        </span>
                      </div>
                    </div>

                    {/* Interactive Slider & Progress */}
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={currentVal}
                          onChange={(e) =>
                            setLocalScores((prev) => ({
                              ...prev,
                              [dim.id]: Number(e.target.value),
                            }))
                          }
                          className="w-full accent-brand cursor-pointer h-2 bg-surface-2 rounded-lg"
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-ink-3 font-mono">
                        <span>0%</span>
                        <span className="text-brand font-semibold">
                          Institutional Benchmark ({dim.benchmark}%)
                        </span>
                        <span>100%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Target Funding Input */}
            <div className="mt-5 pt-4 border-t border-line">
              <label className="block text-xs font-semibold text-ink">
                Target Fundraising Round & Amount
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="text"
                  value={localFundingTarget}
                  onChange={(e) => setLocalFundingTarget(e.target.value)}
                  placeholder="e.g. ₹25,00,000 (Seed Round)"
                  className={cn(inputClass, "text-xs sm:text-sm")}
                />
              </div>
            </div>
          </Card>

          {/* EVALUATOR NOTES */}
          <Card className="p-4 sm:p-5">
            <h3 className="text-xs sm:text-sm font-bold text-ink mb-1">
              Incubation Head & Evaluation Committee Notes
            </h3>
            <p className="text-[11px] text-ink-3 mb-2.5">
              Internal assessment notes visible to college incubation leadership
            </p>
            <textarea
              rows={3}
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              placeholder="Enter assessment feedback, investor alignment remarks, or funding panel directions..."
              className={cn(inputClass, "text-xs resize-none")}
            />
          </Card>
        </div>

        {/* RIGHT COLUMN: DILIGENCE CHECKLIST & ACTION PLAN (5 COLS) */}
        <div className="lg:col-span-5 space-y-4">
          {/* DILIGENCE DOCUMENT VERIFICATION CHECKLIST */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between pb-2.5 border-b border-line mb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-teal" />
                <h3 className="text-xs sm:text-sm font-bold text-ink">
                  Investor Diligence Checklist
                </h3>
              </div>
              <Badge tone="teal" className="text-[10px]">
                {localDiligence.filter((d) => d.verified).length} of {localDiligence.length}{" "}
                Verified
              </Badge>
            </div>

            <div className="space-y-2">
              {localDiligence.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleToggleDiligence(item.id)}
                  className={cn(
                    "flex items-start gap-2.5 rounded-xl border p-2.5 text-xs transition cursor-pointer select-none",
                    item.verified
                      ? "border-teal/30 bg-teal-soft/20 text-ink"
                      : "border-line bg-surface hover:bg-surface-2 text-ink-3"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={item.verified}
                    onChange={() => handleToggleDiligence(item.id)}
                    className="mt-0.5 size-4 accent-teal rounded shrink-0 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "font-semibold text-xs",
                        item.verified ? "text-ink" : "text-ink-2"
                      )}
                    >
                      {item.title}
                    </p>
                    <p className="text-[10px] text-ink-3 mt-0.5 truncate">{item.notes}</p>
                  </div>
                  <span className="text-[9px] uppercase font-bold text-ink-3 shrink-0">
                    {item.category}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* KEY INVESTOR STRENGTHS */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between pb-2 border-b border-line mb-3">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-teal" />
                <h3 className="text-xs sm:text-sm font-bold text-ink">Key Investor Strengths</h3>
              </div>
              <span className="text-[11px] text-teal font-semibold">
                {localStrengths.length} highlights
              </span>
            </div>

            <div className="space-y-2">
              {localStrengths.map((str, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between gap-2 rounded-lg bg-teal-soft/20 p-2 text-xs text-ink border border-teal/20"
                >
                  <span className="leading-relaxed">{str}</span>
                  <button
                    onClick={() =>
                      setLocalStrengths((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="text-ink-3 hover:text-rose p-0.5 transition shrink-0"
                    title="Remove strength"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}

              {/* Add strength */}
              <div className="flex items-center gap-1.5 pt-1">
                <input
                  type="text"
                  value={newStrengthInput}
                  onChange={(e) => setNewStrengthInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newStrengthInput.trim()) {
                      e.preventDefault();
                      setLocalStrengths((prev) => [...prev, newStrengthInput.trim()]);
                      setNewStrengthInput("");
                    }
                  }}
                  placeholder="Add investment strength..."
                  className={cn(inputClass, "h-8 text-xs")}
                />
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (newStrengthInput.trim()) {
                      setLocalStrengths((prev) => [...prev, newStrengthInput.trim()]);
                      setNewStrengthInput("");
                    }
                  }}
                  className="h-8 px-2.5 text-xs"
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>
            </div>
          </Card>

          {/* DILIGENCE GAPS & RISKS */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between pb-2 border-b border-line mb-3">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="size-4 text-rose" />
                <h3 className="text-xs sm:text-sm font-bold text-ink">Critical Diligence Gaps</h3>
              </div>
              <span className="text-[11px] text-rose font-semibold">
                {localGaps.length} gaps
              </span>
            </div>

            <div className="space-y-2">
              {localGaps.map((gap, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between gap-2 rounded-lg bg-rose-soft/20 p-2 text-xs text-ink border border-rose/20"
                >
                  <span className="leading-relaxed">{gap}</span>
                  <button
                    onClick={() => setLocalGaps((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-ink-3 hover:text-rose p-0.5 transition shrink-0"
                    title="Remove gap"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}

              {/* Add gap */}
              <div className="flex items-center gap-1.5 pt-1">
                <input
                  type="text"
                  value={newGapInput}
                  onChange={(e) => setNewGapInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newGapInput.trim()) {
                      e.preventDefault();
                      setLocalGaps((prev) => [...prev, newGapInput.trim()]);
                      setNewGapInput("");
                    }
                  }}
                  placeholder="Flag critical investor gap..."
                  className={cn(inputClass, "h-8 text-xs")}
                />
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (newGapInput.trim()) {
                      setLocalGaps((prev) => [...prev, newGapInput.trim()]);
                      setNewGapInput("");
                    }
                  }}
                  className="h-8 px-2.5 text-xs"
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>
            </div>
          </Card>

          {/* INCUBATION ACTION PLAN */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between pb-2 border-b border-line mb-3">
              <div className="flex items-center gap-1.5">
                <Target className="size-4 text-brand" />
                <h3 className="text-xs sm:text-sm font-bold text-ink">Incubation Action Plan</h3>
              </div>
              <span className="text-[11px] text-brand font-semibold">
                {localActionPlan.length} milestones
              </span>
            </div>

            <div className="space-y-2">
              {localActionPlan.map((action, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between gap-2 rounded-lg bg-surface-2 p-2 text-xs text-ink border border-line"
                >
                  <div className="flex items-start gap-2">
                    <span className="rounded bg-brand text-white size-4 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed">{action}</span>
                  </div>
                  <button
                    onClick={() =>
                      setLocalActionPlan((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="text-ink-3 hover:text-rose p-0.5 transition shrink-0"
                    title="Remove action"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}

              {/* Add Action Item */}
              <div className="flex items-center gap-1.5 pt-1">
                <input
                  type="text"
                  value={newActionInput}
                  onChange={(e) => setNewActionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newActionInput.trim()) {
                      e.preventDefault();
                      setLocalActionPlan((prev) => [...prev, newActionInput.trim()]);
                      setNewActionInput("");
                    }
                  }}
                  placeholder="Add target milestone action..."
                  className={cn(inputClass, "h-8 text-xs")}
                />
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (newActionInput.trim()) {
                      setLocalActionPlan((prev) => [...prev, newActionInput.trim()]);
                      setNewActionInput("");
                    }
                  }}
                  className="h-8 px-2.5 text-xs"
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
