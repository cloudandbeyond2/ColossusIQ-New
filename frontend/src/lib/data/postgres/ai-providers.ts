import "server-only";
import { decryptSecret, encryptSecret } from "@/lib/auth/totp";
import type { ProviderId, StoredProvider } from "@/lib/ai/ai-config";
import { db, prisma } from "./db";

/*
 * AI provider settings on PostgreSQL: `ai_provider_settings` (db/migrations/0015_ai_providers.sql). University-wide,
 * written only by the Super Admin at "All colleges" scope (row-level security). API keys are stored encrypted with
 * AES-256-GCM (MFA_ENCRYPTION_KEY) and decrypted only inside the server.
 */

interface Row {
  provider: string;
  apiKeyEnc: Uint8Array | null;
  model: string;
  enabled: boolean;
  isDefault: boolean;
  updatedBy: string;
  updatedAt: Date;
}

const dec = new TextDecoder();
const enc = new TextEncoder();

function toStored(r: Row): StoredProvider {
  let apiKey: string | null = null;
  if (r.apiKeyEnc && r.apiKeyEnc.length) {
    try {
      apiKey = dec.decode(decryptSecret(r.apiKeyEnc));
    } catch {
      apiKey = null; // wrong or missing MFA_ENCRYPTION_KEY: treat as no saved key
    }
  }
  return { provider: r.provider as ProviderId, apiKey, model: r.model, enabled: r.enabled, isDefault: r.isDefault, updatedBy: r.updatedBy, updatedAt: r.updatedAt.toISOString() };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const outside = () => (prisma() as any).aiProviderSetting;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const inside = () => (db() as any).aiProviderSetting;

/** For the process-wide cache: read outside any request transaction, as the table owner. */
export async function loadAiProviderRows(): Promise<StoredProvider[]> {
  return ((await outside().findMany()) as Row[]).map(toStored);
}

/** For the settings page: read inside the admin's request transaction. */
export async function readAiProviderRowsInTx(): Promise<StoredProvider[]> {
  return ((await inside().findMany()) as Row[]).map(toStored);
}

export async function saveAiProviderRow(row: StoredProvider): Promise<void> {
  const apiKeyEnc = row.apiKey ? Buffer.from(encryptSecret(enc.encode(row.apiKey))) : null;
  const data = { apiKeyEnc, model: row.model, enabled: row.enabled, isDefault: row.isDefault, updatedBy: row.updatedBy, updatedAt: new Date(row.updatedAt) };
  if (row.isDefault) await inside().updateMany({ where: { isDefault: true, NOT: { provider: row.provider } }, data: { isDefault: false } });
  await inside().upsert({ where: { provider: row.provider }, create: { provider: row.provider, ...data }, update: data });
}
