import "server-only";
import { randomUUID } from "node:crypto";
import { dataBackend } from "@/lib/data";
import type { ClubItem } from "@/lib/api/schemas";
import { postgresClubs } from "@/lib/data/postgres/clubs";
import { sharedState } from "./global-state";

/*
 * Campus clubs and their memberships. In memory for the demo backend, PostgreSQL otherwise (data/postgres/clubs.ts).
 * `college` is the college's public id. A club's member count is the number of people who joined, never a typed number.
 */

export type ClubRow = Omit<ClubItem, "isJoined" | "canEdit"> & { college: string; createdBySub: string };
export type ClubDraft = Omit<ClubRow, "id" | "createdAt" | "membersCount" | "status"> & { status?: ClubItem["status"] };
export type ClubPatch = Partial<Pick<ClubRow, "name" | "category" | "description" | "lead" | "facultyAdvisor" | "meetingSchedule" | "venue" | "status">>;

export interface ClubsData {
  clubs(college: string): Promise<ClubRow[]>;
  club(id: string): Promise<ClubRow | undefined>;
  /** undefined when the college already has a club with that name. */
  create(draft: ClubDraft): Promise<ClubRow | undefined>;
  /** undefined when the club is gone; throws nothing on a duplicate name, returns "duplicate" instead. */
  update(id: string, patch: ClubPatch): Promise<ClubRow | "duplicate" | undefined>;
  remove(id: string): Promise<boolean>;
  /** The ids of the clubs this person has joined. */
  joined(college: string, sub: string): Promise<string[]>;
  join(club: ClubRow, sub: string, name: string): Promise<void>;
  leave(club: ClubRow, sub: string): Promise<void>;
}

const copy = <T>(v: T): T => structuredClone(v);

const clubs = sharedState("campus.clubs.rows.v3", () => new Map<string, ClubRow>());
const members = sharedState("campus.clubs.members.v3", () => new Map<string, Map<string, string>>());

const count = (id: string) => members.get(id)?.size ?? 0;
const view = (c: ClubRow): ClubRow => ({ ...copy(c), membersCount: count(c.id) });
const nameTaken = (college: string, name: string, except?: string) =>
  [...clubs.values()].some((c) => c.college === college && c.id !== except && c.name.toLowerCase() === name.toLowerCase());

const memoryClubs: ClubsData = {
  async clubs(college) {
    return [...clubs.values()].filter((c) => c.college === college).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(view);
  },
  async club(id) {
    const c = clubs.get(id);
    return c ? view(c) : undefined;
  },
  async create(draft) {
    if (nameTaken(draft.college, draft.name)) return undefined;
    const row: ClubRow = { ...copy(draft), status: draft.status ?? "Active", id: randomUUID(), membersCount: 0, createdAt: new Date().toISOString() };
    clubs.set(row.id, row);
    return view(row);
  },
  async update(id, patch) {
    const c = clubs.get(id);
    if (!c) return undefined;
    if (patch.name && nameTaken(c.college, patch.name, id)) return "duplicate";
    Object.assign(c, copy(patch));
    return view(c);
  },
  async remove(id) {
    members.delete(id);
    return clubs.delete(id);
  },
  async joined(college, sub) {
    return [...clubs.values()].filter((c) => c.college === college && members.get(c.id)?.has(sub)).map((c) => c.id);
  },
  async join(club, sub, name) {
    const m = members.get(club.id) ?? new Map<string, string>();
    m.set(sub, name);
    members.set(club.id, m);
  },
  async leave(club, sub) {
    members.get(club.id)?.delete(sub);
  },
};

/** Test helper (memory backend only). */
export function resetClubsMemory() {
  clubs.clear();
  members.clear();
}

export function clubsData(): ClubsData {
  return dataBackend() === "postgres" ? postgresClubs : memoryClubs;
}
