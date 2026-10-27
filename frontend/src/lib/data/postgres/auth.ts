import "server-only";
import { hash, verify } from "@node-rs/argon2";
import type { Role } from "@/lib/auth/roles";
import { decryptSecret, verifyTotp } from "@/lib/auth/totp";
import { db, isUuid } from "./db";
import { collegeByPublic } from "./lookups";

/*
 * Account checks against users / user_credentials / user_mfa / role_assignments.
 * Every failure looks the same to the caller; only the audit and lockout counters differ.
 */

const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;
/** argon2id parameters (OWASP: m=19 MiB, t=2, p=1). */
export const ARGON2 = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

let dummyHash: Promise<string> | undefined;
/** Verifying against a throwaway hash keeps the response time the same when the account does not exist. */
function dummy(): Promise<string> {
  dummyHash ??= hash("not-a-real-password-" + Math.random(), ARGON2);
  return dummyHash;
}

export type AuthResult = { ok: true; sub: string; name: string; department?: string } | { ok: false; reason: "invalid" | "locked" };

export async function pgAuthenticate(input: { email: string; password: string; role: Role; college: string | null }): Promise<AuthResult> {
  const t = db();
  const user = await t.user.findFirst({
    where: { email: { equals: input.email, mode: "insensitive" } },
    include: {
      userCredential: true,
      roleAssignments: {
        select: {
          role: true,
          collegeId: true,
          department: { select: { name: true } },
        },
      },
      staff: {
        include: {
          department: { select: { name: true } },
        },
      },
    },
  });
  const cred = user?.userCredential;
  if (!user || !cred) {
    await verify(await dummy(), input.password).catch(() => false);
    return { ok: false, reason: "invalid" };
  }
  if (cred.lockedUntil && cred.lockedUntil > new Date()) {
    await verify(await dummy(), input.password).catch(() => false);
    return { ok: false, reason: "locked" };
  }
  const good = await verify(cred.passwordHash, input.password).catch(() => false);
  if (!good) {
    const failures = cred.failedAttempts + 1;
    const lock = failures >= MAX_FAILURES;
    await t.userCredential.update({
      where: { userId: user.id },
      data: { failedAttempts: lock ? 0 : failures, lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : cred.lockedUntil },
    });
    return { ok: false, reason: lock ? "locked" : "invalid" };
  }
  // The password is right; the account must also be active and hold this role in this college.
  const collegeUuid = input.college ? (await collegeByPublic(input.college))?.id : null;
  const matchingAssignment = user.roleAssignments.find(
    (r) => r.role === input.role && (r.collegeId ?? null) === (collegeUuid ?? null)
  );
  const holds = Boolean(matchingAssignment);
  await t.userCredential.update({ where: { userId: user.id }, data: { failedAttempts: 0, lockedUntil: null } });
  if (user.status !== "Active" || !holds) return { ok: false, reason: "invalid" };
  await t.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const department = matchingAssignment?.department?.name ?? user.staff?.department?.name ?? undefined;
  return { ok: true, sub: user.id, name: user.fullName, department };
}

/** true / false for an enrolled authenticator; "not_enrolled" when the account has none. */
export async function pgVerifyTotp(sub: string, code: string): Promise<boolean | "not_enrolled"> {
  if (!isUuid(sub)) return false;
  const mfa = await db().userMfa.findUnique({ where: { userId: sub } });
  if (!mfa) return "not_enrolled";
  return verifyTotp(decryptSecret(mfa.totpSecretEncrypted), code);
}

export async function pgHasTotp(sub: string): Promise<boolean> {
  return isUuid(sub) && (await db().userMfa.count({ where: { userId: sub } })) > 0;
}

export async function pgAccountActive(sub: string): Promise<boolean> {
  if (isUuid(sub)) {
    const u = await db().user.findUnique({ where: { id: sub }, select: { status: true } });
    return u?.status === "Active";
  }
  const str = String(sub);
  if (process.env.NODE_ENV !== "production" && str.startsWith("demo-")) {
    return true;
  }
  return false;
}
