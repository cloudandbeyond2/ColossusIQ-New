/** What every provider call takes and returns (shared by gemini.ts, claude.ts and openai.ts). */
export interface TextRequest {
  system: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
}
export type TextResult = { ok: true; text: string } | { ok: false; reason: string };
