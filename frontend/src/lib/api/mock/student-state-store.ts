import "server-only";
import { dataBackend } from "@/lib/data";
import { postgresStudentState } from "@/lib/data/postgres/student-state";
import { sharedState } from "./global-state";

/*
 * Per-user saved state for features that keep one small JSON document per person (language progress, …), keyed by a
 * feature name. In memory for the demo backend, PostgreSQL otherwise (data/postgres/student-state.ts). Callers
 * validate what they read with their own zod schema.
 */

export interface StudentStateStore {
  /** `userKey` is the signed-in user (session.sub); the PostgreSQL store reads the user from the request instead. */
  get(userKey: string, key: string): Promise<unknown | undefined>;
  save(collegeId: string, userKey: string, key: string, data: unknown): Promise<void>;
  remove(userKey: string, key: string): Promise<boolean>;
  listByCollege(collegeId: string, key: string): Promise<unknown[]>;
}

const mem = sharedState("student-state.docs", () => new Map<string, unknown>());
const k = (userKey: string, key: string) => `${userKey}\u0000${key}`;

const memoryStudentState: StudentStateStore = {
  async get(userKey, key) {
    const v = mem.get(k(userKey, key));
    return v === undefined ? undefined : structuredClone(v);
  },
  async save(_collegeId, userKey, key, data) {
    mem.set(k(userKey, key), structuredClone(data));
  },
  async remove(userKey, key) {
    return mem.delete(k(userKey, key));
  },
  async listByCollege(_collegeId, key) {
    const results: unknown[] = [];
    for (const [kStr, val] of mem.entries()) {
      if (kStr.endsWith(`\u0000${key}`)) {
        results.push(structuredClone(val));
      }
    }
    return results;
  },
};

export function studentStateStore(): StudentStateStore {
  return dataBackend() === "postgres" ? postgresStudentState : memoryStudentState;
}
