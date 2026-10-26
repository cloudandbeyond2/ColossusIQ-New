import "server-only";
import type { SessionPayload } from "@/lib/auth/session";
import {
  INCUBATION_STAGES,
  type CreateVentureInput,
  type IncubationPipelineOverview,
  type IncubationStage,
  type PipelineStageSummary,
  type PipelineVenture,
  type ReviewVentureInput,
} from "@/lib/api/incubation-schemas";
import { IncubationError, currentCohort, incubationAudit, incubationCollege, parseInr } from "./incubation-common";
import { incubationData } from "./incubation-data";

const STAGE_DESCRIPTIONS: Record<IncubationStage, string> = {
  Idea: "Idea submission, initial screening & problem statement verification",
  Validation: "Customer discovery, market analysis & pain-point interviews",
  "Business Model & MVP": "Unit economics, revenue architecture & MVP development",
  "Prototyping & Mentorship": "Functional prototype testing with assigned domain mentors",
  "Incubation Review": "Formal presentation before College Incubation & Innovation Panel",
  Incubated: "Admitted into campus incubator with seed grant and co-working support",
};

export async function getIncubationPipelineOverview(session: SessionPayload, selectedCohort?: string): Promise<IncubationPipelineOverview> {
  const college = await incubationCollege(session);
  const data = incubationData();
  const list = await data.ventures(college);

  // Cohorts come from the ventures themselves (newest venture first); the current year's cohort is always offered.
  const availableCohorts: string[] = [];
  for (const v of list) if (v.cohort && !availableCohorts.includes(v.cohort)) availableCohorts.push(v.cohort);
  const fallback = currentCohort();
  if (!availableCohorts.includes(fallback)) availableCohorts.push(fallback);

  const activeCohort = selectedCohort && availableCohorts.includes(selectedCohort) ? selectedCohort : (availableCohorts[0] ?? fallback);
  const cohortVentures = list.filter((v) => v.cohort === activeCohort);

  const stages: PipelineStageSummary[] = INCUBATION_STAGES.map((stg) => ({
    stage: stg,
    label: stg,
    count: cohortVentures.filter((v) => v.stage === stg).length,
    description: STAGE_DESCRIPTIONS[stg],
  }));

  // A mentor counts once, whether named on the venture or assigned in the Mentor Network.
  const ids = new Set(cohortVentures.map((v) => v.id));
  const mentorNames = new Set<string>();
  for (const v of cohortVentures) if (v.mentorName && v.mentorName !== "Unassigned") mentorNames.add(v.mentorName.toLowerCase());
  const assigned = (await data.assignments(college)).filter((a) => ids.has(a.ventureId));
  if (assigned.length) {
    const byId = new Map((await data.mentors(college)).map((m) => [m.id, m.name.toLowerCase()]));
    for (const a of assigned) {
      const n = byId.get(a.mentorId);
      if (n) mentorNames.add(n);
    }
  }

  const seedGrants = cohortVentures.reduce((acc, v) => acc + parseInr(v.grantAmount), 0);

  return {
    cohort: activeCohort,
    availableCohorts,
    totalVentures: cohortVentures.length,
    inReviewCount: cohortVentures.filter((v) => v.stage === "Incubation Review").length,
    incubatedCount: cohortVentures.filter((v) => v.stage === "Incubated").length,
    seedGrantsTotal: "₹" + seedGrants.toLocaleString("en-IN"),
    totalMentors: mentorNames.size,
    stages,
    ventures: cohortVentures,
  };
}

export async function createPipelineVenture(session: SessionPayload, input: CreateVentureInput): Promise<PipelineVenture> {
  const college = await incubationCollege(session);
  const data = incubationData();
  const name = input.name.trim();
  const cohort = input.cohort.trim() || currentCohort();
  if ((await data.ventures(college)).some((v) => v.cohort === cohort && v.name.toLowerCase() === name.toLowerCase())) {
    throw new IncubationError("This venture is already in that cohort's pipeline.", 409);
  }
  const created = await data.addVenture(college, {
    name,
    tagline: input.tagline.trim(),
    domain: input.domain,
    cohort,
    stage: input.stage,
    founders: input.founders.length ? input.founders : [input.leadFounder],
    leadFounder: input.leadFounder.trim(),
    leadEmail: input.leadEmail.trim().toLowerCase(),
    department: input.department.trim(),
    readinessScore: 0,
    mentorName: input.mentorName || "Unassigned",
    grantAmount: "—",
    pitchDeckUrl: input.pitchDeckUrl,
    demoUrl: input.demoUrl,
    reviewVerdict: "Pending Review",
    reviewNotes: "",
  });
  await incubationAudit(session, college, `Added ${created.name} to the incubation pipeline`, "incubation-pipeline");
  return created;
}

export async function updatePipelineVentureStage(session: SessionPayload, ventureId: string, stage: IncubationStage): Promise<PipelineVenture | null> {
  const college = await incubationCollege(session);
  const updated = await incubationData().saveVenture(college, ventureId, { stage });
  if (updated) await incubationAudit(session, college, `Moved ${updated.name} to ${stage}`, "incubation-pipeline");
  return updated ?? null;
}

export async function reviewPipelineVenture(session: SessionPayload, ventureId: string, review: ReviewVentureInput): Promise<PipelineVenture | null> {
  const college = await incubationCollege(session);
  const patch: Partial<PipelineVenture> = {
    reviewVerdict: review.verdict,
    reviewScore: Math.round(review.score),
    reviewNotes: review.notes,
    readinessScore: Math.round(review.score),
  };
  if (review.grantAmount) patch.grantAmount = review.grantAmount;
  if (review.mentorName) patch.mentorName = review.mentorName;
  if (review.verdict === "Approved for Incubation") patch.stage = "Incubated";
  const updated = await incubationData().saveVenture(college, ventureId, patch);
  if (updated) await incubationAudit(session, college, `Reviewed ${updated.name}: ${review.verdict}`, "incubation-pipeline");
  return updated ?? null;
}

export async function deletePipelineVenture(session: SessionPayload, ventureId: string): Promise<boolean> {
  const college = await incubationCollege(session);
  const data = incubationData();
  const v = await data.venture(college, ventureId);
  if (!v) return false;
  const removed = await data.removeVenture(college, ventureId);
  if (removed) await incubationAudit(session, college, `Removed ${v.name} from the incubation pipeline`, "incubation-pipeline");
  return removed;
}
