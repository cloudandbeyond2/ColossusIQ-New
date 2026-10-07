import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { findModule } from "@/config/modules";
import { ListData, ModuleData } from "@/lib/api/schemas";
import { ModuleControlOverview, PlatformHealth } from "@/lib/api/module-control-schemas";
import { recordAiCall, resetAiLog } from "@/lib/ai/ai-log";
import { dispatch, moduleEnabled } from "@/lib/api/mock/router";
import { resetModuleAccessMemory } from "@/lib/module-access";
import type { SessionPayload } from "@/lib/auth/session";

const base: SessionPayload = { sub: "demo-admin", role: "admin", name: "Super Admin", tenant: "uni-tntu", college: "all", mfa: true, exp: 9e9 };
const admin = base;
const student: SessionPayload = { ...base, sub: "demo-student", role: "student", name: "Student", college: "COL-1001" };
const faculty: SessionPayload = { ...base, sub: "demo-faculty", role: "faculty", name: "Faculty", college: "COL-1001" };
const q = new URLSearchParams();
const call = (s: SessionPayload, method: string, path: string, body?: unknown) => dispatch(method, path.split("/"), body, s, q);
const put = (disabled: string[], s = admin) => call(s, "PUT", "module-control", { disabled });

beforeEach(() => resetModuleAccessMemory());

describe("Module Control", () => {
  it("is for the Super Admin only, and changes need All colleges and a confirmed code", async () => {
    expect((await call(student, "GET", "module-control")).status).toBe(403);
    expect((await call(faculty, "PUT", "module-control", { disabled: [] })).status).toBe(403);
    const d = ModuleControlOverview.parse((await call(admin, "GET", "module-control")).body);
    expect(d.canEdit).toBe(true);
    expect(d.disabled).toEqual([]);
    expect(d.locked).toContain("module-control|admin");
    expect((await put([], { ...admin, college: "COL-1001" })).status).toBe(409);
    expect((await put([], { ...admin, mfa: false })).status).toBe(403);
  });

  it("switches a module off for one role: menu, page and API", async () => {
    const mod = findModule("competitive-exams")!;
    expect(await moduleEnabled(mod, student)).toBe(true);
    expect((await call(student, "GET", "exam-prep")).status).toBe(200);

    const r = await put(["competitive-exams|student"]);
    expect(r.status).toBe(200);
    expect(ModuleControlOverview.parse(r.body).disabled).toEqual(["competitive-exams|student"]);
    expect(await moduleEnabled(mod, student)).toBe(false);
    const blocked = await call(student, "GET", "exam-prep");
    expect(blocked.status).toBe(403);
    expect(JSON.stringify(blocked.body)).toContain("module_disabled");

    // Switching it back on restores access.
    await put([]);
    expect(await moduleEnabled(mod, student)).toBe(true);
    expect((await call(student, "GET", "exam-prep")).status).toBe(200);
  });

  it("leaves other roles alone and keeps an API open while another of its modules is on", async () => {
    await put(["current-affairs-desk|faculty"]);
    // current-affairs also serves the student hub, which is still on.
    expect((await call(student, "GET", "current-affairs")).status).toBe(200);
    expect((await call(faculty, "GET", "current-affairs")).status).toBe(403);
  });

  it("refuses pairs that are not granted, unknown or the Super Admin's own controls", async () => {
    expect((await put(["module-control|admin"])).status).toBe(422);
    expect((await put(["colleges|student"])).status).toBe(422);
    expect((await put(["no-such-module|student"])).status).toBe(422);
    expect((await call(admin, "PUT", "module-control", { disabled: ["not a pair"] })).status).toBe(422);
  });

  it("templated module pages close too", async () => {
    await put(["question-bank|faculty"]);
    expect((await call(faculty, "GET", "modules/question-bank")).status).not.toBe(200);
    expect((await call(admin, "GET", "modules/question-bank")).status).toBe(200);
  });
});

describe("live Super Admin pages", () => {
  beforeEach(() => resetAiLog());

  it("platform health is for the Super Admin and reflects Module Control", async () => {
    expect((await call(student, "GET", "platform-health")).status).toBe(403);
    await put(["competitive-exams|student", "languages|student"]);
    const h = PlatformHealth.parse((await call(admin, "GET", "platform-health")).body);
    expect(h.switchedOff).toBe(2);
    const st = h.access.find((a) => a.role === "student")!;
    expect(st.granted - st.on).toBe(2);
    expect(h.providers.map((p) => p.id)).toEqual(["gemini", "claude", "openai"]);
  });

  it("AI Observability lists real requests, never their content", async () => {
    recordAiCall({ provider: "claude", model: "claude-opus-5-5", ms: 812, ok: true, reason: "ok", fallback: true });
    const d = ListData.parse((await call(admin, "GET", "modules/ai-observability")).body);
    expect(d.rows).toHaveLength(1);
    expect(d.rows[0]).toMatchObject({ provider: "Anthropic Claude", model: "claude-opus-5-5", latency: 812, route: "Fallback" });
  });

  it.each(["billing", "ai-governance", "agent-store", "integrations", "developer-api"])("%s is built from live data", async (slug) => {
    const r = await call(admin, "GET", `modules/${slug}`);
    expect(r.status).toBe(200);
    expect(ModuleData.safeParse(r.body).success).toBe(true);
    const text = JSON.stringify(r.body);
    expect(text).not.toMatch(/ERP sync|Enabled for 3 tenants|reasoning-large/);
  });
});
