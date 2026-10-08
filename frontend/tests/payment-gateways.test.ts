import { createHash, createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ccavenueDecrypt, ccavenueEncrypt, paymentIdOf, paypalCaptureResult, payuRequestHash, payuResponseHash, razorpayWebhookValid, verifyReturn } from "@/lib/billing/gateways";
import type { EffectiveIntegration } from "@/lib/integrations/config";
import type { PaymentRow } from "@/lib/billing/store";

const payment: PaymentRow = {
  id: "PAY-0123456789abcdef0123",
  receiptNo: "",
  userSub: "s1",
  studentName: "Asha",
  college: "COL-1001",
  academicYear: "2026-27",
  amount: 1000,
  currency: "INR",
  gateway: "payu",
  gatewayOrderId: "PAY-0123456789abcdef0123",
  gatewayPaymentId: "",
  status: "Created",
  offlineMode: "",
  offlineRef: "",
  proofMediaId: "",
  reviewedBy: "",
  reviewNote: "",
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};
const eff = (id: string, provider: string, values: Record<string, string>, secrets: Record<string, string>): EffectiveIntegration => ({ id, provider, enabled: true, source: "saved", values, secrets, secretFromEnv: {}, missing: [] });

describe("PayU", () => {
  const e = eff("payments-payu", "payu", { merchantKey: "gtKFFx", mode: "Test" }, { salt: "eCwWELxi" });

  it("signs the request as PayU documents it", () => {
    const f = { txnid: "t1", amount: "10.00", productinfo: "p", firstname: "A", email: "a@b.in" };
    expect(payuRequestHash("gtKFFx", "eCwWELxi", f)).toBe(createHash("sha512").update("gtKFFx|t1|10.00|p|A|a@b.in|||||||||||eCwWELxi").digest("hex"));
  });

  it("accepts only a correctly hashed success for the right amount", async () => {
    const r: Record<string, string> = { key: "gtKFFx", txnid: payment.id, amount: "1000.00", productinfo: "ColossusIQ app fee", firstname: "Asha", email: "a@b.in", status: "success", mihpayid: "403993715", udf1: "", udf2: "", udf3: "", udf4: "", udf5: "" };
    r.hash = payuResponseHash("eCwWELxi", r);
    expect(paymentIdOf("payu", e, r)?.id).toBe(payment.id);
    expect(await verifyReturn("payu", e, r, payment)).toMatchObject({ ok: true, gatewayPaymentId: "403993715", amount: 1000 });
    expect(await verifyReturn("payu", e, { ...r, amount: "1.00" }, payment)).toMatchObject({ ok: false, reason: "bad_signature" });
    const cheap: Record<string, string> = { ...r, amount: "1.00" };
    cheap.hash = payuResponseHash("eCwWELxi", cheap);
    expect(await verifyReturn("payu", e, cheap, payment)).toMatchObject({ ok: false, reason: "amount_mismatch" });
    const failed: Record<string, string> = { ...r, status: "failure" };
    failed.hash = payuResponseHash("eCwWELxi", failed);
    expect(await verifyReturn("payu", e, failed, payment)).toMatchObject({ ok: false, reason: "failure" });
  });
});

describe("CCAvenue", () => {
  const key = "0123456789ABCDEF0123456789ABCDEF";
  const e = eff("payments-ccavenue", "ccavenue", { merchantId: "12345", accessCode: "AVAB01", mode: "Test" }, { workingKey: key });

  it("round-trips AES-128-CBC with the MD5 of the working key", () => {
    const plain = "order_id=PAY-1&amount=10.00";
    const enc = ccavenueEncrypt(plain, key);
    expect(enc).toMatch(/^[0-9a-f]+$/);
    expect(ccavenueDecrypt(enc, key)).toBe(plain);
    expect(ccavenueDecrypt(enc, "X".repeat(32))).not.toBe(plain);
    expect(ccavenueDecrypt("zz", key)).toBeNull();
  });

  it("verifies the decrypted response", async () => {
    const p = { ...payment, gateway: "ccavenue" as const };
    const encResp = ccavenueEncrypt(new URLSearchParams({ order_id: p.id, tracking_id: "3100", order_status: "Success", amount: "1000.00", currency: "INR" }).toString(), key);
    const ref = paymentIdOf("ccavenue", e, { encResp });
    expect(ref?.id).toBe(p.id);
    expect(await verifyReturn("ccavenue", e, { encResp }, p, ref?.decoded)).toMatchObject({ ok: true, gatewayPaymentId: "3100" });
    const aborted = ccavenueEncrypt(new URLSearchParams({ order_id: p.id, order_status: "Aborted", amount: "1000.00", currency: "INR" }).toString(), key);
    expect(await verifyReturn("ccavenue", e, { encResp: aborted }, p, paymentIdOf("ccavenue", e, { encResp: aborted })?.decoded)).toMatchObject({ ok: false, reason: "aborted" });
  });
});

describe("PayPal", () => {
  it("reads a completed capture for the right order and amount", () => {
    const body = { status: "COMPLETED", purchase_units: [{ reference_id: payment.id, payments: { captures: [{ id: "CAP1", status: "COMPLETED", amount: { value: "1000.00", currency_code: "INR" } }] } }] };
    expect(paypalCaptureResult(body, payment)).toMatchObject({ ok: true, amount: 1000, gatewayPaymentId: "CAP1" });
    expect(paypalCaptureResult({ ...body, purchase_units: [{ ...body.purchase_units[0]!, reference_id: "PAY-other" }] }, payment)).toMatchObject({ ok: false, reason: "mismatch" });
    expect(paypalCaptureResult({ ...body, status: "PAYER_ACTION_REQUIRED" }, payment).ok).toBe(false);
  });
});

describe("Razorpay webhook", () => {
  it("checks the HMAC of the raw body", () => {
    const raw = '{"event":"payment_link.paid"}';
    const sig = createHash("sha256").update("x").digest("hex");
    expect(razorpayWebhookValid("whsec", raw, sig)).toBe(false);
    expect(razorpayWebhookValid("whsec", raw, createHmac("sha256", "whsec").update(raw).digest("hex"))).toBe(true);
    expect(razorpayWebhookValid("", raw, "")).toBe(false);
  });
});
