import "server-only";
import { db } from "./db";
import { collegeUuid } from "./lookups";

/* Agent Store on PostgreSQL (prisma/migrations/20261106000000_agent_store): the agents a college has switched off. */

const q = <T>(sql: string, ...args: unknown[]) => db().$queryRawUnsafe<T[]>(sql, ...args);

export const postgresAgentStore = {
  async disabled(college: string): Promise<Set<string>> {
    const rows = await q<{ agent_id: string }>("SELECT agent_id FROM agent_disabled WHERE college_id = $1::uuid", await collegeUuid(college));
    return new Set(rows.map((r) => r.agent_id));
  },
  async setEnabled(college: string, agent: string, enabled: boolean, by: string): Promise<void> {
    const cid = await collegeUuid(college);
    if (enabled) {
      await q("DELETE FROM agent_disabled WHERE college_id = $1::uuid AND agent_id = $2", cid, agent);
      return;
    }
    await q(
      `INSERT INTO agent_disabled (college_id, agent_id, updated_by) VALUES ($1::uuid, $2, $3)
       ON CONFLICT (college_id, agent_id) DO UPDATE SET updated_by = EXCLUDED.updated_by, updated_at = now()`,
      cid, agent, by,
    );
  },
};
