import "server-only";
import { dataBackend, withRequestContext } from "@/lib/data";
import { pgAccountActive, pgAuthenticate, pgHasTotp, pgVerifyTotp } from "@/lib/data/postgres/auth";
import { ROLE_META, type Role } from "./roles";
import { safeEqual, type SessionPayload } from "./session";

/*
 * Sign-in checks for both backends.
 *   memory   — the demo: any well-formed email and password signs in as the role's persona; MFA code 246810.
 *   postgres — the real account: argon2id password, role held in that college, lockout, TOTP.
 */

export const DEMO_MFA_CODE = "246810";

export type LoginResult = { ok: true; sub: string; name: string } | { ok: false; locked?: boolean };

export async function authenticate(input: { email: string; password: string; role: Role; college: string | null }): Promise<LoginResult> {
  if (dataBackend() === "memory") {
    const isMedical = input.college === "COL-1006" || input.college === "COL-1007" || input.email.includes("mmch") || input.email.includes("cinahs");
    let name = ROLE_META[input.role].persona.split(" · ")[0] ?? "User";
    if (isMedical) {
      if (input.role === "student") name = "Keerthana S.";
      if (input.role === "faculty") name = "Dr. R. Prakash, MD";
      if (input.role === "hod") name = "Dr. S. K. Narayanan, MS";
      if (input.role === "institution") name = "Dr. R. Meenakshi, MD";
    }
    return { ok: true, sub: `demo-${input.role}-${input.college ?? "all"}`, name };
  }
  const r = await withRequestContext({ scope: "all" }, () => pgAuthenticate(input));
  return r.ok ? r : { ok: false, locked: r.reason === "locked" };
}

/**
 * The second factor. Accounts with an authenticator must use it. Without one, the demo code is
 * accepted outside production only, so a fresh local database can be used before enrolment.
 */
export async function verifySecondFactor(session: SessionPayload, code: string): Promise<"ok" | "invalid" | "not_enrolled"> {
  if (dataBackend() === "memory") return safeEqual(code, DEMO_MFA_CODE) ? "ok" : "invalid";
  const r = await withRequestContext({ scope: "all", sub: session.sub, readOnly: true }, () => pgVerifyTotp(session.sub, code));
  if (r === true) return "ok";
  if (r === false) return "invalid";
  if (process.env.NODE_ENV === "production") return "not_enrolled";
  return safeEqual(code, DEMO_MFA_CODE) ? "ok" : "invalid";
}

/** What the MFA screen should say: the demo code, or "use your authenticator app". */
export async function mfaHint(sub: string): Promise<"demo" | "authenticator"> {
  if (dataBackend() === "memory") return "demo";
  const enrolled = await withRequestContext({ scope: "all", sub, readOnly: true }, () => pgHasTotp(sub));
  return enrolled || process.env.NODE_ENV === "production" ? "authenticator" : "demo";
}

/** Suspended or deleted accounts lose access even with a valid session cookie. */
export async function accountActive(sub: string): Promise<boolean> {
  if (dataBackend() === "memory") return true;
  return withRequestContext({ scope: "all", sub, readOnly: true }, () => pgAccountActive(sub));
}
