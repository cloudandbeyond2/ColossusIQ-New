import "server-only";
import { randomUUID } from "node:crypto";
import { dataBackend } from "@/lib/data";
import type { CurriculumData } from "@/lib/api/curriculum-schemas";
import { postgresCurricula } from "@/lib/data/postgres/curricula";
import { sharedState } from "./global-state";

/*
 * Programme curricula. In memory for the demo backend, PostgreSQL otherwise (data/postgres/curricula.ts: every college
 * reads, only the Super Admin at "All colleges" writes).
 */

export interface CurriculumRow {
  id: string;
  programme: string;
  regulation: string;
  status: "Draft" | "Published" | "Archived";
  version: number;
  data: CurriculumData;
  updatedBy: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface CurriculumStore {
  list(): Promise<CurriculumRow[]>;
  get(id: string): Promise<CurriculumRow | undefined>;
  create(row: Omit<CurriculumRow, "id" | "updatedAt">): Promise<CurriculumRow>;
  update(row: CurriculumRow): Promise<CurriculumRow>;
  remove(id: string): Promise<boolean>;
}

const rows = sharedState("curricula.rows", () => new Map<string, CurriculumRow>());

const memoryCurricula: CurriculumStore = {
  async list() {
    return [...rows.values()].map((r) => structuredClone(r)).sort((a, b) => a.programme.localeCompare(b.programme) || b.regulation.localeCompare(a.regulation));
  },
  async get(id) {
    const r = rows.get(id);
    return r ? structuredClone(r) : undefined;
  },
  async create(row) {
    const r: CurriculumRow = { ...structuredClone(row), id: randomUUID(), updatedAt: new Date().toISOString() };
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
export function resetCurriculaMemory() {
  rows.clear();
}

export function curriculumStore(): CurriculumStore {
  return dataBackend() === "postgres" ? postgresCurricula : memoryCurricula;
}
