import type { z } from "zod";
import { CSRF_HEADER } from "@/lib/auth/session";

/**
 * Single entry point for all API traffic.
 * - Same-origin in mock mode; NEXT_PUBLIC_API_BASE_URL in live mode.
 * - Cookies only (credentials: "include"); no tokens in JS storage, URLs or query strings.
 * - Double-submit CSRF token on every mutating request.
 * - Every response is validated with a zod schema; unexpected shapes are rejected.
 */

const MODE = process.env.NEXT_PUBLIC_API_MODE === "live" ? "live" : "mock";
const BASE = MODE === "live" ? (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "") : "";
const TIMEOUT_MS = 20_000;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    /** Field-level validation messages returned by the server (keyed by field name). */
    public fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

let csrfPromise: Promise<string> | null = null;

async function getCsrfToken(): Promise<string> {
  const existing = readCookie("ciq_csrf");
  if (existing) return existing;
  csrfPromise ??= fetch(`${BASE}/api/v1/auth/csrf`, { credentials: "include", cache: "no-store" })
    .then(async (r) => {
      if (!r.ok) throw new ApiError(r.status, "csrf_failed", "Could not initialise a secure session.");
      const body = (await r.json()) as { token?: unknown };
      if (typeof body.token !== "string") throw new ApiError(500, "csrf_failed", "Invalid CSRF response.");
      return body.token;
    })
    .finally(() => {
      csrfPromise = null;
    });
  return csrfPromise;
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export async function apiFetch<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
  options: { method?: Method; body?: unknown; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<z.infer<S>> {
  if (!path.startsWith("/api/v1/")) throw new Error("API paths must start with /api/v1/");
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") headers[CSRF_HEADER] = await getCsrfToken();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? TIMEOUT_MS);
  options.signal?.addEventListener("abort", () => controller.abort());

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      credentials: "include",
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw new ApiError(0, "timeout", "The request timed out.");
    throw new ApiError(0, "network", "Network error — check your connection.");
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/api/v1/auth/")) {
    const suspended = (await res.clone().text()).includes('"college_suspended"');
    const next = encodeURIComponent(window.location.pathname);
    window.location.replace(suspended ? "/login?reason=suspended" : `/login?next=${next}`);
    throw new ApiError(401, "unauthenticated", "Your session has ended. Please sign in again.");
  }

  // Academic-year fee lock: send the user to the one page they can use until it is cleared.
  if (res.status === 423 && typeof window !== "undefined") {
    const role = window.location.pathname.split("/")[1] ?? "";
    const target = role === "student" ? "/student/fee-payment" : `/${role}/locked`;
    if (/^[a-z]+$/.test(role) && window.location.pathname !== target) window.location.assign(target);
  }

  let json: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      throw new ApiError(res.status, "bad_response", "Unexpected response from the server.");
    }
  }

  if (!res.ok) {
    const err = (json ?? {}) as { error?: { code?: string; message?: string; fields?: unknown } };
    const fields: Record<string, string> = {};
    if (err.error?.fields && typeof err.error.fields === "object") {
      for (const [k, v] of Object.entries(err.error.fields as Record<string, unknown>)) {
        if (typeof v === "string" && /^\w{1,40}$/.test(k)) fields[k] = v.slice(0, 200);
      }
    }
    throw new ApiError(
      res.status,
      err.error?.code ?? "error",
      // Only show server-provided messages that are plain, short strings.
      typeof err.error?.message === "string" ? err.error.message.slice(0, 200) : "Something went wrong.",
      fields,
    );
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    if (process.env.NODE_ENV !== "production") console.error("Schema mismatch", path, parsed.error.issues);
    throw new ApiError(res.status, "schema_mismatch", "The server returned data in an unexpected format.");
  }
  return parsed.data;
}

export const apiMode = MODE;
