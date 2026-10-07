import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { CurriculumDoc, CurriculumList, curriculumWarnings, type CurriculumData } from "@/lib/api/curriculum-schemas";
import { Roadmap, RoadmapBoard, planSessions, teachingDates } from "@/lib/api/roadmap-schemas";
import { resetCurriculaMemory } from "@/lib/api/mock/curriculum-store";
import { dispatch } from "@/lib/api/mock/router";
import type { SessionPayload } from "@/lib/auth/session";

const admin: SessionPayload = { sub: "demo-admin", role: "admin", name: "Super Admin", tenant: "uni-tntu", college: "all", mfa: true, exp: 9e9 };
const faculty: SessionPayload = { ...admin, sub: `fac-${Math.random()}`, role: "faculty", name: "Faculty", college: "COL-1001" };
const student: SessionPayload = { ...faculty, sub: "demo-student", role: "student" };
const q = new URLSearchParams();
const call = (s: SessionPayload, method: string, path: string, body?: unknown) => dispatch(method, path.split("/"), body, s, q);

const course = (code: string, semester: number, units = 5) => ({
  code,
  title: `Course ${code}`,
  semester,
  category: "PC",
  l: 3,
  t: 1,
  p: 0,
  credits: 4,
  units: Array.from({ length: units }, (_, i) => ({ title: `Unit ${i + 1} title`, topics: "Topic A, Topic B, Topic C", hours: 9 })),
  outcomes: ["CO1: Explain the basics"],
  textbooks: [],
});

beforeEach(() => resetCurriculaMemory());

describe("Curriculum Studio", () => {
  it("the Super Admin drafts, saves and publishes; staff see only published curricula; students none", async () => {
    expect((await call(faculty, "POST", "curriculum", { degree: "B.E.", discipline: "CSE", regulation: "R2026", semesters: 8, start: "blank" })).status).toBe(403);
    const r = await call(admin, "POST", "curriculum", { degree: "B.E.", discipline: "Computer Science and Engineering", regulation: "R2026", semesters: 2, start: "blank" });
    expect(r.status).toBe(201);
    const doc = CurriculumDoc.parse(r.body);
    expect(doc).toMatchObject({ status: "Draft", programme: "B.E. Computer Science and Engineering", canEdit: true });
    // Duplicate programme + regulation is refused.
    expect((await call(admin, "POST", "curriculum", { degree: "B.E.", discipline: "Computer Science and Engineering", regulation: "R2026", semesters: 2, start: "blank" })).status).toBe(409);
    // AI drafting needs an AI provider (none in tests).
    expect((await call(admin, "POST", "curriculum", { degree: "B.E.", discipline: "Civil Engineering", regulation: "R2026", semesters: 8, start: "ai" })).status).toBe(503);

    expect(CurriculumList.parse((await call(faculty, "GET", "curriculum")).body).curricula).toHaveLength(0);
    expect((await call(student, "GET", "curriculum")).status).toBe(403);

    const data = { ...doc.data, courses: [course("CS1101", 1), course("CS1102", 1), course("CS1103", 1), course("CS1104", 1), course("CS1105", 1), course("CS2101", 2)] };
    const saved = CurriculumDoc.parse((await call(admin, "PUT", `curriculum/${doc.id}`, { data })).body);
    expect(saved.credits).toBe(24);
    expect(saved.warnings.some((w) => w.includes("Semester 2 carries 4 credits"))).toBe(true);
    expect((await call(admin, "POST", `curriculum/${doc.id}/publish`)).status).toBe(200);

    const seen = CurriculumList.parse((await call(faculty, "GET", "curriculum")).body).curricula;
    expect(seen).toHaveLength(1);
    const asFaculty = CurriculumDoc.parse((await call(faculty, "GET", `curriculum/${doc.id}`)).body);
    expect(asFaculty.canEdit).toBe(false);
    // Revising a published curriculum bumps its version.
    const v2 = CurriculumDoc.parse((await call(admin, "PUT", `curriculum/${doc.id}`, { data })).body);
    expect(v2.version).toBe(2);
    expect((await call(admin, "DELETE", `curriculum/${doc.id}`)).status).toBe(409);
  });

  it("flags inconsistent credits and duplicate codes", () => {
    const d: CurriculumData = { degree: "B.E.", discipline: "X", semesters: 1, description: "", programmeOutcomes: [], courses: [{ ...course("AB1234", 1), credits: 9 } as never, course("AB1234", 1) as never] };
    const w = curriculumWarnings(d);
    expect(w.some((x) => x.includes("AB1234 is used 2 times"))).toBe(true);
    expect(w.some((x) => x.includes("does not match L-T-P"))).toBe(true);
  });
});

describe("Course Roadmap", () => {
  it("spreads units over dated sessions with tutorials, assessments and revision", () => {
    const plan = planSessions(course("X1234", 1).units, true);
    // 5 units × (8 lectures + 1 tutorial) + 2 assessments + revision.
    expect(plan).toHaveLength(5 * 9 + 2 + 1);
    expect(plan.filter((p) => p.method === "Assessment").map((p) => p.topic)).toEqual(["Internal assessment I (Units 1–2)", "Internal assessment II (Units 3–4)"]);
    expect(plan.at(-1)!.method).toBe("Revision");
    // 2027-01-04 is a Monday; Mon/Wed/Fri.
    expect(teachingDates("2027-01-04", [1, 3, 5], 4)).toEqual(["2027-01-04", "2027-01-06", "2027-01-08", "2027-01-11"]);
  });

  it("a teacher builds a roadmap from a published curriculum, ticks sessions and reschedules", async () => {
    const created = CurriculumDoc.parse((await call(admin, "POST", "curriculum", { degree: "B.E.", discipline: "Mechanical", regulation: "R2026", semesters: 1, start: "blank" })).body);
    await call(admin, "PUT", `curriculum/${created.id}`, { data: { ...created.data, courses: [course("ME1101", 1, 2)] } });
    await call(admin, "POST", `curriculum/${created.id}/publish`);

    const b = RoadmapBoard.parse((await call(faculty, "GET", "course-roadmap")).body);
    expect(b.sources[0]!.courses[0]).toMatchObject({ code: "ME1101", units: 2, hours: 18 });
    expect((await call(faculty, "POST", "course-roadmap", { curriculumId: created.id, courseCode: "NOPE", section: "", startDate: "2027-01-04", weekdays: [1] })).status).toBe(422);
    const r = await call(faculty, "POST", "course-roadmap", { curriculumId: created.id, courseCode: "ME1101", section: "I ME A", startDate: "2027-01-04", weekdays: [1, 3, 5] });
    expect(r.status).toBe(201);
    const map = Roadmap.parse(r.body);
    expect(map.sessions[0]).toMatchObject({ date: "2027-01-04", status: "Planned", unit: 1 });

    const ticked = Roadmap.parse((await call(faculty, "PATCH", `course-roadmap/${map.id}/sessions/${map.sessions[0]!.id}`, { status: "Done", note: "Covered with examples" })).body);
    expect(ticked.sessions[0]).toMatchObject({ status: "Done", note: "Covered with examples" });
    const moved = Roadmap.parse((await call(faculty, "POST", `course-roadmap/${map.id}/reschedule`, { from: "2027-02-01" })).body);
    expect(moved.sessions.find((s) => s.status === "Planned")!.date).toBe("2027-02-01");
    expect(moved.sessions[0]!.date).toBe("2027-01-04"); // taught sessions keep their date

    // Roadmaps are private to the teacher and need a college.
    expect(RoadmapBoard.parse((await call({ ...faculty, sub: "someone-else" }, "GET", "course-roadmap")).body).roadmaps).toHaveLength(0);
    expect((await call({ ...admin }, "GET", "course-roadmap")).status).toBe(409);
    expect((await call(student, "GET", "course-roadmap")).status).toBe(403);
  });
});
