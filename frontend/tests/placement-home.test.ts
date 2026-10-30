import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { dispatch } from "@/lib/api/mock/router";
import type { SessionPayload } from "@/lib/auth/session";
import type { RoleHome } from "@/lib/api/schemas";
import { dynamicPlacementHome } from "@/lib/api/mock/placement-home";

const universitySession: SessionPayload = {
  sub: "placement-1",
  role: "placement",
  name: "Ms. Priya Nair",
  tenant: "TNTU",
  college: "all",
  mfa: true,
  exp: 9999999999,
};

const collegeSession: SessionPayload = {
  sub: "placement-2",
  role: "placement",
  name: "Dr. Rajesh Kumar",
  tenant: "TNTU",
  college: "mit",
  mfa: true,
  exp: 9999999999,
};

const call = (session: SessionPayload, method: string, path: string) =>
  dispatch(method, path.split("/"), undefined, session, new URLSearchParams());

describe("placement home dashboard", () => {
  it("computes live dynamic KPIs, charts, insights, and action queue via dynamicPlacementHome", async () => {
    const home = await dynamicPlacementHome(universitySession);

    expect(home.greeting).toContain("Ms. Priya Nair");
    expect(home.greeting).toContain("Training & Placement Office");

    // Stale mock indicators from old static ROLE_HOMES.placement
    const text = JSON.stringify(home);
    expect(text).not.toContain("Freshworks drive — shortlist");
    expect(text).not.toContain("1,860 eligible students");

    // KPIs validation
    expect(home.kpis.length).toBeGreaterThanOrEqual(5);
    const offersKpi = home.kpis.find((k) => k.label.includes("Offers Secured"));
    expect(offersKpi).toBeDefined();

    const readyKpi = home.kpis.find((k) => k.label.includes("Placement Ready"));
    expect(readyKpi).toBeDefined();

    const drivesKpi = home.kpis.find((k) => k.label.includes("Campus Drives"));
    expect(drivesKpi).toBeDefined();

    const ctcKpi = home.kpis.find((k) => k.label.includes("Average Package"));
    expect(ctcKpi).toBeDefined();

    // Dynamic charts
    expect(home.charts.length).toBeGreaterThanOrEqual(4);
    const funnelChart = home.charts.find((c) => c.title === "Campus hiring funnel");
    expect(funnelChart).toBeDefined();
    expect(funnelChart?.data.length).toBe(5);

    const distChart = home.charts.find((c) => c.title === "Readiness score distribution");
    expect(distChart).toBeDefined();
    expect(distChart?.data.length).toBe(5);

    // Dynamic insights and queue
    expect(home.insights.length).toBeGreaterThan(0);
    expect(home.queue.length).toBeGreaterThan(0);
    for (const q of home.queue) {
      expect(q.href.startsWith("/placement/")).toBe(true);
    }
  });

  it("serves live dynamic placement home through GET /api/v1/home/placement for university scope", async () => {
    const res = await call(universitySession, "GET", "home/placement");
    expect(res.status).toBe(200);
    const h = res.body as RoleHome;

    expect(h.greeting).toContain("Ms. Priya Nair");
    expect(h.kpis.find((k) => k.label === "Offers Secured")).toBeDefined();
    expect(h.charts.some((c) => c.title.toLowerCase().includes("funnel"))).toBe(true);
  });

  it("serves college-scoped placement home correctly", async () => {
    const res = await call(collegeSession, "GET", "home/placement");
    expect(res.status).toBe(200);
    const h = res.body as RoleHome;

    expect(h.greeting).toContain("Dr. Rajesh Kumar");
    expect(h.kpis.length).toBeGreaterThanOrEqual(5);
    expect(h.charts.length).toBeGreaterThanOrEqual(4);
  });

  it("enforces role permission on GET /api/v1/home/placement", async () => {
    const studentSession: SessionPayload = {
      ...universitySession,
      role: "student",
      sub: "stud-1",
    };
    const res = await call(studentSession, "GET", "home/placement");
    expect(res.status).toBe(403);
  });
});
