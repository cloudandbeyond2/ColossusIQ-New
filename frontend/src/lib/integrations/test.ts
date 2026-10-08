import "server-only";
import { createHash, createHmac } from "node:crypto";
import { isIP } from "node:net";
import type { TestResult } from "@/lib/api/integration-schemas";
import type { EffectiveIntegration } from "./config";

/*
 * "Test connection" for each provider: one small, read-only request that proves the settings work (no email, message,
 * payment or file is created, except a signed "ping" event to the ERP webhook). Addresses the Super Admin types in
 * (S3 endpoint, SMTP host, Jitsi and webhook URLs) may not point at the server itself or a private network.
 */

const TIMEOUT = 10_000;

/** Rejects loopback, private, link-local and similar addresses, and local host names. */
export function publicHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return false;
  const v = isIP(h);
  if (v === 4) {
    const [a, b] = h.split(".").map(Number) as [number, number];
    return !(a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224);
  }
  if (v === 6) return !(h === "::1" || h === "::" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80") || h.startsWith("::ffff:"));
  return true;
}

export function safeHttpsUrl(raw: string): URL | null {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && !u.username && !u.password && publicHost(u.hostname) ? u : null;
  } catch {
    return null;
  }
}

async function http(url: string, init: RequestInit = {}): Promise<{ status: number; ms: number } | { error: string; ms: number }> {
  const started = Date.now();
  try {
    const r = await fetch(url, { ...init, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(TIMEOUT) });
    await r.body?.cancel().catch(() => undefined);
    return { status: r.status, ms: Date.now() - started };
  } catch (e) {
    return { error: e instanceof Error && e.name === "TimeoutError" ? "timeout" : "network", ms: Date.now() - started };
  }
}

const basic = (u: string, p: string) => `Basic ${Buffer.from(`${u}:${p}`).toString("base64")}`;

function verdict(r: Awaited<ReturnType<typeof http>>, okText: string, codes: Record<number, string> = {}): TestResult {
  if ("error" in r) return { ok: false, message: r.error === "timeout" ? "The service took too long to answer." : "Could not reach the service from the server.", ms: r.ms };
  if (r.status >= 200 && r.status < 300) return { ok: true, message: okText, ms: r.ms };
  const known = codes[r.status] ?? (r.status === 401 || r.status === 403 ? "The credentials were rejected. Check that they are correct and active." : r.status === 404 ? "Not found. Check the IDs and names." : `The service answered with HTTP ${r.status}.`);
  return { ok: false, message: known, ms: r.ms };
}

/* ── S3 (AWS Signature Version 4, HeadBucket) ── */
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const hmac = (k: Buffer | string, s: string) => createHmac("sha256", k).update(s).digest();

async function testS3(v: Record<string, string>, s: Record<string, string>, custom: boolean): Promise<TestResult> {
  const region = v.region || "us-east-1";
  let url: URL | null;
  if (custom) {
    const base = safeHttpsUrl(v.endpoint ?? "");
    if (!base) return { ok: false, message: "The endpoint must be a public https:// address.", ms: 0 };
    url = new URL(`${base.origin}/${encodeURIComponent(v.bucket!)}`);
  } else url = new URL(`https://${v.bucket}.s3.${region}.amazonaws.com/`);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const day = amzDate.slice(0, 8);
  const payload = sha256("");
  const canonical = ["HEAD", url.pathname, "", `host:${url.host}`, `x-amz-content-sha256:${payload}`, `x-amz-date:${amzDate}`, "", "host;x-amz-content-sha256;x-amz-date", payload].join("\n");
  const scope = `${day}/${region}/s3/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonical)].join("\n");
  const key = hmac(hmac(hmac(hmac(`AWS4${s.secretAccessKey}`, day), region), "s3"), "aws4_request");
  const signature = createHmac("sha256", key).update(toSign).digest("hex");
  const r = await http(url.toString(), {
    method: "HEAD",
    headers: { "x-amz-date": amzDate, "x-amz-content-sha256": payload, authorization: `AWS4-HMAC-SHA256 Credential=${v.accessKeyId}/${scope}, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${signature}` },
  });
  return verdict(r, "Connected: the bucket exists and the keys can reach it.", { 301: "The bucket is in a different region. Check the region.", 404: "No bucket with that name. Check the bucket name." });
}

/* ── SMTP: connect, read the greeting, EHLO, QUIT (no mail is sent) ── */
async function testSmtp(v: Record<string, string>): Promise<TestResult> {
  const host = v.host ?? "";
  const port = Number(v.port) || 587;
  if (!publicHost(host)) return { ok: false, message: "The SMTP host must be a public mail server address.", ms: 0 };
  const started = Date.now();
  const { connect } = await import("node:net");
  const tls = await import("node:tls");
  return new Promise<TestResult>((resolve) => {
    let buf = "";
    let stage = 0;
    const done = (ok: boolean, message: string) => {
      socket.destroy();
      resolve({ ok, message, ms: Date.now() - started });
    };
    const socket = v.security === "SSL/TLS" ? tls.connect({ host, port, servername: host }) : connect({ host, port });
    socket.setTimeout(TIMEOUT, () => done(false, "The mail server took too long to answer."));
    socket.on("error", () => done(false, "Could not connect to the mail server. Check the host, port and security setting."));
    socket.on("data", (d: Buffer) => {
      buf += d.toString("latin1");
      if (!/\r?\n$/.test(buf)) return;
      const lines = buf.trim().split(/\r?\n/);
      const last = lines.at(-1) ?? "";
      if (/^\d{3}-/.test(last)) return; // multi-line reply continues
      buf = "";
      if (stage === 0) {
        if (!last.startsWith("220")) return done(false, "The server did not greet as a mail server.");
        stage = 1;
        socket.write("EHLO colossusiq.test\r\n");
      } else if (stage === 1) {
        if (!last.startsWith("250")) return done(false, "The mail server refused the greeting.");
        const tlsOffered = lines.some((l) => /STARTTLS/i.test(l));
        socket.write("QUIT\r\n");
        if (v.security === "STARTTLS" && !tlsOffered) return done(false, "Connected, but the server does not offer STARTTLS on this port.");
        done(true, `Connected to ${host}:${port}. Sign-in is checked when the first email is sent.`);
      }
    });
  });
}

export async function testIntegration(e: EffectiveIntegration): Promise<TestResult> {
  const v = e.values;
  const s = e.secrets;
  if (e.missing.length) return { ok: false, message: `Fill in: ${e.missing.join(", ")}.`, ms: 0 };
  switch (`${e.id}:${e.provider}`) {
    case "storage:s3":
      return testS3(v, s, false);
    case "storage:s3-compatible":
      return testS3(v, s, true);
    case "email:smtp":
      return testSmtp(v);
    case "email:sendgrid":
      return verdict(await http("https://api.sendgrid.com/v3/scopes", { headers: { authorization: `Bearer ${s.apiKey}` } }), "Connected: SendGrid accepted the API key.");
    case "email:resend":
      return verdict(await http("https://api.resend.com/domains", { headers: { authorization: `Bearer ${s.apiKey}` } }), "Connected: Resend accepted the API key.");
    case "whatsapp:meta":
      return verdict(await http(`https://graph.facebook.com/v21.0/${encodeURIComponent(v.phoneNumberId!)}?fields=display_phone_number`, { headers: { authorization: `Bearer ${s.accessToken}` } }), "Connected: the access token can use this WhatsApp number.", { 400: "Meta rejected the request. Check the phone number ID and the token's permissions." });
    case "whatsapp:twilio":
    case "sms:twilio":
      return verdict(await http(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(v.accountSid!)}.json`, { headers: { authorization: basic(v.accountSid!, s.authToken!) } }), "Connected: Twilio accepted the account SID and token.");
    case "payments:razorpay":
      return verdict(await http("https://api.razorpay.com/v1/payments?count=1", { headers: { authorization: basic(v.keyId!, s.keySecret!) } }), "Connected: Razorpay accepted the key.");
    case "payments-payu:payu": {
      if (!/^[A-Za-z0-9]{4,40}$/.test(v.merchantKey ?? "")) return { ok: false, message: "A PayU merchant key is letters and digits only.", ms: 0 };
      const host = v.mode === "Live" ? "https://info.payu.in" : "https://test.payu.in";
      const command = "verify_payment";
      const var1 = "CIQ-CONNECTION-TEST";
      const hash = createHash("sha512").update(`${v.merchantKey}|${command}|${var1}|${s.salt}`).digest("hex");
      const body = new URLSearchParams({ key: v.merchantKey!, command, var1, hash }).toString();
      return verdict(await http(`${host}/merchant/postservice?form=2`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body }), "PayU answered. The merchant key and salt are checked by the first payment.");
    }
    case "payments-ccavenue:ccavenue":
      if (!/^\d{1,20}$/.test(v.merchantId ?? "")) return { ok: false, message: "A CCAvenue merchant ID is digits only.", ms: 0 };
      if (!/^[A-Za-z0-9]{32}$/.test(s.workingKey ?? "")) return { ok: false, message: "A CCAvenue working key is 32 letters and digits.", ms: 0 };
      return verdict(await http(v.mode === "Live" ? "https://secure.ccavenue.com/" : "https://test.ccavenue.com/"), "CCAvenue is reachable and the keys look right. CCAvenue has no test call: the first payment confirms them.");
    case "payments-paypal:paypal":
      return verdict(await http(`${v.mode === "Live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com"}/v1/oauth2/token`, { method: "POST", headers: { authorization: basic(v.clientId!, s.clientSecret!), "content-type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" }), "Connected: PayPal issued an access token.");
    case "sso:google":
      if (!/\.apps\.googleusercontent\.com$/.test(v.clientId ?? "")) return { ok: false, message: "A Google client ID ends with .apps.googleusercontent.com.", ms: 0 };
      return verdict(await http("https://accounts.google.com/.well-known/openid-configuration"), "Google sign-in is reachable. The client secret is checked at the first sign-in.");
    case "sso:microsoft":
      return verdict(await http(`https://login.microsoftonline.com/${encodeURIComponent(v.tenantId!)}/v2.0/.well-known/openid-configuration`), "The Microsoft tenant exists. The client secret is checked at the first sign-in.", { 400: "No Microsoft tenant with that ID." });
    case "meetings:zoom":
      return verdict(await http(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(v.accountId!)}`, { method: "POST", headers: { authorization: basic(v.clientId!, s.clientSecret!) } }), "Connected: Zoom issued an access token.", { 400: "Zoom rejected the account ID or app credentials." });
    case "meetings:jitsi": {
      const u = safeHttpsUrl(v.baseUrl ?? "");
      if (!u) return { ok: false, message: "Use a public https:// address.", ms: 0 };
      const r = await http(u.toString());
      return "status" in r && r.status < 400 ? { ok: true, message: "The Jitsi server is reachable.", ms: r.ms } : verdict(r, "");
    }
    case "webhook:https": {
      const u = safeHttpsUrl(v.url ?? "");
      if (!u) return { ok: false, message: "Use a public https:// address.", ms: 0 };
      if ((s.signingSecret ?? "").length < 24) return { ok: false, message: "Use a signing secret of at least 24 characters.", ms: 0 };
      const body = JSON.stringify({ type: "ping", at: new Date().toISOString() });
      const signature = createHmac("sha256", s.signingSecret!).update(body).digest("hex");
      return verdict(await http(u.toString(), { method: "POST", headers: { "content-type": "application/json", "x-colossusiq-signature": `sha256=${signature}` }, body }), "Your endpoint accepted a signed ping event.");
    }
    default:
      return { ok: false, message: "This provider cannot be tested from here yet. Its settings are saved and checked on first use.", ms: 0 };
  }
}
