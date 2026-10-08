import { NextResponse, type NextRequest } from "next/server";
import { GATEWAYS, type Gateway } from "@/lib/api/billing-schemas";
import { rateLimit } from "@/lib/api/mock/rate-limit";
import { withRequestContext } from "@/lib/data";
import { paymentIdOf, verifyReturn } from "@/lib/billing/gateways";
import { applyVerified, gatewaySettings } from "@/lib/billing/payments";
import { billingStore } from "@/lib/billing/store";

/*
 * Where a payment gateway sends the student back after paying (GET for Razorpay and PayPal, a cross-site form POST
 * for PayU and CCAvenue). There is no session or CSRF token on these requests: the gateway's signature / hash /
 * encryption is what authenticates them, and the amount is checked against the payment we created. The student is
 * then sent to Fees & Payments with the outcome.
 */

export const dynamic = "force-dynamic";

const MAX_BODY = 32 * 1024;

const MESSAGE = { paid: "Payment received.", failed: "The payment did not go through.", unknown: "Checking your payment…" } as const;

/**
 * Sends the student on to Fees & Payments. Not an HTTP redirect: the session cookie is SameSite=Strict, so a redirect
 * chain that started on the gateway's site would arrive without it and land on the sign-in page. A page of our own
 * that moves on by itself makes the next request same-site, so the student stays signed in.
 */
function back(_req: NextRequest, result: keyof typeof MESSAGE) {
  const next = `/student/fee-payment?payment=${result}`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=${next}"><title>Fees &amp; Payments</title></head><body style="font-family:system-ui,sans-serif;padding:2rem"><p>${MESSAGE[result]}</p><p><a href="${next}">Continue to Fees &amp; Payments</a></p></body></html>`;
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" },
  });
}

async function params(req: NextRequest, method: string): Promise<Record<string, string> | null> {
  const out: Record<string, string> = {};
  for (const [k, v] of req.nextUrl.searchParams) out[k] = v.slice(0, 4000);
  if (method === "POST") {
    const text = await req.text();
    if (text.length > MAX_BODY) return null;
    for (const [k, v] of new URLSearchParams(text)) out[k] = v.slice(0, 8000);
  }
  return out;
}

async function handle(req: NextRequest, ctx: { params: Promise<{ gateway: string }> }, method: string) {
  const gw = (await ctx.params).gateway as Gateway;
  if (!(GATEWAYS as readonly string[]).includes(gw)) return new NextResponse("Not found", { status: 404 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`pay-return:${ip}`, 60, 10 * 60_000).ok) return new NextResponse("Too many requests", { status: 429 });
  const e = await gatewaySettings(gw);
  const p = await params(req, method);
  if (!e || !p) return back(req, "unknown");
  const ref = paymentIdOf(gw, e, p);
  if (!ref || !/^PAY-[a-f0-9]{20}$/.test(ref.id)) return back(req, "unknown");
  try {
    const payment = await withRequestContext({ scope: "all", readOnly: true }, async () => (await billingStore()).getPayment(ref.id));
    if (!payment || payment.gateway !== gw) return back(req, "unknown");
    if (payment.status === "Paid") return back(req, "paid");
    // Verification may call the gateway (Razorpay link status, PayPal capture), so it runs outside a transaction.
    const v = await verifyReturn(gw, e, p, payment, ref.decoded);
    const result = await withRequestContext({ scope: "all" }, () => applyVerified(gw, v));
    return back(req, result);
  } catch (err) {
    console.error("[payments] return failed", err);
    return back(req, "unknown");
  }
}

export function GET(req: NextRequest, ctx: { params: Promise<{ gateway: string }> }) {
  return handle(req, ctx, "GET");
}
export function POST(req: NextRequest, ctx: { params: Promise<{ gateway: string }> }) {
  return handle(req, ctx, "POST");
}
