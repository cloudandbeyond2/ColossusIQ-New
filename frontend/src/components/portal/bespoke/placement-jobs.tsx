"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Filter,
  GraduationCap,
  Layers,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { z } from "zod";
import { apiFetch, ApiError } from "@/lib/api/client";
import {
  type CreateJobBody,
  type MatchedCandidate,
  type PlacementJobItem,
  PlacementJobsOverview,
} from "@/lib/api/jobs-schemas";
import { TemplateSkeleton } from "@/components/modules/shared";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Progress,
  Skeleton,
  Spinner,
  inputClass,
  selectFilterClass,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth/roles";
import { toCsv } from "@/lib/csv";
import { Modal } from "./assignments-shared";

const JOBS_KEY = ["placement-jobs-overview"] as const;
const Ok = z.object({ ok: z.boolean(), message: z.string().optional() });

const CATEGORY_TONE: Record<PlacementJobItem["category"], "brand" | "teal" | "amber"> = {
  "campus-drive": "brand",
  "industry-job": "teal",
  internship: "amber",
};

const CATEGORY_LABEL: Record<PlacementJobItem["category"], string> = {
  "campus-drive": "Campus Drive",
  "industry-job": "Full-Time Corporate",
  internship: "Internship",
};

const DEPARTMENTS = [
  "Computer Science & Engineering",
  "Information Technology",
  "Electronics & Communication Engineering",
  "Electrical & Electronics Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
  "Biomedical Engineering",
];

export function PlacementJobsModule({ role: _role }: { role: Role }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: JOBS_KEY,
    queryFn: () => apiFetch("/api/v1/jobs", PlacementJobsOverview),
    refetchInterval: 30_000,
  });

  // Filters state
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedDept, setSelectedDept] = useState<string>("all");
  const [minPackageFilter, setMinPackageFilter] = useState<number>(0);

  // Modals state
  const [viewCandidatesJob, setViewCandidatesJob] = useState<PlacementJobItem | null>(null);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [showNewJobModal, setShowNewJobModal] = useState(false);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);

  // New Job Form state
  const [formCompany, setFormCompany] = useState("");
  const [formRole, setFormRole] = useState("");
  const [formCategory, setFormCategory] = useState<"industry-job" | "campus-drive" | "internship">("industry-job");
  const [formLocation, setFormLocation] = useState("Bengaluru / Hybrid");
  const [formPackageMin, setFormPackageMin] = useState<number>(7);
  const [formPackageMax, setFormPackageMax] = useState<number>(12);
  const [formOpenings, setFormOpenings] = useState<number>(20);
  const [formDepartments, setFormDepartments] = useState<string[]>([
    "Computer Science & Engineering",
    "Information Technology",
  ]);
  const [formMinReadiness, setFormMinReadiness] = useState<number>(65);
  const [formMinCgpa, setFormMinCgpa] = useState<number>(6.5);
  const [formDeadline, setFormDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 21);
    return d.toISOString().slice(0, 10);
  });
  const [formSkillsText, setFormSkillsText] = useState("Data Structures, SQL, Python, Problem Solving");
  const [formDescription, setFormDescription] = useState(
    "Work on high-throughput microservices, scalable distributed databases, and customer-facing cloud APIs. Competitive compensation with fast-track performance appraisals."
  );
  const [formError, setFormError] = useState<string | null>(null);

  // Mutations
  const createJobMutation = useMutation({
    mutationFn: (body: CreateJobBody) => apiFetch("/api/v1/jobs", Ok, { method: "POST", body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: JOBS_KEY });
      setShowNewJobModal(false);
      resetForm();
    },
    onError: (err) => {
      setFormError(err instanceof ApiError ? err.message : "Failed to post job opening.");
    },
  });

  const deleteJobMutation = useMutation({
    mutationFn: (jobId: string) => apiFetch(`/api/v1/jobs/${jobId}`, Ok, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: JOBS_KEY });
      setDeletingJobId(null);
    },
  });

  const resetForm = () => {
    setFormCompany("");
    setFormRole("");
    setFormCategory("industry-job");
    setFormLocation("Bengaluru / Hybrid");
    setFormPackageMin(7);
    setFormPackageMax(12);
    setFormOpenings(20);
    setFormDepartments(["Computer Science & Engineering", "Information Technology"]);
    setFormMinReadiness(65);
    setFormMinCgpa(6.5);
    setFormSkillsText("Data Structures, SQL, Python, Problem Solving");
    setFormDescription(
      "Work on high-throughput microservices, scalable distributed databases, and customer-facing cloud APIs. Competitive compensation with fast-track performance appraisals."
    );
    setFormError(null);
  };

  const handleCreateJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCompany.trim()) {
      setFormError("Company name is required.");
      return;
    }
    if (!formRole.trim()) {
      setFormError("Role title is required.");
      return;
    }
    if (formDepartments.length === 0) {
      setFormError("Select at least one eligible department.");
      return;
    }
    const skills = formSkillsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    createJobMutation.mutate({
      company: formCompany.trim(),
      role: formRole.trim(),
      category: formCategory,
      type: formCategory === "campus-drive" ? "On-campus" : "Full Time",
      location: formLocation.trim(),
      packageMin: Number(formPackageMin),
      packageMax: Number(formPackageMax),
      openings: Number(formOpenings),
      departments: formDepartments,
      minReadiness: Number(formMinReadiness),
      minCgpa: Number(formMinCgpa),
      deadline: formDeadline,
      description: formDescription.trim(),
      skills,
    });
  };

  const toggleFormDept = (dept: string) => {
    setFormDepartments((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]
    );
  };

  const downloadCandidatesCsv = (job: PlacementJobItem) => {
    const header = [
      "Name",
      "Roll No",
      "Department",
      "Readiness Total",
      "CGPA",
      "Resume ATS Score",
      "Interview Score",
      "Status",
      "College",
    ];
    const rows = job.candidates.map((c) => [
      c.name,
      c.rollNo,
      c.department,
      c.readinessTotal,
      c.cgpa.toFixed(1),
      c.resumeScore,
      c.interviewScore,
      c.status,
      c.collegeName ?? "",
    ]);

    const csvContent = toCsv([header, ...rows]);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${job.company.replace(/\s+/g, "_")}_${job.role.replace(/\s+/g, "_")}_matched_candidates.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filtered jobs list
  const filteredJobs = useMemo(() => {
    if (!q.data?.jobs) return [];
    let list = [...q.data.jobs];

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

    if (selectedCategory !== "all") {
      list = list.filter((j) => j.category === selectedCategory);
    }

    if (selectedDept !== "all") {
      list = list.filter((j) => j.departments.length === 0 || j.departments.includes(selectedDept));
    }

    if (minPackageFilter > 0) {
      list = list.filter((j) => j.packageMax >= minPackageFilter);
    }

    return list;
  }, [q.data?.jobs, search, selectedCategory, selectedDept, minPackageFilter]);

  // Candidates for detail modal
  const filteredModalCandidates = useMemo(() => {
    if (!viewCandidatesJob) return [];
    if (!candidateSearch.trim()) return viewCandidatesJob.candidates;
    const s = candidateSearch.toLowerCase();
    return viewCandidatesJob.candidates.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.rollNo.toLowerCase().includes(s) ||
        c.department.toLowerCase().includes(s)
    );
  }, [viewCandidatesJob, candidateSearch]);

  if (q.isLoading) return <TemplateSkeleton />;
  if (q.isError || !q.data) {
    return (
      <EmptyState
        title="Unable to load job matching dashboard"
        body={q.error instanceof ApiError ? q.error.message : "Please check your network connection."}
        action={<Button onClick={() => void q.refetch()}>Retry</Button>}
      />
    );
  }

  const { summary, employers, departments } = q.data;

  return (
    <div className="space-y-6">
      {/* ── Top Header & Quick Action ───────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Job Matching &amp; Corporate Openings
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-teal/20 bg-teal-soft px-2.5 py-0.5 text-xs font-semibold text-teal">
              <span className="size-1.5 rounded-full bg-teal animate-pulse" />
              Live Matched
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-3">
            Corporate job listings dynamically mapped to student readiness benchmarks, skills, and eligibility.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void q.refetch()}
            disabled={q.isFetching}
            className="gap-1.5 text-xs font-medium"
          >
            <RefreshCw className={cn("size-3.5", q.isFetching && "animate-spin text-brand")} />
            Sync Matches
          </Button>
          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setShowNewJobModal(true);
            }}
            className="gap-1.5 text-xs font-medium"
          >
            <Plus className="size-3.5" />
            Post Corporate Opening
          </Button>
        </div>
      </div>

      {/* ── Summary KPIs ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Card className="p-4 transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-3">Active Openings</span>
            <Briefcase className="size-4 text-brand" />
          </div>
          <p className="mt-2 font-serif text-2xl font-bold tabular-nums text-ink">
            {summary.totalJobs}
          </p>
          <p className="mt-1 text-[11px] text-ink-3">
            {summary.corporateOpenings} corporate · {summary.campusDrives} drives
          </p>
        </Card>

        <Card className="p-4 transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-3">Eligible Matches</span>
            <Users className="size-4 text-teal" />
          </div>
          <p className="mt-2 font-serif text-2xl font-bold tabular-nums text-teal">
            {summary.totalMatches}
          </p>
          <p className="mt-1 text-[11px] text-ink-3">Cohort candidate opportunities</p>
        </Card>

        <Card className="p-4 transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-3">Partner Employers</span>
            <Building2 className="size-4 text-sky" />
          </div>
          <p className="mt-2 font-serif text-2xl font-bold tabular-nums text-ink">
            {summary.partnerCompanies}
          </p>
          <p className="mt-1 text-[11px] text-ink-3">Registered hiring partners</p>
        </Card>

        <Card className="p-4 transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-3">Highest CTC</span>
            <TrendingUp className="size-4 text-gold" />
          </div>
          <p className="mt-2 font-serif text-2xl font-bold tabular-nums text-ink">
            ₹{summary.highestPackageLpa} LPA
          </p>
          <p className="mt-1 text-[11px] text-ink-3">Peak annual compensation</p>
        </Card>

        <Card className="p-4 transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-3">Average CTC</span>
            <Sparkles className="size-4 text-amber" />
          </div>
          <p className="mt-2 font-serif text-2xl font-bold tabular-nums text-ink">
            ₹{summary.averagePackageLpa} LPA
          </p>
          <p className="mt-1 text-[11px] text-ink-3">Median cohort benchmark</p>
        </Card>
      </div>

      {/* ── Search & Filter Controls ────────────────────────────── */}
      <Card className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by company, role title, skills, or location…"
              className={cn(inputClass, "pl-9 text-xs")}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Category Select */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={cn(selectFilterClass, "text-xs")}
            >
              <option value="all">All Categories</option>
              <option value="industry-job">Full-Time Corporate</option>
              <option value="campus-drive">Campus Drives</option>
              <option value="internship">Internships</option>
            </select>

            {/* Department Select */}
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className={cn(selectFilterClass, "text-xs")}
            >
              <option value="all">All Departments</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            {/* Package Filter */}
            <select
              value={minPackageFilter}
              onChange={(e) => setMinPackageFilter(Number(e.target.value))}
              className={cn(selectFilterClass, "text-xs")}
            >
              <option value="0">All Packages</option>
              <option value="6">≥ ₹6.0 LPA</option>
              <option value="8">≥ ₹8.0 LPA</option>
              <option value="12">≥ ₹12.0 LPA</option>
              <option value="18">≥ ₹18.0 LPA</option>
            </select>
          </div>
        </div>
      </Card>

      {/* ── Job Postings List ───────────────────────────────────── */}
      {filteredJobs.length === 0 ? (
        <Card className="py-12 text-center">
          <Briefcase className="mx-auto size-10 text-ink-3" />
          <h3 className="mt-3 text-base font-semibold text-ink">No matching job openings found</h3>
          <p className="mt-1 text-xs text-ink-3">
            Try adjusting your search query, department, or minimum package filters.
          </p>
          <div className="mt-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSearch("");
                setSelectedCategory("all");
                setSelectedDept("all");
                setMinPackageFilter(0);
              }}
            >
              Clear All Filters
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredJobs.map((job) => {
            const tone = CATEGORY_TONE[job.category] ?? "brand";
            return (
              <Card key={job.id} className="card-hover flex flex-col justify-between overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 font-serif text-sm font-bold text-ink ring-1 ring-line">
                        {job.companyLogo || job.company.slice(0, 3).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-bold text-ink">{job.company}</span>
                          <Badge tone={tone} className="text-[10px]">
                            {CATEGORY_LABEL[job.category]}
                          </Badge>
                        </div>
                        <h2 className="mt-0.5 text-base font-semibold tracking-tight text-ink">
                          {job.role}
                        </h2>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="block font-serif text-sm font-bold text-ink">
                        {job.packageText}
                      </span>
                      <span className="text-[11px] text-ink-3">{job.openings} openings</span>
                    </div>
                  </div>

                  <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-ink-2">
                    {job.description}
                  </p>

                  {/* Criteria and Skills Badges */}
                  <div className="mt-3.5 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-ink-2">
                      <MapPin className="size-3 text-ink-3" />
                      {job.location}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-ink-2">
                      <Clock className="size-3 text-ink-3" />
                      Apply by {job.deadline || job.date}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded bg-brand/5 px-2 py-0.5 text-[10px] font-medium text-brand">
                      Min Readiness: {job.minReadiness}
                    </span>
                    {job.minCgpa > 0 && (
                      <span className="inline-flex items-center gap-1 rounded bg-teal/5 px-2 py-0.5 text-[10px] font-medium text-teal">
                        Min CGPA: {job.minCgpa.toFixed(1)}
                      </span>
                    )}
                  </div>

                  {/* Matching Banner */}
                  <div className="mt-4 rounded-xl border border-line bg-surface-2/60 p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-ink">Candidate Matching Cohort</span>
                      <span className="font-bold text-teal">
                        {job.eligibleCount} candidates eligible
                      </span>
                    </div>
                    <Progress
                      value={Math.min(100, Math.max(10, (job.eligibleCount / (summary.totalMatches || 1)) * 100))}
                      tone="teal"
                      className="mt-2 h-1.5"
                    />
                    <p className="mt-1.5 text-[11px] text-ink-3">
                      Targeting: {job.departments.length ? job.departments.join(", ") : "All Departments"}
                    </p>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="flex items-center justify-between border-t border-line bg-surface/50 px-5 py-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setViewCandidatesJob(job)}
                      className="gap-1.5 text-xs font-medium"
                    >
                      <Users className="size-3.5 text-brand" />
                      View Matching ({job.eligibleCount})
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadCandidatesCsv(job)}
                      className="gap-1 text-xs text-ink-2 hover:text-ink"
                    >
                      <Download className="size-3.5" />
                      Export CSV
                    </Button>
                  </div>

                  {job.id.startsWith("custom-job-") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteJobMutation.mutate(job.id)}
                      className="text-xs text-rose hover:bg-rose/10"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── View Matching Candidates Modal ────────────────────── */}
      {viewCandidatesJob && (
        <Modal
          title={`Matching Candidates — ${viewCandidatesJob.company} (${viewCandidatesJob.role})`}
          onClose={() => {
            setViewCandidatesJob(null);
            setCandidateSearch("");
          }}
          wide={true}
        >
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs text-ink-3">
                  Criteria: Min Readiness Score ≥ {viewCandidatesJob.minReadiness} · Min CGPA ≥ {viewCandidatesJob.minCgpa.toFixed(1)}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-teal">
                  {viewCandidatesJob.eligibleCount} candidates meet eligibility rules
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={candidateSearch}
                  onChange={(e) => setCandidateSearch(e.target.value)}
                  placeholder="Filter student name, roll no…"
                  className={cn(inputClass, "w-52 text-xs")}
                />
                <Button
                  size="sm"
                  onClick={() => downloadCandidatesCsv(viewCandidatesJob)}
                  className="gap-1.5 text-xs font-medium"
                >
                  <Download className="size-3.5" />
                  Download CSV
                </Button>
              </div>
            </div>

            <div className="max-h-[460px] overflow-y-auto rounded-xl border border-line">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 border-b border-line bg-surface-2 text-ink-3">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Student Name</th>
                    <th className="px-3 py-2.5 font-medium">Roll No</th>
                    <th className="px-3 py-2.5 font-medium">Department</th>
                    <th className="px-3 py-2.5 font-medium text-right">Readiness</th>
                    <th className="px-3 py-2.5 font-medium text-right">CGPA</th>
                    <th className="px-3 py-2.5 font-medium text-right">ATS Resume</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line bg-surface">
                  {filteredModalCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-ink-3">
                        No students match the search filter.
                      </td>
                    </tr>
                  ) : (
                    filteredModalCandidates.map((c) => (
                      <tr key={c.id} className="hover:bg-surface-2/50">
                        <td className="px-4 py-2.5 font-medium text-ink">{c.name}</td>
                        <td className="px-3 py-2.5 font-mono text-ink-2">{c.rollNo}</td>
                        <td className="px-3 py-2.5 text-ink-2">{c.department}</td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-teal">
                          {c.readinessTotal}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums text-ink">
                          {c.cgpa.toFixed(1)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums text-ink-2">
                          {c.resumeScore}%
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge
                            tone={c.status === "Placement ready" ? "teal" : "amber"}
                            className="text-[10px]"
                          >
                            {c.status}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-ink-3">
                Showing {filteredModalCandidates.length} of {viewCandidatesJob.candidates.length} candidates
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setViewCandidatesJob(null);
                  setCandidateSearch("");
                }}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Post Corporate Opening Modal ──────────────────────── */}
      {showNewJobModal && (
        <Modal
          title="Post Corporate Job Opening"
          onClose={() => setShowNewJobModal(false)}
          wide={true}
        >
          <form onSubmit={handleCreateJob} className="space-y-4">
            {formError && (
              <div className="rounded-lg border border-rose/20 bg-rose-soft p-3 text-xs text-rose">
                {formError}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Company Name *" htmlFor="form-company">
                <input
                  id="form-company"
                  type="text"
                  required
                  value={formCompany}
                  onChange={(e) => setFormCompany(e.target.value)}
                  placeholder="e.g. Google India, Infosys, Zoho"
                  className={cn(inputClass, "text-xs")}
                />
              </Field>

              <Field label="Role Title *" htmlFor="form-role">
                <input
                  id="form-role"
                  type="text"
                  required
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  placeholder="e.g. Software Development Engineer"
                  className={cn(inputClass, "text-xs")}
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Category" htmlFor="form-category">
                <select
                  id="form-category"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as any)}
                  className={cn(inputClass, "text-xs")}
                >
                  <option value="industry-job">Full-Time Corporate</option>
                  <option value="campus-drive">Campus Recruitment Drive</option>
                  <option value="internship">Internship</option>
                </select>
              </Field>

              <Field label="Min Package (LPA)" htmlFor="form-pkg-min">
                <input
                  id="form-pkg-min"
                  type="number"
                  min="0"
                  step="0.5"
                  value={formPackageMin}
                  onChange={(e) => setFormPackageMin(Number(e.target.value))}
                  className={cn(inputClass, "text-xs")}
                />
              </Field>

              <Field label="Max Package (LPA)" htmlFor="form-pkg-max">
                <input
                  id="form-pkg-max"
                  type="number"
                  min="0"
                  step="0.5"
                  value={formPackageMax}
                  onChange={(e) => setFormPackageMax(Number(e.target.value))}
                  className={cn(inputClass, "text-xs")}
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Location" htmlFor="form-loc">
                <input
                  id="form-loc"
                  type="text"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  placeholder="e.g. Chennai / Hybrid"
                  className={cn(inputClass, "text-xs")}
                />
              </Field>

              <Field label="Total Openings" htmlFor="form-openings">
                <input
                  id="form-openings"
                  type="number"
                  min="1"
                  value={formOpenings}
                  onChange={(e) => setFormOpenings(Number(e.target.value))}
                  className={cn(inputClass, "text-xs")}
                />
              </Field>

              <Field label="Application Deadline" htmlFor="form-deadline">
                <input
                  id="form-deadline"
                  type="date"
                  required
                  value={formDeadline}
                  onChange={(e) => setFormDeadline(e.target.value)}
                  className={cn(inputClass, "text-xs")}
                />
              </Field>
            </div>

            {/* Department Eligibility Checkboxes */}
            <Field label="Eligible Departments *" htmlFor="form-dept-group">
              <div id="form-dept-group" className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-3">
                {DEPARTMENTS.map((dept) => (
                  <label
                    key={dept}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-line p-2 text-xs transition-colors hover:bg-surface-2"
                  >
                    <input
                      type="checkbox"
                      checked={formDepartments.includes(dept)}
                      onChange={() => toggleFormDept(dept)}
                      className="size-3.5 rounded border-line text-brand focus:ring-brand"
                    />
                    <span className="line-clamp-1">{dept}</span>
                  </label>
                ))}
              </div>
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Min Readiness Score (0-100)" htmlFor="form-readiness">
                <input
                  id="form-readiness"
                  type="number"
                  min="0"
                  max="100"
                  value={formMinReadiness}
                  onChange={(e) => setFormMinReadiness(Number(e.target.value))}
                  className={cn(inputClass, "text-xs")}
                />
              </Field>

              <Field label="Min CGPA (0-10)" htmlFor="form-cgpa">
                <input
                  id="form-cgpa"
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  value={formMinCgpa}
                  onChange={(e) => setFormMinCgpa(Number(e.target.value))}
                  className={cn(inputClass, "text-xs")}
                />
              </Field>
            </div>

            <Field label="Key Skills (comma-separated)" htmlFor="form-skills">
              <input
                id="form-skills"
                type="text"
                value={formSkillsText}
                onChange={(e) => setFormSkillsText(e.target.value)}
                placeholder="e.g. Java, Python, React, SQL, Cloud"
                className={cn(inputClass, "text-xs")}
              />
            </Field>

            <Field label="Job Description & Responsibilities" htmlFor="form-desc">
              <textarea
                id="form-desc"
                rows={3}
                required
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className={cn(inputClass, "text-xs")}
              />
            </Field>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowNewJobModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createJobMutation.isPending}
                className="gap-1.5"
              >
                {createJobMutation.isPending && <Spinner className="size-3.5" />}
                Publish Job Opening
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
