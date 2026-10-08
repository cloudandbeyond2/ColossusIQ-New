"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Users,
  BookOpen,
  CheckCircle2,
  Sparkles,
  Calendar,
  Clock,
  Search,
  Filter,
  Download,
  Plus,
  RefreshCw,
  Send,
  GraduationCap,
  ChevronRight,
  HelpCircle,
  FileText,
  Copy,
  Printer,
  X,
  Target,
  ArrowUpRight,
  ShieldAlert,
  Award,
} from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import type { Role } from "@/lib/auth/roles";
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Progress,
  Spinner,
  inputClass,
} from "@/components/ui/primitives";
import { ChartCard } from "@/components/charts/chart-card";
import { TemplateSkeleton } from "@/components/modules/shared";
import { cn } from "@/lib/utils";
import { toCsv } from "@/lib/csv";
import type {
  ClassAnalyticsResponse,
  TopicMasteryDetail,
  StudentDiagnosticItem,
  RemedialInterventionRecord,
  AiRemedialRecommendation,
  AiRemedialWorksheetResult,
} from "@/lib/api/mock/class-analytics-engine";

/* ── Tab Keys ────────────────────────────────────────────────────────────── */
type TabKey = "overview" | "topics" | "students" | "interventions" | "ai-remedial";

export function ClassAnalyticsModule({ role: _role }: { role?: Role }) {
  const qc = useQueryClient();

  // Navigation & Filtering
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [assessmentFilter, setAssessmentFilter] = useState<string>("all");
  const [studentSearch, setStudentSearch] = useState<string>("");
  const [riskFilter, setRiskFilter] = useState<string>("all");

  // Modals state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isInspectStudentOpen, setIsInspectStudentOpen] = useState(false);
  const [inspectedStudent, setInspectedStudent] = useState<StudentDiagnosticItem | null>(null);
  const [isAiWorksheetModalOpen, setIsAiWorksheetModalOpen] = useState(false);
  const [activeWorksheet, setActiveWorksheet] = useState<AiRemedialWorksheetResult | null>(null);
  const [isGeneratingWorksheet, setIsGeneratingWorksheet] = useState(false);
  const [copiedWorksheet, setCopiedWorksheet] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // Form state for scheduling remedial session
  const [schedTopic, setSchedTopic] = useState("");
  const [schedStrategy, setSchedStrategy] = useState<RemedialInterventionRecord["strategy"]>("Remedial Lecture");
  const [schedDate, setSchedDate] = useState(() => new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10));
  const [schedTime, setSchedTime] = useState("16:00 - 17:00");
  const [schedVenue, setSchedVenue] = useState("LH-204 / Seminar Hall");
  const [schedNotes, setSchedNotes] = useState("");
  const [schedStudentNames, setSchedStudentNames] = useState<string[]>([]);

  const showToast = (text: string, ok = true) => {
    setToastMessage({ text, ok });
    setTimeout(() => setToastMessage(null), 4500);
  };

  /* ── 1. Fetch Class Analytics Data ────────────────────────────────────── */
  const { data, isLoading, isError, refetch, isFetching } = useQuery<ClassAnalyticsResponse>({
    queryKey: ["faculty-class-analytics", selectedSectionId],
    queryFn: () => {
      const url = selectedSectionId
        ? `/api/v1/faculty/analytics?sectionId=${encodeURIComponent(selectedSectionId)}`
        : "/api/v1/faculty/analytics";
      return apiFetch(url, z.any());
    },
  });

  // Keep selectedSectionId in sync once initial data arrives
  const currentSection = useMemo(() => {
    if (!data) return null;
    return data.selectedSection;
  }, [data]);

  /* ── 2. Mutations ──────────────────────────────────────────────────────── */
  // Create Remedial Intervention
  const createInterventionMutation = useMutation({
    mutationFn: (body: any) =>
      apiFetch("/api/v1/faculty/remedial/interventions", z.any(), {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      showToast("Remedial intervention scheduled successfully!");
      setIsScheduleModalOpen(false);
      void qc.invalidateQueries({ queryKey: ["faculty-class-analytics"] });
    },
    onError: (err: any) => {
      showToast(err?.message || "Failed to schedule intervention", false);
    },
  });

  // Update Intervention Status
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: RemedialInterventionRecord["status"] }) =>
      apiFetch(`/api/v1/faculty/remedial/interventions/${id}`, z.any(), {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      showToast("Intervention status updated!");
      void qc.invalidateQueries({ queryKey: ["faculty-class-analytics"] });
    },
    onError: (err: any) => {
      showToast(err?.message || "Failed to update status", false);
    },
  });

  // Generate AI Remedial Plan
  const generatePlanMutation = useMutation({
    mutationFn: (payload: { topic: string; unit: string }) =>
      apiFetch("/api/v1/faculty/remedial/generate-plan", z.any(), {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (res: any) => {
      if (res?.worksheet) {
        setActiveWorksheet(res.worksheet);
        setIsAiWorksheetModalOpen(true);
      }
      setIsGeneratingWorksheet(false);
    },
    onError: (err: any) => {
      setIsGeneratingWorksheet(false);
      showToast(err?.message || "Failed to generate AI remedial plan", false);
    },
  });

  /* ── Filtered Students Roster ─────────────────────────────────────────── */
  const filteredStudents = useMemo(() => {
    if (!data?.students) return [];
    let list = data.students;

    // Search query
    if (studentSearch.trim()) {
      const q = studentSearch.toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(q) || s.rollNo.toLowerCase().includes(q));
    }

    // Risk signal filter
    if (riskFilter === "at-risk") {
      list = list.filter((s) => s.riskLevel === "High" || s.riskSignal === "Attendance Warning");
    } else if (riskFilter === "low-mastery") {
      list = list.filter((s) => s.riskSignal === "Low Mastery");
    } else if (riskFilter === "attendance-warning") {
      list = list.filter((s) => s.riskSignal === "Attendance Warning");
    } else if (riskFilter === "top-performer") {
      list = list.filter((s) => s.riskSignal === "Top Performer");
    }

    return list;
  }, [data?.students, studentSearch, riskFilter]);

  /* ── Chart Specs ──────────────────────────────────────────────────────── */
  const topicMasteryChartSpec = useMemo(() => {
    if (!data?.topics) return null;
    return {
      type: "bar" as const,
      title: "Class Topic Mastery vs Benchmark (75%)",
      xKey: "name",
      series: ["Mastery", "Target"],
      data: data.topics.map((t) => ({
        name: t.unit,
        Mastery: t.classMastery,
        Target: t.benchmark,
      })),
    };
  }, [data?.topics]);

  const assessmentTrendChartSpec = useMemo(() => {
    if (!data?.assessmentTrends) return null;
    return {
      type: "line" as const,
      title: "Assessment Performance Trend",
      xKey: "name",
      series: ["Average", "PassRate"],
      data: data.assessmentTrends.map((a) => ({
        name: a.assessment.replace("Examination", "Exam").replace("Continuous ", ""),
        Average: a.averageScore,
        PassRate: a.passPercentage,
      })),
    };
  }, [data?.assessmentTrends]);

  const scoreDistributionChartSpec = useMemo(() => {
    if (!data?.scoreDistribution) return null;
    return {
      type: "bar" as const,
      title: "Class Score Distribution Curve",
      xKey: "name",
      series: ["Students"],
      data: data.scoreDistribution.map((b) => ({
        name: b.range,
        Students: b.count,
      })),
    };
  }, [data?.scoreDistribution]);

  /* ── Export Handlers ──────────────────────────────────────────────────── */
  const handleExportPerformanceCsv = () => {
    if (!data) return;
    const header = ["Section", "Course Code", "Course Title", "Student Name", "Roll No", "Average Score", "Attendance %", "Risk Signal", "Weak Topics", "Remedial Status"];
    const rows = data.students.map((s) => [
      data.selectedSection.section,
      data.selectedSection.courseCode,
      data.selectedSection.courseTitle,
      s.name,
      s.rollNo,
      s.averageScore,
      s.attendancePercent,
      s.riskSignal,
      s.weakTopics.join("; "),
      s.remedialStatus,
    ]);
    const csvStr = toCsv([header, ...rows]);
    const blob = new Blob([csvStr], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Class_Performance_${data.selectedSection.courseCode}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Class performance data exported successfully!");
  };

  const handleTriggerAiPlan = (topic: TopicMasteryDetail) => {
    setIsGeneratingWorksheet(true);
    generatePlanMutation.mutate({
      topic: topic.title,
      unit: topic.unit,
    });
  };

  const handleOpenScheduleForTopic = (topic: TopicMasteryDetail) => {
    setSchedTopic(`${topic.unit}: ${topic.title}`);
    // Prepopulate struggling students
    const struggling = (data?.students || [])
      .filter((s) => s.weakTopics.includes(topic.unit) || s.averageScore < 60)
      .map((s) => s.name);
    setSchedStudentNames(struggling);
    setIsScheduleModalOpen(true);
  };

  const handleOpenScheduleForStudent = (student: StudentDiagnosticItem) => {
    setSchedTopic(student.weakTopics[0] ? `Remedial Mentoring: ${student.weakTopics[0]}` : "Academic Concept Mentoring");
    setSchedStrategy("1-on-1 Mentoring");
    setSchedStudentNames([student.name]);
    setIsScheduleModalOpen(true);
  };

  const handleSubmitSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !schedTopic.trim()) return;

    createInterventionMutation.mutate({
      sectionId: data.selectedSection.id,
      sectionName: data.selectedSection.section,
      courseCode: data.selectedSection.courseCode,
      topic: schedTopic,
      strategy: schedStrategy,
      date: schedDate,
      timeSlot: schedTime,
      venue: schedVenue,
      targetStudentCount: schedStudentNames.length || 1,
      targetStudentNames: schedStudentNames,
      facultyNotes: schedNotes,
    });
  };

  const handleCopyWorksheet = () => {
    if (!activeWorksheet) return;
    const text = `TOPIC: ${activeWorksheet.topic} (${activeWorksheet.unit})\n\nOVERVIEW:\n${activeWorksheet.overview}\n\nCORE CONCEPTS:\n${activeWorksheet.coreConcepts.map((c) => `- ${c.concept}: ${c.explanation}`).join("\n")}\n\nCOMMON PITFALLS:\n${activeWorksheet.commonPitfalls.map((p) => `- Pitfall: ${p.misconception}\n  Correction: ${p.correction}`).join("\n")}\n\nWORKED EXAMPLE:\nProblem: ${activeWorksheet.workedExample.problemStatement}\n${activeWorksheet.workedExample.stepByStepSolution.join("\n")}\n\nPRACTICE QUESTIONS:\n${activeWorksheet.practiceQuestions.map((q) => `${q.id}. [${q.difficulty}] ${q.question}\nAnswer: ${q.correctAnswer}`).join("\n\n")}`;
    navigator.clipboard.writeText(text);
    setCopiedWorksheet(true);
    setTimeout(() => setCopiedWorksheet(false), 3000);
  };

  if (isLoading) {
    return <TemplateSkeleton />;
  }

  if (isError || !data) {
    return (
      <EmptyState
        title="Failed to load class analytics"
        body="There was an error connecting to faculty allocation records. Please retry."
        action={<Button onClick={() => void refetch()}>Try again</Button>}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast banner */}
      {toastMessage && (
        <div
          className={cn(
            "fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all",
            toastMessage.ok ? "bg-teal-700 text-white" : "bg-rose-700 text-white"
          )}
        >
          {toastMessage.ok ? <CheckCircle2 className="size-5 shrink-0" /> : <AlertTriangle className="size-5 shrink-0" />}
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 opacity-80 hover:opacity-100">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Top Banner: Dynamic Section Switcher & Quick Controls */}
      <Card className="border border-line bg-surface shadow-xs">
        <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-md bg-brand/10 text-brand">
                <BarChart3 className="size-4" />
              </span>
              <h1 className="text-xl font-bold tracking-tight text-ink">Class Performance Diagnostics</h1>
              <Badge tone="brand">Live</Badge>
            </div>
            <p className="text-xs text-ink-3">
              {data.profile.facultyName} · {data.profile.designation} · {data.profile.department}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Section Switcher Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-ink-2">Class:</span>
              <select
                value={selectedSectionId || data.selectedSection.id}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                className={cn(inputClass, "w-auto text-xs font-medium")}
              >
                {data.sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    [{sec.courseCode}] {sec.shortName} · {sec.section} ({sec.studentsCount} students)
                  </option>
                ))}
              </select>
            </div>

            {/* Assessment Range Filter */}
            <div className="flex items-center gap-1.5">
              <select
                value={assessmentFilter}
                onChange={(e) => setAssessmentFilter(e.target.value)}
                className={cn(inputClass, "w-auto text-xs font-medium")}
              >
                <option value="all">All Term Assessments</option>
                <option value="midterm">Midterm Examination</option>
                <option value="ut2">Unit Test 2</option>
                <option value="cia">Continuous Internal (CIA)</option>
              </select>
            </div>

            {/* Export CSV */}
            <Button variant="secondary" size="sm" onClick={handleExportPerformanceCsv} className="gap-1.5 text-xs">
              <Download className="size-3.5" />
              <span>Export CSV</span>
            </Button>

            {/* Schedule Remedial Session */}
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setSchedTopic(data.topics[0] ? `${data.topics[0].unit}: ${data.topics[0].title}` : "Remedial Topic");
                setSchedStudentNames([]);
                setIsScheduleModalOpen(true);
              }}
              className="gap-1.5 text-xs"
            >
              <Plus className="size-3.5" />
              <span>Schedule Remedial</span>
            </Button>

            {/* Refresh */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void refetch()}
              title="Refresh Analytics"
              disabled={isFetching}
            >
              <RefreshCw className={cn("size-3.5", isFetching && "animate-spin text-brand")} />
            </Button>
          </div>
        </div>
      </Card>

      {/* Top Level Dynamic KPI Cards */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
        {/* Class Average */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-3">Class Average</span>
            <span className="rounded-md bg-teal/10 p-1 text-teal">
              <TrendingUp className="size-3.5" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-ink">{data.kpis.classAverage}%</div>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-teal">
            <ArrowUpRight className="size-3" />
            <span>{data.kpis.averageDelta}</span>
          </div>
        </Card>

        {/* At-Risk Students */}
        <Card
          className="cursor-pointer p-4 transition-colors hover:border-rose/50"
          onClick={() => {
            setActiveTab("students");
            setRiskFilter("at-risk");
          }}
          title="Click to view at-risk students"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-3">At-Risk Students</span>
            <span className="rounded-md bg-rose/10 p-1 text-rose">
              <AlertTriangle className="size-3.5" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-rose">{data.kpis.atRiskCount}</div>
          <div className="mt-1 text-[11px] text-ink-3">
            <span>Score &lt; 50% or Att. &lt; 75%</span>
          </div>
        </Card>

        {/* Topic Mastery Rate */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-3">Topic Mastery</span>
            <span className="rounded-md bg-brand/10 p-1 text-brand">
              <Target className="size-3.5" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-ink">{data.kpis.topicMasteryRate}%</div>
          <div className="mt-1 text-[11px] text-ink-3">
            <span>Target: 75% benchmark</span>
          </div>
        </Card>

        {/* Attendance Rate */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-3">Avg Attendance</span>
            <span className="rounded-md bg-sky/10 p-1 text-sky">
              <Users className="size-3.5" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-ink">{data.kpis.attendanceRate}%</div>
          <div className="mt-1 text-[11px] text-ink-3">
            <span>Room {data.selectedSection.room}</span>
          </div>
        </Card>

        {/* High Performers */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-3">Distinction Tier</span>
            <span className="rounded-md bg-amber/10 p-1 text-amber">
              <Award className="size-3.5" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-ink">{data.kpis.highPerformersCount}</div>
          <div className="mt-1 text-[11px] text-ink-3">
            <span>Score &gt;= 85% &amp; Att. &gt; 90%</span>
          </div>
        </Card>

        {/* Active Remedial Interventions */}
        <Card
          className="cursor-pointer p-4 transition-colors hover:border-brand/50"
          onClick={() => setActiveTab("interventions")}
          title="Click to view interventions"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-3">Active Remedials</span>
            <span className="rounded-md bg-brand/10 p-1 text-brand">
              <Clock className="size-3.5" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-brand">
            {data.kpis.activeInterventionsCount}
          </div>
          <div className="mt-1 text-[11px] text-ink-3">
            <span>Underway &amp; scheduled</span>
          </div>
        </Card>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-line">
        <button
          onClick={() => setActiveTab("overview")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors",
            activeTab === "overview"
              ? "border-brand text-brand"
              : "border-transparent text-ink-3 hover:text-ink"
          )}
        >
          <BarChart3 className="size-4" />
          <span>Overview &amp; Visualizations</span>
        </button>

        <button
          onClick={() => setActiveTab("topics")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors",
            activeTab === "topics"
              ? "border-brand text-brand"
              : "border-transparent text-ink-3 hover:text-ink"
          )}
        >
          <BookOpen className="size-4" />
          <span>Topic-Wise Mastery ({data.topics.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("students")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors",
            activeTab === "students"
              ? "border-brand text-brand"
              : "border-transparent text-ink-3 hover:text-ink"
          )}
        >
          <Users className="size-4" />
          <span>Student Diagnostics ({data.students.length})</span>
          {data.kpis.atRiskCount > 0 && (
            <Badge tone="rose" className="ml-1 text-[10px] py-0 px-1.5">
              {data.kpis.atRiskCount} at-risk
            </Badge>
          )}
        </button>

        <button
          onClick={() => setActiveTab("interventions")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors",
            activeTab === "interventions"
              ? "border-brand text-brand"
              : "border-transparent text-ink-3 hover:text-ink"
          )}
        >
          <Calendar className="size-4" />
          <span>Remedial Tracker ({data.interventions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("ai-remedial")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors",
            activeTab === "ai-remedial"
              ? "border-brand text-brand"
              : "border-transparent text-ink-3 hover:text-ink"
          )}
        >
          <Sparkles className="size-4 text-brand" />
          <span>AI Recommendations ({data.aiRecommendations.length})</span>
        </button>
      </div>

      {/* ────────────────── TAB 1: OVERVIEW & CHARTS ────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* AI Diagnostic Highlights Banner */}
          <Card className="border-l-4 border-l-brand bg-surface p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <Sparkles className="size-4" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-ink">
                    AI Diagnostic Summary for {data.selectedSection.section} ({data.selectedSection.courseCode})
                  </h3>
                  <p className="mt-1 text-xs text-ink-2">
                    Class demonstrates strong conceptual foundation in{" "}
                    <span className="font-semibold text-teal">
                      {data.topics[0]?.title || "Fundamentals"} (
                      {data.topics[0]?.classMastery || 82}% mastery)
                    </span>
                    . However, a significant gap of{" "}
                    <span className="font-semibold text-rose">
                      {75 - (data.topics.find((t) => t.classMastery < 50)?.classMastery || 46)}% below benchmark
                    </span>{" "}
                    is observed in{" "}
                    <span className="font-semibold text-ink">
                      {data.topics.find((t) => t.classMastery < 50)?.title || "Advanced Units"}
                    </span>
                    . Immediate remedial intervention is recommended before the final exam.
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setActiveTab("ai-remedial")}
                className="shrink-0 gap-1.5 text-xs font-medium"
              >
                <span>View AI Recommendations</span>
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </Card>

          {/* Dynamic Charts Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {topicMasteryChartSpec && <ChartCard spec={topicMasteryChartSpec} />}
            {assessmentTrendChartSpec && <ChartCard spec={assessmentTrendChartSpec} />}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {scoreDistributionChartSpec && <ChartCard spec={scoreDistributionChartSpec} />}

            {/* Quick Diagnostic Insights Card */}
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-ink">Score Distribution &amp; Cohort Health</h3>
              <p className="mt-1 text-xs text-ink-3">
                Breakdown of {data.students.length} enrolled students across mastery thresholds:
              </p>

              <div className="mt-4 space-y-3">
                {data.scoreDistribution.map((bucket) => (
                  <div key={bucket.range} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "size-2.5 rounded-full",
                            bucket.tone === "rose" && "bg-rose",
                            bucket.tone === "amber" && "bg-amber",
                            bucket.tone === "brand" && "bg-brand",
                            bucket.tone === "teal" && "bg-teal"
                          )}
                        />
                        <span className="font-medium text-ink">{bucket.label}</span>
                        <span className="text-ink-3">({bucket.range})</span>
                      </div>
                      <span className="font-semibold text-ink">
                        {bucket.count} students ({bucket.percentage}%)
                      </span>
                    </div>
                    <Progress value={bucket.percentage} tone={bucket.tone} />
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-lg bg-surface-2 p-3 text-xs text-ink-2">
                <span className="font-semibold text-ink">Pedagogical Recommendation:</span> Pair the{" "}
                <span className="font-medium text-teal">{data.kpis.highPerformersCount} distinction students</span>{" "}
                with the{" "}
                <span className="font-medium text-rose">{data.kpis.atRiskCount} at-risk learners</span> for peer
                problem-solving sessions.
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ────────────────── TAB 2: TOPIC-WISE MASTERY ────────────────── */}
      {activeTab === "topics" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-ink">
                Syllabus Unit Mastery &amp; Bottleneck Identification
              </h2>
              <p className="text-xs text-ink-3">
                Evaluated from continuous assessments, quizzes, and homework problem sets.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {data.topics.map((topic) => {
              const tone = topic.classMastery < 50 ? "rose" : topic.classMastery < 70 ? "amber" : "teal";
              return (
                <Card key={topic.id} className="overflow-hidden border border-line">
                  <div className="p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-ink-3">
                            {topic.unit}
                          </span>
                          <span className="text-ink-3">·</span>
                          <h3 className="text-sm font-semibold text-ink">{topic.title}</h3>
                          <Badge tone={tone}>{topic.status}</Badge>
                        </div>
                        <p className="text-xs text-ink-2">
                          Tested across {topic.testedQuestionsCount} questions · Avg errors per student:{" "}
                          <span className="font-medium text-ink">{topic.avgMistakes}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-xl font-bold text-ink">{topic.classMastery}%</div>
                          <div className="text-[10px] text-ink-3">Benchmark: 75%</div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleTriggerAiPlan(topic)}
                            className="gap-1 text-xs"
                            disabled={isGeneratingWorksheet}
                          >
                            <Sparkles className="size-3.5 text-brand" />
                            <span>AI Remedial Plan</span>
                          </Button>

                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleOpenScheduleForTopic(topic)}
                            className="gap-1 text-xs"
                          >
                            <Plus className="size-3.5" />
                            <span>Schedule Class</span>
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Mastery Progress Bar */}
                    <div className="mt-3">
                      <Progress value={topic.classMastery} tone={tone} />
                    </div>

                    {/* Identified Misconceptions & Strategy */}
                    <div className="mt-4 grid gap-3 rounded-lg bg-surface-2 p-3 text-xs sm:grid-cols-2">
                      <div>
                        <span className="font-semibold text-rose">Identified Misconceptions:</span>
                        <ul className="mt-1 list-disc space-y-1 pl-4 text-ink-2">
                          {topic.keyMisconceptions.map((m, i) => (
                            <li key={i}>{m}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <span className="font-semibold text-brand">Recommended Remedial Strategy:</span>
                        <p className="mt-1 text-ink-2">{topic.recommendedStrategy}</p>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ────────────────── TAB 3: STUDENT DIAGNOSTICS & AT-RISK ROSTER ────────────────── */}
      {activeTab === "students" && (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <Card className="p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
                <input
                  type="text"
                  placeholder="Search student by name or roll number..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className={cn(inputClass, "pl-9 text-xs")}
                />
              </div>

              {/* Risk Filter Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-ink-3">Filter:</span>
                {[
                  { key: "all", label: `All (${data.students.length})` },
                  { key: "at-risk", label: `At-Risk (${data.kpis.atRiskCount})` },
                  { key: "low-mastery", label: "Low Mastery (<50%)" },
                  { key: "attendance-warning", label: "Attendance (<75%)" },
                  { key: "top-performer", label: `Distinction (${data.kpis.highPerformersCount})` },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setRiskFilter(f.key)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      riskFilter === f.key
                        ? "bg-brand text-white"
                        : "bg-surface-2 text-ink-2 hover:bg-line"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* Student Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-line bg-surface-2 text-[11px] font-semibold text-ink-3">
                  <tr>
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-3 py-3">Roll No</th>
                    <th className="px-3 py-3">Score Avg</th>
                    <th className="px-3 py-3">Attendance</th>
                    <th className="px-3 py-3">Risk Signal</th>
                    <th className="px-3 py-3">Weak Topic(s)</th>
                    <th className="px-3 py-3">Remedial Action</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-xs text-ink-3">
                        No students matching the current filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((s) => {
                      const isLowScore = s.averageScore < 50;
                      const isLowAtt = s.attendancePercent < 75;
                      const scoreTone = isLowScore ? "rose" : s.averageScore < 70 ? "amber" : "teal";
                      const attTone = isLowAtt ? "rose" : s.attendancePercent < 85 ? "amber" : "teal";

                      return (
                        <tr key={s.id} className="transition-colors hover:bg-surface-2/60">
                          <td className="px-4 py-3 font-medium text-ink">
                            <div>{s.name}</div>
                            {s.email && <div className="text-[10px] text-ink-3">{s.email}</div>}
                          </td>
                          <td className="px-3 py-3 font-mono text-ink-2">{s.rollNo}</td>
                          <td className="px-3 py-3 font-semibold">
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5",
                                scoreTone === "rose" && "bg-rose/10 text-rose",
                                scoreTone === "amber" && "bg-amber/10 text-amber",
                                scoreTone === "teal" && "bg-teal/10 text-teal"
                              )}
                            >
                              {s.averageScore}%
                            </span>
                          </td>
                          <td className="px-3 py-3 font-semibold">
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5",
                                attTone === "rose" && "bg-rose/10 text-rose",
                                attTone === "amber" && "bg-amber/10 text-amber",
                                attTone === "teal" && "bg-teal/10 text-teal"
                              )}
                            >
                              {s.attendancePercent}%
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <Badge
                              tone={
                                s.riskSignal === "Low Mastery"
                                  ? "rose"
                                  : s.riskSignal === "Attendance Warning"
                                  ? "amber"
                                  : s.riskSignal === "Top Performer"
                                  ? "teal"
                                  : "brand"
                              }
                            >
                              {s.riskSignal}
                            </Badge>
                          </td>
                          <td className="px-3 py-3 text-ink-2">
                            {s.weakTopics.join(", ")}
                          </td>
                          <td className="px-3 py-3">
                            <Badge
                              tone={
                                s.remedialStatus === "Session Scheduled"
                                  ? "brand"
                                  : s.remedialStatus === "Resolved"
                                  ? "teal"
                                  : "rose"
                              }
                            >
                              {s.remedialStatus}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setInspectedStudent(s);
                                  setIsInspectStudentOpen(true);
                                }}
                                title="Inspect Student Diagnostic"
                                className="h-7 px-2 text-xs"
                              >
                                View Profile
                              </Button>

                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleOpenScheduleForStudent(s)}
                                className="h-7 px-2 text-xs"
                              >
                                Schedule 1-on-1
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ────────────────── TAB 4: REMEDIAL TRACKER & INTERVENTIONS ────────────────── */}
      {activeTab === "interventions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-ink">Remedial Action Plans &amp; Interventions</h2>
              <p className="text-xs text-ink-3">
                Track scheduled booster sessions, 1-on-1 tutorials, and peer mentoring groups.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setSchedTopic(data.topics[0] ? `${data.topics[0].unit}: ${data.topics[0].title}` : "");
                setSchedStudentNames([]);
                setIsScheduleModalOpen(true);
              }}
              className="gap-1.5 text-xs"
            >
              <Plus className="size-3.5" />
              <span>Schedule New Remedial</span>
            </Button>
          </div>

          <div className="space-y-3">
            {data.interventions.length === 0 ? (
              <EmptyState
                title="No active remedial interventions"
                body="You haven't scheduled any remedial interventions for this section yet. Click Schedule New Remedial above to start."
                action={
                  <Button
                    onClick={() => {
                      setSchedTopic(data.topics[0]?.title || "");
                      setIsScheduleModalOpen(true);
                    }}
                  >
                    Schedule Remedial
                  </Button>
                }
              />
            ) : (
              data.interventions.map((int) => (
                <Card key={int.id} className="p-4 border border-line">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          tone={
                            int.status === "Completed"
                              ? "teal"
                              : int.status === "In Progress"
                              ? "amber"
                              : "brand"
                          }
                        >
                          {int.status}
                        </Badge>
                        <span className="text-xs font-semibold text-ink">{int.topic}</span>
                        <span className="text-xs text-ink-3">·</span>
                        <span className="text-xs font-medium text-ink-2">{int.strategy}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-ink-3">
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3 text-ink-3" />
                          <span>{int.date}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="size-3 text-ink-3" />
                          <span>{int.timeSlot}</span>
                        </span>
                        <span>Venue: {int.venue}</span>
                        <span>Target: {int.targetStudentCount} students</span>
                      </div>
                      {int.facultyNotes && (
                        <p className="text-xs text-ink-2 mt-1 italic">
                          Notes: {int.facultyNotes}
                        </p>
                      )}
                      {int.targetStudentNames && int.targetStudentNames.length > 0 && (
                        <div className="text-[11px] text-ink-3">
                          Enrolled: {int.targetStudentNames.join(", ")}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {int.status !== "Completed" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => updateStatusMutation.mutate({ id: int.id, status: "Completed" })}
                          disabled={updateStatusMutation.isPending}
                          className="h-8 gap-1 text-xs text-teal hover:text-teal"
                        >
                          <CheckCircle2 className="size-3.5" />
                          <span>Mark Completed</span>
                        </Button>
                      )}
                      {int.status === "Scheduled" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateStatusMutation.mutate({ id: int.id, status: "In Progress" })}
                          disabled={updateStatusMutation.isPending}
                          className="h-8 text-xs text-amber"
                        >
                          Start Now
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* ────────────────── TAB 5: AI RECOMMENDATIONS & WORKSHEETS ────────────────── */}
      {activeTab === "ai-remedial" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-ink">AI Remedial Interventions &amp; Pedagogical Strategies</h2>
              <p className="text-xs text-ink-3">
                Actionable recommendations synthesized from student misconception patterns and test failures.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {data.aiRecommendations.map((rec) => (
              <Card key={rec.id} className="p-5 border border-line">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-md bg-brand/10 text-brand">
                      <Sparkles className="size-3.5" />
                    </span>
                    <h3 className="text-sm font-semibold text-ink">{rec.topicTitle}</h3>
                  </div>
                  <Badge tone={rec.priority === "High" ? "rose" : "amber"}>
                    {rec.priority} Priority
                  </Badge>
                </div>

                <div className="mt-3 space-y-2 text-xs">
                  <div>
                    <span className="font-semibold text-ink">Target Cohort:</span>{" "}
                    <span className="text-ink-2">{rec.targetCohort}</span>
                  </div>

                  <div>
                    <span className="font-semibold text-rose">Observed Bottleneck:</span>{" "}
                    <span className="text-ink-2">{rec.reason}</span>
                  </div>

                  <div className="rounded-lg bg-surface-2 p-3">
                    <span className="font-semibold text-brand">Suggested Pedagogical Action:</span>
                    <p className="mt-1 text-ink-2">{rec.suggestedAction}</p>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <span className="font-medium text-teal">{rec.estimatedGain}</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setIsGeneratingWorksheet(true);
                          generatePlanMutation.mutate({
                            topic: rec.topicTitle,
                            unit: rec.unit,
                          });
                        }}
                        disabled={isGeneratingWorksheet}
                        className="h-7 gap-1 text-xs"
                      >
                        <FileText className="size-3 text-brand" />
                        <span>Generate Worksheet</span>
                      </Button>

                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setSchedTopic(`${rec.unit}: ${rec.topicTitle}`);
                          setSchedNotes(rec.suggestedAction);
                          setIsScheduleModalOpen(true);
                        }}
                        className="h-7 gap-1 text-xs"
                      >
                        <Plus className="size-3" />
                        <span>Adopt Action</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ────────────────── MODAL: SCHEDULE REMEDIAL SESSION ────────────────── */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="size-4 text-brand" />
                <h3 className="text-base font-semibold text-ink">Schedule Remedial Intervention</h3>
              </div>
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                className="rounded-md p-1 text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitSchedule} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-ink">Target Course &amp; Section</label>
                <input
                  type="text"
                  disabled
                  value={`${data.selectedSection.courseCode} · ${data.selectedSection.section}`}
                  className={cn(inputClass, "mt-1 bg-surface-2 text-ink-3")}
                />
              </div>

              <div>
                <label className="font-semibold text-ink">Remedial Topic / Concept *</label>
                <input
                  type="text"
                  required
                  value={schedTopic}
                  onChange={(e) => setSchedTopic(e.target.value)}
                  placeholder="e.g. Unit 3: Normalization & BCNF Decomposition"
                  className={cn(inputClass, "mt-1")}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-ink">Pedagogical Strategy *</label>
                  <select
                    value={schedStrategy}
                    onChange={(e) => setSchedStrategy(e.target.value as any)}
                    className={cn(inputClass, "mt-1")}
                  >
                    <option value="Remedial Lecture">Remedial Lecture</option>
                    <option value="1-on-1 Mentoring">1-on-1 Mentoring</option>
                    <option value="Peer Tutoring Group">Peer Tutoring Group</option>
                    <option value="Targeted Practice Worksheet">Targeted Practice Worksheet</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-ink">Session Date *</label>
                  <input
                    type="date"
                    required
                    value={schedDate}
                    onChange={(e) => setSchedDate(e.target.value)}
                    className={cn(inputClass, "mt-1")}
                  >
                  </input>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-ink">Time Slot *</label>
                  <input
                    type="text"
                    required
                    value={schedTime}
                    onChange={(e) => setSchedTime(e.target.value)}
                    placeholder="e.g. 16:00 - 17:00"
                    className={cn(inputClass, "mt-1")}
                  />
                </div>

                <div>
                  <label className="font-semibold text-ink">Venue / Platform *</label>
                  <input
                    type="text"
                    required
                    value={schedVenue}
                    onChange={(e) => setSchedVenue(e.target.value)}
                    placeholder="e.g. LH-204 / LMS Canvas"
                    className={cn(inputClass, "mt-1")}
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-ink">
                  Target Student Cohort ({schedStudentNames.length || "All At-Risk"} students)
                </label>
                <textarea
                  rows={2}
                  value={schedStudentNames.join(", ")}
                  onChange={(e) =>
                    setSchedStudentNames(
                      e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean)
                    )
                  }
                  placeholder="Comma-separated student names or leave blank to assign all at-risk students"
                  className={cn(inputClass, "mt-1 text-xs")}
                />
              </div>

              <div>
                <label className="font-semibold text-ink">Faculty Pedagogical Notes</label>
                <textarea
                  rows={2}
                  value={schedNotes}
                  onChange={(e) => setSchedNotes(e.target.value)}
                  placeholder="Focus areas, practice problems, or prerequisite topics to review..."
                  className={cn(inputClass, "mt-1 text-xs")}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsScheduleModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={createInterventionMutation.isPending}
                  className="gap-1.5"
                >
                  {createInterventionMutation.isPending ? <Spinner className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
                  <span>Confirm Schedule</span>
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* ────────────────── MODAL: INSPECT STUDENT DIAGNOSTIC PROFILE ────────────────── */}
      {isInspectStudentOpen && inspectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <GraduationCap className="size-4 text-brand" />
                <h3 className="text-base font-semibold text-ink">Student Diagnostic Profile</h3>
              </div>
              <button
                onClick={() => setIsInspectStudentOpen(false)}
                className="rounded-md p-1 text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="flex items-start justify-between rounded-lg bg-surface-2 p-3">
                <div>
                  <h4 className="text-sm font-bold text-ink">{inspectedStudent.name}</h4>
                  <p className="font-mono text-ink-3">Roll No: {inspectedStudent.rollNo}</p>
                  <p className="text-ink-2">{inspectedStudent.section}</p>
                </div>
                <Badge
                  tone={
                    inspectedStudent.riskSignal === "Low Mastery"
                      ? "rose"
                      : inspectedStudent.riskSignal === "Attendance Warning"
                      ? "amber"
                      : "teal"
                  }
                >
                  {inspectedStudent.riskSignal}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-line p-3">
                  <span className="text-ink-3">Academic Score Average</span>
                  <div className="mt-1 text-xl font-bold text-ink">{inspectedStudent.averageScore}%</div>
                  <Progress
                    value={inspectedStudent.averageScore}
                    tone={inspectedStudent.averageScore < 50 ? "rose" : "teal"}
                    className="mt-2"
                  />
                </div>

                <div className="rounded-lg border border-line p-3">
                  <span className="text-ink-3">Attendance Ratio</span>
                  <div className="mt-1 text-xl font-bold text-ink">{inspectedStudent.attendancePercent}%</div>
                  <Progress
                    value={inspectedStudent.attendancePercent}
                    tone={inspectedStudent.attendancePercent < 75 ? "rose" : "sky"}
                    className="mt-2"
                  />
                </div>
              </div>

              <div>
                <span className="font-semibold text-ink">Identified Weak Areas &amp; Struggle Topics:</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {inspectedStudent.weakTopics.map((topic, i) => (
                    <span key={i} className="rounded-md bg-rose/10 px-2 py-1 font-medium text-rose">
                      {topic}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="font-semibold text-ink">Remedial Action Status:</span>
                <p className="mt-1 text-ink-2">
                  Current state:{" "}
                  <span className="font-semibold text-brand">{inspectedStudent.remedialStatus}</span>
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsInspectStudentOpen(false)}
                >
                  Close
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setIsInspectStudentOpen(false);
                    handleOpenScheduleForStudent(inspectedStudent);
                  }}
                  className="gap-1.5"
                >
                  <Plus className="size-3.5" />
                  <span>Assign Remedial Intervention</span>
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ────────────────── MODAL: AI REMEDIAL WORKSHEET & STUDY GUIDE ────────────────── */}
      {isAiWorksheetModalOpen && activeWorksheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-brand" />
                <h3 className="text-base font-semibold text-ink">
                  AI Remedial Study Guide &amp; Worksheet ({activeWorksheet.unit})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyWorksheet}
                  className="gap-1 text-xs"
                >
                  {copiedWorksheet ? <CheckCircle2 className="size-3.5 text-teal" /> : <Copy className="size-3.5" />}
                  <span>{copiedWorksheet ? "Copied" : "Copy"}</span>
                </Button>
                <button
                  onClick={() => setIsAiWorksheetModalOpen(false)}
                  className="rounded-md p-1 text-ink-3 hover:bg-surface-2 hover:text-ink"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div>
                <h4 className="text-sm font-bold text-ink">{activeWorksheet.topic}</h4>
                <p className="mt-1 text-ink-2 leading-relaxed">{activeWorksheet.overview}</p>
              </div>

              {/* Core Concepts */}
              <div className="space-y-2">
                <h5 className="font-semibold text-brand">Core Concepts &amp; Visual Heuristics</h5>
                <div className="space-y-2">
                  {activeWorksheet.coreConcepts.map((c, i) => (
                    <div key={i} className="rounded-lg bg-surface-2 p-3">
                      <div className="font-semibold text-ink">{c.concept}</div>
                      <p className="mt-1 text-ink-2">{c.explanation}</p>
                      <div className="mt-1.5 text-[11px] text-teal italic">Analogy: {c.visualAnalogy}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Common Pitfalls */}
              <div className="space-y-2">
                <h5 className="font-semibold text-rose">Common Misconceptions &amp; Corrections</h5>
                <div className="space-y-2">
                  {activeWorksheet.commonPitfalls.map((p, i) => (
                    <div key={i} className="rounded-lg border border-rose/20 bg-rose/5 p-3">
                      <div className="font-medium text-rose">Pitfall: {p.misconception}</div>
                      <div className="mt-1 text-ink-2 font-medium">Correction: {p.correction}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Worked Example */}
              <div className="space-y-2">
                <h5 className="font-semibold text-brand">Worked Diagnostic Example</h5>
                <div className="rounded-lg border border-line bg-surface-2 p-3">
                  <div className="font-mono text-ink font-semibold">{activeWorksheet.workedExample.problemStatement}</div>
                  <ul className="mt-2 list-decimal space-y-1 pl-4 text-ink-2">
                    {activeWorksheet.workedExample.stepByStepSolution.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ul>
                  <div className="mt-2 rounded bg-brand/10 p-2 font-semibold text-brand text-[11px]">
                    Key Takeaway: {activeWorksheet.workedExample.keyTakeaway}
                  </div>
                </div>
              </div>

              {/* Practice Questions */}
              <div className="space-y-2">
                <h5 className="font-semibold text-ink">Formative Practice Questions</h5>
                <div className="space-y-2.5">
                  {activeWorksheet.practiceQuestions.map((q) => (
                    <div key={q.id} className="rounded-lg border border-line p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-ink">Question {q.id}</span>
                        <Badge tone={q.difficulty === "Challenging" ? "rose" : q.difficulty === "Medium" ? "amber" : "teal"}>
                          {q.difficulty}
                        </Badge>
                      </div>
                      <p className="mt-1 text-ink-2 font-medium">{q.question}</p>
                      <p className="mt-1 text-[11px] text-ink-3">Hint: {q.hint}</p>
                      <div className="mt-1.5 rounded bg-surface-2 p-2 text-[11px] text-ink">
                        <span className="font-semibold text-teal">Correct Answer:</span> {q.correctAnswer}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Faculty Advice */}
              <div className="rounded-lg bg-brand/5 p-3">
                <h5 className="font-semibold text-brand">Pedagogical Tips for Faculty</h5>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-ink-2">
                  {activeWorksheet.pedagogicalAdviceForFaculty.map((tip, i) => (
                    <li key={i}>{tip}</li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsAiWorksheetModalOpen(false)}
                >
                  Done
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
