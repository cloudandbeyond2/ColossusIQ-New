import "server-only";
import type { TextResult, TextRequest } from "./text";

/*
 * Anthropic Claude for the AI layer: one system prompt + one user prompt in, the reply text out.
 * Uses native fetch to Anthropic Messages API.
 */

const ENDPOINT = "https://api.anthropic.com/v1/messages";

export async function claudeText(req: TextRequest, apiKey: string, model: string): Promise<TextResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), req.timeoutMs ?? 90_000);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: Math.max(16_000, req.maxOutputTokens ?? 4096),
        system: req.system,
        messages: [{ role: "user", content: req.prompt }],
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, reason: `http_${res.status}` };
    const body = (await res.json()) as {
      stop_reason?: string;
      content?: Array<{ type: string; text?: string }>;
    };
    if (body.stop_reason === "refusal") return { ok: false, reason: "blocked" };
    if (body.stop_reason === "max_tokens") return { ok: false, reason: "truncated" };
    const text = body.content?.map((b) => (b.type === "text" ? b.text ?? "" : "")).join("") ?? "";
    return text ? { ok: true, text } : { ok: false, reason: "empty" };
  } catch (e) {
    return { ok: false, reason: (e as Error).name === "AbortError" ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}
