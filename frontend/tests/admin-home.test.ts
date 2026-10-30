import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { dispatch } from "@/lib/api/mock/router";
import type { SessionPayload } from "@/lib/auth/session";
import type { RoleHome } from "@/lib/api/schemas";

const adminSession: SessionPayload = {
  sub: "admin-1",
  role: "admin",
  name: "Super Admin",
  tenant: "TNTU",
  college: "all",
  mfa: true,
  exp: 9999999999,
};

const call = (method: string, path: string) =>
  dispatch(method, path.split("/"), undefined, adminSession, new URLSearchParams());

describe("dynamic admin home", () => {
  it("serves live dynamic metrics on GET /api/v1/home/admin without stale numbers", async () => {
    const res = await call("GET", "home/admin");
    expect(res.status).toBe(200);
    const h = res.body as RoleHome;

    const text = JSON.stringify(h);
    // Stale mock figures from old ROLE_HOMES.admin
    for (const stale of ["58,940", "412K", "2.1s", "Onboard Sahyadri Polytechnic", "Review 23 flagged AI outputs"]) {
      expect(text).not.toContain(stale);
    }

    expect(h.greeting).toContain("Central University Operations");
    expect(h.kpis.length).toBeGreaterThanOrEqual(4);
    expect(h.kpis.find((k) => k.label.includes("Colleges"))).toBeDefined();
    expect(h.kpis.find((k) => k.label.includes("Enrolled"))).toBeDefined();
    expect(h.kpis.find((k) => k.label.includes("AI Gateway"))).toBeDefined();
    expect(h.kpis.find((k) => k.label.includes("Staff"))).toBeDefined();

    expect(h.charts.length).toBe(2);
    expect(h.charts[0]?.title).toBe("College admissions & active staff comparison");
    expect(h.charts[1]?.title).toBe("Enrollment & applications by academic stream");

    expect(h.insights.length).toBeGreaterThan(0);
    expect(h.queue.length).toBeGreaterThan(0);

    for (const q of h.queue) {
      expect(q.href.startsWith("/admin/")).toBe(true);
    }
  });

  it("enforces role permission on GET /api/v1/home/admin", async () => {
    const studentSession: SessionPayload = {
      ...adminSession,
      role: "student",
      sub: "stud-1",
    };
    const res = await dispatch("GET", ["home", "admin"], undefined, studentSession, new URLSearchParams());
    expect(res.status).toBe(403);
  });
});
