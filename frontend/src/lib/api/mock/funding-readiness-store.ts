import "server-only";
import type { SessionPayload } from "@/lib/auth/session";
import {
  type DiligenceCheckItem,
  type FundingReadinessOverview,
  type ReadinessTier,
  type ScoreDimension,
  type UpdateReadinessInput,
  type VentureFundingReadiness,
} from "@/lib/api/funding-readiness-schemas";
import type { StartupItem } from "@/lib/api/startup-schemas";
import { IncubationError, formatInr, incubationAudit, incubationCollege, parseInr } from "./incubation-common";
import { incubationData, type StoredEvaluation } from "./incubation-data";

/*
 * Funding readiness is an evaluation of a startup in the portfolio. Until an evaluator scores it, every dimension is 0 and
 * nothing is verified; the startup is listed but does not count in the averages.
 */

const DIMENSIONS: Omit<ScoreDimension, "score" | "status">[] = [
  { id: "team", name: "Team & Execution", description: "Founder chemistry, technical capability, and execution velocity", benchmark: 75, weight: 1 },
  { id: "problem", name: "Problem Validation", description: "Customer discovery, pain-point urgency, and total addressable market", benchmark: 75, weight: 1 },
  { id: "product", name: "Product & Tech Maturity", description: "Functional MVP, product durability, and technical reliability", benchmark: 70, weight: 1 },
  { id: "traction", name: "Traction & Commercial Pilots", description: "Active pilot agreements, field trial outcomes, and user retention", benchmark: 65, weight: 1 },
  { id: "businessModel", name: "Unit Economics & Business Model", description: "Gross margins, cost of delivery, and revenue model", benchmark: 70, weight: 1 },
  { id: "pitch", name: "Pitch & Diligence Readiness", description: "Narrative clarity, financial model defensibility, and data room", benchmark: 75, weight: 1 },
];

const DILIGENCE: Omit<DiligenceCheckItem, "verified" | "notes">[] = [
  { id: "dil-corp", title: "DPIIT Recognized Incorporation & CIN", category: "Legal & Corporate" },
  { id: "dil-ip", title: "Patent / IP Filing Documentation", category: "Product & IP" },
  { id: "dil-fin", title: "3-Year Pro-Forma Financial Model", category: "Financials" },
  { id: "dil-cust", title: "Signed Commercial Pilot MOUs", category: "Commercial Traction" },
];

function computeTier(score: number): ReadinessTier {
  if (score >= 90) return "Institutional VC Ready";
  if (score >= 75) return "Angel / Pre-Series A Ready";
  if (score >= 60) return "Incubation Seed Ready";
  return "Early Stage / Grant Ready";
}

function computeDimensionStatus(score: number, benchmark: number): ScoreDimension["status"] {
  if (score > benchmark + 5) return "Exceeds Benchmark";
  if (score < benchmark - 5) return "Below Benchmark";
  return "On Target";
}

const blank = (): StoredEvaluation => ({
  fundingTarget: "Not set",
  dimensions: DIMENSIONS.map((d) => ({ id: d.id, score: 0 })),
  strengths: [],
  investorGaps: [],
  actionPlan: [],
  diligence: DILIGENCE.map((d) => ({ id: d.id, verified: false, notes: "" })),
  evaluatorNotes: "",
  lastEvaluatedAt: "",
});

const scoreOf = (ev: StoredEvaluation) => Math.round(ev.dimensions.reduce((a, d) => a + d.score, 0) / ev.dimensions.length);

function view(s: StartupItem, stored: StoredEvaluation | undefined): VentureFundingReadiness {
  const ev = stored ?? blank();
  const score = stored ? scoreOf(ev) : 0;
  return {
    ventureId: s.id,
    ventureName: s.name,
    domain: s.domain,
    stage: s.stage,
    leadFounder: s.leadFounder,
    department: s.department,
    fundingTarget: ev.fundingTarget,
    currentFunding: s.fundingRaised,
    readinessScore: score,
    readinessTier: computeTier(score),
    dimensions: DIMENSIONS.map((d) => {
      const got = ev.dimensions.find((x) => x.id === d.id)?.score ?? 0;
      return { ...d, score: got, status: computeDimensionStatus(got, d.benchmark) };
    }),
    strengths: ev.strengths,
    investorGaps: ev.investorGaps,
    actionPlan: ev.actionPlan,
    diligenceChecklist: DILIGENCE.map((d) => {
      const got = ev.diligence.find((x) => x.id === d.id);
      return { ...d, verified: got?.verified ?? false, notes: got?.notes ?? "" };
    }),
    lastEvaluatedAt: ev.lastEvaluatedAt,
    evaluatorNotes: ev.evaluatorNotes,
  };
}

export async function getFundingReadinessOverview(session: SessionPayload, selectedVentureId?: string): Promise<FundingReadinessOverview> {
  const college = await incubationCollege(session);
  const data = incubationData();
  const [startups, evals] = await Promise.all([data.startups(college), data.evaluations(college)]);

  const views = startups.map((s) => view(s, evals[s.id]));
  const evaluated = views.filter((v) => evals[v.ventureId]);
  const current = views.find((v) => v.ventureId === selectedVentureId) ?? views[0] ?? null;

  return {
    averageReadinessScore: evaluated.length ? Math.round(evaluated.reduce((a, v) => a + v.readinessScore, 0) / evaluated.length) : 0,
    angelReadyCount: evaluated.filter((v) => v.readinessTier === "Angel / Pre-Series A Ready" || v.readinessTier === "Institutional VC Ready").length,
    totalFundingTarget: formatInr(evaluated.reduce((a, v) => a + parseInr(v.fundingTarget), 0)),
    criticalGapsCount: evaluated.reduce((a, v) => a + v.investorGaps.length, 0),
    selectedVentureId: current?.ventureId ?? "",
    allVentures: views.map((v) => ({
      ventureId: v.ventureId,
      ventureName: v.ventureName,
      domain: v.domain,
      stage: v.stage,
      readinessScore: v.readinessScore,
      readinessTier: v.readinessTier,
    })),
    currentEvaluation: current,
  };
}

export async function updateVentureReadiness(session: SessionPayload, ventureId: string, input: UpdateReadinessInput): Promise<VentureFundingReadiness | null> {
  const college = await incubationCollege(session);
  const data = incubationData();
  const startup = await data.startup(college, ventureId);
  if (!startup) return null;
  const ev = structuredClone((await data.evaluations(college))[ventureId] ?? blank());

  for (const d of input.dimensions ?? []) {
    const dim = ev.dimensions.find((x) => x.id === d.id);
    if (!dim) throw new IncubationError(`Unknown readiness dimension "${d.id}".`);
    dim.score = Math.round(d.score);
  }
  for (const c of input.diligenceChecklist ?? []) {
    const item = ev.diligence.find((x) => x.id === c.id);
    if (!item) throw new IncubationError(`Unknown diligence item "${c.id}".`);
    item.verified = c.verified;
    if (c.notes !== undefined) item.notes = c.notes.trim().slice(0, 500);
  }
  const clean = (list: string[]) => list.map((x) => x.trim()).filter(Boolean).slice(0, 20);
  if (input.fundingTarget !== undefined) ev.fundingTarget = input.fundingTarget.trim().slice(0, 160) || "Not set";
  if (input.strengths !== undefined) ev.strengths = clean(input.strengths);
  if (input.investorGaps !== undefined) ev.investorGaps = clean(input.investorGaps);
  if (input.actionPlan !== undefined) ev.actionPlan = clean(input.actionPlan);
  if (input.evaluatorNotes !== undefined) ev.evaluatorNotes = input.evaluatorNotes.trim().slice(0, 1500);
  ev.lastEvaluatedAt = new Date().toISOString();

  const score = scoreOf(ev);
  if (!(await data.saveEvaluation(college, ventureId, ev, score))) return null;
  await incubationAudit(session, college, `Updated funding readiness for ${startup.name}`, "funding-readiness");
  return view({ ...startup, readinessScore: score }, ev);
}
