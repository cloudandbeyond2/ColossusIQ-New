import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { dispatch } from "@/lib/api/mock/router";
import type { SessionPayload } from "@/lib/auth/session";
import type {
  FundingReadinessOverview,
  VentureFundingReadiness,
} from "@/lib/api/funding-readiness-schemas";

const incubationSession: SessionPayload = {
  sub: "inc-head-1",
  role: "incubation",
  name: "Dr. K. Ramanathan",
  tenant: "TNTU",
  college: "COL-1001",
  mfa: true,
  exp: 9999999999,
};

const adminSession: SessionPayload = {
  sub: "admin-1",
  role: "admin",
  name: "Super Admin",
  tenant: "TNTU",
  college: "all",
  mfa: true,
  exp: 9999999999,
};

const studentSession: SessionPayload = {
  sub: "student-1",
  role: "student",
  name: "Sneha",
  tenant: "TNTU",
  college: "COL-1001",
  mfa: true,
  exp: 9999999999,
};

describe("Incubation Funding Readiness API", () => {
  it("allows Incubation Head to fetch overall funding readiness overview", async () => {
    const res = await dispatch(
      "GET",
      ["incubation", "funding-readiness"],
      undefined,
      incubationSession,
      new URLSearchParams()
    );
    expect(res.status).toBe(200);

    const data = res.body as FundingReadinessOverview;
    expect(data.averageReadinessScore).toBeGreaterThanOrEqual(70);
    expect(data.angelReadyCount).toBeGreaterThanOrEqual(3);
    expect(data.allVentures.length).toBeGreaterThanOrEqual(7);

    // Default selected venture is AgriSoil Sense
    expect(data.currentEvaluation.ventureName).toBe("AgriSoil Sense");
    expect(data.currentEvaluation.dimensions.length).toBe(6);
    expect(data.currentEvaluation.diligenceChecklist.length).toBeGreaterThanOrEqual(4);
  });

  it("allows switching venture via ?ventureId query param", async () => {
    const q = new URLSearchParams({ ventureId: "stu-edututr" });
    const res = await dispatch("GET", ["incubation", "funding-readiness"], undefined, incubationSession, q);
    expect(res.status).toBe(200);

    const data = res.body as FundingReadinessOverview;
    expect(data.selectedVentureId).toBe("stu-edututr");
    expect(data.currentEvaluation.ventureName).toBe("Edututr Vernacular");
    expect(data.currentEvaluation.readinessTier).toBe("Institutional VC Ready");
    expect(data.currentEvaluation.readinessScore).toBe(94);
  });

  it("allows University Super Admin to fetch funding readiness", async () => {
    const res = await dispatch(
      "GET",
      ["incubation", "funding-readiness"],
      undefined,
      adminSession,
      new URLSearchParams()
    );
    expect(res.status).toBe(200);
    const data = res.body as FundingReadinessOverview;
    expect(data.allVentures.length).toBeGreaterThan(0);
  });

  it("forbids unauthorized roles from accessing funding readiness API", async () => {
    const res = await dispatch(
      "GET",
      ["incubation", "funding-readiness"],
      undefined,
      studentSession,
      new URLSearchParams()
    );
    expect(res.status).toBe(403);
  });

  it("allows updating dimensional scores and investor diligence checklist", async () => {
    const updates = {
      dimensions: [
        { id: "team", score: 85 },
        { id: "traction", score: 88 },
      ],
      fundingTarget: "₹35,00,000 (Pre-Series A Round)",
      strengths: ["New state government pilot approval", "Hardware BOM reduced by 22%"],
      investorGaps: ["Need full-time financial controller"],
      actionPlan: ["Present at national startup demo day in Bangalore"],
      diligenceChecklist: [
        { id: "dil-corp", verified: true, notes: "Certificate verified by registrar" },
      ],
      evaluatorNotes: "Readiness upgraded following successful FPO pilot deployment.",
    };

    const patchRes = await dispatch(
      "PATCH",
      ["incubation", "funding-readiness", "stu-agrisoil"],
      JSON.stringify(updates),
      incubationSession,
      new URLSearchParams()
    );

    expect(patchRes.status).toBe(200);
    const updated = patchRes.body as VentureFundingReadiness;
    expect(updated.ventureId).toBe("stu-agrisoil");
    expect(updated.fundingTarget).toBe("₹35,00,000 (Pre-Series A Round)");
    expect(updated.strengths).toContain("New state government pilot approval");
    expect(updated.investorGaps).toContain("Need full-time financial controller");

    const teamDim = updated.dimensions.find((d) => d.id === "team");
    expect(teamDim?.score).toBe(85);

    // Verify it reflects in GET
    const getRes = await dispatch(
      "GET",
      ["incubation", "funding-readiness"],
      undefined,
      incubationSession,
      new URLSearchParams({ ventureId: "stu-agrisoil" })
    );
    const ov = getRes.body as FundingReadinessOverview;
    expect(ov.currentEvaluation.fundingTarget).toBe("₹35,00,000 (Pre-Series A Round)");
  });
});
