import "server-only";
import type { SessionPayload } from "@/lib/auth/session";
import { getStore } from "@/lib/data";
import { resolveCollegeId } from "./early-warning";

/** Shared by the incubation pages (pipeline, startups, mentors, funding readiness). */
export class IncubationError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 = 400,
  ) {
    super(message);
  }
}

/** The college the signed-in person is working in; the Super Admin sees the first college. */
export function incubationCollege(session: SessionPayload): Promise<string> {
  return resolveCollegeId(session.college);
}

/** Label for a new cohort when none is given, e.g. "2026 Innovation Cohort". */
export function currentCohort(): string {
  return `${new Date().getFullYear()} Innovation Cohort`;
}

export async function incubationAudit(session: SessionPayload, college: string, action: string, target: string) {
  await getStore().audit.add({ actor: session.name, action, target, collegeId: college, actorSub: session.sub });
}

/** First rupee amount in free text such as "₹5,50,000 (TANSIM + Seed)"; 0 when there is none. */
export function parseInr(text: string): number {
  const m = /₹\s*([0-9][0-9,]*(?:\.[0-9]+)?)/.exec(text);
  if (!m?.[1]) return 0;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function formatInr(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Crores`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} Lakhs`;
  return `₹${n.toLocaleString("en-IN")}`;
}
