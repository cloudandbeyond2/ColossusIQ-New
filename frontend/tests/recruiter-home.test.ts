import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { dispatch } from "@/lib/api/mock/router";
import type { SessionPayload } from "@/lib/auth/session";
import type { RoleHome } from "@/lib/api/schemas";
import { dynamicRecruiterHome } from "@/lib/api/mock/recruiter-home";

const session: SessionPayload = {
  sub: "recruiter-1",
  role: "recruiter",
  name: "Rahul Mehta",
  tenant: "TNTU",
  college: "all",
  mfa: true,
  exp: 9999999999,
};

const call = (method: string, path: string, body?: unknown) =>
  dispatch(method, path.split("/"), body === undefined ? undefined : JSON.stringify(body), session, new URLSearchParams());

describe("recruiter home dashboard", () => {
  it("computes live dynamic KPIs, charts and queue via dynamicRecruiterHome", async () => {
    const home = await dynamicRecruiterHome(session);

    expect(home.greeting).toContain("Rahul Mehta");
    expect(home.department).toBe("Talent Acquisition");
    expect(home.kpis.length).toBe(4);

    const profileKpi = home.kpis.find((k) => k.label === "Verified Profiles");
    expect(profileKpi).toBeDefined();
    expect(Number(profileKpi?.value.replace(/,/g, ""))).toBeGreaterThan(0);

    const shortlistKpi = home.kpis.find((k) => k.label === "Active Shortlists");
    expect(shortlistKpi).toBeDefined();

    const interviewsKpi = home.kpis.find((k) => k.label === "Scheduled Interviews");
    expect(interviewsKpi).toBeDefined();

    const offersKpi = home.kpis.find((k) => k.label === "Offers Extended");
    expect(offersKpi).toBeDefined();

    expect(home.charts.length).toBe(2);
    expect(home.charts[0]?.title).toBe("Candidates by readiness band");
    expect(home.charts[0]?.data.length).toBe(5);

    expect(home.queue.length).toBeGreaterThan(0);
    expect(home.insights.length).toBeGreaterThan(0);
  });

  it("serves the dynamic recruiter home through GET /api/v1/home/recruiter", async () => {
    const res = await call("GET", "home/recruiter");
    expect(res.status).toBe(200);
    const h = res.body as RoleHome;

    expect(h.greeting).toContain("Rahul Mehta");
    expect(h.kpis.find((k) => k.label === "Verified Profiles")).toBeDefined();
    expect(h.charts[0]?.title).toBe("Candidates by readiness band");
  });
});
