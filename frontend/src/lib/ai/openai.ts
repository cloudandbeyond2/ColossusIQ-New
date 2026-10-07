import "server-only";
import type { TextResult, TextRequest } from "./text";

/*
 * OpenAI ChatGPT for the AI layer: the Chat Completions endpoint asked for a JSON object reply. The key goes in the
 * Authorization header and never leaves the server.
 */

const ENDPOINT = "https://api.openai.com/v1/chat/completions";

export async function openaiText(req: TextRequest, apiKey: string, model: string): Promise<TextResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), req.timeoutMs ?? 90_000);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.prompt },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: req.maxOutputTokens ?? 8192,
        ...(req.temperature !== undefined && !/^(o\d|gpt-5)/.test(model) ? { temperature: req.temperature } : {}),
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, reason: `http_${res.status}` };
    const body = (await res.json()) as { choices?: Array<{ finish_reason?: string; message?: { content?: string | null; refusal?: string | null } }> };
    const choice = body.choices?.[0];
    if (choice?.message?.refusal) return { ok: false, reason: "blocked" };
    if (choice?.finish_reason === "length") return { ok: false, reason: "truncated" };
    if (choice?.finish_reason === "content_filter") return { ok: false, reason: "blocked" };
    const text = choice?.message?.content ?? "";
    return text ? { ok: true, text } : { ok: false, reason: "empty" };
  } catch (e) {
    return { ok: false, reason: (e as Error).name === "AbortError" ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}
