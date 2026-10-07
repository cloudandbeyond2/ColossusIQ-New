import "server-only";
import { Prisma } from "@prisma/client";
import type { CaRow, CurrentAffairsStore } from "@/lib/api/mock/current-affairs-store";
import type { CaBody } from "@/lib/api/exam-prep-schemas";
import { db, isUuid } from "./db";
import { collegeUuid } from "./lookups";

/*
 * Current affairs on PostgreSQL: `current_affairs` (db/migrations/0012_exam_prep.sql). Row-level security limits every
 * query to the signed-in college.
 */

interface Row {
  id: string;
  itemDate: string;
  category: string;
  headline: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  tags: string[];
  status: string;
  mcq: unknown;
  authorName: string;
  createdAt: Date;
  updatedAt: Date;
}

const toRow = (r: Row): CaRow => ({
  id: r.id,
  date: r.itemDate,
  category: r.category as CaRow["category"],
  headline: r.headline,
  summary: r.summary,
  sourceName: r.sourceName,
  sourceUrl: r.sourceUrl,
  tags: r.tags,
  status: r.status as CaRow["status"],
  mcq: (r.mcq ?? null) as CaRow["mcq"],
  author: r.authorName,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

const data = (b: CaBody) => ({
  itemDate: b.date,
  category: b.category,
  headline: b.headline,
  summary: b.summary,
  sourceName: b.sourceName,
  sourceUrl: b.sourceUrl,
  tags: b.tags,
  status: b.status,
  mcq: b.mcq ? (b.mcq as Prisma.InputJsonValue) : Prisma.DbNull,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => (db() as any).currentAffair;

export const postgresCurrentAffairs: CurrentAffairsStore = {
  async list() {
    const rows = await table().findMany({ orderBy: [{ itemDate: "desc" }, { createdAt: "desc" }], take: 1000 });
    return rows.map((r: Row) => toRow(r));
  },
  async get(_s, id) {
    if (!isUuid(id)) return undefined;
    const r = await table().findUnique({ where: { id } });
    return r ? toRow(r) : undefined;
  },
  async create(s, b) {
    const r = await table().create({ data: { collegeId: await collegeUuid(s.college), authorName: s.name, ...data(b) } });
    return toRow(r);
  },
  async update(_s, id, b) {
    if (!isUuid(id)) return undefined;
    const old = await table().findUnique({ where: { id } });
    if (!old) return undefined;
    const r = await table().update({ where: { id }, data: { ...data(b), updatedAt: new Date() } });
    return toRow(r);
  },
  async remove(_s, id) {
    if (!isUuid(id)) return false;
    const r = await table().deleteMany({ where: { id } });
    return r.count > 0;
  },
};
