import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { effective, primeAiConfigForTests, providerOrder, aiConfig, resetAiProviderMemory } from "@/lib/ai/ai-config";
import { pingProvider } from "@/lib/ai/gemini";
import { openaiText } from "@/lib/ai/openai";
import type { ProvidersOverview, TestResult } from "@/lib/api/ai-providers-schemas";
import { dispatch } from "@/lib/api/mock/router";
import type { SessionPayload } from "@/lib/auth/session";

const admin: SessionPayload = { sub: "sa", role: "admin", name: "Super Admin", tenant: "uni-tntu", college: "all", mfa: true, exp: 9e9 };
const q = new URLSearchParams();
const call = (s: SessionPayload, method: string, path: string, body?: unknown) => dispatch(method, path.split("/"), body, s, q);
const CLAUDE_KEY = "sk-ant-api03-TESTKEYTESTKEYTESTKEY-abcd";
const OPENAI_KEY = "sk-proj-TESTKEYTESTKEYTESTKEY-wxyz";
const card = (o: ProvidersOverview, id: string) => o.providers.find((p) => p.id === id)!;

beforeEach(() => {
  resetAiProviderMemory();
  delete process.env.GEMINI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("defaults", () => {
  it("Gemini is on and the default; Claude and ChatGPT are off", () => {
    const cfg = effective([]);
    expect(cfg.defaultProvider).toBe("gemini");
    expect(cfg.providers.gemini.enabled).toBe(true);
    expect(cfg.providers.claude.enabled).toBe(false);
    expect(cfg.providers.openai.enabled).toBe(false);
    expect(cfg.providers.claude.model).toBe("claude-opus-5-5");
  });
  it("uses environment keys when nothing is saved", () => {
    process.env.GEMINI_API_KEY = "AIzaTESTKEYTESTKEYTESTKEY1234";
    const cfg = effective([]);
    expect(cfg.providers.gemini).toMatchObject({ keySource: "environment" });
    expect(providerOrder(cfg)).toEqual(["gemini"]);
  });
});

describe("AI Providers settings", () => {
  it("is for the Super Admin, and changes need the All colleges scope", async () => {
    expect((await call({ ...admin, role: "institution", college: "COL-1001" }, "GET", "ai-providers")).status).toBe(403);
    const atCollege = { ...admin, college: "COL-1001" };
    expect(((await call(atCollege, "GET", "ai-providers")).body as ProvidersOverview).canEdit).toBe(false);
    expect((await call(atCollege, "PUT", "ai-providers/claude", { apiKey: CLAUDE_KEY })).status).toBe(409);
    expect((await call({ ...admin, mfa: false }, "PUT", "ai-providers/claude", { apiKey: CLAUDE_KEY })).status).toBe(403);
  });

  it("saves keys write-only, switches providers on and changes the default", async () => {
    let o = (await call(admin, "GET", "ai-providers")).body as ProvidersOverview;
    expect(o.defaultProvider).toBe("gemini");
    expect(o.canEdit).toBe(true);

    // Switching on without a key is refused.
    expect((await call(admin, "PUT", "ai-providers/claude", { enabled: true })).status).toBe(409);

    const r = await call(admin, "PUT", "ai-providers/claude", { apiKey: CLAUDE_KEY, model: "claude-sonnet-5-5" });
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.body)).not.toContain(CLAUDE_KEY);
    o = r.body as ProvidersOverview;
    expect(card(o, "claude")).toMatchObject({ keyHint: "••••abcd", keySource: "settings", model: "claude-sonnet-5-5", enabled: false });

    o = (await call(admin, "PUT", "ai-providers/claude", { enabled: true })).body as ProvidersOverview;
    expect(card(o, "claude").usable).toBe(true);

    o = (await call(admin, "POST", "ai-providers/default", { provider: "claude" })).body as ProvidersOverview;
    expect(o.defaultProvider).toBe("claude");
    expect(card(o, "gemini").isDefault).toBe(false);

    // The default cannot be switched off or lose its key.
    expect((await call(admin, "PUT", "ai-providers/claude", { enabled: false })).status).toBe(409);
    expect((await call(admin, "DELETE", "ai-providers/claude/key")).status).toBe(409);

    // The AI layer tries the default first, then other switched-on providers with a key.
    process.env.GEMINI_API_KEY = "AIzaTESTKEYTESTKEYTESTKEY1234";
    await primeAiConfigForTests();
    expect(providerOrder()).toEqual(["claude", "gemini"]);
    expect(aiConfig().providers.claude.apiKey).toBe(CLAUDE_KEY);
  });

  it("validates keys and model ids", async () => {
    expect((await call(admin, "PUT", "ai-providers/openai", { apiKey: "short" })).status).toBe(422);
    expect((await call(admin, "PUT", "ai-providers/openai", { apiKey: "sk-has spaces in it and is long" })).status).toBe(422);
    expect((await call(admin, "PUT", "ai-providers/openai", { model: "gpt 4o" })).status).toBe(422);
    expect((await call(admin, "PUT", "ai-providers/mistral", { model: "x" })).status).toBe(404);
    expect((await call(admin, "POST", "ai-providers/default", { provider: "openai" })).status).toBe(409);
  });

  it("tests a provider with a tiny live request", async () => {
    await call(admin, "PUT", "ai-providers/openai", { apiKey: OPENAI_KEY });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ choices: [{ finish_reason: "stop", message: { content: '{"ok": true}' } }] }) });
    vi.stubGlobal("fetch", fetchMock);
    const r = (await call(admin, "POST", "ai-providers/openai/test")).body as TestResult;
    expect(r.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: `Bearer ${OPENAI_KEY}` });

    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    const bad = (await call(admin, "POST", "ai-providers/openai/test")).body as TestResult;
    expect(bad).toMatchObject({ ok: false });
    expect(bad.message).toMatch(/rejected/);
  });
});

describe("ChatGPT client", () => {
  it("asks for a JSON object and maps refusals and truncation", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ choices: [{ finish_reason: "stop", message: { content: '{"a":1}' } }] }) });
    vi.stubGlobal("fetch", fetchMock);
    expect(await openaiText({ system: "s", prompt: "p" }, OPENAI_KEY, "gpt-4o-mini")).toEqual({ ok: true, text: '{"a":1}' });
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[0]).toEqual({ role: "system", content: "s" });

    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ choices: [{ finish_reason: "stop", message: { content: null, refusal: "no" } }] }) });
    expect(await openaiText({ system: "s", prompt: "p" }, OPENAI_KEY, "gpt-4o-mini")).toEqual({ ok: false, reason: "blocked" });
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ choices: [{ finish_reason: "length", message: { content: '{"a"' } }] }) });
    expect(await openaiText({ system: "s", prompt: "p" }, OPENAI_KEY, "gpt-4o-mini")).toEqual({ ok: false, reason: "truncated" });
  });
  it("ping reports a missing key without calling out", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await pingProvider("openai")).reason).toBe("no_key");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
