import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { IntegrationsOverview, TestResult } from "@/lib/api/integration-schemas";
import { dispatch } from "@/lib/api/mock/router";
import { INTEGRATIONS } from "@/lib/integrations/catalog";
import { activeIntegration, resetIntegrationsMemory } from "@/lib/integrations/config";
import { publicHost, testIntegration } from "@/lib/integrations/test";
import type { SessionPayload } from "@/lib/auth/session";

const admin: SessionPayload = { sub: "demo-admin", role: "admin", name: "Super Admin", tenant: "uni-tntu", college: "all", mfa: true, exp: 9e9 };
const principal: SessionPayload = { ...admin, sub: "demo-institution", role: "institution", name: "Principal", college: "COL-1001" };
const q = new URLSearchParams();
const call = (s: SessionPayload, method: string, path: string, body?: unknown) => dispatch(method, path.split("/"), body, s, q);
const view = (body: unknown, id: string) => IntegrationsOverview.parse(body).integrations.find((i) => i.id === id)!;

const sendgrid = { provider: "sendgrid", enabled: true, values: { fromName: "TNTU", fromAddress: "no-reply@tntu.edu.in", replyTo: "" }, secrets: { apiKey: "SG.abcdefghijklmnopqrstuvwxyz1234" }, clear: [] };

beforeEach(() => resetIntegrationsMemory());
afterEach(() => vi.unstubAllGlobals());

describe("Integrations & Setup", () => {
  it("is edited only by the Super Admin at All colleges; Principals see status only", async () => {
    expect((await call({ ...admin, role: "student" }, "GET", "integrations")).status).toBe(403);
    expect((await call(principal, "PUT", "integrations/email", sendgrid)).status).toBe(403);
    expect((await call({ ...admin, college: "COL-1001" }, "PUT", "integrations/email", sendgrid)).status).toBe(409);
    expect((await call({ ...admin, mfa: false }, "PUT", "integrations/email", sendgrid)).status).toBe(403);

    const saved = await call(admin, "PUT", "integrations/email", sendgrid);
    expect(saved.status).toBe(200);
    const v = view(saved.body, "email");
    expect(v).toMatchObject({ provider: "sendgrid", enabled: true, source: "saved", status: "Saved", values: { fromName: "TNTU" } });
    // Secrets are write-only: only a hint comes back.
    expect(v.secrets.apiKey).toEqual({ hint: "••••1234", fromEnv: false });
    expect(JSON.stringify(saved.body)).not.toContain("abcdefghij");

    const asPrincipal = IntegrationsOverview.parse((await call(principal, "GET", "integrations")).body);
    expect(asPrincipal.canEdit).toBe(false);
    expect(asPrincipal.integrations.find((i) => i.id === "email")).toMatchObject({ status: "Saved", values: {}, secrets: {} });

    // Server code gets the full settings.
    expect((await activeIntegration("email"))?.secrets.apiKey).toBe("SG.abcdefghijklmnopqrstuvwxyz1234");
  });

  it("keeps a saved secret when it is not re-entered, and forgets it on request", async () => {
    await call(admin, "PUT", "integrations/email", sendgrid);
    const again = await call(admin, "PUT", "integrations/email", { ...sendgrid, secrets: {} });
    expect(view(again.body, "email").secrets.apiKey?.hint).toBe("••••1234");
    const cleared = await call(admin, "PUT", "integrations/email", { ...sendgrid, enabled: false, secrets: {}, clear: ["apiKey"] });
    expect(view(cleared.body, "email")).toMatchObject({ status: "Off", secrets: { apiKey: null } });
    expect(await activeIntegration("email")).toBeNull();
  });

  it("validates settings and will not switch on an incomplete integration", async () => {
    expect((await call(admin, "PUT", "integrations/email", { ...sendgrid, values: { ...sendgrid.values, fromAddress: "not-an-email" } })).status).toBe(422);
    expect((await call(admin, "PUT", "integrations/email", { ...sendgrid, provider: "carrier-pigeon" })).status).toBe(422);
    expect((await call(admin, "PUT", "integrations/email", { ...sendgrid, values: { ...sendgrid.values, bogus: "x" } })).status).toBe(422);
    expect((await call(admin, "PUT", "integrations/webhook", { provider: "https", enabled: true, values: { url: "https://127.0.0.1/hook" }, secrets: { signingSecret: "x".repeat(30) }, clear: [] })).status).toBe(422);
    const incomplete = await call(admin, "PUT", "integrations/whatsapp", { provider: "meta", enabled: true, values: { phoneNumberId: "123", businessAccountId: "", language: "en" }, secrets: {}, clear: [] });
    expect(incomplete.status).toBe(422);
    // Saved switched off, it is allowed and shows what is missing.
    const off = await call(admin, "PUT", "integrations/whatsapp", { provider: "meta", enabled: false, values: { phoneNumberId: "123", businessAccountId: "", language: "en" }, secrets: {}, clear: [] });
    expect(view(off.body, "whatsapp").missing).toEqual(["WhatsApp Business account ID", "Permanent access token"]);
  });

  it("falls back to environment variables", async () => {
    vi.stubEnv("SMS_PROVIDER", "msg91");
    vi.stubEnv("MSG91_AUTH_KEY", "env-key-9876");
    vi.stubEnv("MSG91_SENDER_ID", "TNTUNV");
    vi.stubEnv("MSG91_DLT_ENTITY_ID", "1101000000000");
    const v = view((await call(admin, "GET", "integrations")).body, "sms");
    expect(v).toMatchObject({ provider: "msg91", source: "environment", enabled: true, secrets: { authKey: { hint: "••••9876", fromEnv: true } } });
    vi.unstubAllEnvs();
  });

  it("tests a connection with one read-only request and records the result", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await call(admin, "PUT", "integrations/email", sendgrid);
    const r = TestResult.parse((await call(admin, "POST", "integrations/email/test")).body);
    expect(r.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.sendgrid.com/v3/scopes");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer SG.abcdefghijklmnopqrstuvwxyz1234");
    expect(view((await call(admin, "GET", "integrations")).body, "email").status).toBe("Connected");

    fetchMock.mockImplementation(async () => new Response("{}", { status: 401 }));
    expect(TestResult.parse((await call(admin, "POST", "integrations/email/test")).body)).toMatchObject({ ok: false });
    expect(view((await call(admin, "GET", "integrations")).body, "email").status).toBe("Saved");
  });

  it("signs S3 requests and refuses private addresses", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await testIntegration({ id: "storage", provider: "s3", enabled: true, source: "saved", values: { bucket: "tntu-uploads", region: "ap-south-1", accessKeyId: "AKIAEXAMPLE" }, secrets: { secretAccessKey: "secret" }, secretFromEnv: {}, missing: [] });
    expect(r.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://tntu-uploads.s3.ap-south-1.amazonaws.com/");
    expect((init.headers as Record<string, string>).authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIAEXAMPLE\/\d{8}\/ap-south-1\/s3\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/);
    for (const h of ["localhost", "127.0.0.1", "10.1.2.3", "192.168.1.16", "172.20.0.1", "169.254.169.254", "::1", "db.internal"]) expect(publicHost(h), h).toBe(false);
    for (const h of ["smtp.gmail.com", "8.8.8.8", "api.sendgrid.com"]) expect(publicHost(h), h).toBe(true);
  });
});

describe(".env.example", () => {
  it("documents every integration variable", () => {
    const text = readFileSync(".env.example", "utf8");
    const vars = INTEGRATIONS.flatMap((i) => [i.envProvider, ...(i.common ?? []).map((f) => f.env), ...i.providers.flatMap((p) => p.fields.map((f) => f.env))]).filter(Boolean) as string[];
    for (const v of new Set(vars)) expect(text, v).toMatch(new RegExp(`^${v}=`, "m"));
  });
});
