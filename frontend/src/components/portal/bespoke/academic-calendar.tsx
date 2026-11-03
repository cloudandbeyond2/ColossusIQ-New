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
  GraduationCap,
  Briefcase,
  Coffee,
  ClipboardList,
  RefreshCw,
  Building2,
} from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api/client";
import {
  AcademicCalendarItem,
  AcademicCalendarOverview,
  CreateCalendarItemInput,
} from "@/lib/api/schemas";
import type { Role } from "@/lib/auth/roles";
import { Button, Card, Field, Spinner, inputClass } from "@/components/ui/primitives";
import { TemplateSkeleton } from "@/components/modules/shared";
import { cn } from "@/lib/utils";

/* ── Types & Metadata ──────────────────────────────────── */

type CalTag = AcademicCalendarItem["tag"];
type CalAudience = AcademicCalendarItem["audience"];

const CAL_TAGS: CalTag[] = [
  "Assessment",
  "Holiday",
  "Exam cell",
  "Event",
  "Milestone",
];

const CAL_AUDIENCES: CalAudience[] = ["All", "Students", "Faculty", "Staff"];

const TAG_META: Record<
  CalTag,
  { label: string; color: string; bg: string; dot: string; icon: React.ReactNode }
> = {
  Assessment: {
    label: "Assessment",
    color: "text-rose-700 dark:text-rose-300",
    bg: "bg-rose-100 dark:bg-rose-900/40",
    dot: "bg-rose-500",
    icon: <ClipboardList className="h-3 w-3" />,
  },
  Holiday: {
    label: "Holiday",
    color: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-100 dark:bg-emerald-900/40",
    dot: "bg-emerald-500",
    icon: <Coffee className="h-3 w-3" />,
  },
  "Exam cell": {
    label: "Exam cell",
    color: "text-blue-700 dark:text-blue-300",
    bg: "bg-blue-100 dark:bg-blue-900/40",
    dot: "bg-blue-500",
    icon: <GraduationCap className="h-3 w-3" />,
  },
  Event: {
    label: "Event",
    color: "text-purple-700 dark:text-purple-300",
    bg: "bg-purple-100 dark:bg-purple-900/40",
    dot: "bg-purple-500",
    icon: <CalendarDays className="h-3 w-3" />,
  },
  Milestone: {
    label: "Milestone",
    color: "text-sky-700 dark:text-sky-300",
    bg: "bg-sky-100 dark:bg-sky-900/40",
    dot: "bg-sky-500",
    icon: <Briefcase className="h-3 w-3" />,
  },
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

interface CalFormState {
  title: string;
  tag: CalTag;
  date: string;
  endDate: string;
  allDay: boolean;
  time: string;
  department: string;
  audience: CalAudience;
  venue: string;
  description: string;
  notify: boolean;
}

function datesInRange(start: string, end?: string): Set<string> {
  const s = new Set<string>();
  if (!start) return s;
  const from = new Date(start + "T00:00:00");
  const to = end ? new Date(end + "T00:00:00") : from;
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    s.add(start);
    return s;
  }
  const cur = new Date(from);
  while (cur <= to) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    s.add(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return s;
}

function eventsForDate(events: AcademicCalendarItem[], dateStr: string): AcademicCalendarItem[] {
  return events.filter((e) => {
    const range = datesInRange(e.date, e.endDate);
    return range.has(dateStr);
  });
}

/* ── Modal ───────────────────────────────────────────── */

function EventModal({
  initial,
  onClose,
  onSave,
  saving,
  canEdit,
  departments,
}: {
  initial: CalFormState;
  onClose: () => void;
  onSave: (f: CalFormState) => void;
  saving: boolean;
  canEdit: boolean;
  departments: string[];
}) {
  const [form, setForm] = useState<CalFormState>(initial);
  const set = <K extends keyof CalFormState>(k: K, v: CalFormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!form.title.trim() || !form.date) return;
    if (form.endDate && form.endDate < form.date) {
      alert("End date cannot be earlier than start date.");
      return;
    }
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <Card className="w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-base">{initial.title ? "Edit Event" : "Add Event"}</h3>
          <button onClick={onClose} aria-label="Close modal">
            <X className="h-5 w-5 text-ink-3 hover:text-ink transition-colors" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="Title *" htmlFor="cal-title">
                <input
                  id="cal-title"
                  className={inputClass}
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="e.g. Internal Assessment I"
                  disabled={!canEdit}
                  required
                />
              </Field>
            </div>

            <Field label="Category / Type *" htmlFor="cal-tag">
              <select
                id="cal-tag"
                className={inputClass}
                value={form.tag}
                onChange={(e) => set("tag", e.target.value as CalTag)}
                disabled={!canEdit}
              >
                {CAL_TAGS.map((t) => (
                  <option key={t} value={t}>
                    {TAG_META[t].label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Department" htmlFor="cal-dept">
              <select
                id="cal-dept"
                className={inputClass}
                value={form.department}
                onChange={(e) => set("department", e.target.value)}
                disabled={!canEdit}
              >
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Audience" htmlFor="cal-audience">
              <select
                id="cal-audience"
                className={inputClass}
                value={form.audience}
                onChange={(e) => set("audience", e.target.value as CalAudience)}
                disabled={!canEdit}
              >
                {CAL_AUDIENCES.map((a) => (
                  <option key={a} value={a}>
                    {a === "All" ? "Everyone (All)" : a}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="All Day" htmlFor="cal-allday">
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  id="cal-allday"
                  type="checkbox"
                  checked={form.allDay}
                  onChange={(e) => set("allDay", e.target.checked)}
                  disabled={!canEdit}
                  className="rounded text-brand focus:ring-brand"
                />
                <span className="text-sm text-ink-2">All day event</span>
              </label>
            </Field>

            <Field label="Start Date *" htmlFor="cal-start">
              <input
                id="cal-start"
                className={inputClass}
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
                disabled={!canEdit}
                required
              />
            </Field>

            <Field label="End Date" htmlFor="cal-end">
              <input
                id="cal-end"
                className={inputClass}
                type="date"
                value={form.endDate}
                onChange={(e) => set("endDate", e.target.value)}
                disabled={!canEdit}
              />
            </Field>

            {!form.allDay && (
              <div className="sm:col-span-2">
                <Field label="Time" htmlFor="cal-time">
                  <input
                    id="cal-time"
                    className={inputClass}
                    type="text"
                    placeholder="e.g. 10:00 AM - 12:30 PM"
                    value={form.time}
                    onChange={(e) => set("time", e.target.value)}
                    disabled={!canEdit}
                  />
                </Field>
              </div>
            )}

            <div className="sm:col-span-2">
              <Field label="Venue" htmlFor="cal-venue">
                <input
                  id="cal-venue"
                  className={inputClass}
                  value={form.venue}
                  onChange={(e) => set("venue", e.target.value)}
                  placeholder="e.g. Seminar Hall / Exam Hall A / Online"
                  disabled={!canEdit}
                />
              </Field>
            </div>

            <div className="sm:col-span-2">
              <Field label="Description" htmlFor="cal-desc">
                <textarea
                  id="cal-desc"
                  className={cn(inputClass, "resize-none")}
                  rows={2}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Additional details, syllabus or instructions"
                  disabled={!canEdit}
                />
              </Field>
            </div>

            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.notify}
                  onChange={(e) => set("notify", e.target.checked)}
                  disabled={!canEdit}
                  className="rounded text-brand focus:ring-brand"
                />
                <span className="text-xs text-ink-2">
                  Post announcement to Notice Board and notify attendees
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <Button variant="ghost" onClick={onClose} type="button">
              {canEdit ? "Cancel" : "Close"}
            </Button>
            {canEdit && (
              <Button
                type="submit"
                disabled={saving || !form.title.trim() || !form.date}
              >
                {saving ? <Spinner className="h-4 w-4 mr-2" /> : null}
                {initial.title ? "Save Changes" : "Add Event"}
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}

/* ── Day cell ────────────────────────────────────────── */

function DayCell({
  day,
  isCurrentMonth,
  isToday,
  events,
  onAdd,
  onSelect,
  canEdit,
}: {
  day: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: AcademicCalendarItem[];
  onAdd: (date: string) => void;
  onSelect: (e: AcademicCalendarItem) => void;
  canEdit: boolean;
}) {
  const y = day.getFullYear();
  const m = String(day.getMonth() + 1).padStart(2, "0");
  const d = String(day.getDate()).padStart(2, "0");
  const dateStr = `${y}-${m}-${d}`;
  const shown = events.slice(0, 3);
  const extra = events.length - shown.length;

  return (
    <div
      className={cn(
        "min-h-[96px] p-1.5 border-b border-r border-line relative group transition-colors",
        !isCurrentMonth ? "bg-surface-2/40 opacity-40" : "bg-surface",
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className={cn(
            "text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full transition-colors",
            isToday ? "bg-brand text-white shadow-sm" : "text-ink-3"
          )}
        >
          {day.getDate()}
        </span>
        {canEdit && (
          <button
            onClick={() => onAdd(dateStr)}
            title={`Add event on ${dateStr}`}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-surface-2 text-ink-3 hover:text-ink transition-opacity"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="space-y-1">
        {shown.map((e) => {
          const meta = TAG_META[e.tag] ?? TAG_META.Event;
          return (
            <button
              key={e.id}
              onClick={() => onSelect(e)}
              title={`${e.title} (${meta.label})`}
              className={cn(
                "w-full text-left text-[11px] px-1.5 py-0.5 rounded truncate font-medium transition-opacity hover:opacity-80 block",
                meta.bg,
                meta.color
              )}
            >
              {e.title}
            </button>
          );
        })}
        {extra > 0 && (
          <span className="text-[10px] text-ink-3 font-medium pl-1 block">
            +{extra} more
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Main AcademicCalendarModule Component ────────────── */

const CAN_EDIT_ROLES: Role[] = ["hod", "faculty", "institution", "admin"];

export function AcademicCalendarModule({ role }: { role: Role }) {
  const qc = useQueryClient();
  const canRoleEdit = CAN_EDIT_ROLES.includes(role);

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [view, setView] = useState<"month" | "list">("month");
  const [tagFilter, setTagFilter] = useState<CalTag | "All">("All");
  const [deptFilter, setDeptFilter] = useState<string>("All");
  const [modal, setModal] = useState<{
    open: boolean;
    editing: AcademicCalendarItem | null;
    prefillDate?: string;
  } | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // Live Query
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["academic-calendar"],
    queryFn: () => apiFetch("/api/v1/academic-calendar", AcademicCalendarOverview),
    staleTime: 30_000,
  });

  const canEdit = data?.canManage ?? canRoleEdit;
  const items: AcademicCalendarItem[] = data?.items ?? [];
  const departments: string[] = data?.departments ?? ["All Departments"];
  const kpis = data?.kpis;
  const semester = data?.semester;

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: (payload: { id?: string } & Partial<z.infer<typeof CreateCalendarItemInput>>) => {
      const { id, ...body } = payload;
      return apiFetch(
        id ? `/api/v1/academic-calendar/${id}` : "/api/v1/academic-calendar",
        AcademicCalendarItem,
        {
          method: id ? "PUT" : "POST",
          body,
        }
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["academic-calendar"] });
      setModal(null);
      showToast(modal?.editing ? "Event updated successfully." : "Event scheduled successfully.");
    },
    onError: (err) => {
      showToast(err instanceof ApiError ? err.message : "Could not schedule event.", false);
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/academic-calendar/${id}`, z.any(), { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["academic-calendar"] });
      showToast("Event removed from calendar.");
    },
    onError: (err) => {
      showToast(err instanceof ApiError ? err.message : "Delete failed.", false);
    },
  });

  // Sync Campus Events Mutation
  const syncMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/v1/academic-calendar/sync-events", z.any(), { method: "POST" }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["academic-calendar"] });
      showToast(`Synced ${res?.imported ?? 0} campus events.`);
    },
    onError: (err) => {
      showToast(err instanceof ApiError ? err.message : "Could not sync campus events.", false);
    },
  });

  /* Calendar grid dates generation */
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const cells: Date[] = [];
  for (let i = startPad - 1; i >= 0; i--) cells.push(new Date(year, month, -i));
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) {
    cells.push(new Date(year, month + 1, cells.length - lastDay.getDate() - startPad + 1));
  }

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  /* Filtered Items */
  const filteredEvents = useMemo(() => {
    return items.filter((e) => {
      const matchTag = tagFilter === "All" || e.tag === tagFilter;
      const matchDept =
        deptFilter === "All" ||
        e.department === "All Departments" ||
        e.department === deptFilter;
      return matchTag && matchDept;
    });
  }, [items, tagFilter, deptFilter]);

  /* Month events (for list view) */
  const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthEvents = useMemo(() => {
    return filteredEvents
      .filter((e) => e.date.startsWith(monthStr) || (e.endDate ?? "").startsWith(monthStr))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredEvents, monthStr]);

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  if (isLoading) return <TemplateSkeleton />;

  return (
    <div className="space-y-5 pb-12">
      {/* Toast Notification */}
      {toast && (
        <div
          className={cn(
            "fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all animate-in fade-in slide-in-from-top-2",
            toast.ok ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
          )}
        >
          {toast.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      {isError && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-900/30 dark:bg-rose-900/20 dark:text-rose-300">
          <span>Failed to load academic calendar data ({error instanceof Error ? error.message : "Error"}).</span>
          <Button variant="ghost" size="sm" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      )}

      {/* Semester Header & KPIs */}
      {semester && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-brand">
              Academic Term
            </span>
            <h2 className="text-lg font-bold text-ink">{semester.name}</h2>
            <p className="text-xs text-ink-3">
              {new Date(semester.startDate).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
              {" – "}
              {new Date(semester.endDate).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-xs text-ink-3">Progress</span>
              <p className="text-sm font-semibold text-ink">
                Week {semester.currentWeek} <span className="text-xs text-ink-3 font-normal">of {semester.totalWeeks}</span>
              </p>
            </div>
            {canEdit && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                title="Sync published Campus Events into the calendar"
              >
                <RefreshCw className={cn("size-3.5 mr-1.5", syncMutation.isPending && "animate-spin")} />
                Sync Events
              </Button>
            )}
          </div>
        </div>
      )}

      {kpis && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="p-4">
            <p className="text-xs font-medium text-ink-3">Total Scheduled</p>
            <p className="mt-1 text-2xl font-bold text-ink">{kpis.totalEvents}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400">Assessments & Exams</p>
            <p className="mt-1 text-2xl font-bold text-ink">{kpis.assessmentsCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Holidays & Breaks</p>
            <p className="mt-1 text-2xl font-bold text-ink">{kpis.holidaysCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium text-sky-600 dark:text-sky-400">Key Milestones</p>
            <p className="mt-1 text-2xl font-bold text-ink">{kpis.milestonesCount}</p>
          </Card>
        </div>
      )}

      {/* Action Bar: Month Navigation, Filters, View Modes, Add Event Button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Month Navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg border border-line hover:bg-surface-2 transition-colors text-ink"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-base font-semibold w-44 text-center text-ink">
            {MONTHS[month]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg border border-line hover:bg-surface-2 transition-colors text-ink"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setMonth(today.getMonth());
              setYear(today.getFullYear());
            }}
            className="ml-1 text-xs px-2.5 py-1.5 rounded-lg border border-line hover:bg-surface-2 transition-colors text-ink font-medium"
          >
            Today
          </button>
        </div>

        {/* Filters and View Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {departments.length > 2 && (
            <select
              className={cn(inputClass, "w-auto text-xs py-1.5")}
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
            >
              <option value="All">All Departments</option>
              {departments
                .filter((d) => d !== "All Departments")
                .map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
            </select>
          )}

          <div className="flex rounded-lg border border-line bg-surface overflow-hidden text-xs">
            {(["month", "list"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1.5 capitalize font-medium transition-colors",
                  view === v
                    ? "bg-brand text-white"
                    : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                )}
              >
                {v}
              </button>
            ))}
          </div>

          {canEdit && (
            <Button
              onClick={() =>
                setModal({
                  open: true,
                  editing: null,
                  prefillDate: todayStr,
                })
              }
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Add Event
            </Button>
          )}
        </div>
      </div>

      {/* Category Tag Legend / Quick Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setTagFilter("All")}
          className={cn(
            "text-xs px-2.5 py-1 rounded-full border transition-all font-medium",
            tagFilter === "All"
              ? "bg-brand text-white border-brand"
              : "border-line text-ink-2 hover:border-ink-3"
          )}
        >
          All Categories
        </button>
        {CAL_TAGS.map((t) => {
          const meta = TAG_META[t];
          const active = tagFilter === t;
          return (
            <button
              key={t}
              onClick={() => setTagFilter(active ? "All" : t)}
              className={cn(
                "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all font-medium",
                active
                  ? cn(meta.bg, meta.color, "border-current shadow-xs")
                  : "border-line text-ink-2 hover:border-ink-3"
              )}
            >
              <span className={cn("w-2 h-2 rounded-full", meta.dot)} />
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* Calendar Body: Month View vs List View */}
      {view === "month" ? (
        <Card className="overflow-hidden">
          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 border-b border-line bg-surface-2/60">
            {DAYS.map((d) => (
              <div
                key={d}
                className="py-2.5 text-center text-xs font-semibold text-ink-3 border-r border-line last:border-r-0"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Grid Cells */}
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              const y = day.getFullYear();
              const m = String(day.getMonth() + 1).padStart(2, "0");
              const d = String(day.getDate()).padStart(2, "0");
              const dateStr = `${y}-${m}-${d}`;
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
                  onAdd={(date) =>
                    canEdit &&
                    setModal({ open: true, editing: null, prefillDate: date })
                  }
                  onSelect={(e) => setModal({ open: true, editing: e })}
                  canEdit={canEdit}
                />
              );
            })}
          </div>
        </Card>
      ) : (
        /* List View */
        <div className="space-y-2.5">
          {monthEvents.length === 0 ? (
            <Card className="py-12 text-center text-sm text-ink-3">
              No events scheduled for {MONTHS[month]} {year}.
            </Card>
          ) : (
            monthEvents.map((e) => {
              const meta = TAG_META[e.tag] ?? TAG_META.Event;
              return (
                <Card
                  key={e.id}
                  className="p-4 flex items-start gap-3.5 hover:shadow-card transition-shadow"
                >
                  <div className={cn("w-1.5 self-stretch rounded-full shrink-0 mt-0.5", meta.dot)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-ink">{e.title}</span>
                      <span
                        className={cn(
                          "text-[11px] px-2 py-0.5 rounded-full font-medium",
                          meta.bg,
                          meta.color
                        )}
                      >
                        {meta.label}
                      </span>
                      {e.department && e.department !== "All Departments" && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-2 text-ink-2 font-medium flex items-center gap-1">
                          <Building2 className="size-3" />
                          {e.department}
                        </span>
                      )}
                      {e.readOnly && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-surface-2 text-ink-3">
                          Campus Event
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-ink-3 flex flex-wrap gap-x-4 gap-y-1">
                      <span>
                        {new Date(e.date + "T00:00:00").toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                        {e.endDate && e.endDate !== e.date && (
                          <>
                            {" – "}
                            {new Date(e.endDate + "T00:00:00").toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </>
                        )}
                      </span>
                      {e.time && <span>{e.time}</span>}
                      {e.venue && <span>📍 {e.venue}</span>}
                      {e.audience && e.audience !== "All" && (
                        <span>For: {e.audience}</span>
                      )}
                    </div>
                    {e.description && (
                      <p className="mt-1.5 text-xs text-ink-2 line-clamp-2">{e.description}</p>
                    )}
                  </div>

                  {canEdit && !e.readOnly && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => setModal({ open: true, editing: e })}
                        title="Edit event"
                        className="p-1.5 rounded-lg hover:bg-surface-2 text-ink-3 hover:text-ink transition-colors"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Remove event "${e.title}" from calendar?`)) {
                            deleteMutation.mutate(e.id);
                          }
                        }}
                        title="Delete event"
                        className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-ink-3 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Modal Dialog */}
      {modal?.open && (
        <EventModal
          initial={
            modal.editing
              ? {
                  title: modal.editing.title,
                  tag: modal.editing.tag,
                  date: modal.editing.date,
                  endDate: modal.editing.endDate ?? "",
                  allDay: !modal.editing.time || modal.editing.time.toLowerCase() === "full day",
                  time:
                    !modal.editing.time || modal.editing.time.toLowerCase() === "full day"
                      ? ""
                      : modal.editing.time,
                  department: modal.editing.department || "All Departments",
                  audience: modal.editing.audience || "All",
                  venue: modal.editing.venue ?? "",
                  description: modal.editing.description ?? "",
                  notify: modal.editing.notify ?? true,
                }
              : {
                  title: "",
                  tag: "Assessment",
                  date: modal.prefillDate || todayStr,
                  endDate: "",
                  allDay: true,
                  time: "",
                  department: "All Departments",
                  audience: "All",
                  venue: "",
                  description: "",
                  notify: true,
                }
          }
          onClose={() => setModal(null)}
          onSave={(formState) => {
            const payload = {
              title: formState.title.trim(),
              tag: formState.tag,
              date: formState.date,
              endDate: formState.endDate.trim() || undefined,
              time: formState.allDay ? "Full day" : (formState.time.trim() || "Full day"),
              department: formState.department || "All Departments",
              audience: formState.audience || "All",
              venue: formState.venue.trim() || undefined,
              description: formState.description.trim() || undefined,
              notify: formState.notify,
            };

            saveMutation.mutate(
              modal.editing
                ? { ...payload, id: modal.editing.id }
                : payload
            );
          }}
          saving={saveMutation.isPending}
          canEdit={canEdit}
          departments={departments}
        />
      )}
    </div>
  );
}
