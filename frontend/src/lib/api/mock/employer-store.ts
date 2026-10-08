import "server-only";
import { randomUUID } from "node:crypto";
import type { SessionPayload } from "@/lib/auth/session";
import type { EmployerBody, EmployerItem } from "@/lib/api/employer-schemas";
import { sharedState } from "./global-state";

export type EmployerRow = EmployerItem;

export interface EmployerStore {
  list(s: SessionPayload): Promise<EmployerRow[]>;
  get(s: SessionPayload, id: string): Promise<EmployerRow | undefined>;
  create(s: SessionPayload, b: EmployerBody): Promise<EmployerRow>;
  update(s: SessionPayload, id: string, b: EmployerBody): Promise<EmployerRow | undefined>;
  remove(s: SessionPayload, id: string): Promise<boolean>;
}

const INITIAL_SEEDED_EMPLOYERS: Array<Omit<EmployerBody, ""> & { company: string }> = [
  {
    company: "Google India",
    sector: "Product & Tech",
    tier: "Tier-1 Partner",
    website: "https://careers.google.com",
    location: "Bengaluru, Karnataka",
    contactName: "Anandita Sen",
    contactDesignation: "Head of University Relations - APAC",
    contactEmail: "anandita.sen@google.com",
    contactPhone: "+91 98840 12345",
    contactLinkedin: "https://linkedin.com/in/anandita-sen-google",
    mouStatus: "Active MoU",
    mouValidUntil: "2027-06-30",
    totalHires: 22,
    averagePackage: 24.5,
    highestPackage: 32.5,
    lastDriveDate: "2025-10-20",
    nextDriveDate: "2026-10-25",
    notes: "Core Tier-1 hiring partner since 2018. Annual high-cadence recruitment for SDE-1, Cloud engineering, and summer research interns. Offers student sponsorship for research symposiums.",
  },
  {
    company: "Microsoft Corporation",
    sector: "Product & Tech",
    tier: "Tier-1 Partner",
    website: "https://careers.microsoft.com",
    location: "Hyderabad, Telangana",
    contactName: "Rohan Mehra",
    contactDesignation: "Lead University Talent Acquisition",
    contactEmail: "rohan.mehra@microsoft.com",
    contactPhone: "+91 98401 56789",
    contactLinkedin: "https://linkedin.com/in/rohan-mehra-talent",
    mouStatus: "Active MoU",
    mouValidUntil: "2027-12-31",
    totalHires: 34,
    averagePackage: 21.0,
    highestPackage: 26.0,
    lastDriveDate: "2025-11-12",
    nextDriveDate: "2026-11-05",
    notes: "Strategic alliance partner. Coordinates Azure cloud computing workshops, hackathons, and final-year campus drives. Hiring spans software engineers and devops architects.",
  },
  {
    company: "Zoho Corporation",
    sector: "IT & Software",
    tier: "Preferred Recruiter",
    website: "https://www.zoho.com/careers",
    location: "Chennai, Tamil Nadu",
    contactName: "Priyadarshini K.",
    contactDesignation: "University Relations Specialist",
    contactEmail: "priyadarshini.k@zohocorp.com",
    contactPhone: "+91 97910 23456",
    contactLinkedin: "https://linkedin.com/in/priyadarshini-zoho",
    mouStatus: "Active MoU",
    mouValidUntil: "2028-03-31",
    totalHires: 68,
    averagePackage: 7.8,
    highestPackage: 9.5,
    lastDriveDate: "2026-09-28",
    nextDriveDate: "",
    notes: "Strong institutional ties with campus incubation and placement cell. Focuses on in-depth problem solving and software architecture fundamentals. Regularly visits for Marquee day hiring.",
  },
  {
    company: "Amazon AWS",
    sector: "Product & Tech",
    tier: "Tier-1 Partner",
    website: "https://amazon.jobs",
    location: "Bengaluru, Karnataka",
    contactName: "Vikramaditya Nair",
    contactDesignation: "Senior Talent Acquisition Specialist",
    contactEmail: "vnair-recruiting@amazon.com",
    contactPhone: "+91 98412 87654",
    contactLinkedin: "https://linkedin.com/in/vikram-nair-amazon",
    mouStatus: "Active MoU",
    mouValidUntil: "2027-08-15",
    totalHires: 28,
    averagePackage: 15.0,
    highestPackage: 18.0,
    lastDriveDate: "2025-10-14",
    nextDriveDate: "2026-10-18",
    notes: "Pool campus and on-campus recruitment for Cloud Support Associates, Systems Engineers, and solutions architecture trainees.",
  },
  {
    company: "Tata Consultancy Services (TCS)",
    sector: "IT & Software",
    tier: "Preferred Recruiter",
    website: "https://www.tcs.com/careers",
    location: "Chennai, Tamil Nadu",
    contactName: "Suresh Raman",
    contactDesignation: "Regional Head - Campus Hiring",
    contactEmail: "suresh.raman@tcs.com",
    contactPhone: "+91 94440 98765",
    contactLinkedin: "https://linkedin.com/in/suresh-raman-tcs",
    mouStatus: "Active MoU",
    mouValidUntil: "2028-08-31",
    totalHires: 142,
    averagePackage: 8.2,
    highestPackage: 11.0,
    lastDriveDate: "2026-09-15",
    nextDriveDate: "",
    notes: "Consistently highest volume recruiter across Ninja, Digital, and Prime engineering cadences. Provides curriculum alignment feedback for enterprise computing and cybersecurity.",
  },
  {
    company: "L&T Technology Services",
    sector: "Core Engineering",
    tier: "Active",
    website: "https://www.ltts.com",
    location: "Vadodara / Chennai",
    contactName: "Divya Sundaram",
    contactDesignation: "Head - Early Careers Recruiting",
    contactEmail: "divya.sundaram@ltts.com",
    contactPhone: "+91 98841 34567",
    contactLinkedin: "https://linkedin.com/in/divya-sundaram-ltts",
    mouStatus: "Active MoU",
    mouValidUntil: "2026-11-30",
    totalHires: 45,
    averagePackage: 6.8,
    highestPackage: 8.5,
    lastDriveDate: "2025-11-20",
    nextDriveDate: "2026-11-15",
    notes: "Key employer for core engineering departments (ECE, EEE, Mechanical). Offers 6-month industrial internships and full-time engineering contracts.",
  },
  {
    company: "Goldman Sachs",
    sector: "BFSI & Fintech",
    tier: "Tier-1 Partner",
    website: "https://www.goldmansachs.com/careers",
    location: "Bengaluru, Karnataka",
    contactName: "Neil Fernandes",
    contactDesignation: "Vice President - University Relations",
    contactEmail: "neil.fernandes@gs.com",
    contactPhone: "+91 99801 43210",
    contactLinkedin: "https://linkedin.com/in/neil-fernandes-gs",
    mouStatus: "Under Renewal",
    mouValidUntil: "2026-12-31",
    totalHires: 16,
    averagePackage: 22.0,
    highestPackage: 28.0,
    lastDriveDate: "2025-09-22",
    nextDriveDate: "",
    notes: "Premier financial engineering & quant technology recruiter. High bar on algorithmic problem solving, probability, and database internals.",
  },
  {
    company: "Freshworks",
    sector: "Product & Tech",
    tier: "Active",
    website: "https://www.freshworks.com/company/careers",
    location: "Chennai, Tamil Nadu",
    contactName: "Kavitha S.",
    contactDesignation: "Talent Acquisition Lead",
    contactEmail: "kavitha.s@freshworks.com",
    contactPhone: "+91 98402 76543",
    contactLinkedin: "https://linkedin.com/in/kavitha-freshworks",
    mouStatus: "Active MoU",
    mouValidUntil: "2027-04-30",
    totalHires: 19,
    averagePackage: 11.5,
    highestPackage: 14.0,
    lastDriveDate: "2025-10-30",
    nextDriveDate: "",
    notes: "SaaS product engineering, full-stack web application development, and product design recruitment.",
  },
];

const memRows = sharedState("employers.rows", () => new Map<string, EmployerRow>());

function ensureSeed(collegeId: string) {
  if (process.env.VITEST) return;
  const existing = [...memRows.values()].filter((r) => r.collegeId === collegeId);
  if (existing.length === 0) {
    const now = new Date().toISOString();
    for (const data of INITIAL_SEEDED_EMPLOYERS) {
      const id = randomUUID();
      memRows.set(id, {
        ...structuredClone(data),
        id,
        collegeId,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}

export const employerStore: EmployerStore = {
  async list(s: SessionPayload) {
    ensureSeed(s.college);
    return [...memRows.values()]
      .filter((r) => r.collegeId === s.college)
      .map((r) => structuredClone(r))
      .sort((a, b) => b.totalHires - a.totalHires || a.company.localeCompare(b.company));
  },

  async get(s: SessionPayload, id: string) {
    ensureSeed(s.college);
    const r = memRows.get(id);
    return r && r.collegeId === s.college ? structuredClone(r) : undefined;
  },

  async create(s: SessionPayload, b: EmployerBody) {
    const now = new Date().toISOString();
    const id = randomUUID();
    const row: EmployerRow = {
      ...structuredClone(b),
      id,
      collegeId: s.college,
      createdAt: now,
      updatedAt: now,
    };
    memRows.set(id, row);
    return structuredClone(row);
  },

  async update(s: SessionPayload, id: string, b: EmployerBody) {
    const r = memRows.get(id);
    if (!r || r.collegeId !== s.college) return undefined;
    const updated: EmployerRow = {
      ...r,
      ...structuredClone(b),
      updatedAt: new Date().toISOString(),
    };
    memRows.set(id, updated);
    return structuredClone(updated);
  },

  async remove(s: SessionPayload, id: string) {
    const r = memRows.get(id);
    if (!r || r.collegeId !== s.college) return false;
    return memRows.delete(id);
  },
};

/** Test helper: forgets everything (memory backend only). */
export function resetEmployersMemory() {
  memRows.clear();
}
