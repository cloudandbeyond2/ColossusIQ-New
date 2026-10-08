import "server-only";
import type { SessionPayload } from "@/lib/auth/session";
import { ALL_COLLEGES } from "@/config/tenancy";
import { getCollege } from "@/lib/api/mock/records";
import { sharedState } from "@/lib/api/mock/global-state";
import { PLANS, type AccessState, type BillingSettings } from "@/lib/api/billing-schemas";
import { billingStore, type DueRow } from "./store";

/*
 * Who owes what this academic year, and who is locked out until it is cleared.
 *
 * Locking is evaluated on every request rather than by a scheduled job: once the Super Admin switches automatic
 * locking on, any student whose fee for the current academic year is still due after the due date plus the grace
 * period is locked, and (if "lock staff" is on) so is every staff member of a college the University has not
 * cleared. Rolling the academic year forward therefore locks everyone again until they are cleared for the new year.
 */

export const STAFF_ROLES = new Set(["faculty", "hod", "placement", "incubation", "institution"]);

export const todayIso = (now = new Date()) => now.toISOString().slice(0, 10);

export function defaultSettings(now = new Date()): BillingSettings {
  const y = now.getUTCMonth() >= 5 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return {
    academicYear: `${y}-${String((y + 1) % 100).padStart(2, "0")}`,
    yearStart: `${y}-06-01`,
    dueDate: `${y}-07-31`,
    graceDays: 15,
    reminderDays: 15,
    currency: "INR",
    autoLock: false,
    lockStaff: false,
    fees: { "Campus Starter": 500, "Campus Pro": 1000, "University Enterprise": 1500 },
    updatedBy: "",
    updatedAt: null,
  };
}

/** The saved settings, or the defaults (with locking off) when the Super Admin has not set billing up yet. */
export async function billingSettings(): Promise<{ settings: BillingSettings; configured: boolean }> {
  const saved = await (await billingStore()).getSettings();
  return saved ? { settings: saved, configured: true } : { settings: defaultSettings(), configured: false };
}

/** The last day before accounts lock: due date + grace days. */
export function lockDateOf(s: Pick<BillingSettings, "dueDate" | "graceDays">): string {
  const d = new Date(`${s.dueDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + s.graceDays);
  return d.toISOString().slice(0, 10);
}

/** Whether unpaid accounts are locked today. */
export function lockActive(s: BillingSettings, today = todayIso()): boolean {
  return s.autoLock && today > lockDateOf(s);
}

const planOf = (plan: unknown): (typeof PLANS)[number] => ((PLANS as readonly string[]).includes(String(plan)) ? (String(plan) as (typeof PLANS)[number]) : "Campus Pro");

/** This year's fee for a student of the college: the college's own fee if the University set one, else its plan's fee. */
export async function feeFor(college: string, s: BillingSettings): Promise<number> {
  const override = (await (await billingStore()).collegeBilling(s.academicYear)).find((c) => c.college === college)?.feeOverride;
  if (override !== null && override !== undefined) return override;
  return s.fees[planOf((await getCollege(college))?.plan)];
}

/** The student's due for this year: the saved row, or what it would be (not saved). */
export async function dueFor(session: SessionPayload, s: BillingSettings): Promise<DueRow> {
  const saved = await (await billingStore()).getDue(session.sub, s.academicYear);
  if (saved) return saved;
  const amount = await feeFor(session.college, s);
  return { userSub: session.sub, name: session.name, college: session.college, academicYear: s.academicYear, amount, status: amount > 0 ? "Due" : "Waived", method: amount > 0 ? "" : "waiver", clearedBy: "", clearedAt: null };
}

/** Saves the due the first time a student opens Fees & Payments, so the Super Admin sees them in the list. */
export async function ensureDue(session: SessionPayload, s: BillingSettings): Promise<DueRow> {
  const store = await billingStore();
  const saved = await store.getDue(session.sub, s.academicYear);
  if (saved) return saved;
  const due = await dueFor(session, s);
  await store.saveDue(due);
  return due;
}

const cache = sharedState("billing.access", () => new Map<string, { at: number; state: AccessState }>());
const TTL_MS = 30_000;

/** Forget cached lock states (after a payment, a clearance or a settings change). */
export function clearAccessCache(sub?: string) {
  if (sub) cache.delete(sub);
  else cache.clear();
}

const open = (s: BillingSettings): AccessState => ({ locked: false, reason: null, academicYear: s.academicYear, dueDate: s.dueDate, lockDate: lockDateOf(s) });

/** Whether the signed-in user is locked out until the fee (or the college) is cleared. */
export async function accessState(session: SessionPayload): Promise<AccessState> {
  const hit = cache.get(session.sub);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.state;
  const state = await computeAccess(session);
  cache.set(session.sub, { at: Date.now(), state });
  return state;
}

async function computeAccess(session: SessionPayload): Promise<AccessState> {
  const { settings: s, configured } = await billingSettings();
  const free = open(s);
  if (!configured || session.college === ALL_COLLEGES || !lockActive(s)) return free;
  if (session.role === "student") {
    const due = await dueFor(session, s);
    return due.status === "Due" && due.amount > 0 ? { ...free, locked: true, reason: "student_due" } : free;
  }
  if (s.lockStaff && STAFF_ROLES.has(session.role)) {
    const row = (await (await billingStore()).collegeBilling(s.academicYear)).find((c) => c.college === session.college);
    return row?.cleared ? free : { ...free, locked: true, reason: "college_uncleared" };
  }
  return free;
}

/** API areas a locked account may still use: its fee page, sign-in housekeeping and notices. */
export function allowedWhileLocked(segs: string[], role: string): boolean {
  const [a, b] = segs;
  if (a === "auth") return true;
  if (a === "notice-board") return true;
  if (a === "notifications") return true;
  return role === "student" && a === "fees" && b === "me";
}
