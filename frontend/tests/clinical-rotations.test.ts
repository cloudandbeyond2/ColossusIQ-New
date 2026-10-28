import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { dispatch } from "@/lib/api/mock/router";
import { resetClinicalMemory } from "@/lib/api/mock/clinical-data";
import type { SessionPayload } from "@/lib/auth/session";
import type { ClinicalCase, ClinicalSkill } from "@/lib/api/mock/clinical-data";

const base: SessionPayload = { sub: "stu-1", role: "student", name: "Asha K", tenant: "TNTU", college: "COL-1001", mfa: true, exp: 9999999999 };
const who = (role: SessionPayload["role"], sub = "x-1", college = "COL-1001", name = "Dr Rao"): SessionPayload => ({ ...base, role, sub, college, name });
const student = (sub = "stu-1") => who("student", sub, "COL-1001", `Student ${sub}`);
const call = (s: SessionPayload, method: string, path: string, body?: unknown) =>
  dispatch(method, path.split("/"), body === undefined ? undefined : JSON.stringify(body), s, new URLSearchParams());

const caseDraft = (over: Record<string, unknown> = {}) => ({ bed: "Bed 4", patient: "Ravi, 40 M", diagnosis: "Appendicitis", complaints: "RLQ pain", faculty: "Dr Rao", ...over });
const skillDraft = (over: Record<string, unknown> = {}) => ({ code: "SU15.1", name: "Incision and drainage", level: "Performs", notes: "Done", supervisor: "Dr Rao", ...over });

describe("clinical rotations cases and DOPS skills", () => {
  beforeEach(() => resetClinicalMemory());

  it("starts empty: no invented patients or skills", async () => {
    const cases = (await call(student(), "GET", "clinical/cases")).body as { cases: ClinicalCase[] };
    const skills = (await call(student(), "GET", "clinical/dops")).body as { skills: ClinicalSkill[] };
    expect(cases.cases).toEqual([]);
    expect(skills.skills).toEqual([]);
  });

  it("a student clerks a case that waits for a doctor, who then approves it", async () => {
    const res = await call(student(), "POST", "clinical/cases", caseDraft());
    expect(res.status).toBe(201);
    const created = res.body as ClinicalCase;
    expect(created.status).toBe("Pending");

    // another student cannot see it, staff in the college can
    const other = (await call(student("stu-2"), "GET", "clinical/cases")).body as { cases: ClinicalCase[] };
    expect(other.cases).toHaveLength(0);
    const staff = (await call(who("faculty"), "GET", "clinical/cases")).body as { cases: ClinicalCase[] };
    expect(staff.cases).toHaveLength(1);

    expect((await call(student(), "POST", "clinical/cases/approve", { id: created.id })).status).toBe(403);
    const ok = await call(who("faculty"), "POST", "clinical/cases/approve", { id: created.id });
    expect(ok.status).toBe(200);
    const after = (await call(student(), "GET", "clinical/cases")).body as { cases: ClinicalCase[] };
    expect(after.cases[0]?.status).toBe("Approved");
    expect(after.cases[0]?.verifiedBy).toBe("Dr Rao");
  });

  it("a doctor can reject a case, and a case logged by a doctor is already verified", async () => {
    const c = (await call(student(), "POST", "clinical/cases", caseDraft())).body as ClinicalCase;
    await call(who("hod"), "POST", "clinical/cases/reject", { id: c.id });
    const list = (await call(who("hod"), "GET", "clinical/cases")).body as { cases: ClinicalCase[] };
    expect(list.cases.find((x) => x.id === c.id)?.status).toBe("Rejected");

    const own = (await call(who("faculty"), "POST", "clinical/cases", caseDraft({ patient: "Mala, 30 F" }))).body as ClinicalCase;
    expect(own.status).toBe("Approved");
  });

  it("validates case input and keeps colleges apart", async () => {
    expect((await call(student(), "POST", "clinical/cases", caseDraft({ patient: "" }))).status).toBe(400);
    expect((await call(student(), "POST", "clinical/cases", caseDraft({ diagnosis: "x".repeat(300) }))).status).toBe(400);
    const c = (await call(student(), "POST", "clinical/cases", caseDraft())).body as ClinicalCase;
    const stranger = who("faculty", "f-9", "COL-1002");
    expect((await call(stranger, "GET", "clinical/cases")).body).toEqual({ cases: [] });
    expect((await call(stranger, "POST", "clinical/cases/approve", { id: c.id })).status).toBe(404);
  });

  it("DOPS skills go from a student's submission to a doctor's sign-off", async () => {
    const res = await call(student(), "POST", "clinical/dops/submit", skillDraft());
    expect(res.status).toBe(201);
    const skill = (res.body as { skill: ClinicalSkill }).skill;
    expect(skill.status).toBe("Pending Review");

    expect((await call(student(), "POST", "clinical/dops/approve", { id: skill.id })).status).toBe(403);
    expect((await call(who("faculty"), "POST", "clinical/dops/submit", skillDraft())).status).toBe(403);
    expect((await call(student(), "POST", "clinical/dops/submit", skillDraft({ level: "Expert" }))).status).toBe(400);
    expect((await call(student(), "POST", "clinical/dops/submit", skillDraft({ supervisor: "" }))).status).toBe(400);

    expect((await call(who("faculty"), "POST", "clinical/dops/approve", { id: skill.id })).status).toBe(200);
    const mine = (await call(student(), "GET", "clinical/dops")).body as { skills: ClinicalSkill[] };
    expect(mine.skills[0]?.status).toBe("Certified");
    expect(mine.skills[0]?.certifier).toBe("Dr Rao");
    expect((await call(who("faculty"), "POST", "clinical/dops/approve", { id: "missing" })).status).toBe(404);
  });

  it("other roles cannot use the clinical logbook", async () => {
    expect((await call(who("placement"), "GET", "clinical/cases")).status).toBe(403);
    expect((await call(who("recruiter"), "GET", "clinical/dops")).status).toBe(403);
  });
});
