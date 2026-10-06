import "server-only";
import type { z } from "zod";
import type { SessionPayload } from "@/lib/auth/session";
import { dataBackend } from "@/lib/data";
import type { Notification } from "@/lib/api/schemas";
import { EXPERIENCE_CATEGORIES, ExperienceInput, ExperiencePatch, MAX_ACTIVITIES, ReviewBody, type ExperienceItem, type ExperienceOverview } from "@/lib/api/experience-schemas";
import { experienceStore, type ExperienceRow } from "./experience-store";
import { getStudentAcademicProfile } from "./student-profile";
import type { MockResult } from "./router";

/*
 * Experience Passport. A student records what they have done outside the classroom (volunteering, leadership,
 * competitions, conferences, social service …). Each entry starts as Pending; a faculty member or HOD of the same
 * college checks it (often against the evidence link) and verifies it or sends it back with a note. Editing an entry
 * that was already reviewed sends it back for review, so "Verified" always describes what is on the page.
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

const isStaff = (s: SessionPayload) => s.role === "faculty" || s.role === "hod" || s.role === "admin";
const ROLE_LABEL: Record<string, string> = { faculty: "Faculty", hod: "HOD", admin: "Admin" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthLabel = (m: string): string => `${MONTHS[Number(m.slice(5, 7)) - 1] ?? ""} ${m.slice(0, 4)}`;
export const periodOf = (start: string, end: string | null): string => (end === null ? `${monthLabel(start)} – Present` : end === start ? monthLabel(start) : `${monthLabel(start)} – ${monthLabel(end)}`);
/** The current month in India time, e.g. "2026-10". */
export const thisMonth = (): string => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 7);

function ago(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

const item = (r: ExperienceRow): ExperienceItem => ({ ...r, period: periodOf(r.startMonth, r.endMonth) });

async function rollNoOf(s: SessionPayload): Promise<string> {
  if (dataBackend() !== "postgres") return "";
  try {
    return (await getStudentAcademicProfile(s)).rollNo;
  } catch {
    return "";
  }
}

async function overview(s: SessionPayload): Promise<ExperienceOverview> {
  const rows = await experienceStore().list(s, isStaff(s) ? "college" : "mine");
  const count = (st: string) => rows.filter((r) => r.status === st).length;
  return {
    items: rows.map(item),
    canReview: isStaff(s),
    summary: { total: rows.length, verified: count("Verified"), pending: count("Pending"), rejected: count("Rejected") },
    categories: [...EXPERIENCE_CATEGORIES],
  };
}

function futureStart(month: string | undefined): MockResult | null {
  return month && month > thisMonth() ? err(422, "validation", "That month is still in the future.", { startMonth: "Pick a month that has already begun" }) : null;
}

export async function dispatchExperience(method: string, segs: string[], rawBody: unknown, s: SessionPayload): Promise<MockResult> {
  const store = experienceStore();
  const id = segs[1];

  if (method === "GET" && segs.length === 1) {
    if (s.role !== "student" && !isStaff(s)) return err(403, "forbidden", "The Experience Passport is for students and the faculty who verify it.");
    return ok(await overview(s));
  }

  if (method === "POST" && segs.length === 1) {
    if (s.role !== "student") return err(403, "forbidden", "Only students add activities to their passport.");
    const p = ExperienceInput.safeParse(rawBody);
    if (!p.success) return invalid(p.error);
    const late = futureStart(p.data.startMonth);
    if (late) return late;
    if ((await store.list(s, "mine")).length >= MAX_ACTIVITIES) return err(409, "limit", `You can keep up to ${MAX_ACTIVITIES} activities. Remove one to add another.`);
    const row = await store.create(s, { ...p.data, studentName: s.name, rollNo: await rollNoOf(s) });
    return ok(item(row), 201);
  }

  if (!id) return err(404, "not_found", "Not found.");

  // PUT experience/:id — the student edits their own entry.
  if (method === "PUT" && segs.length === 2) {
    if (s.role !== "student") return err(403, "forbidden", "Only the student can edit their own activity.");
    const p = ExperiencePatch.safeParse(rawBody);
    if (!p.success) return invalid(p.error);
    const old = await store.get(s, id);
    if (!old || !old.mine) return err(404, "not_found", "Activity not found.");
    const late = futureStart(p.data.startMonth);
    if (late) return late;
    const start = p.data.startMonth ?? old.startMonth;
    const end = p.data.endMonth === undefined ? old.endMonth : p.data.endMonth;
    if (end !== null && end < start) return err(422, "validation", "The end month cannot be before the start month.", { endMonth: "The end month cannot be before the start month" });
    const row = await store.update(s, id, p.data, old.status !== "Pending");
    return row ? ok(item(row)) : err(404, "not_found", "Activity not found.");
  }

  if (method === "DELETE" && segs.length === 2) {
    if (s.role !== "student") return err(403, "forbidden", "Only the student can remove their own activity.");
    const old = await store.get(s, id);
    if (!old || !old.mine) return err(404, "not_found", "Activity not found.");
    await store.remove(s, id);
    return ok({ ok: true });
  }

  // POST experience/:id/review — a faculty member or HOD decides.
  if (method === "POST" && segs.length === 3 && segs[2] === "review") {
    if (!isStaff(s)) return err(403, "forbidden", "Only faculty can verify activities.");
    const p = ReviewBody.safeParse(rawBody);
    if (!p.success) return invalid(p.error);
    const old = await store.get(s, id);
    if (!old) return err(404, "not_found", "Activity not found.");
    const row = await store.review(s, id, { status: p.data.decision, note: p.data.note, reviewerName: s.name, reviewerRole: ROLE_LABEL[s.role] ?? "Faculty" });
    return row ? ok(item(row)) : err(404, "not_found", "Activity not found.");
  }

  return err(404, "not_found", "Not found.");
}

/** Bell items: students hear about decisions on their activities; faculty hear how many are waiting. */
export async function experienceNotifications(s: SessionPayload): Promise<Notification[]> {
  try {
    if (s.role === "student") {
      const rows = await experienceStore().list(s, "mine");
      return rows
        .filter((r) => r.reviewedAt && r.status !== "Pending" && Date.now() - Date.parse(r.reviewedAt) < 14 * 86_400_000)
        .slice(0, 4)
        .map((r) => ({
          id: `exp-${r.id}-${r.status}`,
          title: r.status === "Verified" ? `Verified: ${r.title}` : `Needs changes: ${r.title}`,
          body: r.status === "Verified" ? `${r.reviewerName} verified it for your Experience Passport` : r.reviewNote || "Open your Experience Passport to see what to fix",
          when: ago(r.reviewedAt!),
          unread: true,
          tone: r.status === "Verified" ? "teal" : "amber",
        }));
    }
    if (s.role === "faculty" || s.role === "hod") {
      const waiting = (await experienceStore().list(s, "college")).filter((r) => r.status === "Pending");
      if (!waiting.length) return [];
      const newest = waiting.map((r) => r.updatedAt).sort().at(-1)!;
      return [{ id: "exp-waiting", title: `${waiting.length} activit${waiting.length === 1 ? "y" : "ies"} to verify`, body: "Students are waiting for their Experience Passport entries to be checked", when: ago(newest), unread: true, tone: "sky" }];
    }
    return [];
  } catch {
    return [];
  }
}
