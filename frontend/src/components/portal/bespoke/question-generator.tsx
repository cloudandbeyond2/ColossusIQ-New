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

  // ── 2. Fetch Question Paper History ──
  const papersQuery = useQuery({
    queryKey: PAPERS_KEY,
    queryFn: async () => {
      const res = await apiFetch<{ papers: QuestionPaperRecord[] }>("/api/v1/faculty/question-papers", z.object({
        papers: z.array(z.any()),
      }));
      return res.papers as QuestionPaperRecord[];
    },
  });

  const papers: QuestionPaperRecord[] = papersQuery.data ?? [];

  // ── Form State (matches original GeneratorTemplate) ──
  const [course, setCourse] = useState<string>(() => courseList[0] || FALLBACK_COURSES[0]!);
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

  // History Filter State
  const [courseFilter, setCourseFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // ── Generation Mutation (calls AI generate and auto-saves to history) ──
  const generateMutation = useMutation({
    mutationFn: async () => {
      const cleanedCourse = cleanText(course, 200) || FALLBACK_COURSES[0]!;
      const cleanedUnits = cleanText(units, 50) || "Units 1–2";
      const cleanedMarks = cleanText(marks, 10) || "50";
      const cleanedPattern = cleanText(pattern, 100) || PATTERN_OPTIONS[0]!;

      // 1. Generate with AI
      const genRes = await apiFetch<{ markdown: string }>("/api/v1/ai/generate", z.object({
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
            examType: "Internal Assessment",
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

  // Filtered papers for history tab
  const filteredPapers = useMemo(() => {
    return papers.filter((p) => {
      if (courseFilter !== "ALL") {
        const target = courseFilter.toLowerCase();
        if (!p.courseCode.toLowerCase().includes(target) && !p.courseTitle.toLowerCase().includes(target)) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          p.courseCode.toLowerCase().includes(q) ||
          p.courseTitle.toLowerCase().includes(q) ||
          p.units.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [papers, courseFilter, searchQuery]);

  return (
    <div className="space-y-5">
      {/* ── Top Tabs: Generate vs History ── */}
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("generate")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all",
              activeTab === "generate"
                ? "bg-brand text-white shadow-xs"
                : "bg-surface-2 text-ink-2 hover:bg-surface-3 hover:text-ink"
            )}
          >
            <Sparkles className="size-4" />
            Generate Question Paper
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all",
              activeTab === "history"
                ? "bg-brand text-white shadow-xs"
                : "bg-surface-2 text-ink-2 hover:bg-surface-3 hover:text-ink"
            )}
          >
            <FileText className="size-4" />
            History
            <span
              className={cn(
                "ml-1 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold",
                activeTab === "history" ? "bg-white/20 text-white" : "bg-brand-soft text-brand"
              )}
            >
              {papers.length}
            </span>
          </button>
        </div>

        {activeTab === "history" && (
          <div className="text-xs text-ink-3">
            Showing <strong>{filteredPapers.length}</strong> saved paper{filteredPapers.length === 1 ? "" : "s"}
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
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-center gap-2">
              <label htmlFor="history-filter-course" className="text-xs font-semibold text-ink-2">
                Course:
              </label>
              <select
                id="history-filter-course"
                className={cn(inputClass, "w-56 py-1.5 text-xs")}
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
              >
                <option value="ALL">All Courses ({papers.length})</option>
                {courseList.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                type="text"
                placeholder="Search history…"
                className={cn(inputClass, "pl-8 py-1.5 text-xs")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* History List */}
          {papersQuery.isLoading ? (
            <Skeleton className="h-64" />
          ) : filteredPapers.length === 0 ? (
            <EmptyState
              title="No Question Papers in History"
              body={
                courseFilter !== "ALL" || searchQuery
                  ? "No papers match your filter criteria."
                  : "No question papers have been generated yet. Switch to the 'Generate Question Paper' tab to create your first paper."
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredPapers.map((paper) => (
                <Card key={paper.id} className="p-5 flex flex-col justify-between border-line hover:shadow-xs transition-shadow">
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 border-b border-line pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-brand bg-brand-soft px-2 py-0.5 rounded-md">
                            {paper.courseCode}
                          </span>
                          <span className="text-xs font-semibold text-ink-2">
                            {paper.units}
                          </span>
                        </div>
                        <h4 className="font-semibold text-ink mt-1 text-base line-clamp-1">
                          {paper.courseTitle}
                        </h4>
                      </div>
                      <Badge tone={paper.status === "Finalized" ? "teal" : "brand"}>
                        {paper.marks} Marks
                      </Badge>
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
                  <div className="flex items-center justify-between border-t border-line pt-3 mt-2">
                    <div className="flex items-center gap-1.5">
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
          )}
        </div>
      )}

      {/* ── View Paper Modal ── */}
      {viewingPaper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-3xl border border-line bg-surface shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-line px-6 py-4 bg-surface-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-brand bg-brand-soft px-2 py-0.5 rounded-md">
                    {viewingPaper.courseCode}
                  </span>
                  <span className="text-sm font-bold text-ink">
                    {viewingPaper.courseTitle}
                  </span>
                  <Badge tone="teal">{viewingPaper.marks} Marks</Badge>
                </div>
                <p className="text-xs text-ink-3 mt-0.5">
                  {viewingPaper.units} · {viewingPaper.pattern}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => copyToClipboard(viewingPaper.markdown, viewingPaper.id)}
                >
                  {copiedId === viewingPaper.id ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                  {copiedId === viewingPaper.id ? "Copied" : "Copy"}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => printPaper(viewingPaper)}
                >
                  <Printer className="size-4" /> Print
                </Button>
                <button
                  type="button"
                  onClick={() => setViewingPaper(null)}
                  className="rounded-xl p-2 text-ink-3 hover:bg-surface-3 hover:text-ink transition-colors ml-2"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="rounded-2xl border border-line bg-surface p-6 shadow-2xs">
                <SafeMarkdown>{viewingPaper.markdown}</SafeMarkdown>
              </div>
            </div>

            <div className="border-t border-line px-6 py-3 bg-surface-2 flex items-center justify-between text-xs text-ink-3">
              <span>Saved on {new Date(viewingPaper.createdAt).toLocaleString("en-IN")}</span>
              <Button variant="secondary" size="sm" onClick={() => setViewingPaper(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
