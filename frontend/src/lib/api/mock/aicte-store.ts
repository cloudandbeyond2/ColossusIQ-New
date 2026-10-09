import "server-only";
import { z } from "zod";
import { dataBackend } from "@/lib/data";
import { postgresAicte } from "@/lib/data/postgres/aicte";
import { sharedState } from "./global-state";

/*
 * What the Principal records on the AICTE Compliance page, one document per college: the AICTE permanent id, the
 * status of each statutory committee, and the compliance action plan. In memory for the demo backend, PostgreSQL
 * otherwise (data/postgres/aicte.ts, table aicte_compliance). Everything else on the page is computed live.
 */

export const MAX_ACTIONS = 300;

export const StoredCommittee = z.object({
  status: z.string().max(40),
  chairperson: z.string().max(120),
  membersCount: z.number().int().min(0).max(60),
  lastMeetingDate: z.string().max(10),
  momStatus: z.string().max(40),
  updatedAt: z.string().max(40).default(""),
  updatedBy: z.string().max(120).default(""),
});
export type StoredCommittee = z.infer<typeof StoredCommittee>;

export const StoredAction = z.object({
  id: z.string().max(40),
  title: z.string().max(200),
  category: z.string().max(80),
  priority: z.enum(["High", "Medium", "Low"]),
  assignedTo: z.string().max(120),
  dueDate: z.string().max(10),
  status: z.enum(["Open", "In Progress", "Resolved"]),
  notes: z.string().max(500).default(""),
  createdAt: z.string().max(10),
  createdBy: z.string().max(120).default(""),
  resolvedAt: z.string().max(10).default(""),
});
export type StoredAction = z.infer<typeof StoredAction>;

export const AicteState = z.object({
  pid: z.string().max(40).default(""),
  committees: z.record(z.string(), StoredCommittee).default({}),
  actions: z.array(StoredAction).max(MAX_ACTIONS).default([]),
});
export type AicteState = z.infer<typeof AicteState>;

export const emptyAicteState = (): AicteState => ({ pid: "", committees: {}, actions: [] });

/** Reads whatever was stored and keeps only what is valid, so one bad row can never break the page. */
export function parseAicteState(raw: unknown): AicteState {
  const parsed = AicteState.safeParse(raw);
  if (parsed.success) return parsed.data;
  const o = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const committees: Record<string, StoredCommittee> = {};
  for (const [k, v] of Object.entries((o.committees ?? {}) as Record<string, unknown>)) {
    const c = StoredCommittee.safeParse(v);
    if (c.success) committees[k] = c.data;
  }
  const actions = (Array.isArray(o.actions) ? o.actions : []).flatMap((a) => {
    const r = StoredAction.safeParse(a);
    return r.success ? [r.data] : [];
  });
  return { pid: typeof o.pid === "string" ? o.pid.slice(0, 40) : "", committees, actions: actions.slice(0, MAX_ACTIONS) };
}

export interface AicteStore {
  get(collegeId: string): Promise<AicteState>;
  save(collegeId: string, state: AicteState, by: string): Promise<void>;
}

const rows = sharedState("aicte.rows", () => new Map<string, AicteState>());

const memoryAicte: AicteStore = {
  async get(collegeId) {
    const s = rows.get(collegeId);
    return s ? structuredClone(s) : emptyAicteState();
  },
  async save(collegeId, state) {
    rows.set(collegeId, structuredClone(state));
  },
};

/** Test helper (memory backend only). */
export function resetAicteMemory() {
  rows.clear();
}

export function aicteStore(): AicteStore {
  return dataBackend() === "postgres" ? postgresAicte : memoryAicte;
}

/** Reads, changes and saves a college's AICTE document; `change` returns what to hand back to the caller. */
export async function updateAicte<T>(collegeId: string, by: string, change: (state: AicteState) => T): Promise<T> {
  const store = aicteStore();
  const state = await store.get(collegeId);
  const result = change(state);
  await store.save(collegeId, state, by);
  return result;
}
