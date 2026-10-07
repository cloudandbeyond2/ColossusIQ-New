import { describe, expect, it } from "vitest";
import { MODULES, SUPER_ADMIN_COLLEGE_NAV, SUPER_ADMIN_NAV, groupedModules, inNav } from "@/config/modules";

const menu = (allColleges: boolean) => groupedModules("admin").flatMap((g) => g.items.filter((m) => inNav("admin", m.slug, allColleges)).map((m) => m.slug));

describe("the Super Admin's menu", () => {
  it("lists only modules the Super Admin actually has", () => {
    for (const s of [...SUPER_ADMIN_NAV, ...SUPER_ADMIN_COLLEGE_NAV]) expect(MODULES.find((m) => m.slug === s)?.roles.includes("admin"), s).toBe(true);
  });

  it("shows university and platform work at All colleges, and college management inside a college", () => {
    const all = menu(true);
    expect(all).toEqual(expect.arrayContaining(["colleges", "content-desk", "curriculum", "notice-board", "module-control", "ai-providers", "users", "audit-log"]));
    // Staff and student tools are not listed (they stay reachable by search and links).
    for (const s of ["assignments", "handwritten", "my-classes", "teaching-studio", "course-roadmap", "admissions", "question-bank"]) expect(all).not.toContain(s);
    const college = menu(false);
    expect(college).toEqual(expect.arrayContaining(["admissions", "staff", "question-bank", "events"]));
    expect(college).not.toContain("teaching-studio");
  });

  it("leaves every other role's menu unchanged", () => {
    expect(inNav("faculty", "teaching-studio", false)).toBe(true);
    expect(inNav("student", "mentor", false)).toBe(true);
  });
});
