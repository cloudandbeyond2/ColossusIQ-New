"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  FileText,
  Plus,
  Printer,
  Search,
  Sparkles,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { apiFetch, ApiError } from "@/lib/api/client";
import { RecordList } from "@/lib/api/schemas";
import { cleanText } from "@/lib/security/sanitize";
import { cn } from "@/lib/utils";
import { SafeMarkdown } from "@/components/ui/safe-markdown";
import { AiLabel } from "@/components/ui/notices";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  inputClass,
  Skeleton,
  Spinner,
} from "@/components/ui/primitives";
import type { QuestionPaperRecord } from "@/lib/api/mock/question-papers";

const PAPERS_KEY = ["faculty", "question-papers"] as const;
const COURSES_KEY = ["faculty", "courses-for-generator"] as const;

const FALLBACK_COURSES = [
  "CS2354 python",
  "CSE101 Database Management Systems",
  "AID102 AI Ethics, Bias, and Governance",
  "CSE105 Data base System Applications",
  "CSE106 Web Technologies",
  "EC101 Signals and Systems",
  "CSE104 DBMS",
  "CSE102 Operating Systems",
];

const UNITS_OPTIONS = ["Units 1–2", "Units 3–4", "Units 1–5"];
const PATTERN_OPTIONS = [
  "Part A (2 marks) + Part B (13 marks)",
  "MCQ only",
  "Descriptive only",
];

export function QuestionGeneratorModule({ role }: { role?: string }) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"generate" | "history">("generate");

  // ── 1. Fetch Dynamic Course List from Course Management ──
  const coursesQuery = useQuery({
    queryKey: COURSES_KEY,
    queryFn: async () => {
      try {
        const res = await apiFetch("/api/v1/records/courses?pageSize=50", RecordList);
        if (res.items && res.items.length > 0) {
          return res.items.map((item) => `${String(item.code || item.id)} ${String(item.title || "")}`.trim());
        }
      } catch (err) {
        console.warn("[question-generator] Failed to load courses from records API, using fallback:", err);
      }
      return FALLBACK_COURSES;
    },
  });

  const courseList = useMemo(() => {
    if (coursesQuery.data && coursesQuery.data.length > 0) return coursesQuery.data;
    return FALLBACK_COURSES;
  }, [coursesQuery.data]);

  // ── History Filter & Pagination State ──
  const [courseFilter, setCourseFilter] = useState<string>("ALL");
  const [examTypeFilter, setExamTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // ── 2. Fetch Question Paper History (with Server-side Pagination & Filtering) ──
  const papersQuery = useQuery({
    queryKey: [...PAPERS_KEY, page, pageSize, courseFilter, examTypeFilter, statusFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (courseFilter !== "ALL") params.set("courseCode", courseFilter);
      if (examTypeFilter !== "ALL") params.set("examType", examTypeFilter);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await apiFetch(`/api/v1/faculty/question-papers?${params.toString()}`, z.object({
        papers: z.array(z.any()),
        total: z.number().optional(),
        page: z.number().optional(),
        pageSize: z.number().optional(),
        totalPages: z.number().optional(),
      }));
      return res;
    },
  });

  const papersData = papersQuery.data;
  const papers: QuestionPaperRecord[] = (papersData?.papers as QuestionPaperRecord[]) ?? [];
  const totalPapers: number = papersData?.total ?? papers.length;
  const totalPages: number = papersData?.totalPages ?? Math.max(1, Math.ceil(totalPapers / pageSize));

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [courseFilter, examTypeFilter, statusFilter, searchQuery, pageSize]);

  // ── Form State (matches original GeneratorTemplate) ──
  const [course, setCourse] = useState<string>(() => courseList[0] || FALLBACK_COURSES[0]!);
  const [examType, setExamType] = useState<string>("Internal Assessment I");
  const [units, setUnits] = useState<string>(UNITS_OPTIONS[0]!);
  const [marks, setMarks] = useState<string>("50");
  const [pattern, setPattern] = useState<string>(PATTERN_OPTIONS[0]!);

  // Sync default course once courses load
  useEffect(() => {
    if (courseList.length > 0 && !course) {
      setCourse(courseList[0]!);
    }
  }, [courseList, course]);

  // Output State
  const [currentMarkdown, setCurrentMarkdown] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewingPaper, setViewingPaper] = useState<QuestionPaperRecord | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // ── Generation Mutation (calls AI generate and auto-saves to history) ──
  const generateMutation = useMutation({
    mutationFn: async () => {
      const cleanedCourse = cleanText(course, 200) || FALLBACK_COURSES[0]!;
      const cleanedUnits = cleanText(units, 50) || "Units 1–2";
      const cleanedMarks = cleanText(marks, 10) || "50";
      const cleanedPattern = cleanText(pattern, 100) || PATTERN_OPTIONS[0]!;
      const cleanedExamType = examType || "Internal Assessment I";

      // 1. Generate with AI
      const genRes = await apiFetch("/api/v1/ai/generate", z.object({
        agent: z.string().optional(),
        markdown: z.string(),
      }), {
        method: "POST",
        body: {
          module: "question-generator",
          inputs: {
            course: cleanedCourse,
            units: cleanedUnits,
            marks: cleanedMarks,
            pattern: cleanedPattern,
          },
        },
      });

      // Split code and title if present (e.g. "CS2354 python" -> code: "CS2354", title: "python")
      const parts = cleanedCourse.split(" ");
      const courseCode = parts[0] || "COURSE";
      const courseTitle = parts.slice(1).join(" ") || cleanedCourse;

      // 2. Persist to history repository
      try {
        await apiFetch("/api/v1/faculty/question-papers", z.object({ ok: z.boolean(), paper: z.any() }), {
          method: "POST",
          body: {
            courseCode,
            courseTitle,
            examType: cleanedExamType,
            units: cleanedUnits,
            marks: parseInt(cleanedMarks, 10) || 50,
            pattern: cleanedPattern,
            markdown: genRes.markdown,
            status: "Finalized",
          },
        });
      } catch (saveErr) {
        console.warn("[question-generator] Failed to save paper to repository:", saveErr);
      }

      return genRes.markdown;
    },
    onSuccess: (markdown) => {
      setCurrentMarkdown(markdown);
      void qc.invalidateQueries({ queryKey: PAPERS_KEY });
    },
  });

  // ── Delete Mutation ──
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/api/v1/faculty/question-papers/${id}`, z.object({ ok: z.boolean() }), {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      setDeleteConfirmId(null);
      void qc.invalidateQueries({ queryKey: PAPERS_KEY });
    },
  });

  // Copy helper
  const copyToClipboard = (text: string, id: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    });
  };

  // Print helper
  const printPaper = (p: { courseCode: string; courseTitle: string; markdown: string; marks: number | string; units: string }) => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${p.courseCode} ${p.courseTitle} - Question Paper</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; color: #111; margin: 2cm; }
            h1, h2, h3, h4 { margin-top: 1.2em; margin-bottom: 0.4em; }
            .header { text-align: center; border-bottom: 2px solid #222; padding-bottom: 12px; margin-bottom: 18px; }
            .meta { display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; margin-bottom: 12px; }
            hr { border: none; border-top: 1px solid #ccc; margin: 16px 0; }
            table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
            th, td { border: 1px solid #bbb; padding: 6px 10px; text-align: left; }
            th { background: #f0f0f0; }
            @media print { body { margin: 1cm; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h2 style="margin:0; letter-spacing:1px; text-transform:uppercase;">COLOSSUS UNIVERSITY OF TECHNOLOGY</h2>
            <p style="margin:4px 0 0; font-weight:bold;">DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING</p>
            <h3 style="margin:8px 0 0;">${p.courseCode} ${p.courseTitle}</h3>
          </div>
          <div class="meta">
            <div><strong>Coverage:</strong> ${p.units}</div>
            <div><strong>Maximum Marks:</strong> ${p.marks} Marks</div>
          </div>
          <div style="white-space: pre-wrap; font-size: 14px;">
            ${p.markdown.replace(/### /g, "\n").replace(/\*\*/g, "")}
          </div>
          <script>window.onload = function() { window.print(); };</script>
        </body>
      </html>
    `);
    w.document.close();
  };

  return (
    <div className="space-y-5">
      {/* ── Top Tabs: Generate vs History ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-line pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("generate")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all",
              activeTab === "generate"
                ? "bg-brand text-white shadow-xs"
                : "bg-surface-2 text-ink-2 hover:bg-surface-3 hover:text-ink"
            )}
          >
            <Sparkles className="size-3.5 sm:size-4" />
            Generate Question Paper
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all",
              activeTab === "history"
                ? "bg-brand text-white shadow-xs"
                : "bg-surface-2 text-ink-2 hover:bg-surface-3 hover:text-ink"
            )}
          >
            <FileText className="size-3.5 sm:size-4" />
            History
            <span
              className={cn(
                "ml-1 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold",
                activeTab === "history" ? "bg-white/20 text-white" : "bg-brand-soft text-brand"
              )}
            >
              {totalPapers}
            </span>
          </button>
        </div>

        {activeTab === "history" && (
          <div className="text-xs text-ink-3">
            Showing <strong>{papers.length}</strong> of <strong>{totalPapers}</strong> saved paper{totalPapers === 1 ? "" : "s"}
          </div>
        )}
      </div>

      {/* ─────────────────── TAB 1: GENERATE (ORIGINAL 2-COLUMN LAYOUT) ─────────────────── */}
      {activeTab === "generate" && (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          {/* Inputs Card */}
          <Card className="h-fit">
            <CardHeader title="Inputs" subtitle="Exam Assessment Agent" />
            <CardBody>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  generateMutation.mutate();
                }}
              >
                {/* Course Dropdown (populated dynamically from Course Management) */}
                <Field label="Course" htmlFor="gen-course">
                  <select
                    id="gen-course"
                    className={inputClass}
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                  >
                    {courseList.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>

                {/* Exam Type */}
                <Field label="Exam Type" htmlFor="gen-exam-type">
                  <select
                    id="gen-exam-type"
                    className={inputClass}
                    value={examType}
                    onChange={(e) => setExamType(e.target.value)}
                  >
                    <option value="Internal Assessment I">Internal Assessment I (IA-1)</option>
                    <option value="Internal Assessment II">Internal Assessment II (IA-2)</option>
                    <option value="Model Examination">Model Examination</option>
                    <option value="Semester End Examination">Semester End Examination</option>
                    <option value="Class Test">Class Test</option>
                  </select>
                </Field>

                {/* Units */}
                <Field label="Units" htmlFor="gen-units">
                  <select
                    id="gen-units"
                    className={inputClass}
                    value={units}
                    onChange={(e) => setUnits(e.target.value)}
                  >
                    {UNITS_OPTIONS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </Field>

                {/* Total Marks */}
                <Field label="Total marks" htmlFor="gen-marks">
                  <input
                    id="gen-marks"
                    type="number"
                    placeholder="e.g. 50"
                    className={inputClass}
                    value={marks}
                    onChange={(e) => setMarks(e.target.value)}
                  />
                </Field>

                {/* Pattern */}
                <Field label="Pattern" htmlFor="gen-pattern">
                  <select
                    id="gen-pattern"
                    className={inputClass}
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                  >
                    {PATTERN_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </Field>

                {/* Generate CTA Button */}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={generateMutation.isPending}
                >
                  {generateMutation.isPending ? <Spinner /> : <Sparkles className="size-4" />}
                  Generate question paper
                </Button>
              </form>
            </CardBody>
          </Card>

          {/* Output Card */}
          <Card className="min-h-80">
            <CardHeader
              title="Output"
              action={
                currentMarkdown ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => copyToClipboard(currentMarkdown, "active-out")}
                    >
                      {copiedId === "active-out" ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                      {copiedId === "active-out" ? "Copied" : "Copy"}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        const parts = course.split(" ");
                        printPaper({
                          courseCode: parts[0] || "COURSE",
                          courseTitle: parts.slice(1).join(" ") || course,
                          markdown: currentMarkdown,
                          marks,
                          units,
                        });
                      }}
                    >
                      <Printer className="size-4" />
                      Print
                    </Button>
                  </div>
                ) : null
              }
            />
            <CardBody>
              {generateMutation.isError ? (
                <p className="text-sm text-rose" role="alert">
                  {generateMutation.error instanceof ApiError
                    ? generateMutation.error.message
                    : "Generation failed. Please try again."}
                </p>
              ) : generateMutation.isPending ? (
                <div className="flex items-center gap-2 text-sm text-ink-3">
                  <Spinner /> Generating question paper…
                </div>
              ) : currentMarkdown ? (
                <div className="space-y-4">
                  <SafeMarkdown>{currentMarkdown}</SafeMarkdown>
                  <AiLabel />
                </div>
              ) : (
                <EmptyState
                  title="Nothing generated yet"
                  body="Select a course, choose the units and marks pattern, and click 'Generate question paper'. Output is a blueprint-aligned draft for you to review and copy."
                />
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {/* ─────────────────── TAB 2: HISTORY (SAVED QUESTION PAPERS) ─────────────────── */}
      {activeTab === "history" && (
        <div className="space-y-5">
          {/* Filter Bar */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3.5 rounded-2xl border border-line bg-surface p-3.5 sm:p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
              {/* Course Filter */}
              <div className="flex flex-col gap-1">
                <label htmlFor="history-filter-course" className="text-[11px] font-semibold text-ink-3">
                  Course
                </label>
                <select
                  id="history-filter-course"
                  className={cn(inputClass, "w-full py-1.5 text-xs")}
                  value={courseFilter}
                  onChange={(e) => setCourseFilter(e.target.value)}
                >
                  <option value="ALL">All Courses</option>
                  {courseList.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Exam Type Filter */}
              <div className="flex flex-col gap-1">
                <label htmlFor="history-filter-exam" className="text-[11px] font-semibold text-ink-3">
                  Exam Type
                </label>
                <select
                  id="history-filter-exam"
                  className={cn(inputClass, "w-full py-1.5 text-xs")}
                  value={examTypeFilter}
                  onChange={(e) => setExamTypeFilter(e.target.value)}
                >
                  <option value="ALL">All Exam Types</option>
                  <option value="Internal Assessment I">Internal Assessment I</option>
                  <option value="Internal Assessment II">Internal Assessment II</option>
                  <option value="Model Examination">Model Examination</option>
                  <option value="Semester End Examination">Semester End Examination</option>
                  <option value="Class Test">Class Test</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex flex-col gap-1">
                <label htmlFor="history-filter-status" className="text-[11px] font-semibold text-ink-3">
                  Status
                </label>
                <select
                  id="history-filter-status"
                  className={cn(inputClass, "w-full py-1.5 text-xs")}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">All Status</option>
                  <option value="Draft">Draft</option>
                  <option value="Approved">Approved</option>
                  <option value="Finalized">Finalized</option>
                </select>
              </div>
            </div>

            {/* Search Input */}
            <div className="w-full lg:w-64">
              <label htmlFor="history-search" className="text-[11px] font-semibold text-ink-3 block mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
                <input
                  id="history-search"
                  type="search"
                  placeholder="Search code, title, units…"
                  className={cn(inputClass, "w-full pl-8 py-1.5 text-xs")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* History List */}
          {papersQuery.isLoading ? (
            <Skeleton className="h-64" />
          ) : papers.length === 0 ? (
            <EmptyState
              title="No Question Papers Found"
              body={
                courseFilter !== "ALL" || examTypeFilter !== "ALL" || statusFilter !== "ALL" || searchQuery
                  ? "No question papers match your filter criteria. Try adjusting or clearing your filters."
                  : "No question papers have been generated yet. Switch to the 'Generate Question Paper' tab to create your first paper."
              }
            />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
                {papers.map((paper) => (
                  <Card key={paper.id} className="p-4 sm:p-5 flex flex-col justify-between border-line hover:shadow-xs transition-shadow">
                    <div>
                      {/* Header */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 border-b border-line pb-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-xs font-bold text-brand bg-brand-soft px-2 py-0.5 rounded-md">
                              {paper.courseCode}
                            </span>
                            <span className="text-xs font-semibold text-ink-2">
                              {paper.units}
                            </span>
                          </div>
                          <h4 className="font-semibold text-ink mt-1.5 text-sm sm:text-base leading-snug line-clamp-2" title={paper.courseTitle}>
                            {paper.courseTitle}
                          </h4>
                        </div>

                        <div className="flex flex-wrap items-center sm:flex-col sm:items-end gap-1.5 shrink-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge tone="teal" className="text-[11px] whitespace-nowrap">
                              {paper.examType || "IA-1"}
                            </Badge>
                            <Badge tone="brand" className="text-[11px] whitespace-nowrap">
                              {paper.marks} Marks
                            </Badge>
                          </div>
                          <Badge tone={paper.status === "Finalized" ? "teal" : paper.status === "Approved" ? "brand" : "amber"} className="text-[10px]">
                            {paper.status || "Finalized"}
                          </Badge>
                        </div>
                      </div>

                      {/* Meta info */}
                      <div className="py-2.5 text-xs text-ink-3 space-y-1">
                        <p>
                          <strong className="text-ink-2 font-medium">Pattern:</strong> {paper.pattern}
                        </p>
                        <p>
                          <strong className="text-ink-2 font-medium">Created:</strong>{" "}
                          {new Date(paper.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 mt-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setViewingPaper(paper)}
                          className="text-xs"
                        >
                          <Eye className="size-3.5" /> View
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => printPaper(paper)}
                          className="text-xs"
                        >
                          <Printer className="size-3.5" /> Print
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => copyToClipboard(paper.markdown, paper.id)}
                          className="text-xs"
                        >
                          {copiedId === paper.id ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                          {copiedId === paper.id ? "Copied" : "Copy"}
                        </Button>
                      </div>

                      {deleteConfirmId === paper.id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => deleteMutation.mutate(paper.id)}
                            disabled={deleteMutation.isPending}
                            className="text-xs"
                          >
                            Confirm
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setDeleteConfirmId(null)}
                            className="text-xs"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(paper.id)}
                          className="p-1.5 text-ink-3 hover:text-rose-600 transition-colors rounded-lg hover:bg-surface-2"
                          title="Delete question paper"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>

              {/* ── Server-Side Pagination Footer ── */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-line pt-4 px-1 sm:px-2">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs text-ink-3">
                  <span>
                    Showing{" "}
                    <strong className="text-ink">
                      {totalPapers === 0 ? 0 : (page - 1) * pageSize + 1}
                    </strong>{" "}
                    to{" "}
                    <strong className="text-ink">
                      {Math.min(page * pageSize, totalPapers)}
                    </strong>{" "}
                    of <strong className="text-ink">{totalPapers}</strong> papers
                  </span>

                  <span className="text-ink-4 hidden sm:inline">·</span>

                  <label className="flex items-center gap-1.5 text-ink-3">
                    <span>Per page:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      className="rounded border border-line bg-surface px-1.5 py-0.5 text-xs text-ink"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="text-xs"
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-ink-2 px-1">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="text-xs"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── View Paper Modal ── */}
      {viewingPaper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
          <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl sm:rounded-3xl border border-line bg-surface shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line p-4 sm:px-6 sm:py-4 bg-surface-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-brand bg-brand-soft px-2 py-0.5 rounded-md">
                    {viewingPaper.courseCode}
                  </span>
                  <span className="text-sm font-bold text-ink truncate max-w-xs sm:max-w-md">
                    {viewingPaper.courseTitle}
                  </span>
                  <Badge tone="teal" className="text-[11px]">{viewingPaper.marks} Marks</Badge>
                </div>
                <p className="text-xs text-ink-3 mt-1">
                  {viewingPaper.units} · {viewingPaper.pattern}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => copyToClipboard(viewingPaper.markdown, viewingPaper.id)}
                  className="text-xs"
                >
                  {copiedId === viewingPaper.id ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                  {copiedId === viewingPaper.id ? "Copied" : "Copy"}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => printPaper(viewingPaper)}
                  className="text-xs"
                >
                  <Printer className="size-3.5" /> Print
                </Button>
                <button
                  type="button"
                  onClick={() => setViewingPaper(null)}
                  className="rounded-xl p-1.5 text-ink-3 hover:bg-surface-3 hover:text-ink transition-colors ml-1"
                >
                  <X className="size-4 sm:size-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              <div className="rounded-xl sm:rounded-2xl border border-line bg-surface p-4 sm:p-6 shadow-2xs overflow-x-auto text-xs sm:text-sm">
                <SafeMarkdown>{viewingPaper.markdown}</SafeMarkdown>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-line px-4 sm:px-6 py-3 bg-surface-2 flex items-center justify-between text-xs text-ink-3">
              <span>Saved on {new Date(viewingPaper.createdAt).toLocaleDateString("en-IN")}</span>
              <Button variant="secondary" size="sm" onClick={() => setViewingPaper(null)} className="text-xs">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
