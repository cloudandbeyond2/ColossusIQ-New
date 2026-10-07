import "server-only";
import { randomUUID } from "node:crypto";
import { dataBackend } from "@/lib/data";
import type { SessionPayload } from "@/lib/auth/session";
import { postgresPrepContent } from "@/lib/data/postgres/prep-content";
import { sharedState } from "./global-state";

/*
 * College-written exam-prep content: question sets and topic study notes (faculty-written, or AI notes cached for the
 * college). In memory for the demo backend, PostgreSQL otherwise (data/postgres/prep-content.ts). Every method takes
 * the signed-in session first and only ever sees that session's college. `body` is validated by the callers.
 */

export type ContentKind = "note" | "set";
export interface ContentInput {
  kind: ContentKind;
  topicId: string;
  topicTitle: string;
  examIds: string[];
  section: string;
  title: string;
  body: unknown;
  source: "faculty" | "ai";
  status: "Draft" | "Published";
}
export interface ContentRow extends ContentInput {
  id: string;
  author: string;
  createdAt: string;
  updatedAt: string;
}

export interface PrepContentStore {
  list(s: SessionPayload, kind?: ContentKind): Promise<ContentRow[]>;
  get(s: SessionPayload, id: string): Promise<ContentRow | undefined>;
  create(s: SessionPayload, c: ContentInput, author: string): Promise<ContentRow>;
  update(s: SessionPayload, id: string, c: ContentInput, author: string): Promise<ContentRow | undefined>;
  remove(s: SessionPayload, id: string): Promise<boolean>;
}

interface Mem extends ContentRow {
  college: string;
}
const rows = sharedState("prep-content.rows", () => new Map<string, Mem>());
const out = (x: Mem): ContentRow => {
  const { college, ...rest } = x;
  void college;
  return structuredClone(rest);
};
const newest = (a: ContentRow, b: ContentRow) => b.updatedAt.localeCompare(a.updatedAt);

const memoryPrepContent: PrepContentStore = {
  async list(s, kind) {
    return [...rows.values()].filter((x) => x.college === s.college && (!kind || x.kind === kind)).map(out).sort(newest);
  },
  async get(s, id) {
    const x = rows.get(id);
    return x && x.college === s.college ? out(x) : undefined;
  },
  async create(s, c, author) {
    const now = new Date().toISOString();
    const x: Mem = { ...structuredClone(c), id: randomUUID(), author, college: s.college, createdAt: now, updatedAt: now };
    rows.set(x.id, x);
    return out(x);
  },
  async update(s, id, c, author) {
    const x = rows.get(id);
    if (!x || x.college !== s.college) return undefined;
    Object.assign(x, structuredClone(c), { author, updatedAt: new Date().toISOString() });
    return out(x);
  },
  async remove(s, id) {
    const x = rows.get(id);
    if (!x || x.college !== s.college) return false;
    return rows.delete(id);
  },
};

/** Test helper: forgets everything (memory backend only). */
export function resetPrepContentMemory() {
  rows.clear();
}

export function prepContentStore(): PrepContentStore {
  return dataBackend() === "postgres" ? postgresPrepContent : memoryPrepContent;
}
