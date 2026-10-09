import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createHmac } from "node:crypto";
import { BillingOverview, Checkout, CollegeFees, DueList, MyFees, PaymentList } from "@/lib/api/billing-schemas";
import { prefetchFeeCheckout } from "@/lib/api/mock/billing";
import { dispatch } from "@/lib/api/mock/router";
import { accessState, allowedWhileLocked, clearAccessCache, lockDateOf } from "@/lib/billing/dues";
import { applyVerified, gatewaySettings, markPaid } from "@/lib/billing/payments";
import { billingStore, resetBillingMemory } from "@/lib/billing/store";
import { paymentIdOf, verifyReturn } from "@/lib/billing/gateways";
import { resetIntegrationsMemory } from "@/lib/integrations/config";
import type { SessionPayload } from "@/lib/auth/session";

const admin: SessionPayload = { sub: "demo-admin", role: "admin", name: "Super Admin", tenant: "uni-tntu", college: "all", mfa: true, exp: 9e9 };
const student: SessionPayload = { sub: "demo-student-COL-1001", role: "student", name: "Asha Kumar", tenant: "uni-tntu", college: "COL-1001", mfa: true, exp: 9e9 };
const other: SessionPayload = { ...student, sub: "demo-student-2", name: "Ravi" };
const faculty: SessionPayload = { ...student, sub: "demo-faculty-COL-1001", role: "faculty", name: "Dr Meena" };
const q = new URLSearchParams();
const call = (s: SessionPayload, method: string, path: string, body?: unknown, query = q) => dispatch(method, path.split("/"), body, s, query);

const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const settings = (over: Record<string, unknown> = {}) => ({
  academicYear: "2020-21",
  yearStart: "2020-06-01",
  dueDate: "2020-07-31",
  graceDays: 10,
  reminderDays: 15,
  currency: "INR",
  autoLock: true,
  lockStaff: true,
  fees: { "Campus Starter": 500, "Campus Pro": 1000, "University Enterprise": 1500 },
  ...over,
});
const open = async (over: Record<string, unknown> = {}) => {
  const r = await call(admin, "PUT", "billing/settings", settings(over));
  expect(r.status).toBe(200);
  clearAccessCache();
};
const fees = async (s = student) => MyFees.parse((await call(s, "GET", "fees/me")).body);

beforeEach(() => {
  resetBillingMemory();
  resetIntegrationsMemory();
  clearAccessCache();
});
afterEach(() => vi.unstubAllGlobals());

describe("Student app fees", () => {
  it("shows nothing due and locks nobody until the Super Admin opens fee collection", async () => {
    const f = await fees();
    expect(f.status).toBe("Waived");
    expect(f.access.locked).toBe(false);
    expect(f.offlineModes).toEqual([]);
    expect((await accessState(student)).locked).toBe(false);
  });

  it("only the Super Admin at All colleges with a confirmed code changes settings", async () => {
    expect((await call(student, "PUT", "billing/settings", settings())).status).toBe(403);
    expect((await call({ ...admin, college: "COL-1001" }, "PUT", "billing/settings", settings())).status).toBe(409);
    expect((await call({ ...admin, mfa: false }, "PUT", "billing/settings", settings())).status).toBe(403);
    expect((await call(admin, "PUT", "billing/settings", settings({ dueDate: "2020-05-01" }))).status).toBe(422);
    expect((await call(admin, "PUT", "billing/settings", settings({ academicYear: "2020-22" }))).status).toBe(422);
    expect((await call(admin, "PUT", "billing/settings", settings({ bogus: 1 }))).status).toBe(422);
    expect((await call(admin, "PUT", "billing/settings", settings())).status).toBe(200);
    expect(lockDateOf(settings())).toBe("2020-08-10");
  });

  it("charges the plan fee, or the college's own fee", async () => {
    await open({ autoLock: false });
    const plan = (await fees()).amount;
    expect([500, 1000, 1500]).toContain(plan);
    expect((await call(admin, "POST", "billing/colleges/COL-1001/clear", { cleared: false, feeOverride: 750 })).status).toBe(200);
    expect((await fees(other)).amount).toBe(750);
    // A due already opened keeps its amount.
    expect((await fees()).amount).toBe(plan);
  });

  it("locks an unpaid student after the due date + grace, but keeps the fee page open", async () => {
    await open();
    const s = await accessState(student);
    expect(s).toMatchObject({ locked: true, reason: "student_due", academicYear: "2020-21" });
    expect(allowedWhileLocked(["fees", "me"], "student")).toBe(true);
    expect(allowedWhileLocked(["auth", "session"], "student")).toBe(true);
    expect(allowedWhileLocked(["notice-board"], "student")).toBe(true);
    expect(allowedWhileLocked(["mentor", "chat"], "student")).toBe(false);
    expect(allowedWhileLocked(["fees", "me"], "faculty")).toBe(false);
    // Lock off → open again.
    await open({ autoLock: false });
    expect((await accessState(student)).locked).toBe(false);
    // Due date not reached yet → open.
    await open({ academicYear: "2099-00", yearStart: "2099-06-01", dueDate: "2099-07-31" });
    expect((await accessState(student)).locked).toBe(false);
  });

  it("locks staff until the University clears their college; never the Super Admin", async () => {
    await open();
    expect(await accessState(faculty)).toMatchObject({ locked: true, reason: "college_uncleared" });
    expect((await accessState(admin)).locked).toBe(false);
    const r = await call(admin, "POST", "billing/colleges/COL-1001/clear", { cleared: true });
    expect(r.status).toBe(200);
    expect(BillingOverview.parse(r.body).colleges.find((c) => c.id === "COL-1001")?.cleared).toBe(true);
    expect((await accessState(faculty)).locked).toBe(false);
    await open({ lockStaff: false });
    await call(admin, "POST", "billing/colleges/COL-1001/clear", { cleared: false });
    expect((await accessState(faculty)).locked).toBe(false);
  });

  it("offline payment: student submits a receipt, the Super Admin approves, the student is cleared", async () => {
    await open();
    const bad = await call(student, "POST", "fees/me/offline", { mode: "Cash", reference: "R-1", paidOn: "2020-07-01", proof: { contentType: "image/png", data: "AAAA" } });
    expect(bad.status).toBe(422);
    const sent = await call(student, "POST", "fees/me/offline", { mode: "Demand draft", reference: "DD 004512", paidOn: "2020-07-01", proof: { contentType: "image/png", data: PNG } });
    expect(sent.status).toBe(201);
    const after = MyFees.parse(sent.body);
    expect(after.pendingOffline).toBe(true);
    expect(after.payments[0]?.proofMediaId).toBe(""); // the student never gets the image id back
    // One pending at a time; no online checkout while it waits.
    expect((await call(student, "POST", "fees/me/offline", { mode: "Cash", reference: "R-2", paidOn: "2020-07-01", proof: { contentType: "image/png", data: PNG } })).status).toBe(409);

    const queue = PaymentList.parse((await call(admin, "GET", "billing/payments", undefined, new URLSearchParams({ status: "Pending verification" }))).body).payments;
    expect(queue).toHaveLength(1);
    const id = queue[0]!.id;
    const proof = await call(admin, "GET", `billing/payments/${id}/proof`);
    expect(proof.body).toMatchObject({ contentType: "image/png" });
    expect((await call(student, "POST", `billing/payments/${id}/review`, { approve: true })).status).toBe(403);
    expect((await call({ ...admin, college: "COL-1001" }, "POST", `billing/payments/${id}/review`, { approve: true })).status).toBe(409);
    expect((await call(admin, "POST", `billing/payments/${id}/review`, { approve: true, note: "DD verified" })).status).toBe(200);
    expect((await call(admin, "POST", `billing/payments/${id}/review`, { approve: true })).status).toBe(409);

    const f = await fees();
    expect(f.status).toBe("Paid");
    expect(f.access.locked).toBe(false);
    expect(f.payments[0]).toMatchObject({ status: "Paid", reviewedBy: "Super Admin" });
    expect(f.payments[0]!.receiptNo).toMatch(/^CIQ\/2020-21\/[0-9A-F]{10}$/);
  });

  it("a rejected offline payment leaves the fee due", async () => {
    await open();
    await call(student, "POST", "fees/me/offline", { mode: "Cash", reference: "R-9", paidOn: "2020-07-01", proof: { contentType: "image/png", data: PNG } });
    const id = PaymentList.parse((await call(admin, "GET", "billing/payments")).body).payments[0]!.id;
    expect((await call(admin, "POST", `billing/payments/${id}/review`, { approve: false, note: "Receipt unreadable" })).status).toBe(200);
    const f = await fees();
    expect(f).toMatchObject({ status: "Due", pendingOffline: false });
    expect(f.payments[0]).toMatchObject({ status: "Rejected", reviewNote: "Receipt unreadable" });
  });

  it("the Super Admin can waive a fee or set it back to due", async () => {
    await open();
    await fees();
    const list = DueList.parse((await call(admin, "GET", "billing/dues")).body).dues;
    expect(list.map((d) => d.userSub)).toContain(student.sub);
    expect((await call(admin, "POST", `billing/dues/${student.sub}/status`, { status: "Waived", note: "Scholarship" })).status).toBe(200);
    expect((await accessState(student)).locked).toBe(false);
    expect((await call(admin, "POST", `billing/dues/${student.sub}/status`, { status: "Due" })).status).toBe(200);
    expect((await accessState(student)).locked).toBe(true);
    expect((await call(admin, "POST", "billing/dues/nobody/status", { status: "Waived" })).status).toBe(404);
  });

  it("starting a new academic year makes every fee due again", async () => {
    await open();
    await call(student, "POST", "fees/me/offline", { mode: "Cash", reference: "R-1", paidOn: "2020-07-01", proof: { contentType: "image/png", data: PNG } });
    const id = PaymentList.parse((await call(admin, "GET", "billing/payments")).body).payments[0]!.id;
    await call(admin, "POST", `billing/payments/${id}/review`, { approve: true });
    expect((await accessState(student)).locked).toBe(false);
    await open({ academicYear: "2021-22", yearStart: "2021-06-01", dueDate: "2021-07-31" });
    expect(await accessState(student)).toMatchObject({ locked: true, academicYear: "2021-22" });
  });
});

describe("Online fee payment (Razorpay)", () => {
  const razorpay = { provider: "razorpay", enabled: true, values: { keyId: "rzp_test_abc123" }, secrets: { keySecret: "secret_xyz", webhookSecret: "whsec_1" }, clear: [] };

  it("creates a payment link, then marks the fee paid only on a valid signed return", async () => {
    await open();
    expect((await call(admin, "PUT", "integrations/payments", razorpay)).status).toBe(200);
    expect((await fees()).gateways.map((g) => g.id)).toEqual(["razorpay"]);

    let linkAmount = 0;
    let ref = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith("/v1/payment_links") && init?.method === "POST") {
          const b = JSON.parse(String(init.body)) as { amount: number; reference_id: string; callback_url: string };
          linkAmount = b.amount;
          ref = b.reference_id;
          expect(b.callback_url).toBe(`https://campus.test/api/payments/razorpay/return?pid=${ref}`);
          return new Response(JSON.stringify({ id: "plink_1", short_url: "https://rzp.io/i/abc" }), { status: 200 });
        }
        if (url.endsWith("/v1/payment_links/plink_1")) return new Response(JSON.stringify({ status: "paid", amount_paid: linkAmount, currency: "INR", reference_id: ref }), { status: 200 });
        return new Response("{}", { status: 404 });
      }),
    );

    // Only students; the amount comes from the server.
    expect((await prefetchFeeCheckout("POST", ["fees", "me", "checkout"], { gateway: "razorpay" }, faculty, "https://campus.test"))?.status).toBe(403);
    const r = await prefetchFeeCheckout("POST", ["fees", "me", "checkout"], { gateway: "razorpay" }, student, "https://campus.test");
    expect(r?.status).toBe(200);
    expect(Checkout.parse(r!.body)).toEqual({ kind: "redirect", url: "https://rzp.io/i/abc" });
    const due = (await fees()).amount;
    expect(linkAmount).toBe(due * 100);

    const e = (await gatewaySettings("razorpay"))!;
    const payment = (await (await billingStore()).getPayment(ref))!;
    const signed = (status: string, secret = "secret_xyz") => ({
      pid: ref,
      razorpay_payment_id: "pay_9",
      razorpay_payment_link_id: "plink_1",
      razorpay_payment_link_reference_id: ref,
      razorpay_payment_link_status: status,
      razorpay_signature: createHmac("sha256", secret).update(`plink_1|${ref}|${status}|pay_9`).digest("hex"),
    });
    expect(paymentIdOf("razorpay", e, signed("paid"))?.id).toBe(ref);

    // A forged signature is rejected.
    const forged = await verifyReturn("razorpay", e, signed("paid", "wrong"), payment);
    expect(forged).toMatchObject({ ok: false, reason: "bad_signature" });
    expect((await accessState(student)).locked).toBe(true);

    // A genuine one clears the student, and applying it twice is harmless.
    const v = await verifyReturn("razorpay", e, signed("paid"), payment);
    expect(v.ok).toBe(true);
    expect(await applyVerified("razorpay", v)).toBe("paid");
    expect(await applyVerified("razorpay", v)).toBe("paid");
    const f = await fees();
    expect(f.status).toBe("Paid");
    expect(f.access.locked).toBe(false);
    expect(f.payments.filter((p) => p.status === "Paid")).toHaveLength(1);

    // Nothing left to pay.
    expect((await prefetchFeeCheckout("POST", ["fees", "me", "checkout"], { gateway: "razorpay" }, student, "https://campus.test"))?.status).toBe(409);
  });

  it("rejects a return whose paid amount does not match", async () => {
    await open();
    await call(admin, "PUT", "integrations/payments", razorpay);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === "POST") return new Response(JSON.stringify({ id: "plink_2", short_url: "https://rzp.io/i/x" }), { status: 200 });
        const ref = (await (await billingStore()).listPayments({ userSub: student.sub }))[0]!.id;
        return new Response(JSON.stringify({ status: "paid", amount_paid: 100, currency: "INR", reference_id: ref }), { status: 200 });
      }),
    );
    await prefetchFeeCheckout("POST", ["fees", "me", "checkout"], { gateway: "razorpay" }, student, "https://campus.test");
    const payment = (await (await billingStore()).listPayments({ userSub: student.sub }))[0]!;
    const sig = createHmac("sha256", "secret_xyz").update(`plink_2|${payment.id}|paid|pay_1`).digest("hex");
    const v = await verifyReturn("razorpay", (await gatewaySettings("razorpay"))!, { razorpay_payment_id: "pay_1", razorpay_payment_link_id: "plink_2", razorpay_payment_link_reference_id: payment.id, razorpay_payment_link_status: "paid", razorpay_signature: sig }, payment);
    expect(v).toMatchObject({ ok: false, reason: "amount_mismatch" });
    expect(await applyVerified("razorpay", v)).toBe("failed");
    expect((await fees()).status).toBe("Due");
  });

  it("markPaid is idempotent", async () => {
    await open();
    const fresh = { ...student, sub: "demo-student-idem" };
    expect((await call(fresh, "POST", "fees/me/offline", { mode: "Cash", reference: "R-1", paidOn: "2020-07-01", proof: { contentType: "image/png", data: PNG } })).status).toBe(201);
    const id = (await (await billingStore()).listPayments({ userSub: fresh.sub }))[0]!.id;
    const a = await markPaid(id, { actor: "x", method: "offline" });
    const b = await markPaid(id, { actor: "y", method: "offline" });
    expect(a?.receiptNo).toBe(b?.receiptNo);
    expect(b?.reviewedBy).toBe("x");
  });
});

describe("Fee reminders", () => {
  const principal: SessionPayload = { ...student, sub: "demo-institution-COL-1001", role: "institution", name: "Principal" };
  const inDays = (n: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const year = (() => {
    const y = new Date().getUTCFullYear();
    return { academicYear: `${y}-${String((y + 1) % 100).padStart(2, "0")}`, yearStart: `${y - 1}-01-01` };
  })();

  it("shows the due reminder from 15 days before the due date until the fee is cleared", async () => {
    await open({ ...year, dueDate: inDays(20), autoLock: false });
    const far = (await call(student, "GET", "fees/me/reminder")).body as { show: boolean };
    expect(far.show).toBe(false);
    await open({ ...year, dueDate: inDays(10), autoLock: false });
    const near = (await call(student, "GET", "fees/me/reminder")).body as { show: boolean; daysLeft: number };
    expect(near).toMatchObject({ show: true, daysLeft: 10 });
    const bell = (await call(student, "GET", "notifications")).body as Array<{ id: string; title: string }>;
    expect(bell[0]).toMatchObject({ title: "App fee is due in 10 days" });
    await fees();
    await call(admin, "POST", `billing/dues/${student.sub}/status`, { status: "Waived" });
    expect(((await call(student, "GET", "fees/me/reminder")).body as { show: boolean }).show).toBe(false);
  });

  it("the Principal sees the college's students and can remind the unpaid ones through the portal", async () => {
    await open({ ...year, dueDate: inDays(40), autoLock: false });
    await fees(); // student opens their fee page
    await fees(other);
    await call(admin, "POST", `billing/dues/${other.sub}/status`, { status: "Waived" });

    expect((await call(student, "GET", "fees/college")).status).toBe(403);
    expect((await call(admin, "GET", "fees/college")).status).toBe(409);
    const view = CollegeFees.parse((await call(principal, "GET", "fees/college")).body);
    const mine = view.students.find((s) => s.userSub === student.sub);
    expect(mine).toMatchObject({ status: "Due", signedIn: true });
    expect(view.students.find((s) => s.userSub === other.sub)?.status).toBe("Waived");
    // Money summary and payment history come from the live stores: a waived student owes nothing, a due one adds to "outstanding".
    expect(view.summary.outstanding).toBeGreaterThanOrEqual(mine!.amount);
    expect(view.summary.expected).toBe(view.summary.collected + view.summary.outstanding);
    expect(view.summary.rate).toBeGreaterThanOrEqual(0);
    expect(view.summary.rate).toBeLessThanOrEqual(100);
    expect(mine!.payments).toEqual([]);
    expect(view.students.find((s) => s.userSub === other.sub)?.method).toBe("waiver");

    // Outside the 15-day window there is no reminder until the college sends one.
    expect(((await call(student, "GET", "fees/me/reminder")).body as { show: boolean }).show).toBe(false);
    expect((await call(principal, "POST", "fees/college/remind", { message: "hi" })).status).toBe(422);
    expect((await call(principal, "POST", "fees/college/remind", { students: [other.sub], message: "Please pay your fee." })).status).toBe(409);
    const sent = await call(principal, "POST", "fees/college/remind", { message: "Please pay the app fee this week. — Office" });
    expect(sent.status).toBe(200);
    expect((sent.body as { sent: number }).sent).toBeGreaterThanOrEqual(1);

    const r = (await call(student, "GET", "fees/me/reminder")).body as { show: boolean; notices: Array<{ message: string; sentBy: string }> };
    expect(r.show).toBe(true);
    expect(r.notices[0]).toMatchObject({ message: "Please pay the app fee this week. — Office", sentBy: "Principal" });
    // A waived student is not reminded.
    expect(((await call(other, "GET", "fees/me/reminder")).body as { show: boolean }).show).toBe(false);
    const bell = (await call(student, "GET", "notifications")).body as Array<{ title: string }>;
    expect(bell.some((n) => n.title === "Fee reminder from Principal")).toBe(true);
  });
});
