import "server-only";
import type { PrepAttemptRow, PrepAttemptStore, PrepKind } from "@/lib/api/mock/prep-attempt-store";
import { db, requestUser } from "./db";
import { collegeUuid } from "./lookups";

/*
 * Exam-prep attempt summaries on PostgreSQL: `prep_attempts` (db/migrations/0013_exam_prep.sql). Row-level security
 * limits every query to the signed-in college. A student's own list filters on the signed-in user; peer figures read
 * percentages only.
 */

function me(): string {
  const id = requestUser();
  if (!id) throw new Error("A signed-in user is required");
  return id;
}

interface Row {
  id: string;
  kind: string;
  examId: string;
  ref: string;
  score: number;
  maxScore: number;
  percent: number;
  seconds: number;
  submittedAt: Date;
}
const toRow = (r: Row): PrepAttemptRow => ({ id: r.id, at: r.submittedAt.toISOString(), kind: r.kind as PrepKind, key: r.examId, ref: r.ref, score: r.score, max: r.maxScore, percent: r.percent, seconds: r.seconds });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => (db() as any).prepAttempt;

export const postgresPrepAttempts: PrepAttemptStore = {
  async add(s, a) {
    // Look first: a unique-key error would abort the request's transaction.
    const old = await table().findUnique({ where: { userId_ref: { userId: me(), ref: a.ref } } });
    if (old) return false;
    await table().create({ data: { collegeId: await collegeUuid(s.college), userId: me(), kind: a.kind, examId: a.key, ref: a.ref, score: a.score, maxScore: a.max, percent: a.percent, seconds: a.seconds } });
    return true;
  },
  async mine() {
    const rows = await table().findMany({ where: { userId: me() }, orderBy: { submittedAt: "desc" }, take: 500 });
    return rows.map((r: Row) => toRow(r));
  },
  async peers(_s, kind, key) {
    const rows = await table().findMany({ where: { kind, examId: key }, select: { percent: true }, take: 5000 });
    return rows.map((r: { percent: number }) => r.percent);
  },
};
