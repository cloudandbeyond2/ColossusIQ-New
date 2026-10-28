import "server-only";
import { randomUUID } from "node:crypto";
import { dataBackend } from "@/lib/data";
import { postgresClinical } from "@/lib/data/postgres/clinical";
import { sharedState } from "./global-state";

export type CaseStatus = "Pending" | "Approved" | "Rejected";
export type SkillStatus = "Pending Review" | "Certified" | "Rejected";
export type SkillLevel = "Shows How" | "Performs";

export interface ClinicalCase {
  id: string;
  bed: string;
  patient: string;
  diagnosis: string;
  complaints: string;
  /** ISO day, e.g. 2026-10-21 */
  date: string;
  status: CaseStatus;
  faculty: string;
  studentName: string;
  studentSub: string;
  verifiedBy: string;
}

export interface ClinicalSkill {
  id: string;
  code: string;
  name: string;
  level: SkillLevel;
  status: SkillStatus;
  notes: string;
  supervisor: string;
  studentName: string;
  studentSub: string;
  /** ISO day the procedure was performed */
  date: string;
  certifier: string;
}

export interface NewCase {
  studentSub: string;
  studentName: string;
  bed: string;
  patient: string;
  diagnosis: string;
  complaints: string;
  faculty: string;
  status: "Pending" | "Approved";
  verifiedBy: string;
}

export interface NewSkill {
  studentSub: string;
  studentName: string;
  code: string;
  name: string;
  level: SkillLevel;
  notes: string;
  supervisor: string;
}

/** `college` is a public college id; null means every college (Super Admin). `studentSub` limits to one student's rows. */
export interface ClinicalData {
  cases(college: string | null, studentSub?: string): Promise<ClinicalCase[]>;
  addCase(college: string, input: NewCase): Promise<ClinicalCase>;
  decideCase(college: string | null, id: string, status: "Approved" | "Rejected", by: string): Promise<ClinicalCase | null>;
  skills(college: string | null, studentSub?: string): Promise<ClinicalSkill[]>;
  addSkill(college: string, input: NewSkill): Promise<ClinicalSkill>;
  decideSkill(college: string | null, id: string, status: "Certified" | "Rejected", by: string): Promise<ClinicalSkill | null>;
}

interface MemCase extends ClinicalCase {
  college: string;
}
interface MemSkill extends ClinicalSkill {
  college: string;
}
interface Mem {
  cases: Map<string, MemCase>;
  skills: Map<string, MemSkill>;
}

const mem = sharedState("clinical.entries", (): Mem => ({ cases: new Map(), skills: new Map() }));

export function resetClinicalMemory() {
  mem.cases.clear();
  mem.skills.clear();
}

const today = () => new Date().toISOString().slice(0, 10);
const strip = <T extends { college: string }>({ college: _c, ...rest }: T) => structuredClone(rest);

const memoryClinical: ClinicalData = {
  async cases(college, studentSub) {
    return [...mem.cases.values()]
      .filter((c) => (!college || c.college === college) && (!studentSub || c.studentSub === studentSub))
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(strip) as ClinicalCase[];
  },
  async addCase(college, input) {
    const row: MemCase = {
      id: randomUUID(), college, bed: input.bed, patient: input.patient, diagnosis: input.diagnosis, complaints: input.complaints,
      date: today(), status: input.status, faculty: input.faculty, studentName: input.studentName, studentSub: input.studentSub,
      verifiedBy: input.verifiedBy,
    };
    mem.cases.set(row.id, row);
    return strip(row) as ClinicalCase;
  },
  async decideCase(college, id, status, by) {
    const row = mem.cases.get(id);
    if (!row || (college && row.college !== college)) return null;
    row.status = status;
    row.verifiedBy = by;
    return strip(row) as ClinicalCase;
  },
  async skills(college, studentSub) {
    return [...mem.skills.values()]
      .filter((s) => (!college || s.college === college) && (!studentSub || s.studentSub === studentSub))
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(strip) as ClinicalSkill[];
  },
  async addSkill(college, input) {
    const row: MemSkill = {
      id: randomUUID(), college, code: input.code, name: input.name, level: input.level, status: "Pending Review", notes: input.notes,
      supervisor: input.supervisor, studentName: input.studentName, studentSub: input.studentSub, date: today(), certifier: "",
    };
    mem.skills.set(row.id, row);
    return strip(row) as ClinicalSkill;
  },
  async decideSkill(college, id, status, by) {
    const row = mem.skills.get(id);
    if (!row || (college && row.college !== college)) return null;
    row.status = status;
    row.certifier = by;
    return strip(row) as ClinicalSkill;
  },
};

export function clinicalData(): ClinicalData {
  return dataBackend() === "postgres" ? postgresClinical : memoryClinical;
}
