import "server-only";
import { RESOURCES } from "@/config/resources";
import { ALL_COLLEGES } from "@/config/tenancy";
import type {
  ChartSpec,
  CreateSupportActionInput,
  EarlyWarningData,
  EarlyWarningIntervention,
  EarlyWarningSignal,
  EarlyWarningStudent,
  Insight,
  Kpi,
  UpdateReviewStatusInput,
} from "@/lib/api/schemas";
import type { SessionPayload } from "@/lib/auth/session";
import { getStore } from "@/lib/data";
import { computeReadiness } from "./learning";
import { sharedState } from "./global-state";
import { getCollege, listColleges } from "./records";

interface StudentCaseRecord {
  status: "Pending review" | "In progress" | "Resolved";
  notes?: string;
  assignedMentor?: string;
  lastActionDate?: string;
}

// In-memory case management persistent across Next.js reloads & bundles per college
const collegeStudentCases = sharedState("earlyWarning.cases", () => new Map<string, Map<string, StudentCaseRecord>>());
const collegeInterventions = sharedState("earlyWarning.interventions", () => new Map<string, EarlyWarningIntervention[]>());

async function resolveCollegeId(sessionCollege: string | null | undefined): Promise<string> {
  let collegeId = sessionCollege && sessionCollege !== ALL_COLLEGES ? sessionCollege : "COL-1001";
  const college = await getCollege(collegeId);
  if (!college) {
    const all = await listColleges();
    if (all.length > 0 && all[0]) {
      collegeId = all[0].id;
    }
  }
  return collegeId;
}

function getCollegeCases(collegeId: string): Map<string, StudentCaseRecord> {
  let cases = collegeStudentCases.get(collegeId);
  if (!cases) {
    cases = new Map();
    collegeStudentCases.set(collegeId, cases);
  }
  return cases;
}

function getCollegeInterventionsList(collegeId: string): EarlyWarningIntervention[] {
  let list = collegeInterventions.get(collegeId);
  if (!list) {
    list = [];
    collegeInterventions.set(collegeId, list);
  }
  return list;
}

function deriveBatch(rollNo: string): string {
  const clean = rollNo.replace(/\D/g, "");
  if (clean.startsWith("21") || clean.startsWith("23")) return "2023–2027 (Final Year)";
  if (clean.startsWith("22") || clean.startsWith("24")) return "2024–2028 (3rd Year)";
  if (clean.startsWith("25")) return "2025–2029 (2nd Year)";
  if (clean.startsWith("26")) return "2026–2030 (1st Year)";
  return "2023–2027 (Final Year)";
}

export async function createSupportAction(
  session: SessionPayload,
  input: CreateSupportActionInput
): Promise<EarlyWarningIntervention> {
  const collegeId = await resolveCollegeId(session.college);
  const now = new Date().toISOString();

  const item: EarlyWarningIntervention = {
    id: `ACT-${Date.now().toString(36).toUpperCase()}`,
    studentId: input.studentId,
    studentName: input.studentName,
    rollNo: "",
    department: "",
    strategy: input.strategy,
    facultyLead: input.facultyLead,
    targetDate: input.targetDate,
    status: "In progress",
    notes: input.notes,
    createdAt: now.slice(0, 10),
  };

  // Find student metadata
  const store = getStore();
  const rawBoard = await store.readiness.board(collegeId);
  const found = rawBoard.find((s) => s.studentSub === input.studentId || s.name === input.studentName);
  if (found) {
    item.rollNo = found.rollNo;
    item.department = found.department;
  }

  const interventions = getCollegeInterventionsList(collegeId);
  interventions.unshift(item);

  // Update case record
  const cases = getCollegeCases(collegeId);
  const existing = cases.get(input.studentId) ?? { status: "Pending review" };
  cases.set(input.studentId, {
    ...existing,
    status: "In progress",
    assignedMentor: input.facultyLead,
    lastActionDate: now.slice(0, 10),
    notes: input.notes ? `${input.strategy}: ${input.notes}` : input.strategy,
  });

  return item;
}

export async function updateReviewStatus(
  session: SessionPayload,
  input: UpdateReviewStatusInput
): Promise<{ ok: boolean; status: string; notes?: string }> {
  const collegeId = await resolveCollegeId(session.college);
  const cases = getCollegeCases(collegeId);
  const existing = cases.get(input.studentId) ?? { status: "Pending review" };

  const updated: StudentCaseRecord = {
    ...existing,
    status: input.reviewStatus,
    lastActionDate: new Date().toISOString().slice(0, 10),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
  };
  cases.set(input.studentId, updated);

  return { ok: true, status: updated.status, notes: updated.notes };
}

export async function getEarlyWarningOverview(
  session: SessionPayload,
  filterDept = "all",
  filterRiskLevel = "all",
  searchQuery = ""
): Promise<EarlyWarningData> {
  const collegeId = await resolveCollegeId(session.college);
  const college = await getCollege(collegeId);
  const collegeTitle = String(college?.name ?? "College");
  const store = getStore();

  // 1. Departments from store
  const dbDepartments = await store.records.all(RESOURCES.departments!, collegeId);
  const actualDeptNames = [
    ...new Set(dbDepartments.map((d) => String(d.department || "")).filter(Boolean)),
  ];
  const availableDepartments = [
    "All Departments",
    ...(actualDeptNames.length > 0 ? actualDeptNames : ["General"]),
  ];

  // If HOD is logged in and assigned to a department, default to their department
  let effectiveDept = filterDept;
  if (session.role === "hod" && filterDept === "all") {
    const userRec = await store.records.get(RESOURCES.users!, session.sub);
    if (userRec?.department && typeof userRec.department === "string") {
      effectiveDept = userRec.department;
    }
  }

  // 2. Staff (faculty leads) from store
  const dbStaff = await store.records.all(RESOURCES.staff!, collegeId);
  const teachingStaff = dbStaff.filter(
    (s) => s.status === "Active" && (s.staffType === "Teaching" || !s.staffType)
  );
  const availableFaculty = [
    ...new Set(teachingStaff.map((s) => String(s.fullName || "")).filter(Boolean)),
  ];

  // 3. Real Students and Readiness metrics from store
  const rawBoard = await store.readiness.board(collegeId);
  const evaluatedStudents = rawBoard.map(computeReadiness);

  // 4. Case records & interventions
  const cases = getCollegeCases(collegeId);
  const interventions = getCollegeInterventionsList(collegeId);

  // Build flagged student models
  const students: EarlyWarningStudent[] = evaluatedStudents.map((s) => {
    const signals: EarlyWarningSignal[] = [];

    // Academic Quiz Signal
    if (s.quizAverage < 50) {
      signals.push({
        id: `sig-quiz-${s.studentSub}`,
        type: "academic",
        title: s.quizAverage === 0 ? "Zero Quizzes Attempted" : `Low Quiz Average (${s.quizAverage}%)`,
        detail:
          s.quizAverage === 0
            ? "Student has not attempted coursework quizzes or formative tests."
            : `Average assessment score is below the 50% academic standard.`,
        severity: s.quizAverage < 35 ? "critical" : "moderate",
        detectedAt: "Continuous Assessment",
      });
    }

    // Certification Signal
    if (s.certificates < 1) {
      signals.push({
        id: `sig-cert-${s.studentSub}`,
        type: "certification",
        title: "No Verified Certifications",
        detail: "Has not verified practical mastery through course certification tracks.",
        severity: s.quizAverage < 50 ? "critical" : "moderate",
        detectedAt: "Learning Outcomes Track",
      });
    }

    // Interview Signal
    if (s.interview < 50) {
      signals.push({
        id: `sig-int-${s.studentSub}`,
        type: "interview",
        title: s.interview === 0 ? "Mock Technical Interview Pending" : `Low Interview Score (${s.interview}/100)`,
        detail:
          s.interview === 0
            ? "Has not completed an AI mock technical or behavioral interview."
            : "Demonstrates articulation and technical reasoning gaps in mock evaluations.",
        severity: s.interview === 0 ? "moderate" : "low",
        detectedAt: "Placement Lab",
      });
    }

    // Resume Signal
    if (s.resume < 50) {
      signals.push({
        id: `sig-res-${s.studentSub}`,
        type: "resume",
        title: s.resume === 0 ? "Resume ATS Benchmark Missing" : `Resume ATS Score Deficit (${s.resume}/100)`,
        detail:
          s.resume === 0
            ? "Student resume has not been uploaded for automated ATS scoring."
            : "Resume ATS analysis indicates missing project metrics and technical keywords.",
        severity: s.resume === 0 ? "moderate" : "low",
        detectedAt: "Career Studio",
      });
    }

    // Overall Readiness Composite Signal
    if (s.total < 55 || s.status === "Needs work") {
      signals.push({
        id: `sig-ready-${s.studentSub}`,
        type: "readiness",
        title: `Placement Readiness Alert (${s.total}/100)`,
        detail: `Composite score is in '${s.status}' band; requires intervention before campus drives.`,
        severity: s.total < 35 ? "critical" : "moderate",
        detectedAt: "Readiness Board",
      });
    }

    // Determine Risk Level
    let riskLevel: "Critical" | "Moderate" | "Watchlist" | "Low Risk";
    const hasCritical = signals.some((sig) => sig.severity === "critical");
    const moderateCount = signals.filter((sig) => sig.severity === "moderate").length;

    if (s.total < 35 || hasCritical) {
      riskLevel = "Critical";
    } else if (s.total < 55 || moderateCount >= 2) {
      riskLevel = "Moderate";
    } else if (s.total < 70 || signals.length > 0) {
      riskLevel = "Watchlist";
    } else {
      riskLevel = "Low Risk";
    }

    // Department faculty for tailored recommendation
    const deptFaculty = teachingStaff.find(
      (f) => String(f.department).toLowerCase() === s.department.toLowerCase()
    );
    const facultyName = deptFaculty?.fullName ? String(deptFaculty.fullName) : (availableFaculty[0] || "Department Mentor");

    let recommendation = "Routine academic check-in";
    if (s.quizAverage < 50) {
      recommendation = `1-on-1 Academic Tutoring with ${facultyName}`;
    } else if (s.certificates < 1) {
      recommendation = `Enroll in Skill Booster & Certification Clinic`;
    } else if (s.interview < 50) {
      recommendation = `Placement Cell Technical Mock Interview Session`;
    } else if (s.resume < 50) {
      recommendation = `Resume Studio Review with Career Counsellor`;
    } else if (riskLevel === "Critical") {
      recommendation = `Academic Advisory & Counsellor Check-in`;
    }

    // Case info
    const caseInfo = cases.get(s.studentSub);
    const reviewStatus = caseInfo?.status ?? (riskLevel === "Low Risk" ? "Resolved" : "Pending review");

    return {
      id: s.studentSub,
      studentName: s.name,
      rollNo: s.rollNo,
      department: s.department,
      batch: deriveBatch(s.rollNo),
      quizAverage: s.quizAverage,
      certificatesCount: s.certificates,
      aptitudeScore: s.aptitude,
      interviewScore: s.interview,
      resumeScore: s.resume,
      overallScore: s.total,
      riskLevel,
      signals,
      recommendation,
      reviewStatus,
      assignedMentor: caseInfo?.assignedMentor,
      lastActionDate: caseInfo?.lastActionDate,
      actionNotes: caseInfo?.notes,
    };
  });

  // Filter students based on parameters
  const filteredStudents = students.filter((st) => {
    if (effectiveDept !== "all" && effectiveDept !== "All Departments" && st.department !== effectiveDept) {
      return false;
    }
    if (filterRiskLevel !== "all" && filterRiskLevel !== "All Levels" && st.riskLevel !== filterRiskLevel) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const match =
        st.studentName.toLowerCase().includes(q) ||
        st.rollNo.toLowerCase().includes(q) ||
        st.department.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Calculate KPIs
  const criticalCount = students.filter((s) => s.riskLevel === "Critical").length;
  const moderateCount = students.filter((s) => s.riskLevel === "Moderate").length;
  const watchlistCount = students.filter((s) => s.riskLevel === "Watchlist").length;
  const flaggedCount = criticalCount + moderateCount + watchlistCount;
  const inProgressCases = students.filter((s) => s.reviewStatus === "In progress").length;
  const resolvedCases = students.filter((s) => s.reviewStatus === "Resolved").length;
  const avgReadiness =
    students.length > 0
      ? Math.round(students.reduce((sum, s) => sum + s.overallScore, 0) / students.length)
      : 0;

  const kpis: Kpi[] = [
    {
      label: "Flagged for Attention",
      value: String(flaggedCount),
      delta: `${criticalCount} critical`,
      tone: criticalCount > 0 ? "rose" : "amber",
      hint: "Students with academic, certification or interview deficits",
    },
    {
      label: "Critical Risk Flags",
      value: String(criticalCount),
      delta: "Urgent review",
      tone: criticalCount > 0 ? "rose" : "teal",
      hint: "Requires faculty counsellor or tutor intervention",
    },
    {
      label: "Active Support Plans",
      value: String(interventions.length),
      delta: `${interventions.length} total logged`,
      tone: "sky",
      hint: "Interventions currently assigned and ongoing",
    },
    {
      label: "Resolved / On Track",
      value: String(resolvedCases),
      delta: `${students.length > 0 ? Math.round((resolvedCases / students.length) * 100) : 0}% cohort`,
      tone: "teal",
      hint: "Students cleared of risk flags or met readiness goals",
    },
    {
      label: "Cohort Avg Readiness",
      value: `${avgReadiness} / 100`,
      delta: avgReadiness >= 60 ? "Satisfactory" : "Uplift needed",
      tone: avgReadiness >= 60 ? "teal" : "amber",
      hint: "Combined index across quiz, certs, interview, resume",
    },
  ];

  // Charts
  // 1. Risk Tier Distribution
  const riskDistribution: ChartSpec = {
    type: "bar",
    title: "Student Risk & Watchlist Tier Distribution",
    data: [
      { name: "Critical", students: criticalCount },
      { name: "Moderate", students: moderateCount },
      { name: "Watchlist", students: watchlistCount },
      { name: "Low Risk", students: students.filter((s) => s.riskLevel === "Low Risk").length },
    ],
    series: ["students"],
    xKey: "name",
  };

  // 2. Signals Breakdown across all students
  let quizDeficitCount = 0;
  let certDeficitCount = 0;
  let interviewDeficitCount = 0;
  let resumeDeficitCount = 0;
  let readinessDeficitCount = 0;

  for (const s of students) {
    for (const sig of s.signals) {
      if (sig.type === "academic") quizDeficitCount++;
      if (sig.type === "certification") certDeficitCount++;
      if (sig.type === "interview") interviewDeficitCount++;
      if (sig.type === "resume") resumeDeficitCount++;
      if (sig.type === "readiness") readinessDeficitCount++;
    }
  }

  const signalsBreakdown: ChartSpec = {
    type: "bar",
    title: "Observed Deficit Signals Across Cohort",
    data: [
      { name: "Low Quiz Avg (<50%)", count: quizDeficitCount },
      { name: "Missing Certifications (0)", count: certDeficitCount },
      { name: "Interview Gap (<50)", count: interviewDeficitCount },
      { name: "Resume ATS Gap (<50)", count: resumeDeficitCount },
      { name: "Readiness Alert (<55)", count: readinessDeficitCount },
    ],
    series: ["count"],
    xKey: "name",
  };

  // 3. Department Risk Comparison
  const deptRiskMap = new Map<string, { total: number; critical: number; moderate: number }>();
  for (const s of students) {
    const entry = deptRiskMap.get(s.department) ?? { total: 0, critical: 0, moderate: 0 };
    entry.total++;
    if (s.riskLevel === "Critical") entry.critical++;
    if (s.riskLevel === "Moderate") entry.moderate++;
    deptRiskMap.set(s.department, entry);
  }

  const departmentRiskComparison: ChartSpec = {
    type: "bar",
    title: "Flagged Cases by Department",
    data: Array.from(deptRiskMap.entries()).map(([dept, v]) => ({
      name: dept.length > 15 ? dept.slice(0, 14) + "…" : dept,
      critical: v.critical,
      moderate: v.moderate,
    })),
    series: ["critical", "moderate"],
    xKey: "name",
  };

  // 4. Insights
  const insights: Insight[] = [];
  if (criticalCount > 0) {
    insights.push({
      title: `${criticalCount} Students Require Immediate Advisory Support`,
      body: `Multi-signal analysis detected ${criticalCount} student(s) with severe academic and readiness deficits. Prioritize faculty check-ins to prevent course dropout or drive disqualification.`,
      evidence: `${criticalCount} student(s) have critical risk scores < 35 or zero recorded assessments.`,
      tone: "rose",
    });
  }

  if (certDeficitCount > 0) {
    insights.push({
      title: `${certDeficitCount} Flagged Students Have Zero Practical Certifications`,
      body: `Verified course certifications are a strong predictor of campus placement. Fast-track these students into departmental skill booster tracks.`,
      evidence: `${certDeficitCount} out of ${students.length} assessed students lack verified credentials.`,
      tone: "amber",
    });
  }

  if (inProgressCases > 0) {
    insights.push({
      title: `${inProgressCases} Active Support Interventions Underway`,
      body: `Faculty and counsellors have taken ownership of ${inProgressCases} case(s). Follow-up reviews are scheduled.`,
      evidence: `${inProgressCases} student case(s) updated to 'In progress' with assigned faculty leads.`,
      tone: "teal",
    });
  } else {
    insights.push({
      title: "Establish Proactive Support Plans",
      body: "No active mentorship cases have been scheduled yet. Use 'Create Support Plan' on flagged student records to assign faculty mentors.",
      evidence: "0 support plans currently in progress.",
      tone: "brand",
    });
  }

  return {
    college: {
      id: collegeId,
      name: collegeTitle,
    },
    department: effectiveDept,
    availableDepartments,
    riskLevel: filterRiskLevel,
    availableRiskLevels: ["All Levels", "Critical", "Moderate", "Watchlist", "Low Risk"],
    availableFaculty,
    kpis,
    riskDistribution,
    signalsBreakdown,
    departmentRiskComparison,
    students: filteredStudents,
    interventions,
    insights,
  };
}
