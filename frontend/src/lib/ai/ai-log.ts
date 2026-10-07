import "server-only";
import { sharedState } from "@/lib/api/mock/global-state";

/*
 * A small in-process log of AI requests for the Super Admin's AI Observability and AI Governance pages: which
 * provider and model answered, how long it took and whether it worked. Only metadata is kept (never prompts,
 * answers or keys), the last 300 requests, since the server started.
 */

export interface AiCall {
  at: string;
  provider: string;
  model: string;
  ms: number;
  ok: boolean;
  /** "ok" or a reason code such as http_429, timeout, schema. */
  reason: string;
  /** True when this provider answered after the default failed. */
  fallback: boolean;
}

const MAX = 300;
const log = sharedState("ai.call-log", () => ({ calls: [] as AiCall[], since: new Date().toISOString() }));

export function recordAiCall(c: Omit<AiCall, "at">): void {
  log.calls.unshift({ at: new Date().toISOString(), ...c });
  if (log.calls.length > MAX) log.calls.length = MAX;
}

export function aiCalls(): { calls: AiCall[]; since: string } {
  return { calls: log.calls.map((c) => ({ ...c })), since: log.since };
}

/** Test helper. */
export function resetAiLog(): void {
  log.calls = [];
}
