import "server-only";
import type { BillingSettings } from "@/lib/api/billing-schemas";
import type { BillingStore, CollegeBilling, DueRow, PaymentRow, ReminderRow } from "@/lib/billing/store";
import { db } from "./db";
import { collegePublic, collegeUuid } from "./lookups";

/*
 * Student fees on PostgreSQL (db/migrations/0022_billing.sql). Row-level security keeps a college to its own dues
 * and payments, and lets only the University scope mark anything paid, waived or cleared.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const t = () => db() as any;
const day = (d: Date) => d.toISOString().slice(0, 10);
const num = (d: unknown) => Number(d);

interface SettingsRow {
  academicYear: string;
  yearStart: Date;
  dueDate: Date;
  graceDays: number;
  reminderDays: number;
  currency: string;
  autoLock: boolean;
  lockStaff: boolean;
  fees: BillingSettings["fees"];
  updatedBy: string;
  updatedAt: Date;
}
interface CollegeRow {
  collegeId: string;
  academicYear: string;
  feeOverride: unknown;
  cleared: boolean;
  clearedBy: string;
  clearedAt: Date | null;
}
interface DueDbRow {
  userSub: string;
  academicYear: string;
  collegeId: string;
  studentName: string;
  amount: unknown;
  status: string;
  method: string;
  clearedBy: string;
  clearedAt: Date | null;
}
type PaymentDbRow = Omit<PaymentRow, "college" | "amount" | "createdAt" | "updatedAt"> & { collegeId: string; amount: unknown; createdAt: Date; updatedAt: Date };

const toDue = async (r: DueDbRow): Promise<DueRow> => ({
  userSub: r.userSub,
  name: r.studentName,
  college: await collegePublic(r.collegeId),
  academicYear: r.academicYear,
  amount: num(r.amount),
  status: r.status as DueRow["status"],
  method: r.method,
  clearedBy: r.clearedBy,
  clearedAt: r.clearedAt ? r.clearedAt.toISOString() : null,
});

const toPayment = async (r: PaymentDbRow): Promise<PaymentRow> => {
  const { collegeId, amount, createdAt, updatedAt, ...rest } = r;
  return { ...rest, college: await collegePublic(collegeId), amount: num(amount), createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString() } as PaymentRow;
};

export const postgresBilling: BillingStore = {
  async getSettings() {
    try {
      if (t()?.billingSettings?.findUnique) {
        const r = (await t().billingSettings.findUnique({ where: { id: 1 } })) as SettingsRow | null;
        if (!r) return null;
        return { academicYear: r.academicYear, yearStart: day(r.yearStart), dueDate: day(r.dueDate), graceDays: r.graceDays, reminderDays: r.reminderDays, currency: r.currency as BillingSettings["currency"], autoLock: r.autoLock, lockStaff: r.lockStaff, fees: r.fees, updatedBy: r.updatedBy, updatedAt: r.updatedAt.toISOString() };
      }
      // Safe Raw SQL query fallback (works even if prisma client is in the process of generating)
      const rows = await t().$queryRaw<any[]>`SELECT academic_year, year_start, due_date, grace_days, reminder_days, currency, auto_lock, lock_staff, fees, updated_by, updated_at FROM billing_settings WHERE id = 1`;
      if (!rows || rows.length === 0) return null;
      const r = rows[0];
      return {
        academicYear: r.academic_year,
        yearStart: day(new Date(r.year_start)),
        dueDate: day(new Date(r.due_date)),
        graceDays: Number(r.grace_days ?? 15),
        reminderDays: Number(r.reminder_days ?? 15),
        currency: r.currency as BillingSettings["currency"],
        autoLock: Boolean(r.auto_lock),
        lockStaff: Boolean(r.lock_staff),
        fees: typeof r.fees === "string" ? JSON.parse(r.fees) : (r.fees || {}),
        updatedBy: r.updated_by || "",
        updatedAt: new Date(r.updated_at || Date.now()).toISOString(),
      };
    } catch {
      return null;
    }
  },
  async saveSettings(s) {
    const data = { academicYear: s.academicYear, yearStart: new Date(`${s.yearStart}T00:00:00Z`), dueDate: new Date(`${s.dueDate}T00:00:00Z`), graceDays: s.graceDays, reminderDays: s.reminderDays, currency: s.currency, autoLock: s.autoLock, lockStaff: s.lockStaff, fees: s.fees, updatedBy: s.updatedBy, updatedAt: new Date() };
    if (t()?.billingSettings?.upsert) {
      await t().billingSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
    } else {
      await t().$executeRaw`
        INSERT INTO billing_settings (id, academic_year, year_start, due_date, grace_days, reminder_days, currency, auto_lock, lock_staff, fees, updated_by, updated_at)
        VALUES (1, ${s.academicYear}, ${data.yearStart}::date, ${data.dueDate}::date, ${s.graceDays}, ${s.reminderDays}, ${s.currency}, ${s.autoLock}, ${s.lockStaff}, ${JSON.stringify(s.fees)}::jsonb, ${s.updatedBy}, now())
        ON CONFLICT (id) DO UPDATE SET
          academic_year = EXCLUDED.academic_year,
          year_start = EXCLUDED.year_start,
          due_date = EXCLUDED.due_date,
          grace_days = EXCLUDED.grace_days,
          reminder_days = EXCLUDED.reminder_days,
          currency = EXCLUDED.currency,
          auto_lock = EXCLUDED.auto_lock,
          lock_staff = EXCLUDED.lock_staff,
          fees = EXCLUDED.fees,
          updated_by = EXCLUDED.updated_by,
          updated_at = now()
      `;
    }
  },
  async collegeBilling(year) {
    if (!t()?.collegeBilling?.findMany) return [];
    const rows = (await t().collegeBilling.findMany({ where: { academicYear: year } })) as CollegeRow[];
    return Promise.all(rows.map(async (r): Promise<CollegeBilling> => ({ college: await collegePublic(r.collegeId), academicYear: r.academicYear, feeOverride: r.feeOverride === null ? null : num(r.feeOverride), cleared: r.cleared, clearedBy: r.clearedBy, clearedAt: r.clearedAt ? r.clearedAt.toISOString() : null })));
  },
  async saveCollegeBilling(row) {
    if (!t()?.collegeBilling?.upsert) return;
    const collegeId = await collegeUuid(row.college);
    const data = { feeOverride: row.feeOverride, cleared: row.cleared, clearedBy: row.clearedBy, clearedAt: row.clearedAt ? new Date(row.clearedAt) : null };
    await t().collegeBilling.upsert({ where: { collegeId_academicYear: { collegeId, academicYear: row.academicYear } }, create: { collegeId, academicYear: row.academicYear, ...data }, update: data });
  },
  async getDue(sub, year) {
    if (!t()?.studentDue?.findUnique) return undefined;
    const r = (await t().studentDue.findUnique({ where: { userSub_academicYear: { userSub: sub, academicYear: year } } })) as DueDbRow | null;
    return r ? toDue(r) : undefined;
  },
  async saveDue(row) {
    if (!t()?.studentDue) return;
    const data = { collegeId: await collegeUuid(row.college), studentName: row.name.slice(0, 120), amount: row.amount, status: row.status, method: row.method, clearedBy: row.clearedBy, clearedAt: row.clearedAt ? new Date(row.clearedAt) : null };
    const key = { userSub: row.userSub, academicYear: row.academicYear };
    // Inside a college the row can only be created (row-level security); updates come from the University scope.
    const exists = await t().studentDue.findUnique({ where: { userSub_academicYear: key }, select: { userSub: true } });
    if (exists) await t().studentDue.update({ where: { userSub_academicYear: key }, data });
    else await t().studentDue.create({ data: { ...key, ...data } });
  },
  async listDues(year, college) {
    if (!t()?.studentDue?.findMany) return [];
    const where = { academicYear: year, ...(college ? { collegeId: await collegeUuid(college) } : {}) };
    return Promise.all(((await t().studentDue.findMany({ where, take: 5000 })) as DueDbRow[]).map(toDue));
  },
  async createPayment(p) {
    if (!t()?.feePayment?.create) return;
    const { college, ...rest } = p;
    await t().feePayment.create({ data: { ...rest, collegeId: await collegeUuid(college), createdAt: new Date(p.createdAt), updatedAt: new Date(p.updatedAt) } });
  },
  async getPayment(id) {
    if (!/^PAY-[a-f0-9]{20}$/.test(id) || !t()?.feePayment?.findUnique) return undefined;
    const r = (await t().feePayment.findUnique({ where: { id } })) as PaymentDbRow | null;
    return r ? toPayment(r) : undefined;
  },
  async updatePayment(id, patch) {
    if (!t()?.feePayment?.update) return undefined;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, college: _c, createdAt: _cr, updatedAt: _u, ...data } = patch;
    const r = (await t().feePayment.update({ where: { id }, data: { ...data, updatedAt: new Date() } })) as PaymentDbRow;
    return toPayment(r);
  },
  async listPayments(f) {
    if (!t()?.feePayment?.findMany) return [];
    const where = {
      ...(f.academicYear ? { academicYear: f.academicYear } : {}),
      ...(f.college ? { collegeId: await collegeUuid(f.college) } : {}),
      ...(f.status ? { status: f.status } : {}),
      ...(f.userSub ? { userSub: f.userSub } : {}),
    };
    return Promise.all(((await t().feePayment.findMany({ where, orderBy: { createdAt: "desc" }, take: 2000 })) as PaymentDbRow[]).map(toPayment));
  },
  async addReminders(rows) {
    if (!rows.length || !t()?.feeReminder?.createMany) return;
    const data = await Promise.all(rows.map(async (r) => ({ collegeId: await collegeUuid(r.college), academicYear: r.academicYear, userSub: r.userSub, message: r.message, sentBy: r.sentBy, sentRole: r.sentRole })));
    await t().feeReminder.createMany({ data });
  },
  async listReminders(college, year) {
    if (!t()?.feeReminder?.findMany) return [];
    const rows = (await t().feeReminder.findMany({ where: { collegeId: await collegeUuid(college), academicYear: year }, orderBy: { createdAt: "desc" }, take: 5000 })) as Array<Omit<ReminderRow, "college" | "createdAt"> & { collegeId: string; createdAt: Date }>;
    return rows.map((r) => ({ id: r.id, college, academicYear: r.academicYear, userSub: r.userSub, message: r.message, sentBy: r.sentBy, sentRole: r.sentRole, createdAt: r.createdAt.toISOString() }));
  },
};
