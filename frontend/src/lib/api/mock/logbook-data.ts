import "server-only";
import { randomUUID } from "node:crypto";
import { dataBackend } from "@/lib/data";
import type { CompetencyDraft, LogbookCompetency } from "@/lib/api/logbook-schemas";
import { postgresLogbook } from "@/lib/data/postgres/logbook";
import { sharedState } from "./global-state";

/*
 * CBME competency logbook: the college's competency catalogue and the students' sign-off entries.
 * In memory for the demo backend, PostgreSQL otherwise (data/postgres/logbook.ts). `college` is the college's public id.
 */

export type EntryStatus = "Pending review" | "Certified" | "Returned";

export interface EntryRow {
  id: string;
  college: string;
  competencyId: string;
  studentSub: string;
  studentName: string;
  rollNo: string;
  attempts: number;
  status: EntryStatus;
  notes: string;
  remarks: string;
  certifiedBy: string;
  certifiedAt: string;
}

export interface Requester {
  sub: string;
  name: string;
  rollNo: string;
}

export interface LogbookData {
  competencies(college: string): Promise<LogbookCompetency[]>;
  competency(id: string): Promise<(LogbookCompetency & { college: string }) | undefined>;
  /** Adds the ones whose code is new; returns how many were added. */
  addCompetencies(college: string, items: CompetencyDraft[], authorSub: string): Promise<number>;
  removeCompetency(id: string): Promise<boolean>;
  entries(college: string, studentSub?: string): Promise<EntryRow[]>;
  entry(id: string): Promise<EntryRow | undefined>;
  /** Creates the entry, or bumps attempts and puts it back to "Pending review". */
  request(college: string, competencyId: string, who: Requester, notes: string): Promise<EntryRow | undefined>;
  review(id: string, status: "Certified" | "Returned", remarks: string, by: string): Promise<EntryRow | undefined>;
}

const competencies = sharedState("logbook.competencies", () => new Map<string, Array<LogbookCompetency & { college: string }>>());
const entries = sharedState("logbook.entries", () => new Map<string, EntryRow[]>());

export function resetLogbookMemory() {
  competencies.clear();
  entries.clear();
}

const memoryLogbook: LogbookData = {
  async competencies(college) {
    return structuredClone(competencies.get(college) ?? []).map(({ college: _c, ...rest }) => (void _c, rest));
  },
  async competency(id) {
    for (const list of competencies.values()) {
      const c = list.find((x) => x.id === id);
      if (c) return structuredClone(c);
    }
    return undefined;
  },
  async addCompetencies(college, items) {
    const list = competencies.get(college) ?? [];
    let added = 0;
    for (const it of items) {
      if (list.some((c) => c.code.toLowerCase() === it.code.toLowerCase())) continue;
      list.push({ id: randomUUID(), college, code: it.code, description: it.description, department: it.department, level: it.level });
      added++;
    }
    competencies.set(college, list);
    return added;
  },
  async removeCompetency(id) {
    for (const [college, list] of competencies) {
      const i = list.findIndex((c) => c.id === id);
      if (i >= 0) {
        list.splice(i, 1);
        entries.set(college, (entries.get(college) ?? []).filter((e) => e.competencyId !== id));
        return true;
      }
    }
    return false;
  },
  async entries(college, studentSub) {
    return structuredClone((entries.get(college) ?? []).filter((e) => !studentSub || e.studentSub === studentSub));
  },
  async entry(id) {
    for (const list of entries.values()) {
      const e = list.find((x) => x.id === id);
      if (e) return structuredClone(e);
    }
    return undefined;
  },
  async request(college, competencyId, who, notes) {
    const list = entries.get(college) ?? [];
    let e = list.find((x) => x.competencyId === competencyId && x.studentSub === who.sub);
    if (e) {
      e.attempts += 1;
      e.status = "Pending review";
      e.notes = notes;
      e.studentName = who.name;
      e.rollNo = who.rollNo;
    } else {
      e = { id: randomUUID(), college, competencyId, studentSub: who.sub, studentName: who.name, rollNo: who.rollNo, attempts: 1, status: "Pending review", notes, remarks: "", certifiedBy: "", certifiedAt: "" };
      list.push(e);
    }
    entries.set(college, list);
    return structuredClone(e);
  },
  async review(id, status, remarks, by) {
    for (const list of entries.values()) {
      const e = list.find((x) => x.id === id);
      if (e) {
        e.status = status;
        e.remarks = remarks;
        e.certifiedBy = by;
        e.certifiedAt = status === "Certified" ? new Date().toISOString() : "";
        return structuredClone(e);
      }
    }
    return undefined;
  },
};

export function logbookData(): LogbookData {
  return dataBackend() === "postgres" ? postgresLogbook : memoryLogbook;
}
