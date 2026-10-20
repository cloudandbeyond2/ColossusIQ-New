import "server-only";
import type { SessionPayload } from "@/lib/auth/session";
import {
  INCUBATION_STAGES,
  type CreateVentureInput,
  type IncubationPipelineOverview,
  type IncubationStage,
  type PipelineStageSummary,
  type PipelineVenture,
  type ReviewVentureInput,
} from "@/lib/api/incubation-schemas";
import { sharedState } from "./global-state";

const STAGE_DESCRIPTIONS: Record<IncubationStage, string> = {
  Idea: "Idea submission, initial screening & problem statement verification",
  Validation: "Customer discovery, market analysis & pain-point interviews",
  "Business Model & MVP": "Unit economics, revenue architecture & MVP development",
  "Prototyping & Mentorship": "Functional prototype testing with assigned domain mentors",
  "Incubation Review": "Formal presentation before College Incubation & Innovation Panel",
  Incubated: "Admitted into campus incubator with seed grant and co-working support",
};

const INITIAL_VENTURES: PipelineVenture[] = [
  {
    id: "ven-agrisoil",
    name: "AgriSoil Sense",
    tagline: "Low-cost IoT soil health diagnostics with instant NPK & pH telemetry",
    domain: "AgriTech",
    cohort: "2026 Innovation Cohort",
    stage: "Validation",
    founders: ["Anand Kumar", "Sanjay Rao", "Meera K."],
    leadFounder: "Anand Kumar",
    leadEmail: "anand.agri@ait.edu.in",
    department: "Computer Science & Engineering",
    readinessScore: 78,
    mentorName: "Dr. Meena Raghavan",
    grantAmount: "₹50,000 (Prototype Grant)",
    pitchDeckUrl: "https://drive.google.com/deck-agrisoil",
    demoUrl: "https://agrisoil-demo.ait.edu.in",
    reviewVerdict: "Recommended for Grant",
    reviewScore: 82,
    reviewNotes: "Strong problem validation with 40+ farmer interviews in Kanchipuram district.",
    submittedAt: "2026-08-10T10:00:00.000Z",
    updatedAt: "2026-09-15T14:30:00.000Z",
  },
  {
    id: "ven-mediscan",
    name: "MediScan AI",
    tagline: "Edge AI ophthalmic screening for early diabetic retinopathy detection",
    domain: "HealthTech",
    cohort: "2026 Innovation Cohort",
    stage: "Incubation Review",
    founders: ["Divya Raman", "Dr. A. Vignesh", "Karthik Iyer"],
    leadFounder: "Divya Raman",
    leadEmail: "divya.med@ait.edu.in",
    department: "Biomedical Engineering",
    readinessScore: 88,
    mentorName: "Dr. P. Vasanthi",
    grantAmount: "₹2,50,000 (Seed Grant Approved)",
    pitchDeckUrl: "https://drive.google.com/deck-mediscan",
    demoUrl: "https://mediscan.ait.edu.in",
    reviewVerdict: "Approved for Incubation",
    reviewScore: 91,
    reviewNotes: "Passed hospital pilot testing at primary health center with 94.6% sensitivity.",
    submittedAt: "2026-07-22T09:15:00.000Z",
    updatedAt: "2026-10-02T16:00:00.000Z",
  },
  {
    id: "ven-greencharge",
    name: "GreenCharge EV",
    tagline: "Modular solar-assisted battery swapping station network for campus 2-wheelers",
    domain: "CleanTech & IoT",
    cohort: "2026 Innovation Cohort",
    stage: "Prototyping & Mentorship",
    founders: ["R. Murugan", "Siddharth N."],
    leadFounder: "R. Murugan",
    leadEmail: "murugan.ev@ait.edu.in",
    department: "Mechanical Engineering",
    readinessScore: 74,
    mentorName: "Prof. R. Balaji",
    grantAmount: "₹1,00,000 (Hardware Grant)",
    pitchDeckUrl: "https://drive.google.com/deck-greencharge",
    demoUrl: "https://greencharge.ait.edu.in",
    reviewVerdict: "Needs Iteration",
    reviewScore: 75,
    reviewNotes: "Safety telemetry and BMS thermal protection need another lab rehearsal.",
    submittedAt: "2026-08-01T11:20:00.000Z",
    updatedAt: "2026-09-28T12:00:00.000Z",
  },
  {
    id: "ven-edututr",
    name: "Edututr Vernacular",
    tagline: "Multilingual AI voice copilot teaching STEM in Tamil, Telugu, and Hindi",
    domain: "AI & DeepTech",
    cohort: "2026 Innovation Cohort",
    stage: "Incubated",
    founders: ["Priya Sundar", "Arun V.", "Ganesh B."],
    leadFounder: "Priya Sundar",
    leadEmail: "priya.edu@ait.edu.in",
    department: "Information Technology",
    readinessScore: 94,
    mentorName: "Dr. K. Saravanan",
    grantAmount: "₹5,00,000 (TANSIM Incubation Fund)",
    pitchDeckUrl: "https://drive.google.com/deck-edututr",
    demoUrl: "https://edututr.ai",
    reviewVerdict: "Approved for Incubation",
    reviewScore: 96,
    reviewNotes: "Selected for State Startup Showcase; registered entity with 5,000 monthly active school learners.",
    submittedAt: "2026-06-15T08:00:00.000Z",
    updatedAt: "2026-10-10T11:45:00.000Z",
  },
  {
    id: "ven-aquapure",
    name: "AquaPure Nano",
    tagline: "Graphene oxide nanofiltration cartridge for low-cost fluoride removal",
    domain: "CleanTech & IoT",
    cohort: "2026 Innovation Cohort",
    stage: "Business Model & MVP",
    founders: ["Naveen Prakash", "Lavanya M."],
    leadFounder: "Naveen Prakash",
    leadEmail: "naveen.nano@ait.edu.in",
    department: "Civil & Environmental Engineering",
    readinessScore: 71,
    mentorName: "Prof. A. Senthilkumar",
    grantAmount: "₹75,000 (R&D Grant)",
    pitchDeckUrl: "https://drive.google.com/deck-aquapure",
    demoUrl: "",
    reviewVerdict: "Pending Review",
    reviewScore: 72,
    reviewNotes: "Drafted patent application; unit economics currently under revision.",
    submittedAt: "2026-08-25T14:10:00.000Z",
    updatedAt: "2026-09-20T10:15:00.000Z",
  },
  {
    id: "ven-cybershield",
    name: "CyberShield Campus",
    tagline: "Decentralized verifiable credentials and exam ProctorGuard for colleges",
    domain: "FinTech & Web3",
    cohort: "2026 Innovation Cohort",
    stage: "Idea",
    founders: ["Harish Krishna", "Deepak S."],
    leadFounder: "Harish Krishna",
    leadEmail: "harish.cyber@ait.edu.in",
    department: "Computer Science & Engineering",
    readinessScore: 62,
    mentorName: "Unassigned",
    grantAmount: "—",
    pitchDeckUrl: "https://drive.google.com/deck-cybershield",
    demoUrl: "",
    reviewVerdict: "Pending Review",
    reviewScore: 65,
    reviewNotes: "Initial pitch screened by Incubation Cell. Assigned for mentor pairing.",
    submittedAt: "2026-09-30T16:20:00.000Z",
    updatedAt: "2026-09-30T16:20:00.000Z",
  },
  {
    id: "ven-roboharvest",
    name: "RoboHarvest",
    tagline: "Autonomous vision-guided tomato harvesting robot for precision greenhouses",
    domain: "Robotics & Hardware",
    cohort: "2025 Summer Cohort",
    stage: "Incubated",
    founders: ["Vigneshwaran K.", "R. Deepa"],
    leadFounder: "Vigneshwaran K.",
    leadEmail: "vicky.robot@ait.edu.in",
    department: "Mechanical Engineering",
    readinessScore: 92,
    mentorName: "Prof. R. Balaji",
    grantAmount: "₹3,50,000 (Seed Grant)",
    pitchDeckUrl: "https://drive.google.com/deck-roboharvest",
    demoUrl: "https://roboharvest.ait.edu.in",
    reviewVerdict: "Approved for Incubation",
    reviewScore: 93,
    reviewNotes: "Winner at State Agri-Robotics Hackathon. Working prototype deployed at farm.",
    submittedAt: "2025-05-12T10:00:00.000Z",
    updatedAt: "2025-11-20T15:00:00.000Z",
  },
];

const inMemoryVentures = sharedState("campus.incubation.pipeline.v2", () => {
  const map = new Map<string, PipelineVenture[]>();
  map.set("COL-1001", [...INITIAL_VENTURES]);
  map.set("all", [...INITIAL_VENTURES]);
  return map;
});

function getCollegeId(session: SessionPayload): string {
  if (!session.college || session.college === "all") return "COL-1001";
  return session.college;
}

export async function getIncubationPipelineOverview(
  session: SessionPayload,
  selectedCohort?: string
): Promise<IncubationPipelineOverview> {
  const collegeId = getCollegeId(session);
  let list = inMemoryVentures.get(collegeId);
  if (!list) {
    list = [...INITIAL_VENTURES];
    inMemoryVentures.set(collegeId, list);
  }

  const cohortsSet = new Set<string>();
  for (const v of list) {
    if (v.cohort) cohortsSet.add(v.cohort);
  }
  cohortsSet.add("2026 Innovation Cohort");
  cohortsSet.add("2025 Summer Cohort");
  const availableCohorts = Array.from(cohortsSet);

  const activeCohort = selectedCohort && availableCohorts.includes(selectedCohort) ? selectedCohort : "2026 Innovation Cohort";
  const cohortVentures = list.filter((v) => v.cohort === activeCohort);

  // Calculate stages summary
  const stages: PipelineStageSummary[] = INCUBATION_STAGES.map((stg) => {
    const count = cohortVentures.filter((v) => v.stage === stg).length;
    return {
      stage: stg,
      label: stg,
      count,
      description: STAGE_DESCRIPTIONS[stg],
    };
  });

  const inReviewCount = cohortVentures.filter((v) => v.stage === "Incubation Review").length;
  const incubatedCount = cohortVentures.filter((v) => v.stage === "Incubated").length;

  const mentorSet = new Set<string>();
  let seedGrantsTotal = 0;
  for (const v of cohortVentures) {
    if (v.mentorName && v.mentorName !== "Unassigned") mentorSet.add(v.mentorName);
    const grantMatch = v.grantAmount.match(/₹([0-9,]+)/);
    if (grantMatch && grantMatch[1]) {
      const num = parseInt(grantMatch[1].replace(/,/g, ""), 10);
      if (!isNaN(num)) seedGrantsTotal += num;
    }
  }

  const formattedGrants = "₹" + seedGrantsTotal.toLocaleString("en-IN");

  return {
    cohort: activeCohort,
    availableCohorts,
    totalVentures: cohortVentures.length,
    inReviewCount,
    incubatedCount,
    seedGrantsTotal: formattedGrants,
    totalMentors: mentorSet.size,
    stages,
    ventures: cohortVentures,
  };
}

export async function createPipelineVenture(
  session: SessionPayload,
  input: CreateVentureInput
): Promise<PipelineVenture> {
  const collegeId = getCollegeId(session);
  const list = inMemoryVentures.get(collegeId) || [];

  const newVenture: PipelineVenture = {
    id: `ven-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: input.name,
    tagline: input.tagline,
    domain: input.domain,
    cohort: input.cohort,
    stage: input.stage,
    founders: input.founders.length ? input.founders : [input.leadFounder],
    leadFounder: input.leadFounder,
    leadEmail: input.leadEmail,
    department: input.department,
    readinessScore: 60,
    mentorName: input.mentorName || "Unassigned",
    grantAmount: "—",
    pitchDeckUrl: input.pitchDeckUrl,
    demoUrl: input.demoUrl,
    reviewVerdict: "Pending Review",
    reviewScore: 60,
    reviewNotes: "Newly submitted into the incubation pipeline.",
    submittedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  list.unshift(newVenture);
  inMemoryVentures.set(collegeId, list);
  return newVenture;
}

export async function updatePipelineVentureStage(
  session: SessionPayload,
  ventureId: string,
  stage: IncubationStage
): Promise<PipelineVenture | null> {
  const collegeId = getCollegeId(session);
  const list = inMemoryVentures.get(collegeId) || [];
  const venture = list.find((v) => v.id === ventureId);
  if (!venture) return null;

  venture.stage = stage;
  venture.updatedAt = new Date().toISOString();

  // Dynamically update readiness estimate based on stage
  const stageWeights: Record<IncubationStage, number> = {
    Idea: 60,
    Validation: 72,
    "Business Model & MVP": 80,
    "Prototyping & Mentorship": 86,
    "Incubation Review": 90,
    Incubated: 95,
  };
  venture.readinessScore = Math.max(venture.readinessScore, stageWeights[stage]);

  return venture;
}

export async function reviewPipelineVenture(
  session: SessionPayload,
  ventureId: string,
  review: ReviewVentureInput
): Promise<PipelineVenture | null> {
  const collegeId = getCollegeId(session);
  const list = inMemoryVentures.get(collegeId) || [];
  const venture = list.find((v) => v.id === ventureId);
  if (!venture) return null;

  venture.reviewVerdict = review.verdict;
  venture.reviewScore = review.score;
  venture.reviewNotes = review.notes;
  if (review.grantAmount) venture.grantAmount = review.grantAmount;
  if (review.mentorName) venture.mentorName = review.mentorName;
  venture.readinessScore = Math.max(venture.readinessScore, review.score);
  venture.updatedAt = new Date().toISOString();

  if (review.verdict === "Approved for Incubation") {
    venture.stage = "Incubated";
  }

  return venture;
}

export async function deletePipelineVenture(
  session: SessionPayload,
  ventureId: string
): Promise<boolean> {
  const collegeId = getCollegeId(session);
  const list = inMemoryVentures.get(collegeId) || [];
  const idx = list.findIndex((v) => v.id === ventureId);
  if (idx === -1) return false;

  list.splice(idx, 1);
  inMemoryVentures.set(collegeId, list);
  return true;
}
