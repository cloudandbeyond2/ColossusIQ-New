import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { dispatch } from "@/lib/api/mock/router";
import type { SessionPayload } from "@/lib/auth/session";
import type { RoleHome } from "@/lib/api/schemas";

const hod: SessionPayload = { sub: "hod-1", role: "hod", name: "HOD", tenant: "TNTU", college: "COL-1001", mfa: true, exp: 9999999999 };
const call = (s: SessionPayload, path: string) => dispatch("GET", path.split("/"), undefined, s, new URLSearchParams());

describe("HOD home", () => {
  it("is computed from department records, not the old sample text", async () => {
    const res = await call(hod, "home/hod");
    expect(res.status).toBe(200);
    const h = res.body as RoleHome;
    const text = JSON.stringify(h);
    for (const stale of ["91.4%", "Theory of Computation failures rising", "146 job descriptions", "Cloud skills gap", "Faculty upskilling"]) {
      expect(text).not.toContain(stale);
    }
    expect(h.kpis.map((k) => k.label)).toEqual(["Students", "Pass percentage", "Placement readiness", "Teaching faculty"]);
    expect(h.charts).toHaveLength(2);
    expect(h.queue.length).toBeGreaterThan(0);
    expect(h.insights.length).toBeGreaterThan(0);
    // Each queue link points at a page the HOD actually has.
    for (const q of h.queue) expect(q.href.startsWith("/hod/")).toBe(true);
  });

  it("is only served to the HOD role", async () => {
    const fac: SessionPayload = { ...hod, sub: "fac-1", role: "faculty" };
    expect((await call(fac, "home/hod")).status).toBe(403);
  });
});
