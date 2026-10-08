import { NextResponse, type NextRequest } from "next/server";
import { withRequestContext } from "@/lib/data";
import { razorpayWebhookValid } from "@/lib/billing/gateways";
import { applyVerified, gatewaySettings } from "@/lib/billing/payments";
import { billingStore } from "@/lib/billing/store";

/*
 * Server-to-server payment confirmation, for when the student closes the browser before returning from the gateway.
 * Razorpay: set the webhook URL to https://<your site>/api/payments/razorpay/webhook with the event
 * "payment_link.paid" and the same webhook secret as in Integrations & Setup. The other gateways confirm on return.
 */

export const dynamic = "force-dynamic";

const reply = (status: number) => NextResponse.json({ ok: status < 300 }, { status, headers: { "Cache-Control": "no-store" } });

interface LinkPaid {
  event?: string;
  payload?: { payment_link?: { entity?: { id?: string; reference_id?: string; amount_paid?: number; currency?: string; status?: string } }; payment?: { entity?: { id?: string } } };
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ gateway: string }> }) {
  const gw = (await ctx.params).gateway;
  if (gw !== "razorpay") return reply(404);
  const e = await gatewaySettings("razorpay");
  const raw = await req.text();
  if (!e || raw.length > 256 * 1024) return reply(400);
  if (!razorpayWebhookValid(e.secrets.webhookSecret ?? "", raw, req.headers.get("x-razorpay-signature") ?? "")) return reply(401);
  let body: LinkPaid;
  try {
    body = JSON.parse(raw) as LinkPaid;
  } catch {
    return reply(400);
  }
  if (body.event !== "payment_link.paid") return reply(200);
  const link = body.payload?.payment_link?.entity;
  const ref = link?.reference_id ?? "";
  if (!/^PAY-[a-f0-9]{20}$/.test(ref)) return reply(200);
  return withRequestContext({ scope: "all" }, async () => {
    const p = await (await billingStore()).getPayment(ref);
    if (!p || p.gateway !== "razorpay" || p.gatewayOrderId !== link?.id) return reply(200);
    const amount = (link.amount_paid ?? 0) / 100;
    const ok = link.status === "paid" && Math.abs(amount - p.amount) < 0.005 && (link.currency ?? p.currency) === p.currency;
    await applyVerified("razorpay", { ok, paymentId: p.id, gatewayPaymentId: body.payload?.payment?.entity?.id ?? "", amount, currency: link.currency ?? "", reason: ok ? undefined : "amount_mismatch" });
    return reply(200);
  });
}
