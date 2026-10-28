import "server-only";
import type { SessionPayload } from "@/lib/auth/session";
import { getStore } from "@/lib/data";
import { clinicalData, type ClinicalCase, type ClinicalSkill, type SkillLevel } from "./clinical-data";
import { resolveCollegeId } from "./early-warning";

export type { ClinicalCase, ClinicalSkill } from "./clinical-data";

export class ClinicalError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 = 400,
  ) {
    super(message);
  }
}

const STAFF = new Set(["faculty", "hod", "institution", "admin"]);
const isStaff = (s: SessionPayload) => STAFF.has(s.role);

function assertAllowed(s: SessionPayload) {
  if (s.role !== "student" && !isStaff(s)) throw new ClinicalError("Clinical rotations are not available for your role.", 403);
}

/** Staff see their whole college (the Super Admin sees every college); a student sees only their own entries. */
const scopeOf = (s: SessionPayload) => ({
  college: s.college === "all" ? null : s.college,
  student: s.role === "student" ? s.sub : undefined,
});

const clean = (v: unknown, label: string, min: number, max: number): string => {
  const t = typeof v === "string" ? v.trim() : "";
  if (t.length < min) throw new ClinicalError(`${label} is required.`);
  if (t.length > max) throw new ClinicalError(`${label} must be ${max} characters or fewer.`);
  return t;
};
const optional = (v: unknown, label: string, max: number): string => (typeof v === "string" && v.trim() ? clean(v, label, 0, max) : "");

async function audit(s: SessionPayload, college: string, action: string, target: string) {
  await getStore().audit.add({ actor: s.name, action, target, collegeId: college, actorSub: s.sub });
}

export async function listClinicalCases(s: SessionPayload): Promise<ClinicalCase[]> {
  assertAllowed(s);
  const { college, student } = scopeOf(s);
  return clinicalData().cases(college, student);
}

export async function createClinicalCase(s: SessionPayload, body: Record<string, unknown>): Promise<ClinicalCase> {
  assertAllowed(s);
  const college = await resolveCollegeId(s.college);
  const staff = isStaff(s);
  const created = await clinicalData().addCase(college, {
    studentSub: s.sub,
    studentName: clean(s.name || "Student", "Name", 1, 120),
    bed: optional(body.bed, "Bed", 40),
    patient: clean(body.patient ?? body.name, "Patient name", 2, 120),
    diagnosis: clean(body.diagnosis, "Diagnosis", 2, 200),
    complaints: optional(body.complaints, "Complaints", 1000),
    faculty: optional(body.faculty, "Supervising faculty", 120),
    // A case logged by a doctor is verified by that doctor.
    status: staff ? "Approved" : "Pending",
    verifiedBy: staff ? s.name : "",
  });
  await audit(s, college, "Logged clinical case", created.patient);
  return created;
}

export async function decideClinicalCase(s: SessionPayload, id: unknown, decision: "Approved" | "Rejected"): Promise<ClinicalCase> {
  assertAllowed(s);
  if (!isStaff(s)) throw new ClinicalError("Only faculty can verify a case.", 403);
  const { college } = scopeOf(s);
  const row = await clinicalData().decideCase(college, String(id ?? ""), decision, s.name || "Faculty");
  if (!row) throw new ClinicalError("Case not found.", 404);
  await audit(s, college ?? "all", `${decision === "Approved" ? "Approved" : "Rejected"} clinical case`, row.patient);
  return row;
}

export async function listDopsSkills(s: SessionPayload): Promise<ClinicalSkill[]> {
  assertAllowed(s);
  const { college, student } = scopeOf(s);
  return clinicalData().skills(college, student);
}

export async function submitDopsSkill(s: SessionPayload, body: Record<string, unknown>): Promise<ClinicalSkill> {
  assertAllowed(s);
  if (s.role !== "student") throw new ClinicalError("Only students submit DOPS skills for sign-off.", 403);
  const college = await resolveCollegeId(s.college);
  const level = body.level === "Performs" ? "Performs" : body.level === "Shows How" ? "Shows How" : undefined;
  if (!level) throw new ClinicalError("Choose the competency level.");
  const created = await clinicalData().addSkill(college, {
    studentSub: s.sub,
    studentName: clean(s.name || "Student", "Name", 1, 120),
    code: clean(body.code, "NMC code", 2, 20),
    name: clean(body.name, "Procedure", 3, 200),
    level: level as SkillLevel,
    notes: optional(body.notes, "Notes", 2000),
    supervisor: clean(body.supervisor, "Observing doctor", 2, 120),
  });
  await audit(s, college, "Submitted DOPS skill", `${created.code} ${created.name}`);
  return created;
}

export async function decideDopsSkill(s: SessionPayload, id: unknown, decision: "Certified" | "Rejected"): Promise<ClinicalSkill> {
  assertAllowed(s);
  if (!isStaff(s)) throw new ClinicalError("Only faculty can sign off a DOPS skill.", 403);
  const { college } = scopeOf(s);
  const row = await clinicalData().decideSkill(college, String(id ?? ""), decision, s.name || "Faculty");
  if (!row) throw new ClinicalError("Skill submission not found.", 404);
  await audit(s, college ?? "all", `${decision === "Certified" ? "Certified" : "Rejected"} DOPS skill`, `${row.code} ${row.studentName}`);
  return row;
}
