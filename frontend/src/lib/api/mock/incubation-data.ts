import "server-only";
import { randomUUID } from "node:crypto";
import { dataBackend } from "@/lib/data";
import type { PipelineVenture } from "@/lib/api/incubation-schemas";
import type { MentorItem } from "@/lib/api/mentor-network-schemas";
import type { StartupItem } from "@/lib/api/startup-schemas";
import { postgresIncubation } from "@/lib/data/postgres/incubation";
import { sharedState } from "./global-state";

/*
 * The incubation cell's records: pipeline ventures, the startup portfolio (with each startup's funding-readiness
 * evaluation) and the mentor network. In memory for the demo backend, PostgreSQL otherwise
 * (data/postgres/incubation.ts). `college` is the college's public id. Nothing is pre-filled.
 */

export type VentureFields = Omit<PipelineVenture, "id" | "submittedAt" | "updatedAt">;
export type StartupFields = Omit<StartupItem, "id" | "campusIncubatedAt">;
export type MentorFields = Omit<MentorItem, "id" | "activeVenturesCount" | "assignedVentures" | "sessionsCompleted" | "rating" | "joinedDate">;
export type MentorRec = Omit<MentorItem, "activeVenturesCount" | "assignedVentures" | "sessionsCompleted" | "rating">;

/** What the evaluator has recorded for a startup; the rest of the readiness view is derived from it. */
export interface StoredEvaluation {
  fundingTarget: string;
  dimensions: { id: string; score: number }[];
  strengths: string[];
  investorGaps: string[];
  actionPlan: string[];
  diligence: { id: string; verified: boolean; notes: string }[];
  evaluatorNotes: string;
  lastEvaluatedAt: string;
}

export interface SessionLog {
  ventureName: string;
  topic: string;
  notes: string;
  durationMinutes: number;
  loggedBySub: string;
}

export interface IncubationData {
  ventures(college: string): Promise<PipelineVenture[]>;
  venture(college: string, id: string): Promise<PipelineVenture | undefined>;
  addVenture(college: string, v: VentureFields): Promise<PipelineVenture>;
  saveVenture(college: string, id: string, patch: Partial<VentureFields>): Promise<PipelineVenture | undefined>;
  removeVenture(college: string, id: string): Promise<boolean>;

  startups(college: string): Promise<StartupItem[]>;
  startup(college: string, id: string): Promise<StartupItem | undefined>;
  addStartup(college: string, s: StartupFields): Promise<StartupItem>;
  saveStartup(college: string, id: string, patch: Partial<StartupFields>): Promise<StartupItem | undefined>;
  removeStartup(college: string, id: string): Promise<boolean>;
  evaluations(college: string): Promise<Record<string, StoredEvaluation>>;
  /** Stores the evaluation and the startup's readiness score together. False when the startup does not exist. */
  saveEvaluation(college: string, startupId: string, ev: StoredEvaluation, score: number): Promise<boolean>;

  mentors(college: string): Promise<MentorRec[]>;
  mentor(college: string, id: string): Promise<MentorRec | undefined>;
  addMentor(college: string, m: MentorFields): Promise<MentorRec>;
  saveMentor(college: string, id: string, patch: Partial<MentorFields> & { status?: MentorRec["status"] }): Promise<MentorRec | undefined>;
  removeMentor(college: string, id: string): Promise<boolean>;
  assignments(college: string): Promise<{ mentorId: string; ventureId: string }[]>;
  assign(college: string, mentorId: string, ventureId: string): Promise<void>;
  unassign(college: string, mentorId: string, ventureId: string): Promise<void>;
  sessionCounts(college: string): Promise<Record<string, number>>;
  addSession(college: string, mentorId: string, d: SessionLog): Promise<void>;
}

interface Bucket {
  ventures: Map<string, PipelineVenture>;
  startups: Map<string, StartupItem>;
  evaluations: Map<string, StoredEvaluation>;
  mentors: Map<string, MentorRec>;
  assignments: { mentorId: string; ventureId: string }[];
  sessions: Map<string, number>;
}

const buckets = sharedState("incubation.buckets", () => new Map<string, Bucket>());
const bucket = (college: string): Bucket => {
  let b = buckets.get(college);
  if (!b) {
    b = { ventures: new Map(), startups: new Map(), evaluations: new Map(), mentors: new Map(), assignments: [], sessions: new Map() };
    buckets.set(college, b);
  }
  return b;
};

const now = () => new Date().toISOString();
const clone = <T>(v: T): T => structuredClone(v);

const memoryIncubation: IncubationData = {
  async ventures(college) {
    return [...bucket(college).ventures.values()].map(clone).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  },
  async venture(college, id) {
    const v = bucket(college).ventures.get(id);
    return v ? clone(v) : undefined;
  },
  async addVenture(college, v) {
    const row: PipelineVenture = { ...clone(v), id: randomUUID(), submittedAt: now(), updatedAt: now() };
    bucket(college).ventures.set(row.id, row);
    return clone(row);
  },
  async saveVenture(college, id, patch) {
    const v = bucket(college).ventures.get(id);
    if (!v) return undefined;
    Object.assign(v, clone(patch), { updatedAt: now() });
    return clone(v);
  },
  async removeVenture(college, id) {
    const b = bucket(college);
    b.assignments = b.assignments.filter((a) => a.ventureId !== id);
    return b.ventures.delete(id);
  },

  async startups(college) {
    return [...bucket(college).startups.values()].map(clone).sort((a, b) => b.campusIncubatedAt.localeCompare(a.campusIncubatedAt));
  },
  async startup(college, id) {
    const s = bucket(college).startups.get(id);
    return s ? clone(s) : undefined;
  },
  async addStartup(college, s) {
    const row: StartupItem = { ...clone(s), id: randomUUID(), campusIncubatedAt: now() };
    bucket(college).startups.set(row.id, row);
    return clone(row);
  },
  async saveStartup(college, id, patch) {
    const s = bucket(college).startups.get(id);
    if (!s) return undefined;
    Object.assign(s, clone(patch));
    return clone(s);
  },
  async removeStartup(college, id) {
    bucket(college).evaluations.delete(id);
    return bucket(college).startups.delete(id);
  },
  async evaluations(college) {
    return Object.fromEntries([...bucket(college).evaluations].map(([k, v]) => [k, clone(v)]));
  },
  async saveEvaluation(college, startupId, ev, score) {
    const b = bucket(college);
    const s = b.startups.get(startupId);
    if (!s) return false;
    b.evaluations.set(startupId, clone(ev));
    s.readinessScore = score;
    return true;
  },

  async mentors(college) {
    return [...bucket(college).mentors.values()].map(clone).sort((a, b) => b.joinedDate.localeCompare(a.joinedDate));
  },
  async mentor(college, id) {
    const m = bucket(college).mentors.get(id);
    return m ? clone(m) : undefined;
  },
  async addMentor(college, m) {
    const row: MentorRec = { ...clone(m), id: randomUUID(), joinedDate: now() };
    bucket(college).mentors.set(row.id, row);
    return clone(row);
  },
  async saveMentor(college, id, patch) {
    const m = bucket(college).mentors.get(id);
    if (!m) return undefined;
    Object.assign(m, clone(patch));
    return clone(m);
  },
  async removeMentor(college, id) {
    const b = bucket(college);
    b.assignments = b.assignments.filter((a) => a.mentorId !== id);
    b.sessions.delete(id);
    return b.mentors.delete(id);
  },
  async assignments(college) {
    return clone(bucket(college).assignments);
  },
  async assign(college, mentorId, ventureId) {
    const b = bucket(college);
    if (!b.assignments.some((a) => a.mentorId === mentorId && a.ventureId === ventureId)) b.assignments.push({ mentorId, ventureId });
  },
  async unassign(college, mentorId, ventureId) {
    const b = bucket(college);
    b.assignments = b.assignments.filter((a) => !(a.mentorId === mentorId && a.ventureId === ventureId));
  },
  async sessionCounts(college) {
    return Object.fromEntries(bucket(college).sessions);
  },
  async addSession(college, mentorId) {
    const b = bucket(college);
    b.sessions.set(mentorId, (b.sessions.get(mentorId) ?? 0) + 1);
  },
};

/** Test helper: forgets everything (memory backend only). */
export function resetIncubationMemory() {
  buckets.clear();
}

export function incubationData(): IncubationData {
  return dataBackend() === "postgres" ? postgresIncubation : memoryIncubation;
}
