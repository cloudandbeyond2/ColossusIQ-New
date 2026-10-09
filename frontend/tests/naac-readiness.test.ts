import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { dispatch } from "@/lib/api/mock/router";
import { resetAicteMemory } from "@/lib/api/mock/aicte-store";
import type { SessionPayload } from "@/lib/auth/session";
import { ScorecardData } from "@/lib/api/schemas";

const session = (role: SessionPayload["role"], college = "COL-1001"): SessionPayload => ({
  sub: `test-${role}`,
  role,
  name: "Dr. Lakshmi Sundaram",
  tenant: "t",
  college,
  mfa: true,
  exp: 9e9,
});

const q = new URLSearchParams();
const inst = session("institution");
const naac = async (s = inst) => {
  const res = await dispatch("GET", ["modules", "naac-readiness"], undefined, s, q);
  return { status: res.status, body: res.body as { data?: ScorecardData } & Partial<ScorecardData> };
};
const card = (b: { data?: ScorecardData } & Partial<ScorecardData>) => (b.data ?? b) as ScorecardData;

beforeEach(() => resetAicteMemory());

describe("naac-readiness", () => {
  it("scores the seven criteria from the college's records", async () => {
    const res = await naac();
    expect(res.status).toBe(200);
    const c = card(res.body);
    expect(ScorecardData.safeParse(c).success).toBe(true);
    expect(c.dimensions.map((d) => d.name.slice(0, 2))).toEqual(["C1", "C2", "C3", "C4", "C5", "C6", "C7"]);
    for (const d of c.dimensions) {
      expect(d.score).toBeGreaterThanOrEqual(0);
      expect(d.score).toBeLessThanOrEqual(100);
    }
    expect(c.overall).toBe(Math.round(c.dimensions.reduce((a, d) => a + d.score, 0) / c.dimensions.length));
    // the old fixed text must be gone
    expect(JSON.stringify(c)).not.toContain("Run a mock peer-team visit in January");
    expect(c.gaps.at(-1)).toContain("outside ColossusIQ");
  });

  it("moves governance and values when the statutory committees are recorded", async () => {
    const before = card((await naac()).body);
    const committee = { status: "Constituted & Active", chairperson: "Dr. Lakshmi Sundaram", membersCount: 7, lastMeetingDate: new Date().toISOString().slice(0, 10), momStatus: "Certified by Principal" };
    for (const id of ["COM-01", "COM-02", "COM-04", "COM-05"]) {
      expect((await dispatch("PATCH", ["aicte-compliance", "committees", id], committee, inst, q)).status).toBe(200);
    }
    const after = card((await naac()).body);
    const score = (c: ScorecardData, p: string) => c.dimensions.find((d) => d.name.startsWith(p))!.score;
    expect(score(after, "C6")).toBeGreaterThan(score(before, "C6"));
    expect(score(after, "C7")).toBeGreaterThan(score(before, "C7"));
    expect(after.overall).toBeGreaterThan(before.overall);
    expect(score(after, "C1")).toBe(score(before, "C1"));
  });

  it("opens for the Super Admin at All colleges and at a college, and not for students", async () => {
    expect((await naac(session("admin", "all"))).status).toBe(200);
    expect((await naac(session("admin", "COL-1001"))).status).toBe(200);
    expect((await naac(session("student"))).status).toBe(403);
  });
});
