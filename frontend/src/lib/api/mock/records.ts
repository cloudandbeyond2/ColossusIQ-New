import "server-only";
import { RESOURCES, type RecordValue, type ResourceDef, type ResourceRecord } from "@/config/resources";
import { streamOfType, type Stream } from "@/config/streams";
import { getStore } from "@/lib/data";

/* College (tenancy) helpers and record creation, on top of the configured data store. */

const COLLEGES = () => RESOURCES.colleges!;

export async function listColleges(): Promise<ResourceRecord[]> {
  return getStore().records.all(COLLEGES(), "all");
}
/** id → college record, for presenting many records at once. */
export async function collegeIndex(): Promise<Map<string, ResourceRecord>> {
  return new Map((await listColleges()).map((c) => [c.id, c]));
}
export async function getCollege(id: string | null | undefined): Promise<ResourceRecord | undefined> {
  return id && /^COL-\d{4}$/.test(id) ? getStore().records.get(COLLEGES(), id) : undefined;
}
export async function collegeName(id: string | null | undefined): Promise<string> {
  return String((await getCollege(id))?.name ?? "Unknown college");
}
export async function isCollegeActive(id: string): Promise<boolean> {
  return (await getCollege(id))?.status === "Active";
}
/** The academic stream of a college (null for the university-wide "all" scope). */
export async function collegeStream(id: string | null | undefined): Promise<Stream | null> {
  const c = await getCollege(id);
  if (!c) return null;
  return streamOfType(c.type || c.name);
}
/** Module groups enabled for a college (all groups for the "all" scope). */
export async function enabledGroups(collegeId: string): Promise<string[] | "all"> {
  if (collegeId === "all") return "all";
  const c = await getCollege(collegeId);
  return Array.isArray(c?.modules) ? (c.modules as string[]) : [];
}
export async function recordsInCollege(collegeId: string): Promise<number> {
  return getStore().records.countInCollege(collegeId);
}

export async function createRecord(res: ResourceDef, data: Record<string, RecordValue>, collegeId: string | null = null): Promise<ResourceRecord> {
  return getStore().records.create(res, data, res.scoped ? collegeId : null);
}

export function allResources(): ResourceDef[] {
  return Object.values(RESOURCES);
}
