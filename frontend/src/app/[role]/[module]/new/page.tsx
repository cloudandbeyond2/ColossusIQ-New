import type { Metadata } from "next";
import { CrudForm } from "@/components/crud/crud-form";
import { resolveCrud } from "@/lib/auth/resource-access";

export const metadata: Metadata = { title: "Add record" };

export default async function NewRecordPage({ params }: { params: Promise<{ role: string; module: string }> }) {
  const { role, module } = await params;
  const { mod, resource, role: r, ctx } = await resolveCrud(role, module, true);
  return <CrudForm mod={mod} role={r} resource={resource} allColleges={ctx.isAllColleges} stream={ctx.stream} defaultDepartment={ctx.departmentName} />;
}
