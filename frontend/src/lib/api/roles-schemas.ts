import { z } from "zod";
import { PERMISSION_GROUPS, ROLES } from "@/lib/auth/roles";

/* Institution / Super Admin → Roles & Permissions: the permission matrix plus who holds each role right now. */

const Tone = z.enum(["brand", "gold", "teal", "rose", "amber", "sky", "neutral"]);

export const ModuleClosedReason = z.enum(["role", "college", "stream"]);
export type ModuleClosedReason = z.infer<typeof ModuleClosedReason>;

export const RoleRow = z.object({
  id: z.enum(ROLES),
  label: z.string(),
  description: z.string(),
  permissions: z.array(z.string()),
  users: z.object({ total: z.number(), active: z.number(), invited: z.number(), suspended: z.number(), mfaOff: z.number() }),
  /** A few of the accounts holding the role (no emails). */
  members: z.array(z.object({ name: z.string(), status: z.string(), department: z.string() })),
  modules: z.object({
    granted: z.number(),
    open: z.number(),
    byGroup: z.array(z.object({ group: z.string(), open: z.number(), total: z.number() })),
    /** Modules the role is granted but cannot open right now, and why: Module Control ("role"), the college's switched-off groups ("college"), or its stream ("stream"). */
    closed: z.array(z.object({ slug: z.string(), title: z.string(), group: z.string(), reason: ModuleClosedReason })),
  }),
});
export type RoleRow = z.infer<typeof RoleRow>;

export const RolesOverview = z.object({
  scopeLabel: z.string(),
  allColleges: z.boolean(),
  groups: z.array(z.enum(PERMISSION_GROUPS)),
  permissions: z.array(z.object({ key: z.string(), label: z.string(), group: z.enum(PERMISSION_GROUPS) })),
  roles: z.array(RoleRow),
  flags: z.array(z.object({ tone: Tone, title: z.string(), body: z.string() })),
  recent: z.array(z.object({ at: z.string(), actor: z.string(), action: z.string(), target: z.string() })),
  canManageUsers: z.boolean(),
  generatedAt: z.string(),
});
export type RolesOverview = z.infer<typeof RolesOverview>;
