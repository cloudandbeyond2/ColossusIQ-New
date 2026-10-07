import "server-only";
import type { z } from "zod";
import { ALL_COLLEGES } from "@/config/tenancy";
import { aiConfig, effective, PROVIDERS, providerOrder, refreshAiConfig, saveProviderRow, storedRows, type ProviderId as Pid, type StoredProvider } from "@/lib/ai/ai-config";
import { pingProvider } from "@/lib/ai/gemini";
import { dataBackend } from "@/lib/data";
import type { SessionPayload } from "@/lib/auth/session";
import { DefaultBody, ProviderId, ProvidersOverview, ProviderUpdate, TestResult, type ProviderView } from "@/lib/api/ai-providers-schemas";
import { audit } from "./audit";
import { rateLimit } from "./rate-limit";
import type { MockResult } from "./router";

/*
 * AI Providers (University Super Admin): API keys, models, on/off switches and the default for Google Gemini,
 * Anthropic Claude and OpenAI ChatGPT. Gemini is on and the default out of the box. Keys are write-only: the page
 * only ever sees the last four characters. Every change is audit-logged (without the key).
 */

const ok = (body: unknown, status = 200): MockResult => ({ status, body });
const err = (status: number, code: string, message: string, fields?: Record<string, string>): MockResult => ({ status, body: { error: { code, message, ...(fields ? { fields } : {}) } } });
const invalid = (e: z.ZodError): MockResult => {
  const fields: Record<string, string> = {};
  for (const i of e.issues) fields[String(i.path[0] ?? "_")] ??= i.message;
  return err(422, "validation", "Please correct the highlighted fields.", fields);
};

const canStoreKeys = () => dataBackend() !== "postgres" || (process.env.MFA_ENCRYPTION_KEY ?? "").length >= 32;
const hint = (k: string | null) => (k ? `••••${k.slice(-4)}` : null);
const REASONS: Record<string, string> = {
  no_key: "No API key is set.",
  http_400: "The provider rejected the request. Check the model id.",
  http_401: "The API key was rejected. Check that it is correct and active.",
  http_403: "The API key is not allowed to use this model.",
  http_404: "The model was not found. Check the model id.",
  http_429: "The provider is rate-limiting this key or the account is out of credit.",
  timeout: "The provider took too long to answer.",
  network: "Could not reach the provider from the server.",
  blocked: "The provider declined the test request.",
  json: "The provider answered, but not in the expected format.",
};

async function view(): Promise<ProvidersOverview> {
  const cfg = effective(await storedRows());
  const order = providerOrder(cfg);
  const providers: ProviderView[] = (Object.keys(PROVIDERS) as Pid[]).map((id) => {
    const p = cfg.providers[id];
    return {
      id,
      name: PROVIDERS[id].name,
      vendor: PROVIDERS[id].vendor,
      keySource: p.keySource,
      keyHint: hint(p.apiKey),
      keyFormat: PROVIDERS[id].keyHint,
      envVar: PROVIDERS[id].envKey,
      model: p.model,
      defaultModel: PROVIDERS[id].defaultModel,
      suggestedModels: PROVIDERS[id].models,
      enabled: p.enabled,
      isDefault: cfg.defaultProvider === id,
      usable: p.enabled && !!p.apiKey,
      updatedBy: p.updatedBy,
      updatedAt: p.updatedAt,
    };
  });
  return { providers, defaultProvider: cfg.defaultProvider, order, canEdit: false, canStoreKeys: canStoreKeys() };
}

/** The saved row for a provider, or a fresh one that keeps today's behaviour (Gemini on and default). */
async function rowFor(id: Pid): Promise<{ row: StoredProvider; all: StoredProvider[] }> {
  const all = await storedRows();
  const cfg = effective(all);
  const saved = all.find((r) => r.provider === id);
  const row: StoredProvider = saved ?? { provider: id, apiKey: null, model: "", enabled: cfg.providers[id].enabled, isDefault: cfg.defaultProvider === id, updatedBy: "", updatedAt: new Date().toISOString() };
  return { row, all };
}

async function persist(s: SessionPayload, row: StoredProvider, all: StoredProvider[]) {
  row.updatedBy = s.name;
  row.updatedAt = new Date().toISOString();
  // Keep exactly one default: if this row takes it, make sure the old default exists as a row that no longer claims it.
  if (row.isDefault) {
    const cfg = effective(all);
    if (cfg.defaultProvider !== row.provider && !all.some((r) => r.provider === cfg.defaultProvider)) {
      const prev = cfg.defaultProvider;
      await saveProviderRow({ provider: prev, apiKey: null, model: "", enabled: cfg.providers[prev].enabled, isDefault: false, updatedBy: s.name, updatedAt: row.updatedAt });
    }
  }
  // saveProviderRow marks the cache stale; the next request re-reads it after this transaction commits.
  await saveProviderRow(row);
}

export async function dispatchAiProviders(method: string, segs: string[], rawBody: unknown, s: SessionPayload): Promise<MockResult> {
  if (s.role !== "admin") return err(403, "forbidden", "AI providers are managed by the University Super Admin.");
  const canEdit = s.mfa && s.college === ALL_COLLEGES;

  if (method === "GET" && segs.length === 1) return ok(ProvidersOverview.parse({ ...(await view()), canEdit }));

  if (!s.mfa) return err(403, "mfa_required", "Confirm your sign-in code first.");
  if (s.college !== ALL_COLLEGES) return err(409, "choose_scope", "Switch to “All colleges” to change AI providers; they apply to the whole university.");

  // POST ai-providers/default {provider}
  if (method === "POST" && segs[1] === "default" && segs.length === 2) {
    const p = DefaultBody.safeParse(rawBody);
    if (!p.success) return invalid(p.error);
    const id = p.data.provider;
    const { row, all } = await rowFor(id);
    const cfg = effective(all);
    if (!cfg.providers[id].apiKey) return err(409, "no_key", `Add an API key for ${PROVIDERS[id].name} first.`);
    row.enabled = true;
    row.isDefault = true;
    await persist(s, row, all);
    await audit(s.name, `ai-providers.default:${id}`, id, { collegeId: null, actorSub: s.sub });
    return ok(ProvidersOverview.parse({ ...(await view()), canEdit }));
  }

  const id = ProviderId.safeParse(segs[1]);
  if (!id.success) return err(404, "not_found", "Not found.");
  const pid = id.data;

  // PUT ai-providers/:id {apiKey?, model?, enabled?}
  if (method === "PUT" && segs.length === 2) {
    const p = ProviderUpdate.safeParse(rawBody);
    if (!p.success) return invalid(p.error);
    const { row, all } = await rowFor(pid);
    const cfg = effective(all);
    if (p.data.apiKey) {
      if (!canStoreKeys()) return err(409, "encryption_unavailable", "Set MFA_ENCRYPTION_KEY (32+ characters) in the server environment so keys can be stored encrypted, or set the key as an environment variable instead.");
      row.apiKey = p.data.apiKey;
    }
    if (p.data.model) row.model = p.data.model;
    if (p.data.enabled !== undefined) {
      if (p.data.enabled && !(row.apiKey ?? cfg.providers[pid].apiKey)) return err(409, "no_key", `Add an API key for ${PROVIDERS[pid].name} before switching it on.`);
      if (!p.data.enabled && cfg.defaultProvider === pid) return err(409, "is_default", `${PROVIDERS[pid].name} is the default. Make another provider the default first.`);
      row.enabled = p.data.enabled;
    }
    await persist(s, row, all);
    const what = [p.data.apiKey ? "key" : null, p.data.model ? `model=${row.model}` : null, p.data.enabled !== undefined ? (row.enabled ? "on" : "off") : null].filter(Boolean).join(",");
    await audit(s.name, `ai-providers.update:${pid}:${what}`, pid, { collegeId: null, actorSub: s.sub });
    return ok(ProvidersOverview.parse({ ...(await view()), canEdit }));
  }

  // DELETE ai-providers/:id/key: forget the saved key (an environment key, if any, then applies).
  if (method === "DELETE" && segs[2] === "key" && segs.length === 3) {
    const { row, all } = await rowFor(pid);
    const envKey = (process.env[PROVIDERS[pid].envKey] ?? "").trim().length > 20;
    if (!envKey && effective(all).defaultProvider === pid) return err(409, "is_default", `${PROVIDERS[pid].name} is the default. Make another provider the default before removing its key.`);
    row.apiKey = null;
    if (!envKey) row.enabled = false;
    await persist(s, row, all);
    await audit(s.name, `ai-providers.remove-key:${pid}`, pid, { collegeId: null, actorSub: s.sub });
    return ok(ProvidersOverview.parse({ ...(await view()), canEdit }));
  }

  // POST ai-providers/:id/test: a tiny live request with the key and model in use.
  if (method === "POST" && segs[2] === "test" && segs.length === 3) {
    const rl = rateLimit(`ai-provider-test:${s.sub}`, 20, 3_600_000);
    if (!rl.ok) return err(429, "rate_limited", "Too many tests. Try again later.");
    await refreshAiConfig(true).catch(() => undefined);
    if (!aiConfig().providers[pid].apiKey) return ok(TestResult.parse({ ok: false, message: REASONS.no_key, ms: 0 }));
    const r = await pingProvider(pid);
    return ok(TestResult.parse({ ok: r.ok, message: r.ok ? `${PROVIDERS[pid].name} answered correctly with ${aiConfig().providers[pid].model}.` : (REASONS[r.reason] ?? `The test failed (${r.reason}).`), ms: r.ms }));
  }

  return err(404, "not_found", "Not found.");
}
