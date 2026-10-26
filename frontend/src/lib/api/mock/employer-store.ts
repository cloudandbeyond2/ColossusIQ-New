import "server-only";
import { randomUUID } from "node:crypto";
import type { SessionPayload } from "@/lib/auth/session";
import type { EmployerBody, EmployerItem } from "@/lib/api/employer-schemas";
import { dataBackend } from "@/lib/data";
import { postgresEmployers } from "@/lib/data/postgres/employers";
import { sharedState } from "./global-state";

export type EmployerRow = EmployerItem;

export interface EmployerStore {
  list(s: SessionPayload): Promise<EmployerRow[]>;
  get(s: SessionPayload, id: string): Promise<EmployerRow | undefined>;
  create(s: SessionPayload, b: EmployerBody): Promise<EmployerRow>;
  update(s: SessionPayload, id: string, b: EmployerBody): Promise<EmployerRow | undefined>;
  remove(s: SessionPayload, id: string): Promise<boolean>;
}

const memRows = sharedState("employers.rows", () => new Map<string, EmployerRow>());

const memoryEmployers: EmployerStore = {
  async list(s: SessionPayload) {
    return [...memRows.values()]
      .filter((r) => r.collegeId === s.college)
      .map((r) => structuredClone(r))
      .sort((a, b) => b.totalHires - a.totalHires || a.company.localeCompare(b.company));
  },

  async get(s: SessionPayload, id: string) {
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

/** Memory for the demo backend, PostgreSQL otherwise. Starts empty: every employer is one the placement office added. */
export const employerStore: EmployerStore = {
  list: (s) => (dataBackend() === "postgres" ? postgresEmployers : memoryEmployers).list(s),
  get: (s, id) => (dataBackend() === "postgres" ? postgresEmployers : memoryEmployers).get(s, id),
  create: (s, b) => (dataBackend() === "postgres" ? postgresEmployers : memoryEmployers).create(s, b),
  update: (s, id, b) => (dataBackend() === "postgres" ? postgresEmployers : memoryEmployers).update(s, id, b),
  remove: (s, id) => (dataBackend() === "postgres" ? postgresEmployers : memoryEmployers).remove(s, id),
};
