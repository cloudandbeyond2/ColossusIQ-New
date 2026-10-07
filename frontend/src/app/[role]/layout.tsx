import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { groupedModules, inNav } from "@/config/modules";
import { UNIVERSITY } from "@/config/tenancy";
import { collegeContext, isModuleEnabled, requireRole } from "@/lib/auth/server";
import { can, isRole, ROLE_META } from "@/lib/auth/roles";

export default async function PortalLayout({ children, params }: { children: React.ReactNode; params: Promise<{ role: string }> }) {
  const { role } = await params;
  if (!isRole(role)) notFound();
  const session = await requireRole(role);
  const ctx = await collegeContext(session);

  // Menus only show module areas the university has enabled for this college (and, for the Super Admin, only
  // university and platform work: see SUPER_ADMIN_NAV).
  const nav = groupedModules(role)
    .map((g) => ({
      group: g.group,
      items: g.items.filter((m) => inNav(role, m.slug, ctx.isAllColleges) && isModuleEnabled(m, ctx)).map((m) => ({ slug: m.slug, title: m.title, icon: m.icon, phase: m.phase })),
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
      {children}
    </AppShell>
  );
}
