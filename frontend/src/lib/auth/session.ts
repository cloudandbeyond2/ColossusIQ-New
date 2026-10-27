import { isRole, type Role } from "./roles";
import { ALL_COLLEGES, isCollegeScope } from "@/config/tenancy";

/**
 * Demo session token: base64url(JSON payload) + "." + base64url(HMAC-SHA256).
 * Stored only in an HttpOnly, Secure, SameSite=Strict cookie — never in JS-readable storage.
 * In live mode the real backend issues its own session; this module backs the mock API and the proxy.
 */
export const SESSION_COOKIE = "ciq_session";
export const CSRF_COOKIE = "ciq_csrf";
export const CSRF_HEADER = "x-csrf-token";
export const SESSION_TTL_SECONDS = 60 * 60 * 8;

export interface SessionPayload {
  sub: string;
  role: Role;
  name: string;
  /** University (tenant) id. */
  tenant: string;
  /** College scope: a college id, or "all" (University Super Admin only). */
  college: string;
  /** Department name (e.g. for HOD, Faculty, or Student), if assigned. */
  department?: string;
  mfa: boolean;
  exp: number; // unix seconds
}


const encoder = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV !== "production") {
      return "dev-session-secret-change-in-production-at-least-32-chars";
    }
    throw new Error("SESSION_SECRET must be set to at least 32 characters");
  }
  return secret;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function signSession(payload: SessionPayload, secret = getSecret()): Promise<string> {
  const body = b64url(encoder.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(body));
  return `${body}.${b64url(new Uint8Array(sig))}`;
}

export async function verifySession(
  token: string | undefined | null,
  secret?: string,
  now = Math.floor(Date.now() / 1000),
): Promise<SessionPayload | null> {
  if (!token || token.length > 4096) return null;
  const resolvedSecret = secret ?? getSecret();
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts as [string, string];
  try {
    const ok = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(resolvedSecret),
      fromB64url(sig) as BufferSource,
      encoder.encode(body),
    );
    if (!ok) return null;
    const data: unknown = JSON.parse(new TextDecoder().decode(fromB64url(body)));
    if (!data || typeof data !== "object") return null;
    const p = data as Record<string, unknown>;
    if (
      typeof p.sub !== "string" ||
      !isRole(p.role) ||
      typeof p.name !== "string" ||
      typeof p.tenant !== "string" ||
      !isCollegeScope(p.college) ||
      (p.college === ALL_COLLEGES && p.role !== "admin") ||
      typeof p.mfa !== "boolean" ||
      typeof p.exp !== "number"
    ) {
      return null;
    }
    if (p.exp <= now) return null;
    return p as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return b64url(arr);
}

/** Constant-time string comparison for CSRF tokens. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
