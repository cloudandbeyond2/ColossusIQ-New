import "server-only";
import { AGENTS, findAgent } from "@/config/agents";
import { MODULES } from "@/config/modules";
import { PROVIDERS, providerOrder, refreshAiConfig } from "@/lib/ai/ai-config";
import type { SessionPayload } from "@/lib/auth/session";
import { dataBackend, getStore } from "@/lib/data";
import { postgresAgentStore } from "@/lib/data/postgres/agent-store";
import { resolveCollegeId } from "./early-warning";
import { sharedState } from "./global-state";

export class AgentStoreError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 = 400,
  ) {
    super(message);
  }
}

export interface AgentRow {
  id: string;
  name: string;
  summary: string;
  audience: string;
  usedIn: string[];
  enabled: boolean;
  /** Core platform agents cannot be switched off. */
  locked: boolean;
}

export interface AgentStoreView {
  provider: string;
  agents: AgentRow[];
}

const mem = sharedState("agent-store.disabled", () => new Map<string, Set<string>>());
export function resetAgentStoreMemory() {
  mem.clear();
}

const store = {
  async disabled(college: string): Promise<Set<string>> {
    return dataBackend() === "postgres" ? postgresAgentStore.disabled(college) : new Set(mem.get(college) ?? []);
  },
  async setEnabled(college: string, agent: string, enabled: boolean, by: string): Promise<void> {
    if (dataBackend() === "postgres") return postgresAgentStore.setEnabled(college, agent, enabled, by);
    const set = mem.get(college) ?? new Set<string>();
    if (enabled) set.delete(agent);
    else set.add(agent);
    mem.set(college, set);
  },
};

const MANAGERS = new Set(["institution", "admin"]);
const isLocked = (audience: string) => audience === "Platform";

export async function getAgentStore(s: SessionPayload): Promise<AgentStoreView> {
  if (!MANAGERS.has(s.role)) throw new AgentStoreError("Not allowed.", 403);
  const college = await resolveCollegeId(s.college);
  const off = await store.disabled(college);
  await refreshAiConfig();
  const order = providerOrder();
  const first = order[0];
  return {
    provider: first ? `${PROVIDERS[first].vendor} ${PROVIDERS[first].name}` : "Built-in templates",
    agents: AGENTS.map((a) => ({
      id: a.id,
      name: a.name,
      summary: a.summary,
      audience: a.audience,
      usedIn: MODULES.filter((m) => m.agent === a.id).map((m) => m.title),
      enabled: isLocked(a.audience) || !off.has(a.id),
      locked: isLocked(a.audience),
    })),
  };
}

export async function setAgentEnabled(s: SessionPayload, agentId: unknown, enabled: unknown): Promise<AgentStoreView> {
  if (!MANAGERS.has(s.role)) throw new AgentStoreError("Only the Principal can change which agents are on.", 403);
  if (typeof enabled !== "boolean") throw new AgentStoreError("Say whether the agent is on or off.");
  const agent = typeof agentId === "string" ? findAgent(agentId) : undefined;
  if (!agent) throw new AgentStoreError("Agent not found.", 404);
  if (isLocked(agent.audience)) throw new AgentStoreError(`${agent.name} is a core platform agent and stays on.`);
  const college = await resolveCollegeId(s.college);
  await store.setEnabled(college, agent.id, enabled, s.name);
  await getStore().audit.add({ actor: s.name, action: `${enabled ? "Enabled" : "Disabled"} AI agent`, target: agent.name, collegeId: college, actorSub: s.sub });
  return getAgentStore(s);
}

/** Is this agent switched on for the caller's college? The Super Admin at "all" scope and unknown agent ids are not restricted. */
export async function agentAllowed(s: SessionPayload, agentId: string | undefined): Promise<boolean> {
  if (!agentId || s.college === "all") return true;
  const agent = findAgent(agentId);
  if (!agent || isLocked(agent.audience)) return true;
  return !(await store.disabled(s.college)).has(agent.id);
}
