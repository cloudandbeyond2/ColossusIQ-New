import "server-only";
import { sharedState } from "@/lib/api/mock/global-state";
import { dataBackend } from "@/lib/data";
import type { IntegrationStatus, IntegrationView, TestResult } from "@/lib/api/integration-schemas";
import { fieldsOf, findIntegration, INTEGRATIONS, type IntegrationDef } from "./catalog";

/*
 * Integration settings: what the Super Admin saved (secrets encrypted at rest on PostgreSQL), falling back field by
 * field to the environment variables named in the catalogue. Server code that sends email, WhatsApp or SMS, stores
 * files or calls the ERP reads the effective settings through `activeIntegration()`. Cached in the process for 30 s.
 */

export interface StoredIntegration {
  id: string;
  provider: string;
  enabled: boolean;
  values: Record<string, string>;
  secrets: Record<string, string>;
  lastTest: (TestResult & { at: string }) | null;
  updatedBy: string;
  updatedAt: string;
}

export interface EffectiveIntegration {
  id: string;
  provider: string | null;
  enabled: boolean;
  source: "saved" | "environment" | "none";
  values: Record<string, string>;
  secrets: Record<string, string>;
  secretFromEnv: Record<string, boolean>;
  missing: string[];
}

const memory = sharedState("integrations.rows", () => new Map<string, StoredIntegration>());
const cache = sharedState("integrations.cache", () => ({ rows: [] as StoredIntegration[], at: 0, warned: false }));
const TTL_MS = 30_000;
const env = (k?: string) => (k ? (process.env[k] ?? "").trim() : "");

/** Saved rows, for the settings page (inside the Super Admin's transaction on PostgreSQL). */
export async function storedIntegrations(): Promise<StoredIntegration[]> {
  if (dataBackend() !== "postgres") return [...memory.values()].map((r) => structuredClone(r));
  const { readIntegrationsInTx } = await import("@/lib/data/postgres/integrations");
  return readIntegrationsInTx();
}

export async function saveIntegration(row: StoredIntegration): Promise<void> {
  if (dataBackend() === "postgres") {
    const { saveIntegrationRow } = await import("@/lib/data/postgres/integrations");
    await saveIntegrationRow(row);
  } else memory.set(row.id, structuredClone(row));
  cache.at = 0;
}

export async function removeIntegration(id: string): Promise<void> {
  if (dataBackend() === "postgres") {
    const { deleteIntegrationRow } = await import("@/lib/data/postgres/integrations");
    await deleteIntegrationRow(id);
  } else memory.delete(id);
  cache.at = 0;
}

/** Resolves one integration: saved settings first, then environment variables, field by field. */
export function resolve(def: IntegrationDef, row: StoredIntegration | undefined): EffectiveIntegration {
  const envProvider = env(def.envProvider);
  const provider = row?.provider ?? (def.providers.some((p) => p.id === envProvider) ? envProvider : null);
  const out: EffectiveIntegration = { id: def.id, provider, enabled: row ? row.enabled : !!provider, source: row ? "saved" : provider ? "environment" : "none", values: {}, secrets: {}, secretFromEnv: {}, missing: [] };
  if (!provider) return out;
  for (const f of fieldsOf(def, provider)) {
    if (f.kind === "secret") {
      const saved = row?.secrets[f.key] ?? "";
      const v = saved || env(f.env);
      if (v) {
        out.secrets[f.key] = v;
        out.secretFromEnv[f.key] = !saved;
      }
    } else {
      const v = row?.values[f.key] ?? env(f.env);
      if (v) out.values[f.key] = v;
    }
    if (f.required && !(f.kind === "secret" ? out.secrets[f.key] : out.values[f.key])) out.missing.push(f.label);
  }
  return out;
}

export function statusOf(e: EffectiveIntegration, lastTest: StoredIntegration["lastTest"]): IntegrationStatus {
  if (!e.provider) return "Not set up";
  if (!e.enabled) return "Off";
  if (e.missing.length) return "Incomplete";
  if (e.id === "storage" && e.provider === "database") return "Connected";
  return lastTest?.ok ? "Connected" : "Saved";
}

const hint = (v: string) => `••••${v.slice(-4)}`;

export function viewOf(def: IntegrationDef, row: StoredIntegration | undefined): IntegrationView {
  const e = resolve(def, row);
  const secrets: IntegrationView["secrets"] = {};
  if (e.provider) for (const f of fieldsOf(def, e.provider)) if (f.kind === "secret") secrets[f.key] = e.secrets[f.key] ? { hint: hint(e.secrets[f.key]!), fromEnv: !!e.secretFromEnv[f.key] } : null;
  return { id: def.id, provider: e.provider, enabled: e.enabled, source: e.source, status: statusOf(e, row?.lastTest ?? null), values: e.values, secrets, missing: e.missing, lastTest: row?.lastTest ?? null, updatedBy: row?.updatedBy ?? "", updatedAt: row?.updatedAt ?? null };
}

/* ── for server code that uses an integration ── */
async function refresh(): Promise<void> {
  if (Date.now() - cache.at < TTL_MS) return;
  try {
    if (dataBackend() !== "postgres") cache.rows = [...memory.values()];
    else {
      const { loadIntegrations } = await import("@/lib/data/postgres/integrations");
      cache.rows = await loadIntegrations();
    }
  } catch {
    if (!cache.warned) console.warn("[integrations] could not read saved settings; using environment variables only");
    cache.warned = true;
  }
  cache.at = Date.now();
}

/** The settings in effect for an integration when it is switched on and complete, else null. */
export async function activeIntegration(id: string): Promise<EffectiveIntegration | null> {
  const def = findIntegration(id);
  if (!def) return null;
  await refresh();
  const e = resolve(def, cache.rows.find((r) => r.id === id));
  return e.provider && e.enabled && !e.missing.length ? e : null;
}

/** Status of every integration, for dashboards (no secrets). */
export async function integrationStatuses(): Promise<Array<{ id: string; name: string; provider: string | null; status: IntegrationStatus }>> {
  await refresh();
  return INTEGRATIONS.map((def) => {
    const row = cache.rows.find((r) => r.id === def.id);
    const e = resolve(def, row);
    return { id: def.id, name: def.name, provider: e.provider ? (def.providers.find((p) => p.id === e.provider)?.name ?? e.provider) : null, status: statusOf(e, row?.lastTest ?? null) };
  });
}

/** Test helper. */
export function resetIntegrationsMemory() {
  memory.clear();
  cache.rows = [];
  cache.at = 0;
}
