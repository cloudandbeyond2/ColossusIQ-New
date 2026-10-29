"use client";

import { useState, useMemo } from "react";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  UserPlus,
  Trash2,
  Edit3,
  X,
  Users,
  Shield,
  Phone,
  Mail,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import type { Role } from "@/lib/auth/roles";
import { Button, Card, Field, Spinner, inputClass } from "@/components/ui/primitives";
import { TemplateSkeleton } from "@/components/modules/shared";
import { LoadError } from "@/components/ui/load-error";
import { cn } from "@/lib/utils";

/* ── Types ──────────────────────────────────────────── */

const STAFF_ROLES = [
  "HOD", "Faculty", "Lab Assistant", "Admin Staff",
  "Librarian", "Counselor", "Placement Officer", "Other",
] as const;
type StaffRole = typeof STAFF_ROLES[number];

const STAFF_STATUSES = ["Active", "On Leave", "Inactive"] as const;
type StaffStatus = typeof STAFF_STATUSES[number];

interface StaffMember {
  id: string;
  name: string;
  staffId: string;
  role: StaffRole;
  department: string;
  email?: string;
  phone?: string;
  status: StaffStatus;
  joinedDate?: string;
  qualifications?: string;
}

const StaffMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  staffId: z.string().default(""),
  role: z.string().transform((v): StaffRole =>
    STAFF_ROLES.includes(v as StaffRole) ? (v as StaffRole) : "Other"
  ),
  department: z.string().default(""),
  email: z.string().optional(),
  phone: z.string().optional(),
  status: z.string().transform((v): StaffStatus =>
    STAFF_STATUSES.includes(v as StaffStatus) ? (v as StaffStatus) : "Active"
  ),
  joinedDate: z.string().optional(),
  qualifications: z.string().optional(),
});

const StaffListSchema = z.union([
  z.object({ staff: z.array(StaffMemberSchema), total: z.number().optional() }).passthrough().transform((r) => ({ staff: r.staff, total: r.total ?? r.staff.length })),
  z.object({ data: z.array(StaffMemberSchema) }).passthrough().transform((r) => ({ staff: r.data, total: r.data.length })),
  z.array(StaffMemberSchema).transform((arr) => ({ staff: arr, total: arr.length })),
  z.unknown().transform(() => ({ staff: [] as StaffMember[], total: 0 })),
]);

type StaffForm = Omit<StaffMember, "id">;

const EMPTY_FORM: StaffForm = {
  name: "", staffId: "", role: "Faculty", department: "",
  email: "", phone: "", status: "Active", joinedDate: "", qualifications: "",
};

/* ── Demo data ───────────────────────────────────────── */

const DEMO_STAFF: StaffMember[] = [
  { id: "1", name: "Dr. Meena Rajesh", staffId: "STF001", role: "HOD", department: "CSE", email: "meena@college.edu", phone: "9876543210", status: "Active", joinedDate: "2018-06-01", qualifications: "PhD Computer Science" },
  { id: "2", name: "Prof. Kiran Suresh", staffId: "STF002", role: "Faculty", department: "CSE", email: "kiran@college.edu", phone: "9876543211", status: "Active", joinedDate: "2020-07-15", qualifications: "M.Tech CSE" },
  { id: "3", name: "Ms. Priya Thangam", staffId: "STF003", role: "Faculty", department: "CSE", email: "priya@college.edu", status: "On Leave", joinedDate: "2021-08-01", qualifications: "M.Sc CS" },
  { id: "4", name: "Mr. Anand Velmurugan", staffId: "STF004", role: "Lab Assistant", department: "CSE", phone: "9876543213", status: "Active", joinedDate: "2019-01-10" },
  { id: "5", name: "Ms. Lakshmi Devi", staffId: "STF005", role: "Admin Staff", department: "CSE", email: "lakshmi@college.edu", status: "Active", joinedDate: "2017-03-20" },
];

/* ── Helpers ─────────────────────────────────────────── */

function statusBadge(status: StaffStatus) {
  const cls =
    status === "Active"   ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" :
    status === "On Leave" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" :
    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
  return <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", cls)}>{status}</span>;
}

function roleBadge(role: StaffRole) {
  const cls =
    role === "HOD"      ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" :
    role === "Faculty"  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" :
    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
  return <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", cls)}>{role}</span>;
}

/* ── Modal ───────────────────────────────────────────── */

function StaffModal({
  initial,
  onClose,
  onSave,
  saving,
}: {
  initial: StaffForm;
  onClose: () => void;
  onSave: (f: StaffForm) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<StaffForm>(initial);
  const set = (k: keyof StaffForm, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <Card className="w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-base">{initial.name ? "Edit Staff Member" : "Add Staff Member"}</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-[var(--fg-muted)]" /></button>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Full Name *" htmlFor="staff-name">
            <input id="staff-name" className={inputClass} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Dr. Name" />
          </Field>
          <Field label="Staff ID *" htmlFor="staff-id">
            <input id="staff-id" className={inputClass} value={form.staffId} onChange={(e) => set("staffId", e.target.value)} placeholder="STF001" />
          </Field>
          <Field label="Role *" htmlFor="staff-role">
            <select id="staff-role" className={inputClass} value={form.role} onChange={(e) => set("role", e.target.value)}>
              {STAFF_ROLES.map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Department" htmlFor="staff-dept">
            <input id="staff-dept" className={inputClass} value={form.department} onChange={(e) => set("department", e.target.value)} placeholder="CSE" />
          </Field>
          <Field label="Email" htmlFor="staff-email">
            <input id="staff-email" className={inputClass} type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} placeholder="staff@college.edu" />
          </Field>
          <Field label="Phone" htmlFor="staff-phone">
            <input id="staff-phone" className={inputClass} value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="9876543210" />
          </Field>
          <Field label="Status" htmlFor="staff-status">
            <select id="staff-status" className={inputClass} value={form.status} onChange={(e) => set("status", e.target.value)}>
              {STAFF_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Date Joined" htmlFor="staff-joined">
            <input id="staff-joined" className={inputClass} type="date" value={form.joinedDate ?? ""} onChange={(e) => set("joinedDate", e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Qualifications" htmlFor="staff-qual">
              <input id="staff-qual" className={inputClass} value={form.qualifications ?? ""} onChange={(e) => set("qualifications", e.target.value)} placeholder="PhD, M.Tech..." />
            </Field>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={saving || !form.name.trim() || !form.staffId.trim()}>
            {saving ? <Spinner className="h-4 w-4 mr-2" /> : null}
            {initial.name ? "Save Changes" : "Add Member"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* ── Main component ──────────────────────────────────── */

export function StaffModule({ role }: { role: Role }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<StaffRole | "All">("All");
  const [statusFilter, setStatusFilter] = useState<StaffStatus | "All">("All");
  const [modal, setModal] = useState<{ open: boolean; editing: StaffMember | null }>({ open: false, editing: null });
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const { data, isPending, isError } = useQuery({
    queryKey: ["staff", role],
    queryFn: () => apiFetch("/api/v1/modules/staff", StaffListSchema as any),
    staleTime: 60_000,
  });

  const staff: StaffMember[] = (data as any)?.staff ?? DEMO_STAFF;

  const saveMutation = useMutation({
    mutationFn: (payload: StaffForm & { id?: string }) =>
      apiFetch(payload.id ? `/api/v1/modules/staff/${payload.id}` : "/api/v1/modules/staff", z.any(), {
        method: payload.id ? "PUT" : "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
      setModal({ open: false, editing: null });
      showToast(modal.editing ? "Staff member updated." : "Staff member added.");
    },
    onError: () => showToast("Could not save. Please try again.", false),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/modules/staff/${id}`, z.any(), { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
      showToast("Staff member removed.");
    },
    onError: () => showToast("Delete failed.", false),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return staff.filter((s) => {
      if (roleFilter !== "All" && s.role !== roleFilter) return false;
      if (statusFilter !== "All" && s.status !== statusFilter) return false;
      if (q && !s.name.toLowerCase().includes(q) && !s.staffId.toLowerCase().includes(q) && !s.department.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [staff, search, roleFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: staff.length,
    active: staff.filter((s) => s.status === "Active").length,
    onLeave: staff.filter((s) => s.status === "On Leave").length,
  }), [staff]);

  if (isPending) return <TemplateSkeleton />;

  return (
    <div className="space-y-5 pb-10">
      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium",
          toast.ok ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
        )}>
          {toast.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Staff", value: stats.total, icon: <Users className="h-5 w-5 text-blue-500" /> },
          { label: "Active", value: stats.active, icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" /> },
          { label: "On Leave", value: stats.onLeave, icon: <Shield className="h-5 w-5 text-amber-500" /> },
        ].map((s) => (
          <Card key={s.label} className="p-4 flex items-center gap-3">
            {s.icon}
            <div>
              <p className="text-xs text-[var(--fg-muted)]">{s.label}</p>
              <p className="text-xl font-bold">{s.value}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]" />
          <input
            className={cn(inputClass, "pl-9")}
            placeholder="Search by name, ID, department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className={cn(inputClass, "w-auto")} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as any)}>
          <option value="All">All Roles</option>
          {STAFF_ROLES.map((r) => <option key={r}>{r}</option>)}
        </select>
        <select className={cn(inputClass, "w-auto")} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
          <option value="All">All Status</option>
          {STAFF_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <Button onClick={() => setModal({ open: true, editing: null })}>
          <UserPlus className="h-4 w-4 mr-1.5" /> Add Staff
        </Button>
      </div>

      {isError && (
        <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
          Showing demo data — could not connect to server.
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--fg-muted)] text-xs uppercase tracking-wide">
              <th className="py-3 px-4 text-left">Member</th>
              <th className="py-3 px-4 text-left">Role</th>
              <th className="py-3 px-4 text-left hidden sm:table-cell">Contact</th>
              <th className="py-3 px-4 text-left hidden md:table-cell">Qualifications</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-subtle)] transition-colors">
                <td className="py-3 px-4">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-[var(--fg-muted)]">{s.staffId}{s.department ? ` · ${s.department}` : ""}</div>
                </td>
                <td className="py-3 px-4">{roleBadge(s.role)}</td>
                <td className="py-3 px-4 hidden sm:table-cell">
                  <div className="space-y-0.5">
                    {s.email && (
                      <div className="flex items-center gap-1 text-xs text-[var(--fg-muted)]">
                        <Mail className="h-3 w-3" /> {s.email}
                      </div>
                    )}
                    {s.phone && (
                      <div className="flex items-center gap-1 text-xs text-[var(--fg-muted)]">
                        <Phone className="h-3 w-3" /> {s.phone}
                      </div>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4 hidden md:table-cell text-xs text-[var(--fg-muted)]">{s.qualifications ?? "—"}</td>
                <td className="py-3 px-4 text-center">{statusBadge(s.status)}</td>
                <td className="py-3 px-4">
                  <div className="flex justify-center gap-1">
                    <button
                      onClick={() => setModal({ open: true, editing: s })}
                      className="p-1.5 rounded hover:bg-[var(--bg-subtle)] text-[var(--fg-muted)] hover:text-[var(--fg)]"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => { if (confirm(`Remove ${s.name}?`)) deleteMutation.mutate(s.id); }}
                      className="p-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-900/20 text-[var(--fg-muted)] hover:text-rose-600"
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
          <p className="text-center text-sm text-[var(--fg-muted)] py-10">No staff members match the current filters.</p>
        )}
      </div>

      <p className="text-xs text-[var(--fg-muted)]">Showing {filtered.length} of {staff.length} staff members</p>

      {/* Modal */}
      {modal.open && (
        <StaffModal
          initial={modal.editing ? { ...modal.editing } : EMPTY_FORM}
          onClose={() => setModal({ open: false, editing: null })}
          onSave={(form) => saveMutation.mutate(modal.editing ? { ...form, id: modal.editing.id } : form)}
          saving={saveMutation.isPending}
        />
      )}
    </div>
  );
}
