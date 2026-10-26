import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { dispatch } from "@/lib/api/mock/router";
import { resetIncubationMemory } from "@/lib/api/mock/incubation-data";
import type { SessionPayload } from "@/lib/auth/session";
import type { FundingReadinessOverview, VentureFundingReadiness } from "@/lib/api/funding-readiness-schemas";
import type { IncubationPipelineOverview, PipelineVenture } from "@/lib/api/incubation-schemas";
import type { MentorItem, MentorNetworkOverview } from "@/lib/api/mentor-network-schemas";
import type { StartupItem, StartupPortfolioOverview } from "@/lib/api/startup-schemas";

const base: SessionPayload = { sub: "inc-1", role: "incubation", name: "Incubation Head", tenant: "TNTU", college: "COL-1001", mfa: true, exp: 9999999999 };
const who = (role: SessionPayload["role"] = "incubation", college = "COL-1001"): SessionPayload => ({ ...base, role, college });

const call = (s: SessionPayload, method: string, path: string, body?: unknown, q = new URLSearchParams()) =>
  dispatch(method, path.split("/"), body === undefined ? undefined : JSON.stringify(body), s, q);

const startupDraft = (over: Record<string, unknown> = {}) => ({
  name: "SolarClean",
  tagline: "Water-free robotic panel cleaning",
  domain: "CleanTech & IoT",
  leadFounder: "Pooja V",
  leadEmail: "pooja@example.edu",
  department: "Electrical Engineering",
  fundingRaised: "₹5,00,000 (Seed)",
  ...over,
});
const ventureDraft = (over: Record<string, unknown> = {}) => ({
  name: "AgriSense",
  tagline: "Soil telemetry for farmers",
  domain: "AgriTech",
  cohort: "2026 Innovation Cohort",
  leadFounder: "Anand K",
  leadEmail: "anand@example.edu",
  department: "Computer Science",
  ...over,
});
const mentorDraft = (over: Record<string, unknown> = {}) => ({
  name: "Dr Meena",
  designation: "Professor",
  company: "Anna Institute",
  type: "Faculty Specialist",
  expertise: ["IoT"],
  email: "meena@example.edu",
  ...over,
});

beforeEach(() => resetIncubationMemory());

describe("Incubation cell starts empty", () => {
  it("shows no invented ventures, mentors or startups", async () => {
    const s = who();
    const pipe = (await call(s, "GET", "incubation-pipeline")).body as IncubationPipelineOverview;
    expect(pipe.ventures).toHaveLength(0);
    expect(pipe.totalMentors).toBe(0);
    expect(pipe.availableCohorts.length).toBeGreaterThan(0);
    const men = (await call(s, "GET", "incubation/mentors")).body as MentorNetworkOverview;
    expect(men.mentors).toHaveLength(0);
    expect(men.averageRating).toBeNull();
    const stu = (await call(s, "GET", "incubation/startups")).body as StartupPortfolioOverview;
    expect(stu.startups).toHaveLength(0);
    expect(stu.totalFundingMobilized).toBe("₹0");
    const fr = (await call(s, "GET", "incubation/funding-readiness")).body as FundingReadinessOverview;
    expect(fr.currentEvaluation).toBeNull();
    expect(fr.allVentures).toHaveLength(0);
  });

  it("is limited to the incubation head, institution and admin", async () => {
    for (const path of ["incubation-pipeline", "incubation/mentors", "incubation/startups", "incubation/funding-readiness"]) {
      expect((await call(who("student"), "GET", path)).status).toBe(403);
      expect((await call(who("admin", "all"), "GET", path)).status).toBe(200);
    }
  });

  it("keeps each college's records apart", async () => {
    await call(who(), "POST", "incubation/startups", startupDraft());
    const other = (await call(who("incubation", "COL-1002"), "GET", "incubation/startups")).body as StartupPortfolioOverview;
    expect(other.startups).toHaveLength(0);
  });
});

describe("Incubation pipeline", () => {
  it("adds, moves, reviews and removes a venture, and totals come from the data", async () => {
    const s = who();
    const created = (await call(s, "POST", "incubation-pipeline/ventures", ventureDraft())).body as PipelineVenture;
    expect(created.stage).toBe("Idea");
    expect(created.readinessScore).toBe(0);
    expect((await call(s, "POST", "incubation-pipeline/ventures", ventureDraft({ name: "agrisense" }))).status).toBe(409);

    const moved = (await call(s, "PATCH", `incubation-pipeline/ventures/${created.id}/stage`, { stage: "Validation" })).body as PipelineVenture;
    expect(moved.stage).toBe("Validation");
    expect(moved.readinessScore).toBe(0);

    const reviewed = (await call(s, "POST", `incubation-pipeline/ventures/${created.id}/review`, {
      verdict: "Approved for Incubation", score: 91, notes: "Strong", grantAmount: "₹2,50,000 (Seed Grant)",
    })).body as PipelineVenture;
    expect(reviewed.stage).toBe("Incubated");
    expect(reviewed.readinessScore).toBe(91);

    const ov = (await call(s, "GET", "incubation-pipeline", undefined, new URLSearchParams({ cohort: "2026 Innovation Cohort" }))).body as IncubationPipelineOverview;
    expect(ov.incubatedCount).toBe(1);
    expect(ov.seedGrantsTotal).toBe("₹2,50,000");

    expect((await call(s, "DELETE", `incubation-pipeline/ventures/${created.id}`)).status).toBe(200);
    expect((await call(s, "DELETE", `incubation-pipeline/ventures/${created.id}`)).status).toBe(404);
  });
});

describe("Mentor network", () => {
  it("invites, assigns to a real venture, logs sessions and removes", async () => {
    const s = who();
    const v = (await call(s, "POST", "incubation-pipeline/ventures", ventureDraft())).body as PipelineVenture;
    const m = (await call(s, "POST", "incubation/mentors", mentorDraft())).body as MentorItem;
    expect(m.rating).toBeNull();
    expect((await call(s, "POST", "incubation/mentors", mentorDraft({ email: "MEENA@example.edu" }))).status).toBe(409);

    expect((await call(s, "POST", `incubation/mentors/${m.id}/assign`, { ventureId: "nope", ventureName: "x" })).status).toBe(404);
    const assigned = (await call(s, "POST", `incubation/mentors/${m.id}/assign`, { ventureId: v.id, ventureName: "ignored", stage: "Idea" })).body as MentorItem;
    expect(assigned.assignedVentures).toEqual([{ ventureId: v.id, ventureName: "AgriSense", stage: "Idea" }]);

    // stage changes in the pipeline show on the mentor
    await call(s, "PATCH", `incubation-pipeline/ventures/${v.id}/stage`, { stage: "Validation" });
    const logged = (await call(s, "POST", `incubation/mentors/${m.id}/session`, { ventureName: "AgriSense", topic: "Pricing", notes: "Discussed tiers" })).body as MentorItem;
    expect(logged.sessionsCompleted).toBe(1);
    expect(logged.assignedVentures[0]?.stage).toBe("Validation");

    const ov = (await call(s, "GET", "incubation/mentors")).body as MentorNetworkOverview;
    expect(ov.activeAssignmentsCount).toBe(1);
    expect(ov.totalSessionsConducted).toBe(1);

    const un = (await call(s, "POST", `incubation/mentors/${m.id}/unassign`, { ventureId: v.id })).body as MentorItem;
    expect(un.assignedVentures).toHaveLength(0);
    expect((await call(s, "PATCH", `incubation/mentors/${m.id}`, { availability: "Busy" })).status).toBe(200);
    expect((await call(s, "PATCH", `incubation/mentors/${m.id}`, { availability: "Whenever" })).status).toBe(400);
    expect((await call(s, "DELETE", `incubation/mentors/${m.id}`)).status).toBe(200);
  });
});

describe("Startup portfolio", () => {
  it("registers, totals funding from the records, updates and removes", async () => {
    const s = who();
    const a = (await call(s, "POST", "incubation/startups", startupDraft())).body as StartupItem;
    expect(a.readinessScore).toBe(0);
    expect(a.cohort).toMatch(/Innovation Cohort$/);
    await call(s, "POST", "incubation/startups", startupDraft({ name: "Other", fundingRaised: "₹20,00,000 (Grant)", incorporationStatus: "DPIIT Recognized" }));
    expect((await call(s, "POST", "incubation/startups", startupDraft({ name: "solarclean" }))).status).toBe(409);

    const ov = (await call(s, "GET", "incubation/startups")).body as StartupPortfolioOverview;
    expect(ov.totalStartups).toBe(2);
    expect(ov.dpiitRecognizedCount).toBe(1);
    expect(ov.totalFundingMobilized).toBe("₹25.00 Lakhs");

    const up = (await call(s, "PATCH", `incubation/startups/${a.id}`, { stage: "Growth & Scaling", activePilotsCount: 4 })).body as StartupItem;
    expect(up.stage).toBe("Growth & Scaling");
    expect(up.activePilotsCount).toBe(4);
    expect((await call(s, "DELETE", `incubation/startups/${a.id}`)).status).toBe(200);
    expect((await call(s, "PATCH", `incubation/startups/${a.id}`, { stage: "MVP Live" })).status).toBe(404);
  });
});

describe("Funding readiness", () => {
  it("lists startups unscored until evaluated, then derives score and tier", async () => {
    const s = who();
    const a = (await call(s, "POST", "incubation/startups", startupDraft())).body as StartupItem;
    await call(s, "POST", "incubation/startups", startupDraft({ name: "Other" }));

    const before = (await call(s, "GET", "incubation/funding-readiness")).body as FundingReadinessOverview;
    expect(before.allVentures).toHaveLength(2);
    expect(before.averageReadinessScore).toBe(0);
    expect(before.angelReadyCount).toBe(0);
    expect(before.currentEvaluation?.dimensions).toHaveLength(6);
    expect(before.currentEvaluation?.dimensions.every((d) => d.score === 0)).toBe(true);
    expect(before.currentEvaluation?.diligenceChecklist.every((d) => !d.verified)).toBe(true);

    const dims = ["team", "problem", "product", "traction", "businessModel", "pitch"].map((id) => ({ id, score: 80 }));
    const res = await call(s, "PATCH", `incubation/funding-readiness/${a.id}`, {
      dimensions: dims,
      fundingTarget: "₹1,00,00,000 (Seed Round)",
      investorGaps: ["No financial controller"],
      diligenceChecklist: [{ id: "dil-corp", verified: true, notes: "CIN seen" }],
    });
    expect(res.status).toBe(200);
    const ev = res.body as VentureFundingReadiness;
    expect(ev.readinessScore).toBe(80);
    expect(ev.readinessTier).toBe("Angel / Pre-Series A Ready");
    expect(ev.diligenceChecklist.find((d) => d.id === "dil-corp")?.verified).toBe(true);

    const after = (await call(s, "GET", "incubation/funding-readiness", undefined, new URLSearchParams({ ventureId: a.id }))).body as FundingReadinessOverview;
    expect(after.selectedVentureId).toBe(a.id);
    expect(after.averageReadinessScore).toBe(80);
    expect(after.angelReadyCount).toBe(1);
    expect(after.criticalGapsCount).toBe(1);
    expect(after.totalFundingTarget).toBe("₹1.00 Crores");

    // the startup's own readiness follows the evaluation
    const stu = (await call(s, "GET", "incubation/startups")).body as StartupPortfolioOverview;
    expect(stu.startups.find((x) => x.id === a.id)?.readinessScore).toBe(80);
  });

  it("rejects unknown dimensions and unknown startups", async () => {
    const s = who();
    const a = (await call(s, "POST", "incubation/startups", startupDraft())).body as StartupItem;
    expect((await call(s, "PATCH", `incubation/funding-readiness/${a.id}`, { dimensions: [{ id: "made-up", score: 50 }] })).status).toBe(400);
    expect((await call(s, "PATCH", "incubation/funding-readiness/missing", { evaluatorNotes: "x" })).status).toBe(404);
  });
});
