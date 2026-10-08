import "server-only";
import { dataBackend } from "@/lib/data";
import { sharedState } from "@/lib/api/mock/global-state";
import type { BillingSettings, DueStatus, FeePayment, PaymentStatus, StudentDue } from "@/lib/api/billing-schemas";

/*
 * Fees, payments and college clearance. In memory for the demo backend, PostgreSQL otherwise
 * (data/postgres/billing.ts, db/migrations/0020_billing.sql). `college` is always the college's public id.
 */

export interface CollegeBilling {
  college: string;
  academicYear: string;
  feeOverride: number | null;
  cleared: boolean;
  clearedBy: string;
  clearedAt: string | null;
}

export interface ReminderRow {
  id: string;
  college: string;
  academicYear: string;
  /** null: every student of the college whose fee is still due. */
  userSub: string | null;
  message: string;
  sentBy: string;
  sentRole: string;
  createdAt: string;
}

export type DueRow = StudentDue & { status: DueStatus };
export type PaymentRow = FeePayment;
export interface PaymentFilter {
  academicYear?: string;
  college?: string;
  status?: PaymentStatus;
  userSub?: string;
}

export interface BillingStore {
  getSettings(): Promise<BillingSettings | null>;
  saveSettings(s: BillingSettings): Promise<void>;
  collegeBilling(academicYear: string): Promise<CollegeBilling[]>;
  saveCollegeBilling(row: CollegeBilling): Promise<void>;
  getDue(userSub: string, academicYear: string): Promise<DueRow | undefined>;
  saveDue(row: DueRow): Promise<void>;
  listDues(academicYear: string, college?: string): Promise<DueRow[]>;
  createPayment(p: PaymentRow): Promise<void>;
  getPayment(id: string): Promise<PaymentRow | undefined>;
  updatePayment(id: string, patch: Partial<PaymentRow>): Promise<PaymentRow | undefined>;
  listPayments(f: PaymentFilter): Promise<PaymentRow[]>;
  addReminders(rows: ReminderRow[]): Promise<void>;
  listReminders(college: string, academicYear: string): Promise<ReminderRow[]>;
}

const settings = sharedState("billing.settings", () => ({ row: null as BillingSettings | null }));
const colleges = sharedState("billing.colleges", () => new Map<string, CollegeBilling>());
const dues = sharedState("billing.dues", () => new Map<string, DueRow>());
const payments = sharedState("billing.payments", () => new Map<string, PaymentRow>());
const reminders = sharedState("billing.reminders", () => [] as ReminderRow[]);

const memoryBilling: BillingStore = {
  async getSettings() {
    return settings.row ? structuredClone(settings.row) : null;
  },
  async saveSettings(s) {
    settings.row = structuredClone(s);
  },
  async collegeBilling(year) {
    return [...colleges.values()].filter((c) => c.academicYear === year).map((c) => structuredClone(c));
  },
  async saveCollegeBilling(row) {
    colleges.set(`${row.college}|${row.academicYear}`, structuredClone(row));
  },
  async getDue(sub, year) {
    const d = dues.get(`${sub}|${year}`);
    return d ? structuredClone(d) : undefined;
  },
  async saveDue(row) {
    dues.set(`${row.userSub}|${row.academicYear}`, structuredClone(row));
  },
  async listDues(year, college) {
    return [...dues.values()].filter((d) => d.academicYear === year && (!college || d.college === college)).map((d) => structuredClone(d));
  },
  async createPayment(p) {
    payments.set(p.id, structuredClone(p));
  },
  async getPayment(id) {
    const p = payments.get(id);
    return p ? structuredClone(p) : undefined;
  },
  async updatePayment(id, patch) {
    const p = payments.get(id);
    if (!p) return undefined;
    const next = { ...p, ...structuredClone(patch), id, updatedAt: new Date().toISOString() };
    payments.set(id, next);
    return structuredClone(next);
  },
  async listPayments(f) {
    return [...payments.values()]
      .filter((p) => (!f.academicYear || p.academicYear === f.academicYear) && (!f.college || p.college === f.college) && (!f.status || p.status === f.status) && (!f.userSub || p.userSub === f.userSub))
      .map((p) => structuredClone(p))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async addReminders(rows) {
    reminders.push(...structuredClone(rows));
  },
  async listReminders(college, year) {
    return reminders
      .filter((r) => r.college === college && r.academicYear === year)
      .map((r) => structuredClone(r))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
};

/** Test helper (memory backend only). */
export function resetBillingMemory() {
  settings.row = null;
  colleges.clear();
  dues.clear();
  payments.clear();
  reminders.length = 0;
}

export async function billingStore(): Promise<BillingStore> {
  if (dataBackend() !== "postgres") return memoryBilling;
  const { postgresBilling } = await import("@/lib/data/postgres/billing");
  return postgresBilling;
}
