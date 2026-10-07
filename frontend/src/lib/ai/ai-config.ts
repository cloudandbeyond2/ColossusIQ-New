import "server-only";
import { dataBackend } from "@/lib/data";
import { sharedState } from "@/lib/api/mock/global-state";

/*
 * Which AI providers the platform may use, set by the University Super Admin in AI Providers: Google Gemini (the
 * default), Anthropic Claude and OpenAI ChatGPT. Each has an API key (kept encrypted in the database, or taken from
 * the server environment), a model and an on/off switch; one enabled provider is the default and the others are
 * fallbacks. Settings are cached in the server process and refreshed at most every 30 seconds, so the many
 * synchronous "is AI on?" checks never wait for the database. Keys never leave the server.
 */

export const PROVIDER_IDS = ["gemini", "claude", "openai"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export const PROVIDERS: Record<ProviderId, { name: string; vendor: string; defaultModel: string; envKey: string; envModel: string; keyHint: string; models: string[] }> = {
  gemini: { name: "Gemini", vendor: "Google", defaultModel: "gemini-2.5-flash", envKey: "GEMINI_API_KEY", envModel: "GEMINI_MODEL", keyHint: "Starts with AIza… (Google AI Studio)", models: ["gemini-2.5-flash", "gemini-2.5-pro"] },
  claude: { name: "Claude", vendor: "Anthropic", defaultModel: "claude-opus-5-5", envKey: "ANTHROPIC_API_KEY", envModel: "ANTHROPIC_MODEL", keyHint: "Starts with sk-ant- (Claude Console)", models: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-4-5"] },
  openai: { name: "ChatGPT", vendor: "OpenAI", defaultModel: "gpt-4o-mini", envKey: "OPENAI_API_KEY", envModel: "OPENAI_MODEL", keyHint: "Starts with sk- (OpenAI platform)", models: ["gpt-4o-mini", "gpt-4o"] },
};

/** One saved row (what the admin set). A null key means "use the environment variable, if any". */
export interface StoredProvider {
  provider: ProviderId;
  apiKey: string | null;
  model: string;
  enabled: boolean;
  isDefault: boolean;
  updatedBy: string;
  updatedAt: string;
}
export interface EffectiveProvider {
  id: ProviderId;
  apiKey: string | null;
  keySource: "settings" | "environment" | null;
  model: string;
  enabled: boolean;
  updatedBy: string;
  updatedAt: string | null;
}
export interface AiConfig {
  providers: Record<ProviderId, EffectiveProvider>;
  defaultProvider: ProviderId;
}

const envKey = (id: ProviderId) => {
  const v = (process.env[PROVIDERS[id].envKey] ?? "").trim();
  return v.length > 20 ? v : null;
};
const envModel = (id: ProviderId) => {
  const m = (process.env[PROVIDERS[id].envModel] ?? "").trim();
  return /^[a-z0-9.\-:]{3,80}$/i.test(m) ? m : null;
};

/** Settings + environment → what the AI layer uses. Gemini is on and the default until an admin changes that. */
export function effective(rows: StoredProvider[]): AiConfig {
  const byId = new Map(rows.map((r) => [r.provider, r]));
  const providers = Object.fromEntries(
    PROVIDER_IDS.map((id) => {
      const row = byId.get(id);
      const stored = row?.apiKey ?? null;
      const fromEnv = envKey(id);
      return [
        id,
        {
          id,
          apiKey: stored ?? fromEnv,
          keySource: stored ? "settings" : fromEnv ? "environment" : null,
          model: row?.model || envModel(id) || PROVIDERS[id].defaultModel,
          enabled: row ? row.enabled : id === "gemini",
          updatedBy: row?.updatedBy ?? "",
          updatedAt: row?.updatedAt ?? null,
        } satisfies EffectiveProvider,
      ];
    })
  ) as Record<ProviderId, EffectiveProvider>;
  const chosen = rows.find((r) => r.isDefault)?.provider ?? "gemini";
  return { providers, defaultProvider: chosen };
}

/** Providers to try, in order: the default first, then the other enabled ones that have a key. */
export function providerOrder(cfg: AiConfig = aiConfig()): ProviderId[] {
  const usable = (id: ProviderId) => cfg.providers[id].enabled && !!cfg.providers[id].apiKey;
  return [cfg.defaultProvider, ...PROVIDER_IDS.filter((id) => id !== cfg.defaultProvider)].filter(usable);
}

/* ───────────────────────────── storage ───────────────────────────── */
const memoryRows = sharedState("ai-providers.rows", () => new Map<ProviderId, StoredProvider>());
const cache = sharedState("ai-providers.cache", () => ({ rows: [] as StoredProvider[], at: 0, warned: false }));
const TTL_MS = 30_000;

async function loadRows(): Promise<StoredProvider[]> {
  if (dataBackend() !== "postgres") return [...memoryRows.values()].map((r) => ({ ...r }));
  const { loadAiProviderRows } = await import("@/lib/data/postgres/ai-providers");
  return loadAiProviderRows();
}

/** The cached settings (synchronous). Before the first refresh this is the environment-only view. */
export function aiConfig(): AiConfig {
  return effective(cache.rows);
}

/** Re-reads the saved settings when the cache is older than 30 s (or when forced). Never throws. */
export async function refreshAiConfig(force = false): Promise<void> {
  if (!force && Date.now() - cache.at < TTL_MS) return;
  try {
    cache.rows = await loadRows();
    cache.at = Date.now();
  } catch {
    cache.at = Date.now(); // e.g. the migration has not run yet: keep the environment-only view, retry later
    if (!cache.warned) console.warn("[ai] could not read AI provider settings; using environment keys only");
    cache.warned = true;
  }
}

/** Saves one provider's settings (memory backend here; PostgreSQL through the caller's transaction). */
export async function saveProviderRow(row: StoredProvider): Promise<void> {
  if (dataBackend() === "postgres") {
    const { saveAiProviderRow } = await import("@/lib/data/postgres/ai-providers");
    await saveAiProviderRow(row);
  } else {
    if (row.isDefault) for (const r of memoryRows.values()) r.isDefault = false;
    memoryRows.set(row.provider, { ...row });
  }
  cache.at = 0;
}

/** The saved rows as stored (keys included): for the settings dispatcher only. */
export async function storedRows(): Promise<StoredProvider[]> {
  if (dataBackend() === "postgres") {
    const { readAiProviderRowsInTx } = await import("@/lib/data/postgres/ai-providers");
    return readAiProviderRowsInTx();
  }
  return [...memoryRows.values()].map((r) => ({ ...r }));
}

/** Test helper: forgets saved settings (memory backend only). */
export function resetAiProviderMemory() {
  memoryRows.clear();
  cache.rows = [];
  cache.at = 0;
}
/** Test helper: makes the cache reflect the memory rows immediately. */
export async function primeAiConfigForTests() {
  cache.rows = [...memoryRows.values()];
  cache.at = Date.now();
}
