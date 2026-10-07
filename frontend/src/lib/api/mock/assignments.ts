import "server-only";
import { z } from "zod";
import type { SessionPayload } from "@/lib/auth/session";
import { dataBackend } from "@/lib/data";
import type { Notification } from "@/lib/api/schemas";
import {
  AssignmentInput,
  AssignmentPatch,
  GradeBody,
  SubmitBody,
  type AssignmentItem,
} from "@/lib/api/assignments-schemas";
import { assignmentStore, type AssignmentRow } from "./assignment-store";
import { getStudentAcademicProfile } from "./student-profile";
import type { MockResult } from "./router";

/*
 * Assignments. Faculty write an assignment (title, course, instructions, marks, deadline) and publish it; it then appears
 * in every student's Assignments page and notifications. Students hand in an answer (text and/or a link) before the
 * deadline or late; faculty see who has submitted, then mark each piece of work and leave feedback, which the student
 * sees. Drafts are visible to staff only; closing an assignment stops further submissions.
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

const isStaff = (s: SessionPayload) => s.role === "faculty" || s.role === "admin" || s.role === "hod";
const sweeping = (s: SessionPayload) => s.role === "admin" || s.role === "hod";

/** The deadline as the people in the college read it (India time), e.g. "18 Nov, 5:00 pm". */
export function dueLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }).format(new Date(iso));
}

function ago(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

const pastDue = (iso: string | null) => iso !== null && Date.parse(iso) < Date.now();

function item(r: AssignmentRow, s: SessionPayload, extra: Pick<AssignmentItem, "stats" | "mine">): AssignmentItem {
  return {
    id: r.id,
    title: r.title,
    course: r.course,
    description: r.description,
    maxMarks: r.maxMarks,
    dueAt: r.dueAt,
    due: r.due,
    status: r.status,
    authorName: r.authorName,
    createdAt: r.createdAt,
    canManage: isStaff(s) && (sweeping(s) || r.owned),
    ...extra,
  };
}

async function staffItem(s: SessionPayload, r: AssignmentRow): Promise<AssignmentItem> {
  const store = assignmentStore();
  // Sequential to avoid concurrent queries on the same Prisma transaction client.
  const counts = await store.counts(s, [r.id]);
  const enrolled = await store.enrolled(s);
  const c = counts.get(r.id) ?? { submitted: 0, graded: 0 };
  return item(r, s, { stats: { ...c, enrolled }, mine: null });
}

async function listFor(s: SessionPayload): Promise<AssignmentItem[]> {
  const store = assignmentStore();
  if (isStaff(s)) {
    const rows = await store.list(s, false);
    // Run sequentially: Prisma's TransactionClient does not support concurrent
    // queries on the same transaction — parallel Promise.all calls cause one
    // query to roll back the transaction and crash the other.
    const counts = await store.counts(s, rows.map((r) => r.id));
    const enrolled = await store.enrolled(s);
    return rows.map((r) => item(r, s, { stats: { ...(counts.get(r.id) ?? { submitted: 0, graded: 0 }), enrolled }, mine: null }));
  }
  const rows = await store.list(s, true);
  const mine = await store.mine(s, rows.map((r) => r.id));
  return rows.map((r) => item(r, s, { stats: null, mine: mine.get(r.id) ?? null }));
}

/** The student's roll number, where the college keeps one. */
async function rollNoOf(s: SessionPayload): Promise<string> {
  if (dataBackend() !== "postgres") return "";
  try {
    return (await getStudentAcademicProfile(s)).rollNo;
  } catch {
    return "";
  }
}

export async function dispatchAssignments(method: string, segs: string[], rawBody: unknown, s: SessionPayload): Promise<MockResult> {
  const store = assignmentStore();
  const id = segs[1];

  // GET assignments
  if (method === "GET" && segs.length === 1) {
    if (!isStaff(s) && s.role !== "student") return err(403, "forbidden", "Assignments are for students and faculty.");
    return ok(await listFor(s));
  }

  // POST assignments
  if (method === "POST" && segs.length === 1) {
    if (!isStaff(s)) return err(403, "forbidden", "Only faculty can create assignments.");
    const p = AssignmentInput.safeParse(rawBody);
    if (!p.success) return invalid(p.error);
    if (p.data.status === "Open" && pastDue(p.data.dueAt)) return err(422, "validation", "Pick a due date in the future.", { dueAt: "Pick a due date in the future" });
    const row = await store.create(s, { ...p.data, due: dueLabel(p.data.dueAt) });
    return ok(await staffItem(s, row), 201);
  }

  if (!id) return err(404, "not_found", "Resource not found.");

  // PUT assignments/:id
  if (method === "PUT" && segs.length === 2) {
    if (!isStaff(s)) return err(403, "forbidden", "Only faculty can edit assignments.");
    const p = AssignmentPatch.safeParse(rawBody);
    if (!p.success) return invalid(p.error);
    const row = await store.get(s, id);
    if (!row) return err(404, "not_found", "Assignment not found.");
    if (!(sweeping(s) || row.owned)) return err(403, "forbidden", "You can only edit your own assignments.");

    const status = p.data.status ?? row.status;
    const dueAt = p.data.dueAt ?? row.dueAt;
    const publishing = status === "Open" && (row.status !== "Open" || p.data.dueAt !== undefined);
    if (publishing && pastDue(dueAt)) return err(422, "validation", "Move the due date into the future first.", { dueAt: "Pick a due date in the future" });
    if (p.data.maxMarks !== undefined && p.data.maxMarks < row.maxMarks) {
      const top = Math.max(0, ...(await store.submissions(s, id)).map((x) => x.marks ?? 0));
      if (top > p.data.maxMarks) return err(422, "validation", "Some students already have more marks than that.", { maxMarks: `A student already has ${top} marks` });
    }
    const updated = await store.update(s, id, { ...p.data, ...(p.data.dueAt ? { due: dueLabel(p.data.dueAt) } : {}) });
    if (!updated) return err(404, "not_found", "Assignment not found.");
    return ok(await staffItem(s, updated));
  }

  // DELETE assignments/:id
  if (method === "DELETE" && segs.length === 2) {
    if (!isStaff(s)) return err(403, "forbidden", "Only faculty can delete assignments.");
    const row = await store.get(s, id);
    if (!row) return err(404, "not_found", "Assignment not found.");
    if (!(sweeping(s) || row.owned)) return err(403, "forbidden", "You can only delete your own assignments.");
    await store.remove(s, id);
    return ok({ ok: true });
  }

  // GET assignments/:id/submissions
  if (method === "GET" && segs[2] === "submissions" && segs.length === 3) {
    if (!isStaff(s)) return err(403, "forbidden", "Only faculty can see submissions.");
    const row = await store.get(s, id);
    if (!row) return err(404, "not_found", "Assignment not found.");
    if (!(sweeping(s) || row.owned)) return err(403, "forbidden", "These are another teacher's submissions.");
    return ok(await store.submissions(s, id));
  }

  // PATCH assignments/:id/submissions/:submissionId  (mark and feedback)
  if (method === "PATCH" && segs[2] === "submissions" && segs.length === 4) {
    if (!isStaff(s)) return err(403, "forbidden", "Only faculty can mark work.");
    const g = GradeBody.safeParse(rawBody);
    if (!g.success) return invalid(g.error);
    const row = await store.get(s, id);
    if (!row) return err(404, "not_found", "Assignment not found.");
    if (!(sweeping(s) || row.owned)) return err(403, "forbidden", "These are another teacher's submissions.");
    if (g.data.marks > row.maxMarks) return err(422, "validation", `Marks cannot be more than ${row.maxMarks}.`, { marks: `At most ${row.maxMarks}` });
    const done = await store.grade(s, id, segs[3] ?? "", g.data.marks, g.data.feedback);
    if (!done) return err(404, "not_found", "Submission not found.");
    return ok(done);
  }

  // PUT assignments/:id/submission  (a student hands in, or replaces, their work)
  if (method === "PUT" && segs[2] === "submission" && segs.length === 3) {
    if (s.role !== "student") return err(403, "forbidden", "Only students hand in assignments.");
    const b = SubmitBody.safeParse(rawBody);
    if (!b.success) return invalid(b.error);
    const row = await store.get(s, id);
    if (!row || row.status === "Draft") return err(404, "not_found", "Assignment not found.");
    if (row.status === "Closed") return err(409, "closed", "This assignment is closed, so it no longer takes submissions.");
    const before = (await store.mine(s, [id])).get(id);
    if (before && before.marks !== null) return err(409, "graded", "This has already been marked, so it can no longer be changed.");
    const saved = await store.submit(s, id, { studentName: s.name, rollNo: await rollNoOf(s), text: b.data.text, link: b.data.link, late: pastDue(row.dueAt) });
    return ok(saved, before ? 200 : 201);
  }

  return err(404, "not_found", "Resource not found.");
}

/** What the student's bell shows: work still to hand in (soonest first) and work that has just been marked. */
export async function assignmentNotifications(s: SessionPayload): Promise<Notification[]> {
  if (s.role !== "student") return [];
  try {
    const store = assignmentStore();
    const rows = (await store.list(s, true)).filter((r) => r.status !== "Draft");
    const mine = await store.mine(s, rows.map((r) => r.id));
    const out: Notification[] = [];
    const todo = rows
      .filter((r) => r.status === "Open" && !mine.has(r.id))
      .sort((a, b) => (a.dueAt ?? "9").localeCompare(b.dueAt ?? "9"))
      .slice(0, 4);
    for (const r of todo) {
      const left = r.dueAt ? Date.parse(r.dueAt) - Date.now() : null;
      const soon = left !== null && left < 48 * 3_600_000;
      out.push({
        id: `asn-${r.id}`,
        title: left !== null && left < 0 ? `Overdue: ${r.title}` : `New assignment: ${r.title}`,
        body: `${r.course} · ${left !== null && left < 0 ? "was due" : "due"} ${r.due}`,
        when: ago(r.createdAt),
        unread: true,
        tone: left !== null && left < 0 ? "rose" : soon ? "amber" : "sky",
      });
    }
    for (const r of rows) {
      const m = mine.get(r.id);
      if (!m || m.marks === null || !m.gradedAt || Date.now() - Date.parse(m.gradedAt) > 14 * 86_400_000) continue;
      out.push({ id: `asn-graded-${r.id}`, title: `Marked: ${r.title}`, body: `You scored ${m.marks} / ${r.maxMarks}`, when: ago(m.gradedAt), unread: true, tone: "teal" });
    }
    return out;
  } catch {
    return [];
  }
}
