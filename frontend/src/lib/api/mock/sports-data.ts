import "server-only";
import { randomUUID } from "node:crypto";
import { dataBackend } from "@/lib/data";
import type { SportItem } from "@/lib/api/schemas";
import { postgresSports } from "@/lib/data/postgres/sports";
import { sharedState } from "./global-state";

/*
 * Campus sports teams and trial registrations. In memory for the demo backend, PostgreSQL otherwise (data/postgres/sports.ts).
 * `college` is the college's public id. A squad's size is the number of people registered, never a typed number.
 */

export type SportRow = Omit<SportItem, "isRegistered"> & { college: string; createdBySub: string };
export type SportDraft = Omit<SportRow, "id" | "createdAt" | "squadSize">;
export type SportPatch = Partial<Pick<SportRow, "sport" | "team" | "coach" | "captain" | "event" | "venue" | "status">>;
export interface TrialDetails {
  name: string;
  position: string;
  experience: string;
}

export interface SportsData {
  sports(college: string): Promise<SportRow[]>;
  sport(id: string): Promise<SportRow | undefined>;
  /** undefined when the college already has that team for that sport. */
  create(draft: SportDraft): Promise<SportRow | undefined>;
  /** "duplicate" when the new sport/team pair is taken. */
  update(id: string, patch: SportPatch): Promise<SportRow | "duplicate" | undefined>;
  remove(id: string): Promise<boolean>;
  /** The ids of the teams this person has registered for. */
  registered(college: string, sub: string): Promise<string[]>;
  register(sport: SportRow, sub: string, details: TrialDetails): Promise<void>;
  withdraw(sport: SportRow, sub: string): Promise<void>;
}

const copy = <T>(v: T): T => structuredClone(v);

const sports = sharedState("campus.sports.rows.v3", () => new Map<string, SportRow>());
const regs = sharedState("campus.sports.registrations.v3", () => new Map<string, Map<string, TrialDetails>>());

const count = (id: string) => regs.get(id)?.size ?? 0;
const view = (s: SportRow): SportRow => ({ ...copy(s), squadSize: count(s.id) });
const taken = (college: string, sport: string, team: string, except?: string) =>
  [...sports.values()].some(
    (s) => s.college === college && s.id !== except && s.sport.toLowerCase() === sport.toLowerCase() && s.team.toLowerCase() === team.toLowerCase(),
  );

const memorySports: SportsData = {
  async sports(college) {
    return [...sports.values()].filter((s) => s.college === college).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(view);
  },
  async sport(id) {
    const s = sports.get(id);
    return s ? view(s) : undefined;
  },
  async create(draft) {
    if (taken(draft.college, draft.sport, draft.team)) return undefined;
    const row: SportRow = { ...copy(draft), id: randomUUID(), squadSize: 0, createdAt: new Date().toISOString() };
    sports.set(row.id, row);
    return view(row);
  },
  async update(id, patch) {
    const s = sports.get(id);
    if (!s) return undefined;
    if (taken(s.college, patch.sport ?? s.sport, patch.team ?? s.team, id)) return "duplicate";
    Object.assign(s, copy(patch));
    return view(s);
  },
  async remove(id) {
    regs.delete(id);
    return sports.delete(id);
  },
  async registered(college, sub) {
    return [...sports.values()].filter((s) => s.college === college && regs.get(s.id)?.has(sub)).map((s) => s.id);
  },
  async register(sport, sub, details) {
    const m = regs.get(sport.id) ?? new Map<string, TrialDetails>();
    m.set(sub, copy(details));
    regs.set(sport.id, m);
  },
  async withdraw(sport, sub) {
    regs.get(sport.id)?.delete(sub);
  },
};

/** Test helper (memory backend only). */
export function resetSportsMemory() {
  sports.clear();
  regs.clear();
}

export function sportsData(): SportsData {
  return dataBackend() === "postgres" ? postgresSports : memorySports;
}
