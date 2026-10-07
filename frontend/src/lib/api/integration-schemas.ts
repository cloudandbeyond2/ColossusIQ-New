import { z } from "zod";

/* Integrations & Setup (Super Admin): the API contract. Secret values never leave the server; only a hint does. */

export const IntegrationStatus = z.enum(["Connected", "Saved", "Incomplete", "Off", "Not set up"]);
export type IntegrationStatus = z.infer<typeof IntegrationStatus>;

export const TestResult = z.object({ ok: z.boolean(), message: z.string(), ms: z.number() });
export type TestResult = z.infer<typeof TestResult>;

export const IntegrationView = z.object({
  id: z.string(),
  provider: z.string().nullable(),
  enabled: z.boolean(),
  /** Where the settings come from: saved here, the server environment, or nowhere yet. */
  source: z.enum(["saved", "environment", "none"]),
  status: IntegrationStatus,
  /** Non-secret settings in effect. */
  values: z.record(z.string(), z.string()),
  /** Secret settings: a hint such as "••••a1b2" when set (and whether it came from the environment), else null. */
  secrets: z.record(z.string(), z.object({ hint: z.string(), fromEnv: z.boolean() }).nullable()),
  /** Labels of required settings still missing. */
  missing: z.array(z.string()),
  lastTest: TestResult.extend({ at: z.string() }).nullable(),
  updatedBy: z.string(),
  updatedAt: z.string().nullable(),
});
export type IntegrationView = z.infer<typeof IntegrationView>;

export const IntegrationsOverview = z.object({
  integrations: z.array(IntegrationView),
  canEdit: z.boolean(),
  canStoreSecrets: z.boolean(),
});
export type IntegrationsOverview = z.infer<typeof IntegrationsOverview>;

export const IntegrationUpdate = z.object({
  provider: z.string().min(1).max(40),
  enabled: z.boolean(),
  /** Non-secret settings (the whole set for this provider). */
  values: z.record(z.string().max(40), z.string().max(6000)).default({}),
  /** New secret values only; secrets left out keep their saved value. */
  secrets: z.record(z.string().max(40), z.string().max(6000)).default({}),
  /** Secrets to forget (an environment value, if any, then applies). */
  clear: z.array(z.string().max(40)).max(20).default([]),
});
export type IntegrationUpdate = z.infer<typeof IntegrationUpdate>;
