"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api/client";
import {
  PlacementAnalyticsOverview,
  InstitutionalPlacementTargets,
} from "@/lib/api/placement-analytics-schemas";
import type { Role } from "@/lib/auth/roles";
import { TemplateSkeleton } from "@/components/modules/shared";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Progress,
  inputClass,
} from "@/components/ui/primitives";
import { Fi } from "@/components/ui/icon";
import { toCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";

type TabKey = "overview" | "departments" | "drives" | "gaps" | "students";

export function PlacementAnalyticsModule({ role }: { role: Role }) {
  const qc = useQueryClient();
  const isHod = role === "hod";
  const isPlacement = role === "placement";
  const isInstitution = role === "institution";
  const isAdmin = role === "admin";

  // HOD defaults to their own department (Computer Science & Engineering) with easy toggle to All
  const [selectedDept, setSelectedDept] = useState<string>(isHod ? "Computer Science & Engineering" : "all");
  const [selectedTier, setSelectedTier] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [studentStatusFilter, setStudentStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [showTargetModal, setShowTargetModal] = useState<boolean>(false);
  const [showRelatedPortals, setShowRelatedPortals] = useState<boolean>(true);

  // Target inputs
  const [targetPlacementPct, setTargetPlacementPct] = useState<number>(92);
  const [minAverageLpaTarget, setMinAverageLpaTarget] = useState<number>(10.5);
  const [mockInterviewTarget, setMockInterviewTarget] = useState<number>(95);
  const [targetCompaniesCount, setTargetCompaniesCount] = useState<number>(60);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const queryParams = new URLSearchParams();
  if (selectedDept !== "all") queryParams.set("department", selectedDept);
  if (selectedTier !== "all") queryParams.set("tier", selectedTier);
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["placement-analytics", selectedDept, selectedTier],
    queryFn: () => apiFetch(`/api/v1/placement-analytics${queryString}`, PlacementAnalyticsOverview),
  });

  const updateTargetsMutation = useMutation({
    mutationFn: (newTargets: {
      targetPlacementPct: number;
      minAverageLpaTarget: number;
      mockInterviewCompletionTarget: number;
      targetCompaniesCount: number;
    }) =>
      apiFetch("/api/v1/placement-analytics/targets", InstitutionalPlacementTargets, {
        method: "PATCH",
        body: JSON.stringify(newTargets),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["placement-analytics"] });
      setShowTargetModal(false);
      setToastMsg("Institutional placement targets updated successfully.");
      setTimeout(() => setToastMsg(null), 4000);
    },
  });

  const openTargetModal = () => {
    if (data?.institutionalTargets) {
      setTargetPlacementPct(data.institutionalTargets.targetPlacementPct);
      setMinAverageLpaTarget(data.institutionalTargets.minAverageLpaTarget);
      setMockInterviewTarget(data.institutionalTargets.mockInterviewCompletionTarget);
      setTargetCompaniesCount(data.institutionalTargets.targetCompaniesCount);
    }
    setShowTargetModal(true);
  };

  const handleSaveTargets = () => {
    updateTargetsMutation.mutate({
      targetPlacementPct: Number(targetPlacementPct),
      minAverageLpaTarget: Number(minAverageLpaTarget),
      mockInterviewCompletionTarget: Number(mockInterviewTarget),
      targetCompaniesCount: Number(targetCompaniesCount),
    });
  };

  const exportReport = () => {
    if (!data) return;
    const { executiveSummary, departmentBreakdown, recruiterDrives, placedStudents } = data;
    const rows: unknown[][] = [
      ["Campus Placement & Industry Analytics Report", data.collegeName],
      ["Academic Cohort", data.academicYear],
      ["Department Scope", selectedDept === "all" ? "All Departments" : selectedDept],
      ["Role Perspective", role.toUpperCase()],
      ["Exported At", new Date().toLocaleString("en-IN")],
      [],
      ["Executive Placement Metrics"],
      ["Metric", "Value"],
      ["Total Eligible Students", executiveSummary.totalEligibleStudents],
      ["Placed Students Count", executiveSummary.placedStudentsCount],
      ["Placement Rate (%)", `${executiveSummary.placementPercentage}%`],
      ["Target Placement (%)", `${executiveSummary.targetPlacementPercentage}%`],
      ["Total Offers Released", executiveSummary.totalOffers],
      ["Multiple Offers Count", executiveSummary.multipleOffersCount],
      ["Average Package (LPA)", `₹${executiveSummary.averagePackageLpa} LPA`],
      ["Median Package (LPA)", `₹${executiveSummary.medianPackageLpa} LPA`],
      ["Highest Package (LPA)", `₹${executiveSummary.highestPackageLpa} LPA`],
      ["Recruiting Partners", executiveSummary.totalParticipatingRecruiters],
      [],
      ["Department Placement Performance"],
      ["Department", "Code", "Total", "Eligible", "Placed", "Rate (%)", "Avg LPA", "Highest LPA", "Top Recruiter"],
      ...departmentBreakdown.map((d) => [
        d.department,
        d.code,
        d.totalStudents,
        d.eligible,
        d.placed,
        `${d.placementRate}%`,
        `₹${d.avgPackageLpa} LPA`,
        `₹${d.highestPackageLpa} LPA`,
        d.topRecruiter,
      ]),
      [],
      ["Recruiter Campus Drives Performance"],
      ["Company", "Role", "Sector", "Tier", "CTC (LPA)", "Registered", "Shortlisted", "Offers", "Status"],
      ...recruiterDrives.map((d) => [
        d.company,
        d.role,
        d.sector,
        d.tier,
        `₹${d.ctcLpa} LPA`,
        d.registeredCount,
        d.shortlistedCount,
        d.offersCount,
        d.status,
      ]),
      [],
      ["Placed Students Ledger"],
      ["Roll No", "Student Name", "Department", "CGPA", "Readiness", "Company", "Role", "Package LPA", "Tier", "Status"],
      ...placedStudents.map((s) => [
        s.roll,
        s.name,
        s.department,
        s.cgpa,
        `${s.readinessScore}/100`,
        s.company || "Pending",
        s.role || "Pending",
        s.packageLpa ? `₹${s.packageLpa} LPA` : "–",
        s.tier,
        s.status,
      ]),
    ];

    const csvContent = toCsv(rows);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Placement_Analytics_${data.collegeId}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredStudents = useMemo(() => {
    if (!data?.placedStudents) return [];
    let list = data.placedStudents;
    if (studentStatusFilter !== "all") {
      list = list.filter((s) => s.status === studentStatusFilter);
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.roll.toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q) ||
        s.company.toLowerCase().includes(q) ||
        s.role.toLowerCase().includes(q)
    );
  }, [data?.placedStudents, searchQuery, studentStatusFilter]);

  const filteredDepts = useMemo(() => {
    if (!data?.departmentBreakdown) return [];
    if (!searchQuery.trim()) return data.departmentBreakdown;
    const q = searchQuery.toLowerCase().trim();
    return data.departmentBreakdown.filter(
      (d) => d.department.toLowerCase().includes(q) || d.code.toLowerCase().includes(q) || d.topRecruiter.toLowerCase().includes(q)
    );
  }, [data?.departmentBreakdown, searchQuery]);

  if (isLoading) return <TemplateSkeleton />;
  if (error || !data) {
    return (
      <EmptyState
        title="Failed to load placement analytics"
        body={error instanceof ApiError ? error.message : "Unable to retrieve institutional placement records."}
        action={<Button onClick={() => void refetch()}>Try Again</Button>}
      />
    );
  }

  const ex = data.executiveSummary;
  const isTargetMet = ex.placementPercentage >= ex.targetPlacementPercentage;
  const gapToTarget = (ex.targetPlacementPercentage - ex.placementPercentage).toFixed(1);

  // Unplaced students count for current view
  const unplacedCount = data.placedStudents.filter((s) => s.status === "Seeking Placement" || s.status === "In Process").length;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="flex items-center justify-between rounded-lg bg-teal-50 dark:bg-teal-950/40 p-3 text-sm text-teal-800 dark:text-teal-200 border border-teal-200 dark:border-teal-800 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Fi name="check" className="size-4 shrink-0 text-teal-600" />
            <span>{toastMsg}</span>
          </div>
          <button onClick={() => setToastMsg(null)} className="text-teal-600 hover:text-teal-800">
            <Fi name="x" className="size-4" />
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-surface-2 pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-ink">Placement Analytics & Industry Outcomes</h1>
            <Badge tone="brand" className="font-mono text-xs">
              {data.academicYear}
            </Badge>
            {isHod && (
              <Badge tone="teal" className="text-xs font-semibold">
                HOD View: Computer Science & Engineering
              </Badge>
            )}
            {isPlacement && (
              <Badge tone="gold" className="text-xs font-semibold">
                Placement Officer Desk
              </Badge>
            )}
            {isInstitution && (
              <Badge tone="brand" className="text-xs font-semibold">
                Institutional Leadership
              </Badge>
            )}
          </div>
          <p className="text-sm text-ink-3 mt-1">
            {data.collegeName} · Placement conversion, package tiers, hiring funnels, and department benchmarks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => void refetch()} disabled={isFetching} className="gap-1.5 text-xs">
            <Fi name="refresh" className={cn("size-3.5", isFetching && "animate-spin")} /> Refresh
          </Button>

          <Button variant="secondary" onClick={exportReport} className="gap-1.5 text-xs">
            <Fi name="download" className="size-3.5" /> Export Report (CSV)
          </Button>

          {(isInstitution || isPlacement || isAdmin) && (
            <Button onClick={openTargetModal} className="gap-1.5 text-xs bg-brand text-white hover:bg-brand-hover">
              <Fi name="target" className="size-3.5" /> Set Targets
            </Button>
          )}

          <Button
            variant="secondary"
            onClick={() => setShowRelatedPortals(!showRelatedPortals)}
            className="gap-1.5 text-xs"
          >
            <Fi name="link" className="size-3.5 text-brand" />
            {showRelatedPortals ? "Hide Related Workflows" : "Related Portals"}
          </Button>
        </div>
      </div>

      {/* CROSS-PORTAL CONNECTIVITY & ACTION WORKFLOWS BAR */}
      {showRelatedPortals && (
        <div className="rounded-xl border border-brand/20 bg-brand/5 dark:bg-brand/10 p-4 space-y-3 transition-all animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-brand text-white text-xs font-bold">
                ↗
              </span>
              <h2 className="text-sm font-semibold text-ink">Related Portals & Action Workflows Across Roles</h2>
            </div>
            <span className="text-xs text-ink-3">Deep linked to student preparation, drives, and recruiter shortlists</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* 1. HOD & Department Skills */}
            <Link
              href={`/${role === "placement" ? "institution" : role}/department-skills`}
              className="flex items-start gap-3 rounded-lg border border-surface-2 bg-surface p-3 hover:border-brand hover:shadow-xs transition-all group"
            >
              <div className="rounded-md bg-teal-50 dark:bg-teal-950/50 p-2 text-teal-600">
                <Fi name="target" className="size-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-ink group-hover:text-brand flex items-center gap-1">
                  Department Skills
                  <span className="text-[10px] text-ink-3">↗</span>
                </span>
                <p className="text-[11px] text-ink-3 line-clamp-2 mt-0.5">
                  Launch targeted bridge courses to fix System Design & DSA gaps.
                </p>
              </div>
            </Link>

            {/* 2. Placement Readiness Board */}
            <Link
              href="/placement/placement-board"
              className="flex items-start gap-3 rounded-lg border border-surface-2 bg-surface p-3 hover:border-brand hover:shadow-xs transition-all group"
            >
              <div className="rounded-md bg-brand-soft/50 p-2 text-brand">
                <Fi name="users" className="size-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-ink group-hover:text-brand flex items-center gap-1">
                  Placement Readiness Board
                  <span className="text-[10px] text-ink-3">↗</span>
                </span>
                <p className="text-[11px] text-ink-3 line-clamp-2 mt-0.5">
                  Filter students by verified readiness and shortlist for upcoming drives.
                </p>
              </div>
            </Link>

            {/* 3. Recruiter Talent Pool */}
            <Link
              href="/recruiter/talent-search"
              className="flex items-start gap-3 rounded-lg border border-surface-2 bg-surface p-3 hover:border-brand hover:shadow-xs transition-all group"
            >
              <div className="rounded-md bg-gold-soft/50 p-2 text-gold">
                <Fi name="search" className="size-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-ink group-hover:text-brand flex items-center gap-1">
                  Recruiter Talent Search
                  <span className="text-[10px] text-ink-3">↗</span>
                </span>
                <p className="text-[11px] text-ink-3 line-clamp-2 mt-0.5">
                  View how external recruiters discover and shortlist candidate profiles.
                </p>
              </div>
            </Link>

            {/* 4. Campus Recruitment Drives */}
            <Link
              href="/placement/drives"
              className="flex items-start gap-3 rounded-lg border border-surface-2 bg-surface p-3 hover:border-brand hover:shadow-xs transition-all group"
            >
              <div className="rounded-md bg-sky-50 dark:bg-sky-950/50 p-2 text-sky-600">
                <Fi name="calendar" className="size-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-ink group-hover:text-brand flex items-center gap-1">
                  Placement Drives
                  <span className="text-[10px] text-ink-3">↗</span>
                </span>
                <p className="text-[11px] text-ink-3 line-clamp-2 mt-0.5">
                  Schedule campus drives, criteria rules, and registration windows.
                </p>
              </div>
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-ink-3">
            <span className="font-semibold text-ink">Additional Linked Pages:</span>
            <Link href={`/${role}/curriculum`} className="hover:text-brand underline decoration-dotted">
              Curriculum Studio (Electives)
            </Link>
            <span>·</span>
            <Link href={`/${role}/early-warning`} className="hover:text-brand underline decoration-dotted">
              Early Warning Alerts
            </Link>
            <span>·</span>
            <Link href="/institution/bi-analytics" className="hover:text-brand underline decoration-dotted">
              Institutional BI
            </Link>
            <span>·</span>
            <Link href="/institution/aicte-compliance" className="hover:text-brand underline decoration-dotted">
              AICTE Compliance
            </Link>
            <span>·</span>
            <Link href="/recruiter/recruiter-interviews" className="hover:text-brand underline decoration-dotted">
              Recruiter Panels
            </Link>
          </div>
        </div>
      )}

      {/* HOD / Department Context Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-1 rounded-xl p-3.5 border border-surface-2">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full sm:w-auto">
          <span className="text-xs font-semibold text-ink-3 uppercase tracking-wider shrink-0">Department Scope:</span>
          {isHod ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setSelectedDept("Computer Science & Engineering")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
                  selectedDept === "Computer Science & Engineering"
                    ? "bg-brand text-white shadow-xs"
                    : "bg-surface text-ink-2 border border-surface-2 hover:bg-surface-2"
                )}
              >
                ⭐ My Department (CSE)
              </button>
              <button
                onClick={() => setSelectedDept("all")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
                  selectedDept === "all"
                    ? "bg-brand text-white shadow-xs"
                    : "bg-surface text-ink-2 border border-surface-2 hover:bg-surface-2"
                )}
              >
                🏛️ All Departments (College Benchmark)
              </button>
            </div>
          ) : (
            <select
              id="placement-department-scope-select"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className={cn(
                inputClass,
                "h-10 py-2 px-3.5 text-xs sm:text-sm font-medium w-full sm:w-auto min-w-[280px] max-w-full cursor-pointer leading-normal"
              )}
            >
              <option value="all">All Departments (Institutional)</option>
              <option value="Computer Science & Engineering">Computer Science & Engineering (CSE)</option>
              <option value="Artificial Intelligence & Data Science">Artificial Intelligence & Data Science (AIDS)</option>
              <option value="Information Technology">Information Technology (IT)</option>
              <option value="Biomedical Engineering">Biomedical Engineering (BME)</option>
              <option value="Electrical & Electronics Engineering">Electrical & Electronics Engineering (EEE)</option>
              <option value="Mechanical Engineering">Mechanical Engineering (MECH)</option>
            </select>
          )}
        </div>

        {selectedDept !== "all" && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-ink-3">Filtered Scope:</span>
            <Badge tone="teal" className="font-semibold">
              {selectedDept}
            </Badge>
            <button onClick={() => setSelectedDept("all")} className="text-ink-3 hover:text-ink underline text-xs">
              Clear Filter
            </button>
          </div>
        )}
      </div>

      {/* Target Progress Banner */}
      <div className="rounded-xl border border-surface-2 bg-surface p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                {selectedDept === "all" ? "College Placement Goal" : `${selectedDept} Goal`}
              </span>
              <Badge tone={isTargetMet ? "teal" : "gold"}>
                {isTargetMet ? "Target Achieved" : `${gapToTarget}% to Target (${ex.targetPlacementPercentage}%)`}
              </Badge>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-ink">{ex.placementPercentage}%</span>
              <span className="text-sm text-ink-3">
                of eligible students placed ({ex.placedStudentsCount} of {ex.totalEligibleStudents})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className="text-xs text-ink-3 block">Placement Target</span>
              <span className="text-lg font-bold text-ink">{ex.targetPlacementPercentage}%</span>
            </div>
            <div className="text-right border-l border-surface-2 pl-6">
              <span className="text-xs text-ink-3 block">Avg CTC Target</span>
              <span className="text-lg font-bold text-ink">₹{data.institutionalTargets.minAverageLpaTarget} LPA</span>
            </div>
            <div className="text-right border-l border-surface-2 pl-6">
              <span className="text-xs text-ink-3 block">Mock Interview Goal</span>
              <span className="text-lg font-bold text-teal-600 dark:text-teal-400">
                {data.institutionalTargets.mockInterviewCompletionTarget}%
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3">
          <Progress value={Math.min(ex.placementPercentage, 100)} className="h-2.5" />
        </div>
      </div>

      {/* Primary KPI Strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="p-4">
          <span className="text-xs font-medium text-ink-3">Total Offers</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-ink">{ex.totalOffers}</span>
          </div>
          <span className="mt-1 text-xs text-teal-600 block">+{ex.multipleOffersCount} multi-offers</span>
        </Card>

        <Card className="p-4">
          <span className="text-xs font-medium text-ink-3">Highest CTC</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-ink">₹{ex.highestPackageLpa}</span>
            <span className="text-xs font-medium text-ink-3">LPA</span>
          </div>
          <span className="mt-1 text-xs text-ink-3 block">Google Apex Eng.</span>
        </Card>

        <Card className="p-4">
          <span className="text-xs font-medium text-ink-3">Average CTC</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-ink">₹{ex.averagePackageLpa}</span>
            <span className="text-xs font-medium text-ink-3">LPA</span>
          </div>
          <span className="mt-1 text-xs text-ink-3 block">Median: ₹{ex.medianPackageLpa} LPA</span>
        </Card>

        <Card className="p-4">
          <span className="text-xs font-medium text-ink-3">Super Dream (&gt;15 LPA)</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-ink">{ex.superDreamOffers}</span>
          </div>
          <span className="mt-1 text-xs text-ink-3 block">14.1% of all offers</span>
        </Card>

        <Card className="p-4">
          <span className="text-xs font-medium text-ink-3">Dream (10–15 LPA)</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-ink">{ex.dreamOffers}</span>
          </div>
          <span className="mt-1 text-xs text-ink-3 block">28.2% of all offers</span>
        </Card>

        <Card className="p-4">
          <span className="text-xs font-medium text-ink-3">Seeking Placement</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-rose-600">{unplacedCount}</span>
          </div>
          <button
            onClick={() => {
              setActiveTab("students");
              setStudentStatusFilter("Seeking Placement");
            }}
            className="mt-1 text-xs text-brand hover:underline block text-left"
          >
            Review students ↗
          </button>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-surface-2 gap-2 overflow-x-auto text-sm font-medium">
        <button
          onClick={() => setActiveTab("overview")}
          className={cn(
            "pb-2.5 px-3 border-b-2 font-medium transition-colors shrink-0",
            activeTab === "overview"
              ? "border-brand text-brand font-semibold"
              : "border-transparent text-ink-3 hover:text-ink hover:border-surface-3"
          )}
        >
          Executive Overview
        </button>

        <button
          onClick={() => setActiveTab("departments")}
          className={cn(
            "pb-2.5 px-3 border-b-2 font-medium transition-colors shrink-0",
            activeTab === "departments"
              ? "border-brand text-brand font-semibold"
              : "border-transparent text-ink-3 hover:text-ink hover:border-surface-3"
          )}
        >
          Department League ({data.departmentBreakdown.length})
        </button>

        <button
          onClick={() => setActiveTab("drives")}
          className={cn(
            "pb-2.5 px-3 border-b-2 font-medium transition-colors shrink-0",
            activeTab === "drives"
              ? "border-brand text-brand font-semibold"
              : "border-transparent text-ink-3 hover:text-ink hover:border-surface-3"
          )}
        >
          Recruiter & Drive Analytics ({data.recruiterDrives.length})
        </button>

        <button
          onClick={() => setActiveTab("gaps")}
          className={cn(
            "pb-2.5 px-3 border-b-2 font-medium transition-colors shrink-0",
            activeTab === "gaps"
              ? "border-brand text-brand font-semibold"
              : "border-transparent text-ink-3 hover:text-ink hover:border-surface-3"
          )}
        >
          Readiness & Skill Gaps ({data.readinessGaps.length})
        </button>

        <button
          onClick={() => setActiveTab("students")}
          className={cn(
            "pb-2.5 px-3 border-b-2 font-medium transition-colors shrink-0",
            activeTab === "students"
              ? "border-brand text-brand font-semibold"
              : "border-transparent text-ink-3 hover:text-ink hover:border-surface-3"
          )}
        >
          Placed Student Directory ({filteredStudents.length})
        </button>
      </div>

      {/* TAB 1: EXECUTIVE OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Salary Tiers Segmented Visual */}
          <Card>
            <CardHeader
              title="Salary CTC Tier Distribution"
              subtitle="Breakdown of released offers across compensation tiers"
              action={<div className="text-xs font-semibold text-ink-3">Total: {ex.totalOffers} Offers</div>}
            />
            <CardBody className="space-y-4">
              <div className="flex h-5 w-full overflow-hidden rounded-full bg-surface-2 p-0.5">
                {data.salaryTierDistribution.map((tier) => (
                  <div
                    key={tier.tier}
                    style={{ width: `${tier.percentage}%`, backgroundColor: tier.color }}
                    className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                    title={`${tier.tier}: ${tier.offersCount} offers (${tier.percentage}%)`}
                  />
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {data.salaryTierDistribution.map((tier) => (
                  <div key={tier.tier} className="rounded-lg border border-surface-2 p-3 bg-surface">
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: tier.color }} />
                      <span className="text-xs font-semibold text-ink truncate">{tier.tier}</span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-xl font-bold text-ink">{tier.offersCount}</span>
                      <span className="text-xs font-semibold text-ink-3">{tier.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Hiring Funnel & Top Recruiters Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Hiring Conversion Funnel */}
            <Card>
              <CardHeader
                title="Campus Recruitment Funnel"
                subtitle="Student progression from registration through final offer"
                action={
                  <Link href="/placement/drives" className="text-xs text-brand hover:underline font-semibold">
                    Manage Drives ↗
                  </Link>
                }
              />
              <CardBody className="space-y-3">
                {data.hiringFunnel.map((step, idx) => (
                  <div key={step.stage} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-ink flex items-center gap-1.5">
                        <span className="flex size-4 items-center justify-center rounded-full bg-surface-2 text-[10px] text-ink-3">
                          {idx + 1}
                        </span>
                        {step.stage}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink">{step.count}</span>
                        <span className="text-ink-3">({step.conversionRate}%)</span>
                      </div>
                    </div>
                    <Progress value={step.conversionRate} className="h-2" />
                  </div>
                ))}
              </CardBody>
            </Card>

            {/* Top Hiring Partner Highlights */}
            <Card>
              <CardHeader
                title="Marquee Placement Drives"
                subtitle="Recruiting partners with highest compensation and offer releases"
                action={
                  <Link href="/recruiter/talent-search" className="text-xs text-brand hover:underline font-semibold">
                    Recruiter Pool ↗
                  </Link>
                }
              />
              <CardBody className="space-y-3">
                {data.recruiterDrives.slice(0, 4).map((drv) => (
                  <div
                    key={drv.driveId}
                    className="flex items-center justify-between rounded-lg border border-surface-2 p-3 hover:bg-surface-1 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-ink">{drv.company}</span>
                        <Badge tone={drv.tier === "Super Dream" ? "teal" : "brand"}>{drv.tier}</Badge>
                      </div>
                      <p className="text-xs text-ink-3 mt-0.5">
                        {drv.role} · {drv.sector}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-base font-bold text-ink">₹{drv.ctcLpa} LPA</span>
                      <span className="text-xs text-teal-600 block">{drv.offersCount} offers</span>
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: DEPARTMENT LEAGUE */}
      {activeTab === "departments" && (
        <Card>
          <CardHeader
            title="Department Placement Matrix"
            subtitle="Comparative placement metrics, average packages, and top recruiters across departments"
            action={
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search departments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(inputClass, "h-9 py-1.5 px-3 text-xs w-full sm:w-64")}
                />
                <Link
                  href={`/${role === "placement" ? "institution" : role}/department-skills`}
                  className="hidden sm:inline-flex items-center gap-1 text-xs text-brand hover:underline font-medium"
                >
                  Bridge Courses ↗
                </Link>
              </div>
            }
          />
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-2/60 text-ink-3 font-semibold border-b border-surface-2">
                  <tr>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-3">Total / Eligible</th>
                    <th className="py-3 px-3">Placed</th>
                    <th className="py-3 px-3">Placement %</th>
                    <th className="py-3 px-3">Avg CTC</th>
                    <th className="py-3 px-3">Highest CTC</th>
                    <th className="py-3 px-3">Readiness</th>
                    <th className="py-3 px-4">Top Hiring Partner</th>
                    <th className="py-3 px-3 text-right">Quick Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-2">
                  {filteredDepts.map((d) => (
                    <tr key={d.code} className="hover:bg-surface-1 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-ink">
                        <div>{d.department}</div>
                        <span className="font-mono text-[10px] text-ink-3 uppercase">{d.code}</span>
                      </td>
                      <td className="py-3.5 px-3 text-ink">
                        {d.totalStudents} / {d.eligible}
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-ink">{d.placed}</td>
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-ink">{d.placementRate}%</span>
                          <div className="w-16">
                            <Progress value={d.placementRate} className="h-1.5" />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-ink">₹{d.avgPackageLpa} LPA</td>
                      <td className="py-3.5 px-3 font-bold text-teal-600">₹{d.highestPackageLpa} LPA</td>
                      <td className="py-3.5 px-3">
                        <Badge tone={d.readinessScore >= 90 ? "teal" : d.readinessScore >= 80 ? "brand" : "gold"}>
                          {d.readinessScore}/100
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-ink-2">{d.topRecruiter}</td>
                      <td className="py-3.5 px-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedDept(d.department);
                            setActiveTab("students");
                          }}
                          className="text-xs font-semibold text-brand hover:underline"
                        >
                          View Students ↗
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* TAB 3: RECRUITER & DRIVE ANALYTICS */}
      {activeTab === "drives" && (
        <Card>
          <CardHeader
            title="Campus Recruitment Drives"
            subtitle="Drive attendance, shortlisting ratio, and final offers"
            action={
              <div className="flex items-center gap-2">
                <select
                  value={selectedTier}
                  onChange={(e) => setSelectedTier(e.target.value)}
                  className={cn(inputClass, "h-9 py-1.5 px-3 text-xs w-full sm:w-36 cursor-pointer")}
                >
                  <option value="all">All Tiers</option>
                  <option value="Super Dream">Super Dream</option>
                  <option value="Dream">Dream</option>
                  <option value="Core">Core</option>
                  <option value="Mass">Mass</option>
                </select>

                <Link href="/placement/drives" className="text-xs font-semibold text-brand hover:underline ml-2">
                  Placement Drives Hub ↗
                </Link>
              </div>
            }
          />
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-2/60 text-ink-3 font-semibold border-b border-surface-2">
                  <tr>
                    <th className="py-3 px-4">Company</th>
                    <th className="py-3 px-3">Role</th>
                    <th className="py-3 px-3">Tier & Sector</th>
                    <th className="py-3 px-3">CTC</th>
                    <th className="py-3 px-3">Registered</th>
                    <th className="py-3 px-3">Shortlisted</th>
                    <th className="py-3 px-3">Offers</th>
                    <th className="py-3 px-3">Conversion</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Linked Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-2">
                  {data.recruiterDrives.map((drv) => {
                    const convPct = drv.registeredCount > 0 ? ((drv.offersCount / drv.registeredCount) * 100).toFixed(1) : "0.0";
                    return (
                      <tr key={drv.driveId} className="hover:bg-surface-1 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-ink">{drv.company}</td>
                        <td className="py-3.5 px-3 text-ink-2">{drv.role}</td>
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <Badge tone={drv.tier === "Super Dream" ? "teal" : drv.tier === "Dream" ? "brand" : "gold"}>
                              {drv.tier}
                            </Badge>
                            <span className="text-[10px] text-ink-3">{drv.sector}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 font-bold text-ink">₹{drv.ctcLpa} LPA</td>
                        <td className="py-3.5 px-3 text-ink">{drv.registeredCount}</td>
                        <td className="py-3.5 px-3 text-ink">{drv.shortlistedCount}</td>
                        <td className="py-3.5 px-3 font-bold text-teal-600">{drv.offersCount}</td>
                        <td className="py-3.5 px-3 font-semibold text-ink-2">{convPct}%</td>
                        <td className="py-3.5 px-3">
                          <Badge tone={drv.status === "Completed" ? "teal" : drv.status === "Active" ? "brand" : "sky"}>
                            {drv.status}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Link href="/placement/placement-board" className="text-xs text-brand hover:underline font-medium">
                            Shortlist Students ↗
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* TAB 4: READINESS & SKILL GAPS */}
      {activeTab === "gaps" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-surface-1 p-3 rounded-lg border border-surface-2">
            <span className="text-xs text-ink-3">
              Identified critical gaps across departments. Click &quot;Launch Bridge Course&quot; to push interventions directly into Department Skills.
            </span>
            <Link
              href={`/${role === "placement" ? "institution" : role}/department-skills`}
              className="text-xs font-semibold text-brand hover:underline flex items-center gap-1"
            >
              Open Department Skills Desk ↗
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {data.readinessGaps.map((gap) => (
              <Card key={gap.competency} className="p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm text-ink">{gap.competency}</h4>
                    <Badge tone={gap.status === "Healthy" ? "teal" : gap.status === "Attention" ? "gold" : "rose"}>
                      {gap.status} ({gap.avgScore}%)
                    </Badge>
                  </div>
                  <div className="mt-3">
                    <Progress value={gap.avgScore} className="h-2" />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-ink-3">
                    <span>Proficient: {gap.proficientCount} students</span>
                    <span className="text-rose-600 font-medium">Critical Gaps: {gap.criticalCount} students</span>
                  </div>
                </div>

                <div className="mt-4 rounded-md bg-surface-2/60 p-3 text-xs text-ink-2 space-y-2">
                  <div>
                    <span className="font-semibold text-ink block mb-0.5">Recommended Intervention:</span>
                    {gap.recommendation}
                  </div>
                  <div className="pt-2 border-t border-surface-2 flex items-center justify-between">
                    <Link
                      href={`/${role === "placement" ? "institution" : role}/department-skills`}
                      className="text-brand font-semibold hover:underline flex items-center gap-1 text-[11px]"
                    >
                      <Fi name="target" className="size-3" /> Launch Bridge Course ↗
                    </Link>
                    <Link
                      href={`/${role}/early-warning`}
                      className="text-ink-3 hover:text-ink text-[11px]"
                    >
                      Check Early Warning ↗
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: PLACED STUDENT DIRECTORY */}
      {activeTab === "students" && (
        <Card>
          <CardHeader
            title="Placed & Interviewing Candidate Ledger"
            subtitle="Live record of student placement offers, packages, and recruiter verification"
            action={
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={studentStatusFilter}
                  onChange={(e) => setStudentStatusFilter(e.target.value)}
                  className={cn(inputClass, "h-9 py-1.5 px-3 text-xs w-full sm:w-40 cursor-pointer")}
                >
                  <option value="all">All Statuses</option>
                  <option value="Placed">Placed</option>
                  <option value="Seeking Placement">Seeking Placement</option>
                  <option value="In Process">In Process</option>
                </select>

                <input
                  type="text"
                  placeholder="Search candidates, companies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(inputClass, "h-9 py-1.5 px-3 text-xs w-full sm:w-56")}
                />

                <Link
                  href="/placement/placement-board"
                  className="hidden sm:inline-flex items-center gap-1 text-xs text-brand hover:underline font-semibold"
                >
                  Placement Board ↗
                </Link>
              </div>
            }
          />
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-2/60 text-ink-3 font-semibold border-b border-surface-2">
                  <tr>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-3">Department</th>
                    <th className="py-3 px-3">CGPA</th>
                    <th className="py-3 px-3">Readiness</th>
                    <th className="py-3 px-3">Hired Company</th>
                    <th className="py-3 px-3">Role Designation</th>
                    <th className="py-3 px-3">Package (CTC)</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Student Workflows</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-2">
                  {filteredStudents.map((st) => (
                    <tr key={st.roll} className="hover:bg-surface-1 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-ink">
                        <div>{st.name}</div>
                        <span className="font-mono text-[10px] text-ink-3">{st.roll}</span>
                      </td>
                      <td className="py-3.5 px-3 text-ink-2">{st.department}</td>
                      <td className="py-3.5 px-3 font-bold text-ink">{st.cgpa}</td>
                      <td className="py-3.5 px-3">
                        <Badge tone={st.readinessScore >= 90 ? "teal" : "brand"}>{st.readinessScore}%</Badge>
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-ink">{st.company || "–"}</td>
                      <td className="py-3.5 px-3 text-ink-2">{st.role || "In Pipeline"}</td>
                      <td className="py-3.5 px-3 font-bold text-teal-600">
                        {st.packageLpa > 0 ? `₹${st.packageLpa} LPA` : "–"}
                      </td>
                      <td className="py-3.5 px-3">
                        <Badge
                          tone={
                            st.status === "Placed"
                              ? "teal"
                              : st.status === "In Process"
                              ? "gold"
                              : "sky"
                          }
                        >
                          {st.status}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href="/placement/placement-board"
                          className="text-xs font-semibold text-brand hover:underline"
                        >
                          Readiness Board ↗
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Target Setting Modal */}
      {showTargetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-xl bg-surface border border-surface-2 p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-surface-2 pb-3">
              <h3 className="text-lg font-bold text-ink">Set Institutional Placement Targets</h3>
              <button onClick={() => setShowTargetModal(false)} className="text-ink-3 hover:text-ink">
                <Fi name="x" className="size-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-ink block mb-1">Target Placement Percentage (%)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="60"
                    max="100"
                    value={targetPlacementPct}
                    onChange={(e) => setTargetPlacementPct(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="w-12 text-right font-bold text-sm text-ink">{targetPlacementPct}%</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-ink block mb-1">Target Average Package (₹ LPA)</label>
                <input
                  type="number"
                  step="0.5"
                  min="3"
                  max="30"
                  value={minAverageLpaTarget}
                  onChange={(e) => setMinAverageLpaTarget(Number(e.target.value))}
                  className={cn(inputClass, "w-full")}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-ink block mb-1">Mock Interview Completion Target (%)</label>
                <input
                  type="number"
                  min="50"
                  max="100"
                  value={mockInterviewTarget}
                  onChange={(e) => setMockInterviewTarget(Number(e.target.value))}
                  className={cn(inputClass, "w-full")}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-ink block mb-1">Target Recruiting Partners Count</label>
                <input
                  type="number"
                  min="10"
                  max="200"
                  value={targetCompaniesCount}
                  onChange={(e) => setTargetCompaniesCount(Number(e.target.value))}
                  className={cn(inputClass, "w-full")}
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-surface-2 pt-3">
              <Button variant="secondary" onClick={() => setShowTargetModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveTargets}
                disabled={updateTargetsMutation.isPending}
                className="bg-brand text-white hover:bg-brand-hover"
              >
                {updateTargetsMutation.isPending ? "Saving..." : "Save Targets"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
