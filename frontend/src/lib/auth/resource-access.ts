import "server-only";
import { notFound, redirect } from "next/navigation";
import { findModule, type ModuleDef } from "@/config/modules";
import { findResource, type ResourceDef } from "@/config/resources";
import { can, isRole, type Role } from "./roles";
import { collegeContext, isModuleEnabled, requireRole, type CollegeContext } from "./server";

/** Resolves a CRUD module page and enforces role, college module toggles and manage access before any UI renders. */
export async function resolveCrud(
  roleParam: string,
  moduleParam: string,
  needManage = false,
): Promise<{ role: Role; mod: ModuleDef; resource: ResourceDef; canManage: boolean; ctx: CollegeContext }> {
  if (!isRole(roleParam)) notFound();
  if (moduleParam === "courses" && ["institution", "faculty", "hod", "admin"].includes(roleParam)) {
    redirect(`/${roleParam}/course-management`);
  }
  const session = await requireRole(roleParam);
  const ctx = await collegeContext(session);
  const mod = findModule(moduleParam);
  if (!mod || !mod.roles.includes(roleParam) || mod.template !== "crud" || !isModuleEnabled(mod, ctx)) notFound();
  const resource = findResource(mod.resource);
  if (!resource) notFound();
  const canManage = can(roleParam, resource.managePermission);
  if (needManage && !canManage) redirect(`/${roleParam}/${mod.slug}`);
  return { role: roleParam, mod: { ...mod, roles: [...mod.roles] }, resource, canManage, ctx };
}

export const SAFE_RECORD_ID = /^[A-Za-z0-9_-]{1,64}$/;
