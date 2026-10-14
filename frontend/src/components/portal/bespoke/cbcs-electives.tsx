"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api/client";
import { z } from "zod";
import {
  CbcsOverviewSchema,
  CbcsCourse,
  CbcsStudentChoice,
  CreateCbcsCourseInput,
  UpdateCbcsSeatsInput,
  EnrollStudentElectiveInput,
  UpdateCbcsWindowInput,
} from "@/lib/api/cbcs-schemas";
import { toCsv } from "@/lib/csv";
import { TemplateSkeleton } from "@/components/modules/shared";
import { Fi } from "@/components/ui/icon";
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Progress,
  Spinner,
  inputClass,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth/roles";

type TabKey = "baskets" | "categories" | "enrolments" | "window-settings";

export function CbcsElectivesModule({ role }: { role: Role }) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("baskets");
  const [categoryFilter, setCategoryFilter] = useState<string>("All Categories");
  const [semesterFilter, setSemesterFilter] = useState<string>("All Semesters");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  // Add Course Modal State
  const [showAddCourseModal, setShowAddCourseModal] = useState<boolean>(false);
  const [newCode, setNewCode] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDept, setNewDept] = useState("Computer Science");
  const [newSemester, setNewSemester] = useState(4);
  const [newCategory, setNewCategory] = useState<any>("Discipline-Specific Elective (DSE)");
  const [newCredits, setNewCredits] = useState(3);
  const [newSeats, setNewSeats] = useState(60);
  const [newInstructor, setNewInstructor] = useState("");
  const [newSchedule, setNewSchedule] = useState("");
  const [newSyllabus, setNewSyllabus] = useState("");
  const [courseFormError, setCourseFormError] = useState<string | null>(null);

  // Adjust Capacity Modal State
  const [adjustingCourse, setAdjustingCourse] = useState<CbcsCourse | null>(null);
  const [adjustedSeats, setAdjustedSeats] = useState<number>(60);
  const [adjustFormError, setAdjustFormError] = useState<string | null>(null);

  // Enroll Student Modal State
  const [enrollingCourse, setEnrollingCourse] = useState<CbcsCourse | null>(null);
  const [studentName, setStudentName] = useState("");
  const [studentRegNo, setStudentRegNo] = useState("");
  const [studentDept, setStudentDept] = useState("");
  const [studentSem, setStudentSem] = useState(4);
  const [enrollFormError, setEnrollFormError] = useState<string | null>(null);

  // Registration Window Modal State
  const [showWindowModal, setShowWindowModal] = useState<boolean>(false);
  const [windowOpen, setWindowOpen] = useState(true);
  const [windowDeadline, setWindowDeadline] = useState("2026-10-24 17:00 IST");
  const [windowFormError, setWindowFormError] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["cbcs-electives"],
    queryFn: () => apiFetch("/api/v1/cbcs-electives", CbcsOverviewSchema),
    refetchInterval: 60_000,
  });

  const flash = (message: string) => {
    setFlashMessage(message);
    setTimeout(() => setFlashMessage(null), 4000);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  // Mutations
  const createCourseMutation = useMutation({
    mutationFn: (input: CreateCbcsCourseInput) =>
      apiFetch("/api/v1/cbcs-electives/courses", z.any(), { method: "POST", body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cbcs-electives"] });
      setShowAddCourseModal(false);
      setNewCode("");
      setNewTitle("");
      setNewInstructor("");
      setNewSchedule("");
      setNewSyllabus("");
      setCourseFormError(null);
      flash("New elective course published to CBCS catalogue.");
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        setCourseFormError(err.message);
      } else {
        setCourseFormError("Failed to add elective course. Check input fields.");
      }
    },
  });

  const updateSeatsMutation = useMutation({
    mutationFn: (input: UpdateCbcsSeatsInput) =>
      apiFetch(`/api/v1/cbcs-electives/courses/${input.courseId}/seats`, z.any(), { method: "PATCH", body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cbcs-electives"] });
      setAdjustingCourse(null);
      flash("Seat capacity updated successfully.");
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        setAdjustFormError(err.message);
      } else {
        setAdjustFormError("Failed to update seat capacity.");
      }
    },
  });

  const enrollMutation = useMutation({
    mutationFn: (input: EnrollStudentElectiveInput) =>
      apiFetch("/api/v1/cbcs-electives/enroll", z.any(), { method: "POST", body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cbcs-electives"] });
      setEnrollingCourse(null);
      setStudentName("");
      setStudentRegNo("");
      setEnrollFormError(null);
      flash("Student successfully enrolled in elective course.");
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        setEnrollFormError(err.message);
      } else {
        setEnrollFormError("Failed to enroll student.");
      }
    },
  });

  const dropMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/cbcs-electives/enrollments/${id}`, z.any(), { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cbcs-electives"] });
      flash("Elective registration dropped.");
    },
  });

  const updateWindowMutation = useMutation({
    mutationFn: (input: UpdateCbcsWindowInput) =>
      apiFetch("/api/v1/cbcs-electives/window", z.any(), { method: "PUT", body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cbcs-electives"] });
      setShowWindowModal(false);
      flash("CBCS enrollment window settings updated.");
    },
  });

  const openAdjustModal = (course: CbcsCourse) => {
    setAdjustingCourse(course);
    setAdjustedSeats(course.seatsTotal);
    setAdjustFormError(null);
  };

  const openEnrollModal = (course: CbcsCourse) => {
    setEnrollingCourse(course);
    setStudentName("");
    setStudentRegNo("");
    setStudentDept(course.offeringDepartment);
    setStudentSem(course.semester);
    setEnrollFormError(null);
  };

  const openWindowModal = () => {
    if (!data) return;
    setWindowOpen(data.kpis.registrationWindowOpen);
    setWindowDeadline(data.kpis.registrationDeadline);
    setWindowFormError(null);
    setShowWindowModal(true);
  };

  const handleCourseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newTitle.trim() || !newInstructor.trim()) {
      setCourseFormError("Please fill in code, title, and instructor.");
      return;
    }
    createCourseMutation.mutate({
      code: newCode.trim(),
      title: newTitle.trim(),
      offeringDepartment: newDept.trim(),
      semester: Number(newSemester),
      category: newCategory,
      credits: Number(newCredits),
      seatsTotal: Number(newSeats),
      instructor: newInstructor.trim(),
      schedule: newSchedule.trim() || "TBA",
      syllabusSummary: newSyllabus.trim() || "Elective syllabus as per UGC-CBCS regulations.",
    });
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingCourse) return;
    if (adjustedSeats < adjustingCourse.seatsFilled) {
      setAdjustFormError(`Cannot set capacity below currently enrolled students (${adjustingCourse.seatsFilled}).`);
      return;
    }
    updateSeatsMutation.mutate({
      courseId: adjustingCourse.id,
      seatsTotal: Number(adjustedSeats),
    });
  };

  const handleEnrollSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollingCourse) return;
    enrollMutation.mutate({
      courseId: enrollingCourse.id,
      studentName: studentName.trim() || undefined,
      regNo: studentRegNo.trim() || undefined,
      department: studentDept.trim() || undefined,
      semester: Number(studentSem),
    });
  };

  const handleWindowSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateWindowMutation.mutate({
      registrationWindowOpen: windowOpen,
      registrationDeadline: windowDeadline.trim(),
    });
  };

  const filteredCourses = useMemo(() => {
    if (!data) return [];
    return data.courses.filter((c) => {
      const matchCat = categoryFilter === "All Categories" || c.category === categoryFilter;
      const matchSem = semesterFilter === "All Semesters" || `Semester ${c.semester}` === semesterFilter;
      const matchSearch =
        c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.instructor.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.offeringDepartment.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSem && matchSearch;
    });
  }, [data, categoryFilter, semesterFilter, searchQuery]);

  const exportCsv = () => {
    if (!data) return;
    const header = ["Course Code", "Course Title", "Category", "Department", "Semester", "Credits", "Capacity", "Filled", "Utilization %", "Status", "Instructor"];
    const rows = data.courses.map((c) => [
      c.code,
      c.title,
      c.category,
      c.offeringDepartment,
      `Sem ${c.semester}`,
      c.credits,
      c.seatsTotal,
      c.seatsFilled,
      `${Math.round((c.seatsFilled / c.seatsTotal) * 100)}%`,
      c.status,
      c.instructor,
    ]);
    const csvContent = toCsv([header, ...rows]);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `cbcs-electives-basket-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <TemplateSkeleton />;
  if (error || !data) {
    return (
      <EmptyState
        title="Failed to load CBCS Electives"
        body="Could not connect to academic credit services or elective course repository."
        action={<Button variant="primary" onClick={() => refetch()}>Try Again</Button>}
      />
    );
  }

  const { kpis, courses, studentRegistrations, categorySummaries } = data;

  return (
    <div className="space-y-6">
      {/* Flash Banner */}
      {flashMessage && (
        <div
          role="status"
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-900 dark:text-emerald-100 flex items-center justify-between shadow-sm animate-in fade-in duration-200"
        >
          <div className="flex items-center gap-2">
            <Fi name="check-circle" className="text-emerald-600 dark:text-emerald-400 text-base" />
            <span>{flashMessage}</span>
          </div>
          <button
            onClick={() => setFlashMessage(null)}
            className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[var(--line)] pb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">CBCS & Electives Architecture</h1>
            <Badge tone="teal">
              {data.stream === "management" ? "Management Stream" : "Arts & Science Stream"}
            </Badge>
            <Badge tone={kpis.registrationWindowOpen ? "brand" : "rose"}>
              {kpis.registrationWindowOpen ? "Registration Open" : "Registration Closed"}
            </Badge>
            <Badge tone="neutral" className="text-[11px]">
              Deadline: {kpis.registrationDeadline}
            </Badge>
          </div>
          <p className="text-sm text-[var(--ink-2)] mt-1">
            {data.collegeName} &bull; UGC Choice-Based Credit System (CBCS) & NEP 2020 Multi-disciplinary elective basket allocation.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5"
          >
            {isRefreshing ? <Spinner className="size-3.5" /> : <Fi name="refresh" className="text-xs" />}
            Refresh
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={exportCsv}
            className="flex items-center gap-1.5"
          >
            <Fi name="document" className="text-xs" />
            Export Basket (CSV)
          </Button>
          {(role === "institution" || role === "admin" || role === "hod") && (
            <Button
              variant="secondary"
              size="sm"
              onClick={openWindowModal}
              className="flex items-center gap-1.5"
            >
              <Fi name="calendar" className="text-xs" />
              Window Settings
            </Button>
          )}
          {(role === "institution" || role === "admin" || role === "hod") && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setCourseFormError(null);
                setShowAddCourseModal(true);
              }}
              className="flex items-center gap-1.5"
            >
              <Fi name="plus" className="text-xs" />
              Add Elective Course
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--line)] flex gap-2 overflow-x-auto pb-px">
        {[
          { key: "baskets", label: `Electives Basket (${courses.length})`, icon: "layers" },
          { key: "categories", label: "NEP Credit Distribution", icon: "chart-histogram" },
          { key: "enrolments", label: `Student Allocations (${studentRegistrations.length})`, icon: "users" },
          { key: "window-settings", label: "CBCS Guidelines & Window", icon: "settings" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as TabKey)}
            className={cn(
              "px-3.5 py-2 text-sm font-medium border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors",
              activeTab === tab.key
                ? "border-[var(--brand)] text-[var(--brand)]"
                : "border-transparent text-[var(--ink-2)] hover:text-[var(--ink)] hover:border-[var(--line-2)]"
            )}
          >
            <Fi name={tab.icon} className="text-xs" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: ELECTIVES BASKET */}
      {activeTab === "baskets" && (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-[var(--line)]">
              <CardBody className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-[var(--ink-2)]">
                  <span>Total Electives Offered</span>
                  <Badge tone="teal">{kpis.totalCreditsOffered} Credits</Badge>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[var(--ink)]">{kpis.totalCourses}</span>
                  <span className="text-xs text-[var(--ink-2)]">Baskets Active</span>
                </div>
                <p className="text-[11px] text-[var(--ink-3)]">
                  Spanning DSE, GE, SEC, AECC and Value-Added tracks.
                </p>
              </CardBody>
            </Card>

            <Card className="border-[var(--line)]">
              <CardBody className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-[var(--ink-2)]">
                  <span>Enrolled Students</span>
                  <Badge tone="brand">
                    {kpis.totalEnrolled} / {kpis.totalCapacity}
                  </Badge>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[var(--ink)]">{kpis.seatUtilizationPercent}%</span>
                  <span className="text-xs text-[var(--ink-2)]">Seat Utilization</span>
                </div>
                <Progress value={kpis.seatUtilizationPercent} tone="brand" className="h-1.5" />
                <p className="text-[11px] text-[var(--ink-3)]">
                  {kpis.totalCapacity - kpis.totalEnrolled} unallocated seats available.
                </p>
              </CardBody>
            </Card>

            <Card className="border-[var(--line)]">
              <CardBody className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-[var(--ink-2)]">
                  <span>Full Capacity Baskets</span>
                  <Badge tone="rose">{kpis.fullCoursesCount} Capped</Badge>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">{kpis.fullCoursesCount}</span>
                  <span className="text-xs text-[var(--ink-2)]">of {kpis.totalCourses} Courses</span>
                </div>
                <p className="text-[11px] text-[var(--ink-3)]">
                  Additional batches or seat expansion can be scheduled.
                </p>
              </CardBody>
            </Card>

            <Card className="border-[var(--line)]">
              <CardBody className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-[var(--ink-2)]">
                  <span>Registration Window</span>
                  <Badge tone={kpis.registrationWindowOpen ? "teal" : "rose"}>
                    {kpis.registrationWindowOpen ? "Active" : "Closed"}
                  </Badge>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-bold text-[var(--ink)] truncate">{kpis.registrationDeadline}</span>
                </div>
                <p className="text-[11px] text-[var(--ink-3)]">
                  Students self-select via portal before locking.
                </p>
              </CardBody>
            </Card>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {[
                "All Categories",
                "Discipline-Specific Elective (DSE)",
                "Generic Elective (GE)",
                "Skill Enhancement Course (SEC)",
                "Ability Enhancement (AECC)",
                "Value-Added Course (VAC)",
              ].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={cn(
                    "px-3 py-1.5 text-xs rounded-full font-medium transition-colors border",
                    categoryFilter === cat
                      ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                      : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--line-2)] hover:text-[var(--ink)]"
                  )}
                >
                  {cat.includes("(") ? cat.split("(")[1]?.replace(")", "") : cat}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <select
                value={semesterFilter}
                onChange={(e) => setSemesterFilter(e.target.value)}
                className={cn(inputClass, "text-xs py-1.5 w-36")}
              >
                <option value="All Semesters">All Semesters</option>
                <option value="Semester 2">Semester 2</option>
                <option value="Semester 3">Semester 3</option>
                <option value="Semester 4">Semester 4</option>
                <option value="Semester 6">Semester 6</option>
              </select>
              <input
                type="text"
                placeholder="Search course or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(inputClass, "text-xs py-1.5 w-48 sm:w-60")}
              />
            </div>
          </div>

          {/* Courses Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCourses.map((c) => {
              const utilPercent = Math.round((c.seatsFilled / c.seatsTotal) * 100);
              const isFull = c.seatsFilled >= c.seatsTotal || c.status === "Full";

              return (
                <Card key={c.id} className="border-[var(--line)] flex flex-col justify-between">
                  <CardBody className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-[var(--brand)]">{c.code}</span>
                          <span className="text-[11px] text-[var(--ink-3)]">&bull; Sem {c.semester}</span>
                        </div>
                        <h4 className="font-bold text-sm text-[var(--ink)] mt-0.5">{c.title}</h4>
                        <p className="text-xs text-[var(--ink-2)]">Dept of {c.offeringDepartment}</p>
                      </div>
                      <Badge tone={isFull ? "rose" : "teal"}>{isFull ? "Full" : "Open"}</Badge>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge tone="neutral" className="text-[10px]">
                        {c.category}
                      </Badge>
                      <Badge tone="brand" className="text-[10px]">
                        {c.credits} Credits
                      </Badge>
                    </div>

                    <p className="text-[11px] text-[var(--ink-2)] line-clamp-2 bg-[var(--surface-2)] p-2 rounded border border-[var(--line)]">
                      {c.syllabusSummary}
                    </p>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-[var(--ink-3)]">Seat Capacity:</span>
                        <span className="font-semibold text-[var(--ink)]">
                          {c.seatsFilled} / {c.seatsTotal} ({utilPercent}%)
                        </span>
                      </div>
                      <Progress
                        value={utilPercent}
                        tone={utilPercent >= 100 ? "rose" : utilPercent >= 80 ? "amber" : "teal"}
                        className="h-1.5"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-[var(--line)]">
                      <div>
                        <span className="text-[var(--ink-3)] block">Instructor</span>
                        <span className="font-medium text-[var(--ink)]">{c.instructor}</span>
                      </div>
                      <div>
                        <span className="text-[var(--ink-3)] block">Schedule / Room</span>
                        <span className="font-medium text-[var(--ink)] truncate block">{c.schedule}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between gap-2">
                      {(role === "institution" || role === "admin" || role === "hod") && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openAdjustModal(c)}
                          className="text-xs h-7 px-2.5"
                        >
                          Adjust Capacity
                        </Button>
                      )}
                      <Button
                        variant={isFull ? "secondary" : "primary"}
                        size="sm"
                        disabled={isFull}
                        onClick={() => openEnrollModal(c)}
                        className="text-xs h-7 px-2.5 ml-auto"
                      >
                        {isFull ? "Capped" : "Enroll Student"}
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: NEP CREDIT DISTRIBUTION */}
      {activeTab === "categories" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-[var(--ink)]">NEP 2020 Multi-Disciplinary Credit Structure</h3>
              <p className="text-xs text-[var(--ink-2)]">
                Allocation across Discipline Electives, Generic Electives, Skill Courses, Ability Enhancement and Value-Added baskets.
              </p>
            </div>
            <Badge tone="teal">UGC CBCS Guidelines</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categorySummaries.map((cat) => (
              <Card key={cat.category} className="border-[var(--line)]">
                <CardBody className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-sm text-[var(--ink)]">{cat.category}</h4>
                    <Badge tone="brand">{cat.count} Courses</Badge>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[var(--ink-3)]">Enrolled / Total Seats:</span>
                      <span className="font-semibold text-[var(--ink)]">
                        {cat.enrolled} / {cat.capacity}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--ink-3)]">Utilization Rate:</span>
                      <span className="font-bold text-[var(--ink)]">{cat.utilization}%</span>
                    </div>
                    <Progress value={cat.utilization} tone={cat.utilization >= 90 ? "teal" : "brand"} className="h-1.5" />
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>

          <Card className="border-[var(--line)]">
            <CardBody className="p-4 space-y-3">
              <h4 className="font-semibold text-sm text-[var(--ink)]">Mandatory CBCS Minimum Credit Requirements per Semester</h4>
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left text-[var(--ink-2)]">
                  <thead className="bg-[var(--surface-2)] text-[var(--ink)] font-semibold border-b border-[var(--line)]">
                    <tr>
                      <th className="p-2.5">Course Category</th>
                      <th className="p-2.5">Credit Weightage</th>
                      <th className="p-2.5">Objective & Delivery Mode</th>
                      <th className="p-2.5">UGC Requirement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]">
                    <tr>
                      <td className="p-2.5 font-semibold text-[var(--ink)]">Discipline-Specific Elective (DSE)</td>
                      <td className="p-2.5">3 – 4 Credits</td>
                      <td className="p-2.5">Advanced specialization in primary major</td>
                      <td className="p-2.5"><Badge tone="teal">Mandatory (Min 4)</Badge></td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-semibold text-[var(--ink)]">Generic Elective (GE)</td>
                      <td className="p-2.5">3 Credits</td>
                      <td className="p-2.5">Interdisciplinary studies from other departments</td>
                      <td className="p-2.5"><Badge tone="teal">Mandatory (Min 2)</Badge></td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-semibold text-[var(--ink)]">Skill Enhancement Course (SEC)</td>
                      <td className="p-2.5">2 – 3 Credits</td>
                      <td className="p-2.5">Practical, lab-based digital and analytical tools</td>
                      <td className="p-2.5"><Badge tone="teal">Mandatory (Min 3)</Badge></td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-semibold text-[var(--ink)]">Ability Enhancement (AECC)</td>
                      <td className="p-2.5">2 Credits</td>
                      <td className="p-2.5">Environmental Studies and Professional Communication</td>
                      <td className="p-2.5"><Badge tone="teal">Mandatory (Min 2)</Badge></td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-semibold text-[var(--ink)]">Value-Added Course (VAC)</td>
                      <td className="p-2.5">1 – 2 Credits</td>
                      <td className="p-2.5">Ethics, mental wellness, cyber hygiene, and yoga</td>
                      <td className="p-2.5"><Badge tone="brand">Recommended</Badge></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* TAB 3: STUDENT ENROLMENTS */}
      {activeTab === "enrolments" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-[var(--ink)]">Student Elective Registrations & Audit Log</h3>
              <p className="text-xs text-[var(--ink-2)]">
                Verified student elective choices across academic semesters with credit validation.
              </p>
            </div>
            <Badge tone="teal">{studentRegistrations.length} Active Allocations</Badge>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)]">
            <table className="w-full text-left text-xs text-[var(--ink-2)]">
              <thead className="bg-[var(--surface-2)] text-[var(--ink)] font-semibold border-b border-[var(--line)]">
                <tr>
                  <th className="p-3">Student & Reg No</th>
                  <th className="p-3">Department & Sem</th>
                  <th className="p-3">Elective Course</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Credits</th>
                  <th className="p-3">Registered At</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {studentRegistrations.map((reg) => (
                  <tr key={reg.id} className="hover:bg-[var(--surface-2)]/50 transition-colors">
                    <td className="p-3 font-medium text-[var(--ink)]">
                      <div>{reg.studentName}</div>
                      <div className="text-[11px] font-mono text-[var(--ink-3)]">{reg.regNo}</div>
                    </td>
                    <td className="p-3">
                      <div>{reg.department}</div>
                      <div className="text-[11px] text-[var(--ink-3)]">Semester {reg.semester}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-[var(--brand)]">{reg.courseCode}</div>
                      <div className="text-[11px] text-[var(--ink)]">{reg.courseTitle}</div>
                    </td>
                    <td className="p-3">
                      <Badge tone="neutral" className="text-[10px]">
                        {reg.category.includes("(") ? reg.category.split("(")[1]?.replace(")", "") : reg.category}
                      </Badge>
                    </td>
                    <td className="p-3 font-semibold text-[var(--ink)]">{reg.credits} Credits</td>
                    <td className="p-3 text-[11px]">{reg.registeredAt}</td>
                    <td className="p-3">
                      <Badge tone="teal">{reg.status}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => dropMutation.mutate(reg.id)}
                        className="text-xs h-7 px-2 text-rose-600 hover:text-rose-700"
                      >
                        Drop
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: WINDOW SETTINGS */}
      {activeTab === "window-settings" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-[var(--ink)]">Elective Selection Window & Policy Guidelines</h3>
              <p className="text-xs text-[var(--ink-2)]">
                Manage registration window opening, deadlines, and automated allocation rules.
              </p>
            </div>
            {(role === "institution" || role === "admin" || role === "hod") && (
              <Button variant="secondary" size="sm" onClick={openWindowModal}>
                Edit Window Settings
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-[var(--line)]">
              <CardBody className="p-4 space-y-3">
                <h4 className="font-semibold text-sm text-[var(--ink)]">Current Selection Window</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-[var(--line)]">
                    <span className="text-[var(--ink-3)]">Registration Window State</span>
                    <Badge tone={kpis.registrationWindowOpen ? "teal" : "rose"}>
                      {kpis.registrationWindowOpen ? "OPEN FOR SELECTION" : "LOCKED / CLOSED"}
                    </Badge>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[var(--line)]">
                    <span className="text-[var(--ink-3)]">Official Closing Deadline</span>
                    <span className="font-bold text-[var(--ink)]">{kpis.registrationDeadline}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[var(--ink-3)]">Allocation Algorithm</span>
                    <span className="font-medium text-emerald-600">First-Come-First-Served (FCFS)</span>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card className="border-[var(--line)]">
              <CardBody className="p-4 space-y-3">
                <h4 className="font-semibold text-sm text-[var(--ink)]">Institutional Enrollment Policy</h4>
                <ul className="text-xs text-[var(--ink-2)] space-y-2 list-disc pl-5">
                  <li>Students must register for at least 1 Generic Elective outside their parent department.</li>
                  <li>Skill Enhancement Courses (SEC) include mandatory 30 hours of hands-on laboratory practice.</li>
                  <li>Once an elective reaches 100% capacity, waitlisting is automatically initiated.</li>
                </ul>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD ELECTIVE COURSE */}
      {showAddCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[var(--line)] p-4">
              <div>
                <h3 className="font-semibold text-base text-[var(--ink)]">Publish New Elective Course</h3>
                <p className="text-xs text-[var(--ink-2)]">Create and offer an elective course in the CBCS basket.</p>
              </div>
              <button
                onClick={() => setShowAddCourseModal(false)}
                className="text-[var(--ink-3)] hover:text-[var(--ink)] text-sm p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCourseSubmit} className="p-4 space-y-4">
              {courseFormError && (
                <div className="p-3 text-xs rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600">
                  {courseFormError}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--ink)] mb-1">Course Code</label>
                  <input
                    type="text"
                    placeholder="e.g. SEC205"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    className={cn(inputClass, "w-full text-xs font-mono uppercase")}
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-[var(--ink)] mb-1">Course Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Cloud Computing & DevOps"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className={cn(inputClass, "w-full text-xs")}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--ink)] mb-1">Offering Department</label>
                  <input
                    type="text"
                    placeholder="e.g. Computer Science"
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    className={cn(inputClass, "w-full text-xs")}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--ink)] mb-1">Semester</label>
                  <select
                    value={newSemester}
                    onChange={(e) => setNewSemester(Number(e.target.value))}
                    className={cn(inputClass, "w-full text-xs")}
                  >
                    <option value={2}>Semester 2</option>
                    <option value={3}>Semester 3</option>
                    <option value={4}>Semester 4</option>
                    <option value={5}>Semester 5</option>
                    <option value={6}>Semester 6</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-[var(--ink)] mb-1">CBCS Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className={cn(inputClass, "w-full text-xs")}
                  >
                    <option value="Discipline-Specific Elective (DSE)">Discipline-Specific Elective (DSE)</option>
                    <option value="Generic Elective (GE)">Generic Elective (GE)</option>
                    <option value="Skill Enhancement Course (SEC)">Skill Enhancement Course (SEC)</option>
                    <option value="Ability Enhancement (AECC)">Ability Enhancement (AECC)</option>
                    <option value="Value-Added Course (VAC)">Value-Added Course (VAC)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--ink)] mb-1">Credits</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={newCredits}
                    onChange={(e) => setNewCredits(Number(e.target.value))}
                    className={cn(inputClass, "w-full text-xs")}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--ink)] mb-1">Seat Intake Capacity</label>
                  <input
                    type="number"
                    min="10"
                    max="500"
                    value={newSeats}
                    onChange={(e) => setNewSeats(Number(e.target.value))}
                    className={cn(inputClass, "w-full text-xs")}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--ink)] mb-1">Assigned Instructor</label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. K. Anand"
                    value={newInstructor}
                    onChange={(e) => setNewInstructor(e.target.value)}
                    className={cn(inputClass, "w-full text-xs")}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--ink)] mb-1">Weekly Schedule & Venue</label>
                <input
                  type="text"
                  placeholder="e.g. Mon & Wed, 10:00 AM – 11:30 AM (Room 204)"
                  value={newSchedule}
                  onChange={(e) => setNewSchedule(e.target.value)}
                  className={cn(inputClass, "w-full text-xs")}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--ink)] mb-1">Syllabus / Learning Outcomes Summary</label>
                <textarea
                  rows={2}
                  placeholder="Brief synopsis of core topics covered in this elective course..."
                  value={newSyllabus}
                  onChange={(e) => setNewSyllabus(e.target.value)}
                  className={cn(inputClass, "w-full text-xs")}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--line)]">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowAddCourseModal(false)}
                  disabled={createCourseMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={createCourseMutation.isPending}
                  className="flex items-center gap-1.5"
                >
                  {createCourseMutation.isPending && <Spinner className="size-3.5" />}
                  Publish Elective
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADJUST SEATS CAPACITY */}
      {adjustingCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[var(--line)] p-4">
              <div>
                <h3 className="font-semibold text-base text-[var(--ink)]">Adjust Seat Capacity</h3>
                <p className="text-xs text-[var(--ink-2)]">{adjustingCourse.code} &bull; {adjustingCourse.title}</p>
              </div>
              <button
                onClick={() => setAdjustingCourse(null)}
                className="text-[var(--ink-3)] hover:text-[var(--ink)] text-sm p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="p-4 space-y-4">
              {adjustFormError && (
                <div className="p-3 text-xs rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600">
                  {adjustFormError}
                </div>
              )}

              <div className="p-3 rounded-lg bg-[var(--surface-2)] text-xs space-y-1">
                <div>Currently Enrolled: <strong>{adjustingCourse.seatsFilled} students</strong></div>
                <div>Current Intake: <strong>{adjustingCourse.seatsTotal} seats</strong></div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--ink)] mb-1">New Total Seat Capacity</label>
                <input
                  type="number"
                  min={adjustingCourse.seatsFilled}
                  max="500"
                  value={adjustedSeats}
                  onChange={(e) => setAdjustedSeats(Number(e.target.value))}
                  className={cn(inputClass, "w-full text-xs")}
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--line)]">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setAdjustingCourse(null)}
                  disabled={updateSeatsMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={updateSeatsMutation.isPending}
                  className="flex items-center gap-1.5"
                >
                  {updateSeatsMutation.isPending && <Spinner className="size-3.5" />}
                  Save Capacity
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ENROLL STUDENT */}
      {enrollingCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[var(--line)] p-4">
              <div>
                <h3 className="font-semibold text-base text-[var(--ink)]">Enroll Student in Elective</h3>
                <p className="text-xs text-[var(--ink-2)]">{enrollingCourse.code} &bull; {enrollingCourse.title}</p>
              </div>
              <button
                onClick={() => setEnrollingCourse(null)}
                className="text-[var(--ink-3)] hover:text-[var(--ink)] text-sm p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEnrollSubmit} className="p-4 space-y-4">
              {enrollFormError && (
                <div className="p-3 text-xs rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600">
                  {enrollFormError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[var(--ink)] mb-1">Student Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Karthik Venkat"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className={cn(inputClass, "w-full text-xs")}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--ink)] mb-1">Registration / Roll No</label>
                  <input
                    type="text"
                    placeholder="e.g. 22CS1088"
                    value={studentRegNo}
                    onChange={(e) => setStudentRegNo(e.target.value)}
                    className={cn(inputClass, "w-full text-xs uppercase font-mono")}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--ink)] mb-1">Parent Department</label>
                  <input
                    type="text"
                    placeholder="e.g. Physics"
                    value={studentDept}
                    onChange={(e) => setStudentDept(e.target.value)}
                    className={cn(inputClass, "w-full text-xs")}
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--line)]">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setEnrollingCourse(null)}
                  disabled={enrollMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={enrollMutation.isPending}
                  className="flex items-center gap-1.5"
                >
                  {enrollMutation.isPending && <Spinner className="size-3.5" />}
                  Confirm Enrollment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: WINDOW SETTINGS */}
      {showWindowModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[var(--line)] p-4">
              <div>
                <h3 className="font-semibold text-base text-[var(--ink)]">Elective Window Settings</h3>
                <p className="text-xs text-[var(--ink-2)]">Control student self-registration and closing dates.</p>
              </div>
              <button
                onClick={() => setShowWindowModal(false)}
                className="text-[var(--ink-3)] hover:text-[var(--ink)] text-sm p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleWindowSubmit} className="p-4 space-y-4">
              {windowFormError && (
                <div className="p-3 text-xs rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600">
                  {windowFormError}
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="windowToggle"
                  checked={windowOpen}
                  onChange={(e) => setWindowOpen(e.target.checked)}
                  className="size-4 rounded border-[var(--line)]"
                />
                <label htmlFor="windowToggle" className="text-xs font-semibold text-[var(--ink)] cursor-pointer">
                  Registration Window is Open
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--ink)] mb-1">Registration Deadline Description</label>
                <input
                  type="text"
                  placeholder="e.g. 2026-10-24 17:00 IST"
                  value={windowDeadline}
                  onChange={(e) => setWindowDeadline(e.target.value)}
                  className={cn(inputClass, "w-full text-xs")}
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--line)]">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowWindowModal(false)}
                  disabled={updateWindowMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={updateWindowMutation.isPending}
                  className="flex items-center gap-1.5"
                >
                  {updateWindowMutation.isPending && <Spinner className="size-3.5" />}
                  Save Settings
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
