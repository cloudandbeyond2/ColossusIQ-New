import "server-only";
import { randomUUID } from "node:crypto";
import { dataBackend } from "@/lib/data";
import type { SessionPayload } from "@/lib/auth/session";
import type { AwardRow } from "@/lib/api/certificate-schemas";
import { postgresCertificateDesk } from "@/lib/data/postgres/certificate-desk";
import { sharedState } from "./global-state";

/*
 * The Principal's certificate design (one per college) and the register of Principal-issued certificates (awards,
 * including requests from faculty). In memory for the demo backend, PostgreSQL otherwise
 * (data/postgres/certificate-desk.ts). Session methods only ever see the session's college; the two lookups by public
 * id / college serve the public verification page.
 */

export interface AwardRecord extends AwardRow {
  collegeId: string;
  signature: string;
  /** Who raised it (to show faculty their own requests). */
  requestedBySub: string;
}
export interface StoredProfile {
  data: unknown;
  updatedBy: string;
  updatedAt: string;
}

export interface CertificateDeskStore {
  getProfile(s: SessionPayload): Promise<StoredProfile | undefined>;
  saveProfile(s: SessionPayload, data: unknown, by: string): Promise<StoredProfile>;
  listAwards(s: SessionPayload): Promise<AwardRecord[]>;
  getAward(s: SessionPayload, id: string): Promise<AwardRecord | undefined>;
  createAward(s: SessionPayload, rec: Omit<AwardRecord, "id" | "createdAt">): Promise<AwardRecord>;
  updateAward(s: SessionPayload, rec: AwardRecord): Promise<AwardRecord | undefined>;
  /** Public verification (any college). */
  findByPublicId(publicId: string): Promise<AwardRecord | undefined>;
  profileOf(collegeId: string): Promise<StoredProfile | undefined>;
}

const profiles = sharedState("certificate-desk.profiles", () => new Map<string, StoredProfile>());
const awards = sharedState("certificate-desk.awards", () => new Map<string, AwardRecord>());
const newest = (a: AwardRecord, b: AwardRecord) => b.createdAt.localeCompare(a.createdAt);

const memoryDesk: CertificateDeskStore = {
  async getProfile(s) {
    const p = profiles.get(s.college);
    return p ? structuredClone(p) : undefined;
  },
  async saveProfile(s, data, by) {
    const p: StoredProfile = { data: structuredClone(data), updatedBy: by, updatedAt: new Date().toISOString() };
    profiles.set(s.college, p);
    return structuredClone(p);
  },
  async listAwards(s) {
    return [...awards.values()].filter((a) => a.collegeId === s.college).map((a) => structuredClone(a)).sort(newest);
  },
  async getAward(s, id) {
    const a = awards.get(id);
    return a && a.collegeId === s.college ? structuredClone(a) : undefined;
  },
  async createAward(s, rec) {
    const a: AwardRecord = { ...structuredClone(rec), collegeId: s.college, id: randomUUID(), createdAt: new Date().toISOString() };
    awards.set(a.id, a);
    return structuredClone(a);
  },
  async updateAward(s, rec) {
    const a = awards.get(rec.id);
    if (!a || a.collegeId !== s.college) return undefined;
    awards.set(rec.id, { ...structuredClone(rec), collegeId: s.college });
    return structuredClone(awards.get(rec.id)!);
  },
  async findByPublicId(publicId) {
    const a = [...awards.values()].find((x) => x.publicId === publicId);
    return a ? structuredClone(a) : undefined;
  },
  async profileOf(collegeId) {
    const p = profiles.get(collegeId);
    return p ? structuredClone(p) : undefined;
  },
};

/** Test helper: forgets everything (memory backend only). */
export function resetCertificateDeskMemory() {
  profiles.clear();
  awards.clear();
}

export function certificateDeskStore(): CertificateDeskStore {
  return dataBackend() === "postgres" ? postgresCertificateDesk : memoryDesk;
}
