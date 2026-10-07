import { z } from "zod";

/** Shared by the browser and the server: the AI Providers settings (Gemini, Claude, ChatGPT). Keys are never sent back. */

export const ProviderId = z.enum(["gemini", "claude", "openai"]);
export type ProviderId = z.infer<typeof ProviderId>;

export const ProviderView = z.object({
  id: ProviderId,
  name: z.string(),
  vendor: z.string(),
  /** "settings" = saved here (encrypted), "environment" = the server's environment variable, null = no key. */
  keySource: z.enum(["settings", "environment"]).nullable(),
  /** The last four characters of the key in use, e.g. "••••3xQk"; never the key. */
  keyHint: z.string().nullable(),
  keyFormat: z.string(),
  envVar: z.string(),
  model: z.string(),
  defaultModel: z.string(),
  suggestedModels: z.array(z.string()),
  enabled: z.boolean(),
  isDefault: z.boolean(),
  usable: z.boolean(),
  updatedBy: z.string(),
  updatedAt: z.string().nullable(),
});
export type ProviderView = z.infer<typeof ProviderView>;

export const ProvidersOverview = z.object({
  providers: z.array(ProviderView),
  defaultProvider: ProviderId,
  /** Order the AI layer tries providers in right now (default first, then enabled fallbacks). */
  order: z.array(ProviderId),
  canEdit: z.boolean(),
  /** False when keys cannot be stored encrypted (MFA_ENCRYPTION_KEY missing on a PostgreSQL deployment). */
  canStoreKeys: z.boolean(),
});
export type ProvidersOverview = z.infer<typeof ProvidersOverview>;

const Key = z
  .string()
  .trim()
  .min(20, "That key looks too short")
  .max(300, "That key looks too long")
  .regex(/^[A-Za-z0-9_\-.:]+$/, "Paste the key exactly as shown, without spaces or quotes");
export const ProviderUpdate = z
  .object({
    apiKey: Key.optional(),
    model: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9.:-]{3,80}$/, "Use a model id such as gemini-2.5-flash")
      .optional(),
    enabled: z.boolean().optional(),
  })
  .strict();
export type ProviderUpdate = z.infer<typeof ProviderUpdate>;

export const DefaultBody = z.object({ provider: ProviderId }).strict();

export const TestResult = z.object({ ok: z.boolean(), message: z.string(), ms: z.number() });
export type TestResult = z.infer<typeof TestResult>;
