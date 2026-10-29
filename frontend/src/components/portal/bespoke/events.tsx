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
  Calendar,
  MapPin,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  Tag,
  CalendarDays,
} from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import type { Role } from "@/lib/auth/roles";
import { Button, Card, Field, Spinner, inputClass } from "@/components/ui/primitives";
import { TemplateSkeleton } from "@/components/modules/shared";
import { cn } from "@/lib/utils";

/* ── Types ──────────────────────────────────────────── */

const EVENT_TYPES = ["Academic", "Cultural", "Sports", "Workshop", "Seminar", "Exam", "Holiday", "Other"] as const;
type EventType = typeof EVENT_TYPES[number];

const EVENT_STATUSES = ["Upcoming", "Ongoing", "Completed", "Cancelled"] as const;
type EventStatus = typeof EVENT_STATUSES[number];

interface CalEvent {
  id: string;
  title: string;
  type: EventType;
  status: EventStatus;
  date: string;
  endDate?: string;
  time?: string;
  venue?: string;
  organizer?: string;
  capacity?: number;
  registered?: number;
  description?: string;
}

const EventSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.string().transform((v): EventType =>
    EVENT_TYPES.includes(v as EventType) ? (v as EventType) : "Other"
  ),
  status: z.string().transform((v): EventStatus =>
    EVENT_STATUSES.includes(v as EventStatus) ? (v as EventStatus) : "Upcoming"
  ),
  date: z.string(),
  endDate: z.string().optional(),
  time: z.string().optional(),
  venue: z.string().optional(),
  organizer: z.string().optional(),
  capacity: z.number().optional(),
  registered: z.number().optional(),
  description: z.string().optional(),
});

const EventListSchema = z.union([
  z.object({ events: z.array(EventSchema) }).passthrough().transform((r) => ({ events: r.events })),
  z.object({ data: z.array(EventSchema) }).passthrough().transform((r) => ({ events: r.data })),
  z.array(EventSchema).transform((arr) => ({ events: arr })),
  z.unknown().transform(() => ({ events: [] as CalEvent[] })),
]);

type EventForm = Omit<CalEvent, "id">;
const EMPTY_FORM: EventForm = {
  title: "", type: "Academic", status: "Upcoming", date: "",
  endDate: "", time: "", venue: "", organizer: "", capacity: 0, description: "",
};

/* ── Demo data ───────────────────────────────────────── */

const TODAY = new Date().toISOString().split("T")[0];
const DEMO: CalEvent[] = [
  { id: "1", title: "End Semester Examination", type: "Exam", status: "Upcoming", date: "2026-11-10", endDate: "2026-11-25", time: "09:00", venue: "Main Examination Hall", organizer: "Controller of Exams", capacity: 300, registered: 240, description: "End semester exams for all departments." },
  { id: "2", title: "Tech Symposium 2026", type: "Academic", status: "Upcoming", date: "2026-11-05", time: "10:00", venue: "Auditorium", organizer: "CSE Department", capacity: 500, registered: 320 },
  { id: "3", title: "Annual Sports Meet", type: "Sports", status: "Upcoming", date: "2026-10-30", endDate: "2026-10-31", time: "08:00", venue: "Sports Ground", organizer: "Physical Education Dept", capacity: 600, registered: 580 },
  { id: "4", title: "AI Workshop - Basics to Production", type: "Workshop", status: "Completed", date: "2026-10-15", time: "10:00", venue: "Lab 3, Block B", organizer: "Dr. Anand V.", capacity: 60, registered: 60 },
  { id: "5", title: "Diwali Holiday", type: "Holiday", status: "Completed", date: "2026-10-20", endDate: "2026-10-22", organizer: "Administration" },
  { id: "6", title: "Placement Drive - TCS", type: "Academic", status: "Upcoming", date: "2026-11-08", time: "09:00", venue: "Seminar Hall", organizer: "Placement Cell", capacity: 120, registered: 95 },
];

/* ── Helpers ─────────────────────────────────────────── */

function typeBadge(type: EventType) {
  const map: Record<EventType, string> = {
    Academic:  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    Cultural:  "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
    Sports:    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    Workshop:  "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    Seminar:   "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
    Exam:      "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
    Holiday:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    Other:     "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  };
  return <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", map[type])}>{type}</span>;
}

function statusBadge(status: EventStatus) {
  const map: Record<EventStatus, string> = {
    Upcoming:  "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
    Ongoing:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    Completed: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    Cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  };
  return <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", map[status])}>{status}</span>;
}

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch { return d; }
}

function regBar(registered: number, capacity: number) {
  if (!capacity) return null;
  const pct = Math.min((registered / capacity) * 100, 100);
  const color = pct >= 90 ? "bg-rose-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-[var(--fg-muted)] shrink-0">{registered}/{capacity}</span>
    </div>
  );
}

/* ── Modal ───────────────────────────────────────────── */

function EventModal({ initial, onClose, onSave, saving }: {
  initial: EventForm; onClose: () => void; onSave: (f: EventForm) => void; saving: boolean;
}) {
  const [form, setForm] = useState<EventForm>(initial);
  const set = <K extends keyof EventForm>(k: K, v: EventForm[K]) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <Card className="w-full max-w-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-base">{initial.title ? "Edit Event" : "Create Event"}</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-[var(--fg-muted)]" /></button>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Event Title *" className="sm:col-span-2">
            <input className={inputClass} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Annual Tech Symposium" />
          </Field>
          <Field label="Type">
            <select className={inputClass} value={form.type} onChange={(e) => set("type", e.target.value as EventType)}>
              {EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select className={inputClass} value={form.status} onChange={(e) => set("status", e.target.value as EventStatus)}>
              {EVENT_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Start Date *">
            <input className={inputClass} type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
          </Field>
          <Field label="End Date">
            <input className={inputClass} type="date" value={form.endDate ?? ""} onChange={(e) => set("endDate", e.target.value)} />
          </Field>
          <Field label="Time">
            <input className={inputClass} type="time" value={form.time ?? ""} onChange={(e) => set("time", e.target.value)} />
          </Field>
          <Field label="Venue">
            <input className={inputClass} value={form.venue ?? ""} onChange={(e) => set("venue", e.target.value)} placeholder="Auditorium, Hall A..." />
          </Field>
          <Field label="Organizer">
            <input className={inputClass} value={form.organizer ?? ""} onChange={(e) => set("organizer", e.target.value)} placeholder="Department / Faculty" />
          </Field>
          <Field label="Capacity">
            <input className={inputClass} type="number" min={0} value={form.capacity ?? 0} onChange={(e) => set("capacity", Number(e.target.value))} />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <textarea className={cn(inputClass, "resize-none")} rows={2} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} placeholder="Brief event description..." />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={saving || !form.title.trim() || !form.date}>
            {saving ? <Spinner className="h-4 w-4 mr-2" /> : null}
            {initial.title ? "Save Changes" : "Create Event"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* ── Main component ──────────────────────────────────── */

export function EventsModule({ role }: { role: Role }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<EventType | "All">("All");
  const [statusFilter, setStatusFilter] = useState<EventStatus | "All">("All");
  const [modal, setModal] = useState<{ open: boolean; editing: CalEvent | null }>({ open: false, editing: null });
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [view, setView] = useState<"list" | "grid">("list");

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const { data, isPending, isError } = useQuery({
    queryKey: ["events", role],
    queryFn: () => apiFetch("/api/v1/modules/events", EventListSchema as any),
    staleTime: 60_000,
  });

  const events: CalEvent[] = (data as any)?.events ?? DEMO;

  const saveMutation = useMutation({
    mutationFn: (payload: EventForm & { id?: string }) =>
      apiFetch(payload.id ? `/api/v1/modules/events/${payload.id}` : "/api/v1/modules/events", z.any(), {
        method: payload.id ? "PUT" : "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      setModal({ open: false, editing: null });
      showToast(modal.editing ? "Event updated." : "Event created.");
    },
    onError: () => showToast("Could not save.", false),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/modules/events/${id}`, z.any(), { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["events"] }); showToast("Event removed."); },
    onError: () => showToast("Delete failed.", false),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return events
      .filter((e) => {
        if (typeFilter !== "All" && e.type !== typeFilter) return false;
        if (statusFilter !== "All" && e.status !== statusFilter) return false;
        if (q && !e.title.toLowerCase().includes(q) && !(e.venue ?? "").toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => a.date < b.date ? -1 : 1);
  }, [events, search, typeFilter, statusFilter]);

  const stats = useMemo(() => ({
    upcoming: events.filter((e) => e.status === "Upcoming").length,
    ongoing: events.filter((e) => e.status === "Ongoing").length,
    total: events.length,
    thisMonth: events.filter((e) => e.date.startsWith(TODAY.slice(0, 7))).length,
  }), [events]);

  if (isPending) return <TemplateSkeleton />;

  return (
    <div className="space-y-5 pb-10">
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Events", value: stats.total, icon: <CalendarDays className="h-5 w-5 text-blue-500" /> },
          { label: "Upcoming", value: stats.upcoming, icon: <Clock className="h-5 w-5 text-sky-500" /> },
          { label: "Ongoing", value: stats.ongoing, icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" /> },
          { label: "This Month", value: stats.thisMonth, icon: <Calendar className="h-5 w-5 text-amber-500" /> },
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
          <input className={cn(inputClass, "pl-9")} placeholder="Search events..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className={cn(inputClass, "w-auto")} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)}>
          <option value="All">All Types</option>
          {EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select className={cn(inputClass, "w-auto")} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
          <option value="All">All Status</option>
          {EVENT_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <Button onClick={() => setModal({ open: true, editing: null })}>
          <Plus className="h-4 w-4 mr-1.5" /> Create Event
        </Button>
      </div>

      {isError && (
        <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
          Showing demo data — could not connect to server.
        </div>
      )}

      {/* Event list */}
      <div className="space-y-2">
        {filtered.map((e) => (
          <Card key={e.id} className="p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-start gap-3">
              {/* Date column */}
              <div className="shrink-0 w-12 text-center">
                <div className="text-xs font-semibold text-[var(--accent)] uppercase">
                  {new Date(e.date).toLocaleDateString("en-IN", { month: "short" })}
                </div>
                <div className="text-2xl font-bold leading-tight">
                  {new Date(e.date).getDate()}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{e.title}</span>
                  {typeBadge(e.type)}
                  {statusBadge(e.status)}
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-[var(--fg-muted)]">
                  {e.time && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {e.time}
                      {e.endDate && e.endDate !== e.date ? ` · ends ${fmtDate(e.endDate)}` : ""}
                    </span>
                  )}
                  {e.venue && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {e.venue}
                    </span>
                  )}
                  {e.organizer && (
                    <span className="flex items-center gap-1">
                      <Tag className="h-3 w-3" /> {e.organizer}
                    </span>
                  )}
                </div>
                {e.capacity && e.registered !== undefined && (
                  <div className="mt-2 max-w-[200px]">
                    {regBar(e.registered, e.capacity)}
                  </div>
                )}
                {e.description && (
                  <p className="mt-1.5 text-xs text-[var(--fg-muted)] line-clamp-2">{e.description}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-1 shrink-0">
                <button onClick={() => setModal({ open: true, editing: e })} className="p-1.5 rounded hover:bg-[var(--bg-subtle)] text-[var(--fg-muted)] hover:text-[var(--fg)]">
                  <Edit3 className="h-4 w-4" />
                </button>
                <button onClick={() => { if (confirm(`Remove "${e.title}"?`)) deleteMutation.mutate(e.id); }} className="p-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-900/20 text-[var(--fg-muted)] hover:text-rose-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-sm text-[var(--fg-muted)] py-10">No events match the current filters.</p>
        )}
      </div>

      <p className="text-xs text-[var(--fg-muted)]">Showing {filtered.length} of {events.length} events</p>

      {modal.open && (
        <EventModal
          initial={modal.editing ? { ...modal.editing } : EMPTY_FORM}
          onClose={() => setModal({ open: false, editing: null })}
          onSave={(form) => saveMutation.mutate(modal.editing ? { ...form, id: modal.editing.id } : form)}
          saving={saveMutation.isPending}
        />
      )}
    </div>
  );
}
