import "server-only";
import { randomUUID } from "node:crypto";
import { dataBackend } from "@/lib/data";
import type { SessionPayload } from "@/lib/auth/session";
import type { DriveBody } from "@/lib/api/drive-schemas";
import { postgresDrives } from "@/lib/data/postgres/drives";
import { sharedState } from "./global-state";

/*
 * Placement drives: in memory for the demo backend, PostgreSQL otherwise (data/postgres/drives.ts). Every method takes
 * the signed-in session first and only ever sees that session's college.
 */

export interface DriveRow extends DriveBody {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface DriveStore {
  list(s: SessionPayload): Promise<DriveRow[]>;
  get(s: SessionPayload, id: string): Promise<DriveRow | undefined>;
  create(s: SessionPayload, b: DriveBody): Promise<DriveRow>;
  update(s: SessionPayload, id: string, b: DriveBody): Promise<DriveRow | undefined>;
  remove(s: SessionPayload, id: string): Promise<boolean>;
}

interface Mem extends DriveRow {
  college: string;
}
const INITIAL_SEEDED_DRIVES: DriveBody[] = [
  {
    company: "Google India",
    role: "Software Development Engineer (SDE-1)",
    type: "On-campus",
    date: "2026-10-25",
    time: "09:30",
    venue: "Sir CV Raman Auditorium, Academic Block 1",
    packageMin: 18.0,
    packageMax: 32.5,
    openings: 8,
    departments: ["Computer Science & Engineering", "Artificial Intelligence & Data Science"],
    minReadiness: 75,
    deadline: "2026-10-22",
    description: "Google campus recruitment drive for final year B.Tech/M.Tech students. Role involves building scalable backend services and distributed infrastructure. Criteria: Minimum 7.5 CGPA, zero active backlogs.",
    rounds: ["Online Coding Assessment", "Technical Interview - DSA", "System Design & Problem Solving", "Googliness & Leadership"],
    status: "Open",
    registered: 48,
    shortlisted: 0,
    offers: 0,
  },
  {
    company: "Microsoft Corporation",
    role: "Cloud Solution & DevOps Engineer",
    type: "On-campus",
    date: "2026-11-05",
    time: "10:00",
    venue: "Virtual Interview Suite & Lab 3",
    packageMin: 16.0,
    packageMax: 26.0,
    openings: 12,
    departments: ["Computer Science & Engineering", "Electronics & Communication", "Artificial Intelligence & Data Science"],
    minReadiness: 70,
    deadline: "2026-11-01",
    description: "Microsoft Azure Engineering campus placement drive. Ideal candidates should demonstrate proficiency in cloud fundamentals, networking, containers, and modern CI/CD automation.",
    rounds: ["Online Aptitude & Code Test", "Technical Round 1", "Technical Round 2", "Managerial Interview"],
    status: "Open",
    registered: 65,
    shortlisted: 0,
    offers: 0,
  },
  {
    company: "Zoho Corporation",
    role: "Software Engineer",
    type: "On-campus",
    date: "2026-09-28",
    time: "09:00",
    venue: "Main Computing Center",
    packageMin: 6.5,
    packageMax: 9.0,
    openings: 25,
    departments: ["Computer Science & Engineering", "Electronics & Communication", "Mechanical Engineering"],
    minReadiness: 60,
    deadline: "2026-09-24",
    description: "Comprehensive product development role. Primary focus on problem solving, C/Java proficiency, and web application architecture.",
    rounds: ["Basic Programming & Aptitude", "Advanced Programming (Data Structures)", "Technical HR", "General HR"],
    status: "Completed",
    registered: 110,
    shortlisted: 32,
    offers: 18,
  },
  {
    company: "Amazon AWS",
    role: "Associate Cloud Support Engineer",
    type: "Pool campus",
    date: "2026-10-18",
    time: "11:00",
    venue: "Seminar Hall B & Online Proctoring",
    packageMin: 12.0,
    packageMax: 18.0,
    openings: 15,
    departments: ["Computer Science & Engineering", "Electronics & Communication"],
    minReadiness: 65,
    deadline: "2026-10-15",
    description: "Supporting enterprise AWS infrastructure across Linux, Networking, Database, and Storage domains. Excellent analytical thinking and troubleshooting mindset required.",
    rounds: ["Aptitude & Technical Screening", "Hands-on Troubleshooting Assessment", "Amazon Leadership Principles & Bar Raiser"],
    status: "Open",
    registered: 54,
    shortlisted: 0,
    offers: 0,
  },
  {
    company: "Tata Consultancy Services (TCS)",
    role: "Digital Innovator & Prime Engineer",
    type: "On-campus",
    date: "2026-09-15",
    time: "09:00",
    venue: "Auditorium & Distributed Labs",
    packageMin: 7.0,
    packageMax: 9.5,
    openings: 45,
    departments: ["Computer Science & Engineering", "Electronics & Communication", "Mechanical Engineering"],
    minReadiness: 50,
    deadline: "2026-09-10",
    description: "TCS Digital and Prime cadence hiring drive. High-performing students selected across enterprise modernization, AI, and cybersecurity initiatives.",
    rounds: ["TCS NQT Advanced Test", "Technical Interview", "Managerial & HR Evaluation"],
    status: "Completed",
    registered: 160,
    shortlisted: 58,
    offers: 28,
  },
  {
    company: "L&T Technology Services",
    role: "Embedded Systems & IoT Engineer",
    type: "On-campus",
    date: "2026-11-15",
    time: "10:30",
    venue: "Department Seminar Hall - ECE Block",
    packageMin: 5.5,
    packageMax: 8.0,
    openings: 20,
    departments: ["Electronics & Communication", "Mechanical Engineering"],
    minReadiness: 55,
    deadline: "2026-11-10",
    description: "Core engineering campus drive targeting smart devices, automotive electronics, and industrial IoT solutions. Strong foundation in microcontrollers and C/C++ expected.",
    rounds: ["Core Technical Written Test", "Practical Hardware/Simulation Round", "Technical & HR Interview"],
    status: "Draft",
    registered: 0,
    shortlisted: 0,
    offers: 0,
  },
];

const rows = sharedState("drives.rows", () => new Map<string, Mem>());

function ensureMemSeed(college: string) {
  if (process.env.VITEST) return;
  const existing = [...rows.values()].filter((x) => x.college === college);
  if (existing.length === 0) {
    const now = new Date().toISOString();
    for (const b of INITIAL_SEEDED_DRIVES) {
      const id = randomUUID();
      rows.set(id, { ...structuredClone(b), id, college, createdAt: now, updatedAt: now });
    }
  }
}

const out = (x: Mem): DriveRow => {
  const { college, ...rest } = x;
  void college;
  return structuredClone(rest);
};
const soonest = (a: DriveRow, b: DriveRow) => a.date.localeCompare(b.date) || a.company.localeCompare(b.company);

const memoryDrives: DriveStore = {
  async list(s) {
    ensureMemSeed(s.college);
    return [...rows.values()].filter((x) => x.college === s.college).map(out).sort(soonest);
  },
  async get(s, id) {
    ensureMemSeed(s.college);
    const x = rows.get(id);
    return x && x.college === s.college ? out(x) : undefined;
  },
  async create(s, b) {
    const now = new Date().toISOString();
    const x: Mem = { ...structuredClone(b), id: randomUUID(), college: s.college, createdAt: now, updatedAt: now };
    rows.set(x.id, x);
    return out(x);
  },
  async update(s, id, b) {
    const x = rows.get(id);
    if (!x || x.college !== s.college) return undefined;
    Object.assign(x, structuredClone(b), { updatedAt: new Date().toISOString() });
    return out(x);
  },
  async remove(s, id) {
    const x = rows.get(id);
    if (!x || x.college !== s.college) return false;
    return rows.delete(id);
  },
};

/** Test helper: forgets everything (memory backend only). */
export function resetDriveMemory() {
  rows.clear();
}

export function driveStore(): DriveStore {
  return dataBackend() === "postgres" ? postgresDrives : memoryDrives;
}
