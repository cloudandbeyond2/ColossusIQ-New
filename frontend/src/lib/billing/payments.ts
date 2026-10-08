import "server-only";
import { randomBytes } from "node:crypto";
import type { SessionPayload } from "@/lib/auth/session";
import { withRequestContext } from "@/lib/data";
import { audit } from "@/lib/api/mock/audit";
import { saveMedia } from "@/lib/api/mock/media";
import { activeIntegration, type EffectiveIntegration } from "@/lib/integrations/config";
import { GATEWAY_INTEGRATION, GATEWAY_NAMES, GATEWAYS, type Checkout, type DueStatus, type Gateway } from "@/lib/api/billing-schemas";
import { billingSettings, clearAccessCache, ensureDue } from "./dues";
import { createCheckout, GatewayError, type Verified } from "./gateways";
import { billingStore, type PaymentRow } from "./store";

/*
 * Starting, confirming and reviewing fee payments. Every function except startOnline() runs inside the caller's
 * request context (database transaction); startOnline() opens its own around the gateway call so a slow gateway
 * never holds a transaction open.
 */

export type Outcome<T> = { ok: true; value: T } | { ok: false; status: number; code: string; message: string };
const fail = (status: number, code: string, message: string): Outcome<never> => ({ ok: false, status, code, message });

export const newPaymentId = () => `PAY-${randomBytes(10).toString("hex")}`;
export const receiptNo = (p: Pick<PaymentRow, "id" | "academicYear">) => `CIQ/${p.academicYear}/${p.id.slice(4, 14).toUpperCase()}`;

/** Gateways the Super Admin has switched on (and filled in) under Integrations & Setup. */
export async function enabledGateways(): Promise<Array<{ id: Gateway; e: EffectiveIntegration }>> {
  const out: Array<{ id: Gateway; e: EffectiveIntegration }> = [];
  for (const id of GATEWAYS) {
    const e = await activeIntegration(GATEWAY_INTEGRATION[id]);
    if (e) out.push({ id, e });
  }
  return out;
}

export async function gatewaySettings(gw: Gateway): Promise<EffectiveIntegration | null> {
  return activeIntegration(GATEWAY_INTEGRATION[gw]);
}

function blankPayment(due: { userSub: string; name: string; college: string; academicYear: string; amount: number }, currency: string, gateway: PaymentRow["gateway"]): PaymentRow {
  const now = new Date().toISOString();
  const id = newPaymentId();
  return { id, receiptNo: "", userSub: due.userSub, studentName: due.name, college: due.college, academicYear: due.academicYear, amount: due.amount, currency, gateway, gatewayOrderId: "", gatewayPaymentId: "", status: "Created", offlineMode: "", offlineRef: "", proofMediaId: "", reviewedBy: "", reviewNote: "", createdAt: now, updatedAt: now };
}

/** Student: create a payment for this year's fee and hand back the gateway's checkout. */
export async function startOnline(session: SessionPayload, gw: Gateway, contact: { email?: string; phone?: string }, origin: string): Promise<Outcome<Checkout>> {
  const e = await gatewaySettings(gw);
  if (!e) return fail(409, "gateway_off", `${GATEWAY_NAMES[gw]} is not available. Choose another way to pay.`);
  const ctx = { scope: session.college, sub: session.sub };
  const created = await withRequestContext(ctx, async (): Promise<Outcome<PaymentRow>> => {
    const { settings: s, configured } = await billingSettings();
    if (!configured) return fail(409, "not_open", "Fee payment has not been opened by the University yet.");
    const due = await ensureDue(session, s);
    if (due.status !== "Due" || due.amount <= 0) return fail(409, "nothing_due", "Your fee for this year is already cleared.");
    const store = await billingStore();
    const pending = (await store.listPayments({ userSub: session.sub, academicYear: s.academicYear })).find((p) => p.status === "Pending verification");
    if (pending) return fail(409, "pending_offline", "Your offline payment is waiting to be verified by the University.");
    const p = blankPayment({ ...due, name: session.name }, s.currency, gw);
    await store.createPayment(p);
    return { ok: true, value: p };
  });
  if (!created.ok) return created;
  const p = created.value;
  try {
    const r = await createCheckout(gw, e, { payment: p, origin, contact, description: `ColossusIQ app fee ${p.academicYear}` });
    await withRequestContext(ctx, async () => {
      await (await billingStore()).updatePayment(p.id, { gatewayOrderId: r.orderId });
      await audit(session.name, `fees.checkout:${gw}`, p.id, { collegeId: session.college, actorSub: session.sub });
    });
    return { ok: true, value: r.checkout };
  } catch (err) {
    await withRequestContext(ctx, async () => (await billingStore()).updatePayment(p.id, { status: "Failed", reviewNote: "Could not start the gateway checkout." }));
    if (err instanceof GatewayError) return fail(502, "gateway_error", err.message);
    console.error("[billing] checkout failed", err);
    return fail(502, "gateway_error", "The payment could not be started. Please try again.");
  }
}

/** Marks a payment paid and clears the student's due for its year. Safe to call more than once. */
export async function markPaid(paymentId: string, by: { gatewayPaymentId?: string; actor: string; method: "online" | "offline"; note?: string }): Promise<PaymentRow | undefined> {
  const store = await billingStore();
  const p = await store.getPayment(paymentId);
  if (!p) return undefined;
  if (p.status === "Paid") return p;
  const now = new Date().toISOString();
  const paid = await store.updatePayment(p.id, { status: "Paid", receiptNo: receiptNo(p), gatewayPaymentId: by.gatewayPaymentId ?? p.gatewayPaymentId, ...(by.method === "offline" ? { reviewedBy: by.actor, reviewNote: by.note ?? "" } : {}) });
  const due = await store.getDue(p.userSub, p.academicYear);
  await store.saveDue({ ...(due ?? { userSub: p.userSub, name: p.studentName, college: p.college, academicYear: p.academicYear, amount: p.amount, clearedBy: "", clearedAt: null, method: "" }), status: "Paid", method: by.method, clearedBy: by.actor, clearedAt: now });
  await audit(by.actor, `fees.paid:${p.gateway}`, p.id, { collegeId: p.college });
  clearAccessCache(p.userSub);
  return paid;
}

/** Applies a verified gateway return or webhook (inside a context that can see the payment). */
export async function applyVerified(gw: Gateway, v: Verified): Promise<"paid" | "failed" | "unknown"> {
  const store = await billingStore();
  const p = await store.getPayment(v.paymentId);
  if (!p || p.gateway !== gw) return "unknown";
  if (p.status === "Paid") return "paid";
  if (!v.ok) {
    if (p.status === "Created") await store.updatePayment(p.id, { status: "Failed", reviewNote: `Gateway: ${v.reason ?? "failed"}`.slice(0, 300) });
    if (v.reason === "amount_mismatch" || v.reason === "bad_signature") await audit("Payment gateway", `fees.rejected:${gw}:${v.reason}`, p.id, { collegeId: p.college });
    return "failed";
  }
  await markPaid(p.id, { gatewayPaymentId: v.gatewayPaymentId, actor: `${GATEWAY_NAMES[gw]} (online)`, method: "online" });
  return "paid";
}

/** Student: report an offline payment (cash, DD, NEFT …) with a photo of the receipt, for the University to verify. */
export async function submitOffline(session: SessionPayload, body: { mode: string; reference: string; paidOn: string; proof: { contentType: string; data: string } }): Promise<Outcome<PaymentRow>> {
  const { settings: s, configured } = await billingSettings();
  if (!configured) return fail(409, "not_open", "Fee payment has not been opened by the University yet.");
  const due = await ensureDue(session, s);
  if (due.status !== "Due" || due.amount <= 0) return fail(409, "nothing_due", "Your fee for this year is already cleared.");
  const store = await billingStore();
  if ((await store.listPayments({ userSub: session.sub, academicYear: s.academicYear })).some((p) => p.status === "Pending verification")) return fail(409, "pending_offline", "You already have an offline payment waiting to be verified.");
  const saved = await saveMedia(body.proof.contentType, body.proof.data, session.college, session.sub);
  if (!saved.ok) return fail(422, "invalid_image", saved.reason);
  const p: PaymentRow = { ...blankPayment({ ...due, name: session.name }, s.currency, "offline"), status: "Pending verification", offlineMode: body.mode, offlineRef: `${body.reference} · paid ${body.paidOn}`.slice(0, 120), proofMediaId: saved.id };
  await store.createPayment(p);
  await audit(session.name, "fees.offline-submitted", p.id, { collegeId: session.college, actorSub: session.sub });
  return { ok: true, value: p };
}

/** Super Admin: approve (clears the student) or reject an offline payment. */
export async function reviewOffline(admin: SessionPayload, id: string, approve: boolean, note: string): Promise<Outcome<PaymentRow>> {
  const store = await billingStore();
  const p = await store.getPayment(id);
  if (!p) return fail(404, "not_found", "Payment not found.");
  if (p.status !== "Pending verification") return fail(409, "already_reviewed", "This payment has already been reviewed.");
  if (approve) {
    const paid = await markPaid(id, { actor: admin.name, method: "offline", note });
    return { ok: true, value: paid! };
  }
  const rejected = await store.updatePayment(id, { status: "Rejected", reviewedBy: admin.name, reviewNote: note || "Rejected" });
  await audit(admin.name, "fees.offline-rejected", id, { collegeId: p.college, actorSub: admin.sub });
  return { ok: true, value: rejected! };
}

/** Super Admin: waive a student's fee, mark it paid by other means, or set it back to due. */
export async function setDueStatus(admin: SessionPayload, userSub: string, status: DueStatus, note: string): Promise<Outcome<null>> {
  const { settings: s } = await billingSettings();
  const store = await billingStore();
  const due = await store.getDue(userSub, s.academicYear);
  if (!due) return fail(404, "not_found", "That student has no fee record for this year.");
  const cleared = status !== "Due";
  await store.saveDue({ ...due, status, method: status === "Waived" ? "waiver" : status === "Paid" ? "offline" : "", clearedBy: cleared ? admin.name : "", clearedAt: cleared ? new Date().toISOString() : null });
  await audit(admin.name, `fees.status:${status}${note ? `:${note.slice(0, 80)}` : ""}`, userSub, { collegeId: due.college, actorSub: admin.sub });
  clearAccessCache(userSub);
  return { ok: true, value: null };
}

/** Super Admin: clear (or re-lock) a college's staff for the year, and optionally set the college's own fee. */
export async function clearCollege(admin: SessionPayload, college: string, cleared: boolean, feeOverride: number | null | undefined): Promise<Outcome<null>> {
  const { settings: s } = await billingSettings();
  const store = await billingStore();
  const row = (await store.collegeBilling(s.academicYear)).find((c) => c.college === college) ?? { college, academicYear: s.academicYear, feeOverride: null, cleared: false, clearedBy: "", clearedAt: null };
  await store.saveCollegeBilling({ ...row, feeOverride: feeOverride === undefined ? row.feeOverride : feeOverride, cleared, clearedBy: cleared ? admin.name : "", clearedAt: cleared ? new Date().toISOString() : null });
  await audit(admin.name, `fees.college:${cleared ? "cleared" : "locked"}${feeOverride !== undefined ? `:fee=${feeOverride ?? "plan"}` : ""}`, college, { collegeId: college, actorSub: admin.sub });
  clearAccessCache();
  return { ok: true, value: null };
}
