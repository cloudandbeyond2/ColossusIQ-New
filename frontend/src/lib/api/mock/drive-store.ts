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
const rows = sharedState("drives.rows", () => new Map<string, Mem>());
const out = (x: Mem): DriveRow => {
  const { college, ...rest } = x;
  void college;
  return structuredClone(rest);
};
const soonest = (a: DriveRow, b: DriveRow) => a.date.localeCompare(b.date) || a.company.localeCompare(b.company);

const memoryDrives: DriveStore = {
  async list(s) {
    return [...rows.values()].filter((x) => x.college === s.college).map(out).sort(soonest);
  },
  async get(s, id) {
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
