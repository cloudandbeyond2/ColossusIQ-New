import "server-only";
import { randomUUID } from "node:crypto";
import { dataBackend } from "@/lib/data";
import type { ContentKind, ContentStatus, Targets } from "@/lib/api/content-desk-schemas";
import { postgresContent } from "@/lib/data/postgres/content-desk";
import { sharedState } from "./global-state";

/*
 * University Content Desk items. In memory for the demo backend, PostgreSQL otherwise (data/postgres/content-desk.ts,
 * Super Admin at "All colleges" only). `copies` records what was published where (college id → copied record ids),
 * so a withdrawal can remove exactly those copies.
 */

export interface ContentRow {
  id: string;
  kind: ContentKind;
  status: ContentStatus;
  source: "AI" | "Manual";
  title: string;
  data: Record<string, unknown>;
  targets: Targets;
  copies: Record<string, string[]>;
  createdBy: string;
  verifiedBy: string;
  reviewNote: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface ContentStore {
  list(): Promise<ContentRow[]>;
  get(id: string): Promise<ContentRow | undefined>;
  create(row: Omit<ContentRow, "id" | "createdAt" | "updatedAt">): Promise<ContentRow>;
  update(row: ContentRow): Promise<ContentRow>;
  remove(id: string): Promise<boolean>;
}

const rows = sharedState("content-desk.rows", () => new Map<string, ContentRow>());

const memoryContent: ContentStore = {
  async list() {
    return [...rows.values()].map((r) => structuredClone(r)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async get(id) {
    const r = rows.get(id);
    return r ? structuredClone(r) : undefined;
  },
  async create(row) {
    const now = new Date().toISOString();
    const r: ContentRow = { ...structuredClone(row), id: randomUUID(), createdAt: now, updatedAt: now };
    rows.set(r.id, r);
    return structuredClone(r);
  },
  async update(row) {
    const r = { ...structuredClone(row), updatedAt: new Date().toISOString() };
    rows.set(r.id, r);
    return structuredClone(r);
  },
  async remove(id) {
    return rows.delete(id);
  },
};

/** Test helper (memory backend only). */
export function resetContentMemory() {
  rows.clear();
}

export function contentStore(): ContentStore {
  return dataBackend() === "postgres" ? postgresContent : memoryContent;
}
