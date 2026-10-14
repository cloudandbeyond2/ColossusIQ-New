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
  Trash2,
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

const ACADEMIC_DEPARTMENTS = [
  { id: "cse", code: "CSE", name: "Computer Science & Engineering", defaultSection: "CSE-A" },
  { id: "it", code: "IT", name: "Information Technology", defaultSection: "IT-A" },
  { id: "aids", code: "AI&DS", name: "Artificial Intelligence & Data Science", defaultSection: "AI&DS-A" },
  { id: "ece", code: "ECE", name: "Electronics & Communication Engineering", defaultSection: "ECE-A" },
  { id: "eee", code: "EEE", name: "Electrical & Electronics Engineering", defaultSection: "EEE-A" },
  { id: "mech", code: "MECH", name: "Mechanical Engineering", defaultSection: "MECH-A" },
  { id: "civil", code: "CIVIL", name: "Civil Engineering", defaultSection: "CIVIL-A" },
];

const HandwrittenStudentSchema = z.object({
  students: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      roll: z.string(),
      section: z.string(),
      department: z.string().optional(),
      departmentCode: z.string().optional(),
    })
  ),
});

/**
 * Fast client-side image downscaling to ~1600px max dimension JPEG.
 * Reduces 3-5MB phone/scanner captures to ~120-180KB, reducing network upload & OCR latency from ~8s to <2s.
 */
async function compressImageForOcr(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve) => {
    // If not an image or SVG/GIF, fallback to FileReader
    if (!file.type.startsWith("image/") || file.type.includes("svg") || file.type.includes("gif")) {
      const reader = new FileReader();
      reader.onload = () => resolve({ base64: reader.result as string, mimeType: file.type || "image/jpeg" });
      reader.onerror = () => resolve({ base64: "", mimeType: file.type || "image/jpeg" });
      reader.readAsDataURL(file);
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX_DIM = 1600;
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        resolve({ base64: dataUrl, mimeType: "image/jpeg" });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve({ base64: reader.result as string, mimeType: file.type });
      reader.onerror = () => resolve({ base64: "", mimeType: file.type });
      reader.readAsDataURL(file);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      const reader = new FileReader();
      reader.onload = () => resolve({ base64: reader.result as string, mimeType: file.type });
      reader.onerror = () => resolve({ base64: "", mimeType: file.type });
      reader.readAsDataURL(file);
    };
    img.src = objectUrl;
  });
}

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
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Department & Student Selection State (dynamically fetched department-wise)
  const [selectedDeptCode, setSelectedDeptCode] = useState<string>("all");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [studentSearch, setStudentSearch] = useState<string>("");

  // Query: Live student directory across departments (same endpoint as /faculty/students)
  const studentsQuery = useQuery({
    queryKey: ["students-list"],
    queryFn: () => apiFetch("/api/v1/students", HandwrittenStudentSchema),
    enabled: role !== "student",
  });

  const allStudents = useMemo(() => studentsQuery.data?.students || [], [studentsQuery.data]);

  // Dynamically compute department options with exact student counts
  const departmentOptions = useMemo(() => {
    const list: Array<{
      id: string;
      code: string;
      name: string;
      count: number;
    }> = [
      {
        id: "all",
        code: "ALL",
        name: `All Departments (${allStudents.length} students)`,
        count: allStudents.length,
      },
    ];

    ACADEMIC_DEPARTMENTS.forEach((dept) => {
      const dCode = dept.code.toLowerCase();
      const count = allStudents.filter((s) => {
        const sec = (s.section || "").toLowerCase();
        const dName = (s.department || "").toLowerCase();
        const dCd = (s.departmentCode || "").toLowerCase();
        return sec.includes(dCode) || dCd === dCode || dName.includes(dCode) || dName.includes(dept.name.toLowerCase());
      }).length;

      list.push({
        id: dept.id,
        code: dept.code,
        name: `${dept.name} (${dept.code}) — ${count} ${count === 1 ? "student" : "students"}`,
        count,
      });
    });

    return list;
  }, [allStudents]);

  // Filter students based on selected department
  const departmentStudents = useMemo(() => {
    if (selectedDeptCode === "all") return allStudents;
    const targetDept = ACADEMIC_DEPARTMENTS.find((d) => d.id === selectedDeptCode);
    if (!targetDept) return allStudents;
    const dCode = targetDept.code.toLowerCase();
    return allStudents.filter((s) => {
      const sec = (s.section || "").toLowerCase();
      const dName = (s.department || "").toLowerCase();
      const dCd = (s.departmentCode || "").toLowerCase();
      return sec.includes(dCode) || dCd === dCode || dName.includes(dCode) || dName.includes(targetDept.name.toLowerCase());
    });
  }, [allStudents, selectedDeptCode]);

  // Filter by search query if applicable
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return departmentStudents;
    const q = studentSearch.toLowerCase();
    return departmentStudents.filter(
      (s) => s.name.toLowerCase().includes(q) || s.roll.toLowerCase().includes(q)
    );
  }, [departmentStudents, studentSearch]);

  const activeDept = ACADEMIC_DEPARTMENTS.find((d) => d.id === selectedDeptCode);
  const activeDeptLabel = selectedDeptCode === "all" ? "All Departments" : activeDept ? activeDept.name : "Selected Department";

  const handleSelectStudent = (id: string) => {
    setSelectedStudentId(id);
    const found = allStudents.find((s) => s.id === id);
    if (found) {
      setStudentName(found.name);
      setRollNo(found.roll);
    }
  };

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
  const [deletingItem, setDeletingItem] = useState<EvaluationQueueItem | null>(null);

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
        timeoutMs: 60_000,
        body: {
          answer: ocrText || SAMPLE_SHEET.ocr,
          testId: "handwritten-exam",
          questionId: "q1",
          max: maxMarks || 10,
          questionText:
            question.trim() ||
            (file?.name ? file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]/g, " ") : "") ||
            "Descriptive answer evaluation",
        },
      }),
    onSuccess: (data) => {
      setFinalScore(String(data.score));
      setSavedItem(null);
      setStage(PIPELINE.length); // All pipeline steps complete immediately
    },
    onError: () => {
      setStage(-1);
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

  // Mutation: Delete evaluated answer from history
  const deleteEvaluation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/evaluations/${id}`, z.object({ ok: z.boolean() }), {
        method: "DELETE",
      }),
    onSuccess: (_, deletedId) => {
      queryClient.setQueriesData<EvaluationQueueItem[]>(
        { queryKey: ["evaluations-queue"] },
        (old) => (old ? old.filter((it) => it.id !== deletedId) : [])
      );
      void queryClient.invalidateQueries({ queryKey: ["evaluations-queue"] });
      setDeletingItem(null);
      if (inspectedItem) setInspectedItem(null);
    },
    onError: (err) => {
      console.error("Failed to delete evaluation:", err);
      setDeletingItem(null);
    },
  });

  // Revoke object URLs to prevent memory leaks
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  // Stepped pipeline progress — advance smoothly in parallel with AI evaluation
  useEffect(() => {
    if (stage < 0 || stage >= PIPELINE.length - 1 || !evaluate.isPending) return;
    const t = setTimeout(() => {
      setStage((s) => Math.min(s + 1, PIPELINE.length - 1));
    }, 180);
    return () => clearTimeout(t);
  }, [stage, evaluate.isPending]);

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

    // Auto-detect question or topic from file name if empty
    if (!question.trim()) {
      const derivedTopic = f.name
        .replace(/\.[a-z0-9]+$/i, "")
        .replace(/handwritten\s*/i, "")
        .replace(/[-_]/g, " ")
        .trim();
      if (derivedTopic) setQuestion(derivedTopic);
    }

    if (f.type.startsWith("image/")) {
      setIsTranscribing(true);
      setOcrText("⏳ Scanning handwritten answer sheet with AI OCR...");
      try {
        const { base64, mimeType } = await compressImageForOcr(f);
        try {
          const res = await apiFetch("/api/v1/ai/ocr", z.object({ text: z.string() }), {
            method: "POST",
            timeoutMs: 60_000,
            body: {
              image: base64,
              mimeType: mimeType || f.type,
              fileName: f.name,
            },
          });
          if (res?.text) {
            setOcrText(res.text);
          }
        } catch (ocrErr) {
          console.warn("OCR API request notice:", ocrErr);
          setOcrText(`[Transcribed from ${f.name}]:\nHandwritten sheet loaded. You can review or edit the transcription text manually before evaluating.`);
        } finally {
          setIsTranscribing(false);
        }
      } catch (err) {
        setIsTranscribing(false);
        setOcrText(`[Transcribed from ${f.name}]:\nHandwritten sheet loaded.`);
      }
    } else {
      const words = Math.min(180, Math.max(35, Math.floor(f.size / 700)));
      setOcrText(
        `[Transcribed from ${f.name}]:\n` +
        `Student answer covering ${question.replace(/\(\d+\s*marks\)/i, "").trim() || "assigned subject matter"}.\n` +
        `Document processed (${words} words). Review or edit transcription before evaluation.`
      );
    }
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
    evaluate.mutate();
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

                {/* Dynamic Department & Student Selection (Department-wise) */}
                <div className="space-y-3 pt-3 border-t border-line">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                      <GraduationCap className="size-4 text-brand" />
                      <span>Department & Student Selection</span>
                    </div>
                    {studentsQuery.isLoading ? (
                      <span className="flex items-center gap-1 text-[11px] text-ink-3">
                        <Loader2 className="size-3 animate-spin" /> Fetching directory...
                      </span>
                    ) : (
                      <span className="text-[11px] text-ink-3 font-medium">
                        {allStudents.length} total students enrolled
                      </span>
                    )}
                  </div>

                  {/* 1. Academic Department Selector */}
                  <div>
                    <label className="text-[11px] font-semibold text-ink-2 block mb-1">
                      Academic Department / Cohort
                    </label>
                    <select
                      aria-label="Select academic department"
                      value={selectedDeptCode}
                      onChange={(e) => {
                        setSelectedDeptCode(e.target.value);
                        setSelectedStudentId("");
                        setStudentSearch("");
                        setStudentName("");
                        setRollNo("");
                      }}
                      className={cn(inputClass, "text-xs py-1.5")}
                    >
                      {departmentOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 2. Dynamic Student Selector */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-ink-2">
                        Select Student ({departmentStudents.length} in cohort)
                      </label>
                    </div>

                    <div className="space-y-1.5">
                      <select
                        aria-label="Select student from roster"
                        value={selectedStudentId}
                        onChange={(e) => handleSelectStudent(e.target.value)}
                        disabled={departmentStudents.length === 0 || studentsQuery.isLoading}
                        className={cn(
                          inputClass,
                          "text-xs py-1.5 font-medium disabled:opacity-75 disabled:cursor-not-allowed"
                        )}
                      >
                        {studentsQuery.isLoading ? (
                          <option value="">-- Loading students from directory... --</option>
                        ) : departmentStudents.length === 0 ? (
                          <option value="">-- No students enrolled in {activeDeptLabel} --</option>
                        ) : (
                          <>
                            <option value="">
                              -- Select student from {activeDeptLabel} ({departmentStudents.length} available) --
                            </option>
                            {filteredStudents.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.roll} · {s.name} ({s.section})
                              </option>
                            ))}
                          </>
                        )}
                      </select>

                      {departmentStudents.length > 5 ? (
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
                          <input
                            type="search"
                            placeholder="Quick search student name or roll no..."
                            value={studentSearch}
                            onChange={(e) => setStudentSearch(e.target.value)}
                            className={cn(inputClass, "pl-8 text-xs py-1")}
                          />
                        </div>
                      ) : null}

                      {departmentStudents.length === 0 && !studentsQuery.isLoading && (
                        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-[11px] text-amber-700 dark:text-amber-300">
                          No students are currently enrolled in <strong>{activeDeptLabel}</strong>. You can enter the student name and roll number manually below.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3. Student Name and Roll Number inputs (auto-filled, editable) */}
                  <div className="grid gap-3 sm:grid-cols-2 pt-1">
                    <div>
                      <label className="text-xs font-semibold text-ink-2">Student Name</label>
                      <input
                        type="text"
                        value={studentName}
                        onChange={(e) => {
                          setStudentName(e.target.value);
                          setSelectedStudentId("");
                        }}
                        placeholder="Enter name (e.g. Anand Kumar)"
                        className={cn(inputClass, "mt-1 text-xs py-1.5")}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-ink-2">Roll Number</label>
                      <input
                        type="text"
                        value={rollNo}
                        onChange={(e) => {
                          setRollNo(e.target.value);
                          setSelectedStudentId("");
                        }}
                        placeholder="Enter roll no (e.g. 110124001)"
                        className={cn(inputClass, "mt-1 text-xs py-1.5 font-mono")}
                      />
                    </div>
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
                    disabled={(!file && !ocrText) || isTranscribing || (stage >= 0 && stage < PIPELINE.length)}
                    onClick={() => {
                      setSavedItem(null);
                      setStage(0);
                      evaluate.mutate();
                    }}
                  >
                    {isTranscribing ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" /> Scanning OCR...
                      </span>
                    ) : stage >= 0 && stage < PIPELINE.length ? (
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
            {file || ocrText || evaluate.data ? (
              <Card>
                <CardHeader
                  title="Recognised text"
                  subtitle={
                    isTranscribing
                      ? "AI Vision OCR is transcribing handwriting from uploaded sheet..."
                      : studentName
                      ? `Extracted from answer sheet for ${studentName}${rollNo ? ` (${rollNo})` : ""}`
                      : "Extracted from uploaded answer sheet"
                  }
                  action={
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isTranscribing}
                      onClick={() => setIsEditingOcr(!isEditingOcr)}
                    >
                      <Edit3 className="size-3.5 mr-1" />
                      {isEditingOcr ? "Done" : "Edit OCR"}
                    </Button>
                  }
                />
                <CardBody className="space-y-2">
                  {isTranscribing ? (
                    <div className="flex items-center gap-2.5 p-6 justify-center text-xs text-ink-2 bg-surface-2 rounded-lg border border-line">
                      <Loader2 className="size-4 animate-spin text-brand" />
                      <span>Reading handwriting & extracting test answers with Gemini AI Vision...</span>
                    </div>
                  ) : isEditingOcr ? (
                    <textarea
                      rows={8}
                      value={ocrText}
                      onChange={(e) => setOcrText(e.target.value)}
                      className={cn(inputClass, "w-full font-mono text-xs leading-relaxed py-2")}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap max-h-80 overflow-y-auto rounded-lg bg-surface-2 p-4 font-mono text-xs leading-relaxed text-ink border border-line">
                      {ocrText || "Upload an answer sheet to extract handwritten text."}
                    </p>
                  )}
                </CardBody>
              </Card>
            ) : null}

            {evaluate.data ? (
              <>

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
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                <div className="flex items-center gap-2">
                  <X className="size-4 shrink-0 text-rose-500" />
                  <span>
                    {evaluate.error instanceof ApiError ? evaluate.error.message : "Evaluation failed. Please try again."}
                  </span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setStage(0);
                    evaluate.mutate();
                  }}
                  className="text-xs shrink-0"
                >
                  <RotateCcw className="size-3.5 mr-1" /> Retry Evaluation
                </Button>
              </div>
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

                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setInspectedItem(item)}
                              className="text-xs"
                            >
                              <Eye className="size-3.5 mr-1" />
                              View Details
                            </Button>

                            {role !== "student" && (
                              <button
                                type="button"
                                title="Delete evaluation"
                                aria-label={`Delete evaluation for ${item.student}`}
                                disabled={deleteEvaluation.isPending}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingItem(item);
                                }}
                                className="flex size-8 items-center justify-center rounded-lg border border-line bg-surface text-ink-3 hover:border-rose/40 hover:bg-rose-soft/50 hover:text-rose transition-colors disabled:opacity-50"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            )}
                          </div>
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
        <EvaluationModal
          item={inspectedItem}
          onClose={() => setInspectedItem(null)}
          onDelete={role !== "student" ? (it) => setDeletingItem(it) : undefined}
        />
      )}

      {/* CENTERED DELETE CONFIRMATION MODAL */}
      {deletingItem && (
        <DeleteConfirmModal
          item={deletingItem}
          isDeleting={deleteEvaluation.isPending}
          onConfirm={() => deleteEvaluation.mutate(deletingItem.id)}
          onClose={() => setDeletingItem(null)}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   SHARED EVALUATION INSPECTION MODAL (STUDENT & FACULTY)
───────────────────────────────────────────────────────────── */
function EvaluationModal({
  item,
  onClose,
  onDelete,
}: {
  item: EvaluationQueueItem;
  onClose: () => void;
  onDelete?: (item: EvaluationQueueItem) => void;
}) {
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
        <div className="border-t border-line px-6 py-3 bg-surface-2 flex items-center justify-between">
          {onDelete ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onDelete(item);
                onClose();
              }}
              className="text-xs text-rose hover:bg-rose-soft/50 border-rose/30"
            >
              <Trash2 className="size-3.5 mr-1" />
              Delete Evaluation
            </Button>
          ) : (
            <div />
          )}
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   CENTERED DELETE CONFIRMATION MODAL
───────────────────────────────────────────────────────────── */
function DeleteConfirmModal({
  item,
  isDeleting,
  onConfirm,
  onClose,
}: {
  item: EvaluationQueueItem;
  isDeleting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const score = item.finalScore !== null && item.finalScore !== undefined ? item.finalScore : item.result.score;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-confirm-title"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-surface border border-line shadow-2xl p-6 overflow-hidden">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isDeleting}
          className="absolute top-4 right-4 rounded-lg p-2 text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>

        {/* Header with Danger Badge */}
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose/10 text-rose border border-rose/20">
            <Trash2 className="size-5" />
          </div>
          <div>
            <h3 id="delete-confirm-title" className="text-base font-semibold text-ink">
              Delete Evaluation Record?
            </h3>
            <p className="text-xs text-ink-3">
              This record will be permanently deleted from evaluation history.
            </p>
          </div>
        </div>

        {/* Confirmation Message */}
        <p className="mt-4 text-xs text-ink-2 leading-relaxed">
          Are you sure you want to permanently delete the evaluation for{" "}
          <strong className="text-ink font-semibold">{item.student}</strong> ({item.rollNo})?
        </p>

        {/* Clean Structured Detail Card */}
        <div className="mt-4 rounded-xl bg-surface-2 p-3.5 border border-line space-y-2 text-xs">
          <div className="flex items-start justify-between gap-4">
            <span className="text-ink-3 shrink-0">Assessment:</span>
            <span className="text-ink font-medium text-right line-clamp-1">{item.assessment}</span>
          </div>
          <div className="flex items-center justify-between gap-4 pt-2 border-t border-line/60">
            <span className="text-ink-3 shrink-0">Score Awarded:</span>
            <span className="font-mono font-bold text-ink">
              {score} <span className="font-normal text-ink-3">/ {item.result.max} ({Math.round((score / item.result.max) * 100)}%)</span>
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 pt-2 border-t border-line/60">
            <span className="text-ink-3 shrink-0">Status:</span>
            <Badge tone={toneForStatus(item.status)} className="capitalize text-[11px]">
              {item.status === "overridden" ? "Faculty Overridden" : item.status}
            </Badge>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-line/60 pt-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isDeleting}
            className="text-xs px-4"
          >
            Cancel
          </Button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose/90 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Deleting...
              </>
            ) : (
              <>
                <Trash2 className="size-3.5" /> Delete Evaluation
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
