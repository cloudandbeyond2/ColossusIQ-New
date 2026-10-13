"use client";

import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Search,
  Download,
  RefreshCw,
  Trash2,
  Edit3,
  Filter,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Building2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  X,
  BookOpen,
  CalendarDays,
  Sparkles,
  Layers,
} from "lucide-react";
import { useMemo, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api/client";
import {
  AcademicCalendarItem,
  AcademicCalendarOverview,
  CreateCalendarItemInput,
} from "@/lib/api/schemas";
import type { Role } from "@/lib/auth/roles";
import { TemplateSkeleton } from "@/components/modules/shared";
import { LoadError } from "@/components/ui/load-error";
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  inputClass,
  Spinner,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const TAG_FILTERS = [
  "All",
  "Assessment",
  "Holiday",
  "Exam cell",
  "Event",
  "Milestone",
] as const;

function tagTone(tag: string): "rose" | "teal" | "brand" | "gold" | "sky" | "amber" {
  switch (tag) {
    case "Assessment":
      return "rose";
    case "Holiday":
      return "teal";
    case "Exam cell":
      return "brand";
    case "Milestone":
      return "sky";
    case "Event":
    default:
      return "gold";
  }
}

/** "all students in Computer Science", "everyone on campus", ... */
function reachOf(audience: AcademicCalendarItem["audience"], department: string): string {
  const who = audience === "All" ? "everyone on campus" : audience === "Students" ? "all students" : audience === "Faculty" ? "all faculty" : "all staff";
  return department && department !== "All Departments" && (audience === "All" || audience === "Students") ? `${who} in ${department}` : who;
}

const fmtLong = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export function AcademicCalendarModule({ role }: { role: Role }) {
  const qc = useQueryClient();
  /** A change to the calendar also changes the bell (new notifications) and the module overview. */
  const refreshCalendar = () => {
    void qc.invalidateQueries({ queryKey: ["academic-calendar"] });
    void qc.invalidateQueries({ queryKey: ["notifications"] });
    void qc.invalidateQueries({ queryKey: ["module", "academic-calendar"] });
  };
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("All");
  const [selectedDept, setSelectedDept] = useState<string>("All");
  const [viewMode, setViewMode] = useState<"timeline" | "month">("timeline");
  const [monthAnchor, setMonthAnchor] = useState<Date | null>(null); // null: the month of today
  const [selectedDayEvents, setSelectedDayEvents] = useState<AcademicCalendarItem[] | null>(null);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<AcademicCalendarItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; tone: "success" | "error" } | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formTime, setFormTime] = useState("");
  const [formTag, setFormTag] = useState<AcademicCalendarItem["tag"]>("Event");
  const [formDept, setFormDept] = useState("All Departments");
  const [formVenue, setFormVenue] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formAudience, setFormAudience] = useState<AcademicCalendarItem["audience"]>("All");
  const [formNotify, setFormNotify] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const showToast = (text: string, tone: "success" | "error" = "success") => {
    setToastMessage({ text, tone });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["academic-calendar"],
    queryFn: () => apiFetch("/api/v1/academic-calendar", AcademicCalendarOverview),
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateCalendarItemInput) =>
      apiFetch("/api/v1/academic-calendar", AcademicCalendarItem, {
        method: "POST",
        body: input,
      }),
    onSuccess: (item) => {
      refreshCalendar();
      setShowAddModal(false);
      resetForm();
      showToast(item.notify ? `Added "${item.title}" and notified ${reachOf(item.audience, item.department)}` : `Added "${item.title}" to Academic Calendar`);
    },
    onError: (err) => {
      setFormError(err instanceof ApiError ? err.message : "Failed to create entry.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CreateCalendarItemInput> }) =>
      apiFetch(`/api/v1/academic-calendar/${id}`, AcademicCalendarItem, {
        method: "PUT",
        body: input,
      }),
    onSuccess: (item) => {
      refreshCalendar();
      setEditingItem(null);
      resetForm();
      setShowAddModal(false);
      showToast(`Updated "${item.title}"`);
    },
    onError: (err) => {
      setFormError(err instanceof ApiError ? err.message : "Failed to update entry.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/academic-calendar/${id}`, z.any(), {
        method: "DELETE",
      }),
    onSuccess: () => {
      refreshCalendar();
      setDeletingId(null);
      showToast("Calendar entry removed");
    },
    onError: (err) => {
      showToast(err instanceof ApiError ? err.message : "Failed to delete entry", "error");
    },
  });

  const syncMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/v1/academic-calendar/sync-events", z.object({ syncedCount: z.number() }), {
        method: "POST",
      }),
    onSuccess: (res) => {
      refreshCalendar();
      const count = res.syncedCount ?? 0;
      showToast(count > 0 ? `Synced ${count} campus event(s) to Academic Calendar` : "Academic Calendar is already in sync with Campus Events");
    },
    onError: (err) => {
      showToast(err instanceof ApiError ? err.message : "Failed to sync events", "error");
    },
  });

  const resetForm = () => {
    setFormTitle("");
    setFormDate(data?.today ?? "");
    setFormEndDate("");
    setFormTime("");
    setFormTag("Event");
    setFormDept("All Departments");
    setFormVenue("");
    setFormDesc("");
    setFormAudience("All");
    setFormNotify(true);
    setFormError(null);
  };

  const openCreateModal = () => {
    resetForm();
    setEditingItem(null);
    setShowAddModal(true);
  };

  const openEditModal = (item: AcademicCalendarItem) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormDate(item.date);
    setFormEndDate(item.endDate || "");
    setFormTime(item.time || "Full day");
    setFormTag(item.tag);
    setFormDept(item.department || "All Departments");
    setFormVenue(item.venue || "");
    setFormDesc(item.description || "");
    setFormAudience(item.audience || "All");
    setFormNotify(item.notify);
    setFormError(null);
    setShowAddModal(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError("Event title is required.");
      return;
    }
    if (!formDate) {
      setFormError("Date is required.");
      return;
    }

    const payload: CreateCalendarItemInput = {
      title: formTitle.trim(),
      date: formDate,
      endDate: formEndDate.trim() ? formEndDate.trim() : undefined,
      time: formTime.trim() || "Full day",
      tag: formTag,
      department: formDept.trim() || "All Departments",
      venue: formVenue.trim() ? formVenue.trim() : undefined,
      description: formDesc.trim() ? formDesc.trim() : undefined,
      audience: formAudience,
      notify: formNotify,
    };

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, input: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const departments = useMemo(() => {
    if (!data?.items) return ["All Departments"];
    const set = new Set<string>();
    for (const it of data.items) {
      if (it.department) set.add(it.department);
    }
    return ["All Departments", ...Array.from(set).filter((d) => d !== "All Departments").sort()];
  }, [data?.items]);

  const filteredItems = useMemo(() => {
    if (!data?.items || data.items.length === 0) return [];
    const items = data.items.filter((it) => {
      const matchSearch =
        search === "" ||
        it.title.toLowerCase().includes(search.toLowerCase()) ||
        (it.venue && it.venue.toLowerCase().includes(search.toLowerCase())) ||
        (it.description && it.description.toLowerCase().includes(search.toLowerCase())) ||
        (it.department && it.department.toLowerCase().includes(search.toLowerCase()));

      const matchTag = selectedTag === "All" || it.tag.toLowerCase() === selectedTag.toLowerCase();
      const matchDept =
        selectedDept === "All Departments" ||
        !it.department ||
        it.department === "All Departments" ||
        it.department.toLowerCase() === selectedDept.toLowerCase() ||
        it.department.toLowerCase().includes(selectedDept.toLowerCase()) ||
        selectedDept.toLowerCase().includes(it.department.toLowerCase());

      return matchSearch && matchTag && matchDept;
    });

    return items;
  }, [data?.items, search, selectedTag, selectedDept]);

  // Group items into Timeline sections: All Confirmed Events, Upcoming, Completed
  const timelineGroups = useMemo(() => {
    const activeList = filteredItems;
    if (activeList.length === 0) return [];

    return [
      {
        key: "all_events",
        title: "Official Academic Schedule & Events",
        subtitle: `${activeList.length} scheduled ${activeList.length === 1 ? "entry" : "entries"}`,
        items: activeList,
        active: true,
      },
    ];
  }, [filteredItems, data?.items]);

  // Export iCal .ics file
  const handleExportICS = () => {
    if (!data?.items || data.items.length === 0) return;

    let icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//ColossusIQ//Academic Calendar//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
    ];

    for (const item of data.items) {
      const startClean = item.date.replace(/-/g, "");
      const endClean = (item.endDate || item.date).replace(/-/g, "");
      icsContent.push(
        "BEGIN:VEVENT",
        `UID:${item.id}@colossusiq.edu`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
        `DTSTART;VALUE=DATE:${startClean}`,
        `DTEND;VALUE=DATE:${endClean}`,
        `SUMMARY:${item.title}`,
        `DESCRIPTION:${(item.description || item.title).replace(/\n/g, " ")} [Category: ${item.tag}]`,
        `LOCATION:${item.venue || item.department || "Campus"}`,
        `CATEGORIES:${item.tag}`,
        "STATUS:CONFIRMED",
        "END:VEVENT",
      );
    }

    icsContent.push("END:VCALENDAR");

    const blob = new Blob([icsContent.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `academic-calendar-${data.collegeId || "colossusiq"}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Downloaded iCalendar (.ics) file");
  };

  if (isLoading) return <TemplateSkeleton />;
  if (error || !data) return <LoadError error={error} onRetry={() => refetch()} />;

  const canManage = data.canManage;
  const deptOptions = Array.from(new Set([...data.departments, formDept]));
  const reachText = `${reachOf(formAudience, formDept)}${formDept !== "All Departments" && formAudience !== "Students" && formAudience !== "All" ? " (the department narrows students only)" : ""}`;

  // Month grid helpers
  const currentMonthDate = monthAnchor ?? new Date(`${data.today.slice(0, 7)}-01T00:00:00`);
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  const monthName = currentMonthDate.toLocaleString("default", { month: "long", year: "numeric" });
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setMonthAnchor(new Date(year, month - 1, 1));
  const nextMonth = () => setMonthAnchor(new Date(year, month + 1, 1));

  return (
    <div className="space-y-6">
      {/* Toast banner */}
      {toastMessage && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all",
            toastMessage.tone === "success" ? "bg-teal text-white" : "bg-rose text-white",
          )}
        >
          {toastMessage.tone === "success" ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 opacity-80 hover:opacity-100">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Header Banner & KPIs */}
      <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand">
                <Sparkles className="size-3" />
                {data.semester.name}
              </span>
              <span className="text-xs font-medium text-ink-3">
                Week {data.semester.currentWeek} of {data.semester.totalWeeks}
              </span>
            </div>
            <h2 className="mt-1.5 text-xl font-bold tracking-tight text-ink">
              Official Institutional Academic Calendar
            </h2>
            <p className="text-xs text-ink-2">
              Timetables, internal assessments, national holidays, model exams and university examination windows.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportICS}
              className="flex items-center gap-1.5 text-xs"
              title="Download iCalendar file to sync with Google Calendar or Apple Calendar"
            >
              <Download className="size-3.5" />
              Export .ics
            </Button>

            {canManage && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                  className="flex items-center gap-1.5 text-xs"
                  title="Automatically import published events from Campus Events"
                >
                  <RefreshCw className={cn("size-3.5", syncMutation.isPending && "animate-spin")} />
                  Sync Events
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={openCreateModal}
                  className="flex items-center gap-1.5 text-xs"
                >
                  <Plus className="size-3.5" />
                  Add Calendar Item
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-ink-3">
            <span>Term Start: {fmtLong(data.semester.startDate)}</span>
            <span>Progress: {Math.round((data.semester.currentWeek / data.semester.totalWeeks) * 100)}%</span>
            <span>Term End: {fmtLong(data.semester.endDate)}</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-brand transition-all duration-500"
              style={{ width: `${(data.semester.currentWeek / data.semester.totalWeeks) * 100}%` }}
            />
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-line bg-surface-2/40 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-3">Total Items</span>
              <CalendarDays className="size-4 text-brand" />
            </div>
            <div className="mt-1 text-2xl font-bold text-ink">{data.kpis.totalEvents}</div>
            <div className="text-[11px] text-ink-3">Scheduled this semester</div>
          </div>

          <div className="rounded-xl border border-line bg-surface-2/40 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-3">Assessments</span>
              <BookOpen className="size-4 text-rose" />
            </div>
            <div className="mt-1 text-2xl font-bold text-rose">{data.kpis.assessmentsCount}</div>
            <div className="text-[11px] text-ink-3">IA-I, IA-II & Model tests</div>
          </div>

          <div className="rounded-xl border border-line bg-surface-2/40 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-3">Holidays</span>
              <GraduationCap className="size-4 text-teal" />
            </div>
            <div className="mt-1 text-2xl font-bold text-teal">{data.kpis.holidaysCount}</div>
            <div className="text-[11px] text-ink-3">National & term vacations</div>
          </div>

          <div className="rounded-xl border border-line bg-surface-2/40 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-3">Workshops & Events</span>
              <Sparkles className="size-4 text-gold" />
            </div>
            <div className="mt-1 text-2xl font-bold text-gold">{data.kpis.eventsCount}</div>
            <div className="text-[11px] text-ink-3">Symposiums & tech fests</div>
          </div>
        </div>
      </div>

      {/* Filter and View Mode Switcher */}
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* Search bar */}
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
            <input
              type="text"
              placeholder="Search schedule, exams, venues..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(inputClass, "pl-9 text-xs")}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Department selector */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className={cn(inputClass, "w-auto text-xs py-1.5")}
          >
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 rounded-xl border border-line bg-surface-2/60 p-1 text-xs font-medium">
          <button
            onClick={() => setViewMode("timeline")}
            className={cn(
              "flex items-center gap-1 rounded-lg px-3 py-1.5 transition-all",
              viewMode === "timeline" ? "bg-surface text-brand shadow-xs font-bold" : "text-ink-2 hover:text-ink",
            )}
          >
            <Layers className="size-3.5" />
            Timeline View
          </button>
          <button
            onClick={() => setViewMode("month")}
            className={cn(
              "flex items-center gap-1 rounded-lg px-3 py-1.5 transition-all",
              viewMode === "month" ? "bg-surface text-brand shadow-xs font-bold" : "text-ink-2 hover:text-ink",
            )}
          >
            <CalendarIcon className="size-3.5" />
            Monthly Grid
          </button>
        </div>
      </div>

      {/* Tag Filter Pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-medium text-ink-3 flex items-center gap-1">
          <Filter className="size-3" />
          Filter:
        </span>
        {TAG_FILTERS.map((tag) => {
          const count =
            tag === "All"
              ? data.items.length
              : data.items.filter((it) => it.tag === tag).length;
          return (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                selectedTag === tag
                  ? "bg-brand text-white shadow-xs"
                  : "bg-surface border border-line text-ink-2 hover:bg-surface-2 hover:text-ink",
              )}
            >
              <span>{tag}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 text-[10px]",
                  selectedTag === tag ? "bg-white/20 text-white" : "bg-line text-ink-3",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Content View */}
      {viewMode === "timeline" ? (
        /* Timeline View */
        <div className="space-y-6">
          {timelineGroups.every((g) => g.items.length === 0) ? (
            <EmptyState
              title={data.items.length > 0 ? "No matching entries" : "No calendar items yet"}
              body={data.items.length > 0 ? "Nothing matches the current search or filters." : "No official events or examinations have been scheduled yet."}
              action={
                canManage ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={openCreateModal}
                    className="flex items-center gap-1.5"
                  >
                    <Plus className="size-3.5" />
                    Add Calendar Item
                  </Button>
                ) : undefined
              }
            />
          ) : (
            timelineGroups.map((group) => {
              if (group.items.length === 0) return null;
              return (
                <Card key={group.key} className="overflow-hidden border border-line">
                  <div className="flex items-center justify-between border-b border-line bg-surface/60 px-5 py-3.5">
                    <div>
                      <h3 className="text-sm font-bold text-ink">{group.title}</h3>
                      <p className="text-xs text-ink-3">{group.subtitle}</p>
                    </div>
                    <Badge tone="brand" className="text-xs">
                      {group.items.length} {group.items.length === 1 ? "entry" : "entries"}
                    </Badge>
                  </div>
                  <CardBody className="p-0">
                    <div className="divide-y divide-line">
                      {group.items.map((item) => {
                        const dateObj = new Date(`${item.date}T00:00:00`);
                        const dayNum = dateObj.getDate();
                        const monthStr = dateObj.toLocaleString("default", { month: "short" });
                        const weekdayStr = dateObj.toLocaleString("default", { weekday: "short" });

                        return (
                          <div
                            key={item.id}
                            className="group flex flex-col gap-4 p-4 transition-colors hover:bg-surface/40 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex items-start gap-4">
                              {/* Date chip */}
                              <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-xl border border-line bg-surface text-center shadow-xs">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-brand">
                                  {monthStr}
                                </span>
                                <span className="text-lg font-extrabold leading-none text-ink tabular-nums">
                                  {dayNum}
                                </span>
                                <span className="text-[9px] text-ink-3">{weekdayStr}</span>
                              </div>

                              {/* Details */}
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="text-sm font-bold text-ink">{item.title}</h4>
                                  <Badge tone={tagTone(item.tag)} className="text-[11px]">
                                    {item.tag}
                                  </Badge>
                                  {item.source === "campus_event" && (
                                    <span className="rounded-md bg-gold/10 px-1.5 py-0.5 text-[10px] font-medium text-gold border border-gold/20">
                                      Campus Event
                                    </span>
                                  )}
                                  {item.audience !== "All" && (
                                    <span className="rounded-md bg-line px-1.5 py-0.5 text-[10px] text-ink-2">
                                      For: {item.audience}
                                    </span>
                                  )}
                                </div>

                                {item.description && (
                                  <p className="text-xs text-ink-2 line-clamp-2">{item.description}</p>
                                )}

                                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-ink-3">
                                  <span className="flex items-center gap-1 font-medium text-ink-2">
                                    <Clock className="size-3 text-ink-3" />
                                    {item.time}
                                    {item.endDate && item.endDate !== item.date && (
                                      <span className="text-ink-3">
                                        (until {new Date(`${item.endDate}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })})
                                      </span>
                                    )}
                                  </span>

                                  {item.venue && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="size-3 text-ink-3" />
                                      {item.venue}
                                    </span>
                                  )}

                                  {item.department && item.department !== "All Departments" && (
                                    <span className="flex items-center gap-1">
                                      <Building2 className="size-3 text-ink-3" />
                                      {item.department}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Actions for Manager */}
                            {canManage && !item.readOnly && (
                              <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => openEditModal(item)}
                                  className="h-8 px-2.5 text-xs text-ink hover:border-brand/40 hover:bg-brand-soft hover:text-brand flex items-center gap-1.5 font-medium transition-colors"
                                  title="Edit event"
                                >
                                  <Edit3 className="size-3.5" />
                                  <span>Edit</span>
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => setDeletingId(item.id)}
                                  className="h-8 px-2.5 text-xs text-ink hover:border-rose/40 hover:bg-rose-soft hover:text-rose flex items-center gap-1.5 font-medium transition-colors"
                                  title="Delete event"
                                >
                                  <Trash2 className="size-3.5" />
                                  <span>Delete</span>
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardBody>
                </Card>
              );
            })
          )}
        </div>
      ) : (
        /* Month Grid View */
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <Card className="border border-line">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                <CalendarIcon className="size-4 text-brand" />
                {monthName}
              </h3>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={prevMonth} className="h-8 w-8 p-0">
                  <ChevronLeft className="size-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={nextMonth} className="h-8 w-8 p-0">
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
            <CardBody className="p-4">
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-ink-3 pb-2 border-b border-line">
                <span>Sun</span>
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
              </div>

              {/* Grid cells */}
              <div className="grid grid-cols-7 gap-1 pt-2">
                {/* Empty cells before start of month */}
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-20 rounded-md bg-surface/30 p-1 opacity-40" />
                ))}

                {/* Day cells */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                  const dayEvents = data.items.filter(
                    (it) => it.date === dateStr || (it.endDate && it.date <= dateStr && it.endDate >= dateStr),
                  );
                  const isSelected = selectedDateStr === dateStr;
                  const isToday = dateStr === data.today;

                  return (
                    <div
                      key={dateStr}
                      onClick={() => {
                        setSelectedDateStr(dateStr);
                        setSelectedDayEvents(dayEvents);
                      }}
                      className={cn(
                        "group h-20 rounded-md border p-1.5 transition-all cursor-pointer flex flex-col justify-between overflow-hidden",
                        isSelected
                          ? "border-brand bg-brand/5 ring-1 ring-brand"
                          : "border-line bg-surface hover:bg-surface-2/60",
                        isToday && "bg-brand/10 border-brand/50",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            "inline-flex size-5 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                            isToday ? "bg-brand text-white" : isSelected ? "text-brand font-bold" : "text-ink",
                          )}
                        >
                          {dayNum}
                        </span>
                        {dayEvents.length > 0 && (
                          <span className="text-[10px] font-bold text-ink-3">
                            {dayEvents.length}
                          </span>
                        )}
                      </div>

                      {/* Event dots/indicators */}
                      <div className="space-y-1 overflow-hidden">
                        {dayEvents.slice(0, 2).map((ev) => (
                          <div
                            key={ev.id}
                            className={cn(
                              "truncate rounded px-1 text-[9px] font-medium leading-tight",
                              ev.tag === "Assessment" && "bg-rose/15 text-rose",
                              ev.tag === "Holiday" && "bg-teal/15 text-teal",
                              ev.tag === "Exam cell" && "bg-brand/15 text-brand",
                              ev.tag === "Event" && "bg-gold/15 text-gold",
                              ev.tag === "Milestone" && "bg-sky/15 text-sky",
                            )}
                            title={ev.title}
                          >
                            {ev.title}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-[8px] text-ink-3 font-semibold pl-0.5">
                            +{dayEvents.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          {/* Day Detail Sidebar */}
          <div className="space-y-4">
            <Card className="border border-line">
              <div className="border-b border-line px-4 py-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-ink-3">
                  {selectedDateStr ? (
                    new Date(`${selectedDateStr}T00:00:00`).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  ) : (
                    "Select a date on the calendar"
                  )}
                </h4>
              </div>
              <CardBody className="p-4 space-y-3">
                {selectedDayEvents && selectedDayEvents.length > 0 ? (
                  selectedDayEvents.map((ev) => (
                    <div key={ev.id} className="rounded-lg border border-line bg-surface/50 p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge tone={tagTone(ev.tag)} className="text-[10px]">
                          {ev.tag}
                        </Badge>
                        <span className="text-[10px] text-ink-3">{ev.time}</span>
                      </div>
                      <h5 className="text-xs font-bold text-ink">{ev.title}</h5>
                      {ev.description && <p className="text-[11px] text-ink-2">{ev.description}</p>}
                      {ev.venue && (
                        <p className="text-[10px] text-ink-3 flex items-center gap-1 pt-1">
                          <MapPin className="size-3" />
                          {ev.venue}
                        </p>
                      )}
                      {canManage && !ev.readOnly && (
                        <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-line/60">
                          <button
                            type="button"
                            onClick={() => openEditModal(ev)}
                            className="flex items-center gap-1 rounded border border-line bg-surface px-2 py-0.5 text-[11px] font-medium text-ink-2 hover:border-brand/40 hover:bg-brand-soft hover:text-brand transition-colors"
                            title="Edit event"
                          >
                            <Edit3 className="size-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingId(ev.id)}
                            className="flex items-center gap-1 rounded border border-line bg-surface px-2 py-0.5 text-[11px] font-medium text-ink-2 hover:border-rose/40 hover:bg-rose-soft hover:text-rose transition-colors"
                            title="Delete event"
                          >
                            <Trash2 className="size-3" />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-ink-3 py-6 text-center">
                    {selectedDateStr ? "No scheduled entries on this day." : "Click any day on the monthly grid to inspect scheduled sessions, exams, or holidays."}
                  </p>
                )}

                {canManage && selectedDateStr && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => {
                      resetForm();
                      setFormDate(selectedDateStr);
                      setShowAddModal(true);
                    }}
                  >
                    <Plus className="size-3 mr-1" />
                    Add Entry on this Date
                  </Button>
                )}
              </CardBody>
            </Card>

            {/* Quick tips notice */}
            <div className="rounded-lg border border-brand/20 bg-brand/5 p-4 text-xs text-ink-2 space-y-1">
              <span className="font-bold text-brand block flex items-center gap-1.5">
                <Sparkles className="size-3.5" />
                Sync Notice
              </span>
              <p>
                Entries marked with <span className="font-semibold text-gold">Campus Event</span> automatically reflect public seminars, workshops, and sports meets configured under Campus Events.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => {
              setShowAddModal(false);
              resetForm();
            }}
          />
          <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl transition-all">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-line bg-surface-2/40 px-6 py-4.5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                  <CalendarIcon className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-ink">
                    {editingItem ? "Edit Academic Milestone" : "New Academic Calendar Entry"}
                  </h3>
                  <p className="text-xs text-ink-3">
                    Schedule assessments, holidays, workshops or semester deadlines
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
                className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleFormSubmit}>
              <div className="p-6 space-y-4.5 max-h-[72vh] overflow-y-auto">
                {formError && (
                  <div className="flex items-center gap-2 rounded-xl bg-rose/10 border border-rose/20 p-3 text-xs font-medium text-rose">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Event Title */}
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">
                    Milestone / Event Title <span className="text-rose">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. DBMS Internal Assessment II, Diwali Break, Techno Fest 2026"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>

                {/* Category Selection Card Grid */}
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">
                    Category <span className="text-rose">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {[
                      { tag: "Assessment", label: "Assessment", sub: "IA & Model Tests", dot: "bg-rose" },
                      { tag: "Holiday", label: "Holiday", sub: "Leaves & Vacation", dot: "bg-teal" },
                      { tag: "Exam cell", label: "Exam Cell", sub: "Timetables & Circulars", dot: "bg-brand" },
                      { tag: "Event", label: "Event", sub: "Workshops & Fests", dot: "bg-gold" },
                      { tag: "Milestone", label: "Milestone", sub: "Semester Dates", dot: "bg-sky" },
                    ].map((c) => {
                      const isSelected = formTag === c.tag;
                      return (
                        <button
                          key={c.tag}
                          type="button"
                          onClick={() => setFormTag(c.tag as any)}
                          className={cn(
                            "flex flex-col items-start rounded-xl border p-2.5 text-left transition-all",
                            isSelected
                              ? "border-brand bg-brand/5 ring-2 ring-brand/20 shadow-xs"
                              : "border-line bg-surface hover:bg-surface-2/60",
                          )}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className={cn("size-2 rounded-full", c.dot)} />
                            <span className={cn("text-xs font-bold", isSelected ? "text-brand" : "text-ink")}>
                              {c.label}
                            </span>
                          </div>
                          <span className="mt-0.5 text-[10px] text-ink-3">{c.sub}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Date & End Date */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1.5">
                      Start Date <span className="text-rose">*</span>
                    </label>
                    <input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className={inputClass}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1.5">
                      End Date <span className="text-[11px] font-normal text-ink-3">(For multi-day events)</span>
                    </label>
                    <input
                      type="date"
                      value={formEndDate}
                      onChange={(e) => setFormEndDate(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Time slot with quick presets */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-ink">Time Slot / Schedule</label>
                    <div className="flex items-center gap-1 text-[11px] text-ink-3">
                      <span>Quick fill:</span>
                      {["Full day", "09:30 AM - 12:30 PM", "02:00 PM - 05:00 PM"].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setFormTime(preset)}
                          className="rounded-md bg-surface-2 px-1.5 py-0.5 hover:bg-surface-2/80 hover:text-brand transition-colors text-[10px]"
                        >
                          {preset === "Full day" ? "Full day" : preset.slice(0, 8)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. 10:00 AM - 12:00 PM or Full day"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className={inputClass}
                  />
                </div>

                {/* Target Audience & Department */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1.5">Target Audience</label>
                    <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface-2/40 p-1 text-xs">
                      {(["All", "Students", "Faculty", "Staff"] as const).map((aud) => (
                        <button
                          key={aud}
                          type="button"
                          onClick={() => setFormAudience(aud)}
                          className={cn(
                            "rounded-lg py-1.5 text-center text-xs font-medium transition-all",
                            formAudience === aud
                              ? "bg-surface text-brand font-bold shadow-xs"
                              : "text-ink-2 hover:text-ink",
                          )}
                        >
                          {aud === "All" ? "All Campus" : aud}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1.5">Department / Scope</label>
                    <select
                      value={formDept}
                      onChange={(e) => setFormDept(e.target.value)}
                      className={inputClass}
                    >
                      {deptOptions.map((d) => (
                        <option key={d} value={d}>
                          {d === "All Departments" ? "All Departments (Campus Wide)" : d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Notify the selected people */}
                <label className="flex items-start gap-3 rounded-xl border border-line bg-surface-2/40 p-3 text-xs">
                  <input
                    type="checkbox"
                    checked={formNotify}
                    onChange={(e) => setFormNotify(e.target.checked)}
                    className="mt-0.5 size-4 accent-brand"
                  />
                  <span>
                    <span className="block font-semibold text-ink">
                      {editingItem ? "Notify again about this change" : "Notify the selected people"}
                    </span>
                    <span className="text-ink-3">
                      {formNotify ? `A notification goes to ${reachText}.` : "Saved on the calendar without sending a notification."}
                    </span>
                  </span>
                </label>

                {/* Venue */}
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">
                    Venue / Location <span className="text-[11px] font-normal text-ink-3">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Seminar Hall 2, Central Exam Hall A, Campus Quadrangle"
                    value={formVenue}
                    onChange={(e) => setFormVenue(e.target.value)}
                    className={inputClass}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">
                    Instructions / Description <span className="text-[11px] font-normal text-ink-3">(Optional)</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Additional context, syllabus coverage, or instructions for students..."
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-line bg-surface-2/40 px-6 py-4">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <Spinner className="size-4 mr-2" />
                  ) : editingItem ? (
                    formNotify ? "Save & Notify" : "Save Changes"
                  ) : (
                    formNotify ? "Create & Notify" : "Create Calendar Entry"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDeletingId(null)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose">
              <div className="flex size-10 items-center justify-center rounded-xl bg-rose/10">
                <Trash2 className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-ink">Delete Calendar Milestone?</h3>
                <p className="text-xs text-ink-3">This action cannot be undone.</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-ink-2 leading-relaxed">
              Are you sure you want to remove this entry from the official academic calendar? Students and faculty will no longer see it on their portal schedule.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setDeletingId(null)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="md"
                onClick={() => deleteMutation.mutate(deletingId)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? <Spinner className="size-4 mr-2" /> : "Delete Entry"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
