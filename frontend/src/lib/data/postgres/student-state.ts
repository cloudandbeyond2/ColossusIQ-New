import "server-only";
import type { Prisma } from "@prisma/client";
import type { StudentStateStore } from "@/lib/api/mock/student-state-store";
import { db, requestUser } from "./db";
import { collegeUuid } from "./lookups";

/*
 * Per-user saved state on PostgreSQL: one row per (user, key), the document stored as JSON. Row-level security
 * (db/migrations/0007_student_state.sql) limits queries to the signed-in college; every query here also filters on
 * the signed-in user, so a person can only ever read or change their own state.
 */

function me(): string {
  const id = requestUser();
  if (!id) throw new Error("A signed-in user is required");
  return id;
}

export const postgresStudentState: StudentStateStore = {
  async get(_userKey, key) {
    const r = await db().studentState.findUnique({ where: { userId_key: { userId: me(), key } } });
    return r ? r.data : undefined;
  },
  async save(collegeId, _userKey, key, data) {
    const json = data as Prisma.InputJsonValue;
    await db().studentState.upsert({
      where: { userId_key: { userId: me(), key } },
      create: { userId: me(), key, collegeId: await collegeUuid(collegeId), data: json },
      update: { data: json, updatedAt: new Date() },
    });
  },
  async remove(_userKey, key) {
    const r = await db().studentState.deleteMany({ where: { userId: me(), key } });
    return r.count > 0;
  },
  async listByCollege(collegeId, key) {
    const cid = await collegeUuid(collegeId);
    if (!cid) return [];
    const rows = await db().studentState.findMany({
      where: { collegeId: cid, key },
      select: { data: true },
    });
    return rows.map((r: { data: unknown }) => r.data);
  },
};
