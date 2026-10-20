"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { apiFetch } from "@/lib/api/client";
import { z } from "zod";
import type { Role } from "@/lib/auth/roles";
import {
  OsceOverviewSchema,
  OsceOverview,
  OsceStation,
  OsceSession,
  SkillsLabBooking,
  StudentOsceResult,
  SkillsLabEquipment,
  CreateOsceStationInput,
  CreateOsceSessionInput,
  CreateSkillsLabBookingInput,
  UpdateBookingStatusInput,
  GradeStudentOsceInput,
} from "@/lib/api/osce-schemas";
import {
  Card,
  CardHeader,
  CardBody,
  Badge,
  Button,
  Progress,
  inputClass,
  EmptyState,
  toneForStatus,
} from "@/components/ui/primitives";
import { TemplateSkeleton } from "@/components/modules/shared";
import { Fi } from "@/components/ui/icon";
import { toCsv } from "@/lib/csv";

type TabKey = "stations" | "sessions" | "bookings" | "results" | "equipment";

export function OsceModule({ role }: { role: Role }) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("stations");
  const [domainFilter, setDomainFilter] = useState<string>("All Domains");
  const [deptFilter, setDeptFilter] = useState<string>("All Departments");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [selectedStationForDetail, setSelectedStationForDetail] = useState<OsceStation | null>(null);

  // Modals
  const [showAddStationModal, setShowAddStationModal] = useState<boolean>(false);
  const [showAddSessionModal, setShowAddSessionModal] = useState<boolean>(false);
  const [showBookingModal, setShowBookingModal] = useState<boolean>(false);
  const [showGradeModal, setShowGradeModal] = useState<boolean>(false);

  // Form states - Add Station
  const [stationTitle, setStationTitle] = useState("");
  const [stationDept, setStationDept] = useState("General Medicine");
  const [stationDomain, setStationDomain] = useState<"Procedure" | "Communication" | "Emergency" | "Data interpretation" | "Physical Exam">("Procedure");
  const [stationDuration, setStationDuration] = useState(8);
  const [stationTotalMarks, setStationTotalMarks] = useState(20);
  const [stationPassMarks, setStationPassMarks] = useState(14);
  const [stationNmcCode, setStationNmcCode] = useState("IM-12.1");
  const [stationRoom, setStationRoom] = useState("Skills Cubicle 2");
  const [stationManikin, setStationManikin] = useState("Adult Simulator Arm");
  const [stationCriticalReq, setStationCriticalReq] = useState(true);
  const [stationCriticalDesc, setStationCriticalDesc] = useState("Verify patient identity and ensure sterile technique throughout.");
  const [checklistSteps, setChecklistSteps] = useState<Array<{ step: string; maxMarks: number; isCritical: boolean; category: "Preparation" | "Execution" | "Patient Safety" | "Communication" }>>([
    { step: "Patient introduction, consent and hand hygiene", maxMarks: 4, isCritical: false, category: "Preparation" },
    { step: "Correct execution of core clinical procedure / maneuver", maxMarks: 10, isCritical: true, category: "Execution" },
    { step: "Sharps safety and patient post-procedure monitoring", maxMarks: 6, isCritical: true, category: "Patient Safety" },
  ]);

  // Form states - Add Session
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionBatch, setSessionBatch] = useState("MBBS 2022 (Phase 3 Part 2)");
  const [sessionDept, setSessionDept] = useState("Multidisciplinary Clinical Board");
  const [sessionDate, setSessionDate] = useState("2026-11-20");
  const [sessionTime, setSessionTime] = useState("09:00 AM - 01:00 PM");
  const [sessionVenue, setSessionVenue] = useState("Central Clinical Skills Simulation Center - Block C");
  const [sessionCandidates, setSessionCandidates] = useState(50);
  const [sessionExaminer, setSessionExaminer] = useState("Dr. S. Venkatesh (HOD)");

  // Form states - Book Lab
  const [bookApplicantName, setBookApplicantName] = useState(role === "student" ? "Sneha Varma (MBBS Intern)" : "Dr. S. Venkatesh (Faculty)");
  const [bookApplicantRole, setBookApplicantRole] = useState<"Student" | "Resident" | "Faculty">(role === "student" ? "Student" : "Faculty");
  const [bookRoom, setBookRoom] = useState("Surgical Skills Cubicle 2");
  const [bookEquipment, setBookEquipment] = useState("Suture Training Pad & Instrument Kit");
  const [bookDate, setBookDate] = useState("2026-10-25");
  const [bookTime, setBookTime] = useState("14:00 - 15:30");
  const [bookPurpose, setBookPurpose] = useState<"Independent Practice" | "Faculty-Guided Demo" | "Remediation Training">("Independent Practice");
  const [bookNotes, setBookNotes] = useState("");

  // Form states - Grade Student
  const [gradeStudentName, setGradeStudentName] = useState("");
  const [gradeRollNo, setGradeRollNo] = useState("");
  const [gradeBatch, setGradeBatch] = useState("MBBS 2022");
  const [gradeStationId, setGradeStationId] = useState("");
  const [gradeScore, setGradeScore] = useState(16);
  const [gradeCriticalMet, setGradeCriticalMet] = useState(true);
  const [gradeRemarks, setGradeRemarks] = useState("");
  const [gradeCbmeCertified, setGradeCbmeCertified] = useState(true);

  const flash = (msg: string) => {
    setFlashMessage(msg);
    setTimeout(() => setFlashMessage(null), 4000);
  };

  const { data, isLoading, error, refetch } = useQuery<OsceOverview>({
    queryKey: ["osce-overview"],
    queryFn: () => apiFetch("/api/v1/osce", OsceOverviewSchema),
  });

  // Mutations
  const createStationMutation = useMutation({
    mutationFn: (input: CreateOsceStationInput) =>
      apiFetch("/api/v1/osce/stations", z.any(), { method: "POST", body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["osce-overview"] });
      setShowAddStationModal(false);
      flash("New OSCE Clinical Station & Rubric registered successfully!");
    },
    onError: (err: any) => flash(`Error creating station: ${err.message}`),
  });

  const toggleStationMutation = useMutation({
    mutationFn: (stationId: string) =>
      apiFetch(`/api/v1/osce/stations/${stationId}/toggle`, z.any(), { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["osce-overview"] });
      flash("Station status toggled!");
    },
  });

  const createSessionMutation = useMutation({
    mutationFn: (input: CreateOsceSessionInput) =>
      apiFetch("/api/v1/osce/sessions", z.any(), { method: "POST", body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["osce-overview"] });
      setShowAddSessionModal(false);
      flash("OSCE Examination Circuit scheduled successfully!");
    },
    onError: (err: any) => flash(`Error scheduling session: ${err.message}`),
  });

  const createBookingMutation = useMutation({
    mutationFn: (input: CreateSkillsLabBookingInput) =>
      apiFetch("/api/v1/osce/bookings", z.any(), { method: "POST", body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["osce-overview"] });
      setShowBookingModal(false);
      flash("Skills Lab practice slot request submitted!");
    },
    onError: (err: any) => flash(`Error booking slot: ${err.message}`),
  });

  const updateBookingStatusMutation = useMutation({
    mutationFn: ({ bookingId, status }: { bookingId: string; status: "Approved" | "Pending Review" | "Completed" | "Rejected" }) =>
      apiFetch(`/api/v1/osce/bookings/${bookingId}/status`, z.any(), { method: "PATCH", body: { status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["osce-overview"] });
      flash("Booking status updated!");
    },
  });

  const gradeStudentMutation = useMutation({
    mutationFn: (input: GradeStudentOsceInput) =>
      apiFetch("/api/v1/osce/grade", z.any(), { method: "POST", body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["osce-overview"] });
      setShowGradeModal(false);
      flash("Student clinical evaluation recorded & synced to NMC Competency Logbook!");
    },
    onError: (err: any) => flash(`Error grading student: ${err.message}`),
  });

  const filteredStations = useMemo(() => {
    if (!data?.stations) return [];
    return data.stations.filter((st) => {
      const matchDomain = domainFilter === "All Domains" || st.domain === domainFilter;
      const matchDept = deptFilter === "All Departments" || st.department === deptFilter;
      const matchQuery =
        !searchQuery.trim() ||
        st.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        st.nmcCompetencyCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        st.room.toLowerCase().includes(searchQuery.toLowerCase()) ||
        st.manikinEquipment.toLowerCase().includes(searchQuery.toLowerCase());
      return matchDomain && matchDept && matchQuery;
    });
  }, [data?.stations, domainFilter, deptFilter, searchQuery]);

  const filteredResults = useMemo(() => {
    if (!data?.results) return [];
    if (!searchQuery.trim()) return data.results;
    return data.results.filter(
      (r) =>
        r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.rollNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.stationName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [data?.results, searchQuery]);

  const triggerDownload = (filename: string, csvContent: string) => {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCsv = () => {
    if (!data) return;
    if (activeTab === "stations") {
      const header = ["Station #", "Title", "Department", "Domain", "Duration (mins)", "Total Marks", "Pass Marks", "NMC Code", "Room", "Manikin", "Status", "Pass Rate"];
      const rows = data.stations.map((s) => [s.number, s.title, s.department, s.domain, s.durationMinutes, s.totalMarks, s.passMarks, s.nmcCompetencyCode, s.room, s.manikinEquipment, s.status, `${s.passRate}%`]);
      triggerDownload(`osce_stations_directory_${new Date().toISOString().slice(0, 10)}.csv`, toCsv([header, ...rows]));
    } else if (activeTab === "results") {
      const header = ["Student Name", "Roll No", "Batch", "Station", "Score", "Total", "Percentage", "Grade", "Critical Step", "Remarks", "CBME Certified"];
      const rows = data.results.map((r) => [r.studentName, r.rollNo, r.batch, r.stationName, r.score, r.total, `${r.scorePercent}%`, r.grade, r.criticalStepMet ? "Satisfied" : "Missed", r.evaluatorRemarks, r.cbmeCertified ? "Yes" : "No"]);
      triggerDownload(`osce_student_evaluations_${new Date().toISOString().slice(0, 10)}.csv`, toCsv([header, ...rows]));
    } else if (activeTab === "bookings") {
      const header = ["Applicant", "Role", "Room", "Equipment", "Date", "Time", "Purpose", "Status", "Notes"];
      const rows = data.bookings.map((b) => [b.applicantName, b.applicantRole, b.stationOrRoom, b.equipment, b.date, b.timeSlot, b.purpose, b.status, b.notes]);
      triggerDownload(`skills_lab_bookings_${new Date().toISOString().slice(0, 10)}.csv`, toCsv([header, ...rows]));
    } else if (activeTab === "equipment") {
      const header = ["Name", "Serial No", "Category", "Room", "Status", "Last Inspection", "Next Maintenance", "Weekly Utilization", "NMC Compliance"];
      const rows = data.equipment.map((e) => [e.name, e.serialNo, e.category, e.room, e.status, e.lastInspection, e.nextMaintenance, `${e.utilizationHoursWeek} hrs`, e.nmcComplianceStatus]);
      triggerDownload(`skills_lab_equipment_${new Date().toISOString().slice(0, 10)}.csv`, toCsv([header, ...rows]));
    } else {
      const header = ["Title", "Batch", "Department", "Date", "Time", "Venue", "Total Candidates", "Evaluated", "Lead Examiner", "Status"];
      const rows = data.sessions.map((s) => [s.title, s.batch, s.department, s.date, s.timeSlot, s.venue, s.totalCandidates, s.evaluatedCount, s.leadExaminer, s.status]);
      triggerDownload(`osce_circuits_${new Date().toISOString().slice(0, 10)}.csv`, toCsv([header, ...rows]));
    }
    flash("CSV export downloaded successfully!");
  };

  if (isLoading) return <TemplateSkeleton />;
  if (error || !data) {
    return (
      <div className="p-6">
        <EmptyState
          title="Failed to Load OSCE & Skills Lab Data"
          body={error instanceof Error ? error.message : "Unable to reach OSCE services."}
          action={<Button onClick={() => refetch()}>Retry</Button>}
        />
      </div>
    );
  }

  const { kpis } = data;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Flash Toast */}
      {flashMessage && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-lg shadow-xl text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Fi name="check" className="text-base" />
          <span>{flashMessage}</span>
        </div>
      )}

      {/* Header Banner & Cross-Portal Links */}
      <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-sky-950 text-white rounded-2xl p-6 shadow-xl border border-teal-800/40">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-400/30">
                NMC CBME Clinical Framework
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs bg-sky-500/20 text-sky-200 border border-sky-400/20">
                Phase 3 MSR Skills Lab
              </span>
              {role === "hod" && (
                <span className="px-2.5 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-300 border border-amber-400/30 font-medium">
                  Viewing as Head of Department (Clinical Oversight)
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-2 text-white flex items-center gap-3">
              <Fi name="heart" className="text-teal-400 text-2xl" />
              OSCE & Skills Simulation Lab
            </h1>
            <p className="text-sm md:text-base text-teal-100/80 mt-1 max-w-3xl">
              Objective Structured Clinical Examination circuits, checklist rubric authoring, high-fidelity manikin simulator bookings, and NMC CBME certified skill mastery.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button variant="secondary" size="sm" onClick={() => refetch()} className="border-teal-400/30 text-teal-100 hover:bg-teal-900/50">
              <Fi name="refresh" className="mr-1.5" /> Refresh
            </Button>
            <Button variant="secondary" size="sm" onClick={handleExportCsv} className="border-teal-400/30 text-teal-100 hover:bg-teal-900/50">
              <Fi name="download" className="mr-1.5" /> Export CSV
            </Button>
            {(role === "hod" || role === "faculty" || role === "admin") && (
              <>
                <Button
                  size="sm"
                  onClick={() => setShowAddStationModal(true)}
                  className="bg-teal-600 hover:bg-teal-500 text-white font-medium shadow-md shadow-teal-900/40"
                >
                  <Fi name="plus" className="mr-1.5" /> Add Station
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    if (data.stations.length > 0) {
                      setGradeStationId(data.stations[0]?.id || "");
                    }
                    setShowGradeModal(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                >
                  <Fi name="memo-circle-check" className="mr-1.5" /> Grade Candidate
                </Button>
              </>
            )}
            <Button
              size="sm"
              onClick={() => setShowBookingModal(true)}
              className="bg-sky-600 hover:bg-sky-500 text-white font-medium shadow-md shadow-sky-900/40"
            >
              <Fi name="calendar" className="mr-1.5" /> Book Lab Slot
            </Button>
          </div>
        </div>

        {/* Cross-Role Navigation & Action Workflows Bar */}
        <div className="mt-6 pt-4 border-t border-teal-800/50">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-300 mb-2 flex items-center gap-1.5">
            <Fi name="link" /> Related Portals & Clinical Action Workflows Across Roles:
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link
              href={`/${role}/competency-logbook`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-950/70 hover:bg-teal-900/90 text-teal-200 border border-teal-700/50 transition-colors"
            >
              <span>📓</span>
              <span className="font-semibold">Competency Logbook (CBME)</span>
              <span className="text-[10px] text-teal-400">NMC K/KH/SH/P certification</span>
            </Link>

            <Link
              href={`/${role}/clinical-rotations`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-950/70 hover:bg-teal-900/90 text-teal-200 border border-teal-700/50 transition-colors"
            >
              <span>🩺</span>
              <span className="font-semibold">Clinical Rotations</span>
              <span className="text-[10px] text-teal-400">Ward postings & attendance</span>
            </Link>

            <Link
              href={role === "institution" ? "/institution/hospital-dashboard" : `/${role}/hospital-dashboard`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-950/70 hover:bg-teal-900/90 text-teal-200 border border-teal-700/50 transition-colors"
            >
              <span>🏥</span>
              <span className="font-semibold">Teaching Hospital Dashboard</span>
              <span className="text-[10px] text-teal-400">Bed census & case loads</span>
            </Link>

            <Link
              href={`/${role}/early-warning`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-950/70 hover:bg-teal-900/90 text-teal-200 border border-teal-700/50 transition-colors"
            >
              <span>⚠️</span>
              <span className="font-semibold">Early Warning System</span>
              <span className="text-[10px] text-amber-400">Remediation for failed stations</span>
            </Link>

            <Link
              href="/institution/nmc-compliance"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-950/70 hover:bg-teal-900/90 text-teal-200 border border-teal-700/50 transition-colors"
            >
              <span>🛡️</span>
              <span className="font-semibold">NMC Council Compliance</span>
              <span className="text-[10px] text-sky-400">MSR skills-lab infrastructure</span>
            </Link>

            <Link
              href={`/${role}/curriculum`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-950/70 hover:bg-teal-900/90 text-teal-200 border border-teal-700/50 transition-colors"
            >
              <span>📚</span>
              <span className="font-semibold">Curriculum Studio</span>
              <span className="text-[10px] text-teal-400">CBME syllabus mapping</span>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-teal-100 dark:border-teal-900/40 bg-card">
          <CardBody className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Stations</p>
              <p className="text-2xl font-bold text-teal-600 dark:text-teal-400 mt-1">{kpis.activeStations}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Across {data.departments.length} clinical depts</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 flex items-center justify-center text-xl">
              <Fi name="heart" />
            </div>
          </CardBody>
        </Card>

        <Card className="border-sky-100 dark:border-sky-900/40 bg-card">
          <CardBody className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Avg Pass Rate</p>
              <p className="text-2xl font-bold text-sky-600 dark:text-sky-400 mt-1">{kpis.averagePassRate}%</p>
              <div className="w-24 mt-1">
                <Progress value={kpis.averagePassRate} />
              </div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 flex items-center justify-center text-xl">
              <Fi name="trophy" />
            </div>
          </CardBody>
        </Card>

        <Card className="border-emerald-100 dark:border-emerald-900/40 bg-card">
          <CardBody className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">CBME Certified</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{kpis.certifiedCompetencies}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Synced to NMC Logbook</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center text-xl">
              <Fi name="memo-circle-check" />
            </div>
          </CardBody>
        </Card>

        <Card className="border-amber-100 dark:border-amber-900/40 bg-card">
          <CardBody className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pending Bookings</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{kpis.pendingBookings}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{kpis.highFidelitySimulators} Simulators Active</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center text-xl">
              <Fi name="calendar" />
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border space-x-2 overflow-x-auto pb-1 text-sm font-medium">
        <button
          onClick={() => setActiveTab("stations")}
          className={`px-4 py-2 rounded-t-lg transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "stations"
              ? "border-teal-600 text-teal-600 dark:text-teal-400 bg-teal-50/50 dark:bg-teal-950/30 font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Fi name="clipboard-list-check" />
          OSCE Stations & Rubrics ({data.stations.length})
        </button>

        <button
          onClick={() => setActiveTab("sessions")}
          className={`px-4 py-2 rounded-t-lg transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "sessions"
              ? "border-teal-600 text-teal-600 dark:text-teal-400 bg-teal-50/50 dark:bg-teal-950/30 font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Fi name="calendar" />
          Exam Circuits & Sessions ({data.sessions.length})
        </button>

        <button
          onClick={() => setActiveTab("bookings")}
          className={`px-4 py-2 rounded-t-lg transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "bookings"
              ? "border-teal-600 text-teal-600 dark:text-teal-400 bg-teal-50/50 dark:bg-teal-950/30 font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Fi name="dashboard" />
          Skills Lab Bookings ({data.bookings.length})
        </button>

        <button
          onClick={() => setActiveTab("results")}
          className={`px-4 py-2 rounded-t-lg transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "results"
              ? "border-teal-600 text-teal-600 dark:text-teal-400 bg-teal-50/50 dark:bg-teal-950/30 font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Fi name="test" />
          Student Results & Logbook ({data.results.length})
        </button>

        <button
          onClick={() => setActiveTab("equipment")}
          className={`px-4 py-2 rounded-t-lg transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "equipment"
              ? "border-teal-600 text-teal-600 dark:text-teal-400 bg-teal-50/50 dark:bg-teal-950/30 font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Fi name="shield-check" />
          Simulators & NMC Norms ({data.equipment.length})
        </button>
      </div>

      {/* Tab 1: Stations */}
      {activeTab === "stations" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-card p-3 rounded-xl border border-border">
            <div className="flex flex-wrap items-center gap-2.5">
              <select
                aria-label="Filter by Domain"
                value={domainFilter}
                onChange={(e) => setDomainFilter(e.target.value)}
                className={`${inputClass} !w-auto text-xs`}
              >
                <option value="All Domains">All Domains</option>
                <option value="Procedure">Procedure (Hands-on)</option>
                <option value="Communication">Communication & Counseling</option>
                <option value="Emergency">Emergency & Resuscitation</option>
                <option value="Data interpretation">Data Interpretation</option>
                <option value="Physical Exam">Physical Examination</option>
              </select>

              <select
                aria-label="Filter by Department"
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className={`${inputClass} !w-auto text-xs`}
              >
                <option value="All Departments">All Departments</option>
                {data.departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search stations, NMC codes, manikins..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`${inputClass} text-xs md:w-72`}
              />
              {(role === "hod" || role === "faculty" || role === "admin") && (
                <Button size="sm" onClick={() => setShowAddStationModal(true)} className="bg-teal-600 text-white shrink-0">
                  <Fi name="plus" className="mr-1" /> New Station
                </Button>
              )}
            </div>
          </div>

          {/* Stations Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStations.map((station) => (
              <Card key={station.id} className="border-border hover:border-teal-500/50 transition-all flex flex-col justify-between">
                <CardBody className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                      Station #{station.number}
                    </span>
                    <Badge tone={toneForStatus(station.status)} className="text-xs">
                      {station.status}
                    </Badge>
                  </div>

                  <div>
                    <h3 className="font-semibold text-base leading-snug line-clamp-2">{station.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{station.department}</p>
                  </div>

                  <div className="bg-muted/40 p-2.5 rounded-lg text-xs space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Domain:</span>
                      <span className="font-medium text-foreground">{station.domain}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">NMC Code:</span>
                      <span className="font-mono font-medium text-teal-600 dark:text-teal-400">{station.nmcCompetencyCode}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Duration / Marks:</span>
                      <span className="font-medium">
                        {station.durationMinutes} mins | {station.passMarks}/{station.totalMarks} pass
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Room / Lab:</span>
                      <span className="font-medium truncate max-w-[170px]">{station.room}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Manikin / Eq:</span>
                      <span className="font-medium truncate max-w-[170px]">{station.manikinEquipment}</span>
                    </div>
                  </div>

                  {station.criticalStepRequired && (
                    <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300">
                      <span className="font-bold flex items-center gap-1">
                        <Fi name="triangle-warning" /> Must-Pass Critical Step:
                      </span>
                      <p className="mt-0.5 line-clamp-2">{station.criticalStepDescription}</p>
                    </div>
                  )}

                  <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                    <div>
                      <span className="text-muted-foreground">Avg Pass: </span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{station.passRate}%</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedStationForDetail(station)}
                        className="text-xs h-7 px-2 text-teal-600 hover:text-teal-700"
                      >
                        Rubric ({station.checklistCount}) ↗
                      </Button>
                      {(role === "hod" || role === "faculty" || role === "admin") && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => toggleStationMutation.mutate(station.id)}
                          className="text-xs h-7 px-2"
                        >
                          {station.status === "Active" ? "Set Maint." : "Set Active"}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>

          {filteredStations.length === 0 && (
            <EmptyState
              title="No Stations Found"
              body="No clinical stations matched your search and filter criteria."
              action={
                <Button
                  onClick={() => {
                    setDomainFilter("All Domains");
                    setDeptFilter("All Departments");
                    setSearchQuery("");
                  }}
                >
                  Clear Filters
                </Button>
              }
            />
          )}
        </div>
      )}

      {/* Tab 2: Sessions */}
      {activeTab === "sessions" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Objective Structured Clinical Examination circuits and timed station track rotations.
            </p>
            {(role === "hod" || role === "faculty" || role === "admin") && (
              <Button size="sm" onClick={() => setShowAddSessionModal(true)} className="bg-teal-600 text-white">
                <Fi name="plus" className="mr-1" /> Schedule Exam Circuit
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.sessions.map((sess) => (
              <Card key={sess.id} className="border-border">
                <CardBody className="p-4 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                      {sess.batch}
                    </span>
                    <Badge tone={toneForStatus(sess.status)}>
                      {sess.status}
                    </Badge>
                  </div>

                  <div>
                    <h3 className="font-semibold text-base">{sess.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{sess.department}</p>
                  </div>

                  <div className="bg-muted/40 p-2.5 rounded-lg text-xs space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Date & Slot:</span>
                      <span className="font-medium text-foreground">{sess.date} ({sess.timeSlot})</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Circuit Venue:</span>
                      <span className="font-medium truncate max-w-[170px]">{sess.venue}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Stations:</span>
                      <span className="font-medium text-teal-600 dark:text-teal-400">{sess.stationsAssigned} Active Stations</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Lead Examiner:</span>
                      <span className="font-medium truncate max-w-[170px]">{sess.leadExaminer}</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Evaluated Candidates:</span>
                      <span className="font-semibold text-foreground">
                        {sess.evaluatedCount} / {sess.totalCandidates}
                      </span>
                    </div>
                    <Progress value={(sess.evaluatedCount / (sess.totalCandidates || 1)) * 100} />
                  </div>

                  <div className="pt-2 border-t border-border flex justify-end gap-2 text-xs">
                    <Link
                      href={`/${role}/competency-logbook`}
                      className="px-2.5 py-1 rounded bg-muted hover:bg-muted/80 text-foreground transition-colors font-medium flex items-center gap-1"
                    >
                      Logbook Sync ↗
                    </Link>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Bookings */}
      {activeTab === "bookings" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div>
              <h3 className="text-base font-semibold">Skills Simulation Lab Bookings</h3>
              <p className="text-xs text-muted-foreground">
                Reservations for procedural manikin suites, lapbox trainers, and vascular task trainers.
              </p>
            </div>
            <Button size="sm" onClick={() => setShowBookingModal(true)} className="bg-sky-600 text-white">
              <Fi name="plus" className="mr-1" /> Book Practice Slot
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
                <tr>
                  <th className="p-3">Applicant</th>
                  <th className="p-3">Station / Room</th>
                  <th className="p-3">Equipment</th>
                  <th className="p-3">Date & Time</th>
                  <th className="p-3">Purpose</th>
                  <th className="p-3">Status</th>
                  {(role === "hod" || role === "faculty" || role === "admin") && <th className="p-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.bookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-muted/20">
                    <td className="p-3">
                      <p className="font-semibold text-foreground">{booking.applicantName}</p>
                      <p className="text-[10px] text-muted-foreground">{booking.applicantRole}</p>
                    </td>
                    <td className="p-3 font-medium">{booking.stationOrRoom}</td>
                    <td className="p-3 text-muted-foreground">{booking.equipment}</td>
                    <td className="p-3">
                      <span className="font-mono">{booking.date}</span>
                      <p className="text-[10px] text-muted-foreground">{booking.timeSlot}</p>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-muted font-medium">{booking.purpose}</span>
                    </td>
                    <td className="p-3">
                      <Badge tone={toneForStatus(booking.status)}>
                        {booking.status}
                      </Badge>
                    </td>
                    {(role === "hod" || role === "faculty" || role === "admin") && (
                      <td className="p-3 text-right space-x-1">
                        {booking.status === "Pending Review" && (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => updateBookingStatusMutation.mutate({ bookingId: booking.id, status: "Approved" })}
                              className="text-xs h-7 px-2 text-emerald-600 hover:text-emerald-700"
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => updateBookingStatusMutation.mutate({ bookingId: booking.id, status: "Rejected" })}
                              className="text-xs h-7 px-2 text-rose-600 hover:text-rose-700"
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {booking.status === "Approved" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => updateBookingStatusMutation.mutate({ bookingId: booking.id, status: "Completed" })}
                            className="text-xs h-7 px-2 text-sky-600 hover:text-sky-700"
                          >
                            Mark Done
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Results */}
      {activeTab === "results" && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
            <div>
              <h3 className="text-base font-semibold">Student Clinical Performance & Logbook</h3>
              <p className="text-xs text-muted-foreground">
                Individual station grading sheets, critical step certifications, and evaluator feedback.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search candidate name, roll no, station..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`${inputClass} text-xs md:w-64`}
              />
              {(role === "hod" || role === "faculty" || role === "admin") && (
                <Button
                  size="sm"
                  onClick={() => {
                    if (data.stations.length > 0) setGradeStationId(data.stations[0]?.id || "");
                    setShowGradeModal(true);
                  }}
                  className="bg-emerald-600 text-white shrink-0"
                >
                  <Fi name="plus" className="mr-1" /> Grade Candidate
                </Button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
                <tr>
                  <th className="p-3">Candidate</th>
                  <th className="p-3">Station</th>
                  <th className="p-3">Score</th>
                  <th className="p-3">Grade</th>
                  <th className="p-3">Critical Step</th>
                  <th className="p-3">Examiner Remarks</th>
                  <th className="p-3">CBME Logbook</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredResults.map((result) => (
                  <tr key={result.id} className="hover:bg-muted/20">
                    <td className="p-3">
                      <p className="font-semibold text-foreground">{result.studentName}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{result.rollNo} • {result.batch}</p>
                    </td>
                    <td className="p-3 font-medium max-w-[200px] truncate">{result.stationName}</td>
                    <td className="p-3">
                      <span className="font-semibold text-foreground">
                        {result.score} / {result.total}
                      </span>
                      <p className="text-[10px] text-muted-foreground">{result.scorePercent}%</p>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          result.grade === "Distinction"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : result.grade === "Pass"
                            ? "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                        }`}
                      >
                        {result.grade}
                      </span>
                    </td>
                    <td className="p-3">
                      {result.criticalStepMet ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                          <Fi name="check" /> Satisfied
                        </span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
                          <Fi name="triangle-warning" /> Missed
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground max-w-[220px] line-clamp-2">
                      {result.evaluatorRemarks}
                    </td>
                    <td className="p-3">
                      {result.cbmeCertified ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 font-medium text-[10px] border border-emerald-400/30">
                          Certified (SH)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 font-medium text-[10px]">
                          Pending Remediation
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {result.grade === "Remediation Needed" ? (
                        <Link
                          href={`/${role}/early-warning`}
                          className="text-[10px] px-2 py-1 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 font-medium"
                        >
                          Remediation Alert ↗
                        </Link>
                      ) : (
                        <Link
                          href={`/${role}/competency-logbook`}
                          className="text-[10px] px-2 py-1 rounded bg-teal-500/10 text-teal-700 dark:text-teal-300 hover:bg-teal-500/20 font-medium"
                        >
                          View in Logbook ↗
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Equipment */}
      {activeTab === "equipment" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-semibold">Skills Lab Equipment & Simulation Infrastructure</h3>
              <p className="text-xs text-muted-foreground">
                National Medical Commission (NMC) MSR compliance status, calibration logs, and manikin maintenance.
              </p>
            </div>
            <Link
              href="/institution/nmc-compliance"
              className="text-xs px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium flex items-center gap-1.5"
            >
              <span>🛡️</span> Council Compliance Report ↗
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.equipment.map((eq) => (
              <Card key={eq.id} className="border-border">
                <CardBody className="p-4 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      {eq.serialNo}
                    </span>
                    <Badge tone={toneForStatus(eq.status)}>
                      {eq.status}
                    </Badge>
                  </div>

                  <div>
                    <h4 className="font-semibold text-base">{eq.name}</h4>
                    <p className="text-xs text-muted-foreground">{eq.category}</p>
                  </div>

                  <div className="bg-muted/40 p-2.5 rounded-lg text-xs space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Location:</span>
                      <span className="font-medium text-foreground">{eq.room}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Weekly Utilization:</span>
                      <span className="font-semibold text-teal-600 dark:text-teal-400">{eq.utilizationHoursWeek} hrs/week</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Last Inspected:</span>
                      <span className="font-mono text-muted-foreground">{eq.lastInspection}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Next Service:</span>
                      <span className="font-mono text-muted-foreground">{eq.nextMaintenance}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">NMC Norm Status:</span>
                    <span
                      className={`font-semibold ${
                        eq.nmcComplianceStatus === "Fully Compliant"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {eq.nmcComplianceStatus}
                    </span>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Station Detail Modal */}
      {selectedStationForDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                  Station #{selectedStationForDetail.number} • {selectedStationForDetail.domain}
                </span>
                <h3 className="text-xl font-bold mt-1 text-foreground">{selectedStationForDetail.title}</h3>
                <p className="text-xs text-muted-foreground">
                  {selectedStationForDetail.department} • NMC Code:{" "}
                  <span className="font-mono text-teal-600 dark:text-teal-400 font-semibold">
                    {selectedStationForDetail.nmcCompetencyCode}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setSelectedStationForDetail(null)}
                className="text-muted-foreground hover:text-foreground text-xl leading-none"
              >
                ✕
              </button>
            </div>

            {selectedStationForDetail.criticalStepRequired && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-900 dark:text-amber-200">
                <span className="font-bold flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                  <Fi name="triangle-warning" /> Mandatory Critical Safety Step:
                </span>
                <p className="mt-1">{selectedStationForDetail.criticalStepDescription}</p>
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold mb-2">Checklist Scoring Rubric ({selectedStationForDetail.checklist.length} Steps)</h4>
              <div className="space-y-2">
                {selectedStationForDetail.checklist.map((step, idx) => (
                  <div key={step.id} className="p-2.5 rounded-lg border border-border bg-muted/30 flex justify-between items-start gap-3 text-xs">
                    <div className="flex gap-2">
                      <span className="font-semibold text-muted-foreground">{idx + 1}.</span>
                      <div>
                        <p className="font-medium text-foreground">{step.step}</p>
                        <div className="flex gap-2 mt-1">
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground">{step.category}</span>
                          {step.isCritical && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-700 dark:text-rose-300 font-semibold">
                              Critical Step
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="font-semibold text-teal-600 dark:text-teal-400 shrink-0">
                      {step.maxMarks} marks
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-border flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSelectedStationForDetail(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Station Modal */}
      {showAddStationModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">Add New OSCE Clinical Station</h3>
              <button onClick={() => setShowAddStationModal(false)} className="text-muted-foreground text-xl">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Station Title</label>
                <input
                  type="text"
                  value={stationTitle}
                  onChange={(e) => setStationTitle(e.target.value)}
                  placeholder="e.g. Lumbar Puncture Procedure on Sim Manikin"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Clinical Department</label>
                  <select value={stationDept} onChange={(e) => setStationDept(e.target.value)} className={inputClass}>
                    {data.departments.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold block mb-1">Domain</label>
                  <select
                    value={stationDomain}
                    onChange={(e) => setStationDomain(e.target.value as any)}
                    className={inputClass}
                  >
                    <option value="Procedure">Procedure</option>
                    <option value="Communication">Communication</option>
                    <option value="Emergency">Emergency</option>
                    <option value="Data interpretation">Data interpretation</option>
                    <option value="Physical Exam">Physical Exam</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Duration (Mins)</label>
                  <input
                    type="number"
                    value={stationDuration}
                    onChange={(e) => setStationDuration(Number(e.target.value))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Total Marks</label>
                  <input
                    type="number"
                    value={stationTotalMarks}
                    onChange={(e) => setStationTotalMarks(Number(e.target.value))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Pass Marks</label>
                  <input
                    type="number"
                    value={stationPassMarks}
                    onChange={(e) => setStationPassMarks(Number(e.target.value))}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">NMC Competency Code</label>
                  <input
                    type="text"
                    value={stationNmcCode}
                    onChange={(e) => setStationNmcCode(e.target.value)}
                    placeholder="e.g. IM-11.4 or SU-17.2"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Room / Cubicle</label>
                  <input
                    type="text"
                    value={stationRoom}
                    onChange={(e) => setStationRoom(e.target.value)}
                    placeholder="e.g. Skills Lab Room 3"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Manikin / Simulator Equipment</label>
                <input
                  type="text"
                  value={stationManikin}
                  onChange={(e) => setStationManikin(e.target.value)}
                  placeholder="e.g. Spinal Injection Simulator"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Mandatory Must-Pass Critical Step</label>
                <textarea
                  value={stationCriticalDesc}
                  onChange={(e) => setStationCriticalDesc(e.target.value)}
                  rows={2}
                  className={inputClass}
                />
              </div>

              {/* Checklist steps editor */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="font-semibold">Checklist Rubric Steps</label>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setChecklistSteps([
                        ...checklistSteps,
                        { step: "New clinical checklist step", maxMarks: 4, isCritical: false, category: "Execution" },
                      ])
                    }
                    className="text-xs h-6 px-2"
                  >
                    + Add Step
                  </Button>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {checklistSteps.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={item.step}
                        onChange={(e) => {
                          const updated = [...checklistSteps];
                          const cur = updated[idx];
                          if (cur) cur.step = e.target.value;
                          setChecklistSteps(updated);
                        }}
                        className={`${inputClass} flex-1 text-xs`}
                      />
                      <input
                        type="number"
                        value={item.maxMarks}
                        onChange={(e) => {
                          const updated = [...checklistSteps];
                          const cur = updated[idx];
                          if (cur) cur.maxMarks = Number(e.target.value);
                          setChecklistSteps(updated);
                        }}
                        className={`${inputClass} !w-16 text-xs`}
                      />
                      <label className="text-[10px] flex items-center gap-1 shrink-0">
                        <input
                          type="checkbox"
                          checked={item.isCritical}
                          onChange={(e) => {
                            const updated = [...checklistSteps];
                            const cur = updated[idx];
                            if (cur) cur.isCritical = e.target.checked;
                            setChecklistSteps(updated);
                          }}
                        />
                        Crit
                      </label>
                      <button
                        onClick={() => setChecklistSteps(checklistSteps.filter((_, i) => i !== idx))}
                        className="text-rose-500 hover:text-rose-700 text-sm px-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-border flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowAddStationModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  createStationMutation.mutate({
                    title: stationTitle,
                    department: stationDept,
                    domain: stationDomain,
                    durationMinutes: stationDuration,
                    totalMarks: stationTotalMarks,
                    passMarks: stationPassMarks,
                    nmcCompetencyCode: stationNmcCode,
                    room: stationRoom,
                    manikinEquipment: stationManikin,
                    criticalStepRequired: stationCriticalReq,
                    criticalStepDescription: stationCriticalDesc,
                    checklist: checklistSteps,
                  })
                }
                disabled={!stationTitle || createStationMutation.isPending}
                className="bg-teal-600 text-white"
              >
                {createStationMutation.isPending ? "Creating..." : "Save Station"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Session Modal */}
      {showAddSessionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">Schedule OSCE Exam Circuit</h3>
              <button onClick={() => setShowAddSessionModal(false)} className="text-muted-foreground text-xl">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Session Title</label>
                <input
                  type="text"
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                  placeholder="e.g. Phase 3 Part 2 Comprehensive Clinical OSCE"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Target Batch</label>
                  <input
                    type="text"
                    value={sessionBatch}
                    onChange={(e) => setSessionBatch(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Department / Board</label>
                  <input
                    type="text"
                    value={sessionDept}
                    onChange={(e) => setSessionDept(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Date</label>
                  <input
                    type="date"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Time Slot</label>
                  <input
                    type="text"
                    value={sessionTime}
                    onChange={(e) => setSessionTime(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Circuit Venue</label>
                <input
                  type="text"
                  value={sessionVenue}
                  onChange={(e) => setSessionVenue(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Total Candidates</label>
                  <input
                    type="number"
                    value={sessionCandidates}
                    onChange={(e) => setSessionCandidates(Number(e.target.value))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Lead Examiner</label>
                  <input
                    type="text"
                    value={sessionExaminer}
                    onChange={(e) => setSessionExaminer(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-border flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowAddSessionModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  createSessionMutation.mutate({
                    title: sessionTitle,
                    batch: sessionBatch,
                    department: sessionDept,
                    date: sessionDate,
                    timeSlot: sessionTime,
                    venue: sessionVenue,
                    totalCandidates: sessionCandidates,
                    leadExaminer: sessionExaminer,
                  })
                }
                disabled={!sessionTitle || createSessionMutation.isPending}
                className="bg-teal-600 text-white"
              >
                {createSessionMutation.isPending ? "Scheduling..." : "Schedule Circuit"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Book Lab Slot Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">Book Skills Simulation Lab Slot</h3>
              <button onClick={() => setShowBookingModal(false)} className="text-muted-foreground text-xl">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Applicant Name</label>
                  <input
                    type="text"
                    value={bookApplicantName}
                    onChange={(e) => setBookApplicantName(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Role</label>
                  <select
                    value={bookApplicantRole}
                    onChange={(e) => setBookApplicantRole(e.target.value as any)}
                    className={inputClass}
                  >
                    <option value="Student">Student</option>
                    <option value="Resident">Resident</option>
                    <option value="Faculty">Faculty</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Room / Cubicle</label>
                  <input
                    type="text"
                    value={bookRoom}
                    onChange={(e) => setBookRoom(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Equipment / Manikin</label>
                  <input
                    type="text"
                    value={bookEquipment}
                    onChange={(e) => setBookEquipment(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Date</label>
                  <input
                    type="date"
                    value={bookDate}
                    onChange={(e) => setBookDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Time Slot</label>
                  <input
                    type="text"
                    value={bookTime}
                    onChange={(e) => setBookTime(e.target.value)}
                    placeholder="e.g. 14:00 - 15:30"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Practice Purpose</label>
                <select
                  value={bookPurpose}
                  onChange={(e) => setBookPurpose(e.target.value as any)}
                  className={inputClass}
                >
                  <option value="Independent Practice">Independent Practice</option>
                  <option value="Faculty-Guided Demo">Faculty-Guided Demo</option>
                  <option value="Remediation Training">Remediation Training</option>
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">Notes / Skill Objectives</label>
                <textarea
                  value={bookNotes}
                  onChange={(e) => setBookNotes(e.target.value)}
                  placeholder="Mention specific procedure you will be practicing..."
                  rows={2}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="pt-3 border-t border-border flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowBookingModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  createBookingMutation.mutate({
                    applicantName: bookApplicantName,
                    applicantRole: bookApplicantRole,
                    stationOrRoom: bookRoom,
                    equipment: bookEquipment,
                    date: bookDate,
                    timeSlot: bookTime,
                    purpose: bookPurpose,
                    notes: bookNotes,
                  })
                }
                disabled={!bookApplicantName || createBookingMutation.isPending}
                className="bg-sky-600 text-white"
              >
                {createBookingMutation.isPending ? "Submitting..." : "Submit Reservation"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Grade Candidate Modal */}
      {showGradeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">Grade Candidate Clinical Performance</h3>
              <button onClick={() => setShowGradeModal(false)} className="text-muted-foreground text-xl">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Student Full Name</label>
                  <input
                    type="text"
                    value={gradeStudentName}
                    onChange={(e) => setGradeStudentName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Roll / Register Number</label>
                  <input
                    type="text"
                    value={gradeRollNo}
                    onChange={(e) => setGradeRollNo(e.target.value)}
                    placeholder="e.g. MED22-065"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">MBBS Batch</label>
                  <input
                    type="text"
                    value={gradeBatch}
                    onChange={(e) => setGradeBatch(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Assigned Station</label>
                  <select
                    value={gradeStationId}
                    onChange={(e) => setGradeStationId(e.target.value)}
                    className={inputClass}
                  >
                    {data.stations.map((s) => (
                      <option key={s.id} value={s.id}>
                        Station {s.number}: {s.title} ({s.totalMarks}m)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Marks Awarded</label>
                <input
                  type="number"
                  value={gradeScore}
                  onChange={(e) => setGradeScore(Number(e.target.value))}
                  className={inputClass}
                />
              </div>

              <div className="p-2.5 rounded bg-muted/40 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gradeCriticalMet}
                    onChange={(e) => setGradeCriticalMet(e.target.checked)}
                  />
                  <span className="font-semibold text-foreground">
                    Candidate Satisfied All Mandatory Critical Steps
                  </span>
                </label>
                <p className="text-[11px] text-muted-foreground ml-5">
                  If unchecked, score will automatically be flagged for skills remediation regardless of total marks.
                </p>
              </div>

              <div>
                <label className="font-semibold block mb-1">Evaluator Feedback & Recommendations</label>
                <textarea
                  value={gradeRemarks}
                  onChange={(e) => setGradeRemarks(e.target.value)}
                  placeholder="e.g. Good communication; ensure needle angle remains consistent during deep tissue suture."
                  rows={2}
                  className={inputClass}
                />
              </div>

              <div className="p-2.5 rounded bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gradeCbmeCertified}
                    onChange={(e) => setGradeCbmeCertified(e.target.checked)}
                  />
                  <span className="font-semibold text-teal-800 dark:text-teal-200">
                    Certify Skill Level in NMC Competency Logbook (SH Level)
                  </span>
                </label>
              </div>
            </div>

            <div className="pt-3 border-t border-border flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowGradeModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  gradeStudentMutation.mutate({
                    studentName: gradeStudentName,
                    rollNo: gradeRollNo,
                    batch: gradeBatch,
                    stationId: gradeStationId || (data.stations[0]?.id || ""),
                    score: gradeScore,
                    criticalStepMet: gradeCriticalMet,
                    evaluatorRemarks: gradeRemarks,
                    cbmeCertified: gradeCbmeCertified,
                  })
                }
                disabled={!gradeStudentName || !gradeRollNo || gradeStudentMutation.isPending}
                className="bg-emerald-600 text-white"
              >
                {gradeStudentMutation.isPending ? "Recording..." : "Save Evaluation"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
