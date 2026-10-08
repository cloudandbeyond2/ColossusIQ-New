import "server-only";
import { ALL_COLLEGES, COLLEGE_ID_RE } from "@/config/tenancy";
import { RESOURCES } from "@/config/resources";
import type { SessionPayload } from "@/lib/auth/session";
import { getStore } from "@/lib/data";
import {
  BillingOverview,
  BillingSettingsUpdate,
  CheckoutBody,
  ClearBody,
  DueList,
  GATEWAY_INTEGRATION,
  GATEWAY_NAMES,
  GATEWAYS,
  MyFees,
  OFFLINE_MODES,
  OfflineBody,
  PaymentList,
  PaymentStatus,
  ReminderState,
  RemindBody,
  CollegeFees,
  ReviewBody,
  WaiveBody,
  type FeePayment,
} from "@/lib/api/billing-schemas";
import { accessState, billingSettings, clearAccessCache, ensureDue, feeFor, lockActive, lockDateOf } from "@/lib/billing/dues";
import { enabledGateways, reviewOffline, setDueStatus, startOnline, submitOffline, clearCollege } from "@/lib/billing/payments";
import { billingStore } from "@/lib/billing/store";
import { collegeFees, reminderState, sendReminders } from "@/lib/billing/reminders";
import { audit } from "./audit";
import { getMedia } from "./media";
import { rateLimit } from "./rate-limit";
import { collegeIndex, listColleges } from "./records";
import type { MockResult } from "./router";

/*
 * Student app-usage fees.
 *   fees/me…    the student's own fee, payments and checkout (students only)
 *   billing/…   the University Super Admin's view: per-college collection, offline approvals, waivers, clearance
 *               and settings (changes only at "All colleges" with a confirmed sign-in code)
 */

const ok = (body: unknown, status = 200): MockResult => ({ status, body });
const err = (status: number, code: string, message: string, fields?: Record<string, string>): MockResult => ({ status, body: { error: { code, message, ...(fields ? { fields } : {}) } } });
const issues = (e: { issues: Array<{ path: PropertyKey[]; message: string }> }) => Object.fromEntries(e.issues.map((i) => [String(i.path[0] ?? "_"), i.message]));
/** The student never needs the receipt image id back; the Super Admin reads the image through billing/payments/:id/proof. */
const forStudent = (p: FeePayment): FeePayment => ({ ...p, proofMediaId: "" });
const NEEDS_CONTACT = new Set(["payu"]);

async function myFees(s: SessionPayload): Promise<MyFees> {
  const { settings, configured } = await billingSettings();
  const due = configured ? await ensureDue(s, settings) : { amount: 0, status: "Waived" as const };
  const payments = (await (await billingStore()).listPayments({ userSub: s.sub })).map(forStudent);
  const gateways = configured && due.status === "Due" ? (await enabledGateways()).map((g) => ({ id: g.id, name: GATEWAY_NAMES[g.id], needsContact: NEEDS_CONTACT.has(g.id) })) : [];
  return MyFees.parse({
    academicYear: settings.academicYear,
    amount: due.amount,
    currency: settings.currency,
    dueDate: settings.dueDate,
    lockDate: lockDateOf(settings),
    status: due.status,
    access: await accessState(s),
    gateways,
    offlineModes: configured ? [...OFFLINE_MODES] : [],
    pendingOffline: payments.some((p) => p.academicYear === settings.academicYear && p.status === "Pending verification"),
    payments,
  });
}

/** POST fees/me/checkout calls the gateway, so it runs before the request's database transaction opens. */
export async function prefetchFeeCheckout(method: string, segs: string[], rawBody: unknown, s: SessionPayload, origin: string): Promise<MockResult | null> {
  if (method !== "POST" || segs.join("/") !== "fees/me/checkout") return null;
  if (s.role !== "student" || !s.mfa || s.college === ALL_COLLEGES) return err(403, "forbidden", "Only students pay fees here.");
  if (!rateLimit(`fees-checkout:${s.sub}`, 10, 10 * 60_000).ok) return err(429, "rate_limited", "Too many payment attempts. Please wait a few minutes.");
  const p = CheckoutBody.safeParse(rawBody);
  if (!p.success) return err(422, "validation", "Please check your details.", issues(p.error));
  const r = await startOnline(s, p.data.gateway, { email: p.data.email, phone: p.data.phone }, origin);
  return r.ok ? ok(r.value) : err(r.status, r.code, r.message);
}

async function dispatchMyFees(method: string, segs: string[], rawBody: unknown, s: SessionPayload): Promise<MockResult> {
  if (s.role !== "student" || s.college === ALL_COLLEGES) return err(403, "forbidden", "Fees & Payments is for students.");
  if (method === "GET" && segs.length === 2) return ok(await myFees(s));
  // GET fees/me/reminder: the due banner / popup shown on every page.
  if (method === "GET" && segs[2] === "reminder" && segs.length === 3) return ok(ReminderState.parse(await reminderState(s)));
  if (method === "POST" && segs[2] === "offline" && segs.length === 3) {
    if (!rateLimit(`fees-offline:${s.sub}`, 5, 60 * 60_000).ok) return err(429, "rate_limited", "Too many submissions. Please try again later.");
    const p = OfflineBody.safeParse(rawBody);
    if (!p.success) return err(422, "validation", "Please correct the highlighted fields.", issues(p.error));
    const r = await submitOffline(s, p.data);
    if (!r.ok) return err(r.status, r.code, r.message, r.code === "invalid_image" ? { proof: r.message } : undefined);
    return ok(await myFees(s), 201);
  }
  return err(404, "not_found", "Not found.");
}

async function overview(s: SessionPayload): Promise<BillingOverview> {
  const { settings, configured } = await billingSettings();
  const store = await billingStore();
  const scope = s.college === ALL_COLLEGES ? null : s.college;
  const colleges = (await listColleges()).filter((c) => !scope || c.id === scope).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const [clear, dues, payments] = await Promise.all([store.collegeBilling(settings.academicYear), store.listDues(settings.academicYear), store.listPayments({ academicYear: settings.academicYear })]);
  const rows = await Promise.all(
    colleges.map(async (c) => {
      const cb = clear.find((x) => x.college === c.id);
      const d = dues.filter((x) => x.college === c.id);
      const paidRows = payments.filter((p) => p.college === c.id && p.status === "Paid");
      const students = await getStore().records.count(RESOURCES.admissions!, c.id, { status: "Enrolled" });
      const paid = d.filter((x) => x.status === "Paid").length;
      const waived = d.filter((x) => x.status === "Waived").length;
      return {
        id: c.id,
        name: String(c.name),
        city: String(c.city),
        plan: String(c.plan || "Campus Pro"),
        status: String(c.status),
        capacity: typeof c.studentCapacity === "number" ? c.studentCapacity : 0,
        students,
        fee: await feeFor(c.id, settings),
        feeOverride: cb?.feeOverride ?? null,
        paid,
        waived,
        pending: payments.filter((p) => p.college === c.id && p.status === "Pending verification").length,
        due: Math.max(0, Math.max(students, d.length) - paid - waived),
        collected: paidRows.reduce((a, p) => a + p.amount, 0),
        cleared: cb?.cleared ?? false,
        clearedBy: cb?.clearedBy ?? "",
        clearedAt: cb?.clearedAt ?? null,
      };
    }),
  );
  const sum = (k: "students" | "paid" | "waived" | "pending" | "due" | "collected") => rows.reduce((a, r) => a + r[k], 0);
  const on = new Set((await enabledGateways()).map((g) => g.id));
  const gateways = GATEWAYS.map((id) => ({ id, name: GATEWAY_NAMES[id], integration: GATEWAY_INTEGRATION[id], enabled: on.has(id) }));
  return BillingOverview.parse({
    settings,
    configured,
    lockActive: lockActive(settings),
    lockDate: lockDateOf(settings),
    canEdit: s.college === ALL_COLLEGES && s.mfa,
    colleges: rows,
    totals: { students: sum("students"), paid: sum("paid"), waived: sum("waived"), pending: sum("pending"), due: sum("due"), collected: sum("collected"), expected: rows.reduce((a, r) => a + r.students * r.fee, 0) },
    gateways,
  });
}

async function withCollegeNames<T extends { college: string }>(rows: T[]): Promise<Array<T & { collegeName: string }>> {
  const idx = await collegeIndex();
  return rows.map((r) => ({ ...r, collegeName: String(idx.get(r.college)?.name ?? r.college) }));
}

async function dispatchAdmin(method: string, segs: string[], rawBody: unknown, s: SessionPayload, query: URLSearchParams): Promise<MockResult> {
  if (s.role !== "admin") return err(403, "forbidden", "Subscriptions & Billing is managed by the University Super Admin.");
  const scope = s.college === ALL_COLLEGES ? undefined : s.college;
  const store = await billingStore();
  const route = segs.slice(1);

  if (method === "GET" && route.length === 1 && route[0] === "overview") return ok(await overview(s));

  if (method === "GET" && route.length === 1 && route[0] === "payments") {
    const status = PaymentStatus.safeParse(query.get("status"));
    const college = query.get("college");
    const { settings } = await billingSettings();
    const rows = await store.listPayments({ academicYear: query.get("year") === "all" ? undefined : settings.academicYear, status: status.success ? status.data : undefined, college: scope ?? (college && COLLEGE_ID_RE.test(college) ? college : undefined) });
    return ok(PaymentList.parse({ payments: await withCollegeNames(rows.slice(0, 1000)) }));
  }

  if (method === "GET" && route.length === 1 && route[0] === "dues") {
    const college = query.get("college");
    const { settings } = await billingSettings();
    const rows = await store.listDues(settings.academicYear, scope ?? (college && COLLEGE_ID_RE.test(college) ? college : undefined));
    return ok(DueList.parse({ dues: await withCollegeNames(rows.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 2000)) }));
  }

  // GET billing/payments/:id/proof: the receipt image of an offline payment, as data (never a public link).
  if (method === "GET" && route.length === 3 && route[0] === "payments" && route[2] === "proof") {
    const p = await store.getPayment(route[1] ?? "");
    if (!p || !p.proofMediaId || (scope && p.college !== scope)) return err(404, "not_found", "Not found.");
    const m = await getMedia(p.proofMediaId);
    if (!m) return err(404, "not_found", "The receipt image is no longer available.");
    return ok({ contentType: m.contentType, data: Buffer.from(m.bytes).toString("base64") });
  }

  // Everything below changes billing for the whole university.
  if (s.college !== ALL_COLLEGES) return err(409, "choose_scope", "Switch to “All colleges” to change billing.");
  if (!s.mfa) return err(403, "mfa_required", "Confirm your sign-in code first.");

  if (method === "PUT" && route.length === 1 && route[0] === "settings") {
    const p = BillingSettingsUpdate.safeParse(rawBody);
    if (!p.success) return err(422, "validation", "Please correct the highlighted fields.", issues(p.error));
    const { settings: before, configured } = await billingSettings();
    await store.saveSettings({ ...p.data, updatedBy: s.name, updatedAt: new Date().toISOString() });
    const changes = [!configured ? "opened" : null, before.academicYear !== p.data.academicYear ? `year=${p.data.academicYear}` : null, before.autoLock !== p.data.autoLock ? `autoLock=${p.data.autoLock}` : null, before.lockStaff !== p.data.lockStaff ? `lockStaff=${p.data.lockStaff}` : null].filter(Boolean).join(",") || "settings";
    await audit(s.name, `billing.settings:${changes}`, "billing", { collegeId: null, actorSub: s.sub });
    clearAccessCache();
    return ok(await overview(s));
  }

  if (method === "POST" && route.length === 3 && route[0] === "payments" && route[2] === "review") {
    const p = ReviewBody.safeParse(rawBody);
    if (!p.success) return err(422, "validation", "Invalid review.");
    const r = await reviewOffline(s, route[1] ?? "", p.data.approve, p.data.note);
    return r.ok ? ok({ payment: r.value }) : err(r.status, r.code, r.message);
  }

  if (method === "POST" && route.length === 3 && route[0] === "dues" && route[2] === "status") {
    const p = WaiveBody.safeParse(rawBody);
    if (!p.success) return err(422, "validation", "Invalid status.");
    const r = await setDueStatus(s, decodeURIComponent(route[1] ?? ""), p.data.status, p.data.note);
    return r.ok ? ok({ ok: true }) : err(r.status, r.code, r.message);
  }

  if (method === "POST" && route.length === 3 && route[0] === "colleges" && route[2] === "clear") {
    const id = route[1] ?? "";
    if (!COLLEGE_ID_RE.test(id) || !(await collegeIndex()).has(id)) return err(404, "not_found", "College not found.");
    const p = ClearBody.safeParse(rawBody);
    if (!p.success) return err(422, "validation", "Invalid request.", issues(p.error));
    await clearCollege(s, id, p.data.cleared, p.data.feeOverride);
    return ok(await overview(s));
  }

  return err(404, "not_found", "Not found.");
}

/** fees/college…: the Principal's list of the college's students and their fee status, and portal reminders. */
async function dispatchCollegeFees(method: string, segs: string[], rawBody: unknown, s: SessionPayload): Promise<MockResult> {
  if (s.role !== "institution" && s.role !== "admin") return err(403, "forbidden", "Student fees are visible to the Principal and the University.");
  if (s.college === ALL_COLLEGES) return err(409, "choose_college", "Switch into a college to see its students' fees.");
  if (method === "GET" && segs.length === 2) return ok(CollegeFees.parse(await collegeFees(s)));
  if (method === "POST" && segs[2] === "remind" && segs.length === 3) {
    if (!s.mfa) return err(403, "mfa_required", "Confirm your sign-in code first.");
    if (!rateLimit(`fees-remind:${s.sub}`, 20, 60 * 60_000).ok) return err(429, "rate_limited", "Too many reminders sent. Please try again later.");
    const p = RemindBody.safeParse(rawBody);
    if (!p.success) return err(422, "validation", "Please write a short message (5–500 characters).", issues(p.error));
    const r = await sendReminders(s, p.data.students, p.data.message);
    if ("error" in r) return err(409, "nothing_to_send", r.error);
    return ok({ sent: r.sent, view: CollegeFees.parse(await collegeFees(s)) });
  }
  return err(404, "not_found", "Not found.");
}

export async function dispatchBilling(method: string, segs: string[], rawBody: unknown, s: SessionPayload, query: URLSearchParams): Promise<MockResult> {
  if (segs[0] === "fees" && segs[1] === "me") return dispatchMyFees(method, segs, rawBody, s);
  if (segs[0] === "fees" && segs[1] === "college") return dispatchCollegeFees(method, segs, rawBody, s);
  if (segs[0] === "billing") return dispatchAdmin(method, segs, rawBody, s, query);
  return err(404, "not_found", "Not found.");
}
