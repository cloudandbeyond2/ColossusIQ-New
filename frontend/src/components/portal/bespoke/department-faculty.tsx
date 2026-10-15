"use client";

import { useState, useMemo } from "react";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Filter,
  UserPlus,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  X,
  Users,
  BookOpen,
  TrendingUp,
  Zap,
} from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import type { Role } from "@/lib/auth/roles";
import {
  Button,
  Card,
  Field,
  Spinner,
  inputClass,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { ALL_DEPARTMENTS } from "@/config/streams";

/* ── Types ─────────────────────────────────────────── */

export interface FacultyItem {
  id: string;
  name: string;
  designation: "Professor" | "Associate Professor" | "Assistant Professor";
  department: string;
  email?: string;
  phone?: string;
  load: number;
  development: number;
  ai: "High" | "Medium" | "Starting";
}

const FacultyItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  designation: z.string().transform((v): FacultyItem["designation"] => {
    if (v === "Professor" || v === "Associate Professor" || v === "Assistant Professor") return v;
    return "Assistant Professor";
  }),
  department: z.string().default("CSE"),
  email: z.string().optional(),
  phone: z.string().optional(),
  load: z.number(),
  development: z.number(),
  ai: z.string().transform((v): FacultyItem["ai"] => {
    if (v === "High" || v === "Medium") return v;
    return "Starting";
  }),
});

const FacultyListSchema = z.object({
  faculty: z.array(FacultyItemSchema),
  total: z.number().optional(),
});

/* ── constants ──────────────────────────────────────── */
const DESIGNATIONS = ["Professor", "Associate Professor", "Assistant Professor"] as const;
const AI_LEVELS = ["High", "Medium", "Starting"] as const;

function aiBadgeClass(ai: FacultyItem["ai"]) {
  if (ai === "High")    return "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300";
  if (ai === "Medium")  return "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300";
  return "bg-sky-100 text-sky-700 border border-sky-200 dark:bg-sky-900/30 dark:text-sky-300";
}

function devBarColor(pct: number) {
  if (pct >= 75) return "bg-emerald-500";
  if (pct >= 45) return "bg-amber-400";
  return "bg-rose-400";
}

/* ── Toast ───────────────────────────────────────────── */
function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-[200] flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-xl animate-in slide-in-from-bottom-2",
        ok ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
      )}
    >
      {ok ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertCircle className="size-4 shrink-0" />}
      {msg}
    </div>
  );
}

/* ── Stat Card ───────────────────────────────────────── */
function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <Card className="flex items-center gap-4 p-4">
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", color)}>
        <Icon className="size-[18px] text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-ink-3 truncate">{label}</p>
        <p className="text-xl font-bold text-ink">{value}</p>
      </div>
    </Card>
  );
}

/* ── Modal Shell ─────────────────────────────────────── */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors"
          >
            <X className="size-[18px]" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </Card>
    </div>
  );
}

/* ── Faculty Form ─────────────────────────────────────── */
interface FacultyFormData {
  name: string;
  designation: FacultyItem["designation"];
  department: string;
  email: string;
  phone: string;
  load: number;
  development: number;
  ai: FacultyItem["ai"];
}

const EMPTY_FORM: FacultyFormData = {
  name: "",
  designation: "Assistant Professor",
  department: "Computer Science & Engineering",
  email: "",
  phone: "",
  load: 12,
  development: 50,
  ai: "Starting",
};

function FacultyForm({
  initial = EMPTY_FORM,
  onSubmit,
  submitting,
  submitLabel,
}: {
  initial?: FacultyFormData;
  onSubmit: (data: FacultyFormData) => Promise<void>;
  submitting: boolean;
  submitLabel: string;
}) {
  const [form, setForm] = useState<FacultyFormData>(initial);

  const setStr = (k: keyof FacultyFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));
  const setNum = (k: keyof FacultyFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: Number(e.target.value) }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); void onSubmit(form); }} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full Name *" htmlFor="ff-name">
          <input id="ff-name" className={inputClass} value={form.name} onChange={setStr("name")}
            placeholder="Dr. Jane Smith" required maxLength={120} />
        </Field>
        <Field label="Designation *" htmlFor="ff-desg">
          <select id="ff-desg" className={inputClass} value={form.designation} onChange={setStr("designation")}>
            {DESIGNATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Department *" htmlFor="ff-dept">
          <select id="ff-dept" className={inputClass} value={form.department} onChange={setStr("department")}>
            {ALL_DEPARTMENTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </Field>
        <Field label="Email" htmlFor="ff-email">
          <input id="ff-email" type="email" className={inputClass} value={form.email} onChange={setStr("email")}
            placeholder="faculty@campus.edu" maxLength={120} />
        </Field>
        <Field label="Phone" htmlFor="ff-phone">
          <input id="ff-phone" className={inputClass} value={form.phone} onChange={setStr("phone")}
            placeholder="+91 9876543210" maxLength={20} />
        </Field>
        <Field label="Teaching Load (hrs/wk) *" htmlFor="ff-load">
          <input id="ff-load" type="number" min={1} max={40} className={inputClass}
            value={form.load} onChange={setNum("load")} required />
        </Field>
        <Field label="Skill Development (%)" htmlFor="ff-dev">
          <input id="ff-dev" type="number" min={0} max={100} className={inputClass}
            value={form.development} onChange={setNum("development")} />
        </Field>
        <Field label="AI Adoption Level" htmlFor="ff-ai">
          <select id="ff-ai" className={inputClass} value={form.ai} onChange={setStr("ai")}>
            {AI_LEVELS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </Field>
      </div>
      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={submitting} className="min-w-[140px]">
          {submitting ? <Spinner /> : submitLabel}
        </Button>
      </div>
    </form>
  );
}

/* ── Main Module ──────────────────────────────────────── */
export function DepartmentFacultyModule({ role }: { role: Role }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [designFilter, setDesignFilter] = useState("all");
  const [aiFilter, setAiFilter] = useState("all");

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<FacultyItem | null>(null);
  const [deleting, setDeleting] = useState<FacultyItem | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (search) p.set("q", search);
    if (designFilter !== "all") p.set("designation", designFilter);
    if (aiFilter !== "all") p.set("ai", aiFilter);
    return p.toString();
  }, [search, designFilter, aiFilter]);

  /* ── GET ───────────────────────────────────────────── */
  const { data, isLoading, isError } = useQuery({
    queryKey: ["faculty-list", params],
    queryFn: async () => {
      return await apiFetch(
        `/api/v1/faculty${params ? `?${params}` : ""}`,
        FacultyListSchema
      );
    },
  });

  const faculty = data?.faculty ?? [];
  const total = data?.total ?? faculty.length;

  /* ── POST ──────────────────────────────────────────── */
  const addMutation = useMutation({
    mutationFn: async (body: FacultyFormData) =>
      apiFetch("/api/v1/faculty", z.any(), { method: "POST", body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["faculty-list"] });
      setShowAdd(false);
      showToast("Faculty member added successfully");
    },
    onError: (err: any) => {
      const msg = err?.message || "Failed to add faculty";
      showToast(msg, false);
    },
  });

  /* ── PUT ───────────────────────────────────────────── */
  const editMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: FacultyFormData }) =>
      apiFetch(`/api/v1/faculty/${id}`, z.any(), { method: "PUT", body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["faculty-list"] });
      setEditing(null);
      showToast("Faculty member updated successfully");
    },
    onError: (err: any) => {
      const msg = err?.message || "Failed to update faculty";
      showToast(msg, false);
    },
  });

  /* ── DELETE ─────────────────────────────────────────── */
  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      apiFetch(`/api/v1/faculty/${id}`, z.any(), { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["faculty-list"] });
      setDeleting(null);
      showToast("Faculty member removed");
    },
    onError: (err: any) => {
      const msg = err?.message || "Failed to delete faculty";
      showToast(msg, false);
    },
  });

  const canManage = role === "hod" || role === "institution" || role === "admin";

  /* ── Stats ──────────────────────────────────────────── */
  const avgDev = faculty.length
    ? Math.round(faculty.reduce((a, f) => a + f.development, 0) / faculty.length)
    : 0;
  const avgLoad = faculty.length
    ? Math.round(faculty.reduce((a, f) => a + f.load, 0) / faculty.length)
    : 0;
  const highAi = faculty.filter((f) => f.ai === "High").length;

  return (
    <div className="space-y-6 pb-10">
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={Users}     label="Total Faculty"       value={total}         color="bg-brand" />
        <StatCard icon={BookOpen}  label="Avg. Load (hrs/wk)" value={avgLoad}        color="bg-indigo-500" />
        <StatCard icon={TrendingUp} label="Avg. Skill Dev."   value={`${avgDev}%`}  color="bg-emerald-500" />
        <StatCard icon={Zap}       label="High AI Adoption"   value={highAi}         color="bg-amber-500" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <input
              id="fac-search"
              className={cn(inputClass, "pl-9")}
              placeholder="Search faculty..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="size-4 shrink-0 text-ink-3" />
            <select
              id="fac-design-filter"
              className={cn(inputClass, "min-w-[170px]")}
              value={designFilter}
              onChange={(e) => setDesignFilter(e.target.value)}
            >
              <option value="all">All designations</option>
              {DESIGNATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <select
            id="fac-ai-filter"
            className={cn(inputClass, "min-w-[130px]")}
            value={aiFilter}
            onChange={(e) => setAiFilter(e.target.value)}
          >
            <option value="all">All AI levels</option>
            {AI_LEVELS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        {canManage && (
          <Button id="fac-add-btn" onClick={() => setShowAdd(true)} className="gap-2 shrink-0">
            <UserPlus className="size-4" />
            Add faculty
          </Button>
        )}
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2/70">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-3">Faculty</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-3">Designation</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-3">Teaching Load (hrs/wk)</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-3 min-w-[180px]">Skill Development</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-3">AI Adoption</th>
                {canManage && (
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-3">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={canManage ? 6 : 5} className="py-12 text-center">
                    <Spinner />
                  </td>
                </tr>
              )}
              {isError && (
                <tr>
                  <td colSpan={canManage ? 6 : 5} className="py-12 text-center text-rose-500 text-sm">
                    Failed to load faculty. Please refresh.
                  </td>
                </tr>
              )}
              {!isLoading && !isError && faculty.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 6 : 5} className="py-12 text-center text-ink-3 text-sm">
                    No faculty members found.
                  </td>
                </tr>
              )}
              {faculty.map((f, i) => (
                <tr
                  key={f.id}
                  className={cn(
                    "border-b border-line transition-colors hover:bg-surface-2/50",
                    i % 2 !== 0 && "bg-surface/30"
                  )}
                >
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-brand">{f.name}</div>
                    {f.email && <div className="text-xs text-ink-3 mt-0.5">{f.email}</div>}
                  </td>
                  <td className="px-4 py-3.5 text-ink-2">{f.designation}</td>
                  <td className="px-4 py-3.5 font-semibold text-ink">{f.load}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2 max-w-[110px]">
                        <div
                          className={cn("h-full rounded-full transition-all duration-500", devBarColor(f.development))}
                          style={{ width: `${f.development}%` }}
                        />
                      </div>
                      <span className="w-9 text-right text-xs text-ink-2">{f.development}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", aiBadgeClass(f.ai))}>
                      {f.ai}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          id={`fac-edit-${f.id}`}
                          onClick={() => setEditing(f)}
                          className="rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-brand/10 hover:text-brand"
                          title="Edit"
                        >
                          <Edit3 className="size-[14px]" />
                        </button>
                        <button
                          id={`fac-delete-${f.id}`}
                          onClick={() => setDeleting(f)}
                          className="rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                          title="Delete"
                        >
                          <Trash2 className="size-[14px]" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-line px-5 py-3 text-xs text-ink-3">
          Showing {faculty.length} of {total} faculty member{total !== 1 ? "s" : ""}
        </div>
      </Card>

      {/* Add Modal */}
      {showAdd && (
        <Modal title="Add Faculty Member" onClose={() => setShowAdd(false)}>
          <FacultyForm
            onSubmit={async (data) => { await addMutation.mutateAsync(data); }}
            submitting={addMutation.isPending}
            submitLabel="Add Faculty"
          />
        </Modal>
      )}

      {/* Edit Modal */}
      {editing && (
        <Modal title="Edit Faculty Member" onClose={() => setEditing(null)}>
          <FacultyForm
            initial={{
              name: editing.name,
              designation: editing.designation,
              department: editing.department,
              email: editing.email ?? "",
              phone: editing.phone ?? "",
              load: editing.load,
              development: editing.development,
              ai: editing.ai,
            }}
            onSubmit={async (data) => { await editMutation.mutateAsync({ id: editing.id, body: data }); }}
            submitting={editMutation.isPending}
            submitLabel="Save Changes"
          />
        </Modal>
      )}

      {/* Delete Confirm Modal */}
      {deleting && (
        <Modal title="Remove Faculty Member" onClose={() => setDeleting(null)}>
          <p className="mb-6 text-sm text-ink-2">
            Are you sure you want to remove <strong className="text-ink">{deleting.name}</strong> from the faculty
            directory? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={deleteMutation.isPending}
              onClick={() => void deleteMutation.mutateAsync(deleting.id)}
            >
              {deleteMutation.isPending ? <Spinner /> : "Remove Faculty"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
