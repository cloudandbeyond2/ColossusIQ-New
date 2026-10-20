import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { dispatch } from "@/lib/api/mock/router";
import type { SessionPayload } from "@/lib/auth/session";
import type {
  PlacementAnalyticsOverview,
  InstitutionalPlacementTargets,
} from "@/lib/api/placement-analytics-schemas";

const institutionSession: SessionPayload = {
  sub: "principal-1",
  role: "institution",
  name: "Dr. S. Radhakrishnan",
  tenant: "TNTU",
  college: "COL-1001",
  mfa: true,
  exp: 9999999999,
};

const placementSession: SessionPayload = {
  sub: "placement-head-1",
  role: "placement",
  name: "Prof. K. Venkatesh",
  tenant: "TNTU",
  college: "COL-1001",
  mfa: true,
  exp: 9999999999,
};

const hodSession: SessionPayload = {
  sub: "hod-cse-1",
  role: "hod",
  name: "Dr. Meena Raghavan",
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
  name: "Karthik Iyer",
  tenant: "TNTU",
  college: "COL-1001",
  mfa: true,
  exp: 9999999999,
};

describe("Placement Analytics Dynamic API", () => {
  it("allows Institution Head to fetch placement analytics overview", async () => {
    const res = await dispatch("GET", ["placement-analytics"], undefined, institutionSession, new URLSearchParams());
    expect(res.status).toBe(200);

    const data = res.body as PlacementAnalyticsOverview;
    expect(data.collegeName).toBe("Anna Institute of Technology Chennai");
    expect(data.executiveSummary.totalOffers).toBeGreaterThanOrEqual(400);
    expect(data.executiveSummary.placementPercentage).toBeGreaterThanOrEqual(75);
    expect(data.executiveSummary.highestPackageLpa).toBeGreaterThanOrEqual(30);
    expect(data.salaryTierDistribution.length).toBe(4);
    expect(data.hiringFunnel.length).toBe(5);
    expect(data.departmentBreakdown.length).toBeGreaterThanOrEqual(5);
    expect(data.recruiterDrives.length).toBeGreaterThanOrEqual(5);
    expect(data.readinessGaps.length).toBeGreaterThanOrEqual(4);
    expect(data.placedStudents.length).toBeGreaterThanOrEqual(5);
  });

  it("allows Placement Officer and HOD to fetch placement analytics", async () => {
    const resPlacement = await dispatch("GET", ["placement-analytics"], undefined, placementSession, new URLSearchParams());
    expect(resPlacement.status).toBe(200);

    const resHod = await dispatch("GET", ["placement-analytics"], undefined, hodSession, new URLSearchParams());
    expect(resHod.status).toBe(200);
  });

  it("allows University Super Admin to view placement analytics", async () => {
    const res = await dispatch("GET", ["placement-analytics"], undefined, adminSession, new URLSearchParams());
    expect(res.status).toBe(200);
  });

  it("forbids student role from accessing placement analytics", async () => {
    const res = await dispatch("GET", ["placement-analytics"], undefined, studentSession, new URLSearchParams());
    expect(res.status).toBe(403);
  });

  it("filters placement analytics by department and salary tier", async () => {
    const q = new URLSearchParams({ department: "Computer Science", tier: "Super Dream" });
    const res = await dispatch("GET", ["placement-analytics"], undefined, institutionSession, q);
    expect(res.status).toBe(200);

    const data = res.body as PlacementAnalyticsOverview;
    expect(data.departmentBreakdown.length).toBe(1);
    expect(data.departmentBreakdown[0]?.code).toBe("CSE");
    data.recruiterDrives.forEach((d) => {
      expect(d.tier).toBe("Super Dream");
    });
    data.placedStudents.forEach((s) => {
      expect(s.department).toContain("Computer Science");
      expect(s.tier).toBe("Super Dream");
    });
  });

  it("allows Institution Head to update institutional placement targets", async () => {
    const updatePayload = {
      targetPlacementPct: 95,
      minAverageLpaTarget: 11.5,
      mockInterviewCompletionTarget: 98,
      targetCompaniesCount: 75,
    };

    const res = await dispatch("PATCH", ["placement-analytics", "targets"], updatePayload, institutionSession, new URLSearchParams());
    expect(res.status).toBe(200);

    const updated = res.body as InstitutionalPlacementTargets;
    expect(updated.targetPlacementPct).toBe(95);
    expect(updated.minAverageLpaTarget).toBe(11.5);
    expect(updated.mockInterviewCompletionTarget).toBe(98);
    expect(updated.targetCompaniesCount).toBe(75);

    // Verify subsequent GET reflects new targets
    const getRes = await dispatch("GET", ["placement-analytics"], undefined, institutionSession, new URLSearchParams());
    const data = getRes.body as PlacementAnalyticsOverview;
    expect(data.executiveSummary.targetPlacementPercentage).toBe(95);
    expect(data.institutionalTargets.minAverageLpaTarget).toBe(11.5);
  });
});
