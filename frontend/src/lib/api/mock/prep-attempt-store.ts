import "server-only";
import { randomUUID } from "node:crypto";
import { dataBackend } from "@/lib/data";
import type { SessionPayload } from "@/lib/auth/session";
import { postgresPrepAttempts } from "@/lib/data/postgres/prep-attempts";
import { sharedState } from "./global-state";

/*
 * One summary row per finished daily test, practice mock or weekly current-affairs quiz. It powers the "one daily test
 * a day" rule, XP and the peer percentile. In memory for the demo backend, PostgreSQL otherwise
 * (data/postgres/prep-attempts.ts). Every method takes the session first and only sees that session's college; peer
 * figures are percentages only, never names.
 */

export type PrepKind = "daily" | "mock" | "ca-quiz";
export interface PrepAttemptInput {
  kind: PrepKind;
  /** Exam id for mocks, the India-time day for daily tests, the week for the current-affairs quiz. */
  key: string;
  /** Unique per student: "daily:2026-10-06", "mock:<attempt id>", "ca:2026-W41". */
  ref: string;
  score: number;
  max: number;
  percent: number;
  seconds: number;
}
export interface PrepAttemptRow extends PrepAttemptInput {
  id: string;
  at: string;
}

export interface PrepAttemptStore {
  /** False when the student already has an attempt with this ref. */
  add(s: SessionPayload, a: PrepAttemptInput): Promise<boolean>;
  mine(s: SessionPayload): Promise<PrepAttemptRow[]>;
  /** Percentages of every attempt in the college with this kind and key (the caller's included). */
  peers(s: SessionPayload, kind: PrepKind, key: string): Promise<number[]>;
}

interface Mem extends PrepAttemptRow {
  college: string;
  user: string;
}
const rows = sharedState("prep-attempts.rows", () => new Map<string, Mem>());
const out = (x: Mem): PrepAttemptRow => ({ id: x.id, at: x.at, kind: x.kind, key: x.key, ref: x.ref, score: x.score, max: x.max, percent: x.percent, seconds: x.seconds });

const memoryPrepAttempts: PrepAttemptStore = {
  async add(s, a) {
    for (const x of rows.values()) if (x.user === s.sub && x.ref === a.ref) return false;
    const id = randomUUID();
    rows.set(id, { ...a, id, at: new Date().toISOString(), college: s.college, user: s.sub });
    return true;
  },
  async mine(s) {
    return [...rows.values()].filter((x) => x.college === s.college && x.user === s.sub).map(out).sort((a, b) => b.at.localeCompare(a.at));
  },
  async peers(s, kind, key) {
    return [...rows.values()].filter((x) => x.college === s.college && x.kind === kind && x.key === key).map((x) => x.percent);
  },
};

/** Test helper: forgets everything (memory backend only). */
export function resetPrepAttemptMemory() {
  rows.clear();
}

export function prepAttemptStore(): PrepAttemptStore {
  return dataBackend() === "postgres" ? postgresPrepAttempts : memoryPrepAttempts;
}

/** Share of the other attempts that scored lower, shown only once enough peers have taken the test. */
export const MIN_PEERS = 5;
export function percentileOf(mine: number, all: number[]): number | null {
  if (all.length < MIN_PEERS) return null;
  const others = all.length - 1;
  if (others <= 0) return null;
  const below = all.filter((p) => p < mine).length;
  return Math.round((below / others) * 100);
}
