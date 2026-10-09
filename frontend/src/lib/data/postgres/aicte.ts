import "server-only";
import type { Prisma } from "@prisma/client";
import { parseAicteState, type AicteStore } from "@/lib/api/mock/aicte-store";
import { db } from "./db";
import { collegeUuid } from "./lookups";

/*
 * AICTE compliance records on PostgreSQL: `aicte_compliance`, one JSON document per college
 * (db/migrations/0023_aicte_compliance.sql). Row-level security limits every query to the signed-in college.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => (db() as any).aicteCompliance;

export const postgresAicte: AicteStore = {
  async get(collegeId) {
    const r = await table().findUnique({ where: { collegeId: await collegeUuid(collegeId) } });
    return parseAicteState(r?.data);
  },
  async save(collegeId, state, by) {
    const id = await collegeUuid(collegeId);
    const data = state as unknown as Prisma.InputJsonValue;
    await table().upsert({
      where: { collegeId: id },
      create: { collegeId: id, data, updatedBy: by.slice(0, 120) },
      update: { data, updatedBy: by.slice(0, 120), updatedAt: new Date() },
    });
  },
};
