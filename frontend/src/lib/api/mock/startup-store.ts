import "server-only";
import type { SessionPayload } from "@/lib/auth/session";
import {
  type CreateStartupInput,
  type StartupItem,
  type StartupPortfolioOverview,
  type UpdateStartupInput,
} from "@/lib/api/startup-schemas";
import { IncubationError, currentCohort, formatInr, incubationAudit, incubationCollege, parseInr } from "./incubation-common";
import { incubationData } from "./incubation-data";

export async function getStartupPortfolioOverview(session: SessionPayload): Promise<StartupPortfolioOverview> {
  const college = await incubationCollege(session);
  const list = await incubationData().startups(college);

  return {
    totalStartups: list.length,
    dpiitRecognizedCount: list.filter((s) => s.incorporationStatus === "DPIIT Recognized" || s.registrationNumber.startsWith("DPIIT")).length,
    totalFundingMobilized: formatInr(list.reduce((acc, s) => acc + parseInr(s.fundingRaised), 0)),
    activeCommercialPilots: list.reduce((acc, s) => acc + (s.activePilotsCount || 0), 0),
    patentsCount: list.filter((s) => s.patentStatus !== "Not Applicable").length,
    startups: list,
  };
}

export async function createStartup(session: SessionPayload, input: CreateStartupInput): Promise<StartupItem> {
  const college = await incubationCollege(session);
  const data = incubationData();
  const name = input.name.trim();
  if ((await data.startups(college)).some((s) => s.name.toLowerCase() === name.toLowerCase())) {
    throw new IncubationError("A startup with this name is already in the portfolio.", 409);
  }
  const created = await data.addStartup(college, {
    name,
    tagline: input.tagline.trim(),
    registrationNumber: input.registrationNumber || "Incorporation in progress",
    domain: input.domain,
    incorporationStatus: input.incorporationStatus,
    stage: input.stage,
    founders: input.founders.length > 0 ? input.founders : [{ name: input.leadFounder, role: "Lead Founder", email: input.leadEmail }],
    leadFounder: input.leadFounder.trim(),
    leadEmail: input.leadEmail.trim().toLowerCase(),
    department: input.department.trim(),
    cohort: input.cohort.trim() || currentCohort(),
    assignedMentor: input.assignedMentor || "Unassigned",
    readinessScore: Math.min(100, Math.max(0, Math.round(input.readinessScore))),
    fundingRaised: input.fundingRaised || "Bootstrapped",
    revenue: input.revenue || "Pre-revenue",
    activePilotsCount: Math.max(0, Math.round(input.activePilotsCount)),
    patentStatus: input.patentStatus,
    websiteUrl: input.websiteUrl,
    pitchDeckUrl: input.pitchDeckUrl,
    demoUrl: input.demoUrl,
    status: "Active",
  });
  await incubationAudit(session, college, `Added startup ${created.name}`, "startups");
  return created;
}

export async function updateStartup(session: SessionPayload, id: string, input: UpdateStartupInput): Promise<StartupItem | null> {
  const college = await incubationCollege(session);
  const patch: Partial<StartupItem> = {};
  if (input.stage !== undefined) patch.stage = input.stage;
  if (input.incorporationStatus !== undefined) patch.incorporationStatus = input.incorporationStatus;
  if (input.assignedMentor !== undefined) patch.assignedMentor = input.assignedMentor;
  if (input.readinessScore !== undefined) patch.readinessScore = Math.min(100, Math.max(0, Math.round(input.readinessScore)));
  if (input.fundingRaised !== undefined) patch.fundingRaised = input.fundingRaised;
  if (input.revenue !== undefined) patch.revenue = input.revenue;
  if (input.activePilotsCount !== undefined) patch.activePilotsCount = Math.max(0, Math.round(input.activePilotsCount));
  if (input.patentStatus !== undefined) patch.patentStatus = input.patentStatus;
  if (input.status !== undefined) patch.status = input.status;
  const updated = await incubationData().saveStartup(college, id, patch);
  if (updated) await incubationAudit(session, college, `Updated startup ${updated.name}`, "startups");
  return updated ?? null;
}

export async function deleteStartup(session: SessionPayload, id: string): Promise<boolean> {
  const college = await incubationCollege(session);
  const data = incubationData();
  const s = await data.startup(college, id);
  if (!s) return false;
  const removed = await data.removeStartup(college, id);
  if (removed) await incubationAudit(session, college, `Removed startup ${s.name}`, "startups");
  return removed;
}
