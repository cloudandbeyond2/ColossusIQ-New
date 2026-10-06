import "server-only";
import { randomUUID } from "node:crypto";
import { dataBackend } from "@/lib/data";
import type { SessionPayload } from "@/lib/auth/session";
import type { ExperienceCategory, ExperienceStatus } from "@/lib/api/experience-schemas";
import { postgresExperiences } from "@/lib/data/postgres/experiences";
import { sharedState } from "./global-state";

/*
 * Experience Passport entries: in memory for the demo backend, PostgreSQL otherwise (data/postgres/experiences.ts).
 * Every method takes the signed-in session first. Students only ever read and change their own rows; faculty read the
 * whole college and record a decision.
 */

export interface ExperienceRow {
  id: string;
  title: string;
  category: ExperienceCategory;
  organisation: string;
  role: string;
  startMonth: string;
  endMonth: string | null;
  description: string;
  link: string;
  status: ExperienceStatus;
  reviewNote: string;
  reviewerName: string;
  reviewerRole: string;
  reviewedAt: string | null;
  studentName: string;
  rollNo: string;
  createdAt: string;
  updatedAt: string;
  mine: boolean;
}

export interface NewExperience {
  title: string;
  category: ExperienceCategory;
  organisation: string;
  role: string;
  startMonth: string;
  endMonth: string | null;
  description: string;
  link: string;
  studentName: string;
  rollNo: string;
}

export interface ExperienceStore {
  /** "mine": the signed-in student's rows. "college": everyone's in the signed-in college. */
  list(s: SessionPayload, scope: "mine" | "college"): Promise<ExperienceRow[]>;
  get(s: SessionPayload, id: string): Promise<ExperienceRow | undefined>;
  create(s: SessionPayload, n: NewExperience): Promise<ExperienceRow>;
  /** Changes the details; `resetReview` sends the entry back to Pending and clears the decision. */
  update(s: SessionPayload, id: string, patch: Partial<NewExperience>, resetReview: boolean): Promise<ExperienceRow | undefined>;
  remove(s: SessionPayload, id: string): Promise<boolean>;
  review(s: SessionPayload, id: string, r: { status: "Verified" | "Rejected"; note: string; reviewerName: string; reviewerRole: string }): Promise<ExperienceRow | undefined>;
}

/* ───────────────────────────── memory ───────────────────────────── */
interface Mem extends Omit<ExperienceRow, "mine"> {
  college: string;
  userKey: string;
}
const rows = sharedState("experience.rows", () => new Map<string, Mem>());

const out = (x: Mem, s: SessionPayload): ExperienceRow => {
  const { college, userKey, ...rest } = x;
  void college;
  return { ...rest, mine: userKey === s.sub };
};
const same = (x: Mem, s: SessionPayload) => x.college === s.college;
const newest = (a: ExperienceRow, b: ExperienceRow) => b.startMonth.localeCompare(a.startMonth) || b.createdAt.localeCompare(a.createdAt);

const memoryExperiences: ExperienceStore = {
  async list(s, scope) {
    return [...rows.values()]
      .filter((x) => same(x, s) && (scope === "college" || x.userKey === s.sub))
      .map((x) => out(x, s))
      .sort(newest);
  },
  async get(s, id) {
    const x = rows.get(id);
    return x && same(x, s) ? out(x, s) : undefined;
  },
  async create(s, n) {
    const now = new Date().toISOString();
    const x: Mem = { ...n, id: randomUUID(), college: s.college, userKey: s.sub, status: "Pending", reviewNote: "", reviewerName: "", reviewerRole: "", reviewedAt: null, createdAt: now, updatedAt: now };
    rows.set(x.id, x);
    return out(x, s);
  },
  async update(s, id, patch, resetReview) {
    const x = rows.get(id);
    if (!x || !same(x, s)) return undefined;
    Object.assign(x, patch, { updatedAt: new Date().toISOString() });
    if (resetReview) Object.assign(x, { status: "Pending", reviewNote: "", reviewerName: "", reviewerRole: "", reviewedAt: null });
    return out(x, s);
  },
  async remove(s, id) {
    const x = rows.get(id);
    if (!x || !same(x, s)) return false;
    return rows.delete(id);
  },
  async review(s, id, r) {
    const x = rows.get(id);
    if (!x || !same(x, s)) return undefined;
    Object.assign(x, { status: r.status, reviewNote: r.note, reviewerName: r.reviewerName, reviewerRole: r.reviewerRole, reviewedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    return out(x, s);
  },
};

/** Test helper: forgets everything (memory backend only). */
export function resetExperienceMemory() {
  rows.clear();
}

export function experienceStore(): ExperienceStore {
  return dataBackend() === "postgres" ? postgresExperiences : memoryExperiences;
}
