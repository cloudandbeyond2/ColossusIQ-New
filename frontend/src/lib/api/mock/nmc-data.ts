import "server-only";
import { randomUUID } from "node:crypto";
import { dataBackend } from "@/lib/data";
import type { NmcActionItem, NmcCommittee, NmcProfile } from "@/lib/api/nmc-schemas";
import { postgresNmc } from "@/lib/data/postgres/nmc";
import { sharedState } from "./global-state";

/*
 * What a college records for NMC compliance: its registration profile, statutory committees, action plan and the
 * required faculty strength per department. In memory for the demo backend, PostgreSQL otherwise (data/postgres/nmc.ts).
 * `college` is the college's public id. Scores and counts are computed elsewhere, never stored.
 */

export type CommitteeRow = NmcCommittee & { college: string };
export type ActionRow = NmcActionItem & { college: string };
export type CommitteeDraft = Pick<NmcCommittee, "name" | "mandate" | "meetingFrequency">;
export type CommitteePatch = Partial<Omit<NmcCommittee, "id" | "name" | "mandate">>;
export type ActionDraft = Omit<NmcActionItem, "id" | "status" | "resolvedAt">;
export interface DepartmentNorm {
  requiredFaculty: number | null;
  aebasAttendance: number | null;
}

export const EMPTY_PROFILE: NmcProfile = {
  nmcCode: "",
  mbbsSeats: 0,
  lopStatus: "",
  affiliationYear: 0,
  cctvStreamsOnline: 0,
  cctvStreamsTotal: 0,
  aebasPortalActive: false,
  meuCertified: false,
  ethicsCommitteeRegNo: "",
  lastInspectionDate: "",
  nextInspectionWindow: "",
};

export interface NmcData {
  profile(college: string): Promise<NmcProfile>;
  saveProfile(college: string, patch: Partial<NmcProfile>): Promise<NmcProfile>;
  committees(college: string): Promise<CommitteeRow[]>;
  committee(id: string): Promise<CommitteeRow | undefined>;
  /** Adds the ones the college doesn't have yet (matched by name); returns how many were added. */
  addCommittees(college: string, drafts: CommitteeDraft[]): Promise<number>;
  updateCommittee(id: string, patch: CommitteePatch): Promise<CommitteeRow | undefined>;
  actions(college: string): Promise<ActionRow[]>;
  action(id: string): Promise<ActionRow | undefined>;
  addAction(college: string, draft: ActionDraft): Promise<ActionRow | undefined>;
  setActionStatus(id: string, status: NmcActionItem["status"], notes?: string): Promise<ActionRow | undefined>;
  removeAction(id: string): Promise<boolean>;
  norms(college: string): Promise<Map<string, DepartmentNorm>>;
  setNorm(college: string, department: string, norm: DepartmentNorm): Promise<void>;
}

const copy = <T>(v: T): T => structuredClone(v);

const profiles = sharedState("campus.nmc.profile.v3", () => new Map<string, NmcProfile>());
const committees = sharedState("campus.nmc.committees.v3", () => new Map<string, CommitteeRow>());
const actions = sharedState("campus.nmc.actions.v3", () => new Map<string, ActionRow>());
const norms = sharedState("campus.nmc.norms.v3", () => new Map<string, Map<string, DepartmentNorm>>());

const memoryNmc: NmcData = {
  async profile(college) {
    return copy(profiles.get(college) ?? EMPTY_PROFILE);
  },
  async saveProfile(college, patch) {
    const next = { ...(profiles.get(college) ?? EMPTY_PROFILE), ...copy(patch) };
    profiles.set(college, next);
    return copy(next);
  },
  async committees(college) {
    return [...committees.values()].filter((c) => c.college === college).map(copy);
  },
  async committee(id) {
    const c = committees.get(id);
    return c ? copy(c) : undefined;
  },
  async addCommittees(college, drafts) {
    const have = new Set([...committees.values()].filter((c) => c.college === college).map((c) => c.name.toLowerCase()));
    let n = 0;
    for (const d of drafts) {
      if (have.has(d.name.toLowerCase())) continue;
      const row: CommitteeRow = {
        id: randomUUID(), college, name: d.name, mandate: d.mandate, meetingFrequency: d.meetingFrequency,
        chairperson: "", convener: "", membersCount: 0, lastMeetingDate: "", status: "Not Constituted", momUploaded: false, notes: "",
      };
      committees.set(row.id, row);
      n++;
    }
    return n;
  },
  async updateCommittee(id, patch) {
    const c = committees.get(id);
    if (!c) return undefined;
    Object.assign(c, copy(patch));
    return copy(c);
  },
  async actions(college) {
    return [...actions.values()].filter((a) => a.college === college).map(copy).reverse();
  },
  async action(id) {
    const a = actions.get(id);
    return a ? copy(a) : undefined;
  },
  async addAction(college, d) {
    const row: ActionRow = { ...copy(d), id: randomUUID(), college, status: "Pending" };
    actions.set(row.id, row);
    return copy(row);
  },
  async setActionStatus(id, status, notes) {
    const a = actions.get(id);
    if (!a) return undefined;
    a.status = status;
    if (notes) a.notes = notes;
    a.resolvedAt = status === "Resolved" ? new Date().toISOString().slice(0, 10) : undefined;
    return copy(a);
  },
  async removeAction(id) {
    return actions.delete(id);
  },
  async norms(college) {
    return new Map(norms.get(college) ?? []);
  },
  async setNorm(college, department, norm) {
    const m = norms.get(college) ?? new Map<string, DepartmentNorm>();
    m.set(department, { ...norm });
    norms.set(college, m);
  },
};

/** Test helper (memory backend only). */
export function resetNmcMemory() {
  profiles.clear();
  committees.clear();
  actions.clear();
  norms.clear();
}

export function nmcData(): NmcData {
  return dataBackend() === "postgres" ? postgresNmc : memoryNmc;
}
