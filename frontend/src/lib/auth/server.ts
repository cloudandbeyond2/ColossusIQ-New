import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ModuleDef } from "@/config/modules";
import { ALL_COLLEGES, TOGGLEABLE_GROUPS } from "@/config/tenancy";
import { collegeName, collegeStream, enabledGroups, isCollegeActive } from "@/lib/api/mock/records";
import { withRequestContext } from "@/lib/data";
import type { Stream } from "@/config/streams";
import { SESSION_COOKIE, verifySession, type SessionPayload } from "./session";
import type { Role } from "./roles";
import { blockedSlugs } from "@/lib/module-access";

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

/** Server-side guard used by portal layouts and pages — the proxy is not the only line of defence. */
export async function requireRole(role: Role): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect(`/login?next=/${role}`);
  if (!session.mfa) redirect("/login/mfa");
  if (session.role !== role) redirect("/forbidden");
  // A college suspended by the university loses access immediately, even with a valid session.
  if (session.college !== ALL_COLLEGES && !(await withRequestContext({ scope: "all", readOnly: true }, () => isCollegeActive(session.college)))) redirect("/login?reason=suspended");
  return session;
}

export interface CollegeContext {
  scope: string;
  collegeName: string;
  isAllColleges: boolean;
  enabledGroups: string[] | "all";
  /** Academic stream of the college (null at university-wide scope). */
  stream: Stream | null;
  /** Modules the Super Admin has switched off for the signed-in role (Module Control). */
  blocked: string[];
}

export async function collegeContext(session: SessionPayload): Promise<CollegeContext> {
  const all = session.college === ALL_COLLEGES;
  return withRequestContext({ scope: session.college, sub: session.sub, readOnly: true }, async () => ({
    scope: session.college,
    collegeName: all ? "All colleges" : await collegeName(session.college),
    isAllColleges: all,
    enabledGroups: await enabledGroups(session.college),
    stream: all ? null : await collegeStream(session.college),
    blocked: await blockedSlugs(session.role),
  }));
}

/** Whether a module's area is switched on for the session's college. */
export function isModuleEnabled(mod: ModuleDef, ctx: CollegeContext): boolean {
  if (ctx.blocked.includes(mod.slug)) return false;
  // Stream-only modules (e.g. Clinical Rotations for medical colleges) are hidden elsewhere.
  if (mod.streams && ctx.stream && !mod.streams.includes(ctx.stream)) return false;
  if (!(TOGGLEABLE_GROUPS as readonly string[]).includes(mod.group)) return true;
  return ctx.enabledGroups === "all" || ctx.enabledGroups.includes(mod.group);
}
