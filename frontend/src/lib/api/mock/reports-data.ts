import "server-only";
import { randomUUID } from "node:crypto";
import { dataBackend } from "@/lib/data";
import type { ReportBreakdownItem, ReportCategory, ReportKpi } from "@/lib/api/schemas";
import { postgresReports } from "@/lib/data/postgres/reports";
import { sharedState } from "./global-state";

/*
 * Compiled reports, report schedules and the live numbers a report is compiled from. In memory for the demo backend,
 * PostgreSQL otherwise (data/postgres/reports.ts). `college` is the college's public id.
 */

export type Frequency = "Weekly" | "Bi-Weekly" | "Monthly" | "End of Term";

export interface ReportRow {
  id: string;
  college: string;
  title: string;
  category: ReportCategory;
  scope: string;
  period: string;
  summary: string;
  kpis: ReportKpi[];
  breakdown: ReportBreakdownItem[];
  generatedBy: string;
  authorSub: string;
  authorRole: string;
  scheduleId: string | null;
  createdAt: string;
}
export type ReportDraft = Omit<ReportRow, "id" | "createdAt">;

export interface ScheduleRow {
  id: string;
  college: string;
  name: string;
  category: ReportCategory;
  scope: string;
  frequency: Frequency;
  recipients: string;
  enabled: boolean;
  /** yyyy-mm-dd */
  nextRun: string;
  lastRunAt: string | null;
  createdBySub: string;
}
export type ScheduleDraft = Omit<ScheduleRow, "id" | "lastRunAt">;

/** Real counts for a college (optionally one department). Nothing here is estimated. */
export interface ReportMetrics {
  collegeName: string;
  students: number;
  staff: number;
  courses: number;
  quizAttempts: number;
  quizPassed: number;
  /** students with quiz attempts */
  assessedStudents: number;
  /** of those, students whose average quiz score is below 60% */
  atRiskStudents: number;
  drives: number;
  openings: number;
  offers: number;
  topPackage: number;
}

export interface ReportsData {
  reports(college: string): Promise<ReportRow[]>;
  report(id: string): Promise<ReportRow | undefined>;
  addReport(draft: ReportDraft): Promise<ReportRow | undefined>;
  removeReport(id: string): Promise<boolean>;
  schedules(college: string): Promise<ScheduleRow[]>;
  schedule(id: string): Promise<ScheduleRow | undefined>;
  /** undefined when the college already has a schedule with that name. */
  addSchedule(draft: ScheduleDraft): Promise<ScheduleRow | undefined>;
  setEnabled(id: string, enabled: boolean): Promise<ScheduleRow | undefined>;
  removeSchedule(id: string): Promise<boolean>;
  /** Moves a due schedule forward; false when someone else already did (so a run is never compiled twice). */
  advance(id: string, expectedNextRun: string, nextRun: string): Promise<boolean>;
  /** "Institution" first, then the college's own departments. */
  scopes(college: string): Promise<string[]>;
  metrics(college: string, scope: string): Promise<ReportMetrics>;
}

const copy = <T>(v: T): T => structuredClone(v);

const reports = sharedState("campus.reports.rows.v3", () => new Map<string, ReportRow>());
const schedules = sharedState("campus.reports.schedules.v3", () => new Map<string, ScheduleRow>());

const emptyMetrics: ReportMetrics = {
  collegeName: "",
  students: 0,
  staff: 0,
  courses: 0,
  quizAttempts: 0,
  quizPassed: 0,
  assessedStudents: 0,
  atRiskStudents: 0,
  drives: 0,
  openings: 0,
  offers: 0,
  topPackage: 0,
};

const memoryReports: ReportsData = {
  async reports(college) {
    return [...reports.values()].filter((r) => r.college === college).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(copy);
  },
  async report(id) {
    const r = reports.get(id);
    return r ? copy(r) : undefined;
  },
  async addReport(draft) {
    const row: ReportRow = { ...copy(draft), id: randomUUID(), createdAt: new Date().toISOString() };
    reports.set(row.id, row);
    return copy(row);
  },
  async removeReport(id) {
    return reports.delete(id);
  },
  async schedules(college) {
    return [...schedules.values()].filter((s) => s.college === college).map(copy);
  },
  async schedule(id) {
    const s = schedules.get(id);
    return s ? copy(s) : undefined;
  },
  async addSchedule(draft) {
    if ([...schedules.values()].some((s) => s.college === draft.college && s.name.toLowerCase() === draft.name.toLowerCase())) return undefined;
    const row: ScheduleRow = { ...copy(draft), id: randomUUID(), lastRunAt: null };
    schedules.set(row.id, row);
    return copy(row);
  },
  async setEnabled(id, enabled) {
    const s = schedules.get(id);
    if (!s) return undefined;
    s.enabled = enabled;
    return copy(s);
  },
  async removeSchedule(id) {
    return schedules.delete(id);
  },
  async advance(id, expected, next) {
    const s = schedules.get(id);
    if (!s || s.nextRun !== expected) return false;
    s.nextRun = next;
    s.lastRunAt = new Date().toISOString();
    return true;
  },
  async scopes() {
    return ["Institution"];
  },
  async metrics() {
    return { ...emptyMetrics };
  },
};

/** Test helper (memory backend only). */
export function resetReportsMemory() {
  reports.clear();
  schedules.clear();
}

export function reportsData(): ReportsData {
  return dataBackend() === "postgres" ? postgresReports : memoryReports;
}
