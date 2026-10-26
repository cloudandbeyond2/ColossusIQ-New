import "server-only";
import { randomUUID } from "node:crypto";
import { dataBackend } from "@/lib/data";
import { postgresHospital } from "@/lib/data/postgres/hospital";
import { sharedState } from "./global-state";

/*
 * Teaching hospital records: wards/departments, dated census entries and the hospital's facility profile. In memory
 * for the demo backend, PostgreSQL otherwise (data/postgres/hospital.ts). `college` is the college's public id.
 */

export type HospitalCategory = "Medicine & Allied" | "Surgery & Allied" | "OBG & Paediatrics" | "Emergency & Critical Care";

export type DeptRow = {
  id: string;
  college: string;
  name: string;
  category: HospitalCategory;
  hod: string;
  teachingBeds: number;
  icuBeds: number;
  cbmeTargetCases: number;
  units: string[];
};
export type DeptDraft = Omit<DeptRow, "id">;
export type DeptPatch = Partial<Omit<DeptRow, "id" | "college">>;

export type CensusRow = {
  id: string;
  college: string;
  departmentId: string;
  occupiedBeds: number;
  icuOccupied: number;
  opd: number;
  ipdAdmissions: number;
  discharges: number;
  surgeries: number;
  deliveries: number;
  casesPerStudent: number | null;
  notes: string;
  actor: string;
  actorSub: string;
  createdAt: string;
};
export type CensusDraft = Omit<CensusRow, "id" | "createdAt">;

export type ProfileRow = {
  hospitalName: string;
  labTestsDaily: number | null;
  bloodWholeUnits: number | null;
  bloodComponentUnits: number | null;
  bloodBankLicensed: boolean;
};

export interface HospitalData {
  departments(college: string): Promise<DeptRow[]>;
  department(id: string): Promise<DeptRow | undefined>;
  /** undefined when the college already has a department with that name. */
  createDepartment(draft: DeptDraft): Promise<DeptRow | undefined>;
  updateDepartment(id: string, patch: DeptPatch): Promise<DeptRow | "duplicate" | undefined>;
  removeDepartment(id: string): Promise<boolean>;
  addCensus(draft: CensusDraft): Promise<CensusRow>;
  /** Census entries since the given instant, newest first. */
  census(college: string, sinceIso: string): Promise<CensusRow[]>;
  /** The most recent entry for each department, whenever it was recorded. */
  latestCensus(college: string): Promise<CensusRow[]>;
  profile(college: string): Promise<ProfileRow>;
  saveProfile(college: string, profile: ProfileRow): Promise<ProfileRow>;
}

export const EMPTY_PROFILE: ProfileRow = { hospitalName: "", labTestsDaily: null, bloodWholeUnits: null, bloodComponentUnits: null, bloodBankLicensed: false };

const copy = <T>(v: T): T => structuredClone(v);

const depts = sharedState("hospital.depts.v3", () => new Map<string, DeptRow>());
const census = sharedState("hospital.census.v3", () => new Map<string, CensusRow>());
const profiles = sharedState("hospital.profile.v3", () => new Map<string, ProfileRow>());

const nameTaken = (college: string, name: string, except?: string) =>
  [...depts.values()].some((d) => d.college === college && d.id !== except && d.name.toLowerCase() === name.toLowerCase());

const memoryHospital: HospitalData = {
  async departments(college) {
    return [...depts.values()].filter((d) => d.college === college).sort((a, b) => a.name.localeCompare(b.name)).map(copy);
  },
  async department(id) {
    const d = depts.get(id);
    return d ? copy(d) : undefined;
  },
  async createDepartment(draft) {
    if (nameTaken(draft.college, draft.name)) return undefined;
    const row: DeptRow = { ...copy(draft), id: randomUUID() };
    depts.set(row.id, row);
    return copy(row);
  },
  async updateDepartment(id, patch) {
    const d = depts.get(id);
    if (!d) return undefined;
    if (patch.name && nameTaken(d.college, patch.name, id)) return "duplicate";
    Object.assign(d, copy(patch));
    return copy(d);
  },
  async removeDepartment(id) {
    for (const [cid, c] of census) if (c.departmentId === id) census.delete(cid);
    return depts.delete(id);
  },
  async addCensus(draft) {
    const row: CensusRow = { ...copy(draft), id: randomUUID(), createdAt: new Date().toISOString() };
    census.set(row.id, row);
    return copy(row);
  },
  async census(college, sinceIso) {
    return [...census.values()].filter((c) => c.college === college && c.createdAt >= sinceIso).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(copy);
  },
  async latestCensus(college) {
    const latest = new Map<string, CensusRow>();
    for (const c of census.values()) {
      if (c.college !== college) continue;
      const cur = latest.get(c.departmentId);
      if (!cur || c.createdAt > cur.createdAt) latest.set(c.departmentId, c);
    }
    return [...latest.values()].map(copy);
  },
  async profile(college) {
    return copy(profiles.get(college) ?? EMPTY_PROFILE);
  },
  async saveProfile(college, profile) {
    profiles.set(college, copy(profile));
    return copy(profile);
  },
};

/** Test helper (memory backend only). */
export function resetHospitalMemory() {
  depts.clear();
  census.clear();
  profiles.clear();
}

export function hospitalData(): HospitalData {
  return dataBackend() === "postgres" ? postgresHospital : memoryHospital;
}
