import "server-only";
import type { SessionPayload } from "@/lib/auth/session";
import {
  type CreateStartupInput,
  type StartupItem,
  type StartupPortfolioOverview,
  type UpdateStartupInput,
} from "@/lib/api/startup-schemas";
import { sharedState } from "./global-state";

const INITIAL_STARTUPS: StartupItem[] = [
  {
    id: "stu-agrisoil",
    name: "AgriSoil Sense",
    tagline: "Low-cost IoT soil health diagnostics with instant NPK & pH telemetry",
    registrationNumber: "DPIIT-TN-2025-9481",
    domain: "AgriTech",
    incorporationStatus: "DPIIT Recognized",
    stage: "Commercial Pilot",
    founders: [
      { name: "Anand Kumar", role: "CEO & Embedded Systems", email: "anand.agri@ait.edu.in", rollNo: "22CS104" },
      { name: "Sanjay Rao", role: "CTO", email: "sanjay.r@ait.edu.in" },
    ],
    leadFounder: "Anand Kumar",
    leadEmail: "anand.agri@ait.edu.in",
    department: "Computer Science & Engineering",
    cohort: "2026 Innovation Cohort",
    assignedMentor: "Dr. Meena Raghavan",
    readinessScore: 82,
    fundingRaised: "₹5,50,000 (TANSIM + Seed)",
    revenue: "₹1,20,000 ARR",
    activePilotsCount: 4,
    patentStatus: "Filed (Provisional)",
    websiteUrl: "https://agrisoil.ait.edu.in",
    pitchDeckUrl: "https://drive.google.com/deck-agrisoil",
    demoUrl: "https://agrisoil-demo.ait.edu.in",
    campusIncubatedAt: "2025-11-15T00:00:00.000Z",
    status: "Active",
  },
  {
    id: "stu-mediscan",
    name: "MediScan AI",
    tagline: "Edge AI ophthalmic screening for early diabetic retinopathy detection",
    registrationNumber: "U72900TN2025PTC184920",
    domain: "HealthTech",
    incorporationStatus: "Registered Private Limited",
    stage: "Commercial Pilot",
    founders: [
      { name: "Divya Raman", role: "Founder & AI Lead", email: "divya.med@ait.edu.in", rollNo: "22BM112" },
      { name: "Dr. A. Vignesh", role: "Clinical Advisor" },
    ],
    leadFounder: "Divya Raman",
    leadEmail: "divya.med@ait.edu.in",
    department: "Biomedical Engineering",
    cohort: "2026 Innovation Cohort",
    assignedMentor: "Dr. P. Vasanthi",
    readinessScore: 88,
    fundingRaised: "₹12,50,000 (BIRAC BIG + Campus Grant)",
    revenue: "₹3,80,000 ARR",
    activePilotsCount: 3,
    patentStatus: "Published",
    websiteUrl: "https://mediscan.ait.edu.in",
    pitchDeckUrl: "https://drive.google.com/deck-mediscan",
    demoUrl: "https://mediscan-demo.ait.edu.in",
    campusIncubatedAt: "2025-08-10T00:00:00.000Z",
    status: "Active",
  },
  {
    id: "stu-edututr",
    name: "Edututr Vernacular",
    tagline: "Adaptive gamified math and coding modules in regional South Indian languages",
    registrationNumber: "DPIIT-TN-2025-10294",
    domain: "EdTech",
    incorporationStatus: "DPIIT Recognized",
    stage: "Growth & Scaling",
    founders: [
      { name: "R. Priyadarshini", role: "CEO & Product Lead", email: "priya.it@ait.edu.in", rollNo: "21IT089" },
      { name: "K. Mohan", role: "Tech Lead" },
    ],
    leadFounder: "R. Priyadarshini",
    leadEmail: "priya.it@ait.edu.in",
    department: "Information Technology",
    cohort: "2025 Summer Cohort",
    assignedMentor: "Dr. K. Saravanan",
    readinessScore: 94,
    fundingRaised: "₹25,00,000 (Angel Syndicate + TANSIM)",
    revenue: "₹14,50,000 ARR",
    activePilotsCount: 12,
    patentStatus: "Granted",
    websiteUrl: "https://edututr.ai",
    pitchDeckUrl: "https://drive.google.com/deck-edututr",
    demoUrl: "https://edututr.ai/app",
    campusIncubatedAt: "2025-04-12T00:00:00.000Z",
    status: "Active",
  },
  {
    id: "stu-greencharge",
    name: "GreenCharge EV",
    tagline: "Smart battery swapping docking terminal with active thermal load management",
    registrationNumber: "LLP-AAZ-4921",
    domain: "CleanTech & IoT",
    incorporationStatus: "Campus IP Spin-off",
    stage: "MVP Live",
    founders: [
      { name: "Suresh Balaji", role: "Hardware Lead", email: "suresh.b@ait.edu.in", rollNo: "22EE054" },
      { name: "G. Rahul", role: "Power Electronics" },
    ],
    leadFounder: "Suresh Balaji",
    leadEmail: "suresh.b@ait.edu.in",
    department: "Electrical & Electronics Engineering",
    cohort: "2026 Innovation Cohort",
    assignedMentor: "Mr. Rajesh Chandran",
    readinessScore: 79,
    fundingRaised: "₹4,00,000 (DST NIDHI PRAYAS)",
    revenue: "Pre-revenue",
    activePilotsCount: 2,
    patentStatus: "Filed (Provisional)",
    websiteUrl: "https://greencharge.ait.edu.in",
    pitchDeckUrl: "https://drive.google.com/deck-greencharge",
    demoUrl: "",
    campusIncubatedAt: "2026-01-20T00:00:00.000Z",
    status: "Active",
  },
  {
    id: "stu-aquapure",
    name: "AquaPure Nano",
    tagline: "Graphene oxide nanofiltration cartridge for low-cost fluoride removal",
    registrationNumber: "Incubation in progress",
    domain: "CleanTech & IoT",
    incorporationStatus: "Student Pre-Incubation",
    stage: "Early Prototype",
    founders: [
      { name: "Naveen Prakash", role: "Material Lead", email: "naveen.nano@ait.edu.in", rollNo: "23CE045" },
    ],
    leadFounder: "Naveen Prakash",
    leadEmail: "naveen.nano@ait.edu.in",
    department: "Civil & Environmental Engineering",
    cohort: "2026 Innovation Cohort",
    assignedMentor: "Prof. A. Senthilkumar",
    readinessScore: 71,
    fundingRaised: "₹75,000 (R&D Grant)",
    revenue: "Pre-revenue",
    activePilotsCount: 1,
    patentStatus: "In Drafting",
    websiteUrl: "",
    pitchDeckUrl: "https://drive.google.com/deck-aquapure",
    demoUrl: "",
    campusIncubatedAt: "2026-03-01T00:00:00.000Z",
    status: "Active",
  },
  {
    id: "stu-roboharvest",
    name: "RoboHarvest",
    tagline: "Autonomous wheeled tree-climber and coconut yield harvester for farms",
    registrationNumber: "U29100TN2025PTC192004",
    domain: "Robotics & Hardware",
    incorporationStatus: "Registered Private Limited",
    stage: "Growth & Scaling",
    founders: [
      { name: "K. Vigneshwaran", role: "Founder & Robotics Lead", email: "vignesh.robo@ait.edu.in", rollNo: "21ME032" },
      { name: "Deepak S.", role: "Firmware" },
    ],
    leadFounder: "K. Vigneshwaran",
    leadEmail: "vignesh.robo@ait.edu.in",
    department: "Mechanical Engineering",
    cohort: "2025 Summer Cohort",
    assignedMentor: "Dr. K. Saravanan",
    readinessScore: 92,
    fundingRaised: "₹18,00,000 (TN Startup Seed + Grant)",
    revenue: "₹8,50,000 ARR",
    activePilotsCount: 8,
    patentStatus: "Granted",
    websiteUrl: "https://roboharvest.ait.edu.in",
    pitchDeckUrl: "https://drive.google.com/deck-roboharvest",
    demoUrl: "https://roboharvest.ait.edu.in/demo",
    campusIncubatedAt: "2025-05-18T00:00:00.000Z",
    status: "Active",
  },
  {
    id: "stu-cybershield",
    name: "CyberShield Campus",
    tagline: "Decentralized verifiable credentials and exam ProctorGuard for colleges",
    registrationNumber: "Incubation in progress",
    domain: "FinTech & Web3",
    incorporationStatus: "Student Pre-Incubation",
    stage: "Ideation",
    founders: [
      { name: "Akash Verma", role: "Lead Developer", email: "akash.v@ait.edu.in", rollNo: "23CS119" },
    ],
    leadFounder: "Akash Verma",
    leadEmail: "akash.v@ait.edu.in",
    department: "Computer Science & Engineering",
    cohort: "2026 Innovation Cohort",
    assignedMentor: "Unassigned",
    readinessScore: 65,
    fundingRaised: "Bootstrapped",
    revenue: "Pre-revenue",
    activePilotsCount: 0,
    patentStatus: "Not Applicable",
    websiteUrl: "",
    pitchDeckUrl: "",
    demoUrl: "",
    campusIncubatedAt: "2026-07-01T00:00:00.000Z",
    status: "Active",
  },
];

const inMemoryStartups = sharedState("campus.incubation.startups.v1", () => {
  const map = new Map<string, StartupItem[]>();
  map.set("COL-1001", [...INITIAL_STARTUPS]);
  map.set("all", [...INITIAL_STARTUPS]);
  return map;
});

function getCollegeId(session: SessionPayload): string {
  if (!session.college || session.college === "all") return "COL-1001";
  return session.college;
}

export async function getStartupPortfolioOverview(
  session: SessionPayload
): Promise<StartupPortfolioOverview> {
  const collegeId = getCollegeId(session);
  let list = inMemoryStartups.get(collegeId);
  if (!list) {
    list = [...INITIAL_STARTUPS];
    inMemoryStartups.set(collegeId, list);
  }

  const dpiitRecognizedCount = list.filter(
    (s) => s.incorporationStatus === "DPIIT Recognized" || s.registrationNumber.startsWith("DPIIT")
  ).length;

  const activeCommercialPilots = list.reduce((acc, s) => acc + (s.activePilotsCount || 0), 0);

  const patentsCount = list.filter((s) => s.patentStatus !== "Not Applicable").length;

  return {
    totalStartups: list.length,
    dpiitRecognizedCount,
    totalFundingMobilized: "₹65.75 Lakhs",
    activeCommercialPilots,
    patentsCount,
    startups: list,
  };
}

export async function createStartup(
  session: SessionPayload,
  input: CreateStartupInput
): Promise<StartupItem> {
  const collegeId = getCollegeId(session);
  const list = inMemoryStartups.get(collegeId) || [];

  const newStartup: StartupItem = {
    id: `stu-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: input.name,
    tagline: input.tagline,
    registrationNumber: input.registrationNumber || "Incubation in progress",
    domain: input.domain,
    incorporationStatus: input.incorporationStatus || "Student Pre-Incubation",
    stage: input.stage || "MVP Live",
    founders:
      input.founders && input.founders.length > 0
        ? input.founders
        : [{ name: input.leadFounder, role: "Lead Founder", email: input.leadEmail }],
    leadFounder: input.leadFounder,
    leadEmail: input.leadEmail,
    department: input.department,
    cohort: input.cohort || "2026 Innovation Cohort",
    assignedMentor: input.assignedMentor || "Unassigned",
    readinessScore: input.readinessScore ?? 70,
    fundingRaised: input.fundingRaised || "Bootstrapped",
    revenue: input.revenue || "Pre-revenue",
    activePilotsCount: input.activePilotsCount ?? 0,
    patentStatus: input.patentStatus || "Not Applicable",
    websiteUrl: input.websiteUrl || "",
    pitchDeckUrl: input.pitchDeckUrl || "",
    demoUrl: input.demoUrl || "",
    campusIncubatedAt: new Date().toISOString(),
    status: "Active",
  };

  list.unshift(newStartup);
  inMemoryStartups.set(collegeId, list);
  return newStartup;
}

export async function updateStartup(
  session: SessionPayload,
  id: string,
  input: UpdateStartupInput
): Promise<StartupItem | null> {
  const collegeId = getCollegeId(session);
  const list = inMemoryStartups.get(collegeId) || [];
  const startup = list.find((s) => s.id === id);
  if (!startup) return null;

  if (input.stage !== undefined) startup.stage = input.stage;
  if (input.incorporationStatus !== undefined) startup.incorporationStatus = input.incorporationStatus;
  if (input.assignedMentor !== undefined) startup.assignedMentor = input.assignedMentor;
  if (input.readinessScore !== undefined) startup.readinessScore = input.readinessScore;
  if (input.fundingRaised !== undefined) startup.fundingRaised = input.fundingRaised;
  if (input.revenue !== undefined) startup.revenue = input.revenue;
  if (input.activePilotsCount !== undefined) startup.activePilotsCount = input.activePilotsCount;
  if (input.patentStatus !== undefined) startup.patentStatus = input.patentStatus;
  if (input.status !== undefined) startup.status = input.status;

  inMemoryStartups.set(collegeId, list);
  return startup;
}

export async function deleteStartup(
  session: SessionPayload,
  id: string
): Promise<boolean> {
  const collegeId = getCollegeId(session);
  const list = inMemoryStartups.get(collegeId) || [];
  const idx = list.findIndex((s) => s.id === id);
  if (idx === -1) return false;

  list.splice(idx, 1);
  inMemoryStartups.set(collegeId, list);
  return true;
}
