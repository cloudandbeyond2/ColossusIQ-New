import "server-only";
import type { CurriculumData } from "@/lib/api/curriculum-schemas";
import type { CurriculumRow, CurriculumStore } from "@/lib/api/mock/curriculum-store";
import { db, isUuid } from "./db";

/*
 * Curricula on PostgreSQL: `curricula` (db/migrations/0018_content_curriculum_notices.sql). Every college may read;
 * row-level security lets only the Super Admin at "All colleges" scope write.
 */

interface Row {
  id: string;
  programme: string;
  regulation: string;
  status: string;
  version: number;
  data: unknown;
  updatedBy: string;
  updatedAt: Date;
  publishedAt: Date | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => (db() as any).curriculum;

const toRow = (r: Row): CurriculumRow => ({
  id: r.id,
  programme: r.programme,
  regulation: r.regulation,
  status: r.status as CurriculumRow["status"],
  version: r.version,
  data: r.data as CurriculumData,
  updatedBy: r.updatedBy,
  updatedAt: r.updatedAt.toISOString(),
  publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
});

const fields = (r: Omit<CurriculumRow, "id" | "updatedAt">) => ({
  programme: r.programme,
  regulation: r.regulation,
  status: r.status,
  version: r.version,
  data: r.data,
  updatedBy: r.updatedBy,
  publishedAt: r.publishedAt ? new Date(r.publishedAt) : null,
});

export const postgresCurricula: CurriculumStore = {
  async list() {
    return ((await table().findMany({ orderBy: [{ programme: "asc" }, { regulation: "desc" }], take: 300 })) as Row[]).map(toRow);
  },
  async get(id) {
    if (!isUuid(id)) return undefined;
    const r = (await table().findUnique({ where: { id } })) as Row | null;
    return r ? toRow(r) : undefined;
  },
  async create(row) {
    return toRow((await table().create({ data: fields(row) })) as Row);
  },
  async update(row) {
    return toRow((await table().update({ where: { id: row.id }, data: { ...fields(row), updatedAt: new Date() } })) as Row);
  },
  async remove(id) {
    if (!isUuid(id)) return false;
    return ((await table().deleteMany({ where: { id } })) as { count: number }).count > 0;
  },
};
