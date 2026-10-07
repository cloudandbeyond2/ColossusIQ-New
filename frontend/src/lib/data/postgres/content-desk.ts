import "server-only";
import type { ContentRow, ContentStore } from "@/lib/api/mock/content-store";
import { db, isUuid } from "./db";

/*
 * University Content Desk on PostgreSQL: `university_content` (db/migrations/0018_content_curriculum_notices.sql).
 * Row-level security allows only the Super Admin at "All colleges" scope.
 */

interface Row {
  id: string;
  kind: string;
  status: string;
  source: string;
  title: string;
  data: unknown;
  targets: string[];
  copies: unknown;
  createdBy: string;
  verifiedBy: string;
  reviewNote: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => (db() as any).universityContent;

const toRow = (r: Row): ContentRow => ({
  id: r.id,
  kind: r.kind as ContentRow["kind"],
  status: r.status as ContentRow["status"],
  source: r.source as ContentRow["source"],
  title: r.title,
  data: (r.data ?? {}) as Record<string, unknown>,
  targets: r.targets.length === 1 && r.targets[0] === "all" ? "all" : r.targets,
  copies: (r.copies ?? {}) as Record<string, string[]>,
  createdBy: r.createdBy,
  verifiedBy: r.verifiedBy,
  reviewNote: r.reviewNote,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
  publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
});

const fields = (r: Omit<ContentRow, "id" | "createdAt" | "updatedAt">) => ({
  kind: r.kind,
  status: r.status,
  source: r.source,
  title: r.title,
  data: r.data,
  targets: r.targets === "all" ? ["all"] : r.targets,
  copies: r.copies,
  createdBy: r.createdBy,
  verifiedBy: r.verifiedBy,
  reviewNote: r.reviewNote,
  publishedAt: r.publishedAt ? new Date(r.publishedAt) : null,
});

export const postgresContent: ContentStore = {
  async list() {
    return ((await table().findMany({ orderBy: { updatedAt: "desc" }, take: 1000 })) as Row[]).map(toRow);
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
