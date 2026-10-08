import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isRole } from "@/lib/auth/roles";
import { feeLock, requireRole } from "@/lib/auth/server";
import { Card } from "@/components/ui/primitives";
import { Fi } from "@/components/ui/icon";

export const metadata: Metadata = { title: "Access awaiting clearance" };

/** Shown to college staff while the University has not cleared their college for the academic year. */
export default async function LockedPage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  if (!isRole(role) || role === "student") notFound();
  const session = await requireRole(role);
  const lock = await feeLock(session);
  if (!lock.locked) redirect(`/${role}`);
  return (
    <Card className="mx-auto mt-8 max-w-xl space-y-4 p-8 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber/15 text-amber">
        <Fi name="lock" className="text-2xl" />
      </span>
      <h1 className="text-xl font-semibold text-ink">Access for {lock.academicYear} is awaiting clearance</h1>
      <p className="text-sm text-ink-2">
        The University has not yet cleared your college for the {lock.academicYear} academic year. Your work is safe; access opens again as soon as the University Super Admin clears your college.
      </p>
      <p className="text-xs text-ink-3">Please contact your Principal or the University office. You can still read the Notice Board.</p>
    </Card>
  );
}
