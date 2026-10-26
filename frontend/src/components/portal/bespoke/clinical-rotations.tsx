"use client";

import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Award,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Filter,
  Plus,
  Search,
  ShieldCheck,
  Stethoscope,
  User,
  X,
} from "lucide-react";
import type { Role } from "@/lib/auth/roles";
import { apiFetch } from "@/lib/api/client";
import { RecordList } from "@/lib/api/schemas";
import {
  Badge,
  Button,
  Card,
  inputClass,
  LinkButton,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

type StudentTab = "active" | "competencies" | "roadmap" | "attendance";

interface RotationEntry {
  id: string;
  department: string;
  unit: string;
  duration: string;
  dates: string;
  supervisor: string;
  attendance: number;
  totalDays: number;
  attendedDays: number;
  competenciesCertified: number;
  competenciesRequired: number;
  status: "Completed" | "Ongoing" | "Scheduled" | "Extended";
  clinicalFocus: string;
}

const DEFAULT_ROADMAP: RotationEntry[] = [
  {
    id: "ROT-1001",
    department: "General Medicine",
    unit: "Unit I · Medical Ward 4",
    duration: "6 Weeks",
    dates: "Aug 15, 2026 – Sep 28, 2026",
    supervisor: "Dr. R. Prakash, MD",
    attendance: 92,
    totalDays: 36,
    attendedDays: 33,
    competenciesCertified: 14,
    competenciesRequired: 14,
    status: "Completed",
    clinicalFocus: "Bedside history clerking, CVS/RS murmurs, ECG rhythm, Lumbar puncture observation",
  },
  {
    id: "ROT-1002",
    department: "General Surgery",
    unit: "Unit II · Male Surgical Ward 14",
    duration: "4 Weeks",
    dates: "Oct 01, 2026 – Oct 28, 2026",
    supervisor: "Dr. R. Prakash, MD",
    attendance: 88,
    totalDays: 25,
    attendedDays: 22,
    competenciesCertified: 6,
    competenciesRequired: 8,
    status: "Ongoing",
    clinicalFocus: "Pre/post-op care, sterile scrubbing, suturing, Ryle's tube, Foley catheterization",
  },
  {
    id: "ROT-1003",
    department: "Obstetrics & Gynaecology",
    unit: "Unit III · Labour Ward & Antenatal OPD",
    duration: "4 Weeks",
    dates: "Nov 01, 2026 – Nov 28, 2026",
    supervisor: "Dr. K. Meenakshi, MD (OBG)",
    attendance: 0,
    totalDays: 24,
    attendedDays: 0,
    competenciesCertified: 0,
    competenciesRequired: 10,
    status: "Scheduled",
    clinicalFocus: "Antenatal examination, Leopold manoeuvres, Partograph monitoring, Normal delivery assistance",
  },
  {
    id: "ROT-1004",
    department: "Paediatrics",
    unit: "Unit I · Child Ward & NICU",
    duration: "4 Weeks",
    dates: "Dec 01, 2026 – Dec 28, 2026",
    supervisor: "Dr. S. Ramesh, MD (Paed)",
    attendance: 0,
    totalDays: 24,
    attendedDays: 0,
    competenciesCertified: 0,
    competenciesRequired: 8,
    status: "Scheduled",
    clinicalFocus: "Developmental milestones, neonatal reflex testing, pediatric drug calculation, immunization",
  },
  {
    id: "ROT-1005",
    department: "Emergency Medicine / Casualty",
    unit: "24x7 Acute Trauma Centre & Triage",
    duration: "2 Weeks",
    dates: "Jan 02, 2027 – Jan 15, 2027",
    supervisor: "Dr. V. Karthik, MD (Emergency)",
    attendance: 0,
    totalDays: 12,
    attendedDays: 0,
    competenciesCertified: 0,
    competenciesRequired: 6,
    status: "Scheduled",
    clinicalFocus: "BLS/ACLS resuscitation, trauma primary survey, IV cannula, airway management",
  },
  {
    id: "ROT-1006",
    department: "Orthopaedics",
    unit: "Unit II · Fracture Clinic & Ortho Ward",
    duration: "2 Weeks",
    dates: "Jan 16, 2027 – Jan 29, 2027",
    supervisor: "Dr. M. Soundararajan, MS (Ortho)",
    attendance: 0,
    totalDays: 12,
    attendedDays: 0,
    competenciesCertified: 0,
    competenciesRequired: 5,
    status: "Scheduled",
    clinicalFocus: "Plaster slab application, Thomas splint, joint examination, fracture X-ray interpretation",
  },
];

interface ProcedureSkill {
  id: string;
  name: string;
  code: string;
  level: "Shows How" | "Performs";
  status: "Certified" | "Pending Review" | "To be Attempted";
  certifier?: string;
  date?: string;
  notes?: string;
  studentName?: string;
}

const DEFAULT_COMPETENCIES: ProcedureSkill[] = [
  {
    id: "SK-01",
    name: "Aseptic hand scrubbing, gowning and sterile gloving",
    code: "SU11.1",
    level: "Shows How",
    status: "Certified",
    certifier: "Dr. R. Prakash, MD",
    date: "04 Oct 2026",
  },
  {
    id: "SK-02",
    name: "Simple interrupted surgical suturing & instrument knot tying",
    code: "SU14.3",
    level: "Performs",
    status: "Certified",
    certifier: "Dr. R. Prakash, MD",
    date: "08 Oct 2026",
  },
  {
    id: "SK-03",
    name: "Nasogastric (Ryle's) tube insertion and verification",
    code: "SU17.2",
    level: "Performs",
    status: "Certified",
    certifier: "Dr. S. Anbarasu (SR)",
    date: "11 Oct 2026",
  },
  {
    id: "SK-04",
    name: "Urinary Foley catheterization with sterile precautions",
    code: "SU20.1",
    level: "Performs",
    status: "Certified",
    certifier: "Dr. R. Prakash, MD",
    date: "14 Oct 2026",
  },
  {
    id: "SK-05",
    name: "Pre-operative evaluation & WHO Surgical Safety Checklist",
    code: "SU10.2",
    level: "Shows How",
    status: "Certified",
    certifier: "Dr. S. Anbarasu (SR)",
    date: "16 Oct 2026",
  },
  {
    id: "SK-06",
    name: "Post-operative surgical wound dressing & drain inspection",
    code: "SU14.5",
    level: "Performs",
    status: "Certified",
    certifier: "Dr. R. Prakash, MD",
    date: "19 Oct 2026",
  },
  {
    id: "SK-07",
    name: "Digital rectal examination & proctoscopy assist",
    code: "SU22.4",
    level: "Shows How",
    status: "Pending Review",
    certifier: "Submitted to Dr. Anbarasu",
    date: "Yesterday",
    studentName: "Aishwarya V.",
    notes: "Observed and assisted Senior Resident during proctoscopy. Anal sphincteric tone assessed, no external haemorrhoids, rectal mucosa inspected under proper illumination.",
  },
  {
    id: "SK-08",
    name: "Incision and drainage of superficial cutaneous abscess",
    code: "SU15.1",
    level: "Performs",
    status: "To be Attempted",
  },
];

const DEFAULT_PATIENTS = [
  {
    bed: "Bed 14",
    patient: "Murugesan K., 42 M",
    diagnosis: "Acute Appendicitis with Localized Peritonitis",
    date: "21 Oct 2026",
    status: "Approved",
    faculty: "Dr. R. Prakash, MD",
  },
  {
    bed: "Bed 19",
    patient: "Selvam P., 56 M",
    diagnosis: "Right Inguinal Hernia (Direct) - For Lichtenstein Mesh Repair",
    date: "18 Oct 2026",
    status: "Approved",
    faculty: "Dr. S. Anbarasu (SR)",
  },
  {
    bed: "Bed 22",
    patient: "Ganesan R., 61 M",
    diagnosis: "Diabetic Foot Ulcer (Wagner Grade 3) with Neuropathy",
    date: "15 Oct 2026",
    status: "Approved",
    faculty: "Dr. R. Prakash, MD",
  },
];

export function ClinicalRotationsModule({ role }: { role?: Role }) {
  const isFacultyOrAdmin = role === "faculty" || role === "hod" || role === "institution" || role === "admin";
  const [activeTab, setActiveTab] = useState<StudentTab>("active");
  const [caseModalOpen, setCaseModalOpen] = useState(false);
  const [procedureModalOpen, setProcedureModalOpen] = useState(false);
  const [newPatient, setNewPatient] = useState({ bed: "", name: "", age: "", diagnosis: "", complaints: "" });
  const [newProcedure, setNewProcedure] = useState({ procedure: "SU15.1", notes: "", supervisor: "Dr. R. Prakash, MD" });
  const [viewingSkillNotes, setViewingSkillNotes] = useState<ProcedureSkill | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // ── 1. Fetch Dynamic Rotations Records from API ──
  const { data: apiData, isLoading: isApiLoading } = useQuery({
    queryKey: ["records", "rotations"],
    queryFn: () => apiFetch("/api/v1/records/rotations?page=1&pageSize=50", RecordList),
  });

  const qc = useQueryClient();

  // ── 2. Live Patient Cases via API ──
  const { data: casesData } = useQuery({
    queryKey: ["clinical", "cases"],
    queryFn: () => apiFetch("/api/v1/clinical/cases", z.any()),
  });
  const caseList = casesData?.cases ?? DEFAULT_PATIENTS;

  // ── 3. Live Procedural Skills via API ──
  const { data: dopsData } = useQuery({
    queryKey: ["clinical", "dops"],
    queryFn: () => apiFetch("/api/v1/clinical/dops", z.any()),
  });
  const skillsList = dopsData?.skills ?? DEFAULT_COMPETENCIES;

  const createCaseMutation = useMutation({
    mutationFn: (data: any) =>
      apiFetch("/api/v1/clinical/cases", z.any(), {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinical", "cases"] });
      showToast("Case sheet logged and submitted for faculty verification!");
      setCaseModalOpen(false);
      setNewPatient({ bed: "", name: "", age: "", diagnosis: "", complaints: "" });
    },
  });

  const approveCaseMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch("/api/v1/clinical/cases/approve", z.any(), {
        method: "POST",
        body: { id },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinical", "cases"] });
      showToast("Case sheet verified and approved in logbook!");
    },
  });

  const submitDopsMutation = useMutation({
    mutationFn: (data: any) =>
      apiFetch("/api/v1/clinical/dops/submit", z.any(), {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinical", "dops"] });
      showToast("DOPS skill submitted to supervisor for digital sign-off!");
      setProcedureModalOpen(false);
    },
  });

  const approveDopsMutation = useMutation({
    mutationFn: (code: string) =>
      apiFetch("/api/v1/clinical/dops/approve", z.any(), {
        method: "POST",
        body: { code },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinical", "dops"] });
      showToast("DOPS skill signed off and certified!");
    },
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // ── 4. Compute Dynamic Rotation Roadmap ──
  const roadmap: RotationEntry[] = useMemo(() => {
    if (apiData?.items && apiData.items.length > 0) {
      // Map live API records
      return apiData.items.map((item, i) => {
        const isScheduled = item.status === "Scheduled";
        const att = isScheduled ? 0 : (typeof item.attendance === "number" ? item.attendance : 0);
        const total = 25;
        const attended = Math.round((att / 100) * total);
        const signed = isScheduled ? 0 : (typeof item.competenciesSigned === "number" ? item.competenciesSigned : 0);
        return {
          id: String(item.id || `ROT-${1001 + i}`),
          department: String(item.department || "General Surgery"),
          unit: String(item.unit || "Unit II · Ward 14"),
          duration: "4 Weeks",
          dates: `${item.startDate || "2026-10-01"} – ${item.endDate || "2026-10-28"}`,
          supervisor: String(item.supervisor || "Dr. R. Prakash, MD"),
          attendance: att,
          totalDays: total,
          attendedDays: attended,
          competenciesCertified: signed,
          competenciesRequired: 8,
          status: (item.status as any) || "Ongoing",
          clinicalFocus: String(item.remarks || "Bedside clinical training & case clerking"),
        };
      });
    }
    return DEFAULT_ROADMAP;
  }, [apiData]);

  // Active ongoing posting
  const activePosting = useMemo(() => {
    return roadmap.find((r) => r.status === "Ongoing") || roadmap[0] || DEFAULT_ROADMAP[1];
  }, [roadmap]);

  // Dynamic count of DOPS certified
  const totalCertifiedSkills = useMemo(() => {
    return skillsList.filter((s) => s.status === "Certified").length;
  }, [skillsList]);

  // ── Tab 1: Cases Search, Filter, Pagination ──
  const [caseSearch, setCaseSearch] = useState("");
  const [caseStatusFilter, setCaseStatusFilter] = useState("all");
  const [casePage, setCasePage] = useState(1);
  const CASE_PAGE_SIZE = 2;

  const filteredCases = useMemo(() => {
    return caseList.filter((c: any) => {
      const q = caseSearch.toLowerCase().trim();
      const matchesQ =
        !q ||
        c.patient?.toLowerCase().includes(q) ||
        c.diagnosis?.toLowerCase().includes(q) ||
        c.bed?.toLowerCase().includes(q) ||
        c.studentName?.toLowerCase().includes(q);
      const matchesStatus =
        caseStatusFilter === "all" ||
        c.status?.toLowerCase() === caseStatusFilter.toLowerCase();
      return matchesQ && matchesStatus;
    });
  }, [caseList, caseSearch, caseStatusFilter]);

  const totalCasePages = Math.max(1, Math.ceil(filteredCases.length / CASE_PAGE_SIZE));
  const paginatedCases = useMemo(() => {
    const start = (casePage - 1) * CASE_PAGE_SIZE;
    return filteredCases.slice(start, start + CASE_PAGE_SIZE);
  }, [filteredCases, casePage]);

  // ── Tab 2: DOPS Search, Filter, Pagination ──
  const [dopsSearch, setDopsSearch] = useState("");
  const [dopsStatusFilter, setDopsStatusFilter] = useState("all");
  const [dopsPage, setDopsPage] = useState(1);
  const DOPS_PAGE_SIZE = 4;

  const filteredSkills = useMemo(() => {
    return skillsList.filter((s) => {
      const q = dopsSearch.toLowerCase().trim();
      const matchesQ =
        !q ||
        s.name?.toLowerCase().includes(q) ||
        s.code?.toLowerCase().includes(q) ||
        s.certifier?.toLowerCase().includes(q);
      const matchesStatus =
        dopsStatusFilter === "all" ||
        s.status?.toLowerCase() === dopsStatusFilter.toLowerCase();
      return matchesQ && matchesStatus;
    });
  }, [skillsList, dopsSearch, dopsStatusFilter]);

  const totalDopsPages = Math.max(1, Math.ceil(filteredSkills.length / DOPS_PAGE_SIZE));
  const paginatedSkills = useMemo(() => {
    const start = (dopsPage - 1) * DOPS_PAGE_SIZE;
    return filteredSkills.slice(start, start + DOPS_PAGE_SIZE);
  }, [filteredSkills, dopsPage]);

  // ── Tab 3: Roster Search, Filter, Pagination ──
  const [rosterSearch, setRosterSearch] = useState("");
  const [rosterStatusFilter, setRosterStatusFilter] = useState("all");
  const [rosterPage, setRosterPage] = useState(1);
  const ROSTER_PAGE_SIZE = 2;

  const filteredRoadmap = useMemo(() => {
    return roadmap.filter((r) => {
      const q = rosterSearch.toLowerCase().trim();
      const matchesQ =
        !q ||
        r.department?.toLowerCase().includes(q) ||
        r.unit?.toLowerCase().includes(q) ||
        r.supervisor?.toLowerCase().includes(q);
      const matchesStatus =
        rosterStatusFilter === "all" ||
        r.status?.toLowerCase() === rosterStatusFilter.toLowerCase();
      return matchesQ && matchesStatus;
    });
  }, [roadmap, rosterSearch, rosterStatusFilter]);

  const totalRosterPages = Math.max(1, Math.ceil(filteredRoadmap.length / ROSTER_PAGE_SIZE));
  const paginatedRoadmap = useMemo(() => {
    const start = (rosterPage - 1) * ROSTER_PAGE_SIZE;
    return filteredRoadmap.slice(start, start + ROSTER_PAGE_SIZE);
  }, [filteredRoadmap, rosterPage]);

  // ── Tab 4: Attendance Filter ──
  const [attendanceFilter, setAttendanceFilter] = useState("all");

  const filteredAttendance = useMemo(() => {
    const active = roadmap.filter((r) => r.status !== "Scheduled");
    if (attendanceFilter === "eligible") return active.filter((r) => r.attendance >= 80);
    if (attendanceFilter === "below") return active.filter((r) => r.attendance < 80);
    return active;
  }, [roadmap, attendanceFilter]);

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl bg-brand px-4 py-3 text-xs font-medium text-white shadow-xl animate-in slide-in-from-bottom-2">
          <Check className="size-4" />
          <span>{toast}</span>
        </div>
      ) : null}

      {/* ── 1. Top KPI Summary Cards (Matches standard portal styling) ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Active Ward */}
        <Card className="p-5">
          <p className="flex items-center gap-2 text-sm text-ink-3">
            <Stethoscope className="size-4" /> Current Ward
          </p>
          <p className="mt-1 text-2xl font-semibold text-ink truncate">{activePosting.department}</p>
          <p className="mt-1 text-xs text-ink-3 truncate">{activePosting.unit}</p>
        </Card>

        {/* Clinical Attendance */}
        <Card className="p-5">
          <p className="flex items-center gap-2 text-sm text-ink-3">
            <ShieldCheck className="size-4" /> Ward Attendance
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-ink">
              {isApiLoading ? "..." : `${activePosting.attendance}%`}
            </span>
            <span className="text-xs text-ink-3">({activePosting.attendedDays}/{activePosting.totalDays}d)</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${activePosting.attendance}%` }} />
          </div>
        </Card>

        {/* Competencies Certified */}
        <Card className="p-5">
          <p className="flex items-center gap-2 text-sm text-ink-3">
            <Award className="size-4" /> DOPS Certified
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-ink">
              {totalCertifiedSkills}
            </span>
            <span className="text-xs text-ink-3">/ {skillsList.length} Signed</span>
          </div>
          <p className="mt-1 text-xs text-ink-3">Surgery Unit II Logbook</p>
        </Card>

        {/* Daily Rounds Status */}
        <Card className="p-5">
          <p className="flex items-center gap-2 text-sm text-ink-3">
            <Clock className="size-4" /> Daily Rounds
          </p>
          <p className="mt-1 text-2xl font-semibold text-ink">09:00 AM – 01:00 PM</p>
          <p className="mt-1 text-xs text-ink-3 truncate">Unit Chief: {activePosting.supervisor}</p>
        </Card>
      </div>

      {/* ── 2. Active Posting Action Header ── */}
      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Badge tone="brand">MBBS Phase III Part 1</Badge>
              <span className="text-xs text-ink-3">Posting Duration: {activePosting.dates}</span>
              {apiData?.total ? (
                <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[10px] text-ink-3 font-mono">
                  Synced: {apiData.total} Records
                </span>
              ) : null}
            </div>
            <h2 className="mt-2 text-lg font-semibold text-ink">
              {activePosting.department} — {activePosting.unit}
            </h2>
            <p className="mt-0.5 text-xs text-ink-3">
              Supervising Professor: <strong className="font-semibold text-ink">{activePosting.supervisor}</strong> · Hospital Bedside Postings
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isFacultyOrAdmin ? (
              <>
                <LinkButton href={`/${role || "faculty"}/clinical-rotations/new`}>
                  <Plus className="size-4" />
                  <span>Schedule Clinical Posting</span>
                </LinkButton>
                <Button variant="secondary" onClick={() => setCaseModalOpen(true)}>
                  <Plus className="size-4" />
                  <span>Log Patient Case</span>
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => setCaseModalOpen(true)}>
                  <Plus className="size-4" />
                  <span>Clerk Bedside Patient</span>
                </Button>
                <Button variant="secondary" onClick={() => setProcedureModalOpen(true)}>
                  <Award className="size-4" />
                  <span>Submit DOPS Skill</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* ── 3. Tabbed Navigation Bar (Matches Project Pattern) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-2">
        <div className="flex flex-wrap gap-1.5" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "active"}
            onClick={() => setActiveTab("active")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all",
              activeTab === "active"
                ? "bg-brand text-white shadow-sm"
                : "text-ink-2 hover:bg-surface-2 hover:text-ink"
            )}
          >
            <FileText className="size-3.5" />
            <span>Clerked Patients ({caseList.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "competencies"}
            onClick={() => setActiveTab("competencies")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all",
              activeTab === "competencies"
                ? "bg-brand text-white shadow-sm"
                : "text-ink-2 hover:bg-surface-2 hover:text-ink"
            )}
          >
            <Award className="size-3.5" />
            <span>DOPS Competencies ({skillsList.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "roadmap"}
            onClick={() => setActiveTab("roadmap")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all",
              activeTab === "roadmap"
                ? "bg-brand text-white shadow-sm"
                : "text-ink-2 hover:bg-surface-2 hover:text-ink"
            )}
          >
            <Calendar className="size-3.5" />
            <span>1-Year Roster ({roadmap.length} Postings)</span>
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
            <ShieldCheck className="size-3.5" />
            <span>NMC Attendance Status</span>
          </button>
        </div>
      </div>

      {/* ── TAB 1: CLERKED PATIENTS ── */}
      {activeTab === "active" && (
        <div className="space-y-4">
          {/* Toolbar: Search & Status Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
              <input
                type="text"
                className={cn(inputClass, "pl-9 w-full")}
                placeholder="Search patient, bed number, diagnosis..."
                value={caseSearch}
                onChange={(e) => {
                  setCaseSearch(e.target.value);
                  setCasePage(1);
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="size-4 shrink-0 text-ink-3" />
              <select
                className={cn(inputClass, "min-w-[140px]")}
                value={caseStatusFilter}
                onChange={(e) => {
                  setCaseStatusFilter(e.target.value);
                  setCasePage(1);
                }}
              >
                <option value="all">All Status</option>
                <option value="Approved">Approved</option>
                <option value="Pending">Pending</option>
              </select>
            </div>
          </div>

          {paginatedCases.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-sm font-semibold text-ink">No matching patient cases</p>
              <p className="mt-1 text-xs text-ink-3">Try adjusting your search query or status filter.</p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {paginatedCases.map((c, i) => (
                <Card key={i} className="p-5 transition-all hover:border-brand/40">
                  <div className="flex items-center justify-between">
                    <Badge tone="brand">{c.bed}</Badge>
                    <div className="flex items-center gap-2">
                      <Badge tone={c.status === "Approved" ? "brand" : "gold"}>{c.status}</Badge>
                      {c.status === "Pending" && (
                        isFacultyOrAdmin ? (
                          <button
                            type="button"
                            onClick={() => approveCaseMutation.mutate(c.id)}
                            disabled={approveCaseMutation.isPending}
                            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold px-2.5 py-1 flex items-center gap-1 shadow-sm transition-all"
                            title="Faculty sign-off on bedside case"
                          >
                            <Check className="size-3" />
                            Approve Case
                          </button>
                        ) : (
                          <span className="text-[11px] text-amber-600 font-medium italic">Awaiting Doctor Sign-off</span>
                        )
                      )}
                    </div>
                  </div>

                  <h3 className="mt-3 text-base font-semibold text-ink">{c.patient}</h3>
                  <p className="mt-1 text-sm font-medium text-brand">{c.diagnosis}</p>
                  {c.complaints ? (
                    <div className="mt-2.5 rounded-lg border border-line bg-surface-2 p-2.5 text-xs">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-3">
                        Bedside Clerking Notes & Complaints
                      </span>
                      <p className="mt-0.5 text-xs text-ink">{c.complaints}</p>
                    </div>
                  ) : null}

                  <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-3 text-xs text-ink-3">
                    <span className="flex items-center gap-1.5">
                      <User className="size-3.5" />
                      <span>Clerked by <strong className="font-semibold text-ink">{(c as any).studentName || "Student"}</strong></span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5" />
                      <span>{c.date}</span>
                    </span>
                  </div>
                  {c.status === "Approved" && (
                    <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                      <CheckCircle2 className="size-3.5" />
                      <span>Verified by {c.faculty}</span>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          {filteredCases.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-line pt-3 text-xs text-ink-3">
              <span>
                Showing {Math.min(1 + (casePage - 1) * CASE_PAGE_SIZE, filteredCases.length)}–{Math.min(casePage * CASE_PAGE_SIZE, filteredCases.length)} of {filteredCases.length} cases
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={casePage <= 1}
                  onClick={() => setCasePage((p) => p - 1)}
                >
                  <ChevronLeft className="size-3.5" /> Prev
                </Button>
                <span className="px-2 font-medium text-ink">
                  Page {casePage} of {totalCasePages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={casePage >= totalCasePages}
                  onClick={() => setCasePage((p) => p + 1)}
                >
                  Next <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: DOPS PROCEDURAL SKILLS ── */}
      {activeTab === "competencies" && (
        <div className="space-y-4">
          {/* Toolbar: Search & Status Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
              <input
                type="text"
                className={cn(inputClass, "pl-9 w-full")}
                placeholder="Search procedure name, NMC code (e.g. SU15.1)..."
                value={dopsSearch}
                onChange={(e) => {
                  setDopsSearch(e.target.value);
                  setDopsPage(1);
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="size-4 shrink-0 text-ink-3" />
              <select
                className={cn(inputClass, "min-w-[150px]")}
                value={dopsStatusFilter}
                onChange={(e) => {
                  setDopsStatusFilter(e.target.value);
                  setDopsPage(1);
                }}
              >
                <option value="all">All Status</option>
                <option value="Certified">Certified</option>
                <option value="Pending Review">Pending Review</option>
                <option value="To be Attempted">To be Attempted</option>
              </select>
            </div>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-2/70 text-xs font-semibold uppercase tracking-wider text-ink-3">
                    <th className="px-5 py-3.5 whitespace-nowrap">NMC Code</th>
                    <th className="px-5 py-3.5 min-w-[280px]">Procedural Skill</th>
                    <th className="px-4 py-3.5 text-center whitespace-nowrap">Level</th>
                    <th className="px-4 py-3.5 text-center whitespace-nowrap">Status</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Supervisor & Date</th>
                    <th className="px-5 py-3.5 text-right whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {paginatedSkills.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-xs text-ink-3">
                        No matching DOPS competencies found for your filter.
                      </td>
                    </tr>
                  ) : (
                    paginatedSkills.map((s) => (
                      <tr key={s.id} className="transition-colors hover:bg-surface-2/40">
                        <td className="px-5 py-4 whitespace-nowrap font-mono text-xs font-bold text-brand">{s.code}</td>
                        <td className="px-5 py-4">
                          <div className="font-medium text-ink">{s.name}</div>
                          {s.notes ? (
                            <div className="mt-1.5 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setViewingSkillNotes(s)}
                                className="inline-flex items-center gap-1 rounded-md bg-brand/10 hover:bg-brand/20 px-2 py-0.5 text-[11px] font-semibold text-brand transition-colors"
                              >
                                <FileText className="size-3" />
                                <span>View Notes</span>
                              </button>
                              <span className="text-xs text-ink-3 italic line-clamp-1 max-w-sm">
                                "{s.notes}"
                              </span>
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-4 text-center whitespace-nowrap">
                          <Badge tone="neutral" className="whitespace-nowrap font-mono text-[11px]">
                            {s.level}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-center whitespace-nowrap">
                          <Badge tone={s.status === "Certified" ? "brand" : s.status === "Pending Review" ? "gold" : "neutral"} className="whitespace-nowrap">
                            {s.status}
                          </Badge>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-xs">
                          {s.certifier ? (
                            <div>
                              <p className="font-medium text-ink">{s.certifier}</p>
                              {s.date ? <p className="mt-0.5 text-ink-3">{s.date}</p> : null}
                            </div>
                          ) : (
                            <span className="text-ink-3">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          {s.status === "Certified" ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                              <CheckCircle2 className="size-4" /> Verified
                            </span>
                          ) : s.status === "Pending Review" ? (
                            isFacultyOrAdmin ? (
                              <button
                                type="button"
                                onClick={() => approveDopsMutation.mutate(s.code)}
                                disabled={approveDopsMutation.isPending}
                                className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-all"
                                title="Supervisor digital sign-off"
                              >
                                <Check className="size-3.5" />
                                Sign Off
                              </button>
                            ) : (
                              <span className="text-xs text-amber-600 font-medium italic">Awaiting Sign-off</span>
                            )
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setNewProcedure({ ...newProcedure, procedure: s.code });
                                setProcedureModalOpen(true);
                              }}
                            >
                              Submit DOPS
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* DOPS Table Pagination */}
            {filteredSkills.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-line px-5 py-3 text-xs text-ink-3">
                <span>
                  Showing {Math.min(1 + (dopsPage - 1) * DOPS_PAGE_SIZE, filteredSkills.length)}–{Math.min(dopsPage * DOPS_PAGE_SIZE, filteredSkills.length)} of {filteredSkills.length} competencies
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={dopsPage <= 1}
                    onClick={() => setDopsPage((p) => p - 1)}
                  >
                    <ChevronLeft className="size-3.5" /> Prev
                  </Button>
                  <span className="px-2 font-medium text-ink">
                    Page {dopsPage} of {totalDopsPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={dopsPage >= totalDopsPages}
                    onClick={() => setDopsPage((p) => p + 1)}
                  >
                    Next <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── TAB 3: 1-YEAR ROSTER ROADMAP (DYNAMIC FROM API) ── */}
      {activeTab === "roadmap" && (
        <div className="space-y-4">
          {isFacultyOrAdmin && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-surface-2 p-5 border border-line">
              <div>
                <h4 className="text-sm font-semibold text-ink">Hospital Clinical Postings Master</h4>
                <p className="mt-0.5 text-xs text-ink-3">Schedule student rotation postings across medical wards and unit chiefs.</p>
              </div>
              <LinkButton href={`/${role || "faculty"}/clinical-rotations/new`}>
                <Plus className="size-4" />
                <span>Add Clinical Posting</span>
              </LinkButton>
            </div>
          )}

          {/* Toolbar: Search & Status Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
              <input
                type="text"
                className={cn(inputClass, "pl-9 w-full")}
                placeholder="Search department, unit, supervisor..."
                value={rosterSearch}
                onChange={(e) => {
                  setRosterSearch(e.target.value);
                  setRosterPage(1);
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="size-4 shrink-0 text-ink-3" />
              <select
                className={cn(inputClass, "min-w-[150px]")}
                value={rosterStatusFilter}
                onChange={(e) => {
                  setRosterStatusFilter(e.target.value);
                  setRosterPage(1);
                }}
              >
                <option value="all">All Status</option>
                <option value="Ongoing">Ongoing</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>

          {paginatedRoadmap.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-sm font-semibold text-ink">No matching clinical postings</p>
              <p className="mt-1 text-xs text-ink-3">Try adjusting your search query or status filter.</p>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {paginatedRoadmap.map((r, i) => (
                <Card
                  key={r.id}
                  className={cn(
                    "p-5 transition-all",
                    r.status === "Ongoing" && "border-brand shadow-sm"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 items-center justify-center rounded-lg bg-surface-2 text-xs font-semibold text-ink">
                        {(rosterPage - 1) * ROSTER_PAGE_SIZE + i + 1}
                      </span>
                      <Badge tone={r.status === "Ongoing" ? "brand" : "neutral"}>
                        {r.status}
                      </Badge>
                    </div>
                    <span className="text-xs font-semibold text-brand">{r.duration}</span>
                  </div>

                  <h4 className="mt-3 text-base font-semibold text-ink">{r.department}</h4>
                  <p className="mt-0.5 text-xs text-ink-3">{r.unit}</p>
                  <p className="mt-1 text-xs text-ink-3">Supervised by <strong className="font-semibold text-ink">{r.supervisor}</strong></p>

                  <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3 text-xs">
                    <span className="text-ink-3">{r.dates}</span>
                    <span className="font-semibold text-ink">
                      {r.status === "Scheduled" || r.attendance === 0 ? "Upcoming" : `${r.attendance}% Attended`}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Roster Pagination */}
          {filteredRoadmap.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-line pt-3 text-xs text-ink-3">
              <span>
                Showing {Math.min(1 + (rosterPage - 1) * ROSTER_PAGE_SIZE, filteredRoadmap.length)}–{Math.min(rosterPage * ROSTER_PAGE_SIZE, filteredRoadmap.length)} of {filteredRoadmap.length} postings
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={rosterPage <= 1}
                  onClick={() => setRosterPage((p) => p - 1)}
                >
                  <ChevronLeft className="size-3.5" /> Prev
                </Button>
                <span className="px-2 font-medium text-ink">
                  Page {rosterPage} of {totalRosterPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={rosterPage >= totalRosterPages}
                  onClick={() => setRosterPage((p) => p + 1)}
                >
                  Next <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: NMC ATTENDANCE BREAKDOWN ── */}
      {activeTab === "attendance" && (
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-ink">
                  NMC Attendance Eligibility Rule
                </h3>
                <p className="mt-1 text-xs text-ink-3">
                  Under National Medical Commission regulations, a minimum of 80% clinical attendance in each posting is mandatory to appear for the university examination.
                </p>
              </div>
              <div className="rounded-xl border border-line bg-surface-2 px-5 py-3 text-center shrink-0">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">Current Average</span>
                <p className="text-2xl font-semibold text-brand">
                  {Math.round(
                    roadmap.filter((r) => r.attendance > 0).reduce((acc, r) => acc + r.attendance, 0) /
                      Math.max(1, roadmap.filter((r) => r.attendance > 0).length)
                  )}%
                </p>
              </div>
            </div>
          </Card>

          {/* Filter Toolbar */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-ink-3">
              Departmental Attendance Breakdown ({filteredAttendance.length} Postings)
            </span>
            <div className="flex items-center gap-2">
              <Filter className="size-4 shrink-0 text-ink-3" />
              <select
                className={cn(inputClass, "min-w-[160px]")}
                value={attendanceFilter}
                onChange={(e) => setAttendanceFilter(e.target.value)}
              >
                <option value="all">All Departments</option>
                <option value="eligible">Eligible (&ge;80%)</option>
                <option value="below">Below 80%</option>
              </select>
            </div>
          </div>

          {filteredAttendance.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-sm font-semibold text-ink">No departments match this filter</p>
              <p className="mt-1 text-xs text-ink-3">Try choosing "All Departments" to view all active attendance.</p>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredAttendance.map((r) => (
                <Card key={r.id} className="p-5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-ink">{r.department}</h4>
                    <Badge tone={r.attendance >= 80 ? "brand" : "gold"}>
                      {r.attendance >= 80 ? "Eligible" : "Below 80%"}
                    </Badge>
                  </div>

                  <div className="mt-3 flex items-baseline justify-between text-xs">
                    <span className="text-ink-3">Attendance</span>
                    <span className="font-semibold text-ink">{r.attendance}% ({r.attendedDays}/{r.totalDays}d)</span>
                  </div>

                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        r.attendance >= 80 ? "bg-brand" : "bg-amber"
                      )}
                      style={{ width: `${r.attendance}%` }}
                    />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: CLERK BEDSIDE PATIENT ── */}
      {caseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="text-base font-semibold text-ink">Clerk Bedside Patient</h3>
                <p className="text-xs text-ink-3">Document patient case history for {activePosting.department}.</p>
              </div>
              <button
                type="button"
                onClick={() => setCaseModalOpen(false)}
                className="flex size-8 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-ink">Bed Number</label>
                  <input
                    type="text"
                    placeholder="e.g. Bed 27"
                    value={newPatient.bed}
                    onChange={(e) => setNewPatient({ ...newPatient, bed: e.target.value })}
                    className={cn(inputClass, "mt-1 w-full")}
                  />
                </div>
                <div>
                  <label className="font-semibold text-ink">Patient Name & Age</label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh K., 48 M"
                    value={newPatient.name}
                    onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                    className={cn(inputClass, "mt-1 w-full")}
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-ink">Chief Complaints</label>
                <input
                  type="text"
                  placeholder="e.g. Right hypochondriac pain x 3 days, vomiting"
                  value={newPatient.complaints}
                  onChange={(e) => setNewPatient({ ...newPatient, complaints: e.target.value })}
                  className={cn(inputClass, "mt-1 w-full")}
                />
              </div>

              <div>
                <label className="font-semibold text-ink">Provisional Diagnosis</label>
                <input
                  type="text"
                  placeholder="e.g. Acute Cholecystitis"
                  value={newPatient.diagnosis}
                  onChange={(e) => setNewPatient({ ...newPatient, diagnosis: e.target.value })}
                  className={cn(inputClass, "mt-1 w-full")}
                />
              </div>

              <div>
                <label className="font-semibold text-ink">Supervising Faculty</label>
                <select className={cn(inputClass, "mt-1 w-full")}>
                  <option>{activePosting.supervisor}</option>
                  <option>Dr. S. Anbarasu (Senior Resident)</option>
                </select>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-line pt-3">
              <Button variant="secondary" onClick={() => setCaseModalOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={createCaseMutation.isPending}
                onClick={() => {
                  if (!newPatient.name || !newPatient.diagnosis) {
                    alert("Please enter patient name and diagnosis.");
                    return;
                  }
                  createCaseMutation.mutate({
                    bed: newPatient.bed || "Bed 27",
                    patient: newPatient.name,
                    diagnosis: newPatient.diagnosis,
                    complaints: newPatient.complaints,
                    faculty: activePosting.supervisor,
                  });
                }}
              >
                {createCaseMutation.isPending ? "Submitting..." : "Submit Case Sheet"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── MODAL: SUBMIT DOPS SKILL ── */}
      {procedureModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="text-base font-semibold text-ink">Submit DOPS Procedural Skill</h3>
                <p className="text-xs text-ink-3">Request faculty certification for procedure performed in {activePosting.department}.</p>
              </div>
              <button
                type="button"
                onClick={() => setProcedureModalOpen(false)}
                className="flex size-8 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="font-semibold text-ink">Procedural Skill</label>
                <select
                  value={newProcedure.procedure}
                  onChange={(e) => setNewProcedure({ ...newProcedure, procedure: e.target.value })}
                  className={cn(inputClass, "mt-1 w-full")}
                >
                  {skillsList
                    .filter((s) => s.status !== "Certified" || s.code === newProcedure.procedure)
                    .map((s) => (
                      <option key={s.id} value={s.code}>
                        {s.code}: {s.name} ({s.level})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-ink">Observing Doctor</label>
                <select
                  value={newProcedure.supervisor}
                  onChange={(e) => setNewProcedure({ ...newProcedure, supervisor: e.target.value })}
                  className={cn(inputClass, "mt-1 w-full")}
                >
                  <option>{activePosting.supervisor}</option>
                  <option>Dr. S. Anbarasu (Senior Resident)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-ink">Clinical Notes & Reflection</label>
                <textarea
                  rows={3}
                  placeholder="Describe aseptic precautions, anatomical landmarks, patient communication..."
                  value={newProcedure.notes}
                  onChange={(e) => setNewProcedure({ ...newProcedure, notes: e.target.value })}
                  className={cn(inputClass, "mt-1 w-full")}
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-line pt-3">
              <Button variant="secondary" onClick={() => setProcedureModalOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={submitDopsMutation.isPending}
                onClick={() => {
                  submitDopsMutation.mutate({
                    code: newProcedure.procedure,
                    notes: newProcedure.notes,
                    supervisor: newProcedure.supervisor,
                  });
                }}
              >
                {submitDopsMutation.isPending ? "Submitting..." : "Request Sign-off"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── MODAL: VIEW CLINICAL REFLECTION & NOTES ── */}
      {viewingSkillNotes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Badge tone="brand" className="font-mono">{viewingSkillNotes.code}</Badge>
                  <Badge tone={viewingSkillNotes.status === "Certified" ? "brand" : "gold"}>
                    {viewingSkillNotes.status}
                  </Badge>
                </div>
                <h3 className="mt-2 text-base font-semibold text-ink">
                  {viewingSkillNotes.name}
                </h3>
                <p className="mt-0.5 text-xs text-ink-3">
                  Student: <strong className="text-ink">{viewingSkillNotes.studentName || "Aishwarya V."}</strong> · Level: {viewingSkillNotes.level}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingSkillNotes(null)}
                className="flex size-8 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                Student Clinical Reflection & Procedural Notes
              </label>
              <div className="mt-1.5 rounded-xl border border-line bg-surface-2 p-4 text-xs leading-relaxed text-ink italic">
                "{viewingSkillNotes.notes || "No notes documented."}"
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-line pt-3 text-xs">
              <span className="text-ink-3">
                {viewingSkillNotes.certifier ? `Supervisor: ${viewingSkillNotes.certifier}` : "Awaiting supervisor verification"}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => setViewingSkillNotes(null)}>
                  Close
                </Button>
                {isFacultyOrAdmin && viewingSkillNotes.status === "Pending Review" && (
                  <button
                    type="button"
                    onClick={() => {
                      approveDopsMutation.mutate(viewingSkillNotes.code);
                      setViewingSkillNotes(null);
                    }}
                    disabled={approveDopsMutation.isPending}
                    className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <Check className="size-3.5" />
                    Sign Off This Skill
                  </button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
