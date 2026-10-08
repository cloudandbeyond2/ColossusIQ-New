import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MODULES } from "@/config/modules";
import { ModuleData } from "@/lib/api/schemas";
import { dispatch } from "@/lib/api/mock/router";
import type { SessionPayload } from "@/lib/auth/session";

/*
 * The University Super Admin can open every staff-facing page. Each page's main API must answer the Super Admin,
 * at "All colleges" scope (or say clearly that a college has to be chosen) and inside a college.
 */

const admin = (college: string): SessionPayload => ({ sub: "demo-admin", role: "admin", name: "Super Admin", tenant: "uni-tntu", college, mfa: true, exp: 9e9 });
const q = new URLSearchParams();
const get = (s: SessionPayload, path: string) => dispatch("GET", path.split("/"), undefined, s, q);

/** The main GET behind each bespoke page. */
const BESPOKE_API: Record<string, string[]> = {
  assignments: ["assignments"],
  handwritten: ["evaluations/queue"],
  "exam-prep-studio": ["prep-content"],
  "current-affairs-desk": ["current-affairs"],
  evaluation: ["evaluations/queue"],
  "ai-course-studio": ["learning-courses"],
  "quiz-builder": ["quizzes"],
  "issued-certificates": ["certificates"],
  "certificate-authority": ["certificate-desk"],
  languages: ["languages"],
  projects: ["projects"],
  research: ["research"],
  "event-generator": ["records/events"],
  experience: ["experience"],
  alumni: ["alumni"],
  "teaching-studio": ["teaching/outlines"],
  "skill-booster": ["teaching/booster"],
  "department-faculty": ["faculty"],
  "my-classes": ["faculty/me/allocations"],
  billing: ["billing/overview"],
  "student-fees": ["fees/college"],
  "department-skills": ["department-skills"],
  "early-warning": ["early-warning"],
  "placement-board": ["placement/board"],
  drives: ["drives"],
  employers: ["employers"],
  jobs: ["jobs"],
  "class-analytics": ["faculty/analytics"],
  "college-website": ["website"],
  "knowledge-base": ["knowledge/documents"],
  "aicte-compliance": ["aicte-compliance"],
  "ai-providers": ["ai-providers"],
  "module-control": ["module-control"],
  "notice-board": ["notice-board"],
  "content-desk": ["content-desk"],
  curriculum: ["curriculum"],
  "course-roadmap": ["course-roadmap"],
  integrations: ["integrations"],
  hackathons: ["hackathons"],
};
/** Pages without a dispatcher GET (static, or served by the route handler itself, like the college website). */
const UNIVERSITY_ONLY = new Set(["content-desk"]);
const NO_API = new Set(["roles-permissions", "reports", "college-website", "class-analytics"]);

const adminModules = MODULES.filter((m) => m.roles.includes("admin"));

describe("the Super Admin", () => {
  it("has every staff-facing module", () => {
    const staff = MODULES.filter((m) => m.roles.some((r) => ["faculty", "hod", "institution", "placement", "incubation"].includes(r)));
    expect(staff.filter((m) => !m.roles.includes("admin")).map((m) => m.slug)).toEqual(["certificate-requests"]);
  });

  for (const scope of ["all", "COL-1001"]) {
    describe(`at ${scope === "all" ? "All colleges" : "a college"}`, () => {
      it.each(adminModules.map((m) => [m.slug, m.template]))("opens %s", async (slug, template) => {
        const s = admin(scope);
        const mod = MODULES.find((m) => m.slug === slug)!;
        // Stream-specific modules (e.g. clinical) open only in colleges of that stream; COL-1001 is not medical.
        if (scope !== "all" && mod.streams) return;
        if (template !== "bespoke") {
          const r = await get(s, `modules/${slug}`);
          expect(r.status, slug).toBe(200);
          if (template !== "crud") expect(ModuleData.safeParse(r.body).success).toBe(true);
          return;
        }
        if (NO_API.has(slug)) return;
        const paths = BESPOKE_API[slug];
        expect(paths, `add ${slug} to BESPOKE_API`).toBeDefined();
        for (const p of paths!) {
          const r = await get(s, p);
          // At "All colleges" a college-scoped desk may ask the Super Admin to pick a college first.
          // University-level desks (writing to every college) ask to switch back to All colleges instead.
          const okStatuses = scope === "all" || UNIVERSITY_ONLY.has(slug) ? [200, 409] : [200];
          expect(okStatuses, `${slug} → GET ${p} answered ${r.status}: ${JSON.stringify(r.body).slice(0, 160)}`).toContain(r.status);
        }
      });
    });
  }
});
