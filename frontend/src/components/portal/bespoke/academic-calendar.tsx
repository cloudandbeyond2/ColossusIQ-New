"use client";

import { useState, useMemo } from "react";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
  BookOpen,
  GraduationCap,
  Briefcase,
  Coffee,
  ClipboardList,
} from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import type { Role } from "@/lib/auth/roles";
import { Button, Card, Field, Spinner, inputClass } from "@/components/ui/primitives";
import { TemplateSkeleton } from "@/components/modules/shared";
import { cn } from "@/lib/utils";

/* ── Types ──────────────────────────────────────────── */

const CAL_EVENT_TYPES = [
  "class",
  "exam",
  "assessment",
  "holiday",
  "event",
  "workshop",
  "deadline",
  "other",
] as const;
type CalEventType = typeof CAL_EVENT_TYPES[number];

interface CalEvent {
  id: string;
  title: string;
  type: CalEventType;
  date: string;
  endDate?: string;
  allDay: boolean;
  time?: string;
  description?: string;
  venue?: string;
}

const CalEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.string().transform((v): CalEventType =>
    CAL_EVENT_TYPES.includes(v as CalEventType) ? (v as CalEventType) : "other"
  ),
  date: z.string(),
  endDate: z.string().optional(),
  allDay: z.boolean().default(true),
  time: z.string().optional(),
  description: z.string().optional(),
  venue: z.string().optional(),
});

const CalListSchema = z.union([
  z.object({ events: z.array(CalEventSchema) }).passthrough().transform((r) => ({ events: r.events })),
  z.object({ data: z.array(CalEventSchema) }).passthrough().transform((r) => ({ events: r.data })),
  z.array(CalEventSchema).transform((arr) => ({ events: arr })),
  z.unknown().transform(() => ({ events: [] as CalEvent[] })),
]);

type CalForm = Omit<CalEvent, "id">;
const EMPTY_FORM: CalForm = {
  title: "", type: "class", date: "", endDate: "", allDay: true, time: "", description: "", venue: "",
};

/* ── Demo data ───────────────────────────────────────── */

const Y = new Date().getFullYear();
const M = String(new Date().getMonth() + 1).padStart(2, "0");

const DEMO: CalEvent[] = [
  { id: "1",  title: "Semester Commencement",         type: "class",      date: `${Y}-${M}-01`, allDay: true },
  { id: "2",  title: "Internal Assessment I",         type: "assessment", date: `${Y}-${M}-06`, endDate: `${Y}-${M}-10`, allDay: true, description: "Written tests for all subjects." },
  { id: "3",  title: "Python Workshop",               type: "workshop",   date: `${Y}-${M}-08`, allDay: false, time: "10:00", venue: "Lab 3" },
  { id: "4",  title: "Diwali Holiday",                type: "holiday",    date: `${Y}-${M}-13`, endDate: `${Y}-${M}-15`, allDay: true },
  { id: "5",  title: "Guest Lecture - Dr. Rajan",     type: "event",      date: `${Y}-${M}-17`, allDay: false, time: "14:00", venue: "Seminar Hall" },
  { id: "6",  title: "Assignment Submission Deadline",type: "deadline",   date: `${Y}-${M}-20`, allDay: true },
  { id: "7",  title: "Internal Assessment II",        type: "assessment", date: `${Y}-${M}-22`, endDate: `${Y}-${M}-25`, allDay: true },
  { id: "8",  title: "Department Technical Fest",     type: "event",      date: `${Y}-${M}-27`, allDay: true, venue: "College Auditorium" },
  { id: "9",  title: "Project Review",                type: "assessment", date: `${Y}-${M}-29`, allDay: false, time: "09:00" },
];

/* ── Helpers ─────────────────────────────────────────── */

const TYPE_META: Record<CalEventType, { label: string; color: string; bg: string; dot: string; icon: React.ReactNode }> = {
  class:      { label: "Class",       color: "text-blue-700 dark:text-blue-300",   bg: "bg-blue-100 dark:bg-blue-900/40",   dot: "bg-blue-500",    icon: <BookOpen className="h-3 w-3" /> },
  exam:       { label: "Exam",        color: "text-rose-700 dark:text-rose-300",   bg: "bg-rose-100 dark:bg-rose-900/40",   dot: "bg-rose-500",    icon: <GraduationCap className="h-3 w-3" /> },
  assessment: { label: "Assessment",  color: "text-orange-700 dark:text-orange-300", bg: "bg-orange-100 dark:bg-orange-900/40", dot: "bg-orange-500", icon: <ClipboardList className="h-3 w-3" /> },
  holiday:    { label: "Holiday",     color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-100 dark:bg-emerald-900/40", dot: "bg-emerald-500", icon: <Coffee className="h-3 w-3" /> },
  event:      { label: "Event",       color: "text-purple-700 dark:text-purple-300",  bg: "bg-purple-100 dark:bg-purple-900/40",  dot: "bg-purple-500",  icon: <CalendarDays className="h-3 w-3" /> },
  workshop:   { label: "Workshop",    color: "text-indigo-700 dark:text-indigo-300",  bg: "bg-indigo-100 dark:bg-indigo-900/40",  dot: "bg-indigo-500",  icon: <Briefcase className="h-3 w-3" /> },
  deadline:   { label: "Deadline",    color: "text-red-700 dark:text-red-300",       bg: "bg-red-100 dark:bg-red-900/40",        dot: "bg-red-500",     icon: <AlertCircle className="h-3 w-3" /> },
  other:      { label: "Other",       color: "text-slate-700 dark:text-slate-300",   bg: "bg-slate-100 dark:bg-slate-800",       dot: "bg-slate-400",   icon: <CalendarDays className="h-3 w-3" /> },
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function datesInRange(start: string, end?: string): Set<string> {
  const s = new Set<string>();
  const from = new Date(start);
  const to = end ? new Date(end) : from;
  const cur = new Date(from);
  while (cur <= to) {
    s.add(cur.toISOString().split("T")[0] ?? "");
    cur.setDate(cur.getDate() + 1);
  }
  return s;
}

function eventsForDate(events: CalEvent[], dateStr: string): CalEvent[] {
  return events.filter((e) => {
    const range = datesInRange(e.date, e.endDate);
    return range.has(dateStr);
  });
}

/* ── Modal ───────────────────────────────────────────── */

function EventModal({ initial, onClose, onSave, saving, canEdit }: {
  initial: CalForm; onClose: () => void; onSave: (f: CalForm) => void; saving: boolean; canEdit: boolean;
}) {
  const [form, setForm] = useState<CalForm>(initial);
  const set = <K extends keyof CalForm>(k: K, v: CalForm[K]) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <Card className="w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-base">{initial.title ? "Edit Event" : "Add Event"}</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-[var(--fg-muted)]" /></button>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Field label="Title *" htmlFor="cal-title">
              <input id="cal-title" className={inputClass} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Internal Assessment I" disabled={!canEdit} />
            </Field>
          </div>
          <Field label="Type" htmlFor="cal-type">
            <select id="cal-type" className={inputClass} value={form.type} onChange={(e) => set("type", e.target.value as CalEventType)} disabled={!canEdit}>
              {CAL_EVENT_TYPES.map((t) => <option key={t} value={t}>{TYPE_META[t].label}</option>)}
            </select>
          </Field>
          <Field label="All Day" htmlFor="cal-allday">
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input id="cal-allday" type="checkbox" checked={form.allDay} onChange={(e) => set("allDay", e.target.checked)} disabled={!canEdit} className="rounded" />
              <span className="text-sm">All day event</span>
            </label>
          </Field>
          <Field label="Start Date *" htmlFor="cal-start">
            <input id="cal-start" className={inputClass} type="date" value={form.date} onChange={(e) => set("date", e.target.value)} disabled={!canEdit} />
          </Field>
          <Field label="End Date" htmlFor="cal-end">
            <input id="cal-end" className={inputClass} type="date" value={form.endDate ?? ""} onChange={(e) => set("endDate", e.target.value)} disabled={!canEdit} />
          </Field>
          {!form.allDay && (
            <Field label="Time" htmlFor="cal-time">
              <input id="cal-time" className={inputClass} type="time" value={form.time ?? ""} onChange={(e) => set("time", e.target.value)} disabled={!canEdit} />
            </Field>
          )}
          <div className={form.allDay ? "sm:col-span-2" : ""}>
            <Field label="Venue" htmlFor="cal-venue">
              <input id="cal-venue" className={inputClass} value={form.venue ?? ""} onChange={(e) => set("venue", e.target.value)} placeholder="Room / Hall / Online" disabled={!canEdit} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Description" htmlFor="cal-desc">
              <textarea id="cal-desc" className={cn(inputClass, "resize-none")} rows={2} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} disabled={!canEdit} />
            </Field>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>{canEdit ? "Cancel" : "Close"}</Button>
          {canEdit && (
            <Button onClick={() => onSave(form)} disabled={saving || !form.title.trim() || !form.date}>
              {saving ? <Spinner className="h-4 w-4 mr-2" /> : null}
              {initial.title ? "Save Changes" : "Add Event"}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

/* ── Day cell ────────────────────────────────────────── */

function DayCell({ day, isCurrentMonth, isToday, events, onAdd, onSelect }: {
  day: Date; isCurrentMonth: boolean; isToday: boolean;
  events: CalEvent[]; onAdd: (date: string) => void; onSelect: (e: CalEvent) => void;
}) {
  const dateStr = day.toISOString().split("T")[0] ?? "";
  const shown = events.slice(0, 3);
  const extra = events.length - shown.length;

  return (
    <div
      className={cn(
        "min-h-[90px] p-1.5 border-b border-r border-[var(--border)] relative group",
        !isCurrentMonth && "opacity-40",
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span className={cn(
          "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
          isToday ? "bg-[var(--accent)] text-white" : "text-[var(--fg-muted)]"
        )}>
          {day.getDate()}
        </span>
        <button
          onClick={() => onAdd(dateStr)}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--bg-subtle)] text-[var(--fg-muted)] transition-opacity"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
      <div className="space-y-0.5">
        {shown.map((e) => {
          const meta = TYPE_META[e.type];
          return (
            <button
              key={e.id}
              onClick={() => onSelect(e)}
              className={cn("w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate font-medium", meta.bg, meta.color)}
            >
              {e.title}
            </button>
          );
        })}
        {extra > 0 && (
          <span className="text-[10px] text-[var(--fg-muted)] pl-1">+{extra} more</span>
        )}
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────── */

const CAN_EDIT_ROLES: Role[] = ["hod", "faculty", "institution", "admin"];

export function AcademicCalendarModule({ role }: { role: Role }) {
  const qc = useQueryClient();
  const canEdit = CAN_EDIT_ROLES.includes(role);

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [view, setView] = useState<"month" | "list">("month");
  const [typeFilter, setTypeFilter] = useState<CalEventType | "All">("All");
  const [modal, setModal] = useState<{ open: boolean; editing: CalEvent | null; prefillDate?: string } | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const { data, isPending, isError } = useQuery({
    queryKey: ["academic-calendar", role],
    queryFn: () => apiFetch("/api/v1/modules/academic-calendar", CalListSchema as any),
    staleTime: 60_000,
  });

  const events: CalEvent[] = useMemo(() => {
    const raw = (data as any)?.events;
    return Array.isArray(raw) && raw.length > 0 ? raw : DEMO;
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (payload: CalForm & { id?: string }) =>
      apiFetch(
        payload.id ? `/api/v1/modules/academic-calendar/${payload.id}` : "/api/v1/modules/academic-calendar",
        z.any(),
        { method: payload.id ? "PUT" : "POST", body: JSON.stringify(payload) }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["academic-calendar"] });
      setModal(null);
      showToast(modal?.editing ? "Event updated." : "Event added.");
    },
    onError: () => showToast("Could not save.", false),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/modules/academic-calendar/${id}`, z.any(), { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["academic-calendar"] }); showToast("Event removed."); },
    onError: () => showToast("Delete failed.", false),
  });

  /* Calendar grid */
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const cells: Date[] = [];
  for (let i = startPad - 1; i >= 0; i--) cells.push(new Date(year, month, -i));
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(new Date(year, month + 1, cells.length - lastDay.getDate() - startPad + 1));

  const todayStr = today.toISOString().split("T")[0] ?? "";

  const filteredEvents = useMemo(() =>
    typeFilter === "All" ? events : events.filter((e) => e.type === typeFilter),
    [events, typeFilter]
  );

  /* Month events (for list view) */
  const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthEvents = useMemo(() =>
    filteredEvents
      .filter((e) => e.date.startsWith(monthStr) || (e.endDate ?? "").startsWith(monthStr))
      .sort((a, b) => a.date < b.date ? -1 : 1),
    [filteredEvents, monthStr]
  );

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1); };

  if (isPending) return <TemplateSkeleton />;

  return (
    <div className="space-y-4 pb-10">
      {toast && (
        <div className={cn(
          "fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium",
          toast.ok ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
        )}>
          {toast.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {isError && (
        <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
          Showing demo data — could not connect to server.
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Month nav */}
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-1.5 rounded hover:bg-[var(--bg-subtle)]">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-base font-semibold w-44 text-center">{MONTHS[month]} {year}</span>
          <button onClick={nextMonth} className="p-1.5 rounded hover:bg-[var(--bg-subtle)]">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => { setMonth(today.getMonth()); setYear(today.getFullYear()); }}
            className="ml-1 text-xs px-2 py-1 rounded border border-[var(--border)] hover:bg-[var(--bg-subtle)]"
          >
            Today
          </button>
        </div>

        <div className="flex-1" />

        {/* Type filter */}
        <select
          className={cn(inputClass, "w-auto text-xs")}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as any)}
        >
          <option value="All">All Types</option>
          {CAL_EVENT_TYPES.map((t) => <option key={t} value={t}>{TYPE_META[t].label}</option>)}
        </select>

        {/* View toggle */}
        <div className="flex rounded-lg border border-[var(--border)] overflow-hidden text-xs">
          {(["month", "list"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "px-3 py-1.5 capitalize",
                view === v ? "bg-[var(--accent)] text-white" : "hover:bg-[var(--bg-subtle)]"
              )}
            >
              {v}
            </button>
          ))}
        </div>

        {canEdit && (
          <Button onClick={() => setModal({ open: true, editing: null })}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Event
          </Button>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {CAL_EVENT_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(typeFilter === t ? "All" : t)}
            className={cn(
              "flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border transition-all",
              typeFilter === t
                ? cn(TYPE_META[t].bg, TYPE_META[t].color, "border-current")
                : "border-transparent hover:border-[var(--border)]"
            )}
          >
            <span className={cn("w-2 h-2 rounded-full", TYPE_META[t].dot)} />
            {TYPE_META[t].label}
          </button>
        ))}
      </div>

      {/* Calendar */}
      {view === "month" ? (
        <Card className="overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-[var(--border)]">
            {DAYS.map((d) => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-[var(--fg-muted)] border-r border-[var(--border)] last:border-r-0">
                {d}
              </div>
            ))}
          </div>
          {/* Cells */}
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              const dateStr = day.toISOString().split("T")[0] ?? "";
              const dayEvents = eventsForDate(filteredEvents, dateStr);
              const isCurrentMonth = day.getMonth() === month;
              const isToday = dateStr === todayStr;
              return (
                <DayCell
                  key={i}
                  day={day}
                  isCurrentMonth={isCurrentMonth}
                  isToday={isToday}
                  events={dayEvents}
                  onAdd={(date) => canEdit && setModal({ open: true, editing: null, prefillDate: date })}
                  onSelect={(e) => setModal({ open: true, editing: e })}
                />
              );
            })}
          </div>
        </Card>
      ) : (
        /* List view */
        <div className="space-y-2">
          {monthEvents.length === 0 && (
            <p className="text-center text-sm text-[var(--fg-muted)] py-10">No events this month.</p>
          )}
          {monthEvents.map((e) => {
            const meta = TYPE_META[e.type];
            return (
              <Card key={e.id} className="p-4 flex items-start gap-3 hover:shadow-sm transition-shadow">
                <div className={cn("w-1.5 self-stretch rounded-full shrink-0 mt-0.5", meta.dot)} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <span className="font-semibold text-sm">{e.title}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", meta.bg, meta.color)}>
                      {meta.label}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--fg-muted)] flex flex-wrap gap-3">
                    <span>
                      {new Date(e.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      {e.endDate && e.endDate !== e.date
                        ? ` – ${new Date(e.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                        : ""}
                    </span>
                    {e.time && <span>{e.time}</span>}
                    {e.venue && <span>{e.venue}</span>}
                  </div>
                  {e.description && <p className="mt-1 text-xs text-[var(--fg-muted)] line-clamp-1">{e.description}</p>}
                </div>
                {canEdit && (
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => setModal({ open: true, editing: e })}
                      className="p-1.5 rounded hover:bg-[var(--bg-subtle)] text-[var(--fg-muted)]"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => { if (confirm(`Remove "${e.title}"?`)) deleteMutation.mutate(e.id); }}
                      className="p-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-900/20 text-[var(--fg-muted)] hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Stats bar */}
      <div className="flex flex-wrap gap-4 text-xs text-[var(--fg-muted)]">
        {CAL_EVENT_TYPES.map((t) => {
          const count = filteredEvents.filter((e) => e.type === t).length;
          if (!count) return null;
          return (
            <span key={t} className="flex items-center gap-1">
              <span className={cn("w-2 h-2 rounded-full inline-block", TYPE_META[t].dot)} />
              {count} {TYPE_META[t].label}{count > 1 ? "s" : ""}
            </span>
          );
        })}
      </div>

      {/* Modal */}
      {modal?.open && (
        <EventModal
          initial={
            modal.editing
              ? { ...modal.editing }
              : { ...EMPTY_FORM, date: modal.prefillDate ?? "" }
          }
          onClose={() => setModal(null)}
          onSave={(form) =>
            saveMutation.mutate(modal.editing ? { ...form, id: modal.editing.id } : form)
          }
          saving={saveMutation.isPending}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
