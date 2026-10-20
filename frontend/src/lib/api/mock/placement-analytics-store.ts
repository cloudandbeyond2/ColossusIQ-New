import "server-only";
import type { SessionPayload } from "@/lib/auth/session";
import {
  type PlacementAnalyticsOverview,
  type UpdatePlacementTargetsInput,
  type InstitutionalPlacementTargets,
  type DepartmentPlacementMetric,
  type DriveAnalyticsItem,
  type CompetencyGapItem,
  type StudentPlacementRecord,
  type SalaryTierItem,
  type HiringFunnelStage,
} from "@/lib/api/placement-analytics-schemas";
import { sharedState } from "./global-state";

interface PlacementAnalyticsState {
  targets: Record<string, InstitutionalPlacementTargets>;
}

const DEFAULT_TARGETS: InstitutionalPlacementTargets = {
  targetPlacementPct: 92,
  minAverageLpaTarget: 10.5,
  mockInterviewCompletionTarget: 95,
  targetCompaniesCount: 60,
  updatedAt: "2026-10-15T10:00:00.000Z",
  updatedBy: "Dean of Placement & Industry Relations",
};

const store = sharedState<PlacementAnalyticsState>("campus.placement.analytics.v1", () => ({
  targets: {
    "COL-1001": { ...DEFAULT_TARGETS },
    all: { ...DEFAULT_TARGETS },
  },
}));

const SALARY_TIERS: SalaryTierItem[] = [
  { tier: "Super Dream (> ₹15 LPA)", minCtc: 15, maxCtc: 45, offersCount: 76, percentage: 14.1, color: "var(--teal)" },
  { tier: "Dream (₹10 – ₹15 LPA)", minCtc: 10, maxCtc: 15, offersCount: 152, percentage: 28.2, color: "var(--brand)" },
  { tier: "Core Engineering (₹6 – ₹10 LPA)", minCtc: 6, maxCtc: 10, offersCount: 204, percentage: 37.9, color: "var(--gold)" },
  { tier: "Regular & IT Services (₹3.5 – ₹6 LPA)", minCtc: 3.5, maxCtc: 6, offersCount: 106, percentage: 19.8, color: "var(--surface-3)" },
];

const HIRING_FUNNEL: HiringFunnelStage[] = [
  { stage: "Registered for Drives", count: 480, dropRate: 0, conversionRate: 100 },
  { stage: "Online Assessment Shortlisted", count: 394, dropRate: 17.9, conversionRate: 82.1 },
  { stage: "Technical Panel Cleared", count: 286, dropRate: 27.4, conversionRate: 59.6 },
  { stage: "HR & Leadership Round", count: 242, dropRate: 15.4, conversionRate: 50.4 },
  { stage: "Final Offer Released", count: 218, dropRate: 9.9, conversionRate: 45.4 },
];

const DEPARTMENT_METRICS: DepartmentPlacementMetric[] = [
  {
    department: "Computer Science & Engineering",
    code: "CSE",
    totalStudents: 140,
    eligible: 136,
    placed: 128,
    placementRate: 94.1,
    avgPackageLpa: 12.4,
    highestPackageLpa: 44.0,
    readinessScore: 92,
    mockInterviewAvg: 88,
    topRecruiter: "Google Apex Engineering",
  },
  {
    department: "Artificial Intelligence & Data Science",
    code: "AIDS",
    totalStudents: 68,
    eligible: 65,
    placed: 61,
    placementRate: 93.8,
    avgPackageLpa: 11.8,
    highestPackageLpa: 36.5,
    readinessScore: 91,
    mockInterviewAvg: 87,
    topRecruiter: "Microsoft Cloud & AI",
  },
  {
    department: "Information Technology",
    code: "IT",
    totalStudents: 112,
    eligible: 108,
    placed: 98,
    placementRate: 90.7,
    avgPackageLpa: 10.2,
    highestPackageLpa: 28.0,
    readinessScore: 89,
    mockInterviewAvg: 84,
    topRecruiter: "Amazon AWS Autumn",
  },
  {
    department: "Biomedical Engineering",
    code: "BME",
    totalStudents: 54,
    eligible: 50,
    placed: 43,
    placementRate: 86.0,
    avgPackageLpa: 8.6,
    highestPackageLpa: 18.5,
    readinessScore: 86,
    mockInterviewAvg: 82,
    topRecruiter: "MediTech Diagnostics",
  },
  {
    department: "Electrical & Electronics Engineering",
    code: "EEE",
    totalStudents: 72,
    eligible: 68,
    placed: 52,
    placementRate: 76.5,
    avgPackageLpa: 7.8,
    highestPackageLpa: 16.0,
    readinessScore: 78,
    mockInterviewAvg: 74,
    topRecruiter: "Larsen & Toubro Core",
  },
  {
    department: "Mechanical Engineering",
    code: "MECH",
    totalStudents: 64,
    eligible: 53,
    placed: 30,
    placementRate: 56.6,
    avgPackageLpa: 6.4,
    highestPackageLpa: 12.0,
    readinessScore: 71,
    mockInterviewAvg: 68,
    topRecruiter: "Tata Motors Automotive",
  },
];

const RECRUITER_DRIVES: DriveAnalyticsItem[] = [
  {
    driveId: "DRV-2026-001",
    company: "Google Apex Engineering",
    role: "Software Development Engineer (SDE-1)",
    sector: "Technology / Cloud",
    tier: "Super Dream",
    ctcLpa: 44.0,
    date: "2026-09-18",
    registeredCount: 168,
    shortlistedCount: 24,
    offersCount: 8,
    status: "Completed",
  },
  {
    driveId: "DRV-2026-002",
    company: "Microsoft Cloud & AI",
    role: "Applied AI Engineer",
    sector: "Technology / Enterprise",
    tier: "Super Dream",
    ctcLpa: 36.5,
    date: "2026-09-24",
    registeredCount: 142,
    shortlistedCount: 28,
    offersCount: 11,
    status: "Completed",
  },
  {
    driveId: "DRV-2026-003",
    company: "Amazon AWS Autumn",
    role: "Cloud Solutions Architect & DevOps",
    sector: "Cloud Infrastructure",
    tier: "Super Dream",
    ctcLpa: 28.0,
    date: "2026-10-04",
    registeredCount: 185,
    shortlistedCount: 36,
    offersCount: 14,
    status: "Completed",
  },
  {
    driveId: "DRV-2026-004",
    company: "Zoho Corporation",
    role: "Full Stack Member Technical Staff",
    sector: "SaaS Products",
    tier: "Dream",
    ctcLpa: 14.5,
    date: "2026-10-12",
    registeredCount: 220,
    shortlistedCount: 65,
    offersCount: 32,
    status: "Completed",
  },
  {
    driveId: "DRV-2026-005",
    company: "MediTech Diagnostics & Robotics",
    role: "Biomedical Systems Engineer",
    sector: "HealthTech",
    tier: "Dream",
    ctcLpa: 12.0,
    date: "2026-10-16",
    registeredCount: 45,
    shortlistedCount: 18,
    offersCount: 9,
    status: "Completed",
  },
  {
    driveId: "DRV-2026-006",
    company: "Larsen & Toubro Core Solutions",
    role: "Graduate Engineer Trainee (GET)",
    sector: "Infrastructure & Heavy Tech",
    tier: "Core",
    ctcLpa: 9.2,
    date: "2026-10-22",
    registeredCount: 110,
    shortlistedCount: 44,
    offersCount: 22,
    status: "Active",
  },
  {
    driveId: "DRV-2026-007",
    company: "TCS Digital & Prime",
    role: "Systems Specialist",
    sector: "IT Consulting",
    tier: "Core",
    ctcLpa: 7.5,
    date: "2026-10-28",
    registeredCount: 260,
    shortlistedCount: 95,
    offersCount: 45,
    status: "Upcoming",
  },
];

const COMPETENCY_GAPS: CompetencyGapItem[] = [
  {
    competency: "System Design & Distributed Scalability",
    avgScore: 64,
    proficientCount: 142,
    criticalCount: 98,
    recommendation: "Conduct weekend intensive system design workshops covering microservices caching and Kafka event streams.",
    status: "Critical",
  },
  {
    competency: "Data Structures & Algorithmic Complexity",
    avgScore: 78,
    proficientCount: 264,
    criticalCount: 42,
    recommendation: "Active weekly leetcode-style timed contests on ColossusIQ Mock Tests arena.",
    status: "Attention",
  },
  {
    competency: "Technical Mock Interview Communication",
    avgScore: 72,
    proficientCount: 220,
    criticalCount: 68,
    recommendation: "Mandate 2 AI viva/mock interview practice sessions per student before upcoming Core drives.",
    status: "Attention",
  },
  {
    competency: "Resume ATS Compliance & Proof Points",
    avgScore: 86,
    proficientCount: 385,
    criticalCount: 22,
    recommendation: "86% students have passed resume ATS verification benchmark (70+ score).",
    status: "Healthy",
  },
  {
    competency: "Domain & Core Engineering Fundamentals",
    avgScore: 84,
    proficientCount: 340,
    criticalCount: 30,
    recommendation: "Strong performance in department coursework and lab practical demonstrations.",
    status: "Healthy",
  },
];

const PLACED_STUDENTS_SAMPLE: StudentPlacementRecord[] = [
  {
    roll: "22BM112",
    name: "Divya Raman",
    department: "Biomedical Engineering",
    cgpa: 9.24,
    readinessScore: 94,
    company: "MediTech Diagnostics & Robotics",
    role: "Biomedical Systems Engineer",
    packageLpa: 18.5,
    tier: "Super Dream",
    status: "Placed",
    offerDate: "2026-10-16",
  },
  {
    roll: "22CS104",
    name: "Karthik Iyer",
    department: "Computer Science & Engineering",
    cgpa: 8.86,
    readinessScore: 91,
    company: "Google Apex Engineering",
    role: "Software Development Engineer (SDE-1)",
    packageLpa: 44.0,
    tier: "Super Dream",
    status: "Placed",
    offerDate: "2026-09-18",
  },
  {
    roll: "21IT089",
    name: "R. Priyadarshini",
    department: "Information Technology",
    cgpa: 9.42,
    readinessScore: 96,
    company: "Amazon AWS Autumn",
    role: "Cloud Solutions Architect",
    packageLpa: 28.0,
    tier: "Super Dream",
    status: "Placed",
    offerDate: "2026-10-04",
  },
  {
    roll: "22CS108",
    name: "Anand Kumar",
    department: "Computer Science & Engineering",
    cgpa: 8.75,
    readinessScore: 88,
    company: "Zoho Corporation",
    role: "Full Stack Member Technical Staff",
    packageLpa: 14.5,
    tier: "Dream",
    status: "Placed",
    offerDate: "2026-10-12",
  },
  {
    roll: "22AD032",
    name: "Sneha Nair",
    department: "Artificial Intelligence & Data Science",
    cgpa: 9.18,
    readinessScore: 93,
    company: "Microsoft Cloud & AI",
    role: "Applied AI Engineer",
    packageLpa: 36.5,
    tier: "Super Dream",
    status: "Placed",
    offerDate: "2026-09-24",
  },
  {
    roll: "22EE054",
    name: "Suresh Balaji",
    department: "Electrical & Electronics Engineering",
    cgpa: 8.62,
    readinessScore: 85,
    company: "Larsen & Toubro Core Solutions",
    role: "GET - EV Powertrain & BMS",
    packageLpa: 12.0,
    tier: "Dream",
    status: "Placed",
    offerDate: "2026-10-22",
  },
  {
    roll: "22ME041",
    name: "Vigneshwaran P.",
    department: "Mechanical Engineering",
    cgpa: 8.34,
    readinessScore: 78,
    company: "Tata Motors Automotive",
    role: "Design Engineer Trainee",
    packageLpa: 8.5,
    tier: "Core",
    status: "Placed",
    offerDate: "2026-10-08",
  },
  {
    roll: "22IT045",
    name: "Meera Krishnan",
    department: "Information Technology",
    cgpa: 8.91,
    readinessScore: 89,
    company: "Zoho Corporation",
    role: "Software Developer",
    packageLpa: 12.0,
    tier: "Dream",
    status: "Placed",
    offerDate: "2026-10-12",
  },
  {
    roll: "22CS119",
    name: "Rahul Nambiar",
    department: "Computer Science & Engineering",
    cgpa: 8.45,
    readinessScore: 84,
    company: "TCS Digital & Prime",
    role: "Systems Specialist",
    packageLpa: 7.5,
    tier: "Core",
    status: "Placed",
    offerDate: "2026-10-15",
  },
  {
    roll: "22EE062",
    name: "Harish V.",
    department: "Electrical & Electronics Engineering",
    cgpa: 7.92,
    readinessScore: 72,
    company: "",
    role: "",
    packageLpa: 0,
    tier: "Seeking Placement",
    status: "Seeking Placement",
    offerDate: "",
  },
  {
    roll: "22ME058",
    name: "Gowtham S.",
    department: "Mechanical Engineering",
    cgpa: 7.84,
    readinessScore: 68,
    company: "",
    role: "",
    packageLpa: 0,
    tier: "In Process",
    status: "In Process",
    offerDate: "",
  },
];

function getCollegeKey(session: SessionPayload): string {
  if (!session.college || session.college === "all") return "COL-1001";
  return session.college;
}

export async function getPlacementAnalyticsOverview(
  session: SessionPayload,
  filter?: { department?: string; tier?: string }
): Promise<PlacementAnalyticsOverview> {
  const collegeId = getCollegeKey(session);
  const targets = store.targets[collegeId] || { ...DEFAULT_TARGETS };

  let depts = [...DEPARTMENT_METRICS];
  let students = [...PLACED_STUDENTS_SAMPLE];
  let drives = [...RECRUITER_DRIVES];

  if (filter?.department && filter.department !== "all") {
    depts = depts.filter((d) => d.department.toLowerCase().includes(filter.department!.toLowerCase()) || d.code.toLowerCase() === filter.department!.toLowerCase());
    students = students.filter((s) => s.department.toLowerCase().includes(filter.department!.toLowerCase()));
  }

  if (filter?.tier && filter.tier !== "all") {
    drives = drives.filter((d) => d.tier === filter.tier);
    students = students.filter((s) => s.tier === filter.tier);
  }

  const totalEligible = depts.reduce((acc, d) => acc + d.eligible, 0);
  const totalPlaced = depts.reduce((acc, d) => acc + d.placed, 0);
  const placementRate = totalEligible > 0 ? Math.round((totalPlaced / totalEligible) * 1000) / 10 : 85.8;

  const totalOffers = 538;
  const multipleOffers = 82;
  const avgCtc = 9.8;
  const medianCtc = 8.2;
  const highestCtc = 44.0;
  const recruitingPartners = 48;

  return {
    collegeName: "Anna Institute of Technology Chennai",
    collegeId,
    academicYear: "AY 2026–27 (Graduating Cohort)",
    lastRefreshed: new Date().toISOString(),
    executiveSummary: {
      totalEligibleStudents: totalEligible,
      placedStudentsCount: totalPlaced,
      placementPercentage: placementRate,
      targetPlacementPercentage: targets.targetPlacementPct,
      totalOffers,
      multipleOffersCount: multipleOffers,
      averagePackageLpa: avgCtc,
      medianPackageLpa: medianCtc,
      highestPackageLpa: highestCtc,
      totalParticipatingRecruiters: recruitingPartners,
      superDreamOffers: 76,
      dreamOffers: 152,
      coreOffers: 204,
      massOffers: 106,
    },
    salaryTierDistribution: SALARY_TIERS,
    hiringFunnel: HIRING_FUNNEL,
    departmentBreakdown: depts,
    recruiterDrives: drives,
    readinessGaps: COMPETENCY_GAPS,
    placedStudents: students,
    institutionalTargets: targets,
  };
}

export async function updatePlacementTargets(
  session: SessionPayload,
  input: UpdatePlacementTargetsInput
): Promise<InstitutionalPlacementTargets> {
  const collegeId = getCollegeKey(session);
  const updated: InstitutionalPlacementTargets = {
    targetPlacementPct: input.targetPlacementPct,
    minAverageLpaTarget: input.minAverageLpaTarget,
    mockInterviewCompletionTarget: input.mockInterviewCompletionTarget,
    targetCompaniesCount: input.targetCompaniesCount,
    updatedAt: new Date().toISOString(),
    updatedBy: session.name || "Placement Executive",
  };

  store.targets[collegeId] = updated;
  store.targets.all = updated;

  return updated;
}
