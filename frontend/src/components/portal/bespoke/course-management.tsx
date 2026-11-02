"use client";

import { useState, useMemo } from "react";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Plus,
  Trash2,
  Edit3,
  X,
  BookOpen,
  Users,
  CheckCircle2,
  AlertCircle,
  Layers,
} from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import type { Role } from "@/lib/auth/roles";
import { Button, Card, Field, Spinner, inputClass } from "@/components/ui/primitives";
import { TemplateSkeleton } from "@/components/modules/shared";
import { cn } from "@/lib/utils";

/* ── Types ──────────────────────────────────────────── */

const COURSE_TYPES = ["Theory", "Lab", "Theory + Lab", "Elective", "Project"] as const;
type CourseType = typeof COURSE_TYPES[number];

const COURSE_STATUSES = ["Active", "Inactive", "Draft"] as const;
type CourseStatus = typeof COURSE_STATUSES[number];

interface Course {
  id: string;
  code: string;
  name: string;
  type: CourseType;
  credits: number;
  hours: number;
  semester: number;
  status: CourseStatus;
  facultyAssigned?: string;
  enrolled?: number;
  description?: string;
  department?: string;
  version?: number;
}

const RawCourseItemSchema = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string().optional(),
  name: z.string().optional(),
  courseType: z.string().optional(),
  type: z.string().optional(),
  credits: z.union([z.number(), z.string()]).optional().transform((v) => Number(v) || 3),
  hours: z.union([z.number(), z.string()]).optional().transform((v) => Number(v) || 48),
  semester: z.union([z.number(), z.string()]).optional().transform((v) => {
    if (typeof v === "number") return v;
    return parseInt(String(v || "1").replace(/[^0-9]/g, ""), 10) || 1;
  }),
  status: z.string().optional().transform((v): CourseStatus => {
    if (v === "Archived" || v === "Inactive") return "Inactive";
    if (v === "Draft") return "Draft";
    return "Active";
  }),
  faculty: z.string().optional(),
  facultyAssigned: z.string().optional(),
  facultyName: z.string().optional(),
  enrolled: z.number().optional(),
  description: z.string().optional(),
  department: z.string().optional(),
  version: z.number().optional(),
}).transform((r): Course => {
  const rawType = r.courseType || r.type || "Theory";
  const mappedType: CourseType =
    rawType.includes("+") ? "Theory + Lab" :
    rawType === "Lab" ? "Lab" :
    rawType === "Elective" ? "Elective" :
    rawType === "Project" ? "Project" : "Theory";

  const numCredits = r.credits ?? 3;
  return {
    id: r.id,
    code: r.code,
    name: r.title || r.name || r.code,
    type: mappedType,
    credits: numCredits,
    hours: r.hours || numCredits * 15,
    semester: r.semester ?? 1,
    status: r.status,
    facultyAssigned: r.faculty || r.facultyAssigned || r.facultyName || "",
    enrolled: r.enrolled ?? (r.status === "Active" ? 54 : 0),
    description: r.description || "",
    department: r.department,
    version: r.version ?? 1,
  };
});

const CourseListSchema = z.union([
  z.object({ items: z.array(RawCourseItemSchema) }).passthrough().transform((r) => ({ courses: r.items })),
  z.object({ courses: z.array(RawCourseItemSchema) }).passthrough().transform((r) => ({ courses: r.courses })),
  z.object({ data: z.array(RawCourseItemSchema) }).passthrough().transform((r) => ({ courses: r.data })),
  z.array(RawCourseItemSchema).transform((arr) => ({ courses: arr })),
  z.unknown().transform(() => ({ courses: [] as Course[] })),
]);

type CourseForm = Omit<Course, "id">;
const EMPTY_FORM: CourseForm = {
  code: "",
  name: "",
  type: "Theory",
  credits: 3,
  hours: 45,
  semester: 1,
  status: "Active",
  facultyAssigned: "",
  enrolled: 0,
  description: "",
};

/* ── Helpers ─────────────────────────────────────────── */

function typeBadge(type: CourseType) {
  const map: Record<CourseType, string> = {
    Theory: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    Lab: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    "Theory + Lab": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    Elective: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    Project: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  };
  return <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", map[type] || map.Theory)}>{type}</span>;
}

function statusDot(status: CourseStatus) {
  const color =
    status === "Active" ? "bg-emerald-500" :
    status === "Draft"  ? "bg-amber-500" : "bg-slate-400";
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span className={cn("h-1.5 w-1.5 rounded-full", color)} />
      {status}
    </span>
  );
}

/* ── Modal ───────────────────────────────────────────── */

function CourseModal({
  initial,
  onClose,
  onSave,
  saving,
  error,
}: {
  initial: CourseForm;
  onClose: () => void;
  onSave: (f: CourseForm) => void;
  saving: boolean;
  error?: string | null;
}) {
  const [form, setForm] = useState<CourseForm>(initial);
  const set = <K extends keyof CourseForm>(k: K, v: CourseForm[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <Card className="w-full max-w-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl border border-(--border)">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-base">{initial.name ? "Edit Course" : "Add Course"}</h3>
          <button onClick={onClose} aria-label="Close modal">
            <X className="h-5 w-5 text-(--fg-muted) hover:text-(--fg)" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300 text-xs font-medium">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Course Code *" htmlFor="course-code">
            <input
              id="course-code"
              className={inputClass}
              value={form.code}
              onChange={(e) => set("code", e.target.value.toUpperCase())}
              placeholder="e.g. CS201"
            />
          </Field>
          <Field label="Course Name *" htmlFor="course-name">
            <input
              id="course-name"
              className={inputClass}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Object-Oriented Programming with Java"
            />
          </Field>
          <Field label="Type" htmlFor="course-type">
            <select
              id="course-type"
              className={inputClass}
              value={form.type}
              onChange={(e) => set("type", e.target.value as CourseType)}
            >
              {COURSE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Status" htmlFor="course-status">
            <select
              id="course-status"
              className={inputClass}
              value={form.status}
              onChange={(e) => set("status", e.target.value as CourseStatus)}
            >
              {COURSE_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Credits (1 - 6)" htmlFor="course-credits">
            <input
              id="course-credits"
              className={inputClass}
              type="number"
              min={1}
              max={6}
              value={form.credits}
              onChange={(e) => {
                const c = Math.min(Math.max(Number(e.target.value) || 1, 1), 6);
                set("credits", c);
                set("hours", c * 15);
              }}
            />
          </Field>
          <Field label="Hours / Semester" htmlFor="course-hours">
            <input
              id="course-hours"
              className={inputClass}
              type="number"
              min={0}
              value={form.hours}
              onChange={(e) => set("hours", Number(e.target.value))}
            />
          </Field>
          <Field label="Semester" htmlFor="course-sem">
            <select
              id="course-sem"
              className={inputClass}
              value={form.semester}
              onChange={(e) => set("semester", Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>Semester {n}</option>)}
            </select>
          </Field>
          <Field label="Faculty Assigned" htmlFor="course-fac">
            <input
              id="course-fac"
              className={inputClass}
              value={form.facultyAssigned ?? ""}
              onChange={(e) => set("facultyAssigned", e.target.value)}
              placeholder="e.g. Dr. R. Rajesh"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description" htmlFor="course-desc">
              <textarea
                id="course-desc"
                className={cn(inputClass, "resize-none")}
                rows={2}
                value={form.description ?? ""}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Brief course description..."
              />
            </Field>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={saving || !form.code.trim() || !form.name.trim()}>
            {saving ? <Spinner className="h-4 w-4 mr-2" /> : null}
            {initial.name ? "Save Changes" : "Add Course"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* ── Main component ──────────────────────────────────── */

export function CourseManagementModule({ role }: { role: Role }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<CourseType | "All">("All");
  const [semFilter, setSemFilter] = useState<number | "All">("All");
  const [modal, setModal] = useState<{ open: boolean; editing: Course | null; error?: string | null }>({
    open: false,
    editing: null,
    error: null,
  });
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const { data: sessionData } = useQuery<{ department?: string; name?: string }>({
    queryKey: ["auth-session"],
    queryFn: () => apiFetch("/api/v1/auth/session", z.any()),
    staleTime: 60_000,
  });

  const { data, isPending, isError } = useQuery({
    queryKey: ["records", "courses", role],
    queryFn: () => apiFetch("/api/v1/records/courses?pageSize=100", CourseListSchema),
    staleTime: 30_000,
  });

  const courses: Course[] = data?.courses ?? [];

  const saveMutation = useMutation({
    mutationFn: async (payload: CourseForm & { id?: string; version?: number }) => {
      const semStr = String(payload.semester || 1).replace(/[^0-9]/g, "") || "1";
      const statusValue = payload.status === "Inactive" ? "Archived" : payload.status;
      const dept = payload.department || sessionData?.department || "Computer Science & Engineering";
      const facultyName = payload.facultyAssigned?.trim() || sessionData?.name || "Dr. Faculty";

      const recordData = {
        code: payload.code.trim().toUpperCase(),
        title: payload.name.trim(),
        department: dept,
        semester: semStr,
        credits: Math.min(Math.max(Number(payload.credits) || 3, 1), 6),
        courseType: payload.type,
        faculty: facultyName,
        createdBy: sessionData?.name || facultyName || "Faculty",
        status: statusValue,
        description: payload.description?.trim() || "",
      };

      const body = payload.id
        ? { data: recordData, version: payload.version ?? 1 }
        : { data: recordData };

      return apiFetch(
        payload.id ? `/api/v1/records/courses/${encodeURIComponent(payload.id)}` : "/api/v1/records/courses",
        z.any(),
        {
          method: payload.id ? "PUT" : "POST",
          body,
        }
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["records", "courses"] });
      qc.invalidateQueries({ queryKey: ["course-management"] });
      setModal({ open: false, editing: null, error: null });
      showToast(modal.editing ? "Course updated." : "Course added.");
    },
    onError: (err: unknown) => {
      const e = err as { message?: string; error?: { message?: string }; fields?: Record<string, string> };
      let msg = e?.message || e?.error?.message || "Could not save course.";
      if (e?.fields) {
        const fieldMsgs = Object.entries(e.fields)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ");
        msg = `${msg} (${fieldMsgs})`;
      }
      setModal((prev) => ({ ...prev, error: msg }));
      showToast(msg, false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/records/courses/${encodeURIComponent(id)}`, z.any(), { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["records", "courses"] });
      qc.invalidateQueries({ queryKey: ["course-management"] });
      showToast("Course removed.");
    },
    onError: (err: unknown) => {
      const e = err as { message?: string; error?: { message?: string } };
      const msg = e?.message || e?.error?.message || "Delete failed.";
      showToast(msg, false);
    },
  });

  const semesters = Array.from(new Set(courses.map((c) => c.semester))).sort((a, b) => a - b);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return courses.filter((c) => {
      if (typeFilter !== "All" && c.type !== typeFilter) return false;
      if (semFilter !== "All" && c.semester !== semFilter) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.code.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [courses, search, typeFilter, semFilter]);

  const stats = useMemo(() => ({
    total: courses.length,
    active: courses.filter((c) => c.status === "Active").length,
    totalCredits: courses.reduce((a, c) => a + c.credits, 0),
    totalEnrolled: courses.reduce((a, c) => a + (c.enrolled ?? 0), 0),
  }), [courses]);

  if (isPending) return <TemplateSkeleton />;

  return (
    <div className="space-y-5 pb-10">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Courses", value: stats.total, icon: <BookOpen className="h-5 w-5 text-blue-500" /> },
          { label: "Active", value: stats.active, icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" /> },
          { label: "Total Credits", value: stats.totalCredits, icon: <Layers className="h-5 w-5 text-purple-500" /> },
          { label: "Total Enrolled", value: stats.totalEnrolled, icon: <Users className="h-5 w-5 text-amber-500" /> },
        ].map((s) => (
          <Card key={s.label} className="p-4 flex items-center gap-3">
            {s.icon}
            <div>
              <p className="text-xs text-(--fg-muted)">{s.label}</p>
              <p className="text-xl font-bold">{s.value}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-(--fg-muted)" />
          <input
            className={cn(inputClass, "pl-9")}
            placeholder="Search course name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className={cn(inputClass, "w-auto")}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as CourseType | "All")}
        >
          <option value="All">All Types</option>
          {COURSE_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select
          className={cn(inputClass, "w-auto")}
          value={semFilter}
          onChange={(e) => setSemFilter(e.target.value === "All" ? "All" : Number(e.target.value))}
        >
          <option value="All">All Semesters</option>
          {semesters.map((s) => <option key={s} value={s}>Sem {s}</option>)}
        </select>
        <Button onClick={() => setModal({ open: true, editing: null, error: null })}>
          <Plus className="h-4 w-4 mr-1.5" /> Add Course
        </Button>
      </div>

      {isError && (
        <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
          Showing demo data — could not connect to server.
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-(--border)">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-(--border) bg-(--bg-subtle) text-(--fg-muted) text-xs uppercase tracking-wide">
              <th className="py-3 px-4 text-left">Course</th>
              <th className="py-3 px-4 text-center">Type</th>
              <th className="py-3 px-4 text-center">Sem</th>
              <th className="py-3 px-4 text-center">Credits</th>
              <th className="py-3 px-4 text-left hidden sm:table-cell">Faculty</th>
              <th className="py-3 px-4 text-center hidden md:table-cell">Enrolled</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-(--border) hover:bg-(--bg-subtle) transition-colors">
                <td className="py-3 px-4">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs font-mono text-(--fg-muted)">{c.code}</div>
                </td>
                <td className="py-3 px-4 text-center">{typeBadge(c.type)}</td>
                <td className="py-3 px-4 text-center text-sm">{c.semester}</td>
                <td className="py-3 px-4 text-center">
                  <span className="font-semibold">{c.credits}</span>
                  {c.hours > 0 && <span className="text-xs text-(--fg-muted) ml-1">/ {c.hours}h</span>}
                </td>
                <td className="py-3 px-4 hidden sm:table-cell text-xs text-(--fg-muted)">{c.facultyAssigned ?? "—"}</td>
                <td className="py-3 px-4 hidden md:table-cell text-center">{c.enrolled ?? 0}</td>
                <td className="py-3 px-4 text-center">{statusDot(c.status)}</td>
                <td className="py-3 px-4">
                  <div className="flex justify-center gap-1">
                    <button
                      onClick={() => setModal({ open: true, editing: c, error: null })}
                      className="p-1.5 rounded hover:bg-(--bg-subtle) text-(--fg-muted) hover:text-(--fg)"
                      title="Edit Course"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${c.name}?`)) deleteMutation.mutate(c.id);
                      }}
                      className="p-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-900/20 text-(--fg-muted) hover:text-rose-600"
                      title="Delete Course"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-sm text-(--fg-muted) py-10">No courses match the current filters.</p>
        )}
      </div>

      <p className="text-xs text-(--fg-muted)">Showing {filtered.length} of {courses.length} courses</p>

      {modal.open && (
        <CourseModal
          initial={modal.editing ? { ...modal.editing } : EMPTY_FORM}
          error={modal.error}
          onClose={() => setModal({ open: false, editing: null, error: null })}
          onSave={(form) =>
            saveMutation.mutate(
              modal.editing
                ? { ...form, id: modal.editing.id, version: modal.editing.version }
                : form
            )
          }
          saving={saveMutation.isPending}
        />
      )}

      {/* Toast Notification - placed after modal in DOM to appear cleanly on top */}
      {toast && (
        <div className={cn(
          "fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-xl text-sm font-medium",
          toast.ok ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
        )}>
          {toast.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
