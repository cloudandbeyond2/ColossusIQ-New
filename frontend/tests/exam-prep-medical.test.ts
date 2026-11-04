import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { Catalogue, Round, StudioOverview, TopicList } from "@/lib/api/exam-prep-schemas";
import { resetPrepAttemptMemory } from "@/lib/api/mock/prep-attempt-store";
import { dispatch } from "@/lib/api/mock/router";
import type { SessionPayload } from "@/lib/auth/session";

const medicalFaculty: SessionPayload = {
  sub: "f-anatomy-1",
  role: "faculty",
  name: "Dr. Ramesh (Anatomy)",
  tenant: "uni-tntu",
  college: "COL-1006", // Madurai Medical College & Hospital (Medical stream)
  department: "Anatomy",
  mfa: true,
  exp: 9e9,
};

const medicalStudent: SessionPayload = {
  sub: "s-med-1",
  role: "student",
  name: "Sneha",
  tenant: "uni-tntu",
  college: "COL-1006",
  department: "Anatomy",
  mfa: true,
  exp: 9e9,
};

const q = new URLSearchParams();
const call = (s: SessionPayload, method: string, path: string, body?: unknown) => dispatch(method, path.split("/"), body, s, q);

beforeEach(() => resetPrepAttemptMemory());

describe("Medical Exam Prep Studio & Catalogue Integration", () => {
  it("includes medical topics under 'Medical sciences' family", async () => {
    const r = await call(medicalStudent, "GET", "exam-prep/topics");
    expect(r.status).toBe(200);
    const tl = r.body as TopicList;
    const medFamily = tl.families.find((f) => f.family === "Medical sciences");
    expect(medFamily).toBeDefined();
    expect(medFamily!.topics.length).toBeGreaterThanOrEqual(10);

    const ids = medFamily!.topics.map((t) => t.id);
    expect(ids).toContain("m-anatomy");
    expect(ids).toContain("m-physiology");
    expect(ids).toContain("m-pathology");
    expect(ids).toContain("m-pharmacology");
    expect(ids).toContain("m-medicine");
    expect(ids).toContain("m-surgery");
  });

  it("lists NEET-PG, INI-CET, FMGE, and NExT in the catalogue", async () => {
    const r = await call(medicalStudent, "GET", "exam-prep/catalogue");
    expect(r.status).toBe(200);
    const cat = r.body as Catalogue;
    const examIds = cat.exams.map((e) => e.id);
    expect(examIds).toContain("neet-pg");
    expect(examIds).toContain("ini-cet");
    expect(examIds).toContain("fmge");
    expect(examIds).toContain("next-step1");
  });

  it("provides stream-aware data for medical faculty in Exam Prep Studio", async () => {
    const r = await call(medicalFaculty, "GET", "prep-content");
    expect(r.status).toBe(200);
    const overview = r.body as StudioOverview;
    expect(overview.stream).toBe("medical");
    expect(overview.topics.some((t) => t.id === "m-anatomy" && t.family === "Medical sciences")).toBe(true);
    expect(overview.exams.some((e) => e.id === "neet-pg")).toBe(true);
    expect(overview.exams.some((e) => e.id === "ini-cet")).toBe(true);
  });

  it("allows starting a practice round on a medical topic without leaking answers", async () => {
    const r = await call(medicalStudent, "POST", "exam-prep/practice", { topicId: "m-anatomy" });
    expect(r.status).toBe(201);
    const round = r.body as Round;
    expect(round.questions.length).toBeGreaterThan(0);
    const json = JSON.stringify(r.body);
    expect(json).not.toMatch(/"answer"|"explanation"/);
  });
});
