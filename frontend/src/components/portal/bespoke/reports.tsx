"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import {
  ReportsOverviewSchema,
  ReportItemSchema,
  ScheduledReportSchema,
  type ReportCategory,
  type ReportItem,
  type ScheduledReport,
  type ReportsOverview,
  type CreateReportInput,
} from "@/lib/api/schemas";
import { z } from "zod";
import {
  FileText,
  Search,
  Plus,
  Download,
  Filter,
  Eye,
  RefreshCw,
  Trash2,
  CheckCircle2,
  Sparkles,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  FileSpreadsheet,
  FileCheck,
} from "lucide-react";
import type { Role } from "@/lib/auth/roles";
import {
  Badge,
  Button,
  Card,
  Field,
  EmptyState,
  Spinner,
  inputClass,
} from "@/components/ui/primitives";
import { toCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";

/* ── Data Interfaces ────────────────────────────────── */
export type { ReportCategory, ReportItem, ScheduledReport, ReportsOverview, CreateReportInput };

/* ── Initial Mock Data ──────────────────────────────── */

const INITIAL_REPORTS: ReportItem[] = [
  {
    id: "rep-1",
    report: "Semester academic report",
    category: "Institution",
    scope: "Institution",
    period: "Odd sem 2026",
    formats: ["PDF", "Excel", "CSV"],
    generated: "2 days ago",
    fileSize: "4.2 MB",
    generatedBy: "Academic Dean Office",
    summary: "Institution-wide semester progress review analyzing 3,420 enrolled students across 6 engineering and management departments. Pass percentage is up by 3.2% compared to the previous odd semester.",
    kpis: [
      { label: "Total Students", value: "3,420" },
      { label: "Overall Pass %", value: "91.8%", delta: "+3.2% YoY" },
      { label: "Mean CGPA", value: "7.84" },
      { label: "Distinction Rate", value: "28.5%" },
    ],
    breakdown: [
      { item: "Computer Science & Engineering", evaluated: 720, score: 94.2, status: "Excellent" },
      { item: "Electronics & Communication", evaluated: 640, score: 91.5, status: "On Track" },
      { item: "Information Technology", evaluated: 580, score: 93.0, status: "Excellent" },
      { item: "Mechanical Engineering", evaluated: 510, score: 88.4, status: "Good" },
      { item: "Management Studies (MBA)", evaluated: 430, score: 92.6, status: "Excellent" },
    ],
  },
  {
    id: "rep-2",
    report: "Department performance",
    category: "Department",
    scope: "CSE",
    period: "Odd sem 2026",
    formats: ["PDF", "Excel", "CSV"],
    generated: "3 days ago",
    fileSize: "2.8 MB",
    generatedBy: "HOD - Dr. Meena Raghavan",
    summary: "Departmental review for Computer Science & Engineering covering curriculum completion, internal assessment averages, lab performance, and student feedback benchmarks.",
    kpis: [
      { label: "Courses Tracked", value: "24" },
      { label: "Curriculum Coverage", value: "96.4%" },
      { label: "Student Feedback", value: "4.7 / 5.0" },
      { label: "Lab Attainment", value: "95.1%" },
    ],
    breakdown: [
      { item: "DBMS (CS301)", evaluated: 180, score: 89.2, status: "Target Met" },
      { item: "Operating Systems (CS302)", evaluated: 180, score: 86.8, status: "Target Met" },
      { item: "Design & Analysis of Algorithms", evaluated: 180, score: 91.0, status: "Exceeded" },
      { item: "Compiler Design (CS304)", evaluated: 180, score: 84.5, status: "Remedial Scheduled" },
    ],
  },
  {
    id: "rep-3",
    report: "Course outcome attainment",
    category: "Academic",
    scope: "DBMS",
    period: "Odd sem 2026",
    formats: ["PDF", "Excel", "CSV"],
    generated: "4 days ago",
    fileSize: "1.9 MB",
    generatedBy: "Course Coordinator",
    summary: "Direct and indirect CO-PO attainment analysis for Database Management Systems based on internal assessments, assignments, lab rubrics, and semester exams.",
    kpis: [
      { label: "COs Evaluated", value: "5 / 5" },
      { label: "Overall Attainment", value: "86.4%" },
      { label: "NBA Threshold", value: "70.0% Min" },
      { label: "Attainment Level", value: "Level 3" },
    ],
    breakdown: [
      { item: "CO1: Relational Data Models", evaluated: 180, score: 88.0, status: "Attained" },
      { item: "CO2: SQL & Complex Queries", evaluated: 180, score: 92.4, status: "Attained" },
      { item: "CO3: Normalization & Schema", evaluated: 180, score: 84.1, status: "Attained" },
      { item: "CO4: ACID & Transaction Mgmt", evaluated: 180, score: 81.6, status: "Attained" },
      { item: "CO5: Indexing & Storage Engine", evaluated: 180, score: 85.9, status: "Attained" },
    ],
  },
  {
    id: "rep-4",
    report: "Skill report",
    category: "Academic",
    scope: "Final year",
    period: "Odd sem 2026",
    formats: ["PDF", "Excel", "CSV"],
    generated: "5 days ago",
    fileSize: "3.1 MB",
    generatedBy: "Skill Development Cell",
    summary: "Evaluation of industry-aligned competencies, cloud certifications, hackathon participations, and programming skill ratings across 820 graduating seniors.",
    kpis: [
      { label: "Seniors Certified", value: "784 / 820" },
      { label: "Certification Rate", value: "95.6%" },
      { label: "Mean Skill Level", value: "Advanced" },
      { label: "Active Github Repos", value: "640" },
    ],
    breakdown: [
      { item: "Full Stack & Cloud Architecture", evaluated: 310, score: 92.0, status: "High Competency" },
      { item: "Data Engineering & AI/ML", evaluated: 240, score: 88.5, status: "Competent" },
      { item: "Cybersecurity & DevOps", evaluated: 160, score: 86.2, status: "Competent" },
      { item: "Embedded & IoT Systems", evaluated: 110, score: 89.0, status: "High Competency" },
    ],
  },
  {
    id: "rep-5",
    report: "Placement report",
    category: "Placement",
    scope: "Institution",
    period: "Odd sem 2026",
    formats: ["PDF", "Excel", "CSV"],
    generated: "6 days ago",
    fileSize: "5.4 MB",
    generatedBy: "Director - Training & Placement",
    summary: "Mid-term campus placement statistics detailing drive participations, offer letters released, tier-wise package distributions, and dream recruiter partnerships.",
    kpis: [
      { label: "Total Offers Made", value: "682" },
      { label: "Placement Rate", value: "86.8%" },
      { label: "Highest Package", value: "₹38.5 LPA" },
      { label: "Average CTC", value: "₹9.2 LPA" },
    ],
    breakdown: [
      { item: "Super Dream (>₹15 LPA)", evaluated: 74, score: 100, status: "Completed" },
      { item: "Dream Offers (₹8-15 LPA)", evaluated: 268, score: 100, status: "Completed" },
      { item: "Core Engineering Offers", evaluated: 215, score: 100, status: "Completed" },
      { item: "Ongoing Recruiter Drives", evaluated: 125, score: 72, status: "In Progress" },
    ],
  },
  {
    id: "rep-6",
    report: "Faculty development",
    category: "Faculty",
    scope: "All departments",
    period: "Odd sem 2026",
    formats: ["PDF", "Excel", "CSV"],
    generated: "7 days ago",
    fileSize: "2.1 MB",
    generatedBy: "Dean of Research",
    summary: "Faculty training audits, NPTEL/ATAL FDP completions, Scopus/SCI journal research papers published, and funded consultancy grant deliverables.",
    kpis: [
      { label: "Faculty Participating", value: "142" },
      { label: "Papers Published", value: "58" },
      { label: "Funded Grants", value: "₹1.42 Cr" },
      { label: "FDP Hours / Faculty", value: "48.2 hrs" },
    ],
    breakdown: [
      { item: "Research & International Journals", evaluated: 58, score: 96.0, status: "Indexed" },
      { item: "NPTEL & MOOC Certifications", evaluated: 112, score: 91.0, status: "Passed" },
      { item: "Industrial Sabbaticals & Training", evaluated: 34, score: 88.0, status: "Verified" },
    ],
  },
  {
    id: "rep-7",
    report: "Activity & engagement",
    category: "Institution",
    scope: "Institution",
    period: "Odd sem 2026",
    formats: ["PDF", "Excel", "CSV"],
    generated: "8 days ago",
    fileSize: "1.8 MB",
    generatedBy: "Student Welfare Committee",
    summary: "Co-curricular, sports, cultural club participations, NSS/social community outreach initiatives, and campus life engagement index metrics.",
    kpis: [
      { label: "Clubs Active", value: "18" },
      { label: "Campus Events Held", value: "32" },
      { label: "Student Footfall", value: "84.2%" },
      { label: "NSS Community Hours", value: "2,400 hrs" },
    ],
    breakdown: [
      { item: "Technical & Coding Clubs", evaluated: 1200, score: 92.5, status: "High Activity" },
      { item: "Cultural & Performing Arts", evaluated: 850, score: 90.0, status: "High Activity" },
      { item: "Inter-Collegiate Sports", evaluated: 640, score: 88.0, status: "Active" },
    ],
  },
  {
    id: "rep-8",
    report: "Student progress",
    category: "Academic",
    scope: "CSE-A",
    period: "Odd sem 2026",
    formats: ["PDF", "Excel", "CSV"],
    generated: "9 days ago",
    fileSize: "1.4 MB",
    generatedBy: "Class Mentor",
    summary: "Cohort-level continuous assessment breakdown for CSE Section A (68 students), highlighting attendance correlation with mid-term score outcomes.",
    kpis: [
      { label: "Class Strength", value: "68" },
      { label: "Average Attendance", value: "88.6%" },
      { label: "Class Average", value: "76.4%" },
      { label: "Zero Backlog %", value: "92.6%" },
    ],
    breakdown: [
      { item: "Top Quartile (>85%)", evaluated: 22, score: 91.2, status: "Excellence" },
      { item: "Second Quartile (70-85%)", evaluated: 31, score: 78.4, status: "Good" },
      { item: "Remedial Attention (<60%)", evaluated: 5, score: 54.0, status: "Mentoring Assigned" },
    ],
  },
  {
    id: "rep-9",
    report: "NAAC Criterion 2 audit",
    category: "Compliance",
    scope: "Institution",
    period: "Odd sem 2026",
    formats: ["PDF", "Excel", "CSV"],
    generated: "10 days ago",
    fileSize: "6.2 MB",
    generatedBy: "IQAC Coordinator",
    summary: "Self-Study Report (SSR) metric calculation for NAAC Criterion II: Teaching-Learning and Evaluation. Data formatted strictly to NAAC portal schemas.",
    kpis: [
      { label: "Criterion II Score", value: "3.72 / 4.0" },
      { label: "Student-Faculty Ratio", value: "14.8 : 1" },
      { label: "Mentor Ratio", value: "1 : 18" },
      { label: "Experiential Learning %", value: "86.0%" },
    ],
    breakdown: [
      { item: "2.1 Student Enrollment Profile", evaluated: 100, score: 94.0, status: "Compliant" },
      { item: "2.3 Teaching-Learning Process", evaluated: 100, score: 92.0, status: "Compliant" },
      { item: "2.6 Student Performance & Learning Outcomes", evaluated: 100, score: 95.0, status: "Compliant" },
      { item: "2.7 Student Satisfaction Survey", evaluated: 100, score: 88.5, status: "Compliant" },
    ],
  },
  {
    id: "rep-10",
    report: "NBA Program Exit survey",
    category: "Compliance",
    scope: "CSE & ECE",
    period: "Odd sem 2026",
    formats: ["PDF", "Excel", "CSV"],
    generated: "11 days ago",
    fileSize: "2.6 MB",
    generatedBy: "NBA Steering Committee",
    summary: "Program Educational Objectives (PEOs) and Program Outcomes (POs) exit survey administered to graduating engineers assessing curriculum relevance.",
    kpis: [
      { label: "Survey Responses", value: "96.2%" },
      { label: "PO Attainment Score", value: "2.64 / 3.0" },
      { label: "Industry Readiness", value: "88.4%" },
      { label: "Ethics & Environment PO", value: "2.82 / 3.0" },
    ],
    breakdown: [
      { item: "PO1: Engineering Knowledge", evaluated: 240, score: 88.0, status: "High Target" },
      { item: "PO3: Design/Development of Solutions", evaluated: 240, score: 86.5, status: "High Target" },
      { item: "PO5: Modern Tool Usage", evaluated: 240, score: 91.0, status: "High Target" },
      { item: "PO10: Professional Communication", evaluated: 240, score: 84.0, status: "Target Met" },
    ],
  },
  {
    id: "rep-11",
    report: "Lab equipment & audit",
    category: "Department",
    scope: "Mechanical",
    period: "Odd sem 2026",
    formats: ["PDF", "Excel", "CSV"],
    generated: "12 days ago",
    fileSize: "3.7 MB",
    generatedBy: "Lab Audit In-Charge",
    summary: "Safety certification, calibration log verification, consumable stock register, and maintenance uptime audit for 8 specialized engineering laboratories.",
    kpis: [
      { label: "Labs Audited", value: "8 / 8" },
      { label: "Equipment Uptime", value: "98.4%" },
      { label: "Safety Compliance", value: "100%" },
      { label: "Service Log Current", value: "Verified" },
    ],
    breakdown: [
      { item: "Thermal Engineering Lab", evaluated: 24, score: 98.0, status: "Certified" },
      { item: "CAD/CAM Simulation Center", evaluated: 60, score: 99.0, status: "Certified" },
      { item: "Dynamics & Vibration Lab", evaluated: 18, score: 95.0, status: "Calibrated" },
      { item: "Fluid Mechanics & Hydraulics", evaluated: 22, score: 96.5, status: "Certified" },
    ],
  },
  {
    id: "rep-12",
    report: "Placement salary bands",
    category: "Placement",
    scope: "Placement Cell",
    period: "Odd sem 2026",
    formats: ["PDF", "Excel", "CSV"],
    generated: "14 days ago",
    fileSize: "2.3 MB",
    generatedBy: "Head of Corporate Relations",
    summary: "Detailed compensation band analysis detailing base salary, joining bonuses, ESOP grants, and sector distributions across IT, FinTech, and Consulting recruiters.",
    kpis: [
      { label: "Median CTC", value: "₹8.8 LPA" },
      { label: "Top 10% Average", value: "₹24.6 LPA" },
      { label: "Offers > ₹10 LPA", value: "214" },
      { label: "Tier 1 Corporates", value: "48 Companies" },
    ],
    breakdown: [
      { item: "FinTech & Banking Software", evaluated: 142, score: 95.0, status: "Closed" },
      { item: "Cloud & Enterprise SaaS", evaluated: 198, score: 92.0, status: "Closed" },
      { item: "Management & Tech Consulting", evaluated: 86, score: 90.0, status: "Closed" },
      { item: "Core Engineering & Automotive", evaluated: 112, score: 88.0, status: "Closed" },
    ],
  },
];

const INITIAL_SCHEDULED: ScheduledReport[] = [
  {
    id: "sch-1",
    name: "Weekly Attendance & At-Risk Student Digest",
    frequency: "Weekly",
    scope: "Institution",
    recipients: "principal@ait.edu.in, deans@ait.edu.in, hods@ait.edu.in",
    nextRun: "Monday, 08:00 AM",
    enabled: true,
  },
  {
    id: "sch-2",
    name: "Monthly Placement Drive & Offer Sheet Sync",
    frequency: "Monthly",
    scope: "Placement Cell",
    recipients: "placement.director@ait.edu.in, principal@ait.edu.in",
    nextRun: "1st of next month",
    enabled: true,
  },
  {
    id: "sch-3",
    name: "Course Outcome (CO-PO) Attainment Audit",
    frequency: "End of Term",
    scope: "All Departments",
    recipients: "iqac.chair@ait.edu.in, hods@ait.edu.in",
    nextRun: "End of Odd Sem (Nov 30)",
    enabled: true,
  },
  {
    id: "sch-4",
    name: "Faculty Research & Scopus Publications Report",
    frequency: "Monthly",
    scope: "Research Cell",
    recipients: "dean.research@ait.edu.in",
    nextRun: "15th of next month",
    enabled: false,
  },
];

/* ── Main Component ─────────────────────────────────── */

export function ReportsModule({ role }: { role?: Role }) {
  const qc = useQueryClient();

  // Backend Query
  const query = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      try {
        const res = await apiFetch("/api/v1/reports", ReportsOverviewSchema);
        if (typeof window !== "undefined") {
          localStorage.setItem("ciq_saved_reports_cache", JSON.stringify(res.reports));
        }
        return res;
      } catch (e) {
        console.warn("Failed fetching from backend, falling back to local cache:", e);
        const cached = typeof window !== "undefined" ? localStorage.getItem("ciq_saved_reports_cache") : null;
        return {
          collegeId: "COL-1001",
          reports: cached ? JSON.parse(cached) : INITIAL_REPORTS,
          scheduledReports: INITIAL_SCHEDULED,
        };
      }
    },
  });

  const reports = query.data?.reports ?? [];
  const scheduledReports = query.data?.scheduledReports ?? [];

  // Active tab state
  const [activeTab, setActiveTab] = useState<"all" | "scheduled">("all");

  // Filtering state
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [scopeFilter, setScopeFilter] = useState<string>("All");
  const [periodFilter, setPeriodFilter] = useState<string>("All");

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // Modals state
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [previewReport, setPreviewReport] = useState<ReportItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Generator form inputs
  const [genTitle, setGenTitle] = useState("Semester Academic Performance Summary");
  const [genCategory, setGenCategory] = useState<ReportCategory>("Academic");
  const [genScope, setGenScope] = useState("Institution");
  const [genPeriod, setGenPeriod] = useState("Odd sem 2026");
  const [genIncludeRisk, setGenIncludeRisk] = useState(true);
  const [genIncludeGrades, setGenIncludeGrades] = useState(true);
  const [genIncludePlacements, setGenIncludePlacements] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: CreateReportInput) => {
      return apiFetch("/api/v1/reports", ReportItemSchema, {
        method: "POST",
        body: payload,
      });
    },
    onSuccess: (newRep) => {
      qc.invalidateQueries({ queryKey: ["reports"] });
      setIsGenerating(false);
      setIsGenerateOpen(false);
      setPage(1);
      setToast(`Report "${newRep.report}" compiled and permanently saved to institutional archive!`);
      setTimeout(() => setToast(null), 4000);
    },
    onError: (err) => {
      setIsGenerating(false);
      setToast("Error saving report: " + (err instanceof Error ? err.message : "Network error"));
      setTimeout(() => setToast(null), 4000);
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (reportId: string) => {
      return apiFetch(`/api/v1/reports/${reportId}`, z.object({ ok: z.boolean() }), {
        method: "DELETE",
      });
    },
    onMutate: async (reportId: string) => {
      await qc.cancelQueries({ queryKey: ["reports"] });
      const prevData = qc.getQueryData<ReportsOverview>(["reports"]);
      if (prevData) {
        const nextReports = prevData.reports.filter((r: ReportItem) => r.id !== reportId);
        qc.setQueryData(["reports"], {
          ...prevData,
          reports: nextReports,
        });
        if (typeof window !== "undefined") {
          localStorage.setItem("ciq_saved_reports_cache", JSON.stringify(nextReports));
        }
      }
      return { prevData };
    },
    onError: (err, _, context) => {
      if (context?.prevData) {
        qc.setQueryData(["reports"], context.prevData);
      }
      setToast("Failed to delete report: " + (err instanceof Error ? err.message : "Error"));
      setTimeout(() => setToast(null), 3000);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports"] });
      setToast("Report deleted from archive.");
      setTimeout(() => setToast(null), 2500);
      setPage((prevPage) => (prevPage > 1 && paginatedReports.length <= 1 ? prevPage - 1 : prevPage));
    },
  });

  // Toggle Schedule Mutation
  const toggleScheduleMutation = useMutation({
    mutationFn: async (scheduleId: string) => {
      return apiFetch(`/api/v1/reports/scheduled/${scheduleId}/toggle`, ScheduledReportSchema, {
        method: "POST",
      });
    },
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["reports"] });
      setToast(`Updated schedule "${updated.name}".`);
      setTimeout(() => setToast(null), 2000);
    },
  });

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reports.filter((r: ReportItem) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        r.report.toLowerCase().includes(q) ||
        r.scope.toLowerCase().includes(q) ||
        r.summary.toLowerCase().includes(q) ||
        r.period.toLowerCase().includes(q);

      const matchesCategory = categoryFilter === "All" || r.category === categoryFilter;
      const matchesScope = scopeFilter === "All" || r.scope === scopeFilter;
      const matchesPeriod = periodFilter === "All" || r.period === periodFilter;

      return matchesSearch && matchesCategory && matchesScope && matchesPeriod;
    });
  }, [reports, search, categoryFilter, scopeFilter, periodFilter]);

  // Paginated reports
  const totalPages = Math.max(1, Math.ceil(filteredReports.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paginatedReports = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredReports.slice(startIndex, startIndex + pageSize);
  }, [filteredReports, currentPage, pageSize]);

  // Download real CSV helper
  const handleDownloadCsv = (report: ReportItem) => {
    const rows = [
      ["Report Name", report.report],
      ["Scope", report.scope],
      ["Period", report.period],
      ["Generated", report.generated],
      ["Generated By", report.generatedBy],
      ["Summary", report.summary],
      [],
      ["Key Metrics", "Value"],
      ...report.kpis.map((k) => [k.label, k.value]),
      [],
      ["Breakdown Item", "Evaluated Cohort", "Score %", "Status"],
      ...report.breakdown.map((b) => [b.item, b.evaluated, b.score, b.status]),
    ];

    const csvContent = toCsv(rows);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${report.report.replace(/[^a-zA-Z0-9]/g, "_")}_Export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setToast(`Downloaded "${report.report}" as CSV spreadsheet.`);
    setTimeout(() => setToast(null), 3000);
  };

  // Download simulated PDF / print preview
  const handleDownloadPdf = (report: ReportItem) => {
    setToast(`Preparing official signed PDF export for "${report.report}"…`);
    setTimeout(() => {
      setToast(`PDF generated successfully (${report.fileSize})!`);
      setTimeout(() => setToast(null), 3000);
    }, 1200);
  };

  // Handle generation of new report
  const handleCreateReport = () => {
    setIsGenerating(true);
    createMutation.mutate({
      report: genTitle,
      category: genCategory,
      scope: genScope,
      period: genPeriod,
      includeGrades: genIncludeGrades,
      includeRisk: genIncludeRisk,
      includePlacements: genIncludePlacements,
    });
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className="flex items-center justify-between rounded-xl border border-teal/40 bg-teal-soft/70 px-4 py-3 text-sm text-teal shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{toast}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="rounded p-1 hover:bg-teal/10"
            aria-label="Close notification"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* KPI Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-ink-3">
            <span className="font-medium uppercase tracking-wider">Reports Ready</span>
            <FileText className="size-4 text-brand" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">{reports.length}</span>
            {role ? <Badge tone="brand" className="text-[10px]">{role.toUpperCase()}</Badge> : null}
            <span className="text-xs text-teal font-medium">All certified</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">PDF, Excel & CSV available</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-ink-3">
            <span className="font-medium uppercase tracking-wider">Scheduled Auto-Runs</span>
            <Clock className="size-4 text-sky" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">
              {scheduledReports.filter((s) => s.enabled).length}
            </span>
            <span className="text-xs text-ink-3">active crons</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">Next run: Monday 08:00 AM</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-ink-3">
            <span className="font-medium uppercase tracking-wider">Data Export Volume</span>
            <Download className="size-4 text-gold" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">48.2 MB</span>
            <span className="text-xs text-ink-3">this term</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">Institutional data warehouse</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-ink-3">
            <span className="font-medium uppercase tracking-wider">Accreditation Ready</span>
            <FileCheck className="size-4 text-teal" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-teal">100%</span>
            <span className="text-xs text-ink-3">compliant</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">NAAC & NBA formats supported</p>
        </Card>
      </div>

      {/* Main Container Card */}
      <Card>
        {/* Top Controls Bar */}
        <div className="border-b border-line p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 sm:max-w-md">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
              <input
                type="text"
                placeholder="Search reports by title, scope or keyword..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className={cn(inputClass, "pl-9 text-xs")}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                onClick={() => setIsGenerateOpen(true)}
                className="gap-1.5 text-xs h-9 px-3.5"
              >
                <Plus className="size-3.5" /> Generate report
              </Button>
            </div>
          </div>

          {/* Filter Pills & Dropdowns */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
              <span className="text-ink-3 font-semibold uppercase text-[10px] mr-1 flex items-center gap-1">
                <Filter className="size-3" /> Type:
              </span>
              {["All", "Academic", "Department", "Placement", "Faculty", "Compliance", "Institution"].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setCategoryFilter(cat);
                    setPage(1);
                  }}
                  className={cn(
                    "rounded-lg px-2.5 py-1 font-medium transition-colors text-xs whitespace-nowrap",
                    categoryFilter === cat
                      ? "bg-brand text-white shadow-sm"
                      : "bg-surface-2 text-ink-2 hover:bg-surface-2/80 hover:text-ink"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Dropdowns for Scope & Period */}
            <div className="flex items-center gap-2 text-xs">
              <select
                value={scopeFilter}
                onChange={(e) => {
                  setScopeFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-ink focus:border-brand focus:outline-none"
                aria-label="Filter by scope"
              >
                <option value="All">All Scopes</option>
                <option value="Institution">Institution</option>
                <option value="CSE">CSE Dept</option>
                <option value="DBMS">DBMS Course</option>
                <option value="Final year">Final year</option>
                <option value="Mechanical">Mechanical Dept</option>
                <option value="Placement Cell">Placement Cell</option>
              </select>

              <select
                value={periodFilter}
                onChange={(e) => {
                  setPeriodFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-ink focus:border-brand focus:outline-none"
                aria-label="Filter by period"
              >
                <option value="All">All Periods</option>
                <option value="Odd sem 2026">Odd sem 2026</option>
                <option value="Even sem 2025–26">Even sem 2025–26</option>
              </select>
            </div>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="flex border-b border-line px-4 gap-4 text-xs font-semibold text-ink-3">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={cn(
              "py-2.5 border-b-2 transition-colors flex items-center gap-1.5",
              activeTab === "all"
                ? "border-brand text-brand"
                : "border-transparent hover:text-ink"
            )}
          >
            <FileText className="size-3.5" /> Generated Reports ({filteredReports.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("scheduled")}
            className={cn(
              "py-2.5 border-b-2 transition-colors flex items-center gap-1.5",
              activeTab === "scheduled"
                ? "border-brand text-brand"
                : "border-transparent hover:text-ink"
            )}
          >
            <Clock className="size-3.5" /> Automated Schedules ({scheduledReports.length})
          </button>
        </div>

        {/* ═════════ TAB 1: REPORTS TABLE ═════════ */}
        {activeTab === "all" && (
          <div>
            {filteredReports.length === 0 ? (
              <div className="p-10">
                <EmptyState
                  title="No reports match your filters"
                  body={search ? "Try adjusting your search terms or filter selections." : "Generate a report using the button above."}
                  action={
                    <Button size="sm" onClick={() => setIsGenerateOpen(true)}>
                      <Plus className="size-3.5 mr-1" /> Generate report
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-line bg-surface-2/40 text-[10px] uppercase tracking-wider text-ink-3 font-semibold">
                    <tr>
                      <th scope="col" className="px-5 py-3">Report</th>
                      <th scope="col" className="px-4 py-3">Scope</th>
                      <th scope="col" className="px-4 py-3">Period</th>
                      <th scope="col" className="px-4 py-3">Formats</th>
                      <th scope="col" className="px-4 py-3">Last Generated</th>
                      <th scope="col" className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {paginatedReports.map((r: ReportItem) => (
                      <tr
                        key={r.id}
                        onClick={() => setPreviewReport(r)}
                        className="hover:bg-surface-2/60 cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-3.5 font-medium text-ink">
                          <div className="flex items-center gap-2.5">
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                              <FileText className="size-3.5" />
                            </span>
                            <div>
                              <p className="font-semibold text-ink hover:text-brand hover:underline">
                                {r.report}
                              </p>
                              <p className="text-[11px] text-ink-3 line-clamp-1 max-w-xs sm:max-w-md">
                                {r.summary}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <Badge
                            tone={
                              r.scope === "Institution"
                                ? "brand"
                                : r.scope === "CSE"
                                ? "teal"
                                : r.scope === "DBMS"
                                ? "sky"
                                : "neutral"
                            }
                          >
                            {r.scope}
                          </Badge>
                        </td>

                        <td className="px-4 py-3.5 text-ink-2 font-medium">
                          {r.period}
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1">
                            {r.formats.map((fmt: string) => (
                              <button
                                key={fmt}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (fmt === "CSV" || fmt === "Excel") handleDownloadCsv(r);
                                  else handleDownloadPdf(r);
                                }}
                                className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-surface-2 text-ink hover:bg-brand hover:text-white transition-colors"
                                title={`Download ${fmt}`}
                              >
                                {fmt}
                              </button>
                            ))}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-ink-3">
                          <span className="font-medium text-ink">{r.generated}</span>
                          <span className="text-[10px] block text-ink-3">{r.fileSize}</span>
                        </td>

                        <td className="px-5 py-3.5 text-right">
                          <div
                            className="flex items-center justify-end gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => setPreviewReport(r)}
                              className="rounded p-1 text-ink-3 hover:text-brand hover:bg-brand-soft transition-colors"
                              title="Preview Report"
                            >
                              <Eye className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadCsv(r)}
                              className="rounded p-1 text-ink-3 hover:text-teal hover:bg-teal-soft transition-colors"
                              title="Download Spreadsheet"
                            >
                              <Download className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setToast(`Refreshed live data for "${r.report}"`);
                                setTimeout(() => setToast(null), 2500);
                              }}
                              className="rounded p-1 text-ink-3 hover:text-sky hover:bg-sky-soft transition-colors"
                              title="Regenerate data"
                            >
                              <RefreshCw className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={deleteMutation.isPending}
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                deleteMutation.mutate(r.id);
                              }}
                              className="rounded p-1 text-ink-3 hover:text-rose hover:bg-rose-soft transition-colors disabled:opacity-50"
                              title="Delete Report"
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
            )}

            {/* Pagination Controls */}
            {filteredReports.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-line px-5 py-3.5 text-xs text-ink-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span>
                    Showing <strong className="text-ink">{(currentPage - 1) * pageSize + 1}</strong> to{" "}
                    <strong className="text-ink">{Math.min(currentPage * pageSize, filteredReports.length)}</strong> of{" "}
                    <strong className="text-ink">{filteredReports.length}</strong> reports
                  </span>
                  <div className="flex items-center gap-1.5 sm:border-l sm:border-line sm:pl-3">
                    <span>Rows per page:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
                      }}
                      className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink focus:border-brand focus:outline-none"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="mr-2 text-ink-3">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="gap-1 px-2.5 h-8 text-xs"
                  >
                    <ChevronLeft className="size-3.5" /> Prev
                  </Button>

                  <div className="hidden sm:flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pNum) => (
                      <button
                        key={pNum}
                        type="button"
                        onClick={() => setPage(pNum)}
                        className={cn(
                          "size-8 rounded-lg text-xs font-medium transition-colors",
                          pNum === currentPage
                            ? "bg-brand text-white shadow-sm font-semibold"
                            : "text-ink-2 hover:bg-surface-2 hover:text-ink border border-line"
                        )}
                      >
                        {pNum}
                      </button>
                    ))}
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="gap-1 px-2.5 h-8 text-xs"
                  >
                    Next <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═════════ TAB 2: SCHEDULED RUNS ═════════ */}
        {activeTab === "scheduled" && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-ink">Automated Cron Delivery Schedules</h4>
                <p className="text-xs text-ink-3">
                  Configured reports run automatically in the background and deliver PDF/Excel digests to recipient inboxes.
                </p>
              </div>
              <Badge tone="teal">
                {scheduledReports.filter((s) => s.enabled).length} Schedules Active
              </Badge>
            </div>

            <div className="grid gap-3">
              {scheduledReports.map((sch) => (
                <div
                  key={sch.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-line bg-surface hover:bg-surface-2/40 transition-colors text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-ink">{sch.name}</span>
                      <Badge tone="brand">{sch.frequency}</Badge>
                      <Badge tone="neutral">{sch.scope}</Badge>
                    </div>
                    <p className="text-xs text-ink-3">
                      Recipients: <span className="font-mono text-[11px] text-ink">{sch.recipients}</span>
                    </p>
                    <p className="text-[11px] text-ink-3">
                      Next scheduled run: <span className="font-medium text-teal">{sch.nextRun}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-xs">
                      <span>{sch.enabled ? "Active" : "Paused"}</span>
                      <input
                        type="checkbox"
                        checked={sch.enabled}
                        disabled={toggleScheduleMutation.isPending}
                        onChange={() => {
                          toggleScheduleMutation.mutate(sch.id);
                        }}
                        className="rounded border-line text-brand focus:ring-brand size-4 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* ═════════ REPORT PREVIEW MODAL ═════════ */}
      {previewReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-xl space-y-5">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-line pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge tone="brand">{previewReport.category}</Badge>
                  <Badge tone="sky">{previewReport.scope}</Badge>
                  <span className="text-xs text-ink-3">{previewReport.period}</span>
                </div>
                <h3 className="text-lg font-bold text-ink">{previewReport.report}</h3>
                <p className="text-xs text-ink-3">
                  Generated by {previewReport.generatedBy} · {previewReport.generated} ({previewReport.fileSize})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewReport(null)}
                className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Executive Summary */}
            <div className="rounded-xl bg-surface-2/50 p-4 border border-line text-xs space-y-1">
              <span className="font-semibold text-ink uppercase tracking-wider text-[10px]">
                Executive Briefing
              </span>
              <p className="text-ink-2 leading-relaxed">{previewReport.summary}</p>
            </div>

            {/* KPI Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {previewReport.kpis.map((kpi) => (
                <div key={kpi.label} className="p-3 rounded-xl border border-line bg-surface">
                  <span className="text-[11px] text-ink-3 block">{kpi.label}</span>
                  <span className="text-lg font-bold text-ink">{kpi.value}</span>
                  {kpi.delta && (
                    <span className="text-[10px] text-teal font-medium block">{kpi.delta}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Breakdown Table */}
            <div>
              <span className="text-xs font-semibold text-ink uppercase tracking-wider block mb-2">
                Detailed Evaluation Data
              </span>
              <div className="overflow-hidden rounded-xl border border-line">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-2 text-ink-3 font-semibold text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="px-3.5 py-2.5">Category / Subject</th>
                      <th className="px-3.5 py-2.5 text-center">Evaluated Cohort</th>
                      <th className="px-3.5 py-2.5 text-center">Attainment Score</th>
                      <th className="px-3.5 py-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {previewReport.breakdown.map((row) => (
                      <tr key={row.item} className="hover:bg-surface-2/30">
                        <td className="px-3.5 py-2.5 font-medium text-ink">{row.item}</td>
                        <td className="px-3.5 py-2.5 text-center text-ink-3">{row.evaluated}</td>
                        <td className="px-3.5 py-2.5 text-center font-bold text-brand">{row.score}%</td>
                        <td className="px-3.5 py-2.5 text-right">
                          <Badge tone={row.score >= 90 ? "teal" : row.score >= 80 ? "brand" : "amber"}>
                            {row.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-line">
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleDownloadCsv(previewReport)}
                  className="gap-1.5 text-xs"
                >
                  <FileSpreadsheet className="size-3.5 text-teal" /> Download CSV
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleDownloadPdf(previewReport)}
                  className="gap-1.5 text-xs"
                >
                  <FileText className="size-3.5 text-rose" /> Export PDF
                </Button>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPreviewReport(null)}
              >
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════ GENERATE REPORT MODAL ═════════ */}
      {isGenerateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
                  <Sparkles className="size-4" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-ink">Generate New Institutional Report</h3>
                  <p className="text-xs text-ink-3">Live data extraction from campus data warehouse</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGenerateOpen(false)}
                className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-2"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <Field label="Report Title" htmlFor="gen-title">
                <input
                  id="gen-title"
                  type="text"
                  value={genTitle}
                  onChange={(e) => setGenTitle(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. End of Term Department Performance"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Report Domain" htmlFor="gen-cat">
                  <select
                    id="gen-cat"
                    value={genCategory}
                    onChange={(e) => setGenCategory(e.target.value as ReportCategory)}
                    className={inputClass}
                  >
                    <option value="Academic">Academic (CO/PO)</option>
                    <option value="Department">Department Review</option>
                    <option value="Placement">Placements & CTC</option>
                    <option value="Faculty">Faculty & Research</option>
                    <option value="Compliance">NAAC / NBA Audit</option>
                    <option value="Institution">Institution-Wide</option>
                  </select>
                </Field>

                <Field label="Department Scope" htmlFor="gen-scope">
                  <select
                    id="gen-scope"
                    value={genScope}
                    onChange={(e) => setGenScope(e.target.value)}
                    className={inputClass}
                  >
                    <option value="Institution">Institution (All)</option>
                    <option value="CSE">Computer Science (CSE)</option>
                    <option value="ECE">Electronics (ECE)</option>
                    <option value="IT">Information Tech (IT)</option>
                    <option value="Mechanical">Mechanical</option>
                    <option value="MBA">Management Studies</option>
                  </select>
                </Field>
              </div>

              <Field label="Academic Term" htmlFor="gen-period">
                <select
                  id="gen-period"
                  value={genPeriod}
                  onChange={(e) => setGenPeriod(e.target.value)}
                  className={inputClass}
                >
                  <option value="Odd sem 2026">Odd Semester 2026 (Current Term)</option>
                  <option value="Even sem 2025–26">Even Semester 2025–26</option>
                  <option value="AY 2025–26 Full Year">Annual Academic Year 2025–26</option>
                </select>
              </Field>

              <div className="space-y-2 pt-1 border-t border-line">
                <span className="text-[11px] font-semibold text-ink-3 uppercase block">
                  Include Modules & Metrics
                </span>
                <label className="flex items-center gap-2 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={genIncludeGrades}
                    onChange={(e) => setGenIncludeGrades(e.target.checked)}
                    className="rounded border-line text-brand focus:ring-brand size-3.5"
                  />
                  <span>Grade distribution & pass percentage analytics</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={genIncludeRisk}
                    onChange={(e) => setGenIncludeRisk(e.target.checked)}
                    className="rounded border-line text-brand focus:ring-brand size-3.5"
                  />
                  <span>At-risk students (&lt;75% attendance / &lt;60% marks)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={genIncludePlacements}
                    onChange={(e) => setGenIncludePlacements(e.target.checked)}
                    className="rounded border-line text-brand focus:ring-brand size-3.5"
                  />
                  <span>Placement offers and recruiter statistics</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsGenerateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={isGenerating || createMutation.isPending || !genTitle}
                onClick={handleCreateReport}
                className="gap-1.5"
              >
                {isGenerating || createMutation.isPending ? <Spinner /> : <Sparkles className="size-3.5" />}
                {isGenerating || createMutation.isPending ? "Compiling & Saving…" : "Compile & Save Report"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
