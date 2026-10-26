import "server-only";
import { randomUUID } from "node:crypto";
import { dataBackend } from "@/lib/data";
import type { EarlyWarningIntervention, SkillIntervention } from "@/lib/api/schemas";
import { postgresSupport } from "@/lib/data/postgres/support";
import { sharedState } from "./global-state";

/*
 * Student support cases and plans (Early Warning) and skill programmes (Skill Intelligence).
 * In memory for the demo backend, PostgreSQL otherwise (data/postgres/support.ts). `college` is the college's public id.
 */

export type CaseStatus = "Pending review" | "In progress" | "Resolved";

export interface CaseRow {
  studentSub: string;
  status: CaseStatus;
  assignedMentor: string;
  notes: string;
  /** yyyy-mm-dd */
  lastActionDate: string | null;
}
export interface CaseUpdate {
  status: CaseStatus;
  assignedMentor?: string;
  /** undefined keeps the existing notes */
  notes?: string;
  lastActionDate: string;
  updatedBySub: string;
}

export interface ActionDraft {
  studentSub: string;
  studentName: string;
  rollNo: string;
  department: string;
  strategy: string;
  facultyLead: string;
  targetDate: string;
  notes: string;
  authorSub: string;
}

export interface SkillDraft {
  title: string;
  department: string;
  batch: string;
  targetSkill: string;
  facultyLead: string;
  duration: string;
  authorSub: string;
}

export interface SupportData {
  cases(college: string): Promise<Map<string, CaseRow>>;
  saveCase(college: string, studentSub: string, update: CaseUpdate): Promise<void>;
  actions(college: string): Promise<EarlyWarningIntervention[]>;
  addAction(college: string, draft: ActionDraft): Promise<EarlyWarningIntervention | undefined>;
  skills(college: string): Promise<SkillIntervention[]>;
  addSkill(college: string, draft: SkillDraft): Promise<SkillIntervention | undefined>;
}

/** The impact line is derived from the programme itself, not stored. */
export const skillImpact = (targetSkill: string) => `Targeting proficiency uplift for ${targetSkill}`;

const cases = sharedState("support.cases", () => new Map<string, Map<string, CaseRow>>());
const actions = sharedState("support.actions", () => new Map<string, EarlyWarningIntervention[]>());
const skills = sharedState("support.skills", () => new Map<string, SkillIntervention[]>());

export function resetSupportMemory() {
  cases.clear();
  actions.clear();
  skills.clear();
}

const memorySupport: SupportData = {
  async cases(college) {
    return structuredClone(cases.get(college) ?? new Map<string, CaseRow>());
  },
  async saveCase(college, sub, u) {
    const map = cases.get(college) ?? new Map<string, CaseRow>();
    const prev = map.get(sub);
    map.set(sub, {
      studentSub: sub,
      status: u.status,
      assignedMentor: u.assignedMentor ?? prev?.assignedMentor ?? "",
      notes: u.notes ?? prev?.notes ?? "",
      lastActionDate: u.lastActionDate,
    });
    cases.set(college, map);
  },
  async actions(college) {
    return structuredClone(actions.get(college) ?? []);
  },
  async addAction(college, d) {
    const item: EarlyWarningIntervention = {
      id: randomUUID(),
      studentId: d.studentSub,
      studentName: d.studentName,
      rollNo: d.rollNo,
      department: d.department,
      strategy: d.strategy,
      facultyLead: d.facultyLead,
      targetDate: d.targetDate,
      status: "In progress",
      notes: d.notes,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    actions.set(college, [item, ...(actions.get(college) ?? [])]);
    return structuredClone(item);
  },
  async skills(college) {
    return structuredClone(skills.get(college) ?? []);
  },
  async addSkill(college, d) {
    const item: SkillIntervention = {
      id: randomUUID(),
      title: d.title,
      department: d.department,
      batch: d.batch,
      targetSkill: d.targetSkill,
      facultyLead: d.facultyLead,
      duration: d.duration,
      enrolledCount: 0,
      status: "Upcoming",
      impact: skillImpact(d.targetSkill),
    };
    skills.set(college, [item, ...(skills.get(college) ?? [])]);
    return structuredClone(item);
  },
};

export function supportData(): SupportData {
  return dataBackend() === "postgres" ? postgresSupport : memorySupport;
}
