import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { TextResult, TextRequest } from "./text";

/*
 * Anthropic Claude for the AI layer: one system prompt + one user prompt in, the reply text out. Uses the official
 * SDK. Current Claude models think adaptively and reject sampling parameters, so no temperature is sent; effort is
 * set explicitly. On models that support it, server-side refusal fallbacks ("default") are opted into, so a request a
 * safety classifier declines is re-run on Anthropic's recommended fallback model instead of failing.
 */

/** Models that take `output_config.effort` and the server-side `fallbacks: "default"` form. */
const CURRENT = /^claude-(opus-5|sonnet-5-5|fable-5)/;

export async function claudeText(req: TextRequest, apiKey: string, model: string): Promise<TextResult> {
  const client = new Anthropic({ apiKey, timeout: req.timeoutMs ?? 90_000, maxRetries: 1 });
  const current = CURRENT.test(model);
  try {
    const stream = client.beta.messages.stream({
      model,
      max_tokens: Math.max(16_000, req.maxOutputTokens ?? 0),
      system: req.system,
      messages: [{ role: "user", content: req.prompt }],
      ...(current ? { output_config: { effort: "medium" as const }, fallbacks: "default" as const, betas: ["server-side-fallback-2026-07-01"] } : {}),
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") return { ok: false, reason: "blocked" };
    if (msg.stop_reason === "max_tokens") return { ok: false, reason: "truncated" };
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    return text ? { ok: true, text } : { ok: false, reason: "empty" };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { ok: false, reason: "http_401" };
    if (e instanceof Anthropic.PermissionDeniedError) return { ok: false, reason: "http_403" };
    if (e instanceof Anthropic.NotFoundError) return { ok: false, reason: "http_404" };
    if (e instanceof Anthropic.BadRequestError) return { ok: false, reason: "http_400" };
    if (e instanceof Anthropic.RateLimitError) return { ok: false, reason: "http_429" };
    if (e instanceof Anthropic.APIConnectionTimeoutError) return { ok: false, reason: "timeout" };
    if (e instanceof Anthropic.APIConnectionError) return { ok: false, reason: "network" };
    if (e instanceof Anthropic.APIError) return { ok: false, reason: `http_${e.status ?? 500}` };
    return { ok: false, reason: "network" };
  }
}
