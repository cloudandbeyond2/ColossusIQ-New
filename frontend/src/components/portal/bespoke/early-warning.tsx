"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api/client";
import {
  CreateSupportActionInput,
  EarlyWarningData,
  type EarlyWarningIntervention,
  type EarlyWarningSignal,
  type EarlyWarningStudent,
  type Tone,
  UpdateReviewStatusInput,
  UpdateReviewStatusResponse,
} from "@/lib/api/schemas";
import { toCsv } from "@/lib/csv";
import { TemplateSkeleton } from "@/components/modules/shared";
import { ChartCard } from "@/components/charts/chart-card";
import { Fi } from "@/components/ui/icon";
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Progress,
  Spinner,
  inputClass,
  toneForScore,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth/roles";

type TabKey = "roster" | "analytics" | "interventions";

export function EarlyWarningModule({ role }: { role: Role }) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("roster");
  const [selectedDept, setSelectedDept] = useState<string>("All Departments");
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<string>("All Levels");
  const [selectedStatus, setSelectedStatus] = useState<string>("All Statuses");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  // Modals state
  const [showActionModal, setShowActionModal] = useState<boolean>(false);
  const [selectedStudent, setSelectedStudent] = useState<EarlyWarningStudent | null>(null);
  const [inspectStudent, setInspectStudent] = useState<EarlyWarningStudent | null>(null);

  // Form state for support action
  const [targetStudentId, setTargetStudentId] = useState<string>("");
  const [targetStudentName, setTargetStudentName] = useState<string>("");
  const [actionStrategy, setActionStrategy] = useState<string>("1-on-1 Faculty Mentorship");
  const [actionFacultyLead, setActionFacultyLead] = useState<string>("");
  const [actionTargetDate, setActionTargetDate] = useState<string>("");
  const [actionNotes, setActionNotes] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (selectedDept !== "All Departments") p.set("department", selectedDept);
    if (selectedRiskLevel !== "All Levels") p.set("riskLevel", selectedRiskLevel);
    if (searchQuery.trim()) p.set("q", searchQuery.trim());
    const qs = p.toString();
    return qs ? `?${qs}` : "";
  }, [selectedDept, selectedRiskLevel, searchQuery]);

  const q = useQuery({
    queryKey: ["early-warning", selectedDept, selectedRiskLevel, searchQuery],
    queryFn: () => apiFetch(`/api/v1/early-warning${queryParams}`, EarlyWarningData),
  });

  const createActionMut = useMutation({
    mutationFn: (input: CreateSupportActionInput) =>
      apiFetch("/api/v1/early-warning/interventions", CreateSupportActionInput, {
        method: "POST",
        body: input,
      }),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ["early-warning"] });
      setShowActionModal(false);
      setSelectedStudent(null);
      setFlashMessage(`Successfully logged support plan for ${created.studentName}`);
      setActionNotes("");
      setTimeout(() => setFlashMessage(null), 5000);
    },
    onError: (err) => {
      setFormError(err instanceof ApiError ? err.message : "Failed to record support plan");
    },
  });

  const updateStatusMut = useMutation({
    mutationFn: (input: UpdateReviewStatusInput) =>
      apiFetch(`/api/v1/early-warning/reviews/${encodeURIComponent(input.studentId)}`, UpdateReviewStatusResponse, {
        method: "PATCH",
        body: input,
      }),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["early-warning"] });
      setFlashMessage(`Case review status updated to "${vars.reviewStatus}"`);
      setTimeout(() => setFlashMessage(null), 4000);
    },
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await q.refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleOpenActionModal = (student?: EarlyWarningStudent) => {
    setFormError(null);
    if (student) {
      setSelectedStudent(student);
      setTargetStudentId(student.id);
      setTargetStudentName(student.studentName);
      if (student.signals.some((s) => s.type === "academic")) {
        setActionStrategy("1-on-1 Faculty Mentorship");
      } else if (student.signals.some((s) => s.type === "certification")) {
        setActionStrategy("Enroll in Skill Booster & Certification Clinic");
      } else if (student.signals.some((s) => s.type === "interview")) {
        setActionStrategy("Placement Cell Mock Interview Practice");
      } else {
        setActionStrategy("Academic Advisory & Counsellor Check-in");
      }
    } else {
      setSelectedStudent(null);
      const first = q.data?.students[0];
      setTargetStudentId(first?.id || "");
      setTargetStudentName(first?.studentName || "");
      setActionStrategy("1-on-1 Faculty Mentorship");
    }
    setActionFacultyLead(q.data?.availableFaculty[0] || "");
    setActionTargetDate(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
    setActionNotes("");
    setShowActionModal(true);
  };

  const handleExportCsv = () => {
    if (!q.data) return;
    const { students, college, department } = q.data;
    const rows = [
      ["Student Success & Early Warning Audit", college.name],
      ["Department Scope", department],
      ["Generated", new Date().toLocaleString("en-IN")],
      [],
      [
        "Student Name",
        "Roll No",
        "Department",
        "Batch",
        "Quiz Avg (%)",
        "Certifications",
        "Mock Interview",
        "Resume ATS",
        "Overall Score",
        "Risk Tier",
        "Observed Signals",
        "Recommended Action",
        "Review Status",
        "Assigned Mentor",
        "Last Action Date",
      ],
      ...students.map((s) => [
        s.studentName,
        s.rollNo,
        s.department,
        s.batch,
        s.quizAverage,
        s.certificatesCount,
        s.interviewScore,
        s.resumeScore,
        s.overallScore,
        s.riskLevel,
        s.signals.map((sig) => sig.title).join(" | "),
        s.recommendation,
        s.reviewStatus,
        s.assignedMentor || "Unassigned",
        s.lastActionDate || "N/A",
      ]),
    ];

    const csvContent = toCsv(rows);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Early-Warning-Report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (q.isLoading) return <TemplateSkeleton />;
  if (q.error || !q.data) {
    return (
      <EmptyState
        title="Student Success & Early Warning unavailable"
        body={q.error instanceof ApiError ? q.error.message : "Failed to load early warning indicators."}
        action={<Button onClick={() => void q.refetch()}>Retry</Button>}
      />
    );
  }

  const {
    availableDepartments,
    availableRiskLevels,
    availableFaculty,
    kpis,
    riskDistribution,
    signalsBreakdown,
    departmentRiskComparison,
    students,
    interventions,
    insights,
  } = q.data;

  // Filter roster by selected status if needed
  const displayStudents = students.filter((s) => {
    if (selectedStatus !== "All Statuses" && s.reviewStatus !== selectedStatus) return false;
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Flash message */}
      {flashMessage && (
        <div className="rounded-xl border border-teal/30 bg-teal-soft/80 p-3.5 text-sm font-medium text-teal backdrop-blur animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <Fi name="check-circle" className="size-4 shrink-0" />
            <span>{flashMessage}</span>
          </div>
        </div>
      )}

      {/* Ethical AI Advisory Banner */}
      <div className="rounded-2xl border border-amber/25 bg-amber-soft/50 p-4 text-xs text-ink/80 backdrop-blur">
        <div className="flex items-start gap-3">
          <Fi name="shield-check" className="size-5 shrink-0 text-amber mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-ink">Ethical Advisory & Decision Principle:</span>
            <p>
              Signals shown here are algorithmic suggestions for proactive human review based on continuous assessments and learning outcomes.
              Students are never automatically penalised or labelled. All advisory actions, tutoring, and support plans rest solely with faculty advisors and counsellors.
            </p>
          </div>
        </div>
      </div>

      {/* Top Controls Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-edge bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Department Filter */}
          <div className="relative">
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className={cn(inputClass, "h-9 py-1 text-xs pr-7 font-medium cursor-pointer")}
              aria-label="Filter Department"
            >
              {availableDepartments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Risk Level Filter */}
          <div className="relative">
            <select
              value={selectedRiskLevel}
              onChange={(e) => setSelectedRiskLevel(e.target.value)}
              className={cn(inputClass, "h-9 py-1 text-xs pr-7 font-medium cursor-pointer")}
              aria-label="Filter Risk Level"
            >
              {availableRiskLevels.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
          </div>

          {/* Review Status Filter */}
          <div className="relative">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className={cn(inputClass, "h-9 py-1 text-xs pr-7 font-medium cursor-pointer")}
              aria-label="Filter Review Status"
            >
              <option value="All Statuses">All Statuses</option>
              <option value="Pending review">Pending review</option>
              <option value="In progress">In progress</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>

          {/* Search Box */}
          <div className="relative min-w-47.5 sm:min-w-55">
            <input
              type="text"
              placeholder="Search student or roll no..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(inputClass, "h-9 py-1 pl-8 text-xs")}
            />
            <Fi name="search" className="absolute left-2.5 top-2.5 size-3.5 text-ink-3" />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void handleRefresh()}
            disabled={isRefreshing}
            className="h-9 gap-1.5 text-xs"
          >
            <Fi name="refresh" className={cn("size-3.5", isRefreshing && "animate-spin")} />
            Refresh
          </Button>

          <Button size="sm" variant="secondary" onClick={handleExportCsv} className="h-9 gap-1.5 text-xs">
            <Fi name="download" className="size-3.5" />
            Audit CSV
          </Button>

          <Button
            size="sm"
            variant="primary"
            onClick={() => handleOpenActionModal()}
            className="h-9 gap-1.5 text-xs"
          >
            <Fi name="plus" className="size-3.5" />
            Log Support Plan
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {kpis.map((kpi, idx) => (
          <Card key={idx} className="relative overflow-hidden transition-all hover:shadow-card">
            <CardBody className="p-4">
              <div className="flex items-start justify-between">
                <span className="text-xs font-medium text-ink-2">{kpi.label}</span>
                {kpi.tone && <Badge tone={kpi.tone as Tone}>{kpi.delta || "Live"}</Badge>}
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-ink">{kpi.value}</div>
              {kpi.hint && <div className="mt-1 text-[11px] text-ink-3 truncate">{kpi.hint}</div>}
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-edge">
        <button
          onClick={() => setActiveTab("roster")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
            activeTab === "roster"
              ? "border-brand text-brand"
              : "border-transparent text-ink-2 hover:border-edge-2 hover:text-ink"
          )}
        >
          <Fi name="users" className="size-4" />
          At-Risk Students Roster
          <span className="ml-1 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-ink-2">
            {displayStudents.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("analytics")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
            activeTab === "analytics"
              ? "border-brand text-brand"
              : "border-transparent text-ink-2 hover:border-edge-2 hover:text-ink"
          )}
        >
          <Fi name="chart-histogram" className="size-4" />
          Cohort Risk Analytics & Trends
        </button>

        <button
          onClick={() => setActiveTab("interventions")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
            activeTab === "interventions"
              ? "border-brand text-brand"
              : "border-transparent text-ink-2 hover:border-edge-2 hover:text-ink"
          )}
        >
          <Fi name="clipboard-list" className="size-4" />
          Support Plans & Case Log
          <span className="ml-1 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-ink-2">
            {interventions.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Students Roster */}
      {activeTab === "roster" && (
        <Card className="overflow-hidden border-edge">
          <div className="flex flex-col gap-1 border-b border-edge bg-surface-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink">Flagged Students Requiring Advisory Attention</h2>
              <p className="text-xs text-ink-2">
                Real-time algorithmic risk indicators across continuous assessments, verified credentials, and interview benchmarks.
              </p>
            </div>
            <div className="text-xs text-ink-3">Showing {displayStudents.length} student(s)</div>
          </div>
          <CardBody className="p-0">
            {displayStudents.length === 0 ? (
              <div className="p-8 text-center">
                <Fi name="check-circle" className="mx-auto size-10 text-teal/80" />
                <h4 className="mt-3 text-sm font-medium text-ink">No At-Risk Students Found</h4>
                <p className="mt-1 text-xs text-ink-3">
                  All students in this filter range are progressing satisfactorily without critical risk flags.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-edge bg-surface-2/60 text-[11px] font-semibold uppercase tracking-wider text-ink-2">
                    <tr>
                      <th className="px-4 py-3">Student & Roll No</th>
                      <th className="px-3 py-3">Department</th>
                      <th className="px-3 py-3 text-center">Quiz Avg</th>
                      <th className="px-3 py-3 text-center">Certs</th>
                      <th className="px-3 py-3 text-center">Interview</th>
                      <th className="px-3 py-3 text-center">Resume</th>
                      <th className="px-3 py-3 text-center">Overall</th>
                      <th className="px-3 py-3">Risk Tier</th>
                      <th className="px-4 py-3">Signals Observed</th>
                      <th className="px-3 py-3">Review Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-edge">
                    {displayStudents.map((st) => (
                      <tr key={st.id} className="transition-colors hover:bg-surface-1">
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setInspectStudent(st)}
                            className="text-left font-semibold text-ink hover:text-brand transition-colors block"
                          >
                            {st.studentName}
                          </button>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[10px] text-ink-3">{st.rollNo}</span>
                            <span className="text-[10px] text-ink-4">·</span>
                            <span className="text-[10px] text-ink-3">{st.batch}</span>
                          </div>
                        </td>

                        <td className="px-3 py-3 text-ink-2">{st.department}</td>

                        <td className="px-3 py-3 text-center font-medium">
                          <span
                            className={cn(
                              st.quizAverage < 50 ? "text-rose font-semibold" : "text-ink-2"
                            )}
                          >
                            {st.quizAverage}%
                          </span>
                        </td>

                        <td className="px-3 py-3 text-center font-medium">
                          <span
                            className={cn(
                              st.certificatesCount === 0 ? "text-amber font-semibold" : "text-ink-2"
                            )}
                          >
                            {st.certificatesCount}
                          </span>
                        </td>

                        <td className="px-3 py-3 text-center font-medium">
                          <span
                            className={cn(
                              st.interviewScore < 50 ? "text-amber font-semibold" : "text-ink-2"
                            )}
                          >
                            {st.interviewScore}
                          </span>
                        </td>

                        <td className="px-3 py-3 text-center font-medium">
                          <span
                            className={cn(
                              st.resumeScore < 50 ? "text-amber font-semibold" : "text-ink-2"
                            )}
                          >
                            {st.resumeScore}
                          </span>
                        </td>

                        <td className="px-3 py-3 text-center">
                          <span
                            className={cn(
                              "rounded-md px-1.5 py-0.5 text-[11px] font-bold",
                              st.overallScore >= 70
                                ? "bg-teal-soft text-teal"
                                : st.overallScore >= 55
                                ? "bg-sky-soft text-sky"
                                : "bg-rose-soft text-rose"
                            )}
                          >
                            {st.overallScore}
                          </span>
                        </td>

                        <td className="px-3 py-3">
                          <Badge
                            tone={
                              st.riskLevel === "Critical"
                                ? "rose"
                                : st.riskLevel === "Moderate"
                                ? "amber"
                                : st.riskLevel === "Watchlist"
                                ? "sky"
                                : "teal"
                            }
                          >
                            {st.riskLevel}
                          </Badge>
                        </td>

                        <td className="px-4 py-3 max-w-65">
                          <div className="flex flex-wrap gap-1">
                            {st.signals.map((sig) => (
                              <span
                                key={sig.id}
                                title={sig.detail}
                                className={cn(
                                  "rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight cursor-help",
                                  sig.severity === "critical"
                                    ? "bg-rose-soft text-rose border border-rose/20"
                                    : sig.severity === "moderate"
                                    ? "bg-amber-soft text-amber border border-amber/20"
                                    : "bg-surface-2 text-ink-2"
                                )}
                              >
                                {sig.title}
                              </span>
                            ))}
                          </div>
                        </td>

                        <td className="px-3 py-3">
                          <select
                            value={st.reviewStatus}
                            onChange={(e) =>
                              updateStatusMut.mutate({
                                studentId: st.id,
                                reviewStatus: e.target.value as "Pending review" | "In progress" | "Resolved",
                              })
                            }
                            className={cn(
                              "rounded-md border px-2 py-1 text-[11px] font-semibold cursor-pointer transition-colors",
                              st.reviewStatus === "Resolved"
                                ? "border-teal/30 bg-teal-soft text-teal"
                                : st.reviewStatus === "In progress"
                                ? "border-sky/30 bg-sky-soft text-sky"
                                : "border-rose/30 bg-rose-soft text-rose"
                            )}
                          >
                            <option value="Pending review">Pending review</option>
                            <option value="In progress">In progress</option>
                            <option value="Resolved">Resolved</option>
                          </select>
                          {st.assignedMentor && (
                            <div className="mt-1 text-[10px] text-ink-3 truncate" title={st.assignedMentor}>
                              Lead: {st.assignedMentor}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setInspectStudent(st)}
                              className="h-7 px-2 text-[11px]"
                              title="View Signals Breakdown"
                            >
                              Details
                            </Button>

                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleOpenActionModal(st)}
                              className="h-7 px-2 text-[11px] gap-1"
                            >
                              <Fi name="plus" className="size-3" />
                              Plan
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Tab 2: Analytics & Cohort Trends */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard spec={riskDistribution} />
            <ChartCard spec={signalsBreakdown} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard spec={departmentRiskComparison} />

            {/* AI Insights & Advisory Summary */}
            <Card className="border-edge">
              <div className="border-b border-edge px-4 py-3">
                <h3 className="text-sm font-semibold text-ink">Institutional Observations & Guidance</h3>
              </div>
              <CardBody className="p-4 space-y-3.5">
                {insights.map((ins, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-xl border p-3.5 text-xs transition-all",
                      ins.tone === "rose"
                        ? "border-rose/30 bg-rose-soft/50 text-ink"
                        : ins.tone === "amber"
                        ? "border-amber/30 bg-amber-soft/50 text-ink"
                        : ins.tone === "teal"
                        ? "border-teal/30 bg-teal-soft/50 text-ink"
                        : "border-edge bg-surface-1 text-ink"
                    )}
                  >
                    <div className="flex items-center gap-2 font-semibold">
                      <Fi
                        name={ins.tone === "rose" ? "triangle-warning" : "info"}
                        className={cn(
                          "size-4 shrink-0",
                          ins.tone === "rose"
                            ? "text-rose"
                            : ins.tone === "amber"
                            ? "text-amber"
                            : "text-brand"
                        )}
                      />
                      <span>{ins.title}</span>
                    </div>
                    <p className="mt-1 text-ink-2 leading-relaxed">{ins.body}</p>
                    <div className="mt-2 text-[11px] font-medium text-ink-3">
                      Data evidence: {ins.evidence}
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {/* Tab 3: Case Interventions Log */}
      {activeTab === "interventions" && (
        <Card className="overflow-hidden border-edge">
          <div className="flex flex-col gap-1 border-b border-edge bg-surface-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink">Support Action Plans & Mentorship Log</h2>
              <p className="text-xs text-ink-2">
                Active interventions scheduled by academic advisors, department heads, and counsellors.
              </p>
            </div>
            <Button
              size="sm"
              variant="primary"
              onClick={() => handleOpenActionModal()}
              className="h-8 gap-1.5 text-xs"
            >
              <Fi name="plus" className="size-3.5" />
              Schedule Support Action
            </Button>
          </div>
          <CardBody className="p-0">
            {interventions.length === 0 ? (
              <div className="p-8 text-center">
                <Fi name="clipboard-list" className="mx-auto size-10 text-ink-3" />
                <h4 className="mt-3 text-sm font-medium text-ink">No Support Plans Logged Yet</h4>
                <p className="mt-1 text-xs text-ink-3">
                  Click 'Schedule Support Action' to log 1-on-1 mentorship, remedial sessions, or counselling reviews.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-edge bg-surface-2/60 text-[11px] font-semibold uppercase tracking-wider text-ink-2">
                    <tr>
                      <th className="px-4 py-3">Case ID</th>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-3 py-3">Department</th>
                      <th className="px-3 py-3">Strategy</th>
                      <th className="px-3 py-3">Faculty / Advisor Lead</th>
                      <th className="px-3 py-3">Target Date</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-4 py-3">Case Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-edge">
                    {interventions.map((item) => (
                      <tr key={item.id} className="hover:bg-surface-1 transition-colors">
                        <td className="px-4 py-3 font-mono font-medium text-ink-3">{item.id}</td>
                        <td className="px-4 py-3 font-semibold text-ink">
                          {item.studentName}
                          {item.rollNo && (
                            <span className="block font-mono text-[10px] text-ink-3">{item.rollNo}</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-ink-2">{item.department || "General"}</td>
                        <td className="px-3 py-3 font-medium text-brand">{item.strategy}</td>
                        <td className="px-3 py-3 text-ink-2">{item.facultyLead}</td>
                        <td className="px-3 py-3 text-ink-3">{item.targetDate}</td>
                        <td className="px-3 py-3">
                          <Badge
                            tone={
                              item.status === "Completed"
                                ? "teal"
                                : item.status === "In progress"
                                ? "sky"
                                : "amber"
                            }
                          >
                            {item.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-ink-2 max-w-60 truncate" title={item.notes}>
                          {item.notes || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Modal: Schedule Support Action */}
      {showActionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-2xl border border-edge bg-surface shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-edge px-5 py-4 bg-surface-1">
              <div className="flex items-center gap-2">
                <Fi name="user-check" className="size-5 text-brand" />
                <h3 className="text-base font-semibold text-ink">
                  {selectedStudent ? `Support Plan for ${selectedStudent.studentName}` : "Schedule Student Support Plan"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowActionModal(false)}
                className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors"
              >
                <Fi name="cross" className="size-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setFormError(null);
                createActionMut.mutate({
                  studentId: targetStudentId,
                  studentName: targetStudentName,
                  strategy: actionStrategy,
                  facultyLead: actionFacultyLead,
                  targetDate: actionTargetDate,
                  notes: actionNotes,
                });
              }}
              className="p-5 space-y-4"
            >
              {formError && (
                <div className="rounded-lg bg-rose-soft/80 p-3 text-xs font-medium text-rose border border-rose/30">
                  {formError}
                </div>
              )}

              {/* Student Selection */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">Target Student</label>
                {selectedStudent ? (
                  <div className="rounded-xl border border-edge bg-surface-2/60 p-3 text-xs">
                    <span className="font-semibold text-ink">{selectedStudent.studentName}</span>
                    <span className="text-ink-3 ml-2">({selectedStudent.rollNo} · {selectedStudent.department})</span>
                    <div className="mt-1 text-[11px] text-rose font-medium">
                      Risk Tier: {selectedStudent.riskLevel} · Overall: {selectedStudent.overallScore}/100
                    </div>
                  </div>
                ) : (
                  <select
                    value={targetStudentId}
                    onChange={(e) => {
                      const st = q.data?.students.find((s) => s.id === e.target.value);
                      setTargetStudentId(e.target.value);
                      setTargetStudentName(st?.studentName || "");
                    }}
                    className={cn(inputClass, "w-full text-xs")}
                    required
                  >
                    {q.data?.students.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.studentName} ({st.rollNo} · {st.department}) - {st.riskLevel}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Support Strategy */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">Support Strategy</label>
                <select
                  value={actionStrategy}
                  onChange={(e) => setActionStrategy(e.target.value)}
                  className={cn(inputClass, "w-full text-xs")}
                >
                  <option value="1-on-1 Faculty Mentorship">1-on-1 Faculty Mentorship</option>
                  <option value="Remedial Course & Lab Sessions">Remedial Course & Lab Sessions</option>
                  <option value="Enroll in Skill Booster & Certification Clinic">Enroll in Skill Booster & Certification Clinic</option>
                  <option value="Placement Cell Mock Interview Practice">Placement Cell Mock Interview Practice</option>
                  <option value="Resume Studio Polish & Career Counsellor Check-in">Resume Studio Polish & Career Counsellor Check-in</option>
                  <option value="Academic Counsellor Advisory Session">Academic Counsellor Advisory Session</option>
                </select>
              </div>

              {/* Faculty Lead */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">Assigned Faculty / Advisor Lead</label>
                <select
                  value={actionFacultyLead}
                  onChange={(e) => setActionFacultyLead(e.target.value)}
                  className={cn(inputClass, "w-full text-xs")}
                  required
                >
                  {availableFaculty.length > 0 ? (
                    availableFaculty.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))
                  ) : (
                    <option value="Department Mentor">Department Mentor</option>
                  )}
                </select>
              </div>

              {/* Target Date */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">Target Review / Follow-up Date</label>
                <input
                  type="date"
                  value={actionTargetDate}
                  onChange={(e) => setActionTargetDate(e.target.value)}
                  className={cn(inputClass, "w-full text-xs")}
                  required
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">Case Notes & Specific Instructions</label>
                <textarea
                  rows={3}
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Record specific topics, weakness patterns, or next meeting agenda..."
                  className={cn(inputClass, "w-full text-xs py-2")}
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-edge">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowActionModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={createActionMut.isPending}
                  className="gap-1.5"
                >
                  {createActionMut.isPending ? <Spinner className="size-3.5" /> : <Fi name="check" className="size-3.5" />}
                  Confirm Support Plan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Student Detailed Signals Inspection */}
      {inspectStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-xl rounded-2xl border border-edge bg-surface shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-edge px-5 py-4 bg-surface-1">
              <div>
                <h3 className="text-base font-semibold text-ink">{inspectStudent.studentName}</h3>
                <p className="text-xs text-ink-3">
                  {inspectStudent.rollNo} · {inspectStudent.department} · {inspectStudent.batch}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectStudent(null)}
                className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors"
              >
                <Fi name="cross" className="size-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Summary Scorecard */}
              <div className="grid grid-cols-5 gap-2 rounded-xl bg-surface-2/60 p-3 text-center text-xs">
                <div>
                  <span className="text-[10px] text-ink-3 block">Quiz Avg</span>
                  <span className={cn("font-bold text-sm", inspectStudent.quizAverage < 50 ? "text-rose" : "text-ink")}>
                    {inspectStudent.quizAverage}%
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-ink-3 block">Certs</span>
                  <span className={cn("font-bold text-sm", inspectStudent.certificatesCount === 0 ? "text-amber" : "text-ink")}>
                    {inspectStudent.certificatesCount}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-ink-3 block">Interview</span>
                  <span className={cn("font-bold text-sm", inspectStudent.interviewScore < 50 ? "text-amber" : "text-ink")}>
                    {inspectStudent.interviewScore}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-ink-3 block">Resume ATS</span>
                  <span className={cn("font-bold text-sm", inspectStudent.resumeScore < 50 ? "text-amber" : "text-ink")}>
                    {inspectStudent.resumeScore}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-ink-3 block">Readiness</span>
                  <span className="font-bold text-sm text-brand">{inspectStudent.overallScore}/100</span>
                </div>
              </div>

              {/* Signals breakdown */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-2 mb-2">
                  Observed Deficit Signals ({inspectStudent.signals.length})
                </h4>
                <div className="space-y-2">
                  {inspectStudent.signals.length === 0 ? (
                    <div className="rounded-lg border border-teal/20 bg-teal-soft/40 p-3 text-xs text-teal">
                      No active negative signals detected for this student.
                    </div>
                  ) : (
                    inspectStudent.signals.map((sig) => (
                      <div
                        key={sig.id}
                        className={cn(
                          "rounded-xl border p-3 text-xs space-y-1",
                          sig.severity === "critical"
                            ? "border-rose/30 bg-rose-soft/40"
                            : sig.severity === "moderate"
                            ? "border-amber/30 bg-amber-soft/40"
                            : "border-edge bg-surface-1"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-ink">{sig.title}</span>
                          <Badge tone={sig.severity === "critical" ? "rose" : sig.severity === "moderate" ? "amber" : "sky"}>
                            {sig.severity}
                          </Badge>
                        </div>
                        <p className="text-ink-2 leading-relaxed">{sig.detail}</p>
                        <div className="text-[10px] text-ink-3">Source: {sig.detectedAt}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Recommendation */}
              <div className="rounded-xl border border-brand/20 bg-brand-soft/40 p-3.5 text-xs space-y-1">
                <span className="font-semibold text-brand">Algorithmic Recommendation:</span>
                <p className="text-ink-2">{inspectStudent.recommendation}</p>
              </div>

              {/* Case notes if any */}
              {inspectStudent.actionNotes && (
                <div className="rounded-xl border border-edge bg-surface-1 p-3 text-xs space-y-1">
                  <span className="font-semibold text-ink">Last Advisor Action Notes:</span>
                  <p className="text-ink-2">{inspectStudent.actionNotes}</p>
                  {inspectStudent.lastActionDate && (
                    <div className="text-[10px] text-ink-3">Recorded on: {inspectStudent.lastActionDate}</div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 border-t border-edge px-5 py-3 bg-surface-1">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setInspectStudent(null)}
              >
                Close
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  const target = inspectStudent;
                  setInspectStudent(null);
                  handleOpenActionModal(target);
                }}
                className="gap-1.5"
              >
                <Fi name="plus" className="size-3.5" />
                Schedule Support Plan
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
