import "server-only";
import { ALL_COLLEGES } from "@/config/tenancy";
import { MODULE_GROUPS, MODULES } from "@/config/modules";
import { ROLE_META, ROLES } from "@/lib/auth/roles";
import type { SessionPayload } from "@/lib/auth/session";
import { ModuleControlBody, type ModuleControlOverview } from "@/lib/api/module-control-schemas";
import { disabledPairs, isLocked, pairKey, saveDisabledPairs } from "@/lib/module-access";
import { audit } from "./audit";
import { rateLimit } from "./rate-limit";
import type { MockResult } from "./router";

/*
 * Module Control (University Super Admin): switch any module on or off for each role, university-wide. A module
 * switched off for a role leaves that role's menu, its page returns 404 and its API area returns 403. The Super
 * Admin's own controls (this page, colleges, users, roles, security, audit log, AI providers) cannot be switched off.
 */

const ok = (body: unknown, status = 200): MockResult => ({ status, body });
const err = (status: number, code: string, message: string): MockResult => ({ status, body: { error: { code, message } } });

async function overview(s: SessionPayload): Promise<ModuleControlOverview> {
  const locked: string[] = [];
  for (const m of MODULES) for (const r of m.roles) if (isLocked(m.slug, r)) locked.push(pairKey(m.slug, r));
  return {
    modules: MODULES.map((m) => ({ slug: m.slug, title: m.title, description: m.description, group: m.group, icon: m.icon, phase: m.phase, roles: [...m.roles] })),
    groups: MODULE_GROUPS.filter((g) => MODULES.some((m) => m.group === g)),
    roles: ROLES.map((id) => ({ id, label: ROLE_META[id].label })),
    disabled: [...(await disabledPairs())].sort(),
    locked,
    canEdit: s.mfa && s.college === ALL_COLLEGES,
  };
}

export async function dispatchModuleControl(method: string, segs: string[], rawBody: unknown, s: SessionPayload): Promise<MockResult> {
  if (s.role !== "admin") return err(403, "forbidden", "Only the University Super Admin can manage module access.");
  if (segs.length !== 1) return err(404, "not_found", "Not found.");
  if (method === "GET") return ok(await overview(s));
  if (method !== "PUT") return err(405, "method_not_allowed", "Method not allowed.");
  if (!s.mfa) return err(403, "mfa_required", "Confirm your sign-in code first.");
  if (s.college !== ALL_COLLEGES) return err(409, "scope", "Switch to “All colleges” to change module access for the whole university.");
  if (!rateLimit(`module-control:${s.sub}`, 60, 10 * 60_000).ok) return err(429, "rate_limited", "Too many changes. Please wait a few minutes.");
  const parsed = ModuleControlBody.safeParse(rawBody);
  if (!parsed.success) return err(422, "validation", "The module list was not valid.");

  const next = new Set<string>();
  for (const k of parsed.data.disabled) {
    const [slug, role] = k.split("|") as [string, (typeof ROLES)[number]];
    const mod = MODULES.find((m) => m.slug === slug);
    if (!mod || !(ROLES as readonly string[]).includes(role) || !mod.roles.includes(role)) return err(422, "validation", `“${k}” is not a module granted to that role.`);
    if (isLocked(slug, role)) return err(422, "locked", `${mod.title} cannot be switched off for the Super Admin.`);
    next.add(k);
  }
  const before = await disabledPairs();
  const off = [...next].filter((k) => !before.has(k));
  const on = [...before].filter((k) => !next.has(k));
  await saveDisabledPairs([...next].sort(), s.name);
  const list = (ks: string[]) => (ks.length > 6 ? `${ks.slice(0, 6).join(", ")} +${ks.length - 6} more` : ks.join(", "));
  if (off.length) await audit(s.name, "module-control.off", list(off), { collegeId: null, actorSub: s.sub });
  if (on.length) await audit(s.name, "module-control.on", list(on), { collegeId: null, actorSub: s.sub });
  return ok(await overview(s));
}
