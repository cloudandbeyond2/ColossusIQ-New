import { z } from "zod";
import { ROLES } from "@/lib/auth/roles";

/* Super Admin → Module Control: which modules each role may use. */

export const RoleId = z.enum(ROLES);

export const ControlModule = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  group: z.string(),
  icon: z.string(),
  phase: z.string(),
  roles: z.array(RoleId),
});
export type ControlModule = z.infer<typeof ControlModule>;

export const ModuleControlOverview = z.object({
  modules: z.array(ControlModule),
  groups: z.array(z.string()),
  roles: z.array(z.object({ id: RoleId, label: z.string() })),
  /** Switched-off pairs, "slug|role". */
  disabled: z.array(z.string()),
  /** Pairs that can never be switched off (the Super Admin's own controls). */
  locked: z.array(z.string()),
  canEdit: z.boolean(),
});
export type ModuleControlOverview = z.infer<typeof ModuleControlOverview>;

export const ModuleControlBody = z.object({
  disabled: z.array(z.string().regex(/^[a-z0-9-]{2,60}\|[a-z]{3,12}$/)).max(1200),
});
export type ModuleControlBody = z.infer<typeof ModuleControlBody>;

/* Super Admin home → platform health. */
export const PlatformHealth = z.object({
  providers: z.array(z.object({ id: z.string(), name: z.string(), state: z.string(), tone: z.enum(["brand", "gold", "teal", "rose", "amber", "sky", "neutral"]), isDefault: z.boolean() })),
  ai: z.object({ requests: z.number(), ok: z.number(), since: z.string(), avgMs: z.number() }),
  access: z.array(z.object({ role: RoleId, label: z.string(), on: z.number(), granted: z.number() })),
  switchedOff: z.number(),
  integrations: z.array(z.object({ id: z.string(), name: z.string(), provider: z.string().nullable(), status: z.string() })),
  database: z.enum(["postgres", "memory"]),
});
export type PlatformHealth = z.infer<typeof PlatformHealth>;
