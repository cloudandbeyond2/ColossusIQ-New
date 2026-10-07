"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Search,
  Users,
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  GraduationCap,
  Plus,
  Download,
  Check,
  X,
  BarChart3,
  History,
  MapPin,
  ChevronRight,
  Send,
  UserCheck,
} from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import type { Role } from "@/lib/auth/roles";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Progress,
  Spinner,
  inputClass,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import type {
  AllocatedClassSection,
  ClassTimetableSlot,
  StudentRosterItem,
  AttendanceSessionRecord,
  FacultyAllocationProfile,
} from "@/lib/api/mock/faculty-allocation";

/* ── Tab Keys ────────────────────────────────────────────────────────────── */
type ActiveTab = "sections" | "timetable" | "attendance" | "performance" | "history";

/* ── Days of Week ────────────────────────────────────────────────────────── */
const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export function MyClassesModule({ role: _role }: { role?: Role }) {
  const qc = useQueryClient();

  // Active view tab
  const [activeTab, setActiveTab] = useState<ActiveTab>("sections");

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("all");
  const [selectedDay, setSelectedDay] = useState<string>(() => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const today = days[new Date().getDay()] || "Monday";
    return DAYS_OF_WEEK.includes(today as (typeof DAYS_OF_WEEK)[number]) ? today : "Monday";
  });

  // Selected section for detailed views & attendance
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");

  // Modals state
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);
  const [rosterSection, setRosterSection] = useState<AllocatedClassSection | null>(null);
  const [isExtraClassModalOpen, setIsExtraClassModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // Helper toast
  const showToast = (text: string, ok = true) => {
    setToastMessage({ text, ok });
    setTimeout(() => setToastMessage(null), 4500);
  };

  /* ── 1. Fetch Faculty Allocation Profile ────────────────────────────────── */
  const { data: profile, isLoading, isError, refetch } = useQuery<FacultyAllocationProfile>({
    queryKey: ["faculty-allocations"],
    queryFn: () => apiFetch("/api/v1/faculty/me/allocations", z.any()),
  });

  // Default selected section once data loads
  useEffect(() => {
    if (profile?.assignedSections && profile.assignedSections.length > 0 && !selectedSectionId) {
      const first = profile.assignedSections[0];
      if (first) {
        setSelectedSectionId(first.id);
      }
    }
  }, [profile, selectedSectionId]);

  /* ── 2. Fetch Attendance History ────────────────────────────────────────── */
  const { data: attendanceData } = useQuery<{ sessions: AttendanceSessionRecord[] }>({
    queryKey: ["faculty-attendance"],
    queryFn: () => apiFetch("/api/v1/faculty/attendance", z.any()),
  });

  const attendanceSessions = attendanceData?.sessions || profile?.recentAttendance || [];

  /* ── 3. Fetch Roster for Selected Section ───────────────────────────────── */
  const currentSectionIdForRoster = rosterSection?.id || selectedSectionId;
  const { data: rosterData } = useQuery<{ students: StudentRosterItem[] }>({
    queryKey: ["section-roster", currentSectionIdForRoster],
    queryFn: () => apiFetch(`/api/v1/faculty/classes/${currentSectionIdForRoster}/roster`, z.any()),
    enabled: Boolean(currentSectionIdForRoster),
  });

  const studentsRoster = rosterData?.students || [];

  /* ── 4. Interactive Attendance Marker State ──────────────────────────────── */
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [attendancePeriod, setAttendancePeriod] = useState(1);
  const [attendanceTopic, setAttendanceTopic] = useState("");
  const [rosterSearch, setRosterSearch] = useState("");
  const [attendanceMarks, setAttendanceMarks] = useState<Record<string, "Present" | "Absent" | "Late" | "OD">>({});
  const [studentRemarks, setStudentRemarks] = useState<Record<string, string>>({});

  // Sync attendance marks whenever student roster loads for a section
  useEffect(() => {
    if (studentsRoster.length > 0) {
      const initial: Record<string, "Present" | "Absent" | "Late" | "OD"> = {};
      studentsRoster.forEach((s) => {
        initial[s.id] = s.status || "Present";
      });
      setAttendanceMarks(initial);
    }
  }, [studentsRoster]);

  // Attendance status counts
  const attendanceStats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let od = 0;
    const total = studentsRoster.length;
    studentsRoster.forEach((s) => {
      const st = attendanceMarks[s.id] || "Present";
      if (st === "Present") present++;
      else if (st === "Absent") absent++;
      else if (st === "Late") late++;
      else if (st === "OD") od++;
    });
    const effectivePresent = present + late + od;
    const percent = total > 0 ? Math.round((effectivePresent / total) * 100) : 100;
    return { present, absent, late, od, total, percent };
  }, [studentsRoster, attendanceMarks]);

  // Bulk actions
  const handleMarkAll = (status: "Present" | "Absent") => {
    const updated: Record<string, "Present" | "Absent" | "Late" | "OD"> = {};
    studentsRoster.forEach((s) => {
      updated[s.id] = status;
    });
    setAttendanceMarks(updated);
  };

  const toggleStudentStatus = (id: string, status: "Present" | "Absent" | "Late" | "OD") => {
    setAttendanceMarks((prev) => ({ ...prev, [id]: status }));
  };

  /* ── 5. Save Attendance Mutation ────────────────────────────────────────── */
  const saveAttendanceMutation = useMutation({
    mutationFn: async () => {
      const currentSec = profile?.assignedSections.find((s) => s.id === selectedSectionId);
      if (!currentSec) throw new Error("Please select a class section first.");

      const absentRolls = studentsRoster
        .filter((s) => attendanceMarks[s.id] === "Absent")
        .map((s) => s.rollNo);

      const records = studentsRoster.map((s) => ({
        studentId: s.id,
        rollNo: s.rollNo,
        name: s.name,
        status: attendanceMarks[s.id] || "Present",
        remark: studentRemarks[s.id] || undefined,
      }));

      return apiFetch("/api/v1/faculty/attendance", z.any(), {
        method: "POST",
        body: {
          sectionId: currentSec.id,
          courseCode: currentSec.courseCode,
          courseTitle: currentSec.courseTitle,
          section: currentSec.section,
          date: attendanceDate,
          timeSlot: `${attendancePeriod === 1 ? "09:00 - 10:00" : attendancePeriod === 2 ? "10:00 - 11:00" : "11:15 - 12:15"}`,
          period: attendancePeriod,
          topicTaught: attendanceTopic.trim() || `${currentSec.shortName} Lecture Session`,
          totalStudents: studentsRoster.length,
          presentCount: attendanceStats.present,
          absentCount: attendanceStats.absent,
          lateCount: attendanceStats.late,
          odCount: attendanceStats.od,
          attendancePercent: attendanceStats.percent,
          absentRolls,
          records,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["faculty-allocations"] });
      qc.invalidateQueries({ queryKey: ["faculty-attendance"] });
      qc.invalidateQueries({ queryKey: ["section-roster"] });
      showToast("Attendance marked and saved successfully!");
      setIsAttendanceModalOpen(false);
    },
    onError: (err: any) => {
      showToast(err?.message || "Failed to save attendance record", false);
    },
  });

  /* ── 6. Extra Class Mutation ────────────────────────────────────────────── */
  const [extraClassData, setExtraClassData] = useState({
    day: "Saturday",
    period: 2,
    time: "10:00 - 11:00",
    room: "LH-204",
    topic: "Compensatory Tutorial & Problem Solving",
  });

  const extraClassMutation = useMutation({
    mutationFn: async () => {
      const currentSec = profile?.assignedSections.find((s) => s.id === selectedSectionId);
      if (!currentSec) throw new Error("Select section");
      return apiFetch("/api/v1/faculty/classes/extra", z.any(), {
        method: "POST",
        body: {
          day: extraClassData.day,
          period: Number(extraClassData.period),
          time: extraClassData.time,
          courseCode: currentSec.courseCode,
          courseTitle: currentSec.courseTitle,
          shortName: currentSec.shortName,
          section: currentSec.section,
          sectionId: currentSec.id,
          room: extraClassData.room,
          topic: extraClassData.topic,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["faculty-allocations"] });
      showToast("Extra class added to schedule!");
      setIsExtraClassModalOpen(false);
    },
    onError: (err: any) => {
      showToast(err?.message || "Failed to schedule extra class", false);
    },
  });

  /* ── Export CSV Helper ──────────────────────────────────────────────────── */
  const handleExportCSV = () => {
    if (attendanceSessions.length === 0) {
      showToast("No attendance logs to export", false);
      return;
    }
    const headers = ["Date", "Period", "Time Slot", "Section", "Course Code", "Topic", "Total", "Present", "Absent", "Attendance %", "Absent Roll Numbers"];
    const rows = attendanceSessions.map((s) => [
      s.date,
      s.period,
      `"${s.timeSlot}"`,
      `"${s.section}"`,
      `"${s.courseCode}"`,
      `"${s.topicTaught.replace(/"/g, '""')}"`,
      s.totalStudents,
      s.presentCount,
      s.absentCount,
      `${s.attendancePercent}%`,
      `"${s.absentRolls.join(", ")}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `attendance_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Attendance CSV log exported!");
  };

  /* ── Filtered Sections ──────────────────────────────────────────────────── */
  const filteredSections = useMemo(() => {
    if (!profile?.assignedSections) return [];
    return profile.assignedSections.filter((sec) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        sec.section.toLowerCase().includes(q) ||
        sec.courseTitle.toLowerCase().includes(q) ||
        sec.courseCode.toLowerCase().includes(q) ||
        sec.room.toLowerCase().includes(q);

      const matchSemester =
        semesterFilter === "all" ||
        sec.section.toLowerCase().includes(semesterFilter.toLowerCase());

      return matchQuery && matchSemester;
    });
  }, [profile?.assignedSections, searchQuery, semesterFilter]);

  /* ── Timetable Slots for Selected Day ───────────────────────────────────── */
  const dayTimetable = useMemo(() => {
    if (!profile?.timetable) return [];
    return profile.timetable
      .filter((slot) => slot.day === selectedDay)
      .sort((a, b) => a.period - b.period);
  }, [profile?.timetable, selectedDay]);

  const activeSection = useMemo(() => {
    if (!profile?.assignedSections || profile.assignedSections.length === 0) return null;
    return profile.assignedSections.find((s) => s.id === selectedSectionId) || profile.assignedSections[0] || null;
  }, [profile?.assignedSections, selectedSectionId]);

  /* ── Render States ──────────────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="space-y-6 py-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface-2/60" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-surface-2/40" />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <Card className="my-6 p-8 text-center">
        <EmptyState
          title="Could not load your classes"
          body="There was an issue fetching your allocated courses and sections. Please verify your connection or try again."
          action={<Button onClick={() => void refetch()}>Try Again</Button>}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6 pb-12 pt-2">
      {/* ── Toast Notification ── */}
      {toastMessage && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-[250] flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-2xl transition-all animate-in slide-in-from-bottom-3",
            toastMessage.ok ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
          )}
        >
          {toastMessage.ok ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertTriangle className="size-4 shrink-0" />}
          {toastMessage.text}
        </div>
      )}

      {/* ── 1. Top KPI Summary Cards ── */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <Card className="relative overflow-hidden border-line/60 bg-surface/90 p-4 transition-all hover:border-brand/40 hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-3">Teaching Load</span>
            <div className="rounded-lg bg-brand/10 p-2 text-brand">
              <Clock className="size-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-ink">{profile.totalTeachingLoad}</span>
            <span className="text-xs font-medium text-ink-3">hrs / week</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">Department: {profile.departmentCode}</p>
        </Card>

        <Card className="relative overflow-hidden border-line/60 bg-surface/90 p-4 transition-all hover:border-brand/40 hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-3">Assigned Sections</span>
            <div className="rounded-lg bg-teal-500/10 p-2 text-teal-600 dark:text-teal-400">
              <BookOpen className="size-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-ink">{profile.assignedSections.length}</span>
            <span className="text-xs font-medium text-teal-600 dark:text-teal-400">Active</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">Across {profile.department}</p>
        </Card>

        <Card className="relative overflow-hidden border-line/60 bg-surface/90 p-4 transition-all hover:border-brand/40 hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-3">Enrolled Students</span>
            <div className="rounded-lg bg-sky-500/10 p-2 text-sky-600 dark:text-sky-400">
              <Users className="size-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-ink">{profile.totalStudents}</span>
            <span className="text-xs font-medium text-ink-3">students</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">In your lecture batches</p>
        </Card>

        <Card className="relative overflow-hidden border-line/60 bg-surface/90 p-4 transition-all hover:border-brand/40 hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-3">Avg. Attendance</span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-ink">{profile.averageAttendance}%</span>
            <Badge tone={profile.averageAttendance >= 80 ? "teal" : "amber"} className="text-[10px]">
              {profile.averageAttendance >= 80 ? "Healthy" : "Attention"}
            </Badge>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">Institution benchmark: 75%</p>
        </Card>
      </div>

      {/* ── 2. Top Action Banner & Quick Trigger ── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-line/80 bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand font-bold">
            <GraduationCap className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-ink">{profile.name}</h2>
              <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
                {profile.designation}
              </span>
            </div>
            <p className="text-xs text-ink-3">
              {profile.department} · {profile.stream.toUpperCase()} Stream
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={() => {
              if (profile.assignedSections[0]) {
                setSelectedSectionId(profile.assignedSections[0].id);
              }
              setIsAttendanceModalOpen(true);
            }}
            className="shadow-sm"
          >
            <UserCheck className="size-4" />
            Take Attendance
          </Button>

          <Button
            variant="secondary"
            onClick={() => setIsExtraClassModalOpen(true)}
            className="gap-1.5"
          >
            <Plus className="size-3.5" />
            Add Extra Class
          </Button>

          <Button
            variant="ghost"
            onClick={handleExportCSV}
            title="Export Attendance Sheet (CSV)"
            className="text-xs gap-1.5"
          >
            <Download className="size-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ── 3. Tabbed Navigation Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-2">
        <div className="flex flex-wrap gap-1.5" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "sections"}
            onClick={() => setActiveTab("sections")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all",
              activeTab === "sections"
                ? "bg-brand text-white shadow-sm"
                : "text-ink-2 hover:bg-surface-2 hover:text-ink"
            )}
          >
            <BookOpen className="size-3.5" />
            Assigned Sections ({profile.assignedSections.length})
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "timetable"}
            onClick={() => setActiveTab("timetable")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all",
              activeTab === "timetable"
                ? "bg-brand text-white shadow-sm"
                : "text-ink-2 hover:bg-surface-2 hover:text-ink"
            )}
          >
            <Calendar className="size-3.5" />
            Weekly Timetable
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "attendance"}
            onClick={() => setActiveTab("attendance")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all",
              activeTab === "attendance"
                ? "bg-brand text-white shadow-sm"
                : "text-ink-2 hover:bg-surface-2 hover:text-ink"
            )}
          >
            <UserCheck className="size-3.5" />
            Live Attendance Register
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "performance"}
            onClick={() => setActiveTab("performance")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all",
              activeTab === "performance"
                ? "bg-brand text-white shadow-sm"
                : "text-ink-2 hover:bg-surface-2 hover:text-ink"
            )}
          >
            <BarChart3 className="size-3.5" />
            Class Performance & Mastery
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "history"}
            onClick={() => setActiveTab("history")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all",
              activeTab === "history"
                ? "bg-brand text-white shadow-sm"
                : "text-ink-2 hover:bg-surface-2 hover:text-ink"
            )}
          >
            <History className="size-3.5" />
            Attendance History ({attendanceSessions.length})
          </button>
        </div>
      </div>

      {/* ── TAB 1: Assigned Sections & Courses ─────────────────────────── */}
      {activeTab === "sections" && (
        <div className="space-y-5 animate-in fade-in-50 duration-200">
          {/* Search & Filter Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search my classes, subjects, rooms..."
                className={cn(inputClass, "pl-9 text-xs")}
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={semesterFilter}
                onChange={(e) => setSemesterFilter(e.target.value)}
                className="rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-ink focus:outline-none focus:ring-2 focus:ring-brand"
              >
                <option value="all">All Semesters</option>
                <option value="Sem 3">Semester 3</option>
                <option value="Sem 5">Semester 5</option>
                <option value="Sem 7">Semester 7</option>
              </select>
            </div>
          </div>

          {filteredSections.length === 0 ? (
            <Card className="p-8 text-center">
              <EmptyState
                title="No matching classes found"
                body="Try adjusting your search query or semester filter."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearchQuery("");
                      setSemesterFilter("all");
                    }}
                  >
                    Clear Filters
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="grid gap-4.5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredSections.map((sec) => (
                <Card
                  key={sec.id}
                  className="flex flex-col justify-between overflow-hidden border-line/70 bg-surface transition-all hover:border-brand/40 hover:shadow-md"
                >
                  <div className="p-5">
                    {/* Top Row: Course Code & Section */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="inline-block rounded-md bg-brand/10 px-2 py-0.5 text-[11px] font-bold text-brand">
                          {sec.courseCode}
                        </span>
                        <span className="ml-2 rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-2">
                          {sec.section}
                        </span>
                      </div>
                      <Badge tone="neutral" className="text-[10px]">
                        {sec.hoursPerWeek} hrs/wk
                      </Badge>
                    </div>

                    {/* Course Title */}
                    <h3 className="mt-2.5 text-base font-semibold leading-snug text-ink">
                      {sec.courseTitle}
                    </h3>

                    {/* Meta info: Room & Next Class */}
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-3">
                      <span className="flex items-center gap-1 font-medium">
                        <MapPin className="size-3.5 text-brand" /> {sec.room}
                      </span>
                      <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                        <Clock className="size-3.5" /> Next: {sec.nextClass}
                      </span>
                    </div>

                    {/* Key Metrics: Students, Attendance, Avg Score */}
                    <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-surface-2/50 p-2.5 text-center text-xs">
                      <div>
                        <p className="text-[10px] text-ink-3 font-medium">Students</p>
                        <p className="mt-0.5 font-bold text-ink">{sec.studentsCount}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-ink-3 font-medium">Attendance</p>
                        <p className={cn("mt-0.5 font-bold", sec.attendancePercent >= 80 ? "text-emerald-600" : "text-amber-600")}>
                          {sec.attendancePercent}%
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-ink-3 font-medium">Avg Score</p>
                        <p className="mt-0.5 font-bold text-teal-600 dark:text-teal-400">
                          {sec.averageScore}%
                        </p>
                      </div>
                    </div>

                    {/* Syllabus / Unit Mastery preview */}
                    {sec.units && sec.units.length > 0 && (
                      <div className="mt-4 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-ink-3">
                          <span>Syllabus Mastery</span>
                          <span>{sec.units.length} Units</span>
                        </div>
                        <div className="flex gap-1">
                          {sec.units.map((u) => (
                            <div
                              key={u.id}
                              title={`${u.unit}: ${u.title} (${u.classMastery}%)`}
                              className={cn(
                                "h-1.5 flex-1 rounded-full",
                                u.classMastery >= 75
                                  ? "bg-emerald-500"
                                  : u.classMastery >= 50
                                  ? "bg-amber-400"
                                  : "bg-rose-400"
                              )}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="border-t border-line/60 bg-surface-2/20 p-3.5">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedSectionId(sec.id);
                          setIsAttendanceModalOpen(true);
                        }}
                        className="text-xs"
                      >
                        <UserCheck className="size-3.5" />
                        Take Attendance
                      </Button>

                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setRosterSection(sec);
                          setIsRosterModalOpen(true);
                        }}
                        className="text-xs"
                      >
                        <Users className="size-3.5" />
                        View Roster
                      </Button>
                    </div>

                    <div className="mt-2 flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSectionId(sec.id);
                          setActiveTab("performance");
                        }}
                        className="text-[11px] font-semibold text-brand hover:underline flex items-center gap-1"
                      >
                        Unit Breakdown <ChevronRight className="size-3" />
                      </button>
                      <span className="text-[10px] text-ink-3 font-medium">
                        Semester 2026-27
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: Weekly Timetable & Schedule ─────────────────────────── */}
      {activeTab === "timetable" && (
        <div className="space-y-5 animate-in fade-in-50 duration-200">
          {/* Day Selector Pills */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5 bg-surface-2/60 p-1 rounded-2xl border border-line">
              {DAYS_OF_WEEK.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    "rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all",
                    selectedDay === day
                      ? "bg-surface text-ink shadow-sm font-bold border border-line"
                      : "text-ink-3 hover:text-ink"
                  )}
                >
                  {day}
                </button>
              ))}
            </div>

            <Button
              size="sm"
              variant="secondary"
              onClick={() => setIsExtraClassModalOpen(true)}
              className="gap-1.5 text-xs"
            >
              <Plus className="size-3.5" />
              Add Extra / Compensatory Class
            </Button>
          </div>

          {/* Schedule List for the day */}
          {dayTimetable.length === 0 ? (
            <Card className="p-8 text-center">
              <EmptyState
                title={`No classes scheduled on ${selectedDay}`}
                body="You do not have any regular teaching periods assigned on this day."
                action={
                  <Button
                    size="sm"
                    onClick={() => setIsExtraClassModalOpen(true)}
                  >
                    Schedule an Extra Class
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {dayTimetable.map((slot) => {
                const isNextSlot = slot.period === 1;
                return (
                  <Card
                    key={slot.id}
                    className={cn(
                      "flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between transition-all",
                      isNextSlot
                        ? "border-brand/40 bg-brand/[0.02] shadow-sm ring-1 ring-brand/20"
                        : "border-line bg-surface"
                    )}
                  >
                    <div className="flex items-start gap-4">
                      {/* Period & Time Column */}
                      <div className="flex flex-col items-center justify-center rounded-xl bg-surface-2 px-3 py-2 min-w-24 text-center">
                        <span className="text-xs font-bold text-brand">Period {slot.period}</span>
                        <span className="text-[11px] font-medium text-ink-3">{slot.time}</span>
                      </div>

                      {/* Course Details */}
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand">
                            {slot.courseCode}
                          </span>
                          <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-semibold text-ink-2">
                            {slot.section}
                          </span>
                          {slot.isLab && (
                            <Badge tone="sky" className="text-[10px]">Practical Lab</Badge>
                          )}
                          {isNextSlot && (
                            <Badge tone="teal" className="text-[10px] animate-pulse">
                              Scheduled Next
                            </Badge>
                          )}
                        </div>

                        <h4 className="mt-1 text-sm font-semibold text-ink">
                          {slot.courseTitle}
                        </h4>

                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-ink-3">
                          <span className="flex items-center gap-1 font-medium">
                            <MapPin className="size-3 text-brand" /> {slot.room}
                          </span>
                          {slot.topic && (
                            <span className="flex items-center gap-1 italic text-ink-2">
                              <BookOpen className="size-3" /> Topic: {slot.topic}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 sm:self-center">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedSectionId(slot.sectionId);
                          setAttendancePeriod(slot.period);
                          setAttendanceTopic(slot.topic || `${slot.shortName} Period ${slot.period}`);
                          setIsAttendanceModalOpen(true);
                        }}
                        className="text-xs"
                      >
                        <UserCheck className="size-3.5" />
                        Mark Attendance
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: Live Attendance Register ────────────────────────────── */}
      {activeTab === "attendance" && (
        <div className="space-y-5 animate-in fade-in-50 duration-200">
          {/* Controls Bar: Section Selector, Date, Period, Topic */}
          <Card className="p-4 border-line/80 bg-surface">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="text-xs font-semibold text-ink-2">Class Section</label>
                <select
                  value={selectedSectionId}
                  onChange={(e) => setSelectedSectionId(e.target.value)}
                  className={cn(inputClass, "mt-1.5 text-xs")}
                >
                  {profile.assignedSections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.section} · {sec.courseCode} ({sec.shortName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-ink-2">Date</label>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className={cn(inputClass, "mt-1.5 text-xs")}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-ink-2">Period Slot</label>
                <select
                  value={attendancePeriod}
                  onChange={(e) => setAttendancePeriod(Number(e.target.value))}
                  className={cn(inputClass, "mt-1.5 text-xs")}
                >
                  <option value={1}>Period 1 (09:00 - 10:00)</option>
                  <option value={2}>Period 2 (10:00 - 11:00)</option>
                  <option value={3}>Period 3 (11:15 - 12:15)</option>
                  <option value={4}>Period 4 (13:15 - 14:15)</option>
                  <option value={5}>Period 5 (14:15 - 15:15)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-ink-2">Topic Covered</label>
                <input
                  type="text"
                  placeholder="e.g. Unit 3: Normalization 3NF & BCNF"
                  value={attendanceTopic}
                  onChange={(e) => setAttendanceTopic(e.target.value)}
                  className={cn(inputClass, "mt-1.5 text-xs")}
                />
              </div>
            </div>
          </Card>

          {/* Live Roster Summary & Bulk Action Bar */}
          <div className="flex flex-col gap-3 rounded-2xl bg-surface-2/60 p-4 border border-line sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5 font-semibold text-ink">
                <Users className="size-4 text-brand" /> Total: {attendanceStats.total}
              </span>
              <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                <Check className="size-4" /> Present: {attendanceStats.present}
              </span>
              <span className="flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
                <X className="size-4" /> Absent: {attendanceStats.absent}
              </span>
              <span className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                Late: {attendanceStats.late}
              </span>
              <span className="flex items-center gap-1 font-semibold text-sky-600 dark:text-sky-400">
                OD: {attendanceStats.od}
              </span>
              <div className="rounded-md bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                Rate: {attendanceStats.percent}%
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleMarkAll("Present")}
                className="text-xs"
              >
                Mark All Present
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleMarkAll("Absent")}
                className="text-xs text-rose-600 dark:text-rose-400 hover:border-rose-300"
              >
                Mark All Absent
              </Button>
              <Button
                size="sm"
                onClick={() => saveAttendanceMutation.mutate()}
                disabled={saveAttendanceMutation.isPending}
                className="text-xs shadow-sm"
              >
                {saveAttendanceMutation.isPending ? <Spinner className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
                Save Attendance Record
              </Button>
            </div>
          </div>

          {/* Student Roster Table for Attendance Marking */}
          <Card className="overflow-hidden border-line">
            <div className="p-3.5 border-b border-line bg-surface flex items-center justify-between">
              <div className="relative max-w-sm flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
                <input
                  type="search"
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  placeholder="Filter student by roll no or name..."
                  className={cn(inputClass, "pl-8 py-1.5 text-xs")}
                />
              </div>
              <span className="text-xs text-ink-3 font-medium">
                Click status pill to toggle P / A / L / OD
              </span>
            </div>

            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-surface-2 text-[11px] font-bold uppercase tracking-wider text-ink-3 border-b border-line">
                  <tr>
                    <th className="px-4 py-3">Roll No.</th>
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-3 py-3">Overall Att.</th>
                    <th className="px-3 py-3">Risk Signal</th>
                    <th className="px-4 py-3 text-center">Status Toggle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60 bg-surface">
                  {studentsRoster
                    .filter((s) => {
                      const q = rosterSearch.toLowerCase().trim();
                      return !q || s.name.toLowerCase().includes(q) || s.rollNo.toLowerCase().includes(q);
                    })
                    .map((s) => {
                      const status = attendanceMarks[s.id] || "Present";
                      return (
                        <tr
                          key={s.id}
                          className={cn(
                            "transition-colors hover:bg-surface-2/40",
                            status === "Absent" && "bg-rose-50/40 dark:bg-rose-950/20"
                          )}
                        >
                          <td className="px-4 py-2.5 font-mono font-semibold text-ink">
                            {s.rollNo}
                          </td>
                          <td className="px-4 py-2.5 font-medium text-ink">
                            {s.name}
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={cn(
                                "font-semibold",
                                s.attendancePercent >= 75 ? "text-emerald-600" : "text-rose-600"
                              )}
                            >
                              {s.attendancePercent}%
                            </span>
                            <span className="ml-1 text-[10px] text-ink-3">({s.classesAttended}/{s.totalClasses})</span>
                          </td>
                          <td className="px-3 py-2.5">
                            {s.riskSignal === "Attendance Warning" ? (
                              <Badge tone="rose" className="text-[10px]">Low Att.</Badge>
                            ) : s.riskSignal === "Low Mastery" ? (
                              <Badge tone="amber" className="text-[10px]">Low Mastery</Badge>
                            ) : s.riskSignal === "Top Performer" ? (
                              <Badge tone="teal" className="text-[10px]">Top Rank</Badge>
                            ) : (
                              <span className="text-[10px] text-ink-3">Normal</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => toggleStudentStatus(s.id, "Present")}
                                className={cn(
                                  "size-7 rounded-lg text-[11px] font-bold transition-all",
                                  status === "Present"
                                    ? "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500"
                                    : "bg-surface-2 text-ink-3 hover:bg-emerald-100 hover:text-emerald-700"
                                )}
                              >
                                P
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleStudentStatus(s.id, "Absent")}
                                className={cn(
                                  "size-7 rounded-lg text-[11px] font-bold transition-all",
                                  status === "Absent"
                                    ? "bg-rose-600 text-white shadow-sm ring-1 ring-rose-500"
                                    : "bg-surface-2 text-ink-3 hover:bg-rose-100 hover:text-rose-700"
                                )}
                              >
                                A
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleStudentStatus(s.id, "Late")}
                                className={cn(
                                  "size-7 rounded-lg text-[11px] font-bold transition-all",
                                  status === "Late"
                                    ? "bg-amber-500 text-white shadow-sm ring-1 ring-amber-400"
                                    : "bg-surface-2 text-ink-3 hover:bg-amber-100 hover:text-amber-700"
                                )}
                              >
                                L
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleStudentStatus(s.id, "OD")}
                                className={cn(
                                  "size-7 rounded-lg text-[11px] font-bold transition-all",
                                  status === "OD"
                                    ? "bg-sky-600 text-white shadow-sm ring-1 ring-sky-500"
                                    : "bg-surface-2 text-ink-3 hover:bg-sky-100 hover:text-sky-700"
                                )}
                              >
                                OD
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-surface-2/40 border-t border-line flex items-center justify-between">
              <span className="text-xs text-ink-3">
                Showing {studentsRoster.length} students enrolled in {activeSection?.section}
              </span>
              <Button
                size="sm"
                onClick={() => saveAttendanceMutation.mutate()}
                disabled={saveAttendanceMutation.isPending}
                className="text-xs"
              >
                {saveAttendanceMutation.isPending ? <Spinner className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
                Confirm & Submit Attendance
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── TAB 4: Class Performance & Mastery ─────────────────────────── */}
      {activeTab === "performance" && activeSection && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          {/* Section Selector for Analytics */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-ink">
                Class Diagnostic & Mastery Overview
              </h3>
              <p className="text-xs text-ink-3">
                Continuous Assessment signals, unit-wise competency and attendance threshold tracking.
              </p>
            </div>

            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink"
            >
              {profile.assignedSections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.section} · {sec.courseCode} ({sec.courseTitle})
                </option>
              ))}
            </select>
          </div>

          {/* Unit Mastery Progress Bars */}
          <Card className="p-5 border-line">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h4 className="text-sm font-semibold text-ink">
                  {activeSection.courseTitle} ({activeSection.courseCode})
                </h4>
                <p className="text-xs text-ink-3">
                  Syllabus Units Mastery Breakdown for {activeSection.section}
                </p>
              </div>
              <Badge tone="brand">Target: 70%+ Mastery</Badge>
            </div>

            <div className="mt-4 space-y-4">
              {activeSection.units?.map((unit) => (
                <div key={unit.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-ink">
                      {unit.unit}: {unit.title}
                    </span>
                    <span
                      className={cn(
                        "font-bold font-mono",
                        unit.classMastery >= 75
                          ? "text-emerald-600"
                          : unit.classMastery >= 50
                          ? "text-amber-600"
                          : "text-rose-600"
                      )}
                    >
                      {unit.classMastery}% Class Mastery
                    </span>
                  </div>

                  <Progress
                    value={unit.classMastery}
                    tone={
                      unit.classMastery >= 75
                        ? "teal"
                        : unit.classMastery >= 50
                        ? "amber"
                        : "rose"
                    }
                  />

                  {unit.classMastery < 50 && (
                    <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-1.5 text-[11px] text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                      <AlertTriangle className="size-3.5 shrink-0" />
                      <span>
                        Topic mastery below threshold ({unit.classMastery}%). Remedial revision quiz recommended before semester exams.
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* At-Risk Students Filter & Regulatory Attendance Watchlist */}
          <Card className="p-5 border-line">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h4 className="text-sm font-semibold text-ink flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-500" />
                  Statutory Attendance Watchlist (&lt;75% Attendance)
                </h4>
                <p className="text-xs text-ink-3">
                  Students at risk of examination condonation or detention under Anna University / AICTE norms.
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => showToast("Remedial reminder dispatched to student proctors!")}
                className="text-xs gap-1.5"
              >
                <Send className="size-3" />
                Notify Proctors
              </Button>
            </div>

            <div className="mt-4 divide-y divide-line/60">
              {studentsRoster
                .filter((s) => s.attendancePercent < 75 || s.riskSignal === "Attendance Warning")
                .map((s) => (
                  <div key={s.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-2">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-ink bg-surface-2 px-2 py-0.5 rounded">
                        {s.rollNo}
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-ink">{s.name}</p>
                        <p className="text-[11px] text-ink-3">
                          {s.classesAttended} of {s.totalClasses} classes attended · Avg Score: {s.averageScore}%
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-bold text-rose-600 bg-rose-100 dark:bg-rose-950 px-2.5 py-1 rounded-full">
                        {s.attendancePercent}% Attendance
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => showToast(`Sent parent SMS notice for ${s.name} (${s.rollNo})`)}
                        className="text-xs text-brand"
                      >
                        Alert Parent
                      </Button>
                    </div>
                  </div>
                ))}

              {studentsRoster.filter((s) => s.attendancePercent < 75).length === 0 && (
                <div className="py-6 text-center text-xs text-ink-3">
                  All students in this section currently meet the 75% minimum attendance requirement.
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ── TAB 5: Attendance History & Past Sessions ───────────────────── */}
      {activeTab === "history" && (
        <div className="space-y-4 animate-in fade-in-50 duration-200">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-base font-semibold text-ink">
              Recorded Attendance Sessions
            </h3>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleExportCSV}
                className="text-xs gap-1.5"
              >
                <Download className="size-3.5" />
                Download Report (.csv)
              </Button>
            </div>
          </div>

          <Card className="overflow-hidden border-line">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface-2 text-[11px] font-bold uppercase tracking-wider text-ink-3 border-b border-line">
                  <tr>
                    <th className="px-4 py-3">Date & Period</th>
                    <th className="px-4 py-3">Section & Course</th>
                    <th className="px-4 py-3">Topic Covered</th>
                    <th className="px-4 py-3 text-center">Turnout</th>
                    <th className="px-4 py-3">Absent Rolls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60 bg-surface">
                  {attendanceSessions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-ink-3">
                        No recorded sessions found yet. Take attendance to see logs here.
                      </td>
                    </tr>
                  ) : (
                    attendanceSessions.map((session) => (
                      <tr key={session.id} className="hover:bg-surface-2/40 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-ink">{session.date}</p>
                          <p className="text-[11px] text-ink-3">
                            Period {session.period} · {session.timeSlot}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-ink">{session.section}</p>
                          <p className="text-[11px] text-ink-3">{session.courseCode}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-ink max-w-xs line-clamp-2">
                            {session.topicTaught}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={cn(
                              "font-bold font-mono text-xs px-2 py-0.5 rounded-full",
                              session.attendancePercent >= 80
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                            )}
                          >
                            {session.presentCount} / {session.totalStudents} ({session.attendancePercent}%)
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-rose-600 dark:text-rose-400">
                          {session.absentRolls && session.absentRolls.length > 0
                            ? session.absentRolls.slice(0, 4).join(", ") +
                              (session.absentRolls.length > 4 ? ` (+${session.absentRolls.length - 4})` : "")
                            : "Nil (100%)"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── MODAL 1: Quick Take Attendance Modal ──────────────────────── */}
      {isAttendanceModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <Card className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden border-line shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line p-4 bg-surface">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-brand/10 p-2 text-brand">
                  <UserCheck className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-ink">
                    Take Attendance — {activeSection?.section}
                  </h3>
                  <p className="text-xs text-ink-3">
                    {activeSection?.courseCode} · {activeSection?.courseTitle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAttendanceModalOpen(false)}
                className="rounded-lg p-1 text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Inputs & Stats */}
            <div className="p-4 bg-surface-2/40 border-b border-line space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-ink-3">Date</label>
                  <input
                    type="date"
                    value={attendanceDate}
                    onChange={(e) => setAttendanceDate(e.target.value)}
                    className={cn(inputClass, "mt-1 text-xs")}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-ink-3">Period</label>
                  <select
                    value={attendancePeriod}
                    onChange={(e) => setAttendancePeriod(Number(e.target.value))}
                    className={cn(inputClass, "mt-1 text-xs")}
                  >
                    <option value={1}>Period 1 (09:00 - 10:00)</option>
                    <option value={2}>Period 2 (10:00 - 11:00)</option>
                    <option value={3}>Period 3 (11:15 - 12:15)</option>
                    <option value={4}>Period 4 (13:15 - 14:15)</option>
                    <option value={5}>Period 5 (14:15 - 15:15)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-ink-3">Topic / Chapter</label>
                  <input
                    type="text"
                    placeholder="Topic covered in class..."
                    value={attendanceTopic}
                    onChange={(e) => setAttendanceTopic(e.target.value)}
                    className={cn(inputClass, "mt-1 text-xs")}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-3 text-xs font-semibold">
                  <span className="text-emerald-600">Present: {attendanceStats.present}</span>
                  <span className="text-rose-600">Absent: {attendanceStats.absent}</span>
                  <span className="text-amber-600">Late: {attendanceStats.late}</span>
                  <span className="rounded bg-brand/10 px-2 py-0.5 text-brand">
                    Turnout: {attendanceStats.percent}%
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleMarkAll("Present")}
                    className="text-xs h-7"
                  >
                    All Present
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleMarkAll("Absent")}
                    className="text-xs h-7 text-rose-600"
                  >
                    All Absent
                  </Button>
                </div>
              </div>
            </div>

            {/* Student List */}
            <div className="flex-1 overflow-y-auto max-h-[380px] p-4 divide-y divide-line/60">
              {studentsRoster.map((s) => {
                const status = attendanceMarks[s.id] || "Present";
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between py-2 text-xs hover:bg-surface-2/40 px-2 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-ink w-20">{s.rollNo}</span>
                      <span className="font-medium text-ink">{s.name}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggleStudentStatus(s.id, "Present")}
                        className={cn(
                          "size-7 rounded font-bold text-[11px] transition-all",
                          status === "Present"
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "bg-surface-2 text-ink-3 hover:bg-emerald-100 hover:text-emerald-800"
                        )}
                      >
                        P
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleStudentStatus(s.id, "Absent")}
                        className={cn(
                          "size-7 rounded font-bold text-[11px] transition-all",
                          status === "Absent"
                            ? "bg-rose-600 text-white shadow-xs"
                            : "bg-surface-2 text-ink-3 hover:bg-rose-100 hover:text-rose-800"
                        )}
                      >
                        A
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleStudentStatus(s.id, "Late")}
                        className={cn(
                          "size-7 rounded font-bold text-[11px] transition-all",
                          status === "Late"
                            ? "bg-amber-500 text-white shadow-xs"
                            : "bg-surface-2 text-ink-3 hover:bg-amber-100 hover:text-amber-800"
                        )}
                      >
                        L
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="border-t border-line p-3.5 bg-surface flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsAttendanceModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => saveAttendanceMutation.mutate()}
                disabled={saveAttendanceMutation.isPending}
              >
                {saveAttendanceMutation.isPending ? <Spinner className="size-3.5" /> : <Check className="size-3.5" />}
                Save Attendance Record
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── MODAL 2: View Student Roster Modal ───────────────────────── */}
      {isRosterModalOpen && rosterSection && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <Card className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden border-line shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-line p-4 bg-surface">
              <div>
                <h3 className="text-base font-bold text-ink">
                  {rosterSection.section} — Enrolled Student Roster
                </h3>
                <p className="text-xs text-ink-3">
                  {rosterSection.courseTitle} ({rosterSection.courseCode}) · {rosterSection.studentsCount} Students
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRosterModalOpen(false)}
                className="rounded-lg p-1 text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-surface-2 text-[11px] font-bold uppercase tracking-wider text-ink-3 border-b border-line">
                  <tr>
                    <th className="px-4 py-3">Roll No</th>
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-4 py-3">Attendance</th>
                    <th className="px-4 py-3">Avg Score</th>
                    <th className="px-4 py-3">Signal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60 bg-surface">
                  {studentsRoster.map((s) => (
                    <tr key={s.id} className="hover:bg-surface-2/30">
                      <td className="px-4 py-2.5 font-mono font-bold text-ink">{s.rollNo}</td>
                      <td className="px-4 py-2.5 font-semibold text-ink">{s.name}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={cn(
                            "font-semibold",
                            s.attendancePercent >= 75 ? "text-emerald-600" : "text-rose-600 font-bold"
                          )}
                        >
                          {s.attendancePercent}%
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-teal-600 dark:text-teal-400">
                        {s.averageScore}%
                      </td>
                      <td className="px-4 py-2.5">
                        {s.riskSignal === "Attendance Warning" ? (
                          <Badge tone="rose" className="text-[10px]">Att. Warning</Badge>
                        ) : s.riskSignal === "Top Performer" ? (
                          <Badge tone="teal" className="text-[10px]">Top Rank</Badge>
                        ) : s.riskSignal === "Low Mastery" ? (
                          <Badge tone="amber" className="text-[10px]">Remedial</Badge>
                        ) : (
                          <span className="text-[10px] text-ink-3">Regular</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-line p-3 bg-surface flex items-center justify-between">
              <span className="text-xs text-ink-3 font-medium">
                Total {studentsRoster.length} verified records
              </span>
              <Button size="sm" onClick={() => setIsRosterModalOpen(false)}>
                Done
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── MODAL 3: Schedule Extra Class Modal ──────────────────────── */}
      {isExtraClassModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <Card className="relative w-full max-w-md overflow-hidden border-line shadow-2xl">
            <div className="flex items-center justify-between border-b border-line p-4 bg-surface">
              <div className="flex items-center gap-2">
                <Plus className="size-4 text-brand" />
                <h3 className="text-base font-bold text-ink">Schedule Extra Class</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsExtraClassModalOpen(false)}
                className="rounded-lg p-1 text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="p-4 space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-ink-2">Class Section</label>
                <select
                  value={selectedSectionId}
                  onChange={(e) => setSelectedSectionId(e.target.value)}
                  className={cn(inputClass, "mt-1 text-xs")}
                >
                  {profile.assignedSections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.section} · {sec.courseCode}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-ink-2">Day of Week</label>
                <select
                  value={extraClassData.day}
                  onChange={(e) => setExtraClassData((p) => ({ ...p, day: e.target.value }))}
                  className={cn(inputClass, "mt-1 text-xs")}
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-ink-2">Time Slot</label>
                  <input
                    type="text"
                    value={extraClassData.time}
                    onChange={(e) => setExtraClassData((p) => ({ ...p, time: e.target.value }))}
                    className={cn(inputClass, "mt-1 text-xs")}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink-2">Room / Hall</label>
                  <input
                    type="text"
                    value={extraClassData.room}
                    onChange={(e) => setExtraClassData((p) => ({ ...p, room: e.target.value }))}
                    className={cn(inputClass, "mt-1 text-xs")}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-ink-2">Planned Topic / Purpose</label>
                <input
                  type="text"
                  placeholder="e.g. Compensatory Revision Lecture"
                  value={extraClassData.topic}
                  onChange={(e) => setExtraClassData((p) => ({ ...p, topic: e.target.value }))}
                  className={cn(inputClass, "mt-1 text-xs")}
                />
              </div>
            </div>

            <div className="border-t border-line p-3.5 bg-surface flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsExtraClassModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => extraClassMutation.mutate()}
                disabled={extraClassMutation.isPending}
              >
                {extraClassMutation.isPending ? <Spinner className="size-3.5" /> : <Plus className="size-3.5" />}
                Add to Timetable
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
