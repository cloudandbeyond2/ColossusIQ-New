import "server-only";
import type { SessionPayload } from "@/lib/auth/session";
import {
  type AssignMentorInput,
  type InviteMentorInput,
  type LogSessionInput,
  type MentorItem,
  type MentorNetworkOverview,
} from "@/lib/api/mentor-network-schemas";
import { sharedState } from "./global-state";

const INITIAL_MENTORS: MentorItem[] = [
  {
    id: "men-meena",
    name: "Dr. Meena Raghavan",
    designation: "Professor & Head, IoT & Embedded Systems Lab",
    company: "Anna Institute of Technology",
    type: "Faculty Specialist",
    expertise: ["AgriTech", "Embedded IoT", "Sensor Fusion", "Hardware Prototyping"],
    email: "meena.iot@ait.edu.in",
    phone: "+91 98401 23456",
    linkedinUrl: "https://linkedin.com/in/dr-meena-raghavan",
    availability: "Available",
    activeVenturesCount: 1,
    assignedVentures: [
      { ventureId: "ven-agrisoil", ventureName: "AgriSoil Sense", stage: "Validation" },
    ],
    sessionsCompleted: 14,
    rating: 4.9,
    joinedDate: "2024-06-15T00:00:00.000Z",
    status: "Active",
  },
  {
    id: "men-karthik",
    name: "Mr. Karthik Narayanan",
    designation: "VP Engineering · Alumnus (B.Tech '16)",
    company: "Razorpay",
    type: "Alumni Leader",
    expertise: ["FinTech & Web3", "Scalable Backend", "Payments", "System Design"],
    email: "karthik.n@alumni.ait.edu.in",
    phone: "+91 98840 98765",
    linkedinUrl: "https://linkedin.com/in/karthik-narayanan-tech",
    availability: "Available",
    activeVenturesCount: 1,
    assignedVentures: [
      { ventureId: "ven-cybershield", ventureName: "CyberShield Campus", stage: "Idea" },
    ],
    sessionsCompleted: 8,
    rating: 5.0,
    joinedDate: "2025-01-10T00:00:00.000Z",
    status: "Active",
  },
  {
    id: "men-vasanthi",
    name: "Dr. P. Vasanthi",
    designation: "Professor & Lead, Biomedical AI Diagnostics",
    company: "Anna Institute of Technology",
    type: "Faculty Specialist",
    expertise: ["HealthTech", "Medical Devices", "AI Vision Diagnostics", "Clinical Trials"],
    email: "vasanthi.bme@ait.edu.in",
    phone: "+91 94441 55667",
    linkedinUrl: "https://linkedin.com/in/dr-vasanthi-bme",
    availability: "Busy",
    activeVenturesCount: 1,
    assignedVentures: [
      { ventureId: "ven-mediscan", ventureName: "MediScan AI", stage: "Incubation Review" },
    ],
    sessionsCompleted: 19,
    rating: 4.8,
    joinedDate: "2023-11-20T00:00:00.000Z",
    status: "Active",
  },
  {
    id: "men-balaji",
    name: "Prof. R. Balaji",
    designation: "Founder & CTO, VoltDrive Technologies",
    company: "VoltDrive Tech",
    type: "Industry Founder",
    expertise: ["CleanTech & IoT", "EV Powertrains", "Battery BMS", "Robotics & Hardware"],
    email: "balaji@voltdrivetech.com",
    phone: "+91 98410 44332",
    linkedinUrl: "https://linkedin.com/in/r-balaji-ev",
    availability: "Available",
    activeVenturesCount: 2,
    assignedVentures: [
      { ventureId: "ven-greencharge", ventureName: "GreenCharge EV", stage: "Prototyping & Mentorship" },
      { ventureId: "ven-roboharvest", ventureName: "RoboHarvest", stage: "Incubated" },
    ],
    sessionsCompleted: 22,
    rating: 4.9,
    joinedDate: "2024-03-01T00:00:00.000Z",
    status: "Active",
  },
  {
    id: "men-sneha",
    name: "Ms. Sneha Chandran",
    designation: "Investment Partner, TANSIM Seed Fund",
    company: "TANSIM Seed Fund",
    type: "Investor / VC",
    expertise: ["Fundraising", "Pitch Deck", "Financial Modeling", "MSME Grants"],
    email: "sneha.c@tansimfund.tn.gov.in",
    phone: "+91 99400 11223",
    linkedinUrl: "https://linkedin.com/in/sneha-chandran-vc",
    availability: "Available",
    activeVenturesCount: 1,
    assignedVentures: [
      { ventureId: "ven-edututr", ventureName: "Edututr Vernacular", stage: "Incubated" },
    ],
    sessionsCompleted: 11,
    rating: 5.0,
    joinedDate: "2024-08-14T00:00:00.000Z",
    status: "Active",
  },
  {
    id: "men-ramanathan",
    name: "Adv. S. Ramanathan",
    designation: "Senior Patent Attorney & Startup IP Counsel",
    company: "LexInovate IP Law",
    type: "Legal & IP Expert",
    expertise: ["Patent Filing", "IP Due Diligence", "Trademark", "Founder Agreements"],
    email: "ramanathan@lexinovate.in",
    phone: "+91 98841 77889",
    linkedinUrl: "https://linkedin.com/in/adv-s-ramanathan-ip",
    availability: "Available",
    activeVenturesCount: 1,
    assignedVentures: [
      { ventureId: "ven-aquapure", ventureName: "AquaPure Nano", stage: "Business Model & MVP" },
    ],
    sessionsCompleted: 7,
    rating: 4.7,
    joinedDate: "2024-10-05T00:00:00.000Z",
    status: "Active",
  },
  {
    id: "men-vijay",
    name: "Mr. Vijay Anand",
    designation: "Managing Director, The Startup Centre",
    company: "The Startup Centre",
    type: "Industry Founder",
    expertise: ["Product Market Fit", "Customer Discovery", "B2B SaaS", "Go-To-Market"],
    email: "vijay@thestartupcentre.com",
    phone: "+91 98409 33221",
    linkedinUrl: "https://linkedin.com/in/vijayanand",
    availability: "Available",
    activeVenturesCount: 0,
    assignedVentures: [],
    sessionsCompleted: 15,
    rating: 5.0,
    joinedDate: "2023-09-01T00:00:00.000Z",
    status: "Active",
  },
];

const inMemoryMentors = sharedState("campus.incubation.mentors.v1", () => {
  const map = new Map<string, MentorItem[]>();
  map.set("COL-1001", [...INITIAL_MENTORS]);
  map.set("all", [...INITIAL_MENTORS]);
  return map;
});

function getCollegeId(session: SessionPayload): string {
  if (!session.college || session.college === "all") return "COL-1001";
  return session.college;
}

export async function getMentorNetworkOverview(session: SessionPayload): Promise<MentorNetworkOverview> {
  const collegeId = getCollegeId(session);
  let list = inMemoryMentors.get(collegeId);
  if (!list) {
    list = [...INITIAL_MENTORS];
    inMemoryMentors.set(collegeId, list);
  }

  const availableCount = list.filter((m) => m.availability === "Available").length;
  let activeAssignmentsCount = 0;
  let totalSessions = 0;
  let sumRating = 0;

  for (const m of list) {
    activeAssignmentsCount += m.assignedVentures.length;
    totalSessions += m.sessionsCompleted;
    sumRating += m.rating;
  }

  const averageRating = list.length ? Number((sumRating / list.length).toFixed(1)) : 5.0;

  return {
    totalMentors: list.length,
    availableCount,
    activeAssignmentsCount,
    totalSessionsConducted: totalSessions,
    averageRating,
    mentors: list,
  };
}

export async function inviteMentor(
  session: SessionPayload,
  input: InviteMentorInput
): Promise<MentorItem> {
  const collegeId = getCollegeId(session);
  const list = inMemoryMentors.get(collegeId) || [];

  const newMentor: MentorItem = {
    id: `men-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    name: input.name,
    designation: input.designation,
    company: input.company,
    type: input.type,
    expertise: input.expertise,
    email: input.email,
    phone: input.phone || "",
    linkedinUrl: input.linkedinUrl || "",
    availability: input.availability || "Available",
    activeVenturesCount: 0,
    assignedVentures: [],
    sessionsCompleted: 0,
    rating: 5.0,
    joinedDate: new Date().toISOString(),
    status: "Active",
  };

  list.unshift(newMentor);
  inMemoryMentors.set(collegeId, list);
  return newMentor;
}

export async function updateMentor(
  session: SessionPayload,
  mentorId: string,
  updates: Partial<MentorItem>
): Promise<MentorItem | null> {
  const collegeId = getCollegeId(session);
  const list = inMemoryMentors.get(collegeId) || [];
  const mentor = list.find((m) => m.id === mentorId);
  if (!mentor) return null;

  Object.assign(mentor, updates);
  mentor.activeVenturesCount = mentor.assignedVentures.length;
  return mentor;
}

export async function assignMentorToVenture(
  session: SessionPayload,
  mentorId: string,
  input: AssignMentorInput
): Promise<MentorItem | null> {
  const collegeId = getCollegeId(session);
  const list = inMemoryMentors.get(collegeId) || [];
  const mentor = list.find((m) => m.id === mentorId);
  if (!mentor) return null;

  // Check if venture is already assigned to this mentor
  const exists = mentor.assignedVentures.some((v) => v.ventureId === input.ventureId);
  if (!exists) {
    mentor.assignedVentures.push({
      ventureId: input.ventureId,
      ventureName: input.ventureName,
      stage: input.stage,
    });
    mentor.activeVenturesCount = mentor.assignedVentures.length;
  }

  return mentor;
}

export async function unassignMentorFromVenture(
  session: SessionPayload,
  mentorId: string,
  ventureId: string
): Promise<MentorItem | null> {
  const collegeId = getCollegeId(session);
  const list = inMemoryMentors.get(collegeId) || [];
  const mentor = list.find((m) => m.id === mentorId);
  if (!mentor) return null;

  mentor.assignedVentures = mentor.assignedVentures.filter((v) => v.ventureId !== ventureId);
  mentor.activeVenturesCount = mentor.assignedVentures.length;
  return mentor;
}

export async function logMentorshipSession(
  session: SessionPayload,
  mentorId: string,
  _input: LogSessionInput
): Promise<MentorItem | null> {
  const collegeId = getCollegeId(session);
  const list = inMemoryMentors.get(collegeId) || [];
  const mentor = list.find((m) => m.id === mentorId);
  if (!mentor) return null;

  mentor.sessionsCompleted += 1;
  return mentor;
}

export async function deleteMentor(
  session: SessionPayload,
  mentorId: string
): Promise<boolean> {
  const collegeId = getCollegeId(session);
  const list = inMemoryMentors.get(collegeId) || [];
  const idx = list.findIndex((m) => m.id === mentorId);
  if (idx === -1) return false;

  list.splice(idx, 1);
  inMemoryMentors.set(collegeId, list);
  return true;
}
