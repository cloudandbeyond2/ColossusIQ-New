"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Filter,
  GraduationCap,
  Layers,
  MapPin,
  Search,
  Send,
  Sparkles,
  TrendingUp,
  Undo2,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { z } from "zod";
import { apiFetch, ApiError } from "@/lib/api/client";
import {
  type ApplyJobBody,
  type JobApplication,
  type JobItem,
  StudentJobsOverview,
  type ToggleSaveJobBody,
  type WithdrawJobBody,
} from "@/lib/api/jobs-schemas";
import { TemplateSkeleton } from "@/components/modules/shared";
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
import type { Role } from "@/lib/auth/roles";
import { Modal } from "./assignments-shared";

const JOBS_KEY = ["jobs-overview"] as const;
const Ok = z.object({ ok: z.boolean() });

type FilterTab = "matched" | "all" | "drives" | "internships" | "applications" | "saved";
type SortOption = "match" | "package" | "deadline" | "company";

export function JobsModule({ role }: { role: Role }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: JOBS_KEY,
    queryFn: () => apiFetch("/api/v1/jobs", StudentJobsOverview),
  });

  const [activeTab, setActiveTab] = useState<FilterTab>("matched");
  const [search, setSearch] = useState("");
  const [onlyEligible, setOnlyEligible] = useState(false);
  const [ctcFilter, setCtcFilter] = useState<number>(0);
  const [sortBy, setSortBy] = useState<SortOption>("match");

  // Selected job for detail modal or applying
  const [detailJob, setDetailJob] = useState<JobItem | null>(null);
  const [applyJob, setApplyJob] = useState<JobItem | null>(null);
  const [coverNotes, setCoverNotes] = useState("");
  const [resumeChoice, setResumeChoice] = useState("Primary ATS Verified Resume");
  const [withdrawingJobId, setWithdrawingJobId] = useState<string | null>(null);

  // Mutations
  const applyMutation = useMutation({
    mutationFn: (body: ApplyJobBody) => apiFetch("/api/v1/jobs/apply", Ok, { method: "POST", body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: JOBS_KEY });
      setApplyJob(null);
      setCoverNotes("");
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: (body: WithdrawJobBody) => apiFetch("/api/v1/jobs/withdraw", Ok, { method: "POST", body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: JOBS_KEY });
      setWithdrawingJobId(null);
    },
  });

  const saveMutation = useMutation({
    mutationFn: (body: ToggleSaveJobBody) => apiFetch("/api/v1/jobs/save", Ok, { method: "POST", body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: JOBS_KEY });
    },
  });

  const overview = q.data;

  // Filtered and sorted jobs list
  const filteredJobs = useMemo(() => {
    if (!overview) return [];
    let list = [...overview.jobs];

    // Filter by Tab
    if (activeTab === "matched") {
      list = list.filter((j) => j.matchScore >= 70);
    } else if (activeTab === "drives") {
      list = list.filter((j) => j.category === "campus-drive");
    } else if (activeTab === "internships") {
      list = list.filter((j) => j.category === "internship");
    } else if (activeTab === "saved") {
      list = list.filter((j) => overview.savedIds.includes(j.id));
    }

    // Filter by Search Query
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(
        (j) =>
          j.company.toLowerCase().includes(s) ||
          j.role.toLowerCase().includes(s) ||
          j.location.toLowerCase().includes(s) ||
          j.skills.some((sk) => sk.toLowerCase().includes(s))
      );
    }

    // Filter by Eligibility Checkbox
    if (onlyEligible) {
      list = list.filter((j) => j.isEligible);
    }

    // Filter by Minimum CTC
    if (ctcFilter > 0) {
      list = list.filter((j) => j.packageMax >= ctcFilter);
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === "match") return b.matchScore - a.matchScore;
      if (sortBy === "package") return b.packageMax - a.packageMax;
      if (sortBy === "deadline") return (a.deadline || a.date).localeCompare(b.deadline || b.date);
      if (sortBy === "company") return a.company.localeCompare(b.company);
      return 0;
    });

    return list;
  }, [overview, activeTab, search, onlyEligible, ctcFilter, sortBy]);

  if (q.isLoading) return <TemplateSkeleton />;
  if (q.isError || !overview) {
    return (
      <EmptyState
        title="Unable to load job opportunities"
        body={q.error instanceof ApiError ? q.error.message : "Please check your network and try again."}
        action={<Button onClick={() => void q.refetch()}>Retry</Button>}
      />
    );
  }

  const { student, readiness, summary, applications, savedIds } = overview;
  const isPlacementReady = readiness.status === "Placement ready";

  return (
    <div className="space-y-6">
      {/* ── Student Placement Readiness & Eligibility Banner ── */}
      <Card className="overflow-hidden border-line/80 bg-surface">
        <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {/* Readiness Ring Display */}
            <div className="relative flex size-24 shrink-0 items-center justify-center rounded-2xl bg-surface-2 ring-1 ring-line">
              <div className="text-center">
                <span className="font-serif text-3xl font-bold tabular-nums text-ink">{readiness.total}</span>
                <span className="block text-[10px] uppercase tracking-wider text-ink-3">out of 100</span>
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  tone={isPlacementReady ? "teal" : readiness.status === "Almost ready" ? "amber" : "rose"}
                  className="font-medium"
                >
                  {readiness.status}
                </Badge>
                <span className="text-xs text-ink-3">•</span>
                <span className="text-xs font-medium text-ink-2">
                  {student.department} (Sem {student.semester})
                </span>
                <span className="text-xs text-ink-3">•</span>
                <span className="text-xs text-ink-2">CGPA {student.cgpa.toFixed(1)}</span>
              </div>

              <h2 className="mt-1 text-xl font-bold tracking-tight text-ink">
                {isPlacementReady
                  ? "You meet the criteria for top campus recruitment drives"
                  : `Boost your readiness by ${Math.max(1, 75 - readiness.total)} points to unlock all Tier-1 drives`}
              </h2>

              <p className="mt-1 text-xs text-ink-3">
                Your profile is verified with ATS Resume ({readiness.resume}%), Quizzes ({readiness.quizAverage}%), and Mock Interview ({readiness.interview}%).
              </p>
            </div>
          </div>

          {/* Quick Action Links to close gaps */}
          <div className="flex flex-wrap items-center gap-2 border-t border-line/60 pt-4 lg:border-t-0 lg:pt-0">
            <Link
              href="/student/interview"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-3"
            >
              <Sparkles className="size-3.5 text-brand" />
              Practice AI Interview
            </Link>
            <Link
              href="/student/resume"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-3"
            >
              <FileText className="size-3.5 text-teal" />
              ATS Resume Builder
            </Link>
            <Link
              href="/student/placement-readiness"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-3"
            >
              <TrendingUp className="size-3.5 text-amber" />
              Readiness Breakdown
            </Link>
          </div>
        </div>

        {/* Readiness Gap Notice if any */}
        {readiness.gaps.length > 0 && (
          <div className="flex items-center gap-2 border-t border-amber-500/20 bg-amber-500/5 px-6 py-2.5 text-xs text-amber-800 dark:text-amber-300">
            <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="font-medium">Action recommended to boost matching:</span>
            <span>{readiness.gaps.join(" • ")}</span>
          </div>
        )}
      </Card>

      {/* ── Metric Summary Cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <Card className="p-4">
          <div className="flex items-center justify-between text-ink-3">
            <span className="text-xs font-medium">Openings</span>
            <Building2 className="size-4 text-brand" />
          </div>
          <p className="mt-1 font-serif text-2xl font-bold tabular-nums text-ink">{summary.totalOpportunities}</p>
          <p className="mt-0.5 text-[11px] text-ink-3">Verified opportunities</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-ink-3">
            <span className="text-xs font-medium">Eligible For You</span>
            <CheckCircle2 className="size-4 text-teal" />
          </div>
          <p className="mt-1 font-serif text-2xl font-bold tabular-nums text-teal">{summary.eligibleCount}</p>
          <p className="mt-0.5 text-[11px] text-ink-3">You meet all rules</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-ink-3">
            <span className="text-xs font-medium">Campus Drives</span>
            <GraduationCap className="size-4 text-sky" />
          </div>
          <p className="mt-1 font-serif text-2xl font-bold tabular-nums text-sky">{summary.campusDrivesCount}</p>
          <p className="mt-0.5 text-[11px] text-ink-3">Scheduled recruitment</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-ink-3">
            <span className="text-xs font-medium">Applications</span>
            <Send className="size-4 text-brand" />
          </div>
          <p className="mt-1 font-serif text-2xl font-bold tabular-nums text-ink">{summary.applicationsCount}</p>
          <p className="mt-0.5 text-[11px] text-ink-3">{summary.shortlistedCount} shortlisted</p>
        </Card>

        <Card className="p-4 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-ink-3">
            <span className="text-xs font-medium">Avg Package</span>
            <Zap className="size-4 text-amber" />
          </div>
          <p className="mt-1 font-serif text-2xl font-bold tabular-nums text-ink">₹{summary.averagePackageLpa} LPA</p>
          <p className="mt-0.5 text-[11px] text-ink-3">Peak: ₹{summary.highestPackageLpa} LPA</p>
        </Card>
      </div>

      {/* ── Tabbed View Controls ── */}
      <div className="flex flex-col gap-4 border-b border-line pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" className="flex flex-wrap items-center gap-1">
          {[
            { id: "matched", label: "Matched For You", count: overview.jobs.filter((j) => j.matchScore >= 70).length },
            { id: "all", label: "All Opportunities", count: overview.jobs.length },
            { id: "drives", label: "Campus Drives", count: summary.campusDrivesCount },
            { id: "internships", label: "Internships", count: overview.jobs.filter((j) => j.category === "internship").length },
            { id: "applications", label: "My Applications", count: applications.length },
            { id: "saved", label: "Saved", count: savedIds.length },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id as FilterTab)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-brand text-white shadow-sm"
                  : "text-ink-2 hover:bg-surface-2 hover:text-ink"
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 text-[10px]",
                  activeTab === tab.id ? "bg-white/20 text-white" : "bg-surface-2 text-ink-3"
                )}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Applications Tracker Tab (Rendered when Applications Tab is Active) ── */}
      {activeTab === "applications" ? (
        <ApplicationsTrackerView
          applications={applications}
          jobs={overview.jobs}
          onWithdraw={(jobId) => withdrawMutation.mutate({ jobId })}
          withdrawing={withdrawMutation.isPending}
        />
      ) : (
        <>
          {/* ── Search and Filter Controls Bar ── */}
          <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3.5 sm:flex-row sm:items-center">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by company, role title, or skills (e.g. Python, SQL)…"
                className={cn(inputClass, "pl-9 text-xs")}
              />
            </div>

            {/* Filter by Only Eligible */}
            <label className="flex cursor-pointer items-center gap-2 select-none text-xs font-medium text-ink-2 hover:text-ink">
              <input
                type="checkbox"
                checked={onlyEligible}
                onChange={(e) => setOnlyEligible(e.target.checked)}
                className="size-4 rounded border-line text-brand focus:ring-brand"
              />
              <span>Only eligible for me</span>
            </label>

            {/* CTC Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-ink-3">Package:</span>
              <select
                value={ctcFilter}
                onChange={(e) => setCtcFilter(Number(e.target.value))}
                className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-brand"
              >
                <option value={0}>All packages</option>
                <option value={6}>≥ ₹6 LPA</option>
                <option value={10}>≥ ₹10 LPA</option>
                <option value={15}>≥ ₹15 LPA</option>
              </select>
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-ink-3">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-brand"
              >
                <option value="match">Highest Match %</option>
                <option value="package">Highest CTC</option>
                <option value="deadline">Closest Deadline</option>
                <option value="company">Company Name</option>
              </select>
            </div>
          </div>

          {/* ── Jobs Grid ── */}
          {filteredJobs.length === 0 ? (
            <Card className="p-8">
              <EmptyState
                title="No matching opportunities found"
                body="Try clearing some filters or searching with a different keyword."
                action={
                  <Button
                    onClick={() => {
                      setSearch("");
                      setOnlyEligible(false);
                      setCtcFilter(0);
                      setActiveTab("all");
                    }}
                  >
                    Reset Filters
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredJobs.map((job) => {
                const isSaved = savedIds.includes(job.id);
                const application = applications.find((a) => a.jobId === job.id);
                const isApplied = Boolean(application);

                return (
                  <JobCard
                    key={job.id}
                    job={job}
                    isSaved={isSaved}
                    isApplied={isApplied}
                    application={application}
                    onOpenDetail={() => setDetailJob(job)}
                    onOpenApply={() => setApplyJob(job)}
                    onToggleSave={() => saveMutation.mutate({ jobId: job.id })}
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Detail Modal ── */}
      {detailJob && (
        <JobDetailDialog
          job={detailJob}
          student={student}
          readiness={readiness}
          application={applications.find((a) => a.jobId === detailJob.id)}
          onClose={() => setDetailJob(null)}
          onApply={() => {
            setDetailJob(null);
            setApplyJob(detailJob);
          }}
        />
      )}

      {/* ── Apply Modal ── */}
      {applyJob && (
        <ApplyDialog
          job={applyJob}
          student={student}
          resumeChoice={resumeChoice}
          setResumeChoice={setResumeChoice}
          coverNotes={coverNotes}
          setCoverNotes={setCoverNotes}
          onClose={() => setApplyJob(null)}
          onSubmit={() =>
            applyMutation.mutate({
              jobId: applyJob.id,
              resumeName: resumeChoice,
              notes: coverNotes,
            })
          }
          isSubmitting={applyMutation.isPending}
          error={applyMutation.error instanceof ApiError ? applyMutation.error.message : null}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Job Card Component
// ─────────────────────────────────────────────────────────────────────────────

function JobCard({
  job,
  isSaved,
  isApplied,
  application,
  onOpenDetail,
  onOpenApply,
  onToggleSave,
}: {
  job: JobItem;
  isSaved: boolean;
  isApplied: boolean;
  application?: JobApplication;
  onOpenDetail: () => void;
  onOpenApply: () => void;
  onToggleSave: () => void;
}) {
  const matchTone = job.matchScore >= 85 ? "teal" : job.matchScore >= 70 ? "sky" : "amber";

  return (
    <Card className="group relative flex flex-col justify-between overflow-hidden border-line transition-all hover:border-brand/40 hover:shadow-md">
      <div>
        {/* Card Header with Company & Bookmark */}
        <div className="flex items-start justify-between gap-3 border-b border-line/60 p-4 bg-surface-2/40">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 font-bold tracking-tight text-brand ring-1 ring-brand/20">
              {job.companyLogo || job.company.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h3 className="line-clamp-1 text-sm font-bold text-ink group-hover:text-brand transition-colors">
                {job.role}
              </h3>
              <p className="line-clamp-1 text-xs text-ink-3">{job.company}</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onToggleSave}
              className="rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
              aria-label={isSaved ? "Remove bookmark" : "Save opportunity"}
            >
              {isSaved ? <BookmarkCheck className="size-4 text-brand fill-brand" /> : <Bookmark className="size-4" />}
            </button>
          </div>
        </div>

        {/* Card Body Information */}
        <div className="space-y-3 p-4">
          {/* Key tags: Package & Match & Category */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-md bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
              {job.packageText}
            </span>

            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold",
                job.matchScore >= 85
                  ? "bg-teal-500/10 text-teal-700 dark:text-teal-400"
                  : job.matchScore >= 70
                  ? "bg-sky-500/10 text-sky-700 dark:text-sky-400"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
              )}
            >
              <Sparkles className="size-3" />
              {job.matchScore}% Match
            </span>

            {job.category === "campus-drive" && (
              <span className="rounded-md bg-purple-500/10 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:text-purple-300">
                Campus Drive
              </span>
            )}
          </div>

          {/* Location & Drive Date */}
          <div className="space-y-1 text-xs text-ink-3">
            <div className="flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0 text-ink-3" />
              <span className="truncate">{job.venue ? `${job.venue} (${job.location})` : job.location}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <Calendar className="size-3.5 shrink-0 text-ink-3" />
              <span>
                {job.date ? `Drive: ${job.date}` : "Immediate Joining"} • Deadline: {job.deadline || "Open"}
              </span>
            </div>
          </div>

          {/* Skills Overview */}
          <div className="flex flex-wrap gap-1 pt-1">
            {job.skills.slice(0, 4).map((sk) => {
              const isMatched = job.matchedSkills.includes(sk);
              return (
                <span
                  key={sk}
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-medium ring-1",
                    isMatched
                      ? "bg-teal-500/10 text-teal-700 ring-teal-500/20 dark:text-teal-300"
                      : "bg-surface-2 text-ink-3 ring-line"
                  )}
                >
                  {isMatched ? "✓ " : ""}
                  {sk}
                </span>
              );
            })}
            {job.skills.length > 4 && (
              <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-3">
                +{job.skills.length - 4}
              </span>
            )}
          </div>

          {/* Eligibility Indicator */}
          <div className="pt-1">
            {job.isEligible ? (
              <div className="flex items-center gap-1.5 text-xs font-medium text-teal">
                <CheckCircle2 className="size-3.5" />
                <span>Eligible: Meets readiness ({job.minReadiness}%) and department</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                <AlertCircle className="size-3.5 shrink-0" />
                <span className="line-clamp-1">{job.eligibilityGaps[0] || "Eligibility gap"}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Card Footer Actions */}
      <div className="flex items-center gap-2 border-t border-line/60 bg-surface-2/30 p-3">
        <Button variant="secondary" size="sm" onClick={onOpenDetail} className="flex-1 text-xs">
          View Details
        </Button>

        {isApplied ? (
          <div className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-teal-500/10 px-3 py-1.5 text-xs font-semibold text-teal-700 dark:text-teal-400">
            <CheckCircle2 className="size-3.5" />
            <span>{application?.status || "Applied"}</span>
          </div>
        ) : (
          <Button
            size="sm"
            onClick={onOpenApply}
            disabled={!job.isEligible}
            className={cn("flex-1 text-xs", !job.isEligible && "opacity-60 cursor-not-allowed")}
          >
            {job.isEligible ? "Apply Now" : "Locked (Gap)"}
          </Button>
        )}
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Applications Tracker Tab View
// ─────────────────────────────────────────────────────────────────────────────

function ApplicationsTrackerView({
  applications,
  jobs,
  onWithdraw,
  withdrawing,
}: {
  applications: JobApplication[];
  jobs: JobItem[];
  onWithdraw: (jobId: string) => void;
  withdrawing: boolean;
}) {
  if (applications.length === 0) {
    return (
      <Card className="p-8">
        <EmptyState
          title="No job applications yet"
          body="Explore open campus placement drives and industry roles to submit your verified application."
        />
      </Card>
    );
  }

  const STAGES = ["Submitted", "Shortlisted", "Assessment", "Interview", "Offer Extended"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Active Application Pipeline ({applications.length})</h3>
        <span className="text-xs text-ink-3">Applications update automatically with placement cell status</span>
      </div>

      <div className="space-y-4">
        {applications.map((app) => {
          const matchedJob = jobs.find((j) => j.id === app.jobId);
          const stageIdx = app.stage - 1;

          return (
            <Card key={app.id} className="overflow-hidden border-line p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-base font-bold text-ink">{app.role}</h4>
                    <span className="text-xs text-ink-3">•</span>
                    <span className="text-sm font-medium text-ink-2">{app.company}</span>
                    <Badge
                      tone={
                        app.status === "Offered"
                          ? "teal"
                          : app.status === "Shortlisted"
                          ? "sky"
                          : app.status === "Rejected"
                          ? "rose"
                          : "neutral"
                      }
                      className="text-xs"
                    >
                      {app.status}
                    </Badge>
                  </div>

                  <p className="mt-1 text-xs text-ink-3">
                    Applied on {new Date(app.appliedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} • Resume: {app.resumeName}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/student/interview`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-brand/20"
                  >
                    <Sparkles className="size-3.5" />
                    Practice AI Interview
                  </Link>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onWithdraw(app.jobId)}
                    disabled={withdrawing}
                    className="text-xs text-rose hover:bg-rose-500/10 hover:text-rose-600"
                  >
                    Withdraw
                  </Button>
                </div>
              </div>

              {/* Progress Pipeline Stepper */}
              <div className="mt-6 border-t border-line/60 pt-4">
                <div className="relative flex items-center justify-between">
                  {/* Background Track Line */}
                  <div className="absolute left-0 top-1/2 -z-0 h-0.5 w-full -translate-y-1/2 bg-line" />

                  {STAGES.map((stage, idx) => {
                    const isDone = idx <= stageIdx;
                    const isCurrent = idx === stageIdx;

                    return (
                      <div key={stage} className="relative z-10 flex flex-col items-center">
                        <div
                          className={cn(
                            "flex size-6 items-center justify-center rounded-full text-xs font-bold ring-4 ring-surface transition-colors",
                            isDone ? "bg-brand text-white" : "bg-surface-2 text-ink-3 ring-line"
                          )}
                        >
                          {isDone ? "✓" : idx + 1}
                        </div>
                        <span
                          className={cn(
                            "mt-2 text-center text-[11px] font-medium",
                            isCurrent ? "font-bold text-brand" : isDone ? "text-ink" : "text-ink-3"
                          )}
                        >
                          {stage}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Next Step Note */}
              <div className="mt-5 rounded-lg bg-surface-2 p-3 text-xs text-ink-2">
                <span className="font-semibold text-ink">Next step: </span>
                <span>{app.nextStep}</span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Job Detail Modal Dialog
// ─────────────────────────────────────────────────────────────────────────────

function JobDetailDialog({
  job,
  student,
  readiness,
  application,
  onClose,
  onApply,
}: {
  job: JobItem;
  student: StudentJobsOverview["student"];
  readiness: StudentJobsOverview["readiness"];
  application?: JobApplication;
  onClose: () => void;
  onApply: () => void;
}) {
  const isApplied = Boolean(application);

  return (
    <Modal title={`${job.role} — ${job.company}`} onClose={onClose} wide>
      <div className="space-y-6">
        {/* Header Summary */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-2xl font-bold text-brand">{job.packageText}</span>
              <Badge tone={job.matchScore >= 80 ? "teal" : "amber"}>{job.matchScore}% Match</Badge>
              {job.isDrive && <Badge tone="sky">Campus Drive</Badge>}
            </div>
            <p className="mt-1 text-xs text-ink-3">
              Venue: {job.venue || job.location} • Drive Date: {job.date || "Scheduled"} • Openings: {job.openings}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isApplied ? (
              <Badge tone="teal" className="text-xs">
                ✓ Applied ({application?.status})
              </Badge>
            ) : (
              <Button size="sm" onClick={onApply} disabled={!job.isEligible}>
                {job.isEligible ? "Apply Now" : "Eligibility Criteria Not Met"}
              </Button>
            )}
          </div>
        </div>

        {/* Eligibility Verification Card */}
        <div className="rounded-xl border border-line bg-surface-2/60 p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-ink-3">Eligibility Check</h4>
          <div className="mt-2 grid gap-2 sm:grid-cols-3 text-xs">
            <div className="flex items-start gap-2">
              {job.isEligible ? <CheckCircle2 className="size-4 text-teal" /> : <AlertCircle className="size-4 text-amber" />}
              <div>
                <span className="font-semibold text-ink">Readiness Score</span>
                <p className="text-ink-3">
                  Needs {job.minReadiness}% (You have {readiness.total}%)
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <CheckCircle2 className="size-4 text-teal" />
              <div>
                <span className="font-semibold text-ink">Department</span>
                <p className="text-ink-3">{student.department}</p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <CheckCircle2 className="size-4 text-teal" />
              <div>
                <span className="font-semibold text-ink">Academic Standing</span>
                <p className="text-ink-3">CGPA {student.cgpa.toFixed(1)} / 10</p>
              </div>
            </div>
          </div>
        </div>

        {/* Job Description */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-ink-3">Role Overview</h4>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-2">{job.description}</p>
        </div>

        {/* Responsibilities */}
        {job.responsibilities.length > 0 && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-3">Key Responsibilities</h4>
            <ul className="mt-1.5 list-inside list-disc space-y-1 text-xs text-ink-2">
              {job.responsibilities.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Selection Process / Rounds */}
        {job.rounds.length > 0 && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-3">Selection Process</h4>
            <div className="mt-2 space-y-2">
              {job.rounds.map((round, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-line bg-surface p-2.5 text-xs">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/10 font-bold text-brand">
                    {i + 1}
                  </span>
                  <span className="text-ink font-medium">{round}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Skills Comparison */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-ink-3">Skill Matching Analysis</h4>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {job.skills.map((skill) => {
              const matched = job.matchedSkills.includes(skill);
              return (
                <span
                  key={skill}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium ring-1",
                    matched
                      ? "bg-teal-500/10 text-teal-800 ring-teal-500/20 dark:text-teal-300"
                      : "bg-surface-2 text-ink-3 ring-line"
                  )}
                >
                  {matched ? "✓" : "○"} {skill}
                </span>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-line pt-4">
          <Link
            href="/student/interview"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline"
          >
            <Sparkles className="size-4" />
            Practice company mock interview
          </Link>

          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Application Modal Dialog
// ─────────────────────────────────────────────────────────────────────────────

function ApplyDialog({
  job,
  student,
  resumeChoice,
  setResumeChoice,
  coverNotes,
  setCoverNotes,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: {
  job: JobItem;
  student: StudentJobsOverview["student"];
  resumeChoice: string;
  setResumeChoice: (v: string) => void;
  coverNotes: string;
  setCoverNotes: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  error: string | null;
}) {
  return (
    <Modal title={`Apply for ${job.role}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl border border-line bg-surface-2 p-3 text-xs">
          <p className="font-semibold text-ink">{job.company}</p>
          <p className="text-ink-3">
            Package: {job.packageText} • Venue/Type: {job.venue || job.type}
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-ink">Verified Resume</label>
          <select
            value={resumeChoice}
            onChange={(e) => setResumeChoice(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-brand"
          >
            <option value="Primary ATS Verified Resume">Primary ATS Verified Resume (Recommended)</option>
            <option value="Core Engineering Technical Resume">Core Engineering Technical Resume</option>
            <option value="Research & Academic CV">Research & Academic CV</option>
          </select>
          <p className="mt-1 text-[11px] text-ink-3">
            Your ColossusIQ ATS score and verified skills will be forwarded to the recruiter.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-ink">Short Cover Note / Pitch (Optional)</label>
          <textarea
            value={coverNotes}
            onChange={(e) => setCoverNotes(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Highlight your relevant projects, hackathons or why you want to join this company…"
            className={cn(inputClass, "mt-1 text-xs resize-none")}
          />
        </div>

        <div className="rounded-lg border border-line bg-surface p-3 text-[11px] text-ink-3">
          ✓ By applying, you confirm attendance for the scheduled drive and interview rounds according to college placement policy.
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line pt-3">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? <Spinner className="size-4" /> : "Confirm Application"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
