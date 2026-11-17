import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { dispatch } from "@/lib/api/mock/router";
import type { SessionPayload } from "@/lib/auth/session";
import type { RoleHome } from "@/lib/api/schemas";
import { groupedModules, inNav } from "@/config/modules";
import { can, ROLE_PERMISSIONS, ROLE_META } from "@/lib/auth/roles";

const principalSession: SessionPayload = {
  sub: "principal-1",
  role: "institution",
  name: "Dr. Lakshmi Sundaram",
  tenant: "TNTU",
  college: "COL-1001",
  mfa: true,
  exp: 9999999999,
};

const call = (s: SessionPayload, path: string) =>
  dispatch("GET", path.split("/"), undefined, s, new URLSearchParams());

describe("Principal / Institution Portal", () => {
  describe("Role & Metadata", () => {
    it("has correct role definition and label", () => {
      expect(ROLE_META.institution.label).toBe("College Principal");
      expect(ROLE_META.institution.description).toContain("College command center");
      expect(can("institution", "certificates:authorize")).toBe(true);
      expect(can("institution", "admissions:manage")).toBe(true);
      expect(can("institution", "staff:manage")).toBe(true);
      expect(can("institution", "department:manage")).toBe(true);
      expect(can("institution", "institution:analytics")).toBe(true);
      expect(can("institution", "courses:manage")).toBe(true);
    });
  });

  describe("Dynamic Institution Home API (GET /api/v1/home/institution)", () => {
    it("serves live dynamic metrics for an engineering college (COL-1001)", async () => {
      const res = await call(principalSession, "home/institution");
      expect(res.status).toBe(200);
      const h = res.body as RoleHome;

      expect(h.greeting).toContain("Command Center");
      expect(h.college).toBeDefined();
      expect(h.college?.id).toBe("COL-1001");
      expect(h.college?.principal).toBeDefined();

      // KPIs
      expect(h.kpis.length).toBeGreaterThanOrEqual(5);
      const kpiLabels = h.kpis.map((k) => k.label);
      expect(kpiLabels).toContain("Students");
      expect(kpiLabels).toContain("Teaching faculty");
      expect(kpiLabels).toContain("Departments");
      expect(kpiLabels).toContain("Active courses");
      expect(kpiLabels).toContain("Admissions pipeline");

      // Dynamic Charts
      expect(h.charts.length).toBe(2);
      expect(h.charts[0]?.title).toContain("Department breakdown");
      expect(h.charts[1]?.title).toContain("Admissions conversion pipeline");

      // Attention Queue
      expect(h.queue.length).toBeGreaterThan(0);
      for (const q of h.queue) {
        expect(q.href.startsWith("/institution/")).toBe(true);
      }

      // Insights
      expect(h.insights.length).toBeGreaterThan(0);

      // Departments Snapshot
      expect(h.departments).toBeDefined();
      expect(h.departments!.length).toBeGreaterThan(0);
      for (const dept of h.departments!) {
        expect(dept.name).toBeDefined();
        expect(typeof dept.students).toBe("number");
        expect(typeof dept.faculty).toBe("number");
        expect(typeof dept.readiness).toBe("number");
      }
    });

    it("serves live dynamic metrics for a medical college (COL-1006)", async () => {
      const medicalPrincipal: SessionPayload = {
        ...principalSession,
        sub: "principal-med-1",
        college: "COL-1006",
      };

      const res = await call(medicalPrincipal, "home/institution");
      expect(res.status).toBe(200);
      const h = res.body as RoleHome;

      expect(h.greeting).toContain("Command Center");
      expect(h.college?.id).toBe("COL-1006");

      // Medical stream specific KPIs
      const kpiLabels = h.kpis.map((k) => k.label);
      expect(kpiLabels).toContain("Medical / MBBS students");
      expect(kpiLabels).toContain("Clinical postings");
      expect(kpiLabels).toContain("Avg clinical attendance");
      expect(kpiLabels).toContain("Logbook competencies certified");

      // Medical charts
      expect(h.charts[1]?.title).toContain("Clinical Postings by Department");
    });

    it("rejects unauthorized roles from accessing home/institution", async () => {
      const studentSession: SessionPayload = {
        ...principalSession,
        sub: "stud-1",
        role: "student",
      };
      const facultySession: SessionPayload = {
        ...principalSession,
        sub: "fac-1",
        role: "faculty",
      };
      const recruiterSession: SessionPayload = {
        ...principalSession,
        sub: "rec-1",
        role: "recruiter",
      };

      expect((await call(studentSession, "home/institution")).status).toBe(403);
      expect((await call(facultySession, "home/institution")).status).toBe(403);
      expect((await call(recruiterSession, "home/institution")).status).toBe(403);
    });
  });

  describe("Principal Navigation & Modules", () => {
    it("builds a comprehensive navigation structure for the Principal", () => {
      const nav = groupedModules("institution");
      expect(nav.length).toBeGreaterThan(0);

      const allItems = nav.flatMap((g) => g.items);
      const slugs = allItems.map((m) => m.slug);

      // Verify essential principal modules are present
      expect(slugs).toContain("notice-board");
      expect(slugs).toContain("admissions");
      expect(slugs).toContain("departments");
      expect(slugs).toContain("staff");
      expect(slugs).toContain("course-management");
      expect(slugs).toContain("academic-calendar");
      expect(slugs).toContain("certificate-authority");
      expect(slugs).toContain("bi-analytics");
      expect(slugs).toContain("early-warning");
      expect(slugs).toContain("naac-readiness");
      expect(slugs).toContain("aicte-compliance");
      expect(slugs).toContain("knowledge-base");
      expect(slugs).toContain("policy-assistant");
      expect(slugs).toContain("reports");
      expect(slugs).toContain("branding");
      expect(slugs).toContain("college-website");
      expect(slugs).toContain("users");
      expect(slugs).toContain("security-settings");
    });

    it("filters navigation items with inNav correctly", () => {
      expect(inNav("institution", "departments", false)).toBe(true);
      expect(inNav("institution", "staff", false)).toBe(true);
      expect(inNav("institution", "admissions", false)).toBe(true);
      expect(inNav("institution", "certificate-authority", false)).toBe(true);
    });
  });

  describe("Principal API Endpoints & Core Desks", () => {
    it("allows Principal to access CRUD resources for their college", async () => {
      const crudResources = ["admissions", "staff", "departments", "events", "users", "gallery", "questions"];
      for (const resKey of crudResources) {
        const res = await call(principalSession, `records/${resKey}`);
        expect(res.status, `records/${resKey}`).toBe(200);
      }
    });

    it("allows Principal to access academic and institutional desks", async () => {
      const endpoints = [
        "certificate-desk",
        "certificates",
        "fees/college",
        "knowledge/documents",
        "policy",
        "agents/store",
        "notice-board",
        "learning-courses",
        "students",
        "department-skills",
        "early-warning",
        "placement/board",
        "placement-analytics",
        "aicte-compliance",
        "integrations",
        "modules/branding",
      ];
      for (const ep of endpoints) {
        const res = await call(principalSession, ep);
        expect([200, 204], `GET ${ep} answered ${res.status}`).toContain(res.status);
      }
    });

    it("allows Principal to access dashboard and scorecard modules", async () => {
      const dashboards = ["bi-analytics", "admission-insights", "naac-readiness"];
      for (const db of dashboards) {
        const res = await call(principalSession, `modules/${db}`);
        expect(res.status, `modules/${db}`).toBe(200);
      }
    });

    it("allows Principal to access medical desks in medical stream", async () => {
      const medPrincipal: SessionPayload = { ...principalSession, college: "COL-1006" };
      const medEndpoints = ["nmc-compliance", "osce", "competency-logbook"];
      for (const ep of medEndpoints) {
        const res = await call(medPrincipal, ep);
        expect(res.status, `GET ${ep}`).toBe(200);
      }
    });

    it("scopes students API strictly to the Principal's college", async () => {
      // Principal of COL-1001 calls /students
      const q = new URLSearchParams({ college: "all" });
      const res = await dispatch("GET", ["students"], undefined, principalSession, q);
      expect(res.status).toBe(200);
      const data = res.body as { students: Array<{ collegeId?: string }> };
      // All returned students must belong to COL-1001, never leaking other colleges
      for (const s of data.students) {
        if (s.collegeId) {
          expect(s.collegeId).toBe("COL-1001");
        }
      }
    });
  });
});
