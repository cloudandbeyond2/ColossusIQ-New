import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { dispatch } from "@/lib/api/mock/router";
import type { SessionPayload } from "@/lib/auth/session";
import type { StartupPortfolioOverview, StartupItem } from "@/lib/api/startup-schemas";

const incubationSession: SessionPayload = {
  sub: "inc-head-1",
  role: "incubation",
  name: "Dr. K. Ramanathan",
  tenant: "TNTU",
  college: "COL-1001",
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

const adminSession: SessionPayload = {
  sub: "admin-1",
  role: "admin",
  name: "Super Admin",
  tenant: "TNTU",
  college: "all",
  mfa: true,
  exp: 9999999999,
};

describe("Incubation Startups API", () => {
  it("allows Incubation Head to fetch campus startups portfolio overview", async () => {
    const res = await dispatch("GET", ["incubation", "startups"], undefined, incubationSession, new URLSearchParams());
    expect(res.status).toBe(200);

    const data = res.body as StartupPortfolioOverview;
    expect(data.totalStartups).toBeGreaterThanOrEqual(7);
    expect(data.dpiitRecognizedCount).toBeGreaterThanOrEqual(2);
    expect(data.activeCommercialPilots).toBeGreaterThanOrEqual(15);
    expect(data.patentsCount).toBeGreaterThanOrEqual(5);

    const agrisoil = data.startups.find((s) => s.name === "AgriSoil Sense");
    expect(agrisoil).toBeDefined();
    expect(agrisoil?.domain).toBe("AgriTech");
    expect(agrisoil?.incorporationStatus).toBe("DPIIT Recognized");
    expect(agrisoil?.stage).toBe("Commercial Pilot");
  });

  it("allows University Super Admin to fetch startups portfolio", async () => {
    const res = await dispatch("GET", ["incubation", "startups"], undefined, adminSession, new URLSearchParams());
    expect(res.status).toBe(200);
    const data = res.body as StartupPortfolioOverview;
    expect(data.startups.length).toBeGreaterThan(0);
  });

  it("forbids unauthorized roles (e.g. students) from accessing startups incubation API", async () => {
    const res = await dispatch("GET", ["incubation", "startups"], undefined, studentSession, new URLSearchParams());
    expect(res.status).toBe(403);
  });

  it("allows Incubation Head to register a new campus startup", async () => {
    const newVenture = {
      name: "SolarClean Autonomous",
      tagline: "Water-free robotic solar panel cleaning for distributed rooftop arrays",
      registrationNumber: "DPIIT-TN-2026-1189",
      domain: "CleanTech & IoT",
      incorporationStatus: "DPIIT Recognized",
      stage: "Commercial Pilot",
      leadFounder: "Pooja Venkatesh",
      leadEmail: "pooja.solar@ait.edu.in",
      department: "Electrical & Electronics Engineering",
      cohort: "2026 Innovation Cohort",
      assignedMentor: "Mr. Rajesh Chandran",
      readinessScore: 85,
      fundingRaised: "₹6,00,000 (TANSIM Seed)",
      revenue: "₹2,40,000 ARR",
      activePilotsCount: 3,
      patentStatus: "Filed (Provisional)",
      websiteUrl: "https://solarclean.ait.edu.in",
      pitchDeckUrl: "https://drive.google.com/solarclean-deck",
      demoUrl: "https://solarclean.ait.edu.in/demo",
    };

    const res = await dispatch(
      "POST",
      ["incubation", "startups"],
      JSON.stringify(newVenture),
      incubationSession,
      new URLSearchParams()
    );

    expect(res.status).toBe(200);
    const created = res.body as StartupItem;
    expect(created.id).toMatch(/^stu-/);
    expect(created.name).toBe("SolarClean Autonomous");
    expect(created.leadFounder).toBe("Pooja Venkatesh");
    expect(created.readinessScore).toBe(85);

    // Verify it now appears in overview
    const getRes = await dispatch("GET", ["incubation", "startups"], undefined, incubationSession, new URLSearchParams());
    const data = getRes.body as StartupPortfolioOverview;
    const found = data.startups.find((s) => s.id === created.id);
    expect(found).toBeDefined();
    expect(found?.name).toBe("SolarClean Autonomous");
  });

  it("allows Incubation Head to update startup milestones and traction", async () => {
    // 1. First get a startup ID
    const listRes = await dispatch("GET", ["incubation", "startups"], undefined, incubationSession, new URLSearchParams());
    const overview = listRes.body as StartupPortfolioOverview;
    const target = overview.startups[0]!;

    const updates = {
      stage: "Growth & Scaling",
      revenue: "₹20,00,000 ARR",
      activePilotsCount: 15,
      readinessScore: 96,
      patentStatus: "Granted",
      status: "Active",
    };

    const patchRes = await dispatch(
      "PATCH",
      ["incubation", "startups", target.id],
      JSON.stringify(updates),
      incubationSession,
      new URLSearchParams()
    );

    expect(patchRes.status).toBe(200);
    const updated = patchRes.body as StartupItem;
    expect(updated.id).toBe(target.id);
    expect(updated.stage).toBe("Growth & Scaling");
    expect(updated.revenue).toBe("₹20,00,000 ARR");
    expect(updated.activePilotsCount).toBe(15);
    expect(updated.readinessScore).toBe(96);
    expect(updated.patentStatus).toBe("Granted");
  });

  it("allows Incubation Head to delete a startup", async () => {
    // Register temporary startup to delete
    const tempVenture = {
      name: "Temporary Venture",
      tagline: "Temporary venture for deletion testing",
      domain: "EdTech",
      leadFounder: "Temp Founder",
      leadEmail: "temp@ait.edu.in",
      department: "Management Studies",
    };

    const createRes = await dispatch(
      "POST",
      ["incubation", "startups"],
      JSON.stringify(tempVenture),
      incubationSession,
      new URLSearchParams()
    );
    const created = createRes.body as StartupItem;

    const delRes = await dispatch(
      "DELETE",
      ["incubation", "startups", created.id],
      undefined,
      incubationSession,
      new URLSearchParams()
    );
    expect(delRes.status).toBe(200);
    expect(delRes.body).toEqual({ ok: true, deleted: created.id });

    // Verify deletion
    const getRes = await dispatch("GET", ["incubation", "startups"], undefined, incubationSession, new URLSearchParams());
    const data = getRes.body as StartupPortfolioOverview;
    expect(data.startups.some((s) => s.id === created.id)).toBe(false);
  });
});
