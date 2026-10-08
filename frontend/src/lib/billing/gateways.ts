import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Checkout, Gateway } from "@/lib/api/billing-schemas";
import type { EffectiveIntegration } from "@/lib/integrations/config";
import type { PaymentRow } from "./store";

/*
 * Payment gateways. Every gateway uses its hosted / redirect checkout, so no third-party script runs on our pages and
 * card or UPI details never touch this server. The amount always comes from the server-side payment row; a return or
 * webhook marks a payment paid only after its signature (or hash, or encryption) checks out and the amount matches.
 *
 *   Razorpay  Payment Links API; callback signed with HMAC-SHA256 (key secret); webhook signed with the webhook secret.
 *   PayU      Hosted checkout form signed with SHA-512; the response hash is checked with the salt.
 *   CCAvenue  encRequest / encResp, AES-128-CBC keyed by MD5(working key).
 *   PayPal    Orders v2: create, approve on PayPal, capture on return.
 */

const TIMEOUT = 15_000;

export interface CheckoutInput {
  payment: PaymentRow;
  /** Public origin of this site, e.g. https://campus.example.edu (return URLs are built from it). */
  origin: string;
  contact: { email?: string; phone?: string };
  description: string;
}

export interface Verified {
  ok: boolean;
  /** Our payment id (PAY-…). */
  paymentId: string;
  gatewayPaymentId: string;
  amount: number;
  currency: string;
  reason?: string;
}

export class GatewayError extends Error {}

/** This site's public origin: PUBLIC_APP_URL when set (behind a proxy), else the request's own origin. */
export function siteOrigin(requestOrigin: string): string {
  const configured = (process.env.PUBLIC_APP_URL ?? "").trim().replace(/\/+$/, "");
  return /^https?:\/\/[^/\s]+$/.test(configured) ? configured : requestOrigin;
}

export const returnUrl = (origin: string, gw: Gateway, pid?: string) => `${origin}/api/payments/${gw}/return${pid ? `?pid=${encodeURIComponent(pid)}` : ""}`;
const money = (n: number) => n.toFixed(2);
const sameMoney = (a: number, b: number) => Math.abs(a - b) < 0.005;
const basic = (u: string, p: string) => `Basic ${Buffer.from(`${u}:${p}`).toString("base64")}`;
const safeEq = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

async function call(url: string, init: RequestInit): Promise<{ status: number; body: unknown }> {
  let r: Response;
  try {
    r = await fetch(url, { ...init, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(TIMEOUT) });
  } catch {
    throw new GatewayError("The payment gateway could not be reached. Please try again.");
  }
  const text = await r.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: r.status, body };
}

/* ── Razorpay ─────────────────────────────────────────────────────────────── */

export function razorpayCallbackSignature(secret: string, p: { linkId: string; referenceId: string; status: string; paymentId: string }) {
  return createHmac("sha256", secret).update(`${p.linkId}|${p.referenceId}|${p.status}|${p.paymentId}`).digest("hex");
}

export function razorpayWebhookValid(secret: string, rawBody: string, signature: string) {
  return !!secret && !!signature && safeEq(createHmac("sha256", secret).update(rawBody).digest("hex"), signature);
}

const razorpay = {
  async checkout(e: EffectiveIntegration, i: CheckoutInput) {
    const auth = basic(e.values.keyId!, e.secrets.keySecret!);
    const r = await call("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: { authorization: auth, "content-type": "application/json" },
      body: JSON.stringify({
        amount: Math.round(i.payment.amount * 100),
        currency: i.payment.currency,
        accept_partial: false,
        reference_id: i.payment.id,
        description: i.description.slice(0, 2048),
        customer: { name: i.payment.studentName.slice(0, 80), ...(i.contact.email ? { email: i.contact.email } : {}), ...(i.contact.phone ? { contact: i.contact.phone } : {}) },
        notify: { sms: false, email: false },
        reminder_enable: false,
        callback_url: returnUrl(i.origin, "razorpay", i.payment.id),
        callback_method: "get",
      }),
    });
    const b = r.body as { id?: string; short_url?: string };
    if (r.status >= 300 || !b?.id || !b.short_url) throw new GatewayError(r.status === 401 ? "Razorpay rejected the API keys. Contact the University office." : "Razorpay could not start the payment.");
    return { orderId: b.id, checkout: { kind: "redirect", url: b.short_url } as Checkout };
  },
  async verify(e: EffectiveIntegration, q: Record<string, string>, payment: PaymentRow): Promise<Verified> {
    const p = { linkId: q.razorpay_payment_link_id ?? "", referenceId: q.razorpay_payment_link_reference_id ?? "", status: q.razorpay_payment_link_status ?? "", paymentId: q.razorpay_payment_id ?? "" };
    const fail = (reason: string): Verified => ({ ok: false, paymentId: payment.id, gatewayPaymentId: p.paymentId, amount: 0, currency: payment.currency, reason });
    if (p.referenceId !== payment.id || p.linkId !== payment.gatewayOrderId) return fail("mismatch");
    if (!safeEq(razorpayCallbackSignature(e.secrets.keySecret!, p), q.razorpay_signature ?? "")) return fail("bad_signature");
    if (p.status !== "paid") return fail(p.status || "not_paid");
    // Confirm with Razorpay what was actually paid on this link.
    const r = await call(`https://api.razorpay.com/v1/payment_links/${encodeURIComponent(p.linkId)}`, { headers: { authorization: basic(e.values.keyId!, e.secrets.keySecret!) } });
    const b = r.body as { amount_paid?: number; currency?: string; status?: string; reference_id?: string };
    if (r.status !== 200 || b?.status !== "paid" || b.reference_id !== payment.id) return fail("not_confirmed");
    return { ok: true, paymentId: payment.id, gatewayPaymentId: p.paymentId, amount: (b.amount_paid ?? 0) / 100, currency: b.currency ?? "" };
  },
};

/* ── PayU ─────────────────────────────────────────────────────────────────── */

const sha512 = (s: string) => createHash("sha512").update(s).digest("hex");

export function payuRequestHash(key: string, salt: string, f: { txnid: string; amount: string; productinfo: string; firstname: string; email: string }) {
  return sha512([key, f.txnid, f.amount, f.productinfo, f.firstname, f.email, "", "", "", "", "", "", "", "", "", "", salt].join("|"));
}

export function payuResponseHash(salt: string, r: Record<string, string>) {
  const core = [salt, r.status ?? "", "", "", "", "", "", r.udf5 ?? "", r.udf4 ?? "", r.udf3 ?? "", r.udf2 ?? "", r.udf1 ?? "", r.email ?? "", r.firstname ?? "", r.productinfo ?? "", r.amount ?? "", r.txnid ?? "", r.key ?? ""].join("|");
  return sha512(r.additionalCharges ? `${r.additionalCharges}|${core}` : core);
}

const payu = {
  checkout(e: EffectiveIntegration, i: CheckoutInput) {
    if (i.payment.currency !== "INR") throw new GatewayError("PayU accepts payments in INR only. Choose another way to pay.");
    if (!i.contact.email || !i.contact.phone) throw new GatewayError("PayU needs your email address and mobile number.");
    const live = e.values.mode === "Live";
    const f = { txnid: i.payment.id, amount: money(i.payment.amount), productinfo: "ColossusIQ app fee", firstname: i.payment.studentName.replace(/[^A-Za-z .]/g, "").slice(0, 60) || "Student", email: i.contact.email };
    const fields: Record<string, string> = {
      key: e.values.merchantKey!,
      ...f,
      phone: i.contact.phone,
      surl: returnUrl(i.origin, "payu"),
      furl: returnUrl(i.origin, "payu"),
      hash: payuRequestHash(e.values.merchantKey!, e.secrets.salt!, f),
    };
    return { orderId: i.payment.id, checkout: { kind: "form", action: live ? "https://secure.payu.in/_payment" : "https://test.payu.in/_payment", fields } as Checkout };
  },
  verify(e: EffectiveIntegration, r: Record<string, string>, payment: PaymentRow): Verified {
    const base = { paymentId: payment.id, gatewayPaymentId: r.mihpayid ?? "", currency: "INR" };
    if (r.txnid !== payment.id || r.key !== e.values.merchantKey) return { ...base, ok: false, amount: 0, reason: "mismatch" };
    if (!safeEq(payuResponseHash(e.secrets.salt!, r), (r.hash ?? "").toLowerCase())) return { ...base, ok: false, amount: 0, reason: "bad_signature" };
    if (r.status !== "success") return { ...base, ok: false, amount: 0, reason: r.status || "failed" };
    return { ...base, ok: true, amount: Number(r.amount) };
  },
};

/* ── CCAvenue ─────────────────────────────────────────────────────────────── */

const CC_IV = Buffer.from([...Array(16).keys()]);
const ccKey = (workingKey: string) => createHash("md5").update(workingKey).digest();

export function ccavenueEncrypt(plain: string, workingKey: string): string {
  const c = createCipheriv("aes-128-cbc", ccKey(workingKey), CC_IV);
  return Buffer.concat([c.update(plain, "utf8"), c.final()]).toString("hex");
}

export function ccavenueDecrypt(hex: string, workingKey: string): string | null {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 32) return null;
  try {
    const d = createDecipheriv("aes-128-cbc", ccKey(workingKey), CC_IV);
    return Buffer.concat([d.update(Buffer.from(hex, "hex")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

const ccavenue = {
  checkout(e: EffectiveIntegration, i: CheckoutInput) {
    const live = e.values.mode === "Live";
    const q = new URLSearchParams({
      merchant_id: e.values.merchantId!,
      order_id: i.payment.id,
      currency: i.payment.currency,
      amount: money(i.payment.amount),
      redirect_url: returnUrl(i.origin, "ccavenue"),
      cancel_url: returnUrl(i.origin, "ccavenue"),
      language: "EN",
      billing_name: i.payment.studentName.slice(0, 60),
      ...(i.contact.email ? { billing_email: i.contact.email } : {}),
      ...(i.contact.phone ? { billing_tel: i.contact.phone } : {}),
    });
    const host = live ? "https://secure.ccavenue.com" : "https://test.ccavenue.com";
    return {
      orderId: i.payment.id,
      checkout: { kind: "form", action: `${host}/transaction/transaction.do?command=initiateTransaction`, fields: { encRequest: ccavenueEncrypt(q.toString(), e.secrets.workingKey!), access_code: e.values.accessCode! } } as Checkout,
    };
  },
  /** Reads the order id out of an encrypted response (null when it does not decrypt with our key). */
  decode(e: EffectiveIntegration, encResp: string): Record<string, string> | null {
    const plain = ccavenueDecrypt(encResp, e.secrets.workingKey!);
    return plain ? Object.fromEntries(new URLSearchParams(plain)) : null;
  },
  verify(r: Record<string, string>, payment: PaymentRow): Verified {
    const base = { paymentId: payment.id, gatewayPaymentId: r.tracking_id ?? "", currency: r.currency ?? "" };
    if (r.order_id !== payment.id) return { ...base, ok: false, amount: 0, reason: "mismatch" };
    if (r.order_status !== "Success") return { ...base, ok: false, amount: 0, reason: (r.order_status || "failed").toLowerCase() };
    return { ...base, ok: true, amount: Number(r.amount) };
  },
};

/* ── PayPal ───────────────────────────────────────────────────────────────── */

const paypalBase = (e: EffectiveIntegration) => (e.values.mode === "Live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com");

async function paypalToken(e: EffectiveIntegration): Promise<string> {
  const r = await call(`${paypalBase(e)}/v1/oauth2/token`, { method: "POST", headers: { authorization: basic(e.values.clientId!, e.secrets.clientSecret!), "content-type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
  const t = (r.body as { access_token?: string })?.access_token;
  if (r.status !== 200 || !t) throw new GatewayError(r.status === 401 ? "PayPal rejected the API credentials. Contact the University office." : "PayPal could not start the payment.");
  return t;
}

interface PaypalCapture {
  id?: string;
  status?: string;
  purchase_units?: Array<{ reference_id?: string; payments?: { captures?: Array<{ id?: string; status?: string; amount?: { value?: string; currency_code?: string } }> } }>;
}

export function paypalCaptureResult(b: PaypalCapture, payment: PaymentRow): Verified {
  const unit = b.purchase_units?.[0];
  const cap = unit?.payments?.captures?.[0];
  const base = { paymentId: payment.id, gatewayPaymentId: cap?.id ?? "", currency: cap?.amount?.currency_code ?? "" };
  if (unit?.reference_id !== payment.id) return { ...base, ok: false, amount: 0, reason: "mismatch" };
  if (b.status !== "COMPLETED" || cap?.status !== "COMPLETED") return { ...base, ok: false, amount: 0, reason: (cap?.status ?? b.status ?? "failed").toLowerCase() };
  return { ...base, ok: true, amount: Number(cap.amount?.value) };
}

const paypal = {
  async checkout(e: EffectiveIntegration, i: CheckoutInput) {
    const token = await paypalToken(e);
    const r = await call(`${paypalBase(e)}/v2/checkout/orders`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "PayPal-Request-Id": i.payment.id },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{ reference_id: i.payment.id, custom_id: i.payment.id, description: i.description.slice(0, 127), amount: { currency_code: i.payment.currency, value: money(i.payment.amount) } }],
        payment_source: { paypal: { experience_context: { return_url: returnUrl(i.origin, "paypal", i.payment.id), cancel_url: returnUrl(i.origin, "paypal", i.payment.id), user_action: "PAY_NOW", shipping_preference: "NO_SHIPPING" } } },
      }),
    });
    const b = r.body as { id?: string; links?: Array<{ rel?: string; href?: string }> };
    const approve = b?.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
    if (r.status >= 300 || !b?.id || !approve) throw new GatewayError(r.status === 422 ? `PayPal does not accept ${i.payment.currency} for this account.` : "PayPal could not start the payment.");
    return { orderId: b.id, checkout: { kind: "redirect", url: approve } as Checkout };
  },
  async verify(e: EffectiveIntegration, q: Record<string, string>, payment: PaymentRow): Promise<Verified> {
    if (!q.token || q.token !== payment.gatewayOrderId) return { ok: false, paymentId: payment.id, gatewayPaymentId: "", amount: 0, currency: "", reason: "mismatch" };
    const token = await paypalToken(e);
    const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
    const url = `${paypalBase(e)}/v2/checkout/orders/${encodeURIComponent(q.token)}`;
    let r = await call(`${url}/capture`, { method: "POST", headers, body: "{}" });
    // Already captured (e.g. the page was reloaded): read the order instead.
    if (r.status === 422) r = await call(url, { headers });
    if (r.status >= 300) return { ok: false, paymentId: payment.id, gatewayPaymentId: "", amount: 0, currency: "", reason: "not_approved" };
    return paypalCaptureResult(r.body as PaypalCapture, payment);
  },
};

/* ── dispatch ─────────────────────────────────────────────────────────────── */

export async function createCheckout(gw: Gateway, e: EffectiveIntegration, i: CheckoutInput): Promise<{ orderId: string; checkout: Checkout }> {
  if (gw === "razorpay") return razorpay.checkout(e, i);
  if (gw === "payu") return payu.checkout(e, i);
  if (gw === "ccavenue") return ccavenue.checkout(e, i);
  return paypal.checkout(e, i);
}

/** Our payment id carried by a gateway's return (before anything is trusted). */
export function paymentIdOf(gw: Gateway, e: EffectiveIntegration, params: Record<string, string>): { id: string; decoded?: Record<string, string> } | null {
  if (gw === "razorpay") return params.razorpay_payment_link_reference_id ? { id: params.razorpay_payment_link_reference_id } : params.pid ? { id: params.pid } : null;
  if (gw === "paypal") return params.pid ? { id: params.pid } : null;
  if (gw === "payu") return params.txnid ? { id: params.txnid } : null;
  const decoded = ccavenue.decode(e, params.encResp ?? "");
  return decoded?.order_id ? { id: decoded.order_id, decoded } : null;
}

export async function verifyReturn(gw: Gateway, e: EffectiveIntegration, params: Record<string, string>, payment: PaymentRow, decoded?: Record<string, string>): Promise<Verified> {
  let v: Verified;
  if (gw === "razorpay") v = await razorpay.verify(e, params, payment);
  else if (gw === "payu") v = payu.verify(e, params, payment);
  else if (gw === "ccavenue") v = ccavenue.verify(decoded ?? {}, payment);
  else v = await paypal.verify(e, params, payment);
  if (v.ok && (!sameMoney(v.amount, payment.amount) || (v.currency && v.currency !== payment.currency))) return { ...v, ok: false, reason: "amount_mismatch" };
  return v;
}
