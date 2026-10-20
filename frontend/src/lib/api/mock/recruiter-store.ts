import "server-only";
import type { SessionPayload } from "@/lib/auth/session";
import {
  type CandidateProfile,
  type CreateShortlistInput,
  type InterviewScheduleItem,
  type InterviewsOverview,
  type ScheduleInterviewInput,
  type ShortlistCandidate,
  type ShortlistsOverview,
  type SubmitInterviewFeedbackInput,
  type TalentSearchOverview,
  type UpdateShortlistStageInput,
} from "@/lib/api/recruiter-schemas";
import { sharedState } from "./global-state";

const INITIAL_CANDIDATES: CandidateProfile[] = [
  {
    id: "cand-1",
    name: "Divya Raman",
    roll: "22BM112",
    department: "Biomedical Engineering",
    college: "Anna Institute of Technology",
    cgpa: 9.24,
    readiness: 94,
    graduationYear: 2026,
    skills: ["Python", "PyTorch", "OpenCV", "Deep Learning", "Edge Computing"],
    projectTitle: "MediScan AI: Edge AI Ophthalmic Retinopathy Diagnostic Suite",
    projectDomain: "HealthTech & AI",
    email: "divya.med@ait.edu.in",
    githubUrl: "https://github.com/divya-raman",
    linkedinUrl: "https://linkedin.com/in/divya-raman-med",
    status: "Shortlisted",
    activeShortlistCount: 2,
  },
  {
    id: "cand-2",
    name: "Karthik Iyer",
    roll: "22CS104",
    department: "Computer Science & Engineering",
    college: "Anna Institute of Technology",
    cgpa: 8.86,
    readiness: 91,
    graduationYear: 2026,
    skills: ["TypeScript", "Next.js", "Node.js", "PostgreSQL", "Docker", "GraphQL"],
    projectTitle: "Colossus Cloud: Zero-Trust Multi-Tenant Examination Proctoring",
    projectDomain: "Distributed Systems & Cloud",
    email: "karthik.cs@ait.edu.in",
    githubUrl: "https://github.com/karthik-iyer-dev",
    linkedinUrl: "https://linkedin.com/in/karthik-iyer-eng",
    status: "Shortlisted",
    activeShortlistCount: 1,
  },
  {
    id: "cand-3",
    name: "R. Priyadarshini",
    roll: "21IT089",
    department: "Information Technology",
    college: "Anna Institute of Technology",
    cgpa: 9.42,
    readiness: 96,
    graduationYear: 2026,
    skills: ["Python", "FastAPI", "React", "NLP", "BERT", "Redis", "Kafka"],
    projectTitle: "Edututr AI: Vernacular Adaptive Math & Code Learning Engine",
    projectDomain: "EdTech & NLP",
    email: "priya.it@ait.edu.in",
    githubUrl: "https://github.com/priya-edututr",
    linkedinUrl: "https://linkedin.com/in/r-priyadarshini",
    status: "Shortlisted",
    activeShortlistCount: 1,
  },
  {
    id: "cand-4",
    name: "Anand Kumar",
    roll: "22CS108",
    department: "Computer Science & Engineering",
    college: "Anna Institute of Technology",
    cgpa: 8.75,
    readiness: 88,
    graduationYear: 2026,
    skills: ["Embedded C++", "Python", "MQTT", "ESP32", "AWS IoT Core", "PostgreSQL"],
    projectTitle: "AgriSoil Sense: Edge Microcontroller Telemetry & Soil Health",
    projectDomain: "IoT & Embedded Systems",
    email: "anand.agri@ait.edu.in",
    githubUrl: "https://github.com/anand-kumar-agri",
    linkedinUrl: "https://linkedin.com/in/anand-kumar-iot",
    status: "Available",
    activeShortlistCount: 0,
  },
  {
    id: "cand-5",
    name: "Suresh Balaji",
    roll: "22EE054",
    department: "Electrical & Electronics Engineering",
    college: "Anna Institute of Technology",
    cgpa: 8.62,
    readiness: 85,
    graduationYear: 2026,
    skills: ["C++", "MATLAB / Simulink", "CAN Bus", "Battery Management (BMS)", "Hardware In Loop"],
    projectTitle: "GreenCharge EV: Smart Thermal Docking Terminal",
    projectDomain: "CleanTech & Hardware",
    email: "suresh.b@ait.edu.in",
    githubUrl: "https://github.com/suresh-balaji-ev",
    linkedinUrl: "https://linkedin.com/in/suresh-balaji-bms",
    status: "Available",
    activeShortlistCount: 0,
  },
  {
    id: "cand-6",
    name: "Sneha Nair",
    roll: "22AD032",
    department: "Artificial Intelligence & Data Science",
    college: "Anna Institute of Technology",
    cgpa: 9.15,
    readiness: 93,
    graduationYear: 2026,
    skills: ["Python", "TensorFlow", "Pandas", "Scikit-Learn", "SQL", "Tableau", "AWS S3"],
    projectTitle: "RetailPulse: Real-Time Demand Forecasting & Basket Optimization",
    projectDomain: "Data Analytics & ML",
    email: "sneha.ad@ait.edu.in",
    githubUrl: "https://github.com/sneha-nair-ds",
    linkedinUrl: "https://linkedin.com/in/sneha-nair-ai",
    status: "Shortlisted",
    activeShortlistCount: 1,
  },
  {
    id: "cand-7",
    name: "K. Vigneshwaran",
    roll: "21ME032",
    department: "Mechanical Engineering",
    college: "Anna Institute of Technology",
    cgpa: 8.92,
    readiness: 90,
    graduationYear: 2026,
    skills: ["ROS 2", "SolidWorks", "Python", "Mechatronics", "Motor Controllers", "C++"],
    projectTitle: "RoboHarvest: Autonomous Agri-Climber Robot",
    projectDomain: "Robotics & Automation",
    email: "vignesh.robo@ait.edu.in",
    githubUrl: "https://github.com/vignesh-robo",
    linkedinUrl: "https://linkedin.com/in/vigneshwaran-mechatronics",
    status: "Available",
    activeShortlistCount: 0,
  },
  {
    id: "cand-8",
    name: "Harish Reddy",
    roll: "22CS120",
    department: "Computer Science & Engineering",
    college: "Anna Institute of Technology",
    cgpa: 8.45,
    readiness: 84,
    graduationYear: 2026,
    skills: ["Go (Golang)", "gRPC", "Kubernetes", "Linux Kernel", "Terraform", "Prometheus"],
    projectTitle: "MeshFlow: Distributed Service Mesh Telemetry Proxy",
    projectDomain: "Cloud & DevOps",
    email: "harish.cs@ait.edu.in",
    githubUrl: "https://github.com/harish-reddy-dev",
    linkedinUrl: "https://linkedin.com/in/harish-reddy-cloud",
    status: "Available",
    activeShortlistCount: 0,
  },
  {
    id: "cand-9",
    name: "Kavya Menon",
    roll: "22EC078",
    department: "Electronics & Communication",
    college: "Anna Institute of Technology",
    cgpa: 8.81,
    readiness: 86,
    graduationYear: 2026,
    skills: ["Verilog", "FPGA Vivado", "Digital Signal Processing", "C++", "VHDL"],
    projectTitle: "UltraLowRISC: 32-bit Pipelined RISC-V SoC Synthesizer",
    projectDomain: "Semiconductors & VLSI",
    email: "kavya.ec@ait.edu.in",
    githubUrl: "https://github.com/kavya-menon-vlsi",
    linkedinUrl: "https://linkedin.com/in/kavya-menon-soc",
    status: "Available",
    activeShortlistCount: 0,
  },
  {
    id: "cand-10",
    name: "Akash Verma",
    roll: "23CS119",
    department: "Computer Science & Engineering",
    college: "Anna Institute of Technology",
    cgpa: 8.35,
    readiness: 80,
    graduationYear: 2027,
    skills: ["Solidity", "TypeScript", "Ethers.js", "Hardhat", "Next.js", "ZKP Snarks"],
    projectTitle: "CyberShield: Zero-Knowledge Verifiable Academic Credentials",
    projectDomain: "Web3 & Security",
    email: "akash.v@ait.edu.in",
    githubUrl: "https://github.com/akash-verma-zk",
    linkedinUrl: "https://linkedin.com/in/akash-verma-crypto",
    status: "Available",
    activeShortlistCount: 0,
  },
  {
    id: "cand-11",
    name: "Pooja Venkatesh",
    roll: "22EE061",
    department: "Electrical & Electronics Engineering",
    college: "Anna Institute of Technology",
    cgpa: 8.95,
    readiness: 87,
    graduationYear: 2026,
    skills: ["Python", "MATLAB", "Microgrid Optimization", "Solar Inverters", "SCADA"],
    projectTitle: "SolarClean Autonomous: Water-Free Solar Array Cleaning Robot",
    projectDomain: "Renewable Energy",
    email: "pooja.solar@ait.edu.in",
    githubUrl: "https://github.com/pooja-solar",
    linkedinUrl: "https://linkedin.com/in/pooja-venkatesh-ee",
    status: "Available",
    activeShortlistCount: 0,
  },
  {
    id: "cand-12",
    name: "Naveen Prakash",
    roll: "23CE045",
    department: "Civil & Environmental Engineering",
    college: "Anna Institute of Technology",
    cgpa: 8.52,
    readiness: 79,
    graduationYear: 2027,
    skills: ["AutoCAD Civil 3D", "GIS QGIS", "Hydraulic Modeling", "Material Testing", "Python"],
    projectTitle: "AquaPure Nano: Graphene Oxide Nanofiltration Water Purifier",
    projectDomain: "Environmental Engineering",
    email: "naveen.nano@ait.edu.in",
    githubUrl: "https://github.com/naveen-nano",
    linkedinUrl: "https://linkedin.com/in/naveen-prakash-ce",
    status: "Available",
    activeShortlistCount: 0,
  },
];

const INITIAL_SHORTLISTS: ShortlistCandidate[] = [
  {
    id: "short-1",
    candidateId: "cand-1",
    candidateName: "Divya Raman",
    roll: "22BM112",
    department: "Biomedical Engineering",
    college: "Anna Institute of Technology",
    roleRequisition: "AI / ML Engineer",
    stage: "Technical Interview",
    assessmentScore: 92,
    readiness: 94,
    notes: "Scored 92/100 on take-home edge computer vision assessment. Scheduled for technical panel.",
    shortlistedAt: "2026-10-10T10:00:00.000Z",
    updatedAt: "2026-10-16T14:30:00.000Z",
    interviewsCount: 1,
  },
  {
    id: "short-2",
    candidateId: "cand-2",
    candidateName: "Karthik Iyer",
    roll: "22CS104",
    department: "Computer Science & Engineering",
    college: "Anna Institute of Technology",
    roleRequisition: "SDE-1 (Full Stack)",
    stage: "Technical Interview",
    assessmentScore: 89,
    readiness: 91,
    notes: "Strong knowledge of TypeScript concurrency and Next.js server components. Interview today.",
    shortlistedAt: "2026-10-11T11:30:00.000Z",
    updatedAt: "2026-10-18T09:15:00.000Z",
    interviewsCount: 1,
  },
  {
    id: "short-3",
    candidateId: "cand-3",
    candidateName: "R. Priyadarshini",
    roll: "21IT089",
    department: "Information Technology",
    college: "Anna Institute of Technology",
    roleRequisition: "Backend & Cloud Engineer",
    stage: "Offer Extended",
    assessmentScore: 96,
    readiness: 96,
    notes: "Exceptional architecture skills and NLP depth. Final offer letter released (₹18 LPA CTC).",
    shortlistedAt: "2026-09-28T09:00:00.000Z",
    updatedAt: "2026-10-15T16:00:00.000Z",
    interviewsCount: 2,
  },
  {
    id: "short-4",
    candidateId: "cand-6",
    candidateName: "Sneha Nair",
    roll: "22AD032",
    department: "Artificial Intelligence & Data Science",
    college: "Anna Institute of Technology",
    roleRequisition: "Data Analyst",
    stage: "Technical Assessment",
    assessmentScore: 88,
    readiness: 93,
    notes: "Completed advanced SQL and Pandas coding test. Awaiting recruiter review for final interview.",
    shortlistedAt: "2026-10-12T14:00:00.000Z",
    updatedAt: "2026-10-19T11:00:00.000Z",
    interviewsCount: 0,
  },
];

const INITIAL_INTERVIEWS: InterviewScheduleItem[] = [
  {
    id: "int-1",
    shortlistId: "short-1",
    candidateId: "cand-1",
    candidateName: "Divya Raman",
    roll: "22BM112",
    roleRequisition: "AI / ML Engineer",
    round: "Technical Round 1",
    dateTime: "Today, 10:00 AM",
    durationMinutes: 60,
    panelists: "Dr. A. Vignesh (Staff AI Scientist), Vikram S.",
    meetingLink: "https://meet.google.com/xyz-technova-eval",
    location: "Online Video / Room 204",
    status: "Scheduled",
    feedbackScore: 0,
    recommendation: "Pending Evaluation",
    feedbackNotes: "",
  },
  {
    id: "int-2",
    shortlistId: "short-2",
    candidateId: "cand-2",
    candidateName: "Karthik Iyer",
    roll: "22CS104",
    roleRequisition: "SDE-1 (Full Stack)",
    round: "System Design & Coding",
    dateTime: "Today, 02:30 PM",
    durationMinutes: 45,
    panelists: "Rahul Sharma (VP Engineering), Meenakshi T.",
    meetingLink: "https://meet.google.com/abc-technova-live",
    location: "Online Video / Room 204",
    status: "Scheduled",
    feedbackScore: 0,
    recommendation: "Pending Evaluation",
    feedbackNotes: "",
  },
  {
    id: "int-3",
    shortlistId: "short-3",
    candidateId: "cand-3",
    candidateName: "R. Priyadarshini",
    roll: "21IT089",
    roleRequisition: "Backend & Cloud Engineer",
    round: "Leadership & Offer Discussion",
    dateTime: "Tomorrow, 11:00 AM",
    durationMinutes: 30,
    panelists: "Anandhi Subramanian (Head of Talent & People)",
    meetingLink: "https://meet.google.com/rec-offer-round",
    location: "Campus Placement Executive Suite",
    status: "Scheduled",
    feedbackScore: 95,
    recommendation: "Strong Hire",
    feedbackNotes: "Outstanding cultural and technical alignment. Term sheet accepted.",
  },
];

interface RecruiterStoreState {
  candidates: CandidateProfile[];
  shortlists: ShortlistCandidate[];
  interviews: InterviewScheduleItem[];
}

const recruiterStore = sharedState<RecruiterStoreState>("campus.recruiter.store.v1", () => ({
  candidates: [...INITIAL_CANDIDATES],
  shortlists: [...INITIAL_SHORTLISTS],
  interviews: [...INITIAL_INTERVIEWS],
}));

export async function searchCandidates(
  session: SessionPayload,
  filter?: {
    q?: string;
    department?: string;
    skill?: string;
    minReadiness?: number;
    minCgpa?: number;
  }
): Promise<TalentSearchOverview> {
  const candidates = recruiterStore.candidates;
  const shortlists = recruiterStore.shortlists;

  // Update candidate status based on shortlists
  const updatedCandidates = candidates.map((c: CandidateProfile) => {
    const matchingShortlists = shortlists.filter((s: ShortlistCandidate) => s.candidateId === c.id);
    return {
      ...c,
      status: (matchingShortlists.length > 0 ? "Shortlisted" : "Available") as "Available" | "Shortlisted",
      activeShortlistCount: matchingShortlists.length,
    };
  });

  let filtered = [...updatedCandidates];

  if (filter?.department && filter.department !== "All") {
    filtered = filtered.filter((c: CandidateProfile) => c.department.toLowerCase().includes(filter.department!.toLowerCase()));
  }

  if (filter?.skill && filter.skill !== "All") {
    filtered = filtered.filter((c: CandidateProfile) => c.skills.some((s: string) => s.toLowerCase() === filter.skill!.toLowerCase()));
  }

  if (filter?.minReadiness && filter.minReadiness > 0) {
    filtered = filtered.filter((c: CandidateProfile) => c.readiness >= filter.minReadiness!);
  }

  if (filter?.minCgpa && filter.minCgpa > 0) {
    filtered = filtered.filter((c: CandidateProfile) => c.cgpa >= filter.minCgpa!);
  }

  if (filter?.q && filter.q.trim()) {
    const q = filter.q.trim().toLowerCase();
    filtered = filtered.filter(
      (c: CandidateProfile) =>
        c.name.toLowerCase().includes(q) ||
        c.roll.toLowerCase().includes(q) ||
        c.department.toLowerCase().includes(q) ||
        c.projectTitle.toLowerCase().includes(q) ||
        c.skills.some((s: string) => s.toLowerCase().includes(q))
    );
  }

  const highReadinessCount = updatedCandidates.filter((c: CandidateProfile) => c.readiness >= 90).length;
  const shortlistedCount = updatedCandidates.filter((c: CandidateProfile) => c.status === "Shortlisted").length;

  return {
    totalCandidates: updatedCandidates.length,
    highReadinessCount,
    availableForHireCount: updatedCandidates.length - shortlistedCount,
    shortlistedCount,
    candidates: filtered,
  };
}

export async function getShortlistsOverview(
  session: SessionPayload,
  roleFilter?: string
): Promise<ShortlistsOverview> {
  const list = recruiterStore.shortlists;
  const interviews = recruiterStore.interviews;

  const enriched = list.map((s: ShortlistCandidate) => ({
    ...s,
    interviewsCount: interviews.filter((i: InterviewScheduleItem) => i.shortlistId === s.id).length,
  }));

  const filtered = roleFilter && roleFilter !== "All"
    ? enriched.filter((s) => s.roleRequisition === roleFilter)
    : enriched;

  return {
    totalShortlisted: filtered.length,
    inAssessmentCount: filtered.filter((s) => s.stage === "Technical Assessment").length,
    inInterviewCount: filtered.filter((s) => s.stage === "Technical Interview" || s.stage === "HR Round").length,
    offersExtendedCount: filtered.filter((s) => s.stage === "Offer Extended" || s.stage === "Hired").length,
    shortlists: filtered,
  };
}

export async function createShortlist(
  session: SessionPayload,
  input: CreateShortlistInput
): Promise<ShortlistCandidate> {
  const candidates = recruiterStore.candidates;
  const shortlists = recruiterStore.shortlists;

  const cand = candidates.find((c: CandidateProfile) => c.id === input.candidateId);
  if (!cand) throw new Error("Candidate not found");

  const newShortlist: ShortlistCandidate = {
    id: `short-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    candidateId: cand.id,
    candidateName: cand.name,
    roll: cand.roll,
    department: cand.department,
    college: cand.college,
    roleRequisition: input.roleRequisition,
    stage: "Shortlisted",
    assessmentScore: 0,
    readiness: cand.readiness,
    notes: input.notes || "Shortlisted from Talent Search portal",
    shortlistedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    interviewsCount: 0,
  };

  shortlists.unshift(newShortlist);

  cand.status = "Shortlisted";
  cand.activeShortlistCount = (cand.activeShortlistCount || 0) + 1;

  return newShortlist;
}

export async function updateShortlistStage(
  session: SessionPayload,
  id: string,
  input: UpdateShortlistStageInput
): Promise<ShortlistCandidate | null> {
  const shortlists = recruiterStore.shortlists;
  const item = shortlists.find((s: ShortlistCandidate) => s.id === id);
  if (!item) return null;

  item.stage = input.stage;
  if (input.assessmentScore !== undefined) item.assessmentScore = input.assessmentScore;
  if (input.notes !== undefined) item.notes = input.notes;
  item.updatedAt = new Date().toISOString();

  return item;
}

export async function deleteShortlist(
  session: SessionPayload,
  id: string
): Promise<boolean> {
  const shortlists = recruiterStore.shortlists;
  const idx = shortlists.findIndex((s: ShortlistCandidate) => s.id === id);
  if (idx === -1) return false;

  const [removed] = shortlists.splice(idx, 1);

  // Recalibrate candidate status
  if (removed) {
    const candidates = recruiterStore.candidates;
    const cand = candidates.find((c: CandidateProfile) => c.id === removed.candidateId);
    if (cand) {
      const remaining = shortlists.filter((s: ShortlistCandidate) => s.candidateId === cand.id);
      cand.status = remaining.length > 0 ? "Shortlisted" : "Available";
      cand.activeShortlistCount = remaining.length;
    }
  }

  return true;
}

export async function getInterviewsOverview(
  session: SessionPayload,
  filter?: { status?: string; round?: string }
): Promise<InterviewsOverview> {
  let list = recruiterStore.interviews;

  if (filter?.status && filter.status !== "All") {
    list = list.filter((i: InterviewScheduleItem) => i.status === filter.status);
  }
  if (filter?.round && filter.round !== "All") {
    list = list.filter((i: InterviewScheduleItem) => i.round === filter.round);
  }

  const all = recruiterStore.interviews;
  const upcomingTodayCount = all.filter((i: InterviewScheduleItem) => i.dateTime.toLowerCase().includes("today") && i.status === "Scheduled").length;
  const thisWeekCount = all.filter((i: InterviewScheduleItem) => i.status === "Scheduled").length;
  const completedCount = all.filter((i: InterviewScheduleItem) => i.status === "Completed").length;
  const pendingFeedbackCount = all.filter((i: InterviewScheduleItem) => i.status === "Completed" && i.recommendation === "Pending Evaluation").length;

  return {
    upcomingTodayCount,
    thisWeekCount,
    completedCount,
    pendingFeedbackCount,
    interviews: list,
  };
}

export async function scheduleInterview(
  session: SessionPayload,
  input: ScheduleInterviewInput
): Promise<InterviewScheduleItem> {
  const shortlists = recruiterStore.shortlists;
  const target = shortlists.find((s: ShortlistCandidate) => s.id === input.shortlistId);
  if (!target) throw new Error("Shortlisted candidate requisition not found");

  const interviews = recruiterStore.interviews;

  const newInterview: InterviewScheduleItem = {
    id: `int-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    shortlistId: target.id,
    candidateId: target.candidateId,
    candidateName: target.candidateName,
    roll: target.roll,
    roleRequisition: target.roleRequisition,
    round: input.round,
    dateTime: input.dateTime,
    durationMinutes: input.durationMinutes || 45,
    panelists: input.panelists,
    meetingLink: input.meetingLink || "https://meet.google.com/technova-live-eval",
    location: input.location || "Placement Interview Room 204",
    status: "Scheduled",
    feedbackScore: 0,
    recommendation: "Pending Evaluation",
    feedbackNotes: "",
  };

  interviews.unshift(newInterview);

  // Update shortlist stage to interview
  if (target.stage === "Shortlisted" || target.stage === "Technical Assessment") {
    target.stage = input.round.includes("HR") ? "HR Round" : "Technical Interview";
    target.updatedAt = new Date().toISOString();
  }

  return newInterview;
}

export async function updateInterviewFeedback(
  session: SessionPayload,
  id: string,
  input: SubmitInterviewFeedbackInput
): Promise<InterviewScheduleItem | null> {
  const interviews = recruiterStore.interviews;
  const item = interviews.find((i: InterviewScheduleItem) => i.id === id);
  if (!item) return null;

  item.feedbackScore = input.feedbackScore;
  item.recommendation = input.recommendation;
  item.feedbackNotes = input.feedbackNotes;
  item.status = input.status || "Completed";

  // If hire recommendation, advance candidate in shortlist
  if (input.recommendation === "Strong Hire" || input.recommendation === "Hire") {
    const shortlists = recruiterStore.shortlists;
    const sh = shortlists.find((s: ShortlistCandidate) => s.id === item.shortlistId);
    if (sh && sh.stage !== "Hired") {
      sh.stage = item.round.includes("Leadership") || item.round.includes("HR") ? "Offer Extended" : "HR Round";
      sh.assessmentScore = Math.max(sh.assessmentScore, input.feedbackScore);
      sh.notes = `Interview outcome: ${input.recommendation} (${input.feedbackScore}/100). ${input.feedbackNotes.slice(0, 80)}`;
      sh.updatedAt = new Date().toISOString();
    }
  }

  return item;
}

export async function cancelInterview(
  session: SessionPayload,
  id: string
): Promise<boolean> {
  const interviews = recruiterStore.interviews;
  const item = interviews.find((i: InterviewScheduleItem) => i.id === id);
  if (!item) return false;

  item.status = "Cancelled";
  return true;
}

