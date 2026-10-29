"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Award,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Eye,
  Filter,
  GraduationCap,
  Plus,
  Rocket,
  Search,
  Sparkles,
  Star,
  User,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { apiFetch, ApiError } from "@/lib/api/client";
import {
  CandidateProfile,
  RECRUITER_ROLES,
  TalentSearchOverview,
  type CreateShortlistInput,
  type RecruiterRole,
} from "@/lib/api/recruiter-schemas";
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

const DEPT_OPTIONS = [
  "Computer Science & Engineering",
  "Information Technology",
  "Artificial Intelligence & Data Science",
  "Electronics & Communication",
  "Electrical & Electronics",
  "Mechanical Engineering",
  "Biomedical Engineering",
  "Civil & Environmental",
];

const SKILL_OPTIONS = [
  "Python",
  "TypeScript",
  "Next.js",
  "Node.js",
  "PyTorch",
  "TensorFlow",
  "React",
  "Go (Golang)",
  "C++",
  "PostgreSQL",
  "Docker",
  "Solidity",
  "MATLAB",
];

export function TalentSearchModule({ role: _role }: { role?: Role }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [skillFilter, setSkillFilter] = useState("All");
  const [readinessFilter, setReadinessFilter] = useState("0");
  const [cgpaFilter, setCgpaFilter] = useState("0");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Modals
  const [shortlistingCandidate, setShortlistingCandidate] = useState<CandidateProfile | null>(null);
  const [viewingProfile, setViewingProfile] = useState<CandidateProfile | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  // Build query string
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (deptFilter !== "All") params.set("department", deptFilter);
    if (skillFilter !== "All") params.set("skill", skillFilter);
    if (Number(readinessFilter) > 0) params.set("minReadiness", readinessFilter);
    if (Number(cgpaFilter) > 0) params.set("minCgpa", cgpaFilter);
    return params.toString();
  }, [search, deptFilter, skillFilter, readinessFilter, cgpaFilter]);

  // Fetch Talent Overview
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["recruiter-candidates", queryString],
    queryFn: () =>
      apiFetch(
        `/api/v1/recruiter/candidates${queryString ? `?${queryString}` : ""}`,
        TalentSearchOverview
      ),
  });

  // Shortlist Mutation
  const shortlistMutation = useMutation({
    mutationFn: (input: CreateShortlistInput) =>
      apiFetch("/api/v1/recruiter/shortlists", z.any(), {
        method: "POST",
        body: input,
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["recruiter-candidates"] });
      qc.invalidateQueries({ queryKey: ["recruiter-shortlists"] });
      qc.invalidateQueries({ queryKey: ["home"] });
      const cand = shortlistingCandidate;
      setShortlistingCandidate(null);
      showToast(
        `Shortlisted ${cand?.name || "candidate"} for role "${vars.roleRequisition}"!`
      );
    },
    onError: (err) => {
      showToast(err instanceof ApiError ? err.message : "Failed to shortlist candidate.");
    },
  });

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

      {/* METRIC KPI CARDS */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {/* KPI 1 */}
        <Card className="p-3 sm:p-4 border-l-4 border-l-brand">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-ink-3">
              Matched Talent
            </span>
            <span className="rounded-lg bg-brand-soft p-1.5 text-brand">
              <Users className="size-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
              {data.totalCandidates}
            </span>
            <span className="text-[11px] font-medium text-brand">Verified</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">Available across Anna University stream</p>
        </Card>

        {/* KPI 2 */}
        <Card className="p-3 sm:p-4 border-l-4 border-l-teal">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-ink-3">
              Top Tier (90%+ Readiness)
            </span>
            <span className="rounded-lg bg-teal-soft p-1.5 text-teal">
              <Star className="size-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
              {data.highReadinessCount}
            </span>
            <Badge tone="teal" className="text-[10px]">
              Ready to Deploy
            </Badge>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">High coding & architectural rigor</p>
        </Card>

        {/* KPI 3 */}
        <Card className="p-3 sm:p-4 border-l-4 border-l-sky">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-ink-3">
              Available For Hire
            </span>
            <span className="rounded-lg bg-sky-soft p-1.5 text-sky">
              <UserCheck className="size-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
              {data.availableForHireCount}
            </span>
            <span className="text-[11px] text-sky font-semibold">Immediate</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">Not currently locked in active drives</p>
        </Card>

        {/* KPI 4 */}
        <Card className="p-3 sm:p-4 border-l-4 border-l-amber">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-ink-3">
              In Your Pipeline
            </span>
            <span className="rounded-lg bg-amber-soft p-1.5 text-amber">
              <Briefcase className="size-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
              {data.shortlistedCount}
            </span>
            <span className="text-[11px] font-medium text-amber">Shortlisted</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">Active candidate requisitions</p>
        </Card>
      </div>

      {/* FILTER CONTROLS & SEARCH TOOLBAR */}
      <Card className="p-3 sm:p-4 space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search candidate name, roll, skills, or projects..."
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

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Department */}
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="h-9 rounded-xl border border-line bg-surface px-2.5 text-xs text-ink focus:border-brand focus:outline-hidden"
            >
              <option value="All">All Departments</option>
              {DEPT_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            {/* Primary Skill */}
            <select
              value={skillFilter}
              onChange={(e) => setSkillFilter(e.target.value)}
              className="h-9 rounded-xl border border-line bg-surface px-2.5 text-xs text-ink focus:border-brand focus:outline-hidden"
            >
              <option value="All">All Skills</option>
              {SKILL_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            {/* Min Readiness */}
            <select
              value={readinessFilter}
              onChange={(e) => setReadinessFilter(e.target.value)}
              className="h-9 rounded-xl border border-line bg-surface px-2.5 text-xs text-ink focus:border-brand focus:outline-hidden"
            >
              <option value="0">Any Readiness</option>
              <option value="90">90%+ Top Tier</option>
              <option value="85">85%+ High Readiness</option>
              <option value="80">80%+ Industry Ready</option>
            </select>

            {/* Min CGPA */}
            <select
              value={cgpaFilter}
              onChange={(e) => setCgpaFilter(e.target.value)}
              className="h-9 rounded-xl border border-line bg-surface px-2.5 text-xs text-ink focus:border-brand focus:outline-hidden"
            >
              <option value="0">Any CGPA</option>
              <option value="9.0">9.0+ Gold</option>
              <option value="8.5">8.5+ High</option>
              <option value="8.0">8.0+ Good</option>
            </select>

            {/* View Mode Toggle */}
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
                Cards
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
          </div>
        </div>

        {/* Active Filter Chips */}
        {(deptFilter !== "All" || skillFilter !== "All" || readinessFilter !== "0" || cgpaFilter !== "0" || search) && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-line text-xs">
            <span className="text-ink-3">Filters applied:</span>
            {deptFilter !== "All" && (
              <Badge tone="brand" className="gap-1">
                Dept: {deptFilter}
                <button onClick={() => setDeptFilter("All")}>
                  <X className="size-3 hover:text-ink" />
                </button>
              </Badge>
            )}
            {skillFilter !== "All" && (
              <Badge tone="teal" className="gap-1">
                Skill: {skillFilter}
                <button onClick={() => setSkillFilter("All")}>
                  <X className="size-3 hover:text-ink" />
                </button>
              </Badge>
            )}
            {readinessFilter !== "0" && (
              <Badge tone="sky" className="gap-1">
                Min Readiness: {readinessFilter}%
                <button onClick={() => setReadinessFilter("0")}>
                  <X className="size-3 hover:text-ink" />
                </button>
              </Badge>
            )}
            {cgpaFilter !== "0" && (
              <Badge tone="amber" className="gap-1">
                Min CGPA: {cgpaFilter}
                <button onClick={() => setCgpaFilter("0")}>
                  <X className="size-3 hover:text-ink" />
                </button>
              </Badge>
            )}
            {search && (
              <Badge tone="neutral" className="gap-1">
                &quot;{search}&quot;
                <button onClick={() => setSearch("")}>
                  <X className="size-3 hover:text-ink" />
                </button>
              </Badge>
            )}
            <button
              onClick={() => {
                setSearch("");
                setDeptFilter("All");
                setSkillFilter("All");
                setReadinessFilter("0");
                setCgpaFilter("0");
              }}
              className="text-xs text-brand hover:underline font-medium ml-1"
            >
              Clear all
            </button>
          </div>
        )}
      </Card>

      {/* RESULTS LIST / GRID */}
      {data.candidates.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            title="No verified candidates match your criteria"
            body="Try expanding your readiness thresholds, changing primary skills, or resetting search filters."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch("");
                  setDeptFilter("All");
                  setSkillFilter("All");
                  setReadinessFilter("0");
                  setCgpaFilter("0");
                }}
              >
                Reset Search Filters
              </Button>
            }
          />
        </Card>
      ) : viewMode === "grid" ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.candidates.map((c) => (
            <Card
              key={c.id}
              className="flex flex-col justify-between overflow-hidden border border-line bg-surface hover:shadow-lg transition-all duration-200"
            >
              <div className="p-4 sm:p-5">
                {/* Header row */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="font-bold text-base text-ink hover:text-brand transition cursor-pointer" onClick={() => setViewingProfile(c)}>
                      {c.name}
                    </h3>
                    <p className="text-[11px] text-ink-3">
                      {c.roll} · {c.department}
                    </p>
                  </div>
                  <Badge tone={c.cgpa >= 9.0 ? "teal" : "brand"} className="text-xs font-bold font-mono">
                    {c.cgpa} CGPA
                  </Badge>
                </div>

                {/* College & Grad Year */}
                <p className="text-[10px] text-ink-3 flex items-center gap-1 mb-3">
                  <Building2 className="size-3 shrink-0" />
                  <span className="truncate">{c.college}</span>
                  <span>· Batch of {c.graduationYear}</span>
                </p>

                {/* Readiness score bar */}
                <div className="space-y-1 mb-3.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-ink-3">Placement Readiness</span>
                    <span className="font-bold text-ink font-mono">{c.readiness}%</span>
                  </div>
                  <Progress value={c.readiness} tone={toneForScore(c.readiness)} />
                </div>

                {/* Capstone Project */}
                <div className="rounded-xl border border-line bg-surface-2/40 p-2.5 mb-3 text-xs space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-ink-3 block">
                    Verified Capstone Project
                  </span>
                  <p className="font-semibold text-ink line-clamp-1">{c.projectTitle}</p>
                  <p className="text-[10px] text-brand font-medium">{c.projectDomain}</p>
                </div>

                {/* Skill Pills */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {c.skills.map((sk) => (
                    <span
                      key={sk}
                      className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-ink-2"
                    >
                      {sk}
                    </span>
                  ))}
                </div>

                {/* Status indicator */}
                <div className="flex items-center justify-between text-[11px] pt-2 border-t border-line text-ink-3">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        c.status === "Shortlisted" ? "bg-amber" : "bg-teal"
                      )}
                    />
                    <span>{c.status === "Shortlisted" ? `In ${c.activeShortlistCount} Shortlist(s)` : "Available for Hire"}</span>
                  </span>

                  {/* Links */}
                  <div className="flex items-center gap-2">
                    {c.githubUrl && (
                      <a
                        href={c.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-ink-3 hover:text-brand transition"
                        title="GitHub Profile"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="flex items-center justify-between border-t border-line bg-surface-2/30 px-4 py-2.5">
                <Button
                  variant="ghost"
                  onClick={() => setViewingProfile(c)}
                  className="h-8 px-2.5 text-xs gap-1 text-ink-2"
                >
                  <Eye className="size-3.5" />
                  <span>Profile</span>
                </Button>

                <Button
                  onClick={() => setShortlistingCandidate(c)}
                  className="h-8 px-3 text-xs gap-1.5 bg-brand-gradient text-white shadow-xs"
                >
                  <Plus className="size-3.5" />
                  <span>Shortlist</span>
                </Button>
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
                  <th className="py-3 px-4">Candidate & Roll</th>
                  <th className="py-3 px-3">Department</th>
                  <th className="py-3 px-3">CGPA</th>
                  <th className="py-3 px-3">Readiness</th>
                  <th className="py-3 px-3">Key Skills</th>
                  <th className="py-3 px-3">Verified Project</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.candidates.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-2/40 transition">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <p className="font-bold text-ink cursor-pointer hover:text-brand" onClick={() => setViewingProfile(c)}>
                        {c.name}
                      </p>
                      <p className="text-[10px] text-ink-3 font-mono">{c.roll}</p>
                    </td>
                    <td className="py-3 px-3 max-w-[160px] truncate">{c.department}</td>
                    <td className="py-3 px-3 whitespace-nowrap font-bold text-ink font-mono">
                      {c.cgpa}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="font-bold text-ink font-mono">{c.readiness}%</span>
                    </td>
                    <td className="py-3 px-3 max-w-[200px]">
                      <div className="flex flex-wrap gap-1">
                        {c.skills.slice(0, 3).map((s) => (
                          <span key={s} className="rounded bg-surface-2 px-1 py-0.5 text-[9px] text-ink-2">
                            {s}
                          </span>
                        ))}
                        {c.skills.length > 3 && (
                          <span className="text-[9px] text-ink-3 font-medium">+{c.skills.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 max-w-[200px] truncate">
                      <p className="font-semibold text-ink truncate">{c.projectTitle}</p>
                      <p className="text-[10px] text-brand">{c.projectDomain}</p>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <Badge tone={c.status === "Shortlisted" ? "amber" : "teal"} className="text-[10px]">
                        {c.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <Button
                        size="sm"
                        onClick={() => setShortlistingCandidate(c)}
                        className="h-7 px-2.5 text-xs"
                      >
                        Shortlist
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* MODAL 1: SHORTLIST CANDIDATE */}
      {shortlistingCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
          <Card className="w-full max-w-md p-4 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 my-auto">
            <div className="mb-3.5 flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="text-base font-bold text-ink">Shortlist Candidate</h3>
                <p className="text-xs text-ink-3">
                  Add {shortlistingCandidate.name} ({shortlistingCandidate.roll}) to a requisition
                </p>
              </div>
              <button
                onClick={() => setShortlistingCandidate(null)}
                className="rounded p-1 text-ink-3 hover:text-ink"
              >
                <X className="size-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                shortlistMutation.mutate({
                  candidateId: shortlistingCandidate.id,
                  roleRequisition: String(fd.get("roleRequisition")),
                  notes: String(fd.get("notes") || ""),
                });
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="block font-semibold text-ink">Role Requisition *</label>
                <select name="roleRequisition" className={cn(inputClass, "mt-1")}>
                  {RECRUITER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-ink">Recruiter Evaluation Notes</label>
                <textarea
                  name="notes"
                  rows={3}
                  placeholder="e.g. Strong PyTorch background; eligible for fast-track Technical Round 1."
                  className={cn(inputClass, "mt-1 resize-none")}
                />
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 border-t border-line pt-3">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => setShortlistingCandidate(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={shortlistMutation.isPending}>
                  {shortlistMutation.isPending ? "Adding..." : "Confirm Shortlist"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL 2: FULL CANDIDATE PROFILE DRAWER */}
      {viewingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
          <Card className="w-full max-w-lg p-5 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 my-auto max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-line pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand font-bold text-sm">
                  {viewingProfile.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-ink">{viewingProfile.name}</h3>
                  <p className="text-xs text-ink-3">
                    {viewingProfile.roll} · {viewingProfile.department}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingProfile(null)}
                className="rounded p-1 text-ink-3 hover:text-ink"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4 py-3 overflow-y-auto text-xs pr-1">
              {/* Academic Highlights */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-line bg-surface-2/40 p-2.5">
                  <span className="text-[10px] text-ink-3 uppercase font-semibold block">CGPA</span>
                  <span className="text-lg font-bold text-ink font-mono">{viewingProfile.cgpa}</span>
                </div>
                <div className="rounded-xl border border-line bg-surface-2/40 p-2.5">
                  <span className="text-[10px] text-ink-3 uppercase font-semibold block">Readiness</span>
                  <span className="text-lg font-bold text-brand font-mono">{viewingProfile.readiness}%</span>
                </div>
                <div className="rounded-xl border border-line bg-surface-2/40 p-2.5">
                  <span className="text-[10px] text-ink-3 uppercase font-semibold block">Grad Year</span>
                  <span className="text-lg font-bold text-ink font-mono">{viewingProfile.graduationYear}</span>
                </div>
              </div>

              {/* Verified Project */}
              <div className="rounded-xl border border-line bg-surface-2/30 p-3 space-y-1">
                <span className="text-[10px] uppercase font-bold text-ink-3">Verified Capstone Work</span>
                <p className="font-bold text-sm text-ink">{viewingProfile.projectTitle}</p>
                <p className="text-xs text-brand font-medium">{viewingProfile.projectDomain}</p>
              </div>

              {/* Skills */}
              <div>
                <span className="font-semibold text-ink block mb-1.5">Verified Technical Skills</span>
                <div className="flex flex-wrap gap-1.5">
                  {viewingProfile.skills.map((s) => (
                    <Badge key={s} tone="brand" className="text-xs">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Contact & Profiles */}
              <div className="space-y-1.5 pt-2 border-t border-line text-xs">
                <p className="text-ink-3">
                  Email: <strong className="text-ink">{viewingProfile.email}</strong>
                </p>
                {viewingProfile.githubUrl && (
                  <p className="text-ink-3 flex items-center gap-1">
                    GitHub:{" "}
                    <a
                      href={viewingProfile.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand hover:underline font-medium inline-flex items-center gap-1"
                    >
                      {viewingProfile.githubUrl} <ExternalLink className="size-3" />
                    </a>
                  </p>
                )}
                {viewingProfile.linkedinUrl && (
                  <p className="text-ink-3 flex items-center gap-1">
                    LinkedIn:{" "}
                    <a
                      href={viewingProfile.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand hover:underline font-medium inline-flex items-center gap-1"
                    >
                      {viewingProfile.linkedinUrl} <ExternalLink className="size-3" />
                    </a>
                  </p>
                )}
              </div>
            </div>

            <div className="border-t border-line pt-3 flex items-center justify-end gap-2 shrink-0">
              <Button variant="secondary" onClick={() => setViewingProfile(null)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  const c = viewingProfile;
                  setViewingProfile(null);
                  setShortlistingCandidate(c);
                }}
              >
                Add to Shortlist
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
