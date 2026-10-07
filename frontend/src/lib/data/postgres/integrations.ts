import "server-only";
import { decryptSecret, encryptSecret } from "@/lib/auth/totp";
import type { StoredIntegration } from "@/lib/integrations/config";
import { db, prisma } from "./db";

/*
 * Integration settings on PostgreSQL: `platform_integrations` (db/migrations/0019_platform_integrations.sql). Secrets
 * are one JSON object encrypted with AES-256-GCM (MFA_ENCRYPTION_KEY) and decrypted only inside the server. Only the
 * Super Admin at "All colleges" scope can read or write through the application role (row-level security).
 */

interface Row {
  id: string;
  provider: string;
  enabled: boolean;
  settings: unknown;
  secretsEnc: Uint8Array | null;
  updatedBy: string;
  updatedAt: Date;
}

const dec = new TextDecoder();
const enc = new TextEncoder();

function toStored(r: Row): StoredIntegration {
  let secrets: Record<string, string> = {};
  if (r.secretsEnc?.length) {
    try {
      secrets = JSON.parse(dec.decode(decryptSecret(r.secretsEnc))) as Record<string, string>;
    } catch {
      secrets = {}; // wrong or missing MFA_ENCRYPTION_KEY: treat as no saved secrets
    }
  }
  const s = (r.settings ?? {}) as { values?: Record<string, string>; lastTest?: StoredIntegration["lastTest"] };
  return { id: r.id, provider: r.provider, enabled: r.enabled, values: s.values ?? {}, secrets, lastTest: s.lastTest ?? null, updatedBy: r.updatedBy, updatedAt: r.updatedAt.toISOString() };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const outside = () => (prisma() as any).platformIntegration;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const inside = () => (db() as any).platformIntegration;

/** For the process-wide cache: read outside any request transaction, as the table owner. */
export async function loadIntegrations(): Promise<StoredIntegration[]> {
  return ((await outside().findMany()) as Row[]).map(toStored);
}

export async function readIntegrationsInTx(): Promise<StoredIntegration[]> {
  return ((await inside().findMany()) as Row[]).map(toStored);
}

export async function saveIntegrationRow(r: StoredIntegration): Promise<void> {
  const secretsEnc = Object.keys(r.secrets).length ? Buffer.from(encryptSecret(enc.encode(JSON.stringify(r.secrets)))) : null;
  const data = { provider: r.provider, enabled: r.enabled, settings: { values: r.values, lastTest: r.lastTest }, secretsEnc, updatedBy: r.updatedBy, updatedAt: new Date(r.updatedAt) };
  await inside().upsert({ where: { id: r.id }, create: { id: r.id, ...data }, update: data });
}

export async function deleteIntegrationRow(id: string): Promise<void> {
  await inside().deleteMany({ where: { id } });
}
