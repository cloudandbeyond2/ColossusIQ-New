import "server-only";
import { db, prisma } from "./db";

/*
 * Module Control on PostgreSQL: `module_access` (db/migrations/0017_module_access.sql). Rows switch a module off for
 * a role. Everyone may read it; only the Super Admin at "All colleges" scope may write it (row-level security).
 */

interface Row {
  moduleSlug: string;
  role: string;
  enabled: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const outside = () => (prisma() as any).moduleAccess;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const inside = () => (db() as any).moduleAccess;

/** For the process-wide cache: read outside any request transaction. */
export async function loadDisabledPairs(): Promise<string[]> {
  return ((await outside().findMany({ where: { enabled: false } })) as Row[]).map((r) => `${r.moduleSlug}|${r.role}`);
}

/** Replaces the switched-off pairs, inside the Super Admin's request transaction. */
export async function replaceDisabledPairs(pairs: string[], by: string): Promise<void> {
  await inside().deleteMany({});
  if (!pairs.length) return;
  await inside().createMany({
    data: pairs.map((k) => {
      const [moduleSlug, role] = k.split("|");
      return { moduleSlug, role, enabled: false, updatedBy: by };
    }),
  });
}
