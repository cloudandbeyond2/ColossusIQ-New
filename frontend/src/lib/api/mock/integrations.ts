import "server-only";
import { ALL_COLLEGES } from "@/config/tenancy";
import type { SessionPayload } from "@/lib/auth/session";
import { dataBackend } from "@/lib/data";
import { IntegrationsOverview, IntegrationUpdate, TestResult, type IntegrationView } from "@/lib/api/integration-schemas";
import { fieldsOf, findIntegration, INTEGRATIONS, type IntegrationField } from "@/lib/integrations/catalog";
import { integrationStatuses, removeIntegration, resolve, saveIntegration, storedIntegrations, viewOf, type StoredIntegration } from "@/lib/integrations/config";
import { safeHttpsUrl, testIntegration } from "@/lib/integrations/test";
import { cleanText } from "@/lib/security/sanitize";
import { audit } from "./audit";
import { rateLimit } from "./rate-limit";
import type { MockResult } from "./router";

/*
 * Integrations & Setup. The University Super Admin (at "All colleges", with a confirmed sign-in code) chooses and
 * configures cloud storage, email, WhatsApp, SMS, online payments, single sign-on, online classes and the ERP webhook.
 * Secrets are write-only: the page only ever sees a hint. Principals see which integrations are connected.
 */

const ok = (body: unknown, status = 200): MockResult => ({ status, body });
const err = (status: number, code: string, message: string, fields?: Record<string, string>): MockResult => ({ status, body: { error: { code, message, ...(fields ? { fields } : {}) } } });
const canStoreSecrets = () => dataBackend() !== "postgres" || (process.env.MFA_ENCRYPTION_KEY ?? "").length >= 32;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i;

async function overview(s: SessionPayload): Promise<IntegrationsOverview> {
  const full = s.role === "admin" && s.college === ALL_COLLEGES;
  if (full) {
    const rows = await storedIntegrations();
    return IntegrationsOverview.parse({ integrations: INTEGRATIONS.map((def) => viewOf(def, rows.find((r) => r.id === def.id))), canEdit: s.mfa, canStoreSecrets: canStoreSecrets() });
  }
  // Everyone else (and the Super Admin inside a college) sees only which integrations are in use.
  const statuses = await integrationStatuses();
  const integrations: IntegrationView[] = statuses.map((x) => ({ id: x.id, provider: x.provider ? (findIntegration(x.id)!.providers.find((p) => p.name === x.provider)?.id ?? null) : null, enabled: x.status !== "Off" && x.status !== "Not set up", source: x.provider ? "saved" : "none", status: x.status, values: {}, secrets: {}, missing: [], lastTest: null, updatedBy: "", updatedAt: null }));
  return IntegrationsOverview.parse({ integrations, canEdit: false, canStoreSecrets: canStoreSecrets() });
}

function checkValue(f: IntegrationField, raw: string): string | { error: string } {
  const v = f.kind === "textarea" || f.kind === "secret" ? raw.trim() : cleanText(raw, f.max ?? 300);
  if (!v) return "";
  if (f.max && v.length > f.max) return { error: `At most ${f.max} characters` };
  if (f.kind === "number" && !/^\d{1,5}$/.test(v)) return { error: "Use a number" };
  if (f.kind === "email" && !EMAIL.test(v)) return { error: "Use an email address" };
  if (f.kind === "url" && !safeHttpsUrl(v)) return { error: "Use a public https:// address" };
  if (f.kind === "select" && f.options && !f.options.includes(v)) return { error: "Pick one of the options" };
  return v;
}

/* ── tests run before the request's database transaction ── */
const parked = new Map<string, { at: number; result: TestResult }>();
const TEST_TTL = 2 * 60_000;
const testKey = (s: SessionPayload, id: string) => `${s.sub}:${id}`;
const testLimit = (s: SessionPayload) => rateLimit(`integration-test:${s.sub}`, 40, 3_600_000);

export async function prefetchIntegrationTest(method: string, segs: string[], _raw: unknown, s: SessionPayload): Promise<MockResult | null> {
  if (method !== "POST" || segs[0] !== "integrations" || segs[2] !== "test" || segs.length !== 3) return null;
  if (s.role !== "admin" || !s.mfa || s.college !== ALL_COLLEGES) return null;
  const def = findIntegration(segs[1] ?? "");
  if (!def) return null;
  if (!testLimit(s).ok) return err(429, "rate_limited", "Too many connection tests. Try again later.");
  let row: StoredIntegration | undefined;
  if (dataBackend() === "postgres") {
    const { loadIntegrations } = await import("@/lib/data/postgres/integrations");
    row = (await loadIntegrations()).find((r) => r.id === def.id);
  } else row = (await storedIntegrations()).find((r) => r.id === def.id);
  const e = resolve(def, row);
  if (!e.provider) return null;
  for (const [k, v] of parked) if (Date.now() - v.at > TEST_TTL) parked.delete(k);
  parked.set(testKey(s, def.id), { at: Date.now(), result: await testIntegration(e) });
  return null;
}

export async function dispatchIntegrations(method: string, segs: string[], rawBody: unknown, s: SessionPayload): Promise<MockResult> {
  if (s.role !== "admin" && s.role !== "institution") return err(403, "forbidden", "Integrations are managed by the University Super Admin.");
  if (method === "GET" && segs.length === 1) return ok(await overview(s));
  if (s.role !== "admin") return err(403, "forbidden", "Only the University Super Admin can change integrations.");
  if (s.college !== ALL_COLLEGES) return err(409, "choose_scope", "Switch to “All colleges”: integrations apply to the whole university.");
  if (!s.mfa) return err(403, "mfa_required", "Confirm your sign-in code first.");

  const def = findIntegration(segs[1] ?? "");
  if (!def) return err(404, "not_found", "Not found.");
  const rows = await storedIntegrations();
  const row = rows.find((r) => r.id === def.id);

  // PUT integrations/:id
  if (method === "PUT" && segs.length === 2) {
    const p = IntegrationUpdate.safeParse(rawBody);
    if (!p.success) return err(422, "validation", "The settings were not valid.");
    const b = p.data;
    const provider = def.providers.find((x) => x.id === b.provider);
    if (!provider) return err(422, "validation", "Pick a provider.", { provider: "Pick a provider" });
    const fields = fieldsOf(def, provider.id);
    const sameProvider = row?.provider === provider.id;
    const values: Record<string, string> = {};
    const secrets: Record<string, string> = sameProvider ? { ...row!.secrets } : {};
    const errors: Record<string, string> = {};
    for (const f of fields) {
      if (f.kind === "secret") {
        if (b.clear.includes(f.key)) delete secrets[f.key];
        const nv = b.secrets[f.key];
        if (nv !== undefined && nv.trim()) {
          const c = checkValue(f, nv);
          if (typeof c !== "string") errors[f.key] = c.error;
          else secrets[f.key] = c;
        }
      } else {
        const c = checkValue(f, b.values[f.key] ?? "");
        if (typeof c !== "string") errors[f.key] = c.error;
        else if (c) values[f.key] = c;
      }
    }
    const unknown = [...Object.keys(b.values), ...Object.keys(b.secrets)].filter((k) => !fields.some((f) => f.key === k));
    if (unknown.length) return err(422, "validation", "Unknown settings were sent.");
    if (Object.keys(errors).length) return err(422, "validation", "Please correct the highlighted fields.", errors);
    if (Object.keys(b.secrets).some((k) => b.secrets[k]!.trim()) && !canStoreSecrets()) {
      return err(409, "encryption_unavailable", "Set MFA_ENCRYPTION_KEY (32+ characters) on the server so secrets can be stored encrypted, or put them in the environment variables shown.");
    }
    const next: StoredIntegration = { id: def.id, provider: provider.id, enabled: b.enabled, values, secrets, lastTest: null, updatedBy: s.name, updatedAt: new Date().toISOString() };
    const e = resolve(def, next);
    if (b.enabled && e.missing.length) return err(422, "incomplete", `Fill in ${e.missing.join(", ")} before switching ${def.name} on.`, Object.fromEntries(fields.filter((f) => e.missing.includes(f.label)).map((f) => [f.key, "Required"])));
    await saveIntegration(next);
    const changed = [!sameProvider ? `provider=${provider.id}` : null, row?.enabled !== b.enabled ? (b.enabled ? "on" : "off") : null, Object.keys(b.secrets).some((k) => b.secrets[k]!.trim()) ? "secret" : null, b.clear.length ? "cleared-secret" : null].filter(Boolean).join(",") || "settings";
    await audit(s.name, `integrations.update:${def.id}:${changed}`, def.id, { collegeId: null, actorSub: s.sub });
    return ok(await overview(s));
  }

  // POST integrations/:id/test
  if (method === "POST" && segs[2] === "test" && segs.length === 3) {
    const e = resolve(def, row);
    if (!e.provider) return err(409, "not_configured", `Choose a provider for ${def.name} first.`);
    let result = parked.get(testKey(s, def.id))?.result;
    parked.delete(testKey(s, def.id));
    if (!result) {
      if (!testLimit(s).ok) return err(429, "rate_limited", "Too many connection tests. Try again later.");
      result = await testIntegration(e);
    }
    if (row) await saveIntegration({ ...row, lastTest: { ...result, at: new Date().toISOString() } });
    await audit(s.name, `integrations.test:${def.id}:${result.ok ? "ok" : "failed"}`, def.id, { collegeId: null, actorSub: s.sub });
    return ok(TestResult.parse(result));
  }

  // DELETE integrations/:id: forget the saved settings (environment variables, if any, then apply).
  if (method === "DELETE" && segs.length === 2) {
    await removeIntegration(def.id);
    await audit(s.name, `integrations.reset:${def.id}`, def.id, { collegeId: null, actorSub: s.sub });
    return ok(await overview(s));
  }

  return err(404, "not_found", "Not found.");
}
