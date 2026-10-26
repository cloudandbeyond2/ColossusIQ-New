"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  Award,
  CheckCircle2,
  ChevronRight,
  Download,
  ExternalLink,
  Filter,
  Flame,
  Kanban,
  Lightbulb,
  List,
  MoreVertical,
  Plus,
  Rocket,
  Search,
  Sparkles,
  Star,
  Trash2,
  TrendingUp,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { apiFetch, ApiError } from "@/lib/api/client";
import {
  INCUBATION_DOMAINS,
  INCUBATION_STAGES,
  IncubationPipelineOverview,
  PipelineVenture,
  type CreateVentureInput,
  type IncubationStage,
  type ReviewVentureInput,
} from "@/lib/api/incubation-schemas";
import type { Role } from "@/lib/auth/roles";
import { TemplateSkeleton } from "@/components/modules/shared";
import { LoadError } from "@/components/ui/load-error";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Progress,
  Skeleton,
  Spinner,
  inputClass,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const DOMAIN_TONES: Record<string, "brand" | "teal" | "amber" | "rose" | "sky" | "neutral"> = {
  AgriTech: "teal",
  HealthTech: "rose",
  "CleanTech & IoT": "sky",
  "AI & DeepTech": "brand",
  EdTech: "amber",
  "FinTech & Web3": "brand",
  "Robotics & Hardware": "amber",
};

const STAGE_COLORS: Record<IncubationStage, { badge: "neutral" | "sky" | "amber" | "brand" | "teal" | "rose"; bar: string }> = {
  Idea: { badge: "neutral", bar: "bg-surface-3 text-ink-3" },
  Validation: { badge: "sky", bar: "bg-sky-soft text-sky" },
  "Business Model & MVP": { badge: "amber", bar: "bg-gold-soft text-amber" },
  "Prototyping & Mentorship": { badge: "brand", bar: "bg-brand/10 text-brand" },
  "Incubation Review": { badge: "rose", bar: "bg-rose-soft text-rose" },
  Incubated: { badge: "teal", bar: "bg-teal-soft text-teal" },
};

export function IncubationPipelineModule({ role: _role }: { role?: Role }) {
  const qc = useQueryClient();
  const [pickedCohort, setPickedCohort] = useState<string>("");
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState<string>("All");
  const [stageFilter, setStageFilter] = useState<string>("All");
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [reviewingVenture, setReviewingVenture] = useState<PipelineVenture | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const queryKey = ["incubation-pipeline", pickedCohort];

  const query = useQuery({
    queryKey,
    queryFn: () =>
      apiFetch(
        `/api/v1/incubation-pipeline?cohort=${encodeURIComponent(pickedCohort)}`,
        IncubationPipelineOverview
      ),
  });
  // The server picks the cohort when none is chosen yet (the newest one with ventures).
  const selectedCohort = query.data?.cohort ?? pickedCohort;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Mutation: Create Venture
  const createMutation = useMutation({
    mutationFn: (body: CreateVentureInput) =>
      apiFetch("/api/v1/incubation-pipeline/ventures", PipelineVenture, {
        method: "POST",
        body,
      }),
    onSuccess: (newV) => {
      qc.invalidateQueries({ queryKey: ["incubation-pipeline"] });
      setIsAddOpen(false);
      showToast(`Venture "${newV.name}" added to pipeline!`);
    },
  });

  // Mutation: Advance Stage
  const stageMutation = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: IncubationStage }) =>
      apiFetch(`/api/v1/incubation-pipeline/ventures/${encodeURIComponent(id)}/stage`, PipelineVenture, {
        method: "PATCH",
        body: { stage },
      }),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["incubation-pipeline"] });
      showToast(`Moved "${updated.name}" to ${updated.stage}`);
    },
  });

  // Mutation: Review Venture
  const reviewMutation = useMutation({
    mutationFn: ({ id, review }: { id: string; review: ReviewVentureInput }) =>
      apiFetch(`/api/v1/incubation-pipeline/ventures/${encodeURIComponent(id)}/review`, PipelineVenture, {
        method: "POST",
        body: review,
      }),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["incubation-pipeline"] });
      setReviewingVenture(null);
      showToast(`Review saved for "${updated.name}" (${updated.reviewVerdict})`);
    },
  });

  // Mutation: Delete Venture
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/incubation-pipeline/ventures/${encodeURIComponent(id)}`, z.object({ ok: z.boolean() }), {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["incubation-pipeline"] });
      showToast("Venture removed from pipeline.");
    },
  });

  const filteredVentures = useMemo(() => {
    if (!query.data?.ventures) return [];
    return query.data.ventures.filter((v) => {
      const matchesStage = stageFilter === "All" || v.stage === stageFilter;
      const matchesDomain = domainFilter === "All" || v.domain === domainFilter;
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        v.name.toLowerCase().includes(q) ||
        v.tagline.toLowerCase().includes(q) ||
        v.leadFounder.toLowerCase().includes(q) ||
        v.department.toLowerCase().includes(q) ||
        v.founders.some((f) => f.toLowerCase().includes(q));
      return matchesStage && matchesDomain && matchesSearch;
    });
  }, [query.data?.ventures, stageFilter, domainFilter, search]);

  const handleExportCsv = () => {
    if (!filteredVentures.length) return;
    const headers = [
      "Venture Name",
      "Tagline",
      "Domain",
      "Stage",
      "Readiness Score",
      "Lead Founder",
      "Lead Email",
      "Department",
      "Assigned Mentor",
      "Seed Grant",
      "Review Verdict",
    ];
    const rows = filteredVentures.map((v) => [
      `"${v.name.replace(/"/g, '""')}"`,
      `"${v.tagline.replace(/"/g, '""')}"`,
      `"${v.domain}"`,
      `"${v.stage}"`,
      v.readinessScore,
      `"${v.leadFounder}"`,
      `"${v.leadEmail}"`,
      `"${v.department}"`,
      `"${v.mentorName}"`,
      `"${v.grantAmount}"`,
      `"${v.reviewVerdict || "Pending"}"`,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `incubation-pipeline-${selectedCohort.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (query.isLoading) return <TemplateSkeleton />;
  if (query.error || !query.data) {
    return <LoadError error={query.error} onRetry={() => void query.refetch()} />;
  }

  const { totalVentures, inReviewCount, incubatedCount, seedGrantsTotal, totalMentors, stages, availableCohorts } =
    query.data;

  const renderVentureCard = (v: PipelineVenture) => (
    <Card
      key={v.id}
      className="group relative flex flex-col justify-between p-3.5 transition-all hover:border-line-2 hover:shadow-md"
    >
      <div>
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <Badge tone={DOMAIN_TONES[v.domain] ?? "brand"} className="text-[10px]">
            {v.domain}
          </Badge>
          <span className="text-[10px] font-semibold text-ink-3 tabular-nums">
            {v.readinessScore}% ready
          </span>
        </div>

        <h4 className="text-xs font-bold text-ink group-hover:text-brand line-clamp-1">
          {v.name}
        </h4>
        <p className="mt-1 text-[11px] text-ink-2 line-clamp-2 leading-relaxed">
          {v.tagline}
        </p>

        {/* Readiness score bar */}
        <div className="mt-2.5">
          <Progress
            value={v.readinessScore}
            tone={v.readinessScore >= 85 ? "teal" : v.readinessScore >= 70 ? "brand" : "amber"}
          />
        </div>

        {/* Founders & Dept */}
        <div className="mt-2.5 space-y-1 text-[11px] text-ink-3">
          <div className="flex items-center gap-1.5 truncate">
            <Users className="size-3 shrink-0 text-ink-3" />
            <span className="truncate">
              {v.leadFounder} {v.founders.length > 1 ? `+${v.founders.length - 1}` : ""}
            </span>
          </div>
          <div className="truncate text-[10px] text-ink-3">
            {v.department}
          </div>
        </div>

        {/* Grant & Mentor info */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5 pt-2 border-t border-line/60 text-[10px]">
          {v.grantAmount !== "—" && (
            <span className="inline-flex items-center gap-1 rounded bg-gold-soft px-1.5 py-0.5 font-medium text-amber">
              <Award className="size-3" /> {v.grantAmount.split(" ")[0]}
            </span>
          )}
          <span className="truncate text-ink-3">
            Mentor: <span className="font-medium text-ink">{v.mentorName}</span>
          </span>
        </div>

        {/* Review badge if reviewed */}
        {v.reviewVerdict && v.reviewVerdict !== "Pending Review" && (
          <div className="mt-2 flex items-center justify-between rounded bg-surface-2 px-2 py-1 text-[10px]">
            <span className="truncate font-semibold text-ink">{v.reviewVerdict}</span>
            <span className="shrink-0 font-bold text-brand">{v.reviewScore}/100</span>
          </div>
        )}
      </div>

      {/* Actions Footer */}
      <div className="mt-3 flex items-center justify-between gap-1.5 border-t border-line/60 pt-2">
        {/* Stage Transition Selector */}
        <select
          value={v.stage}
          onChange={(e) =>
            stageMutation.mutate({
              id: v.id,
              stage: e.target.value as IncubationStage,
            })
          }
          className="h-7 max-w-[125px] sm:max-w-[140px] truncate rounded border border-line bg-surface px-1.5 text-[10px] font-medium text-ink hover:bg-surface-2"
        >
          {INCUBATION_STAGES.map((s) => (
            <option key={s} value={s}>
              → {s}
            </option>
          ))}
        </select>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="secondary"
            onClick={() => setReviewingVenture(v)}
            className="h-7 px-2 text-[10px]"
          >
            Review
          </Button>
          <button
            onClick={() => {
              if (confirm(`Remove venture "${v.name}" from the pipeline?`)) {
                deleteMutation.mutate(v.id);
              }
            }}
            className="rounded p-1 text-ink-3 hover:bg-rose-soft hover:text-rose transition"
            title="Delete venture"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Toast Notification */}
      {toast ? (
        <div className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-50 flex items-center gap-2 rounded-lg bg-ink px-3.5 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm text-surface shadow-xl">
          <Sparkles className="size-4 text-gold shrink-0" />
          <span>{toast}</span>
        </div>
      ) : null}

      {/* KPI Overview Strip - Fully responsive across mobile, tablet, and desktop */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-ink-3">Total Ventures</span>
            <Rocket className="size-3.5 sm:size-4 text-brand" />
          </div>
          <p className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold tracking-tight text-ink">{totalVentures}</p>
          <span className="text-[10px] sm:text-xs text-ink-3 line-clamp-1">In active {selectedCohort}</span>
        </Card>

        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-ink-3">In Panel Review</span>
            <Flame className="size-3.5 sm:size-4 text-rose" />
          </div>
          <p className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold tracking-tight text-ink">{inReviewCount}</p>
          <span className="text-[10px] sm:text-xs text-rose font-medium line-clamp-1">Scheduled for decision</span>
        </Card>

        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-ink-3">Incubated</span>
            <Award className="size-3.5 sm:size-4 text-teal" />
          </div>
          <p className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold tracking-tight text-ink">{incubatedCount}</p>
          <span className="text-[10px] sm:text-xs text-teal font-medium line-clamp-1">Admitted into cell</span>
        </Card>

        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-ink-3">Seed Grants</span>
            <TrendingUp className="size-3.5 sm:size-4 text-gold" />
          </div>
          <p className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold tracking-tight text-ink">{seedGrantsTotal}</p>
          <span className="text-[10px] sm:text-xs text-ink-3 line-clamp-1">Disbursed & approved</span>
        </Card>

        <Card className="col-span-2 sm:col-span-1 p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-ink-3">Active Mentors</span>
            <UserCheck className="size-3.5 sm:size-4 text-sky" />
          </div>
          <p className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold tracking-tight text-ink">{totalMentors}</p>
          <span className="text-[10px] sm:text-xs text-ink-3 line-clamp-1">Faculty & industry network</span>
        </Card>
      </div>

      {/* Interactive Visual Stage Stepper */}
      <Card className="p-3.5 sm:p-5">
        <div className="mb-2.5 sm:mb-3 flex flex-wrap items-center justify-between gap-1">
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-ink">Incubation Stage Progression</h3>
            <p className="text-[10px] sm:text-xs text-ink-3">Tap any phase to filter the pipeline</p>
          </div>
          {stageFilter !== "All" && (
            <button
              onClick={() => setStageFilter("All")}
              className="text-[11px] sm:text-xs font-medium text-brand hover:underline"
            >
              Reset to all stages
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {stages.map((stg, idx) => {
            const isSelected = stageFilter === stg.stage;
            return (
              <button
                key={stg.stage}
                onClick={() => setStageFilter(isSelected ? "All" : stg.stage)}
                className={cn(
                  "flex flex-col justify-between rounded-lg border p-2.5 sm:p-3 text-left transition-all",
                  isSelected
                    ? "border-brand bg-brand/5 shadow-xs"
                    : "border-line bg-surface hover:border-line-2 hover:bg-surface-2"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-[11px] font-bold text-ink-3">PHASE {idx + 1}</span>
                  <span
                    className={cn(
                      "flex size-4.5 sm:size-5 items-center justify-center rounded-full text-[10px] sm:text-xs font-bold",
                      STAGE_COLORS[stg.stage].bar
                    )}
                  >
                    {stg.count}
                  </span>
                </div>
                <div className="mt-1.5 sm:mt-2">
                  <p className="text-[11px] sm:text-xs font-semibold text-ink line-clamp-1">{stg.label}</p>
                  <p className="text-[9px] sm:text-[10px] text-ink-3 line-clamp-1">{stg.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Filter & Action Toolbar - Responsive for all mobile & desktop viewports */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-2.5">
          {/* Cohort Selector */}
          <select
            value={selectedCohort}
            onChange={(e) => setPickedCohort(e.target.value)}
            className={cn(inputClass, "h-9 w-full sm:w-48 text-xs font-medium")}
          >
            {availableCohorts.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Domain Filter */}
          <select
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            className={cn(inputClass, "h-9 w-full sm:w-36 text-xs")}
          >
            <option value="All">All Domains</option>
            {INCUBATION_DOMAINS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Search Box */}
          <div className="relative w-full sm:w-56 md:w-64">
            <Search className="absolute left-2.5 top-2.5 size-4 text-ink-3" />
            <input
              type="text"
              placeholder="Search ventures, founders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(inputClass, "h-9 pl-9 pr-8 text-xs w-full")}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-2.5 text-ink-3 hover:text-ink"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2">
          {/* View Toggle */}
          <div className="flex rounded-lg border border-line bg-surface p-0.5">
            <button
              onClick={() => setViewMode("kanban")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
                viewMode === "kanban" ? "bg-surface-2 text-ink shadow-xs" : "text-ink-3 hover:text-ink"
              )}
            >
              <Kanban className="size-3.5" /> Board
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
                viewMode === "table" ? "bg-surface-2 text-ink shadow-xs" : "text-ink-3 hover:text-ink"
              )}
            >
              <List className="size-3.5" /> Table
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleExportCsv} className="h-9 px-2.5 sm:px-3 gap-1.5 text-xs">
              <Download className="size-3.5" /> <span className="hidden sm:inline">Export</span> CSV
            </Button>

            <Button onClick={() => setIsAddOpen(true)} className="h-9 px-2.5 sm:px-3 gap-1.5 text-xs">
              <Plus className="size-3.5" /> Add Venture
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content: Kanban or Table */}
      {filteredVentures.length === 0 ? (
        <EmptyState
          title="No ventures match your filter"
          body="Try resetting the stage or domain filters, or register a new venture into the incubation pipeline."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setStageFilter("All");
                setDomainFilter("All");
                setSearch("");
              }}
            >
              Clear Filters
            </Button>
          }
        />
      ) : viewMode === "kanban" ? (
        /* KANBAN STAGE PIPELINE VIEW:
           - When stageFilter === "All": Smooth horizontal-scrolling Kanban columns (300px min-width each, snap-aligned)
             guaranteeing perfect layout without column cramping on phones, tablets, and laptops!
           - When filtered to a single stage: Renders a spacious responsive card grid! */
        stageFilter === "All" ? (
          <div className="relative -mx-4 sm:mx-0">
            <div className="flex gap-3.5 sm:gap-4 overflow-x-auto px-4 sm:px-0 pb-4 pt-1 snap-x snap-mandatory">
              {INCUBATION_STAGES.map((stg) => {
                const stageVentures = filteredVentures.filter((v) => v.stage === stg);
                return (
                  <div
                    key={stg}
                    className="flex w-[275px] sm:w-[295px] md:w-[310px] shrink-0 snap-start flex-col rounded-xl border border-line bg-surface-2/60 p-3"
                  >
                    <div className="mb-3 flex items-center justify-between pb-2 border-b border-line">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-ink">{stg}</span>
                        <span className="rounded-full bg-surface-3 px-1.5 py-0.5 text-[10px] font-bold text-ink-2">
                          {stageVentures.length}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col gap-3 overflow-y-auto max-h-[720px] pr-0.5">
                      {stageVentures.length === 0 ? (
                        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-line-2 p-6 text-center text-xs text-ink-3">
                          No ventures at this stage
                        </div>
                      ) : (
                        stageVentures.map(renderVentureCard)
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Filtered Single Stage Grid */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink">
                Showing {filteredVentures.length} venture{filteredVentures.length === 1 ? "" : "s"} in{" "}
                <span className="text-brand font-semibold">{stageFilter}</span>
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
              {filteredVentures.map(renderVentureCard)}
            </div>
          </div>
        )
      ) : (
        /* TABLE VIEW - Fully horizontally scrollable with responsive padding */
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-xs">
              <thead className="border-b border-line bg-surface-2 text-ink-3">
                <tr>
                  <th className="px-3.5 sm:px-4 py-3 font-semibold">Venture</th>
                  <th className="px-3.5 sm:px-4 py-3 font-semibold">Domain</th>
                  <th className="px-3.5 sm:px-4 py-3 font-semibold">Current Stage</th>
                  <th className="px-3.5 sm:px-4 py-3 font-semibold">Readiness</th>
                  <th className="px-3.5 sm:px-4 py-3 font-semibold">Founders / Dept</th>
                  <th className="px-3.5 sm:px-4 py-3 font-semibold">Mentor</th>
                  <th className="px-3.5 sm:px-4 py-3 font-semibold">Seed Grant</th>
                  <th className="px-3.5 sm:px-4 py-3 font-semibold">Panel Review</th>
                  <th className="px-3.5 sm:px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredVentures.map((v) => (
                  <tr key={v.id} className="hover:bg-surface-2/40 transition">
                    <td className="px-3.5 sm:px-4 py-3 max-w-[220px]">
                      <p className="font-bold text-ink truncate">{v.name}</p>
                      <p className="text-[11px] text-ink-3 line-clamp-1">{v.tagline}</p>
                    </td>
                    <td className="px-3.5 sm:px-4 py-3">
                      <Badge tone={DOMAIN_TONES[v.domain] ?? "brand"}>{v.domain}</Badge>
                    </td>
                    <td className="px-3.5 sm:px-4 py-3">
                      <select
                        value={v.stage}
                        onChange={(e) =>
                          stageMutation.mutate({
                            id: v.id,
                            stage: e.target.value as IncubationStage,
                          })
                        }
                        className="h-7 rounded border border-line bg-surface px-2 text-xs font-semibold text-ink"
                      >
                        {INCUBATION_STAGES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3.5 sm:px-4 py-3">
                      <div className="w-24">
                        <div className="mb-1 flex justify-between text-[10px] text-ink-3">
                          <span>Score</span>
                          <span className="font-bold text-ink">{v.readinessScore}%</span>
                        </div>
                        <Progress value={v.readinessScore} tone={v.readinessScore >= 80 ? "teal" : "brand"} />
                      </div>
                    </td>
                    <td className="px-3.5 sm:px-4 py-3 max-w-[160px]">
                      <p className="font-medium text-ink truncate">{v.leadFounder}</p>
                      <p className="text-[11px] text-ink-3 truncate">{v.department}</p>
                    </td>
                    <td className="px-3.5 sm:px-4 py-3 text-ink-2 truncate max-w-[140px]">{v.mentorName}</td>
                    <td className="px-3.5 sm:px-4 py-3">
                      <span className="font-semibold text-ink whitespace-nowrap">{v.grantAmount}</span>
                    </td>
                    <td className="px-3.5 sm:px-4 py-3 whitespace-nowrap">
                      {v.reviewVerdict && v.reviewVerdict !== "Pending Review" ? (
                        <div>
                          <span className="inline-block rounded bg-teal-soft px-1.5 py-0.5 text-[10px] font-semibold text-teal">
                            {v.reviewVerdict}
                          </span>
                          <span className="ml-1 text-[10px] font-bold text-ink-3">{v.reviewScore}/100</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-ink-3">Pending Panel</span>
                      )}
                    </td>
                    <td className="px-3.5 sm:px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="secondary"
                          onClick={() => setReviewingVenture(v)}
                          className="h-7 px-2.5 text-xs"
                        >
                          Review
                        </Button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete venture "${v.name}"?`)) {
                              deleteMutation.mutate(v.id);
                            }
                          }}
                          className="rounded p-1 text-ink-3 hover:text-rose transition"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* MODAL 1: ADD VENTURE - Scrollable & Responsive on all mobile screens */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
          <Card className="w-full max-w-lg p-4 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[92vh] flex flex-col my-auto">
            <div className="mb-3.5 flex items-center justify-between border-b border-line pb-3 shrink-0">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-ink">Register New Venture</h3>
                <p className="text-[11px] sm:text-xs text-ink-3">Add a venture into the incubation pipeline</p>
              </div>
              <button onClick={() => setIsAddOpen(false)} className="rounded p-1 text-ink-3 hover:text-ink">
                <X className="size-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const fd = new FormData(form);
                const foundersStr = String(fd.get("founders") || "");
                const founders = foundersStr
                  ? foundersStr.split(",").map((s) => s.trim()).filter(Boolean)
                  : [];

                createMutation.mutate({
                  name: String(fd.get("name")),
                  tagline: String(fd.get("tagline")),
                  domain: String(fd.get("domain")),
                  cohort: selectedCohort,
                  stage: (fd.get("stage") as IncubationStage) || "Idea",
                  leadFounder: String(fd.get("leadFounder")),
                  leadEmail: String(fd.get("leadEmail")),
                  founders,
                  department: String(fd.get("department")),
                  mentorName: String(fd.get("mentorName") || "Unassigned"),
                  pitchDeckUrl: String(fd.get("pitchDeckUrl") || ""),
                  demoUrl: String(fd.get("demoUrl") || ""),
                });
              }}
              className="space-y-3.5 text-xs overflow-y-auto pr-1"
            >
              <div>
                <label className="block font-semibold text-ink">Venture Name *</label>
                <input
                  name="name"
                  required
                  placeholder="e.g. TerraScan Drone Mapping"
                  className={cn(inputClass, "mt-1")}
                />
              </div>

              <div>
                <label className="block font-semibold text-ink">One-line Tagline / Value Proposition *</label>
                <input
                  name="tagline"
                  required
                  placeholder="Autonomous LiDAR thermal survey for solar plant degradation"
                  className={cn(inputClass, "mt-1")}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink">Domain Sector *</label>
                  <select name="domain" className={cn(inputClass, "mt-1")}>
                    {INCUBATION_DOMAINS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-ink">Initial Pipeline Stage</label>
                  <select name="stage" className={cn(inputClass, "mt-1")}>
                    {INCUBATION_STAGES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink">Lead Founder *</label>
                  <input
                    name="leadFounder"
                    required
                    placeholder="Student founder name"
                    className={cn(inputClass, "mt-1")}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink">Lead Email *</label>
                  <input
                    name="leadEmail"
                    type="email"
                    required
                    placeholder="student@ait.edu.in"
                    className={cn(inputClass, "mt-1")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink">Department *</label>
                  <input
                    name="department"
                    required
                    placeholder="e.g. Computer Science & Engg"
                    className={cn(inputClass, "mt-1")}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink">Assigned Mentor</label>
                  <input
                    name="mentorName"
                    placeholder="Faculty or Industry Mentor"
                    className={cn(inputClass, "mt-1")}
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-ink">Co-Founders (comma separated)</label>
                <input
                  name="founders"
                  placeholder="Karthik R., Divya M., Arun S."
                  className={cn(inputClass, "mt-1")}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink">Pitch Deck URL</label>
                  <input
                    name="pitchDeckUrl"
                    placeholder="https://drive.google.com/..."
                    className={cn(inputClass, "mt-1")}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink">Demo / Prototype URL</label>
                  <input
                    name="demoUrl"
                    placeholder="https://prototype.ait.edu.in"
                    className={cn(inputClass, "mt-1")}
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 border-t border-line pt-3.5 shrink-0">
                <Button variant="secondary" type="button" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Spinner className="size-4" /> : "Add to Pipeline"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL 2: PANEL REVIEW & EVALUATION - Scrollable & Responsive */}
      {reviewingVenture && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
          <Card className="w-full max-w-lg p-4 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[92vh] flex flex-col my-auto">
            <div className="mb-3.5 flex items-center justify-between border-b border-line pb-3 shrink-0">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-ink">Incubation Panel Evaluation</h3>
                <p className="text-[11px] sm:text-xs text-ink-3">
                  Reviewing: <span className="font-semibold text-ink">{reviewingVenture.name}</span>
                </p>
              </div>
              <button
                onClick={() => setReviewingVenture(null)}
                className="rounded p-1 text-ink-3 hover:text-ink"
              >
                <X className="size-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const fd = new FormData(form);
                reviewMutation.mutate({
                  id: reviewingVenture.id,
                  review: {
                    verdict: String(fd.get("verdict")),
                    score: Number(fd.get("score")),
                    grantAmount: String(fd.get("grantAmount") || reviewingVenture.grantAmount),
                    mentorName: String(fd.get("mentorName") || reviewingVenture.mentorName),
                    notes: String(fd.get("notes")),
                  },
                });
              }}
              className="space-y-3.5 text-xs overflow-y-auto pr-1"
            >
              <div className="rounded-lg bg-surface-2 p-3">
                <p className="font-semibold text-ink">{reviewingVenture.tagline}</p>
                <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-ink-3">
                  <span>Founder: {reviewingVenture.leadFounder}</span>
                  <span>·</span>
                  <span>Dept: {reviewingVenture.department}</span>
                  <span>·</span>
                  <span>Current: {reviewingVenture.stage}</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-ink">Panel Verdict *</label>
                <select
                  name="verdict"
                  defaultValue={reviewingVenture.reviewVerdict || "Approved for Incubation"}
                  className={cn(inputClass, "mt-1")}
                >
                  <option value="Approved for Incubation">Approved for Incubation (Admit to Cell)</option>
                  <option value="Recommended for Grant">Recommended for Seed Grant</option>
                  <option value="Needs Iteration">Needs Further Prototyping & Iteration</option>
                  <option value="Deferred">Deferred for Next Cohort</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block font-semibold text-ink">Readiness / Evaluation Score (0–100)</label>
                  <span id="score-val" className="font-bold text-brand text-sm">
                    {reviewingVenture.reviewScore || 85}
                  </span>
                </div>
                <input
                  type="range"
                  name="score"
                  min="30"
                  max="100"
                  defaultValue={reviewingVenture.reviewScore || 85}
                  onChange={(e) => {
                    const el = document.getElementById("score-val");
                    if (el) el.textContent = e.target.value;
                  }}
                  className="mt-1 w-full accent-brand"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink">Grant Allocation (if approved)</label>
                  <input
                    name="grantAmount"
                    defaultValue={reviewingVenture.grantAmount}
                    placeholder="e.g. ₹2,00,000 (Seed Grant)"
                    className={cn(inputClass, "mt-1")}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink">Assigned Mentor</label>
                  <input
                    name="mentorName"
                    defaultValue={reviewingVenture.mentorName}
                    placeholder="Dr. Meena Raghavan"
                    className={cn(inputClass, "mt-1")}
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-ink">Panel Remarks & Next Steps *</label>
                <textarea
                  name="notes"
                  rows={3}
                  required
                  defaultValue={reviewingVenture.reviewNotes || ""}
                  placeholder="Key strengths, milestone targets before grant disbursement, customer validation requirements..."
                  className={cn(inputClass, "mt-1 py-2")}
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 border-t border-line pt-3.5 shrink-0">
                <Button variant="secondary" type="button" onClick={() => setReviewingVenture(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={reviewMutation.isPending}>
                  {reviewMutation.isPending ? <Spinner className="size-4" /> : "Save Panel Evaluation"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
