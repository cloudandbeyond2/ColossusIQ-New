import "server-only";
import { MODULES, findModule } from "@/config/modules";
import { RESOURCES, USER_ROLE_OPTIONS } from "@/config/resources";
import { ALL_COLLEGES, TOGGLEABLE_GROUPS } from "@/config/tenancy";
import { PERMISSION_CATALOG, PERMISSION_GROUPS, ROLE_META, ROLE_PERMISSIONS, ROLES, can, type Role } from "@/lib/auth/roles";
import type { SessionPayload } from "@/lib/auth/session";
import { getStore } from "@/lib/data";
import { disabledPairs, pairKey } from "@/lib/module-access";
import type { RolesOverview, RoleRow } from "@/lib/api/roles-schemas";
import { recentAudit } from "./audit";
import { collegeStream, enabledGroups, getCollege } from "./records";
import type { MockResult } from "./router";

/*
 * Roles & Permissions. The permission matrix comes from the role definitions the API itself enforces; next to it sit the
 * live facts about the college: how many accounts hold each role, which modules each role can really open (Module
 * Control, the college's switched-off groups and its stream all count) and the most recent role and access changes.
 */

const ok = (body: unknown, status = 200): MockResult => ({ status, body });
const err = (status: number, code: string, message: string): MockResult => ({ status, body: { error: { code, message } } });

const str = (v: unknown): string => (typeof v === "string" ? v : "");
/** Stored user records carry the role's display name ("Faculty", "Principal / Institution Admin" …); the options are in ROLES order. */
const ROLE_OF_LABEL = new Map<string, Role>(USER_ROLE_OPTIONS.map((label, i) => [label, ROLES[i]!]));
const CHANGE = /user|role|module|access|permission|suspend|invite|mfa/i;
const MEMBERS_SHOWN = 6;

export async function rolesOverview(session: SessionPayload): Promise<RolesOverview> {
  const scope = session.college;
  const allColleges = scope === ALL_COLLEGES;

  const [users, pairs, stream, groups, college, audit] = await Promise.all([
    getStore().records.all(RESOURCES.users!, scope),
    disabledPairs(),
    allColleges ? Promise.resolve(null) : collegeStream(scope),
    enabledGroups(scope),
    allColleges ? Promise.resolve(undefined) : getCollege(scope),
    recentAudit(80, scope),
  ]);

  const byRole = new Map<Role, typeof users>();
  for (const u of users) {
    const role = ROLE_OF_LABEL.get(str(u.role));
    if (role) byRole.set(role, [...(byRole.get(role) ?? []), u]);
  }

  const roles: RoleRow[] = ROLES.map((id) => {
    const held = byRole.get(id) ?? [];
    const count = (status: string) => held.filter((u) => str(u.status) === status).length;

    const granted = MODULES.filter((m) => m.roles.includes(id));
    const closed: RoleRow["modules"]["closed"] = [];
    const tally = new Map<string, { open: number; total: number }>();
    for (const m of granted) {
      const reason: RoleRow["modules"]["closed"][number]["reason"] | null = pairs.has(pairKey(m.slug, id))
        ? "role"
        : m.streams && stream && !m.streams.includes(stream)
          ? "stream"
          : (TOGGLEABLE_GROUPS as readonly string[]).includes(m.group) && groups !== "all" && !groups.includes(m.group)
            ? "college"
            : null;
      const g = tally.get(m.group) ?? { open: 0, total: 0 };
      g.total++;
      if (reason) closed.push({ slug: m.slug, title: m.title, group: m.group, reason });
      else g.open++;
      tally.set(m.group, g);
    }

    return {
      id,
      label: ROLE_META[id].label,
      description: ROLE_META[id].description,
      permissions: [...ROLE_PERMISSIONS[id]],
      users: {
        total: held.length,
        active: count("Active"),
        invited: count("Invited"),
        suspended: count("Suspended"),
        mfaOff: held.filter((u) => str(u.status) === "Active" && u.mfaRequired === false).length,
      },
      members: held
        .slice()
        .sort((a, b) => (str(a.status) === "Active" ? 0 : 1) - (str(b.status) === "Active" ? 0 : 1) || str(a.fullName).localeCompare(str(b.fullName)))
        .slice(0, MEMBERS_SHOWN)
        .map((u) => ({ name: str(u.fullName) || "Unnamed", status: str(u.status) || "Active", department: str(u.department) })),
      modules: {
        granted: granted.length,
        open: granted.length - closed.length,
        byGroup: [...tally.entries()].map(([group, v]) => ({ group, ...v })),
        closed,
      },
    };
  });

  const flags: RolesOverview["flags"] = [];
  const mfaOff = roles.reduce((n, r) => n + r.users.mfaOff, 0);
  if (mfaOff > 0) {
    flags.push({ tone: "amber", title: `${mfaOff} active account${mfaOff === 1 ? " does" : "s do"} not require MFA`, body: "Switch on multi-factor authentication for these users in User Management, starting with anyone who can manage users or admissions." });
  }
  const admins = roles.find((r) => r.id === "admin")!.users.active;
  if (admins > 2) {
    flags.push({ tone: "amber", title: `${admins} active University Super Admin accounts`, body: "The Super Admin role can reach every college. Keep it to the few people who need it." });
  }
  const invited = roles.reduce((n, r) => n + r.users.invited, 0);
  if (invited > 0) flags.push({ tone: "sky", title: `${invited} invitation${invited === 1 ? " is" : "s are"} still pending`, body: "These people hold a role on paper but cannot use it until they sign in and enrol MFA." });
  if (!allColleges) {
    const empty = roles.filter((r) => ["hod", "placement", "institution"].includes(r.id) && r.users.active === 0).map((r) => r.label);
    if (empty.length) flags.push({ tone: "amber", title: `No active ${empty.join(", ")} account`, body: "Approvals and queues for these roles have no owner in this college." });
  }
  const offFor = roles.filter((r) => r.modules.closed.some((m) => m.reason === "role"));
  if (offFor.length) {
    const n = offFor.reduce((sum, r) => sum + r.modules.closed.filter((m) => m.reason === "role").length, 0);
    flags.push({ tone: "neutral", title: `Module Control has switched off ${n} module${n === 1 ? "" : "s"} for ${offFor.length} role${offFor.length === 1 ? "" : "s"}`, body: `${offFor.map((r) => r.label).join(", ")} lose these from their menus, and the API refuses them.` });
  }

  return {
    scopeLabel: allColleges ? "All colleges" : str(college?.name) || "Your college",
    allColleges,
    groups: [...PERMISSION_GROUPS],
    permissions: (Object.keys(PERMISSION_CATALOG) as Array<keyof typeof PERMISSION_CATALOG>).map((key) => ({ key, ...PERMISSION_CATALOG[key] })),
    roles,
    flags,
    recent: audit
      .filter((a) => CHANGE.test(`${a.action} ${a.target}`))
      .slice(0, 10)
      .map((a) => ({ at: a.at, actor: a.actor, action: a.action, target: a.target })),
    canManageUsers: can(session.role, "users:manage"),
    generatedAt: new Date().toISOString(),
  };
}

export async function dispatchRolesPermissions(method: string, segs: string[], session: SessionPayload): Promise<MockResult> {
  if (!findModule("roles-permissions")?.roles.includes(session.role)) return err(403, "forbidden", "Roles and permissions are shown to the college principal and the University Super Admin.");
  if (method !== "GET" || segs.length !== 1) return err(404, "not_found", "Not found.");
  return ok(await rolesOverview(session));
}
