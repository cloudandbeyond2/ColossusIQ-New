import "server-only";
import type { Stream } from "@/config/streams";
import { db, forget, isUuid, memo } from "./db";

/*
 * Name ↔ id translation. The API speaks in public ids and labels (COL-1001, "Computer Science &
 * Engineering", "4"); the tables use uuids and lookup ids.
 */

/* ── stream lookups (static reference data: loaded once per process) ── */
interface NamedRow {
  id: number;
  name: string;
  stream: string | null;
}
interface StreamLookups {
  departments: NamedRow[];
  programmes: NamedRow[];
  terms: NamedRow[];
  designations: NamedRow[];
  typeStream: Map<string, Stream>;
}
let lookups: StreamLookups | undefined;

export async function streamLookups(): Promise<StreamLookups> {
  if (lookups) return lookups;
  const t = db();
  const [departments, programmes, terms, designations, types] = await Promise.all([
    t.department.findMany({ select: { id: true, name: true, streamKey: true } }),
    t.programme.findMany({ select: { id: true, name: true, streamKey: true } }),
    t.term.findMany({ select: { id: true, name: true, streamKey: true }, orderBy: { position: "asc" } }),
    t.designation.findMany({ select: { id: true, name: true, streamKey: true } }),
    t.collegeType.findMany(),
  ]);
  const rows = (xs: Array<{ id: number; name: string; streamKey: string | null }>) => xs.map((x) => ({ id: x.id, name: x.name, stream: x.streamKey }));
  lookups = {
    departments: rows(departments),
    programmes: rows(programmes),
    terms: rows(terms),
    designations: rows(designations),
    typeStream: new Map(types.map((x) => [x.name, x.streamKey as Stream])),
  };
  return lookups;
}

export const DEPT_ALIASES: Record<string, string> = {
  cse: "Computer Science & Engineering",
  cs: "Computer Science & Engineering",
  "computer science": "Computer Science & Engineering",
  it: "Information Technology",
  "information tech": "Information Technology",
  aids: "Artificial Intelligence & Data Science",
  "ai&ds": "Artificial Intelligence & Data Science",
  "ai & ds": "Artificial Intelligence & Data Science",
  "ai and ds": "Artificial Intelligence & Data Science",
  ece: "Electronics & Communication",
  eee: "Electrical & Electronics",
  mech: "Mechanical Engineering",
  me: "Mechanical Engineering",
  civil: "Civil Engineering",
  ce: "Civil Engineering",
  sh: "Science & Humanities",
  "s&h": "Science & Humanities",
  mba: "Business Administration",
  bba: "Business Administration",
};

type LookupKind = "departments" | "programmes" | "terms" | "designations";

/** Lookup id for a name within a stream (designations also match the stream-independent ones). */
export async function lookupId(kind: LookupKind, stream: Stream, name: string): Promise<number> {
  const l = await streamLookups();
  const raw = (name ?? "").trim();
  const canonical = kind === "departments" ? (DEPT_ALIASES[raw.toLowerCase()] ?? raw) : raw;
  const row = l[kind].find(
    (r) =>
      (r.name === canonical || r.name.toLowerCase() === canonical.toLowerCase()) &&
      (r.stream === stream || (kind === "designations" && r.stream === null))
  );
  if (!row) throw new LookupError(kind, name, stream);
  return row.id;
}
export async function lookupName(kind: LookupKind, id: number | null | undefined): Promise<string> {
  if (id === null || id === undefined) return "";
  const l = await streamLookups();
  return l[kind].find((r) => r.id === id)?.name ?? "";
}

export class LookupError extends Error {
  constructor(kind: string, name: string, stream: string) {
    super(`"${name}" is not one of the ${kind} of the ${stream} stream`);
  }
}

/* ── colleges (per request: they change) ── */
export interface CollegeRow {
  id: string;
  publicId: string;
  name: string;
  type: string;
  status: string;
  stream: Stream;
}
async function colleges(): Promise<CollegeRow[]> {
  return memo("colleges", async () => {
    const l = await streamLookups();
    const rows = await db().college.findMany({ select: { id: true, publicId: true, name: true, type: true, status: true } });
    return rows.map((r) => ({ ...r, status: String(r.status), stream: l.typeStream.get(r.type) ?? "engineering" }));
  });
}
export function collegesChanged() {
  forget("colleges");
}
export async function collegeByPublic(publicId: string | null | undefined): Promise<CollegeRow | undefined> {
  return publicId ? (await colleges()).find((c) => c.publicId === publicId) : undefined;
}
export async function collegeByUuid(uuid: string | null | undefined): Promise<CollegeRow | undefined> {
  return uuid ? (await colleges()).find((c) => c.id === uuid) : undefined;
}
export async function collegeUuid(publicId: string): Promise<string> {
  const c = await collegeByPublic(publicId);
  if (!c) throw new Error(`Unknown college ${publicId}`);
  return c.id;
}
export async function collegePublic(uuid: string | null | undefined): Promise<string> {
  return (await collegeByUuid(uuid))?.publicId ?? "";
}

export async function universityId(): Promise<string> {
  return memo("university", async () => (await db().university.findFirstOrThrow({ select: { id: true } })).id);
}

/* ── people ── */
/** The students row of a signed-in student (sub = users.id), or undefined for demo/unknown subs. */
export async function studentOf(sub: string): Promise<{ id: string; collegeId: string; name: string; rollNo: string; departmentId: number } | undefined> {
  if (!isUuid(sub)) return undefined;
  return memo(`student:${sub}`, async () => {
    const s = await db().student.findUnique({ where: { userId: sub }, select: { id: true, collegeId: true, rollNo: true, departmentId: true, user: { select: { fullName: true } } } });
    return s ? { id: s.id, collegeId: s.collegeId, name: s.user.fullName, rollNo: s.rollNo, departmentId: s.departmentId } : undefined;
  });
}
/** users.id of a student row. */
export async function studentUser(studentId: string): Promise<string> {
  return memo(`studentUser:${studentId}`, async () => (await db().student.findUniqueOrThrow({ where: { id: studentId }, select: { userId: true } })).userId);
}
export const userOrNull = (sub: string | null | undefined): string | null => (isUuid(sub) ? sub : null);

/* ── media references ("MED-…" uploaded, or a bundled /campus/*.svg) ── */
export async function imageRef(ref: unknown): Promise<{ mediaId: string | null; builtin: string | null }> {
  const s = typeof ref === "string" ? ref : "";
  if (/^MED-[a-f0-9]{24}$/.test(s)) {
    const m = await db().mediaAsset.findUnique({ where: { publicId: s }, select: { id: true } });
    if (!m) throw new Error("Unknown image");
    return { mediaId: m.id, builtin: null };
  }
  return { mediaId: null, builtin: s || null };
}
export function refOf(media: { publicId: string } | null | undefined, builtin: string | null | undefined): string {
  return media?.publicId ?? builtin ?? "";
}

/* ── formatting ── */
export const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
export const toDay = (s: unknown) => new Date(`${String(s)}T00:00:00Z`);
export const hhmm = (d: Date) => d.toISOString().slice(11, 16);
export const toTime = (s: unknown) => {
  const str = String(s || "").trim();
  const timePart = str.length === 5 ? `${str}:00` : str.length >= 8 ? str.slice(0, 8) : "00:00:00";
  return new Date(`1970-01-01T${timePart}Z`);
};
export const num = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number(v));
export const text = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
