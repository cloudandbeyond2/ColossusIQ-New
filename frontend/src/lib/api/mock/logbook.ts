import "server-only";
import { ALL_COLLEGES } from "@/config/tenancy";
import type {
  CreateCompetenciesInput,
  LogbookOverview,
  LogbookRow,
  RequestSignoffInput,
  ReviewEntryInput,
} from "@/lib/api/logbook-schemas";
import type { SessionPayload } from "@/lib/auth/session";
import { getStore } from "@/lib/data";
import { logbookData, type EntryRow } from "./logbook-data";
import { listColleges } from "./records";

/*
 * CBME competency logbook. Faculty/HODs keep the college's competency catalogue; a student asks for sign-off on a
 * competency; a faculty member or HOD certifies it or returns it with remarks. Nothing is generated: "Not attempted"
 * simply means the student hasn't asked for sign-off yet.
 */

export class LogbookError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 = 400,
  ) {
    super(message);
  }
}

const REVIEWERS = new Set(["faculty", "hod"]);
export const canReviewLogbook = (role: string) => REVIEWERS.has(role);
export const canManageCatalogue = (role: string) => REVIEWERS.has(role);

async function collegeOf(session: SessionPayload): Promise<string> {
  if (session.college && session.college !== ALL_COLLEGES) return session.college;
  const first = (await listColleges())[0];
  if (!first) throw new LogbookError("There is no college to show yet.", 404);
  return first.id;
}

async function audit(session: SessionPayload, college: string, action: string) {
  await getStore().audit.add({ actor: session.name, action, target: "competency-logbook", collegeId: college, actorSub: session.sub });
}

export async function getLogbookOverview(session: SessionPayload): Promise<LogbookOverview> {
  const college = await collegeOf(session);
  const data = logbookData();
  // Everyone but a student sees the whole college's entries; only faculty and HODs can act on them.
  const reviewer = session.role !== "student";
  const [competencies, entries] = await Promise.all([data.competencies(college), data.entries(college, reviewer ? undefined : session.sub)]);
  const byId = new Map(competencies.map((c) => [c.id, c]));

  const toRow = (e: EntryRow): LogbookRow | undefined => {
    const c = byId.get(e.competencyId);
    if (!c) return undefined;
    return {
      competencyId: c.id, entryId: e.id, code: c.code, description: c.description, department: c.department, level: c.level,
      studentSub: e.studentSub, studentName: e.studentName, rollNo: e.rollNo, attempts: e.attempts, status: e.status,
      notes: e.notes, remarks: e.remarks, certifiedBy: e.certifiedBy, certifiedAt: e.certifiedAt,
    };
  };

  let rows: LogbookRow[];
  if (reviewer) {
    // Reviewers work from entries; pending sign-offs first.
    rows = entries.map(toRow).filter((r): r is LogbookRow => r !== undefined);
    const rank = { "Pending review": 0, Returned: 1, Certified: 2, "Not attempted": 3 } as const;
    rows.sort((a, b) => rank[a.status] - rank[b.status]);
  } else {
    const mine = new Map(entries.map((e) => [e.competencyId, e]));
    rows = competencies.map((c) => {
      const e = mine.get(c.id);
      return e
        ? (toRow(e) as LogbookRow)
        : {
            competencyId: c.id, entryId: "", code: c.code, description: c.description, department: c.department, level: c.level,
            studentSub: session.sub, studentName: session.name, rollNo: "", attempts: 0, status: "Not attempted" as const,
            notes: "", remarks: "", certifiedBy: "", certifiedAt: "",
          };
    });
  }

  const count = (s: LogbookRow["status"]) => rows.filter((r) => r.status === s).length;
  return {
    mode: reviewer ? "reviewer" : "student",
    competencies,
    rows,
    summary: {
      total: reviewer ? entries.length : competencies.length,
      certified: count("Certified"),
      pending: count("Pending review"),
      returned: count("Returned"),
      notAttempted: reviewer ? 0 : count("Not attempted"),
    },
    departments: [...new Set(competencies.map((c) => c.department))].sort(),
    permissions: { request: session.role === "student", certify: canReviewLogbook(session.role), manage: canManageCatalogue(session.role) },
  };
}

export async function createCompetencies(session: SessionPayload, input: CreateCompetenciesInput): Promise<{ added: number; skipped: number }> {
  if (!canManageCatalogue(session.role)) throw new LogbookError("Only faculty and HODs can edit the competency list.", 403);
  const college = await collegeOf(session);
  const added = await logbookData().addCompetencies(college, input.items, session.sub);
  if (added > 0) await audit(session, college, `Added ${added} logbook competenc${added === 1 ? "y" : "ies"}`);
  return { added, skipped: input.items.length - added };
}

export async function deleteCompetency(session: SessionPayload, id: string): Promise<{ ok: boolean }> {
  if (!canManageCatalogue(session.role)) throw new LogbookError("Only faculty and HODs can edit the competency list.", 403);
  const college = await collegeOf(session);
  const c = await logbookData().competency(id);
  if (!c || c.college !== college) throw new LogbookError("Competency not found.", 404);
  await logbookData().removeCompetency(id);
  await audit(session, college, `Removed logbook competency ${c.code}`);
  return { ok: true };
}

export async function requestSignoff(session: SessionPayload, input: RequestSignoffInput): Promise<{ ok: boolean; attempts: number }> {
  if (session.role !== "student") throw new LogbookError("Only students can request a sign-off.", 403);
  const college = await collegeOf(session);
  const data = logbookData();
  const c = await data.competency(input.competencyId);
  if (!c || c.college !== college) throw new LogbookError("Competency not found.", 404);

  const existing = (await data.entries(college, session.sub)).find((e) => e.competencyId === c.id);
  if (existing?.status === "Certified") throw new LogbookError("This competency is already certified.", 409);
  if (existing?.status === "Pending review") throw new LogbookError("A sign-off for this competency is already waiting for review.", 409);

  const board = await getStore().readiness.board(college);
  const me = board.find((s) => s.studentSub === session.sub);
  const entry = await data.request(college, c.id, { sub: session.sub, name: me?.name ?? session.name, rollNo: me?.rollNo ?? "" }, input.notes);
  if (!entry) throw new LogbookError("Could not record the request.", 404);
  await audit(session, college, `Requested logbook sign-off: ${c.code}`);
  return { ok: true, attempts: entry.attempts };
}

export async function reviewEntry(session: SessionPayload, entryId: string, input: ReviewEntryInput): Promise<{ ok: boolean; status: string }> {
  if (!canReviewLogbook(session.role)) throw new LogbookError("Only faculty and HODs can certify competencies.", 403);
  const college = await collegeOf(session);
  const data = logbookData();
  const e = await data.entry(entryId);
  if (!e || e.college !== college) throw new LogbookError("Logbook entry not found.", 404);
  if (e.status !== "Pending review") throw new LogbookError(`This entry is already ${e.status.toLowerCase()}.`, 409);
  if (input.decision === "Returned" && input.remarks.trim() === "") throw new LogbookError("Say what the student needs to redo when returning an entry.", 400);
  await data.review(e.id, input.decision, input.remarks.trim(), session.name);
  const c = await data.competency(e.competencyId);
  await audit(session, college, `${input.decision === "Certified" ? "Certified" : "Returned"} logbook entry ${c?.code ?? ""} for ${e.studentName || e.studentSub}`);
  return { ok: true, status: input.decision };
}
