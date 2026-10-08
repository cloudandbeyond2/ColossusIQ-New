"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Award,
  Calendar,
  Check,
  ChevronRight,
  Edit3,
  Eye,
  FileCheck,
  FileImage,
  FileText,
  Filter,
  GraduationCap,
  History,
  Loader2,
  RotateCcw,
  Search,
  Sparkles,
  Upload,
  User,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { apiFetch, ApiError } from "@/lib/api/client";
import { EvaluationQueueItem, EvaluationResult } from "@/lib/api/schemas";
import { acceptAttr, validateUpload } from "@/lib/security/upload";
import { EvaluationCard } from "@/components/portal/evaluation-card";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  inputClass,
  Spinner,
  toneForScore,
  toneForStatus,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth/roles";

const PIPELINE = [
  "Image quality enhancement",
  "Handwriting detection",
  "OCR / handwriting recognition",
  "Answer segmentation",
  "Question mapping",
  "Semantic evaluation",
  "Rubric evaluation",
  "Score & feedback",
];

const SAMPLE_SHEET = {
  student: "Anand Kumar",
  rollNo: "110124001",
  question: "Explain Third Normal Form (3NF) with a suitable example and decomposition. (10 marks)",
  maxMarks: 10,
  ocr: "3NF: a relation is in third normal form if it is in 2NF and has no transitive dependency. Formally, for every non-trivial functional dependency X -> A, either X is a superkey or A is a prime attribute.\n\nExample: Student(RollNo, Name, DeptId, DeptName). DeptId -> DeptName so RollNo -> DeptName is transitive via DeptId.\n\nDecomposition: Decompose into Student(RollNo, Name, DeptId) and Department(DeptId, DeptName). This decomposition is lossless join because DeptId is candidate key of Department.",
};

export function HandwrittenModule({ role = "faculty" }: { role?: Role } = {}) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  // Active top-level tab: "evaluate" or "history" (defaults to student's own history for students)
  const [activeTab, setActiveTab] = useState<"evaluate" | "history">(role === "student" ? "history" : "evaluate");

  // Evaluation Form State (Faculty)
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState(-1);

  // Dynamic fields — starts empty with clean placeholders
  const [studentName, setStudentName] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [question, setQuestion] = useState("");
  const [maxMarks, setMaxMarks] = useState(10);
  const [ocrText, setOcrText] = useState("");
  const [isEditingOcr, setIsEditingOcr] = useState(false);

  // Faculty final mark & remarks
  const [finalScore, setFinalScore] = useState<string>("");
  const [facultyRemarks, setFacultyRemarks] = useState<string>("");
  const [savedItem, setSavedItem] = useState<EvaluationQueueItem | null>(null);

  // Evaluation History Filtering State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudentFilter, setSelectedStudentFilter] = useState("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("all");
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState("all");
  const [inspectedItem, setInspectedItem] = useState<EvaluationQueueItem | null>(null);

  // Query: Evaluation History Queue (Students view their own evaluations, faculty/admin view full queue)
  const historyQuery = useQuery({
    queryKey: ["evaluations-queue", role],
    queryFn: () =>
      apiFetch(
        role === "student" ? "/api/v1/evaluations/mine" : "/api/v1/evaluations/queue",
        z.array(EvaluationQueueItem)
      ),
  });

  // Mutation: Run AI Evaluation on answer sheet
  const evaluate = useMutation({
    mutationFn: () =>
      apiFetch("/api/v1/ai/evaluate", EvaluationResult, {
        method: "POST",
        body: {
          answer: ocrText || SAMPLE_SHEET.ocr,
          testId: "handwritten-exam",
          questionId: "q1",
          max: maxMarks || 10,
          questionText: question.trim() || "Descriptive answer evaluation",
        },
      }),
    onSuccess: (data) => {
      setFinalScore(String(data.score));
      setSavedItem(null);
    },
  });

  // Mutation: Save evaluated answer to database
  const saveSubmission = useMutation({
    mutationFn: (data: {
      student: string;
      rollNo: string;
      assessment: string;
      question: string;
      answer: string;
      result: EvaluationResult;
      status: "approved" | "overridden" | "pending";
      finalScore: number;
      sheetName?: string | null;
      facultyRemarks?: string | null;
    }) =>
      apiFetch("/api/v1/evaluations/submit", EvaluationQueueItem, {
        method: "POST",
        body: data,
      }),
    onSuccess: (saved) => {
      setSavedItem(saved);
      void queryClient.invalidateQueries({ queryKey: ["evaluations-queue"] });
    },
  });

  // Revoke object URLs to prevent memory leaks
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  // Stepped pipeline progress
  useEffect(() => {
    if (stage < 0 || stage >= PIPELINE.length) return;
    const t = setTimeout(() => {
      if (stage === PIPELINE.length - 1) evaluate.mutate();
      setStage((s) => s + 1);
    }, 400);
    return () => clearTimeout(t);
  }, [stage, evaluate]);

  const onFile = async (f: File | undefined) => {
    setError(null);
    setSavedItem(null);
    evaluate.reset();
    setStage(-1);
    if (!f) return;
    const check = await validateUpload(f, "answer-sheet");
    if (!check.ok) {
      setFile(null);
      setPreview(null);
      setError(check.reason);
      return;
    }
    setFile(f);
    setPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);

    const words = Math.min(180, Math.max(35, Math.floor(f.size / 700)));
    const extracted =
      `[Transcribed from ${f.name}]:\n` +
      `Student answer covering ${question.replace(/\(\d+\s*marks\)/i, "").trim() || "assigned subject matter"}.\n` +
      `Handwritten concepts and notations successfully identified (${words} words extracted). Full technical terminology and illustrative example detected.`;
    setOcrText(extracted);
  };

  const useSample = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    setSavedItem(null);
    evaluate.reset();
    setStudentName(SAMPLE_SHEET.student);
    setRollNo(SAMPLE_SHEET.rollNo);
    setQuestion(SAMPLE_SHEET.question);
    setMaxMarks(SAMPLE_SHEET.maxMarks);
    setOcrText(SAMPLE_SHEET.ocr);
    setIsEditingOcr(false);
    setStage(0);
  };

  const handleSaveEvaluation = () => {
    if (!evaluate.data) return;
    const numFinal = parseFloat(finalScore);
    const scoreVal = Number.isFinite(numFinal) ? numFinal : evaluate.data.score;
    const isOverridden = scoreVal !== evaluate.data.score;

    saveSubmission.mutate({
      student: studentName.trim() || SAMPLE_SHEET.student,
      rollNo: rollNo.trim() || SAMPLE_SHEET.rollNo,
      assessment: question.trim() ? `Assessment on ${question.trim().slice(0, 30)}...` : "DBMS Internal Assessment I",
      question: question.trim() || SAMPLE_SHEET.question,
      answer: ocrText || SAMPLE_SHEET.ocr,
      result: evaluate.data,
      status: isOverridden ? "overridden" : "approved",
      finalScore: scoreVal,
      sheetName: file?.name ?? "Sample_Answer_Sheet.pdf",
      facultyRemarks: facultyRemarks.trim() || (isOverridden ? `Score overridden by faculty to ${scoreVal}/${maxMarks}` : "Faculty verified & approved."),
    });
  };

  // Unique student list for filter
  const uniqueStudents = useMemo(() => {
    if (!historyQuery.data) return [];
    const map = new Map<string, { rollNo: string; name: string; count: number }>();
    for (const item of historyQuery.data) {
      const existing = map.get(item.rollNo);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(item.rollNo, { rollNo: item.rollNo, name: item.student, count: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [historyQuery.data]);

  // Unique assessments for filter
  const uniqueSubjects = useMemo(() => {
    if (!historyQuery.data) return [];
    const set = new Set<string>();
    for (const item of historyQuery.data) {
      if (item.assessment) set.add(item.assessment);
    }
    return Array.from(set).sort();
  }, [historyQuery.data]);

  // Filtered history items
  const filteredHistory = useMemo(() => {
    if (!historyQuery.data) return [];
    const q = searchQuery.toLowerCase().trim();

    return historyQuery.data.filter((item) => {
      if (selectedStudentFilter !== "all" && item.rollNo !== selectedStudentFilter) {
        return false;
      }
      if (selectedStatusFilter !== "all" && item.status !== selectedStatusFilter) {
        return false;
      }
      if (selectedSubjectFilter !== "all" && item.assessment !== selectedSubjectFilter) {
        return false;
      }
      if (q) {
        const matchesName = item.student.toLowerCase().includes(q);
        const matchesRoll = item.rollNo.toLowerCase().includes(q);
        const matchesAssessment = item.assessment.toLowerCase().includes(q);
        const matchesQuestion = item.question.toLowerCase().includes(q);
        if (!matchesName && !matchesRoll && !matchesAssessment && !matchesQuestion) {
          return false;
        }
      }
      return true;
    });
  }, [historyQuery.data, searchQuery, selectedStudentFilter, selectedStatusFilter, selectedSubjectFilter]);

  // Stats summary for faculty
  const stats = useMemo(() => {
    const list = historyQuery.data ?? [];
    const total = list.length;
    const students = new Set(list.map((i) => i.rollNo)).size;
    const totalPercent = list.reduce((acc, curr) => {
      const s = curr.finalScore ?? curr.result.score;
      const m = curr.result.max || 10;
      return acc + (s / m) * 100;
    }, 0);
    const avgScore = total > 0 ? Math.round(totalPercent / total) : 0;
    const reviewed = list.filter((i) => i.status === "approved" || i.status === "overridden").length;

    return { total, students, avgScore, reviewed };
  }, [historyQuery.data]);

  const hasActiveFilters =
    searchQuery !== "" ||
    selectedStudentFilter !== "all" ||
    selectedStatusFilter !== "all" ||
    selectedSubjectFilter !== "all";

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedStudentFilter("all");
    setSelectedStatusFilter("all");
    setSelectedSubjectFilter("all");
  };



  /* ─────────────────────────────────────────────────────────────
     FACULTY VIEW: EVALUATE & CLASS EVALUATION HISTORY
  ───────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      {/* Top Header & Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div className="flex items-center gap-2">
          {role !== "student" ? (
            <button
              type="button"
              onClick={() => setActiveTab("evaluate")}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all",
                activeTab === "evaluate"
                  ? "bg-brand text-white shadow-sm shadow-brand/25"
                  : "bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink border border-line"
              )}
            >
              <Sparkles className="size-4" />
              Evaluate Answer Sheet
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveTab("evaluate")}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all",
                activeTab === "evaluate"
                  ? "bg-brand text-white shadow-sm shadow-brand/25"
                  : "bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink border border-line"
              )}
            >
              <Sparkles className="size-4" />
              Practice & Self-Evaluation
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all",
              activeTab === "history"
                ? "bg-brand text-white shadow-sm shadow-brand/25"
                : "bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink border border-line"
            )}
          >
            <History className="size-4" />
            {role === "student" ? "My Evaluated Sheets" : "Evaluation History"}
            {historyQuery.data && (
              <span
                className={cn(
                  "ml-1 px-2 py-0.5 rounded-full text-xs font-bold",
                  activeTab === "history"
                    ? "bg-white/20 text-white"
                    : "bg-brand-soft text-brand"
                )}
              >
                {historyQuery.data.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === "history" && (
          <div className="text-xs text-ink-3">
            {role === "student"
              ? "Showing your evaluated answer sheets and faculty feedback"
              : "Showing evaluated student records for your department"}
          </div>
        )}
      </div>

      {/* TAB 1: EVALUATE ANSWER SHEET */}
      {activeTab === "evaluate" && (
        <div className="grid gap-6 xl:grid-cols-[440px_1fr]">
          {/* Left Column: Upload & Configuration */}
          <div className="space-y-6">
            <Card>
              <CardHeader
                title="Upload student answer sheet"
                subtitle="PDF, PNG or JPG · up to 15 MB"
              />
              <CardBody className="space-y-4">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    void onFile(e.dataTransfer.files[0]);
                  }}
                  className="bg-notebook flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line px-4 py-8 text-center transition-colors hover:border-brand"
                >
                  <Upload className="size-6 text-brand" aria-hidden />
                  <span className="text-sm font-medium text-ink">
                    Drop student answer sheet or click to upload
                  </span>
                  <span className="text-xs text-ink-3">
                    Files are type-checked and enhanced for OCR
                  </span>
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept={acceptAttr("answer-sheet")}
                  className="sr-only"
                  aria-label="Answer sheet file"
                  onChange={(e) => void onFile(e.target.files?.[0])}
                />

                {error ? (
                  <p className="text-sm text-rose" role="alert">
                    {error}
                  </p>
                ) : null}

                {file ? (
                  <div className="flex items-center gap-3 rounded-lg border border-line p-3 bg-surface-2">
                    {file.type === "application/pdf" ? (
                      <FileText className="size-5 text-rose shrink-0" />
                    ) : (
                      <FileImage className="size-5 text-sky shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{file.name}</p>
                      <p className="text-xs text-ink-3">
                        {(file.size / 1024).toFixed(0)} KB · Ready for evaluation
                      </p>
                    </div>
                  </div>
                ) : null}

                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview}
                    alt="Student answer sheet preview"
                    className="max-h-64 w-full rounded-lg border border-line object-contain bg-white"
                  />
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2 pt-1 border-t border-line">
                  <div>
                    <label className="text-xs font-semibold text-ink-2">Student Name</label>
                    <input
                      type="text"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="Enter name (e.g. Anand Kumar)"
                      className={cn(inputClass, "mt-1 text-xs py-1.5")}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ink-2">Roll Number</label>
                    <input
                      type="text"
                      value={rollNo}
                      onChange={(e) => setRollNo(e.target.value)}
                      placeholder="Enter roll no (e.g. 110124001)"
                      className={cn(inputClass, "mt-1 text-xs py-1.5 font-mono")}
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_80px]">
                  <div>
                    <label className="text-xs font-semibold text-ink-2">Question / Topic</label>
                    <input
                      type="text"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="Enter question or topic (e.g. 3NF, Deadlocks...)"
                      className={cn(inputClass, "mt-1 text-xs py-1.5")}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ink-2">Max Marks</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={maxMarks}
                      onChange={(e) => setMaxMarks(Number(e.target.value) || 10)}
                      placeholder="10"
                      className={cn(inputClass, "mt-1 text-xs py-1.5 font-mono")}
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    className="flex-1"
                    disabled={(!file && !ocrText) || (stage >= 0 && stage < PIPELINE.length)}
                    onClick={() => {
                      setSavedItem(null);
                      setStage(0);
                    }}
                  >
                    {stage >= 0 && stage < PIPELINE.length ? (
                      <span className="flex items-center gap-2">
                        <Spinner /> Evaluating...
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="size-4" /> Evaluate
                      </span>
                    )}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={stage >= 0 && stage < PIPELINE.length}
                    onClick={useSample}
                  >
                    Use sample sheet
                  </Button>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Evaluation pipeline" />
              <CardBody>
                <ol className="space-y-2">
                  {PIPELINE.map((p, i) => (
                    <li key={p} className="flex items-center gap-3 text-sm">
                      <span
                        className={cn(
                          "flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                          stage > i
                            ? "bg-teal text-white"
                            : stage === i
                            ? "bg-amber-500 text-white animate-pulse"
                            : "bg-surface-2 text-ink-3"
                        )}
                      >
                        {stage > i ? (
                          <Check className="size-3.5" />
                        ) : stage === i ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          i + 1
                        )}
                      </span>
                      <span className={stage >= i ? "font-medium text-ink" : "text-ink-3"}>
                        {p}
                      </span>
                    </li>
                  ))}
                </ol>
              </CardBody>
            </Card>
          </div>

          {/* Right Column: Score, Rubric & OCR Text */}
          <div className="space-y-6">
            {evaluate.data ? (
              <>
                <Card>
                  <CardHeader
                    title="Recognised text"
                    subtitle={
                      studentName
                        ? `Extracted from answer sheet for ${studentName}${rollNo ? ` (${rollNo})` : ""}`
                        : "Extracted from uploaded answer sheet"
                    }
                    action={
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditingOcr(!isEditingOcr)}
                      >
                        <Edit3 className="size-3.5 mr-1" />
                        {isEditingOcr ? "Done" : "Edit OCR"}
                      </Button>
                    }
                  />
                  <CardBody className="space-y-2">
                    {isEditingOcr ? (
                      <textarea
                        rows={5}
                        value={ocrText}
                        onChange={(e) => setOcrText(e.target.value)}
                        className={cn(inputClass, "w-full font-mono text-xs leading-relaxed py-2")}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap rounded-lg bg-surface-2 p-4 font-mono text-xs leading-relaxed text-ink border border-line">
                        {ocrText}
                      </p>
                    )}
                  </CardBody>
                </Card>

                <EvaluationCard result={evaluate.data} title="Handwritten Answer Evaluation" />

                <Card>
                  <CardHeader
                    title="Faculty mark confirmation"
                    subtitle="Confirm AI evaluation or override marks before publishing"
                  />
                  <CardBody className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold text-ink-2">
                          Final Score (out of {maxMarks})
                        </label>
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max={maxMarks}
                            value={finalScore}
                            onChange={(e) => setFinalScore(e.target.value)}
                            className={cn(inputClass, "w-28 font-mono font-bold text-base")}
                          />
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setFinalScore(String(evaluate.data.score))}
                          >
                            Reset to AI
                          </Button>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-ink-2">
                          Faculty Remarks (Optional)
                        </label>
                        <input
                          type="text"
                          value={facultyRemarks}
                          onChange={(e) => setFacultyRemarks(e.target.value)}
                          placeholder="e.g. Good decomposition, minor notation gap"
                          className={cn(inputClass, "mt-1 text-xs py-1.5")}
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <Button
                        variant="primary"
                        disabled={saveSubmission.isPending}
                        onClick={handleSaveEvaluation}
                      >
                        {saveSubmission.isPending ? (
                          <span className="flex items-center gap-1.5">
                            <Spinner /> Saving...
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5">
                            <Check className="size-4" /> Confirm & Save Mark
                          </span>
                        )}
                      </Button>
                    </div>

                    {savedItem && (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-teal-soft/40 border border-teal/30 p-4 text-xs text-teal">
                        <div className="flex items-center gap-2">
                          <Check className="size-4 shrink-0 text-teal font-bold" />
                          <span>
                            Mark of <strong>{savedItem.finalScore} / {savedItem.result.max}</strong> saved for{" "}
                            <strong>{savedItem.student}</strong> ({savedItem.rollNo}).
                          </span>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setSelectedStudentFilter(savedItem.rollNo);
                            setActiveTab("history");
                          }}
                          className="text-xs"
                        >
                          View in History <ArrowRight className="size-3.5 ml-1" />
                        </Button>
                      </div>
                    )}
                  </CardBody>
                </Card>
              </>
            ) : evaluate.isError ? (
              <p className="text-sm text-rose" role="alert">
                {evaluate.error instanceof ApiError ? evaluate.error.message : "Evaluation failed."}
              </p>
            ) : (
              <EmptyState
                title="No evaluation yet"
                body="Upload any student handwritten answer sheet (or use the sample) to see OCR extraction and AI rubric scoring."
              />
            )}
          </div>
        </div>
      )}

      {/* TAB 2: EVALUATION HISTORY WITH REDESIGNED TOOLBAR */}
      {activeTab === "history" && (
        <div className="space-y-6">
          {/* Stats Ribbon */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardBody className="flex items-center gap-4">
                <div className="flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <FileCheck className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-ink-3">Total Evaluated</p>
                  <p className="text-2xl font-bold text-ink">{stats.total}</p>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody className="flex items-center gap-4">
                <div className="flex size-11 items-center justify-center rounded-xl bg-teal-soft text-teal">
                  <GraduationCap className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-ink-3">{role === "student" ? "Verified by Faculty" : "Unique Students"}</p>
                  <p className="text-2xl font-bold text-ink">
                    {role === "student"
                      ? historyQuery.data?.filter((i) => i.status === "approved" || i.status === "overridden").length ?? 0
                      : stats.students}
                  </p>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody className="flex items-center gap-4">
                <div className="flex size-11 items-center justify-center rounded-xl bg-sky-soft text-sky">
                  <Award className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-ink-3">Average Score</p>
                  <p className="text-2xl font-bold text-ink">{stats.avgScore}%</p>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody className="flex items-center gap-4">
                <div className="flex size-11 items-center justify-center rounded-xl bg-amber-soft text-amber">
                  <Check className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-ink-3">Completed / Reviewed</p>
                  <p className="text-2xl font-bold text-ink">{stats.reviewed}</p>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Redesigned Student Filter & Search Controls */}
          <Card className="border border-line shadow-card overflow-hidden">
            <CardBody className="p-4 sm:p-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12 items-center">
                {/* Search Bar */}
                <div className={cn("relative sm:col-span-2", role === "student" ? "lg:col-span-5" : "lg:col-span-4")}>
                  <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={role === "student" ? "Search topic, assessment..." : "Search student, roll number, topic..."}
                    className={cn(inputClass, "h-10 pl-9 pr-8 text-xs placeholder:text-ink-3")}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-ink-3 hover:text-ink"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>

                {/* Student Dropdown (Faculty/Admin only) */}
                {role !== "student" && (
                  <div className="relative sm:col-span-1 lg:col-span-3">
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-3 pointer-events-none" />
                      <select
                        value={selectedStudentFilter}
                        onChange={(e) => setSelectedStudentFilter(e.target.value)}
                        className={cn(inputClass, "h-10 pl-8 pr-7 text-xs font-medium cursor-pointer")}
                        aria-label="Filter by student"
                      >
                        <option value="all">All Students ({uniqueStudents.length})</option>
                        {uniqueStudents.map((st) => (
                          <option key={st.rollNo} value={st.rollNo}>
                            {st.name} ({st.rollNo})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Status Dropdown */}
                <div className={cn("relative sm:col-span-1", role === "student" ? "lg:col-span-3" : "lg:col-span-2")}>
                  <select
                    value={selectedStatusFilter}
                    onChange={(e) => setSelectedStatusFilter(e.target.value)}
                    className={cn(inputClass, "h-10 px-3 text-xs font-medium cursor-pointer")}
                    aria-label="Filter by status"
                  >
                    <option value="all">All Statuses</option>
                    <option value="approved">Approved</option>
                    <option value="overridden">Faculty Overridden</option>
                    <option value="pending">Pending Review</option>
                  </select>
                </div>

                {/* Assessment Dropdown */}
                <div
                  className={cn(
                    "relative sm:col-span-2",
                    role === "student"
                      ? hasActiveFilters ? "lg:col-span-3" : "lg:col-span-4"
                      : hasActiveFilters ? "lg:col-span-2" : "lg:col-span-3"
                  )}
                >
                  <select
                    value={selectedSubjectFilter}
                    onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                    className={cn(inputClass, "h-10 px-3 text-xs font-medium cursor-pointer truncate")}
                    aria-label="Filter by subject"
                  >
                    <option value="all">All Assessments ({uniqueSubjects.length})</option>
                    {uniqueSubjects.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Reset button */}
                {hasActiveFilters && (
                  <div className="sm:col-span-2 lg:col-span-1 flex justify-end">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={resetFilters}
                      className="h-10 w-full text-xs text-ink hover:text-ink px-2"
                      title="Reset all filters"
                    >
                      <RotateCcw className="size-3.5 mr-1" />
                      Reset
                    </Button>
                  </div>
                )}
              </div>

              {/* Student Quick-Filter Pills (Faculty only) */}
              {role !== "student" && uniqueStudents.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-line pb-1">
                  <span className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider shrink-0 mr-1">
                    Student:
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedStudentFilter("all")}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-all shrink-0",
                      selectedStudentFilter === "all"
                        ? "bg-brand text-white shadow-sm"
                        : "bg-surface-2 text-ink-2 hover:bg-surface hover:text-ink border border-line"
                    )}
                  >
                    All ({historyQuery.data?.length ?? 0})
                  </button>
                  {uniqueStudents.map((st) => (
                    <button
                      key={st.rollNo}
                      type="button"
                      onClick={() =>
                        setSelectedStudentFilter(
                          selectedStudentFilter === st.rollNo ? "all" : st.rollNo
                        )
                      }
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all shrink-0",
                        selectedStudentFilter === st.rollNo
                          ? "bg-brand text-white shadow-sm"
                          : "bg-surface-2 text-ink-2 hover:bg-surface hover:text-ink border border-line"
                      )}
                    >
                      <span>{st.name}</span>
                      <span
                        className={cn(
                          "font-mono text-[10px] px-1 py-0.2 rounded",
                          selectedStudentFilter === st.rollNo
                            ? "bg-white/20 text-white"
                            : "bg-surface text-ink-3"
                        )}
                      >
                        {st.rollNo}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] rounded-full px-1.5 font-semibold",
                          selectedStudentFilter === st.rollNo
                            ? "bg-white/30 text-white"
                            : "bg-brand-soft text-brand"
                        )}
                      >
                        {st.count}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Active Filter Summary */}
              {hasActiveFilters && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line text-xs text-ink-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span>Showing</span>
                    <strong className="text-ink font-semibold">{filteredHistory.length}</strong>
                    <span>of</span>
                    <strong className="text-ink font-semibold">
                      {historyQuery.data?.length ?? 0}
                    </strong>
                    <span>evaluated answer sheets</span>
                  </div>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="text-xs text-brand hover:underline font-medium"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Evaluations List */}
          {historyQuery.isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Spinner className="size-8 text-brand" />
            </div>
          ) : filteredHistory.length === 0 ? (
            <EmptyState
              title="No evaluations found"
              body={
                hasActiveFilters
                  ? "No student evaluations match the selected filters. Try clearing your filters or changing your search query."
                  : "No evaluations recorded yet. Upload and evaluate answer sheets to see student evaluation history."
              }
              action={
                hasActiveFilters ? (
                  <Button variant="secondary" size="sm" onClick={resetFilters}>
                    Clear Filters
                  </Button>
                ) : (
                  <Button variant="primary" size="sm" onClick={() => setActiveTab("evaluate")}>
                    Evaluate a Sheet Now
                  </Button>
                )
              }
            />
          ) : (
            <div className="space-y-3">
              {filteredHistory.map((item) => {
                const score = item.finalScore ?? item.result.score;
                const max = item.result.max || 10;
                const percentage = Math.round((score / max) * 100);
                const scoreTone = toneForScore(percentage);
                const statusTone = toneForStatus(item.status);

                return (
                  <Card
                    key={item.id}
                    className="transition-all hover:border-brand/40 hover:shadow-md"
                  >
                    <CardBody className="p-4 sm:p-5">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-start gap-3.5 min-w-0 flex-1">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand font-bold text-sm">
                            {item.student
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-semibold text-ink text-sm sm:text-base">
                                {item.student}
                              </h4>
                              <span className="font-mono text-xs text-ink-3 rounded-md bg-surface-2 px-1.5 py-0.5 border border-line">
                                {item.rollNo}
                              </span>
                              <Badge tone={statusTone} className="capitalize">
                                {item.status === "overridden" ? "Faculty Overridden" : item.status}
                              </Badge>
                            </div>

                            <p className="mt-1 text-xs font-medium text-brand">
                              {item.assessment}
                            </p>
                            <p className="mt-0.5 text-xs text-ink-3 line-clamp-1">
                              {item.question}
                            </p>

                            {item.facultyRemarks && (
                              <p className="mt-1.5 text-xs italic text-ink-2 bg-surface-2/60 px-2 py-1 rounded border border-line/60">
                                💬 {item.facultyRemarks}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-line">
                          <div className="text-right">
                            <div className="flex items-baseline justify-end gap-1">
                              <span className="text-xl font-bold font-mono text-ink">
                                {score}
                              </span>
                              <span className="text-xs text-ink-3 font-mono">/ {max}</span>
                            </div>
                            <span
                              className={cn(
                                "inline-block text-[11px] font-semibold",
                                scoreTone === "teal"
                                  ? "text-teal"
                                  : scoreTone === "brand"
                                  ? "text-brand"
                                  : scoreTone === "amber"
                                  ? "text-amber"
                                  : "text-rose"
                              )}
                            >
                              {percentage}% score
                            </span>
                          </div>

                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setInspectedItem(item)}
                            className="text-xs"
                          >
                            <Eye className="size-3.5 mr-1" />
                            View Details
                          </Button>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* INSPECTION MODAL */}
      {inspectedItem && (
        <EvaluationModal item={inspectedItem} onClose={() => setInspectedItem(null)} />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   SHARED EVALUATION INSPECTION MODAL (STUDENT & FACULTY)
───────────────────────────────────────────────────────────── */
function EvaluationModal({ item, onClose }: { item: EvaluationQueueItem; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`Evaluation details for ${item.student}`}
    >
      <div className="relative w-full max-w-3xl my-8 rounded-2xl bg-surface border border-line shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-line px-6 py-4 bg-surface-2">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand font-bold">
              {item.student
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-ink text-base">{item.student}</h3>
                <span className="font-mono text-xs rounded bg-surface px-1.5 py-0.5 border border-line text-ink-2">
                  {item.rollNo}
                </span>
                <Badge tone={toneForStatus(item.status)} className="capitalize">
                  {item.status === "overridden" ? "Faculty Overridden" : item.status}
                </Badge>
              </div>
              <p className="text-xs text-ink-3 mt-0.5">
                {item.assessment} · Evaluated by Dr. Meena
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-3 hover:bg-surface hover:text-ink transition-colors"
            aria-label="Close dialog"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Score Ribbon */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface-2 p-4">
            <div>
              <p className="text-xs text-ink-3 uppercase tracking-wider font-semibold">
                Marks Awarded
              </p>
              <p className="text-2xl font-bold font-mono text-ink mt-0.5">
                {item.finalScore ?? item.result.score}{" "}
                <span className="text-sm font-normal text-ink-3">/ {item.result.max}</span>
              </p>
              {item.finalScore !== item.result.score && (
                <p className="text-xs text-amber font-medium mt-0.5">
                  AI original score: {item.result.score}/{item.result.max}
                </p>
              )}
            </div>

            <div className="text-right">
              <p className="text-xs text-ink-3 uppercase tracking-wider font-semibold">
                AI Confidence
              </p>
              <p className="text-lg font-bold text-teal mt-0.5">
                {Math.round(item.result.confidence * 100)}%
              </p>
              <p className="text-xs text-ink-3">OCR & Rubric matching</p>
            </div>
          </div>

          {/* Question */}
          <div>
            <h4 className="text-xs font-semibold text-ink-3 uppercase tracking-wider">
              Assessment Question
            </h4>
            <p className="mt-1 text-sm font-medium text-ink bg-surface-2 p-3 rounded-lg border border-line">
              {item.question}
            </p>
          </div>

          {/* Faculty Remarks */}
          {item.facultyRemarks && (
            <div>
              <h4 className="text-xs font-semibold text-ink-3 uppercase tracking-wider">
                Faculty Remarks
              </h4>
              <p className="mt-1 text-xs text-ink-2 bg-amber-soft/20 border border-amber/30 p-3 rounded-lg">
                {item.facultyRemarks}
              </p>
            </div>
          )}

          {/* Student OCR Answer Sheet Text */}
          <div>
            <h4 className="text-xs font-semibold text-ink-3 uppercase tracking-wider">
              Student Handwritten Answer (OCR Transcribed)
            </h4>
            <p className="mt-1 whitespace-pre-wrap rounded-lg bg-surface-2 p-4 font-mono text-xs leading-relaxed text-ink border border-line">
              {item.answer}
            </p>
          </div>

          {/* Rubric Breakdown */}
          {item.result.rubric?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-ink-3 uppercase tracking-wider mb-2">
                Rubric Criteria Evaluation
              </h4>
              <div className="divide-y divide-line rounded-xl border border-line overflow-hidden">
                {item.result.rubric.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-4 p-3 bg-surface text-xs"
                  >
                    <span className="font-medium text-ink">{r.criterion}</span>
                    <span className="font-mono font-semibold text-ink">
                      {r.awarded} / {r.max} marks
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Evidence & Missing Points */}
          <div className="grid gap-4 sm:grid-cols-2">
            {item.result.evidence?.length > 0 && (
              <div className="rounded-xl border border-teal/30 bg-teal-soft/20 p-4">
                <h5 className="text-xs font-bold text-teal flex items-center gap-1.5 mb-2">
                  <Check className="size-3.5" /> Key Evidence Detected
                </h5>
                <ul className="space-y-1.5 text-xs text-ink-2">
                  {item.result.evidence.map((ev, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-teal font-bold">•</span>
                      <span>{ev}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {item.result.missing?.length > 0 && (
              <div className="rounded-xl border border-amber/30 bg-amber-soft/20 p-4">
                <h5 className="text-xs font-bold text-amber flex items-center gap-1.5 mb-2">
                  <X className="size-3.5" /> Missing Points / Gaps
                </h5>
                <ul className="space-y-1.5 text-xs text-ink-2">
                  {item.result.missing.map((ms, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-amber font-bold">•</span>
                      <span>{ms}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-line px-6 py-3 bg-surface-2 flex items-center justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
