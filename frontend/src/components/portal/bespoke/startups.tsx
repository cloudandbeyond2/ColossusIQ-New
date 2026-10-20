"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Award,
  Building2,
  Calendar,
  CheckCircle2,
  Coins,
  Download,
  ExternalLink,
  FileCheck,
  FileText,
  Filter,
  GraduationCap,
  Handshake,
  Lightbulb,
  Mail,
  Plus,
  Rocket,
  Search,
  Sparkles,
  TrendingUp,
  Trash2,
  User,
  Users,
  X,
  Edit3,
} from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { apiFetch, ApiError } from "@/lib/api/client";
import {
  INCORPORATION_STATUSES,
  PATENT_STATUSES,
  STARTUP_DOMAINS,
  STARTUP_STAGES,
  StartupItem,
  StartupPortfolioOverview,
  type CreateStartupInput,
  type IncorporationStatus,
  type PatentStatus,
  type StartupDomain,
  type StartupStage,
  type UpdateStartupInput,
} from "@/lib/api/startup-schemas";
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

const STAGE_TONES: Record<StartupStage, "neutral" | "sky" | "brand" | "amber" | "teal"> = {
  Ideation: "neutral",
  "Early Prototype": "sky",
  "MVP Live": "brand",
  "Commercial Pilot": "amber",
  "Growth & Scaling": "teal",
};

const DOMAIN_TONES: Record<StartupDomain, "teal" | "rose" | "sky" | "brand" | "amber" | "gold"> = {
  AgriTech: "teal",
  HealthTech: "rose",
  "CleanTech & IoT": "sky",
  "AI & DeepTech": "brand",
  EdTech: "amber",
  "FinTech & Web3": "gold",
  "Robotics & Hardware": "teal",
};

export function StartupsPortfolioModule({ role: _role }: { role?: Role }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState<string>("All");
  const [stageFilter, setStageFilter] = useState<string>("All");
  const [incorpFilter, setIncorpFilter] = useState<string>("All");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Modals
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [editingStartup, setEditingStartup] = useState<StartupItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  // 1. Fetch Startups Overview
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["incubation-startups"],
    queryFn: () => apiFetch("incubation/startups", StartupPortfolioOverview),
  });

  // 2. Mutations
  const createMutation = useMutation({
    mutationFn: (input: CreateStartupInput) =>
      apiFetch("incubation/startups", StartupItem, {
        method: "POST",
        body: input,
      }),
    onSuccess: (newStartup) => {
      qc.invalidateQueries({ queryKey: ["incubation-startups"] });
      setIsRegisterOpen(false);
      showToast(`Venture "${newStartup.name}" successfully registered into campus incubator!`);
    },
    onError: (err) => {
      showToast(err instanceof ApiError ? err.message : "Failed to register startup.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateStartupInput }) =>
      apiFetch(`incubation/startups/${id}`, StartupItem, {
        method: "PATCH",
        body: input,
      }),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["incubation-startups"] });
      setEditingStartup(null);
      showToast(`Updated milestones for ${updated.name}`);
    },
    onError: (err) => {
      showToast(err instanceof ApiError ? err.message : "Failed to update startup.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`incubation/startups/${id}`, z.object({ ok: z.boolean() }), {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["incubation-startups"] });
      showToast("Startup removed from incubator portfolio.");
    },
    onError: (err) => {
      showToast(err instanceof ApiError ? err.message : "Failed to delete startup.");
    },
  });

  // Filtered Startups
  const filteredStartups = useMemo(() => {
    if (!data?.startups) return [];
    return data.startups.filter((s) => {
      if (domainFilter !== "All" && s.domain !== domainFilter) return false;
      if (stageFilter !== "All" && s.stage !== stageFilter) return false;
      if (incorpFilter !== "All" && s.incorporationStatus !== incorpFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = s.name.toLowerCase().includes(q);
        const matchesTagline = s.tagline.toLowerCase().includes(q);
        const matchesLead = s.leadFounder.toLowerCase().includes(q);
        const matchesMentor = s.assignedMentor.toLowerCase().includes(q);
        const matchesDept = s.department.toLowerCase().includes(q);
        const matchesReg = s.registrationNumber.toLowerCase().includes(q);
        if (!matchesName && !matchesTagline && !matchesLead && !matchesMentor && !matchesDept && !matchesReg) {
          return false;
        }
      }
      return true;
    });
  }, [data?.startups, domainFilter, stageFilter, incorpFilter, search]);

  // CSV Export
  const handleExportCSV = () => {
    if (!filteredStartups.length) return;
    const headers = [
      "Startup Name",
      "Domain",
      "Stage",
      "Incorporation Status",
      "Registration No",
      "Lead Founder",
      "Lead Email",
      "Department",
      "Cohort",
      "Assigned Mentor",
      "Readiness Score (%)",
      "Funding Raised",
      "Revenue (ARR)",
      "Active Commercial Pilots",
      "Patent Status",
      "Status",
    ];

    const rows = filteredStartups.map((s) => [
      `"${s.name.replace(/"/g, '""')}"`,
      `"${s.domain}"`,
      `"${s.stage}"`,
      `"${s.incorporationStatus}"`,
      `"${s.registrationNumber}"`,
      `"${s.leadFounder.replace(/"/g, '""')}"`,
      `"${s.leadEmail}"`,
      `"${s.department.replace(/"/g, '""')}"`,
      `"${s.cohort}"`,
      `"${s.assignedMentor.replace(/"/g, '""')}"`,
      s.readinessScore,
      `"${s.fundingRaised.replace(/"/g, '""')}"`,
      `"${s.revenue.replace(/"/g, '""')}"`,
      s.activePilotsCount,
      `"${s.patentStatus}"`,
      `"${s.status}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `campus-startups-portfolio-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Downloaded startups portfolio CSV.");
  };

  if (isLoading) return <TemplateSkeleton />;
  if (isError || !data) return <LoadError error={error} onRetry={() => { refetch(); }} />;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm text-surface shadow-2xl animate-in fade-in slide-in-from-bottom-2">
          <Sparkles className="size-4 text-brand shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
        {/* KPI 1 */}
        <Card className="p-3 sm:p-4 border-l-4 border-l-brand">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-ink-3">
              Total Startups
            </span>
            <span className="rounded-lg bg-brand-soft p-1.5 text-brand">
              <Rocket className="size-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
              {data.totalStartups}
            </span>
            <span className="text-[11px] font-medium text-brand">Incubated</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">Active campus venture portfolio</p>
        </Card>

        {/* KPI 2 */}
        <Card className="p-3 sm:p-4 border-l-4 border-l-teal">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-ink-3">
              DPIIT Recognized
            </span>
            <span className="rounded-lg bg-teal-soft p-1.5 text-teal">
              <Award className="size-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
              {data.dpiitRecognizedCount}
            </span>
            <Badge tone="teal" className="text-[10px]">
              Govt Accredited
            </Badge>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">Tax exempt & certified entities</p>
        </Card>

        {/* KPI 3 */}
        <Card className="p-3 sm:p-4 border-l-4 border-l-amber">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-ink-3">
              Funding Mobilized
            </span>
            <span className="rounded-lg bg-amber-soft p-1.5 text-amber">
              <Coins className="size-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-ink truncate">
              {data.totalFundingMobilized}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">Grants, angels & TANSIM seed</p>
        </Card>

        {/* KPI 4 */}
        <Card className="p-3 sm:p-4 border-l-4 border-l-sky">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-ink-3">
              Active Pilots
            </span>
            <span className="rounded-lg bg-sky-soft p-1.5 text-sky">
              <TrendingUp className="size-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
              {data.activeCommercialPilots}
            </span>
            <span className="text-[11px] font-medium text-sky">Deployments</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">Live enterprise & field trials</p>
        </Card>

        {/* KPI 5 */}
        <Card className="p-3 sm:p-4 border-l-4 border-l-indigo-500 col-span-2 md:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-ink-3">
              Patents Filed
            </span>
            <span className="rounded-lg bg-brand-soft p-1.5 text-brand">
              <FileCheck className="size-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
              {data.patentsCount}
            </span>
            <span className="text-[11px] font-medium text-teal">IP Protected</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">Provisional, published & granted</p>
        </Card>
      </div>

      {/* TOOLBAR & CONTROLS */}
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search startup name, founder, mentor, reg no..."
              className={cn(inputClass, "pl-9 text-xs sm:text-sm")}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns & Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Domain Filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="size-3.5 text-ink-3 hidden sm:inline" />
              <select
                value={domainFilter}
                onChange={(e) => setDomainFilter(e.target.value)}
                className="h-9 rounded-xl border border-line bg-surface px-2.5 text-xs text-ink focus:border-brand focus:outline-hidden"
              >
                <option value="All">All Domains</option>
                {STARTUP_DOMAINS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Stage Filter */}
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="h-9 rounded-xl border border-line bg-surface px-2.5 text-xs text-ink focus:border-brand focus:outline-hidden"
            >
              <option value="All">All Stages</option>
              {STARTUP_STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            {/* Incorporation Filter */}
            <select
              value={incorpFilter}
              onChange={(e) => setIncorpFilter(e.target.value)}
              className="h-9 rounded-xl border border-line bg-surface px-2.5 text-xs text-ink focus:border-brand focus:outline-hidden"
            >
              <option value="All">All Legal Structures</option>
              {INCORPORATION_STATUSES.map((inc) => (
                <option key={inc} value={inc}>
                  {inc}
                </option>
              ))}
            </select>

            {/* View Mode Switcher */}
            <div className="flex rounded-xl border border-line bg-surface-2 p-0.5">
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-semibold transition",
                  viewMode === "grid"
                    ? "bg-surface text-ink shadow-xs"
                    : "text-ink-3 hover:text-ink"
                )}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-semibold transition",
                  viewMode === "table"
                    ? "bg-surface text-ink shadow-xs"
                    : "text-ink-3 hover:text-ink"
                )}
              >
                Table
              </button>
            </div>

            {/* Export CSV */}
            <Button
              variant="secondary"
              onClick={handleExportCSV}
              className="h-9 px-3 text-xs gap-1.5"
              title="Export filtered startups to CSV"
            >
              <Download className="size-3.5" />
              <span className="hidden sm:inline">Export</span>
            </Button>

            {/* Register Startup Button */}
            <Button
              onClick={() => setIsRegisterOpen(true)}
              className="h-9 px-3.5 text-xs gap-1.5 bg-brand-gradient text-white shadow-sm"
            >
              <Plus className="size-4" />
              <span>Register Startup</span>
            </Button>
          </div>
        </div>

        {/* Active Filter Chips */}
        {(domainFilter !== "All" || stageFilter !== "All" || incorpFilter !== "All" || search) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-line text-xs">
            <span className="text-ink-3">Active filters:</span>
            {domainFilter !== "All" && (
              <Badge tone="teal" className="gap-1">
                Domain: {domainFilter}
                <button onClick={() => setDomainFilter("All")}>
                  <X className="size-3 hover:text-ink" />
                </button>
              </Badge>
            )}
            {stageFilter !== "All" && (
              <Badge tone="brand" className="gap-1">
                Stage: {stageFilter}
                <button onClick={() => setStageFilter("All")}>
                  <X className="size-3 hover:text-ink" />
                </button>
              </Badge>
            )}
            {incorpFilter !== "All" && (
              <Badge tone="sky" className="gap-1">
                Legal: {incorpFilter}
                <button onClick={() => setIncorpFilter("All")}>
                  <X className="size-3 hover:text-ink" />
                </button>
              </Badge>
            )}
            {search && (
              <Badge tone="neutral" className="gap-1">
                Query: &quot;{search}&quot;
                <button onClick={() => setSearch("")}>
                  <X className="size-3 hover:text-ink" />
                </button>
              </Badge>
            )}
            <button
              onClick={() => {
                setDomainFilter("All");
                setStageFilter("All");
                setIncorpFilter("All");
                setSearch("");
              }}
              className="text-xs text-brand hover:underline font-medium ml-1"
            >
              Clear all
            </button>
          </div>
        )}
      </Card>

      {/* CONTENT: EMPTY STATE OR LIST */}
      {filteredStartups.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            title="No campus startups found"
            body="No startups matched your search and filter criteria. Try clearing filters or register a new campus venture."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch("");
                  setDomainFilter("All");
                  setStageFilter("All");
                  setIncorpFilter("All");
                }}
              >
                Reset Filters
              </Button>
            }
          />
        </Card>
      ) : viewMode === "grid" ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredStartups.map((s) => (
            <Card
              key={s.id}
              className="group flex flex-col justify-between overflow-hidden border border-line bg-surface hover:shadow-lg transition-all duration-200"
            >
              <div className="p-4 sm:p-5">
                {/* Header row: Badges */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2.5">
                  <Badge tone={DOMAIN_TONES[s.domain] ?? "brand"} className="text-[11px] font-semibold">
                    {s.domain}
                  </Badge>
                  <div className="flex items-center gap-1.5">
                    <Badge tone={STAGE_TONES[s.stage] ?? "neutral"} className="text-[10px]">
                      {s.stage}
                    </Badge>
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        s.status === "Active"
                          ? "bg-teal animate-pulse"
                          : s.status === "Graduated"
                          ? "bg-brand"
                          : "bg-amber"
                      )}
                      title={`Status: ${s.status}`}
                    />
                  </div>
                </div>

                {/* Startup Name & Tagline */}
                <h3 className="text-base font-bold text-ink group-hover:text-brand transition flex items-center gap-1.5">
                  {s.name}
                </h3>
                <p className="mt-1 text-xs text-ink-3 line-clamp-2 leading-relaxed">{s.tagline}</p>

                {/* Legal Entity & Registration */}
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-surface-2/60 px-2.5 py-1.5 text-[11px]">
                  <Building2 className="size-3.5 text-brand shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink truncate">{s.incorporationStatus}</p>
                    <p className="text-[10px] text-ink-3 font-mono truncate">{s.registrationNumber}</p>
                  </div>
                </div>

                {/* Readiness Score Progress */}
                <div className="mt-3.5 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-ink-3">Investment Readiness</span>
                    <span className="font-bold text-ink">{s.readinessScore}%</span>
                  </div>
                  <Progress value={s.readinessScore} tone={toneForScore(s.readinessScore)} />
                </div>

                {/* Key Metrics Grid */}
                <div className="mt-3.5 grid grid-cols-2 gap-2 rounded-xl border border-line bg-surface-2/40 p-2.5 text-[11px]">
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-ink-3">
                      Funding Mobilized
                    </span>
                    <span className="font-semibold text-ink truncate block mt-0.5">
                      {s.fundingRaised}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-ink-3">
                      Revenue (ARR)
                    </span>
                    <span className="font-semibold text-teal truncate block mt-0.5">{s.revenue}</span>
                  </div>
                  <div className="pt-1.5 border-t border-line/60">
                    <span className="block text-[10px] uppercase tracking-wider text-ink-3">
                      Commercial Pilots
                    </span>
                    <span className="font-semibold text-ink block mt-0.5">
                      {s.activePilotsCount} {s.activePilotsCount === 1 ? "Pilot" : "Pilots"}
                    </span>
                  </div>
                  <div className="pt-1.5 border-t border-line/60">
                    <span className="block text-[10px] uppercase tracking-wider text-ink-3">
                      Patent / IP
                    </span>
                    <span
                      className={cn(
                        "font-semibold text-[10px] truncate block mt-0.5",
                        s.patentStatus === "Granted"
                          ? "text-teal"
                          : s.patentStatus === "Published"
                          ? "text-brand"
                          : "text-ink-2"
                      )}
                    >
                      {s.patentStatus}
                    </span>
                  </div>
                </div>

                {/* Founder & Mentor Details */}
                <div className="mt-3.5 space-y-2 border-t border-line pt-3 text-xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 truncate">
                      <User className="size-3.5 text-ink-3 shrink-0" />
                      <span className="font-medium text-ink truncate">{s.leadFounder}</span>
                    </div>
                    <span className="text-[10px] text-ink-3 truncate max-w-[120px] text-right">
                      {s.department}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 truncate">
                      <Handshake className="size-3.5 text-amber shrink-0" />
                      <span className="text-ink-3 truncate">
                        Mentor:{" "}
                        <strong className="font-semibold text-ink">{s.assignedMentor}</strong>
                      </span>
                    </div>
                    <span className="text-[10px] text-ink-3">{s.cohort}</span>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="flex items-center justify-between border-t border-line bg-surface-2/30 px-4 py-2.5">
                {/* External links */}
                <div className="flex items-center gap-2">
                  {s.pitchDeckUrl && (
                    <a
                      href={s.pitchDeckUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline"
                      title="Pitch Deck"
                    >
                      <FileText className="size-3" />
                      <span>Deck</span>
                    </a>
                  )}
                  {s.demoUrl && (
                    <a
                      href={s.demoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal hover:underline"
                      title="Live Demo"
                    >
                      <ExternalLink className="size-3" />
                      <span>Demo</span>
                    </a>
                  )}
                  {s.websiteUrl && (
                    <a
                      href={s.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-2 hover:text-ink"
                      title="Website"
                    >
                      <ExternalLink className="size-3" />
                      <span>Web</span>
                    </a>
                  )}
                </div>

                {/* Edit & Delete */}
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="secondary"
                    onClick={() => setEditingStartup(s)}
                    className="h-7 px-2.5 text-[11px] gap-1"
                  >
                    <Edit3 className="size-3" />
                    <span>Update</span>
                  </Button>
                  <button
                    onClick={() => {
                      if (confirm(`Remove "${s.name}" from the incubation portfolio?`)) {
                        deleteMutation.mutate(s.id);
                      }
                    }}
                    className="rounded p-1 text-ink-3 hover:text-rose transition"
                    title="Delete startup"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="border-b border-line bg-surface-2/60 text-ink-3 uppercase tracking-wider text-[10px] font-semibold">
                <tr>
                  <th className="py-3 px-4">Startup & Domain</th>
                  <th className="py-3 px-3">Stage</th>
                  <th className="py-3 px-3">Legal & Reg No</th>
                  <th className="py-3 px-3">Founders & Dept</th>
                  <th className="py-3 px-3">Funding & ARR</th>
                  <th className="py-3 px-3 text-center">Pilots</th>
                  <th className="py-3 px-3">Patent Status</th>
                  <th className="py-3 px-3">Assigned Mentor</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredStartups.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-2/40 transition">
                    {/* Startup & Domain */}
                    <td className="py-3 px-4 max-w-[220px]">
                      <div className="font-bold text-ink flex items-center gap-1.5">
                        <span className="truncate">{s.name}</span>
                        {s.websiteUrl && (
                          <a
                            href={s.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-ink-3 hover:text-brand"
                          >
                            <ExternalLink className="size-3" />
                          </a>
                        )}
                      </div>
                      <div className="mt-0.5">
                        <Badge tone={DOMAIN_TONES[s.domain] ?? "brand"} className="text-[10px]">
                          {s.domain}
                        </Badge>
                      </div>
                    </td>

                    {/* Stage */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <Badge tone={STAGE_TONES[s.stage] ?? "neutral"} className="text-[10px]">
                        {s.stage}
                      </Badge>
                      <div className="mt-1 text-[10px] text-ink-3 font-medium">
                        Score: {s.readinessScore}%
                      </div>
                    </td>

                    {/* Legal & Reg No */}
                    <td className="py-3 px-3 max-w-[160px]">
                      <span className="font-medium text-ink block truncate">
                        {s.incorporationStatus}
                      </span>
                      <span className="text-[10px] font-mono text-ink-3 block truncate">
                        {s.registrationNumber}
                      </span>
                    </td>

                    {/* Founders & Dept */}
                    <td className="py-3 px-3 max-w-[160px]">
                      <span className="font-medium text-ink block truncate">{s.leadFounder}</span>
                      <span className="text-[10px] text-ink-3 block truncate">{s.department}</span>
                    </td>

                    {/* Funding & ARR */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="font-semibold text-ink block">{s.fundingRaised}</span>
                      <span className="text-[10px] text-teal font-medium block">{s.revenue}</span>
                    </td>

                    {/* Commercial Pilots */}
                    <td className="py-3 px-3 text-center whitespace-nowrap font-bold text-ink">
                      {s.activePilotsCount}
                    </td>

                    {/* Patent */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={cn(
                          "rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                          s.patentStatus === "Granted"
                            ? "bg-teal-soft text-teal"
                            : s.patentStatus === "Published"
                            ? "bg-brand-soft text-brand"
                            : "bg-surface-2 text-ink-3"
                        )}
                      >
                        {s.patentStatus}
                      </span>
                    </td>

                    {/* Mentor */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="font-medium text-ink block">{s.assignedMentor}</span>
                      <span className="text-[10px] text-ink-3 block">{s.cohort}</span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="secondary"
                          onClick={() => setEditingStartup(s)}
                          className="h-7 px-2 text-xs"
                        >
                          Update
                        </Button>
                        <button
                          onClick={() => {
                            if (confirm(`Remove "${s.name}" from incubator portfolio?`)) {
                              deleteMutation.mutate(s.id);
                            }
                          }}
                          className="rounded p-1 text-ink-3 hover:text-rose transition"
                          title="Delete startup"
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

      {/* MODAL 1: REGISTER STARTUP */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
          <Card className="w-full max-w-xl p-4 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[92vh] flex flex-col my-auto">
            <div className="mb-3.5 flex items-center justify-between border-b border-line pb-3 shrink-0">
              <div>
                <h3 className="text-base font-bold text-ink">Register Campus Startup</h3>
                <p className="text-xs text-ink-3">
                  Admit a student or faculty venture into the incubator portfolio
                </p>
              </div>
              <button
                onClick={() => setIsRegisterOpen(false)}
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

                createMutation.mutate({
                  name: String(fd.get("name")),
                  tagline: String(fd.get("tagline")),
                  registrationNumber: String(fd.get("registrationNumber") || "Incubation in progress"),
                  domain: fd.get("domain") as StartupDomain,
                  incorporationStatus: fd.get("incorporationStatus") as IncorporationStatus,
                  stage: fd.get("stage") as StartupStage,
                  leadFounder: String(fd.get("leadFounder")),
                  leadEmail: String(fd.get("leadEmail")),
                  department: String(fd.get("department")),
                  cohort: String(fd.get("cohort") || "2026 Innovation Cohort"),
                  assignedMentor: String(fd.get("assignedMentor") || "Unassigned"),
                  readinessScore: Number(fd.get("readinessScore") || 70),
                  fundingRaised: String(fd.get("fundingRaised") || "Bootstrapped"),
                  revenue: String(fd.get("revenue") || "Pre-revenue"),
                  activePilotsCount: Number(fd.get("activePilotsCount") || 0),
                  patentStatus: fd.get("patentStatus") as PatentStatus,
                  pitchDeckUrl: String(fd.get("pitchDeckUrl") || ""),
                  demoUrl: String(fd.get("demoUrl") || ""),
                  websiteUrl: String(fd.get("websiteUrl") || ""),
                  founders: [
                    {
                      name: String(fd.get("leadFounder")),
                      role: "Lead Founder / CEO",
                      email: String(fd.get("leadEmail")),
                    },
                  ],
                });
              }}
              className="space-y-3.5 text-xs overflow-y-auto pr-1"
            >
              {/* Name & Domain */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink">Startup Name *</label>
                  <input
                    name="name"
                    required
                    placeholder="e.g. AgriSoil Sense"
                    className={cn(inputClass, "mt-1")}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink">Domain *</label>
                  <select name="domain" className={cn(inputClass, "mt-1")}>
                    {STARTUP_DOMAINS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tagline */}
              <div>
                <label className="block font-semibold text-ink">Venture Tagline & Solution *</label>
                <input
                  name="tagline"
                  required
                  placeholder="e.g. Low-cost IoT soil health diagnostics with instant NPK telemetry"
                  className={cn(inputClass, "mt-1")}
                />
              </div>

              {/* Incorporation & Stage */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink">Incorporation Status *</label>
                  <select name="incorporationStatus" className={cn(inputClass, "mt-1")}>
                    {INCORPORATION_STATUSES.map((inc) => (
                      <option key={inc} value={inc}>
                        {inc}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-ink">Current Stage *</label>
                  <select name="stage" className={cn(inputClass, "mt-1")}>
                    {STARTUP_STAGES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Registration Number & Patent */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink">Registration / DPIIT Number</label>
                  <input
                    name="registrationNumber"
                    placeholder="e.g. DPIIT-TN-2025-9481 or CIN"
                    className={cn(inputClass, "mt-1")}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink">Patent / IP Status</label>
                  <select name="patentStatus" className={cn(inputClass, "mt-1")}>
                    {PATENT_STATUSES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Founder Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-line">
                <div>
                  <label className="block font-semibold text-ink">Lead Founder Name *</label>
                  <input
                    name="leadFounder"
                    required
                    placeholder="e.g. Anand Kumar"
                    className={cn(inputClass, "mt-1")}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink">Lead Founder Email *</label>
                  <input
                    type="email"
                    name="leadEmail"
                    required
                    placeholder="anand.agri@ait.edu.in"
                    className={cn(inputClass, "mt-1")}
                  />
                </div>
              </div>

              {/* Department & Cohort */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink">Academic Department *</label>
                  <input
                    name="department"
                    required
                    placeholder="e.g. Computer Science & Engineering"
                    className={cn(inputClass, "mt-1")}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink">Cohort</label>
                  <input
                    name="cohort"
                    defaultValue="2026 Innovation Cohort"
                    className={cn(inputClass, "mt-1")}
                  />
                </div>
              </div>

              {/* Assigned Mentor & Initial Readiness */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink">Assigned Domain Mentor</label>
                  <input
                    name="assignedMentor"
                    placeholder="e.g. Dr. Meena Raghavan"
                    className={cn(inputClass, "mt-1")}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink">Readiness Score (0 - 100)</label>
                  <input
                    type="number"
                    name="readinessScore"
                    min={0}
                    max={100}
                    defaultValue={75}
                    className={cn(inputClass, "mt-1")}
                  />
                </div>
              </div>

              {/* Financials & Traction */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-line">
                <div>
                  <label className="block font-semibold text-ink">Funding Mobilized</label>
                  <input
                    name="fundingRaised"
                    defaultValue="₹50,000 (Campus Grant)"
                    placeholder="e.g. ₹5,00,000"
                    className={cn(inputClass, "mt-1")}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink">Revenue (ARR)</label>
                  <input
                    name="revenue"
                    defaultValue="Pre-revenue"
                    placeholder="e.g. ₹1,20,000 ARR"
                    className={cn(inputClass, "mt-1")}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink">Active Pilots Count</label>
                  <input
                    type="number"
                    name="activePilotsCount"
                    min={0}
                    defaultValue={0}
                    className={cn(inputClass, "mt-1")}
                  />
                </div>
              </div>

              {/* Links */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-ink">Pitch Deck URL</label>
                  <input
                    name="pitchDeckUrl"
                    placeholder="https://drive.google.com/..."
                    className={cn(inputClass, "mt-1")}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink">Live Demo URL</label>
                  <input
                    name="demoUrl"
                    placeholder="https://demo.app.com"
                    className={cn(inputClass, "mt-1")}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink">Website URL</label>
                  <input
                    name="websiteUrl"
                    placeholder="https://startup.com"
                    className={cn(inputClass, "mt-1")}
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="mt-5 flex items-center justify-end gap-2 border-t border-line pt-3">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => setIsRegisterOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Registering..." : "Register Startup"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL 2: UPDATE STARTUP MILESTONES */}
      {editingStartup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
          <Card className="w-full max-w-lg p-4 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[92vh] flex flex-col my-auto">
            <div className="mb-3.5 flex items-center justify-between border-b border-line pb-3 shrink-0">
              <div>
                <h3 className="text-base font-bold text-ink">
                  Update Milestones: {editingStartup.name}
                </h3>
                <p className="text-xs text-ink-3">
                  Revise stage, commercial pilots, revenue, or legal status
                </p>
              </div>
              <button
                onClick={() => setEditingStartup(null)}
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

                updateMutation.mutate({
                  id: editingStartup.id,
                  input: {
                    stage: fd.get("stage") as StartupStage,
                    incorporationStatus: fd.get("incorporationStatus") as IncorporationStatus,
                    assignedMentor: String(fd.get("assignedMentor")),
                    readinessScore: Number(fd.get("readinessScore")),
                    fundingRaised: String(fd.get("fundingRaised")),
                    revenue: String(fd.get("revenue")),
                    activePilotsCount: Number(fd.get("activePilotsCount")),
                    patentStatus: fd.get("patentStatus") as PatentStatus,
                    status: fd.get("status") as "Active" | "Graduated" | "On Hold",
                  },
                });
              }}
              className="space-y-3.5 text-xs overflow-y-auto pr-1"
            >
              {/* Stage & Legal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink">Venture Stage</label>
                  <select
                    name="stage"
                    defaultValue={editingStartup.stage}
                    className={cn(inputClass, "mt-1")}
                  >
                    {STARTUP_STAGES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-ink">Incorporation Status</label>
                  <select
                    name="incorporationStatus"
                    defaultValue={editingStartup.incorporationStatus}
                    className={cn(inputClass, "mt-1")}
                  >
                    {INCORPORATION_STATUSES.map((inc) => (
                      <option key={inc} value={inc}>
                        {inc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Mentor & Readiness */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink">Assigned Mentor</label>
                  <input
                    name="assignedMentor"
                    defaultValue={editingStartup.assignedMentor}
                    className={cn(inputClass, "mt-1")}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink">Readiness Score (%)</label>
                  <input
                    type="number"
                    name="readinessScore"
                    min={0}
                    max={100}
                    defaultValue={editingStartup.readinessScore}
                    className={cn(inputClass, "mt-1")}
                  />
                </div>
              </div>

              {/* Financials & Commercial Pilots */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-ink">Funding Mobilized</label>
                  <input
                    name="fundingRaised"
                    defaultValue={editingStartup.fundingRaised}
                    className={cn(inputClass, "mt-1")}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink">Revenue (ARR)</label>
                  <input
                    name="revenue"
                    defaultValue={editingStartup.revenue}
                    className={cn(inputClass, "mt-1")}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink">Active Pilots</label>
                  <input
                    type="number"
                    name="activePilotsCount"
                    min={0}
                    defaultValue={editingStartup.activePilotsCount}
                    className={cn(inputClass, "mt-1")}
                  />
                </div>
              </div>

              {/* Patent & Portfolio Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink">Patent / IP Status</label>
                  <select
                    name="patentStatus"
                    defaultValue={editingStartup.patentStatus}
                    className={cn(inputClass, "mt-1")}
                  >
                    {PATENT_STATUSES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-ink">Incubator Status</label>
                  <select
                    name="status"
                    defaultValue={editingStartup.status}
                    className={cn(inputClass, "mt-1")}
                  >
                    <option value="Active">Active</option>
                    <option value="Graduated">Graduated</option>
                    <option value="On Hold">On Hold</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 flex items-center justify-end gap-2 border-t border-line pt-3">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => setEditingStartup(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
