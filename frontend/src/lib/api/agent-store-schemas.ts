import { z } from "zod";

/** Shared by the browser and the server: the Agent Store page. */
export const AgentRow = z.object({
  id: z.string(),
  name: z.string(),
  summary: z.string(),
  audience: z.string(),
  usedIn: z.array(z.string()),
  enabled: z.boolean(),
  locked: z.boolean(),
});
export type AgentRow = z.infer<typeof AgentRow>;

export const AgentStoreView = z.object({ provider: z.string(), agents: z.array(AgentRow) });
export type AgentStoreView = z.infer<typeof AgentStoreView>;

export const AgentToggleBody = z.object({ agent: z.string().min(2).max(60), enabled: z.boolean() });
