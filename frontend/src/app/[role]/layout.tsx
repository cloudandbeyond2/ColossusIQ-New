import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { groupedModules, inNav } from "@/config/modules";
import { UNIVERSITY } from "@/config/tenancy";
import { collegeContext, feeLock, isModuleEnabled, lockedPaths, requireRole } from "@/lib/auth/server";
import { can, isRole, ROLE_META } from "@/lib/auth/roles";
import { FeeReminder } from "@/components/portal/fee-reminder";

export default async function PortalLayout({ children, params }: { children: React.ReactNode; params: Promise<{ role: string }> }) {
  const { role } = await params;
  if (!isRole(role)) notFound();
  const session = await requireRole(role);
  const ctx = await collegeContext(session);
  // While the account is locked for fees, the menu offers only the pages it can still open.
  const lock = await feeLock(session);
  const open = lock.locked ? new Set(lockedPaths(role).map((p) => p.split("/")[2])) : null;

  // Menus only show module areas the university has enabled for this college (and, for the Super Admin, only
  // university and platform work: see SUPER_ADMIN_NAV).
  const nav = groupedModules(role)
    .map((g) => ({
      group: g.group,
      items: g.items.filter((m) => inNav(role, m.slug, ctx.isAllColleges) && isModuleEnabled(m, ctx) && (!open || open.has(m.slug))).map((m) => ({ slug: m.slug, title: m.title, icon: m.icon, phase: m.phase })),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <AppShell
      role={role}
      roleLabel={ROLE_META[role].label}
      name={session.name}
      universityName={UNIVERSITY.name}
      collegeName={ctx.collegeName}
      collegeScope={ctx.scope}
      isSuperAdmin={role === "admin"}
      nav={nav}
      canChat={can(role, "ai:chat")}
    >
      {role === "student" ? <FeeReminder /> : null}
      {children}
    </AppShell>
  );
}
