/*
 * Single-university, multi-college tenancy.
 *
 *   University (one per deployment)
 *     └── Colleges (many) ── each owns its students, staff, users, courses, events and admissions
 *
 * The University Super Admin ("admin" role) can work across all colleges ("all" scope) or step
 * into one college. Every other role is permanently scoped to the college it signed in to.
 */

export const UNIVERSITY = {
  id: process.env.NEXT_PUBLIC_INSTITUTION_ID || process.env.INSTITUTION_ID || "uni-tntu",
  name: process.env.NEXT_PUBLIC_INSTITUTION_NAME || process.env.INSTITUTION_NAME || "Tamil Nadu Technical University",
  shortName: process.env.NEXT_PUBLIC_INSTITUTION_SHORT_NAME || process.env.INSTITUTION_SHORT_NAME || "TNTU",
} as const;

/** Scope value meaning "every college" — only the University Super Admin may hold it. */
export const ALL_COLLEGES = "all";

/** Module groups a Super Admin can switch on/off per college. Core groups are always on. */
export const TOGGLEABLE_GROUPS = [
  "Career",
  "Communication & Skills",
  "Project & Innovation",
  "Campus Life",
  "Placement",
  "Incubation",
  "Admissions",
  "Recruiter",
] as const;

export const COLLEGE_ID_RE = /^COL-\d{4}$/;

export function isCollegeScope(value: unknown): value is string {
  return typeof value === "string" && (value === ALL_COLLEGES || COLLEGE_ID_RE.test(value));
}
