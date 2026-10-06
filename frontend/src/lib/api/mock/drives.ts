import "server-only";
import type { z } from "zod";
import type { SessionPayload } from "@/lib/auth/session";
import { ALL_COLLEGES } from "@/config/tenancy";
import { getStore } from "@/lib/data";
import { cleanText, mask } from "@/lib/security/sanitize";
import { DriveBody, MAX_DRIVES, meetsDrive, type DriveDetail, type DriveItem, type DriveOverview } from "@/lib/api/drive-schemas";
import { driveStore, type DriveRow } from "./drive-store";
import { computeReadiness, type Readiness } from "./learning";
import type { MockResult } from "./router";

/*
 * Placement Drives. The placement officer schedules campus recruitment drives: company, role, date, package, who may
 * apply (departments and a minimum Placement Readiness total) and how it went (registered, shortlisted, offers). The
 * "eligible" numbers are worked out from the live readiness board each time, so they follow the students, not a snapshot.
 */

const ok = (body: unknown, status = 200): MockResult => ({ status, body });
const err = (status: number, code: string, message: string, fields?: Record<string, string>): MockResult => ({
  status,
  body: { error: { code, message, ...(fields ? { fields } : {}) } },
});
const invalid = (e: z.ZodError): MockResult => {
  const fields: Record<string, string> = {};
  for (const i of e.issues) fields[String(i.path[0] ?? "_")] ??= i.message;
  return err(422, "validation", "Please correct the highlighted fields.", fields);
};

const READERS = ["placement", "hod", "institution", "admin"];
/** Today in India time, e.g. "2026-10-06". */
export const todayIst = (): string => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);

async function board(s: SessionPayload): Promise<Readiness[]> {
  if (s.college === ALL_COLLEGES) return [];
  return (await getStore().readiness.board(s.college)).map(computeReadiness);
}

const phaseOf = (date: string, today: string): DriveItem["phase"] => (date > today ? "upcoming" : date === today ? "today" : "past");
const item = (r: DriveRow, students: Readiness[], today: string): DriveItem => ({ ...r, eligible: students.filter((x) => meetsDrive(r, x)).length, phase: phaseOf(r.date, today) });

function clean(b: DriveBody): DriveBody {
  const c = (v: string, n: number) => cleanText(v, n);
  return {
    ...b,
    company: c(b.company, 100),
    role: c(b.role, 100),
    venue: c(b.venue, 150),
    description: c(b.description, 1500),
    departments: [...new Set(b.departments.map((d) => c(d, 80)).filter(Boolean))],
    rounds: b.rounds.map((r) => c(r, 60)).filter(Boolean),
    packageMin: Math.round(b.packageMin * 10) / 10,
    packageMax: Math.round(b.packageMax * 10) / 10,
  };
}

/** Rules that depend on today's date or on the other drives, so the schema alone cannot check them. */
function problems(b: DriveBody, today: string): Record<string, string> | null {
  if (b.status === "Completed" && b.date > today) return { status: "A drive can be marked Completed only on or after its date" };
  return null;
}

export async function dispatchDrives(method: string, segs: string[], rawBody: unknown, s: SessionPayload): Promise<MockResult> {
  if (!READERS.includes(s.role)) return err(403, "forbidden", "Placement drives are managed by the placement office.");
  const canEdit = s.role === "placement";
  const store = driveStore();
  const today = todayIst();
  const id = segs[1];

  if (method === "GET" && segs.length === 1) {
    const [rows, students] = await Promise.all([store.list(s), board(s)]);
    const items = rows.map((r) => item(r, students, today));
    const done = items.filter((i) => i.status === "Completed");
    const priced = done.filter((i) => i.packageMax > 0);
    const body: DriveOverview = {
      items,
      departments: [...new Set(students.map((x) => x.department).filter(Boolean))].sort(),
      students: students.length,
      summary: {
        total: items.length,
        open: items.filter((i) => i.status === "Open").length,
        upcoming: items.filter((i) => (i.status === "Draft" || i.status === "Open") && i.phase !== "past").length,
        completed: done.length,
        offers: items.reduce((n, i) => n + i.offers, 0),
        averagePackage: priced.length ? Math.round((priced.reduce((n, i) => n + (i.packageMin + i.packageMax) / 2, 0) / priced.length) * 10) / 10 : null,
      },
      canEdit,
    };
    return ok(body);
  }

  if (method === "POST" && segs.length === 1) {
    if (!canEdit) return err(403, "forbidden", "Only the placement officer can schedule drives.");
    const p = DriveBody.safeParse(rawBody);
    if (!p.success) return invalid(p.error);
    const b = clean(p.data);
    const bad = problems(b, today);
    if (bad) return err(422, "validation", "Please correct the highlighted fields.", bad);
    const all = await store.list(s);
    if (all.length >= MAX_DRIVES) return err(409, "limit", `A college can keep up to ${MAX_DRIVES} drives. Delete old ones to add more.`);
    if (all.some((d) => d.company.toLowerCase() === b.company.toLowerCase() && d.role.toLowerCase() === b.role.toLowerCase() && d.date === b.date)) {
      return err(409, "duplicate", "A drive for this company, role and date already exists.");
    }
    const row = await store.create(s, b);
    return ok(item(row, await board(s), today), 201);
  }

  if (!id) return err(404, "not_found", "Not found.");

  // GET drives/:id — the drive and the students who meet its rules
  if (method === "GET" && segs.length === 2) {
    const row = await store.get(s, id);
    if (!row) return err(404, "not_found", "Drive not found.");
    const students = await board(s);
    const eligible = students.filter((x) => meetsDrive(row, x)).sort((a, b) => b.total - a.total);
    const body: DriveDetail = {
      drive: item(row, students, today),
      students: eligible.slice(0, 500).map((x) => ({ name: x.name, rollNo: mask(x.rollNo), department: x.department, total: x.total, status: x.status })),
    };
    return ok(body);
  }

  if (method === "PUT" && segs.length === 2) {
    if (!canEdit) return err(403, "forbidden", "Only the placement officer can change drives.");
    const p = DriveBody.safeParse(rawBody);
    if (!p.success) return invalid(p.error);
    const b = clean(p.data);
    const bad = problems(b, today);
    if (bad) return err(422, "validation", "Please correct the highlighted fields.", bad);
    const all = await store.list(s);
    if (!all.some((d) => d.id === id)) return err(404, "not_found", "Drive not found.");
    if (all.some((d) => d.id !== id && d.company.toLowerCase() === b.company.toLowerCase() && d.role.toLowerCase() === b.role.toLowerCase() && d.date === b.date)) {
      return err(409, "duplicate", "A drive for this company, role and date already exists.");
    }
    const row = await store.update(s, id, b);
    return row ? ok(item(row, await board(s), today)) : err(404, "not_found", "Drive not found.");
  }

  if (method === "DELETE" && segs.length === 2) {
    if (!canEdit) return err(403, "forbidden", "Only the placement officer can delete drives.");
    return (await store.remove(s, id)) ? ok({ ok: true }) : err(404, "not_found", "Drive not found.");
  }

  return err(404, "not_found", "Not found.");
}
