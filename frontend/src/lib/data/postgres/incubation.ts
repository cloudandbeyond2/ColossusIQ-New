import "server-only";
import type { IncubationData, MentorRec, StoredEvaluation } from "@/lib/api/mock/incubation-data";
import type { PipelineVenture } from "@/lib/api/incubation-schemas";
import type { StartupItem } from "@/lib/api/startup-schemas";
import { db, isUuid } from "./db";
import { collegeUuid } from "./lookups";

/*
 * Incubation cell on PostgreSQL (prisma/migrations/20261104000000_incubation). Row-level security keeps each college
 * to its own rows. Plain SQL, so it works before `prisma generate` is re-run.
 */

const q = <T>(sql: string, ...args: unknown[]) => db().$queryRawUnsafe<T[]>(sql, ...args);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

const iso = (v: unknown) => (v instanceof Date ? v : new Date(String(v))).toISOString();

/** Builds `UPDATE ... SET col=$n` for the keys present in `patch`; returns undefined when there is nothing to set. */
function setClause(patch: Record<string, unknown>, cols: Record<string, string>, first: number, casts: Record<string, string> = {}) {
  const parts: string[] = [];
  const args: unknown[] = [];
  for (const [k, col] of Object.entries(cols)) {
    if (patch[k] === undefined) continue;
    args.push(patch[k]);
    parts.push(`${col} = $${first + args.length - 1}${casts[k] ?? ""}`);
  }
  return parts.length ? { sql: parts.join(", "), args } : undefined;
}

/* ── ventures ── */
const VEN = `id, name, tagline, domain, cohort, stage, founders, lead_founder as "leadFounder", lead_email as "leadEmail", department,
  readiness_score as "readinessScore", mentor_name as "mentorName", grant_amount as "grantAmount", pitch_deck_url as "pitchDeckUrl",
  demo_url as "demoUrl", review_verdict as "reviewVerdict", review_score as "reviewScore", review_notes as "reviewNotes",
  submitted_at as "submittedAt", updated_at as "updatedAt"`;
const VEN_COLS: Record<string, string> = {
  name: "name", tagline: "tagline", domain: "domain", cohort: "cohort", stage: "stage", founders: "founders", leadFounder: "lead_founder",
  leadEmail: "lead_email", department: "department", readinessScore: "readiness_score", mentorName: "mentor_name",
  grantAmount: "grant_amount", pitchDeckUrl: "pitch_deck_url", demoUrl: "demo_url", reviewVerdict: "review_verdict",
  reviewScore: "review_score", reviewNotes: "review_notes",
};
const VEN_CASTS = { founders: "::text[]", readinessScore: "::int", reviewScore: "::int" };

const toVenture = (r: Raw): PipelineVenture => ({
  id: r.id, name: r.name, tagline: r.tagline, domain: r.domain, cohort: r.cohort, stage: r.stage, founders: r.founders,
  leadFounder: r.leadFounder, leadEmail: r.leadEmail, department: r.department, readinessScore: Number(r.readinessScore),
  mentorName: r.mentorName, grantAmount: r.grantAmount, pitchDeckUrl: r.pitchDeckUrl, demoUrl: r.demoUrl,
  reviewVerdict: r.reviewVerdict, reviewNotes: r.reviewNotes, ...(r.reviewScore === null ? {} : { reviewScore: Number(r.reviewScore) }),
  submittedAt: iso(r.submittedAt), updatedAt: iso(r.updatedAt),
});

/* ── startups ── */
const STU = `id, name, tagline, registration_number as "registrationNumber", domain, incorporation_status as "incorporationStatus", stage,
  founders, lead_founder as "leadFounder", lead_email as "leadEmail", department, cohort, assigned_mentor as "assignedMentor",
  readiness_score as "readinessScore", funding_raised as "fundingRaised", revenue, active_pilots as "activePilotsCount",
  patent_status as "patentStatus", website_url as "websiteUrl", pitch_deck_url as "pitchDeckUrl", demo_url as "demoUrl", status,
  incubated_at as "campusIncubatedAt"`;
const STU_COLS: Record<string, string> = {
  name: "name", tagline: "tagline", registrationNumber: "registration_number", domain: "domain", incorporationStatus: "incorporation_status",
  stage: "stage", founders: "founders", leadFounder: "lead_founder", leadEmail: "lead_email", department: "department", cohort: "cohort",
  assignedMentor: "assigned_mentor", readinessScore: "readiness_score", fundingRaised: "funding_raised", revenue: "revenue",
  activePilotsCount: "active_pilots", patentStatus: "patent_status", websiteUrl: "website_url", pitchDeckUrl: "pitch_deck_url",
  demoUrl: "demo_url", status: "status",
};
const STU_CASTS = { founders: "::jsonb", readinessScore: "::int", activePilotsCount: "::int" };

const toStartup = (r: Raw): StartupItem => ({
  id: r.id, name: r.name, tagline: r.tagline, registrationNumber: r.registrationNumber, domain: r.domain,
  incorporationStatus: r.incorporationStatus, stage: r.stage, founders: r.founders, leadFounder: r.leadFounder, leadEmail: r.leadEmail,
  department: r.department, cohort: r.cohort, assignedMentor: r.assignedMentor, readinessScore: Number(r.readinessScore),
  fundingRaised: r.fundingRaised, revenue: r.revenue, activePilotsCount: Number(r.activePilotsCount), patentStatus: r.patentStatus,
  websiteUrl: r.websiteUrl, pitchDeckUrl: r.pitchDeckUrl, demoUrl: r.demoUrl, campusIncubatedAt: iso(r.campusIncubatedAt), status: r.status,
});

/* ── mentors ── */
const MEN = `id, name, designation, company, type, expertise, email, phone, linkedin_url as "linkedinUrl", availability, status, joined_at as "joinedDate"`;
const MEN_COLS: Record<string, string> = {
  name: "name", designation: "designation", company: "company", type: "type", expertise: "expertise", email: "email", phone: "phone",
  linkedinUrl: "linkedin_url", availability: "availability", status: "status",
};
const toMentor = (r: Raw): MentorRec => ({
  id: r.id, name: r.name, designation: r.designation, company: r.company, type: r.type, expertise: r.expertise, email: r.email,
  phone: r.phone, linkedinUrl: r.linkedinUrl, availability: r.availability, status: r.status, joinedDate: iso(r.joinedDate),
});

const needCollege = async (college: string) => {
  const cid = await collegeUuid(college);
  if (!cid) throw new Error("College not found");
  return cid;
};

async function patchRow<T>(table: string, returning: string, college: string, id: string, patch: Record<string, unknown>, cols: Record<string, string>, casts: Record<string, string>, map: (r: Raw) => T, extra = ""): Promise<T | undefined> {
  if (!isUuid(id)) return undefined;
  const cid = await collegeUuid(college);
  if (!cid) return undefined;
  const set = setClause(patch, cols, 3, casts);
  const sql = set
    ? `UPDATE ${table} SET ${set.sql}${extra} WHERE id = $1::uuid AND college_id = $2::uuid RETURNING ${returning};`
    : `SELECT ${returning} FROM ${table} WHERE id = $1::uuid AND college_id = $2::uuid;`;
  const rows = await q<Raw>(sql, id, cid, ...(set?.args ?? []));
  return rows[0] ? map(rows[0]) : undefined;
}

async function removeRow(table: string, college: string, id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  const cid = await collegeUuid(college);
  if (!cid) return false;
  return (await q<Raw>(`DELETE FROM ${table} WHERE id = $1::uuid AND college_id = $2::uuid RETURNING id;`, id, cid)).length > 0;
}

export const postgresIncubation: IncubationData = {
  async ventures(college) {
    const cid = await collegeUuid(college);
    if (!cid) return [];
    return (await q<Raw>(`SELECT ${VEN} FROM incubation_ventures WHERE college_id = $1::uuid ORDER BY submitted_at DESC;`, cid)).map(toVenture);
  },
  async venture(college, id) {
    if (!isUuid(id)) return undefined;
    const cid = await collegeUuid(college);
    if (!cid) return undefined;
    const r = (await q<Raw>(`SELECT ${VEN} FROM incubation_ventures WHERE id = $1::uuid AND college_id = $2::uuid;`, id, cid))[0];
    return r ? toVenture(r) : undefined;
  },
  async addVenture(college, v) {
    const cid = await needCollege(college);
    const r = (
      await q<Raw>(
        `INSERT INTO incubation_ventures (college_id, name, tagline, domain, cohort, stage, founders, lead_founder, lead_email, department,
           readiness_score, mentor_name, grant_amount, pitch_deck_url, demo_url, review_verdict, review_score, review_notes)
         VALUES ($1::uuid,$2,$3,$4,$5,$6,$7::text[],$8,$9,$10,$11::int,$12,$13,$14,$15,$16,$17::int,$18) RETURNING ${VEN};`,
        cid, v.name, v.tagline, v.domain, v.cohort, v.stage, v.founders, v.leadFounder, v.leadEmail, v.department, v.readinessScore,
        v.mentorName, v.grantAmount, v.pitchDeckUrl, v.demoUrl, v.reviewVerdict ?? "Pending Review", v.reviewScore ?? null, v.reviewNotes ?? ""
      )
    )[0];
    if (!r) throw new Error("Venture was not saved");
    return toVenture(r);
  },
  saveVenture: (college, id, patch) => patchRow("incubation_ventures", VEN, college, id, patch, VEN_COLS, VEN_CASTS, toVenture, ", updated_at = now()"),
  removeVenture: (college, id) => removeRow("incubation_ventures", college, id),

  async startups(college) {
    const cid = await collegeUuid(college);
    if (!cid) return [];
    return (await q<Raw>(`SELECT ${STU} FROM incubation_startups WHERE college_id = $1::uuid ORDER BY incubated_at DESC;`, cid)).map(toStartup);
  },
  async startup(college, id) {
    if (!isUuid(id)) return undefined;
    const cid = await collegeUuid(college);
    if (!cid) return undefined;
    const r = (await q<Raw>(`SELECT ${STU} FROM incubation_startups WHERE id = $1::uuid AND college_id = $2::uuid;`, id, cid))[0];
    return r ? toStartup(r) : undefined;
  },
  async addStartup(college, s) {
    const cid = await needCollege(college);
    const r = (
      await q<Raw>(
        `INSERT INTO incubation_startups (college_id, name, tagline, registration_number, domain, incorporation_status, stage, founders,
           lead_founder, lead_email, department, cohort, assigned_mentor, readiness_score, funding_raised, revenue, active_pilots,
           patent_status, website_url, pitch_deck_url, demo_url, status)
         VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14::int,$15,$16,$17::int,$18,$19,$20,$21,$22) RETURNING ${STU};`,
        cid, s.name, s.tagline, s.registrationNumber, s.domain, s.incorporationStatus, s.stage, JSON.stringify(s.founders), s.leadFounder,
        s.leadEmail, s.department, s.cohort, s.assignedMentor, s.readinessScore, s.fundingRaised, s.revenue, s.activePilotsCount,
        s.patentStatus, s.websiteUrl, s.pitchDeckUrl, s.demoUrl, s.status
      )
    )[0];
    if (!r) throw new Error("Startup was not saved");
    return toStartup(r);
  },
  saveStartup: (college, id, patch) => {
    const p: Record<string, unknown> = { ...patch };
    if (patch.founders) p.founders = JSON.stringify(patch.founders);
    return patchRow("incubation_startups", STU, college, id, p, STU_COLS, STU_CASTS, toStartup, ", updated_at = now()");
  },
  removeStartup: (college, id) => removeRow("incubation_startups", college, id),
  async evaluations(college) {
    const cid = await collegeUuid(college);
    if (!cid) return {};
    const rows = await q<Raw>(`SELECT id, evaluation FROM incubation_startups WHERE college_id = $1::uuid AND evaluation IS NOT NULL;`, cid);
    return Object.fromEntries(rows.map((r) => [r.id, r.evaluation as StoredEvaluation]));
  },
  async saveEvaluation(college, startupId, ev, score) {
    if (!isUuid(startupId)) return false;
    const cid = await collegeUuid(college);
    if (!cid) return false;
    const rows = await q<Raw>(
      `UPDATE incubation_startups SET evaluation = $3::jsonb, readiness_score = $4::int, updated_at = now()
       WHERE id = $1::uuid AND college_id = $2::uuid RETURNING id;`,
      startupId, cid, JSON.stringify(ev), score
    );
    return rows.length > 0;
  },

  async mentors(college) {
    const cid = await collegeUuid(college);
    if (!cid) return [];
    return (await q<Raw>(`SELECT ${MEN} FROM incubation_mentors WHERE college_id = $1::uuid ORDER BY joined_at DESC;`, cid)).map(toMentor);
  },
  async mentor(college, id) {
    if (!isUuid(id)) return undefined;
    const cid = await collegeUuid(college);
    if (!cid) return undefined;
    const r = (await q<Raw>(`SELECT ${MEN} FROM incubation_mentors WHERE id = $1::uuid AND college_id = $2::uuid;`, id, cid))[0];
    return r ? toMentor(r) : undefined;
  },
  async addMentor(college, m) {
    const cid = await needCollege(college);
    const r = (
      await q<Raw>(
        `INSERT INTO incubation_mentors (college_id, name, designation, company, type, expertise, email, phone, linkedin_url, availability, status)
         VALUES ($1::uuid,$2,$3,$4,$5,$6::text[],$7,$8,$9,$10,$11) RETURNING ${MEN};`,
        cid, m.name, m.designation, m.company, m.type, m.expertise, m.email, m.phone, m.linkedinUrl, m.availability, m.status
      )
    )[0];
    if (!r) throw new Error("Mentor was not saved");
    return toMentor(r);
  },
  saveMentor: (college, id, patch) => patchRow("incubation_mentors", MEN, college, id, patch, MEN_COLS, { expertise: "::text[]" }, toMentor),
  removeMentor: (college, id) => removeRow("incubation_mentors", college, id),
  async assignments(college) {
    const cid = await collegeUuid(college);
    if (!cid) return [];
    return q<{ mentorId: string; ventureId: string }>(
      `SELECT mentor_id as "mentorId", venture_id as "ventureId" FROM incubation_mentor_assignments WHERE college_id = $1::uuid ORDER BY created_at;`,
      cid
    );
  },
  async assign(college, mentorId, ventureId) {
    const cid = await needCollege(college);
    await q(
      `INSERT INTO incubation_mentor_assignments (college_id, mentor_id, venture_id) VALUES ($1::uuid, $2::uuid, $3::uuid) ON CONFLICT (mentor_id, venture_id) DO NOTHING;`,
      cid, mentorId, ventureId
    );
  },
  async unassign(college, mentorId, ventureId) {
    if (!isUuid(mentorId) || !isUuid(ventureId)) return;
    const cid = await needCollege(college);
    await q(`DELETE FROM incubation_mentor_assignments WHERE college_id = $1::uuid AND mentor_id = $2::uuid AND venture_id = $3::uuid;`, cid, mentorId, ventureId);
  },
  async sessionCounts(college) {
    const cid = await collegeUuid(college);
    if (!cid) return {};
    const rows = await q<Raw>(`SELECT mentor_id as "mentorId", count(*)::int as n FROM incubation_mentor_sessions WHERE college_id = $1::uuid GROUP BY mentor_id;`, cid);
    return Object.fromEntries(rows.map((r) => [r.mentorId, Number(r.n)]));
  },
  async addSession(college, mentorId, d) {
    const cid = await needCollege(college);
    await q(
      `INSERT INTO incubation_mentor_sessions (college_id, mentor_id, venture_name, topic, notes, duration_minutes, logged_by_sub)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::int, $7);`,
      cid, mentorId, d.ventureName, d.topic, d.notes, d.durationMinutes, d.loggedBySub
    );
  },
};
