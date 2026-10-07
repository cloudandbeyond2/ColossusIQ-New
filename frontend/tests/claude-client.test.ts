import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const stream = vi.fn();
const ctor = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {
    status?: number;
  }
  class Anthropic {
    static APIError = APIError;
    static AuthenticationError = class extends APIError {};
    static PermissionDeniedError = class extends APIError {};
    static NotFoundError = class extends APIError {};
    static BadRequestError = class extends APIError {};
    static RateLimitError = class extends APIError {};
    static APIConnectionError = class extends Error {};
    static APIConnectionTimeoutError = class extends Error {};
    beta = { messages: { stream } };
    constructor(opts: unknown) {
      ctor(opts);
    }
  }
  return { default: Anthropic };
});

import { claudeText } from "@/lib/ai/claude";

const reply = (over: Record<string, unknown> = {}) => ({ finalMessage: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: '{"ok":true}' }], ...over }) });

describe("Claude client", () => {
  beforeEach(() => {
    stream.mockReset();
    ctor.mockReset();
  });

  it("sends the key to the SDK, no sampling parameters, medium effort and refusal fallbacks on current models", async () => {
    stream.mockReturnValue(reply());
    const r = await claudeText({ system: "sys", prompt: "go", temperature: 0.6, maxOutputTokens: 6000 }, "sk-ant-key", "claude-opus-5-5");
    expect(r).toEqual({ ok: true, text: '{"ok":true}' });
    expect(ctor.mock.calls[0]![0]).toMatchObject({ apiKey: "sk-ant-key" });
    const params = stream.mock.calls[0]![0];
    expect(params).toMatchObject({ model: "claude-opus-5-5", system: "sys", messages: [{ role: "user", content: "go" }], output_config: { effort: "medium" }, fallbacks: "default", betas: ["server-side-fallback-2026-07-01"] });
    expect(params.max_tokens).toBeGreaterThanOrEqual(16_000);
    expect(params).not.toHaveProperty("temperature");
    expect(params).not.toHaveProperty("thinking");
  });

  it("omits effort and fallbacks on older models such as Haiku", async () => {
    stream.mockReturnValue(reply());
    await claudeText({ system: "s", prompt: "p" }, "k", "claude-haiku-4-5");
    const params = stream.mock.calls[0]![0];
    expect(params).not.toHaveProperty("output_config");
    expect(params).not.toHaveProperty("fallbacks");
  });

  it("treats refusals and truncation as failures so another provider can answer", async () => {
    stream.mockReturnValue(reply({ stop_reason: "refusal", content: [] }));
    expect(await claudeText({ system: "s", prompt: "p" }, "k", "claude-opus-5-5")).toEqual({ ok: false, reason: "blocked" });
    stream.mockReturnValue(reply({ stop_reason: "max_tokens" }));
    expect(await claudeText({ system: "s", prompt: "p" }, "k", "claude-opus-5-5")).toEqual({ ok: false, reason: "truncated" });
  });
});
