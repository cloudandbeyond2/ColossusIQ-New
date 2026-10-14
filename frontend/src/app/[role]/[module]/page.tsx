import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { findModule } from "@/config/modules";
import { findResource } from "@/config/resources";
import { can, isRole } from "@/lib/auth/roles";
import { collegeContext, isModuleEnabled, requireRole } from "@/lib/auth/server";
import { ModuleView } from "@/components/modules/module-view";
import { BespokeModule, hasBespoke } from "@/components/portal/bespoke";
import { CrudList } from "@/components/crud/crud-list";

export async function generateMetadata({ params }: { params: Promise<{ role: string; module: string }> }): Promise<Metadata> {
  const { role, module } = await params;
  if (module === "courses" && ["institution", "faculty", "hod", "admin"].includes(role)) {
    return { title: "Course Management" };
  }
  const mod = findModule(module);
  // Don't reveal names of modules outside the caller's role.
  return { title: mod && isRole(role) && mod.roles.includes(role) ? mod.title : "Not found" };
}

export default async function ModulePage({ params }: { params: Promise<{ role: string; module: string }> }) {
  const { role, module } = await params;
  if (module === "courses" && ["institution", "faculty", "hod", "admin"].includes(role)) {
    redirect(`/${role}/course-management`);
  }
  const mod = findModule(module);
  // Unknown modules, modules not granted to this role, and areas switched off for this college all look like 404.
  if (!isRole(role) || !mod || !mod.roles.includes(role)) notFound();
  const ctx = await collegeContext(await requireRole(role));
  if (!isModuleEnabled(mod, ctx)) notFound();

  const def = { ...mod, roles: [...mod.roles] };
  if (mod.template === "crud") {
    const resource = findResource(mod.resource);
    if (!resource) notFound();
    return <CrudList mod={def} role={role} resource={resource} canManage={can(role, resource.managePermission)} allColleges={ctx.isAllColleges} />;
  }
  if (mod.template === "bespoke" || hasBespoke(mod.slug)) return <BespokeModule mod={def} role={role} />;
  return <ModuleView mod={def} role={role} />;
}
