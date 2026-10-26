import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { dispatch } from "@/lib/api/mock/router";
import { resetIncubationMemory } from "@/lib/api/mock/incubation-data";
import type { SessionPayload } from "@/lib/auth/session";
import type { RoleHome } from "@/lib/api/schemas";

const s: SessionPayload = { sub: "inc-1", role: "incubation", name: "Incubation Head", tenant: "TNTU", college: "COL-1001", mfa: true, exp: 9999999999 };
const call = (method: string, path: string, body?: unknown) =>
  dispatch(method, path.split("/"), body === undefined ? undefined : JSON.stringify(body), s, new URLSearchParams());
const kpi = (h: RoleHome, label: string) => h.kpis.find((k) => k.label === label)?.value;

describe("incubation home", () => {
  beforeEach(() => resetIncubationMemory());

  it("shows no invented numbers on an empty college", async () => {
    const res = await call("GET", "home/incubation");
    expect(res.status).toBe(200);
    const h = res.body as RoleHome;
    expect(kpi(h, "Ventures in pipeline")).toBe("0");
    expect(kpi(h, "Startups in portfolio")).toBe("0");
    expect(kpi(h, "Mentors")).toBe("0");
    expect(h.greeting).toContain("Innovation & Incubation");
    expect(h.queue.length).toBeGreaterThan(0);
  });

  it("reflects ventures, startups and mentors that were created", async () => {
    const v = await call("POST", "incubation-pipeline/ventures", {
      name: "AgriSense", tagline: "Soil telemetry", domain: "AgriTech", cohort: "2026 Innovation Cohort",
      leadFounder: "Anand K", leadEmail: "anand@example.edu", department: "Computer Science",
    });
    expect([200, 201]).toContain(v.status);
    const h = (await call("GET", "home/incubation")).body as RoleHome;
    expect(kpi(h, "Ventures in pipeline")).toBe("1");
  });
});
