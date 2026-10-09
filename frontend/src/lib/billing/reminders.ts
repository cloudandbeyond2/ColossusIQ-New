import "server-only";
import { randomUUID } from "node:crypto";
import type { SessionPayload } from "@/lib/auth/session";
import { RESOURCES } from "@/config/resources";
import { dataBackend, getStore } from "@/lib/data";
import { audit } from "@/lib/api/mock/audit";
import type { CollegeFees, CollegeStudentFee, FeeNotice, ReminderState } from "@/lib/api/billing-schemas";
import type { Notification } from "@/lib/api/schemas";
import { accessState, billingSettings, dueFor, feeFor, lockActive, lockDateOf, todayIso } from "./dues";
import { billingStore, type ReminderRow } from "./store";

/*
 * Fee reminders.
 *  - Students: from `reminderDays` before the due date (15 by default) until the fee is cleared, every page shows a
 *    due banner and a popup, and the notification bell carries it. Reminders the college office sends appear there too.
 *  - Principals: every student of their college with their fee status, and "Send reminder" to some or all unpaid.
 */

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
const notice = (r: ReminderRow): FeeNotice => ({ id: r.id, message: r.message, sentBy: r.sentBy, createdAt: r.createdAt });

/** What the student's due banner and popup should say (show = false when there is nothing to remind about). */
export async function reminderState(s: SessionPayload): Promise<ReminderState> {
  const { settings, configured } = await billingSettings();
  const today = todayIso();
  const base: ReminderState = { show: false, academicYear: settings.academicYear, amount: 0, currency: settings.currency, dueDate: settings.dueDate, lockDate: lockDateOf(settings), daysLeft: daysBetween(today, settings.dueDate), locked: false, autoLock: settings.autoLock, notices: [] };
  if (!configured || s.role !== "student" || s.college === "all") return base;
  const due = await dueFor(s, settings);
  if (due.status !== "Due" || due.amount <= 0) return base;
  const notices = (await (await billingStore()).listReminders(s.college, settings.academicYear)).filter((r) => r.userSub === null || r.userSub === s.sub).slice(0, 5).map(notice);
  const inWindow = today >= addDays(settings.dueDate, -settings.reminderDays);
  return { ...base, show: inWindow || notices.length > 0, amount: due.amount, locked: (await accessState(s)).locked, notices };
}

/** The notification-bell entries for a student's due fee. */
export async function feeNotifications(s: SessionPayload): Promise<Notification[]> {
  if (s.role !== "student") return [];
  try {
    const r = await reminderState(s);
    if (!r.show) return [];
    const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: r.currency, maximumFractionDigits: 0 }).format(r.amount);
    const when = r.daysLeft > 1 ? `is due in ${r.daysLeft} days` : r.daysLeft === 1 ? "is due tomorrow" : r.daysLeft === 0 ? "is due today" : `was due ${-r.daysLeft} day${r.daysLeft === -1 ? "" : "s"} ago`;
    const out: Notification[] = [
      { id: `fee-due-${r.academicYear}`, title: r.locked ? "Account locked: app fee unpaid" : `App fee ${when}`, body: `${money} for ${r.academicYear}. Pay under Fees & Payments${r.autoLock && !r.locked ? ` before ${r.lockDate} to keep your access` : ""}.`, when: "Fees", unread: true, tone: r.locked || r.daysLeft < 0 ? "rose" : "amber" },
    ];
    for (const n of r.notices.slice(0, 2)) out.push({ id: `fee-reminder-${n.id}`, title: `Fee reminder from ${n.sentBy}`, body: n.message.length > 140 ? `${n.message.slice(0, 137)}…` : n.message, when: new Date(n.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }), unread: true, tone: "amber" });
    return out;
  } catch {
    return [];
  }
}

/** Every student account of a college: sub (as in the session), name and email. */
async function studentRoster(college: string): Promise<Array<{ sub: string; name: string; email: string }>> {
  if (dataBackend() === "postgres") {
    const { collegeUuid } = await import("@/lib/data/postgres/lookups");
    const { db } = await import("@/lib/data/postgres/db");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (await (db() as any).roleAssignment.findMany({ where: { collegeId: await collegeUuid(college), role: "student" }, include: { user: { select: { id: true, fullName: true, email: true } } }, take: 10_000 })) as Array<{ user: { id: string; fullName: string; email: string } }>;
    return rows.map((r) => ({ sub: r.user.id, name: r.user.fullName, email: r.user.email }));
  }
  const users = await getStore().records.all(RESOURCES.users!, college);
  return users.filter((u) => u.role === "Student" && u.collegeId === college).map((u) => ({ sub: u.id, name: String(u.fullName ?? ""), email: String(u.email ?? "") }));
}

const CAN_REMIND = new Set(["institution", "admin"]);

/** The Principal's view: every student of the college with this year's fee status. */
export async function collegeFees(s: SessionPayload): Promise<CollegeFees> {
  const college = s.college;
  const { settings, configured } = await billingSettings();
  const store = await billingStore();
  const [roster, dues, payments, sent, fee] = await Promise.all([studentRoster(college), store.listDues(settings.academicYear, college), store.listPayments({ academicYear: settings.academicYear, college }), store.listReminders(college, settings.academicYear), feeFor(college, settings)]);
  const bySub = new Map<string, CollegeStudentFee>();
  const lastReminder = (sub: string) => sent.find((r) => r.userSub === sub || r.userSub === null)?.createdAt ?? null;
  for (const u of roster) bySub.set(u.sub, { userSub: u.sub, name: u.name, email: u.email, status: fee > 0 ? "Due" : "Waived", amount: fee, pendingOffline: false, signedIn: false, clearedAt: null, lastReminder: lastReminder(u.sub), method: "", payments: [] });
  for (const d of dues) {
    const known = bySub.get(d.userSub);
    bySub.set(d.userSub, { userSub: d.userSub, name: known?.name || d.name, email: known?.email ?? "", status: d.status, amount: d.amount, pendingOffline: false, signedIn: true, clearedAt: d.clearedAt, lastReminder: lastReminder(d.userSub), method: d.method, payments: [] });
  }
  for (const p of [...payments].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const row = bySub.get(p.userSub);
    if (!row) continue;
    if (p.status === "Pending verification") row.pendingOffline = true;
    if (row.payments.length < 10) row.payments.push({ receiptNo: p.receiptNo, amount: p.amount, status: p.status, via: p.gateway === "offline" ? p.offlineMode || "Offline" : String(p.gateway), reference: p.offlineRef || p.gatewayPaymentId, at: p.updatedAt || p.createdAt, note: p.reviewNote });
  }
  const students = [...bySub.values()].sort((a, b) => a.name.localeCompare(b.name));
  // Money: what has actually been paid, and what students who still owe would add. Waived students owe nothing.
  const collected = payments.filter((p) => p.status === "Paid").reduce((a, p) => a + p.amount, 0);
  const outstanding = students.filter((x) => x.status === "Due").reduce((a, x) => a + x.amount, 0);
  const expected = collected + outstanding;
  const summary = { collected, outstanding, expected, rate: expected > 0 ? Math.round((collected / expected) * 100) : 0 };
  return {
    configured,
    academicYear: settings.academicYear,
    fee,
    currency: settings.currency,
    dueDate: settings.dueDate,
    lockDate: lockDateOf(settings),
    reminderFrom: addDays(settings.dueDate, -settings.reminderDays),
    lockActive: lockActive(settings),
    canRemind: configured && CAN_REMIND.has(s.role),
    summary: configured ? summary : { collected: 0, outstanding: 0, expected: 0, rate: 0 },
    students: configured ? students : [],
    sent: sent.slice(0, 20).map((r) => ({ ...notice(r), to: r.userSub === null ? "All students with fees due" : (bySub.get(r.userSub)?.name ?? "1 student") })),
  };
}

/** Sends a fee reminder through the portal to the chosen students, or to every student whose fee is still due. */
export async function sendReminders(s: SessionPayload, students: string[] | undefined, message: string): Promise<{ sent: number } | { error: string }> {
  const view = await collegeFees(s);
  if (!view.configured) return { error: "Fee collection has not been opened by the University yet." };
  const due = view.students.filter((x) => x.status === "Due");
  const now = new Date().toISOString();
  const base = { college: s.college, academicYear: view.academicYear, message, sentBy: s.name, sentRole: s.role, createdAt: now };
  let rows: ReminderRow[];
  if (!students) {
    if (!due.length) return { error: "Every student's fee is already cleared." };
    rows = [{ ...base, id: randomUUID(), userSub: null }];
  } else {
    const allowed = new Set(due.map((x) => x.userSub));
    const chosen = [...new Set(students)].filter((x) => allowed.has(x));
    if (!chosen.length) return { error: "None of the chosen students has a fee due." };
    rows = chosen.map((userSub) => ({ ...base, id: randomUUID(), userSub }));
  }
  await (await billingStore()).addReminders(rows);
  const count = students ? rows.length : due.length;
  await audit(s.name, `fees.reminder:${students ? `${count} students` : "all unpaid"}`, s.college, { collegeId: s.college, actorSub: s.sub });
  return { sent: count };
}
