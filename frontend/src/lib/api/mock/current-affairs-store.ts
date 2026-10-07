import "server-only";
import { randomUUID } from "node:crypto";
import { dataBackend } from "@/lib/data";
import type { SessionPayload } from "@/lib/auth/session";
import type { CaBody } from "@/lib/api/exam-prep-schemas";
import { postgresCurrentAffairs } from "@/lib/data/postgres/current-affairs";
import { sharedState } from "./global-state";

/*
 * Current affairs items written by a college's staff. In memory for the demo backend, PostgreSQL otherwise
 * (data/postgres/current-affairs.ts). Every method takes the signed-in session first and only ever sees that
 * session's college.
 */

export interface CaRow extends CaBody {
  id: string;
  author: string;
  createdAt: string;
  updatedAt: string;
}

export interface CurrentAffairsStore {
  list(s: SessionPayload): Promise<CaRow[]>;
  get(s: SessionPayload, id: string): Promise<CaRow | undefined>;
  create(s: SessionPayload, b: CaBody): Promise<CaRow>;
  update(s: SessionPayload, id: string, b: CaBody): Promise<CaRow | undefined>;
  remove(s: SessionPayload, id: string): Promise<boolean>;
}

interface Mem extends CaRow {
  college: string;
}
const rows = sharedState("current-affairs.rows", () => new Map<string, Mem>());
const out = (x: Mem): CaRow => {
  const { college, ...rest } = x;
  void college;
  return structuredClone(rest);
};
export const newestFirst = (a: CaRow, b: CaRow) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);

const memoryCurrentAffairs: CurrentAffairsStore = {
  async list(s) {
    return [...rows.values()].filter((x) => x.college === s.college).map(out).sort(newestFirst);
  },
  async get(s, id) {
    const x = rows.get(id);
    return x && x.college === s.college ? out(x) : undefined;
  },
  async create(s, b) {
    const now = new Date().toISOString();
    const x: Mem = { ...structuredClone(b), id: randomUUID(), author: s.name, college: s.college, createdAt: now, updatedAt: now };
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
export function resetCurrentAffairsMemory() {
  rows.clear();
}

export function currentAffairsStore(): CurrentAffairsStore {
  return dataBackend() === "postgres" ? postgresCurrentAffairs : memoryCurrentAffairs;
}
