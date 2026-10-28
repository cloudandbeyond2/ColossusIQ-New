import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { dispatch } from "@/lib/api/mock/router";
import { resetAgentStoreMemory } from "@/lib/api/mock/agent-store";
import type { SessionPayload } from "@/lib/auth/session";
import type { AgentStoreView } from "@/lib/api/agent-store-schemas";

const base: SessionPayload = { sub: "p-1", role: "institution", name: "Principal", tenant: "TNTU", college: "COL-1001", mfa: true, exp: 9999999999 };
const who = (role: SessionPayload["role"], college = "COL-1001"): SessionPayload => ({ ...base, role, college });
const call = (s: SessionPayload, method: string, path: string, body?: unknown) =>
  dispatch(method, path.split("/"), body, s, new URLSearchParams());

describe("agent store", () => {
  beforeEach(() => resetAgentStoreMemory());

  it("lists every agent as on by default", async () => {
    const res = await call(who("institution"), "GET", "agents/store");
    expect(res.status).toBe(200);
    const v = res.body as AgentStoreView;
    expect(v.agents.length).toBeGreaterThan(10);
    expect(v.agents.every((a) => a.enabled)).toBe(true);
    expect(v.agents.find((a) => a.id === "orchestrator")?.locked).toBe(true);
  });

  it("switching an agent off persists and stops its chat for that college only", async () => {
    const p = who("institution");
    const off = await call(p, "PUT", "agents/store", { agent: "tutor", enabled: false });
    expect(off.status).toBe(200);
    expect((off.body as AgentStoreView).agents.find((a) => a.id === "tutor")?.enabled).toBe(false);
    expect(((await call(p, "GET", "agents/store")).body as AgentStoreView).agents.find((a) => a.id === "tutor")?.enabled).toBe(false);

    const student = who("student");
    expect((await call(student, "POST", "ai/chat", { agent: "tutor", message: "Explain recursion" })).status).toBe(403);
    expect((await call(student, "POST", "ai/chat", { agent: "exam", message: "Make a mock test" })).status).toBe(200);
    expect((await call(who("student", "COL-1002"), "POST", "ai/chat", { agent: "tutor", message: "Explain recursion" })).status).toBe(200);

    await call(p, "PUT", "agents/store", { agent: "tutor", enabled: true });
    expect((await call(student, "POST", "ai/chat", { agent: "tutor", message: "Explain recursion" })).status).toBe(200);
  });

  it("guards who can change it and what can be changed", async () => {
    expect((await call(who("student"), "GET", "agents/store")).status).toBe(403);
    expect((await call(who("faculty"), "PUT", "agents/store", { agent: "tutor", enabled: false })).status).toBe(403);
    expect((await call(who("institution"), "PUT", "agents/store", { agent: "nope-agent", enabled: false })).status).toBe(404);
    expect((await call(who("institution"), "PUT", "agents/store", { agent: "orchestrator", enabled: false })).status).toBe(400);
    expect((await call(who("institution"), "PUT", "agents/store", { agent: "tutor" })).status).toBe(400);
  });
});
