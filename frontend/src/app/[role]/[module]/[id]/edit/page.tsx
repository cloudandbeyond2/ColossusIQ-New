import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CrudForm } from "@/components/crud/crud-form";
import { resolveCrud, SAFE_RECORD_ID } from "@/lib/auth/resource-access";

export const metadata: Metadata = { title: "Edit record" };

export default async function EditRecordPage({ params }: { params: Promise<{ role: string; module: string; id: string }> }) {
  const { role, module, id } = await params;
  const { mod, resource, role: r, ctx } = await resolveCrud(role, module, true);
  if (!SAFE_RECORD_ID.test(id)) notFound();
  return <CrudForm mod={mod} role={r} resource={resource} recordId={id} allColleges={ctx.isAllColleges} stream={ctx.stream} defaultDepartment={ctx.departmentName} />;
}
