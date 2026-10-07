import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { dispatch } from "@/lib/api/mock/router";
import type { SessionPayload } from "@/lib/auth/session";
import type { AlumniNetworkOverview, MentorshipRequestItem } from "@/lib/api/alumni-schemas";

const studentSession: SessionPayload = {
  sub: "student-alumni-test-1",
  role: "student",
  name: "Deepak Raman",
  tenant: "uni-tntu",
  college: "COL-1001",
  mfa: true,
  exp: 9e9,
};

const staffSession: SessionPayload = {
  sub: "placement-officer-1",
  role: "placement",
  name: "Dr. K. Swaminathan",
  tenant: "uni-tntu",
  college: "COL-1001",
  mfa: true,
  exp: 9e9,
};

const q = new URLSearchParams();
const call = (s: SessionPayload, method: string, path: string, body?: unknown) =>
  dispatch(method, path.split("/"), body, s, q);

describe("Alumni Network and Mentorship API", () => {
  it("fetches dynamic alumni directory with summary and match scores", async () => {
    const res = await call(studentSession, "GET", "alumni");
    expect(res.status).toBe(200);

    const data = res.body as AlumniNetworkOverview;
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.summary.totalAlumni).toBe(data.items.length);
    expect(data.summary.availableMentors).toBeGreaterThan(0);
    expect(data.canManage).toBe(false);

    // Verify dynamic fields on alumni items
    const first = data.items[0]!;
    expect(first.id).toBeDefined();
    expect(first.name).toBeDefined();
    expect(first.batch).toBeDefined();
    expect(first.company).toBeDefined();
    expect(first.matchScore).toBeGreaterThanOrEqual(70);
    expect(first.matchScore).toBeLessThanOrEqual(100);
    expect(Array.isArray(first.mentorshipTopics)).toBe(true);
  });

  it("allows student to submit, inspect, and cancel mentorship request", async () => {
    const initialRes = await call(studentSession, "GET", "alumni");
    const initialData = initialRes.body as AlumniNetworkOverview;
    const mentor = initialData.items[0]!;

    // 1. Submit request
    const reqRes = await call(studentSession, "POST", "alumni/request", {
      alumniId: mentor.id,
      topic: mentor.mentorshipTopics[0] || "Placement Prep",
      preferredMode: "Virtual Call",
      message: "Looking for guidance on Microsoft technical interview rounds.",
    });
    expect(reqRes.status).toBe(201);
    const reqData = reqRes.body as { ok: boolean; request: MentorshipRequestItem };
    expect(reqData.ok).toBe(true);
    expect(reqData.request.alumniId).toBe(mentor.id);
    expect(reqData.request.status).toBe("Pending");

    // 2. Duplicate pending request returns 409
    const dupRes = await call(studentSession, "POST", "alumni/request", {
      alumniId: mentor.id,
      topic: mentor.mentorshipTopics[0] || "Placement Prep",
      preferredMode: "Virtual Call",
      message: "Another duplicate request",
    });
    expect(dupRes.status).toBe(409);

    // 3. Inspect student's requests list
    const afterRes = await call(studentSession, "GET", "alumni");
    const afterData = afterRes.body as AlumniNetworkOverview;
    const found = afterData.requests.find((r) => r.id === reqData.request.id);
    expect(found).toBeDefined();
    expect(found?.status).toBe("Pending");

    // 4. Cancel/withdraw request
    const cancelRes = await call(studentSession, "DELETE", `alumni/requests/${reqData.request.id}`);
    expect(cancelRes.status).toBe(200);

    // 5. Verify removed
    const finalRes = await call(studentSession, "GET", "alumni");
    const finalData = finalRes.body as AlumniNetworkOverview;
    expect(finalData.requests.some((r) => r.id === reqData.request.id)).toBe(false);
  });

  it("allows placement coordinator to register new alumni mentor", async () => {
    const res = await call(staffSession, "POST", "alumni", {
      name: "Divya Krishnan",
      batch: "Batch 2020",
      currentPosition: "Lead Solutions Architect",
      company: "Atlassian",
      mentorshipTopics: ["Mock Interviews & System Design", "Placement Prep"],
      skills: ["Cloud Architecture", "Jira API", "Microservices", "Java"],
      bio: "Alumna leading enterprise cloud solutions. Mentoring engineering students.",
      isAvailable: true,
      maxMentees: 4,
    });
    expect(res.status).toBe(201);

    // Verify it shows up in directory
    const checkRes = await call(studentSession, "GET", "alumni");
    const checkData = checkRes.body as AlumniNetworkOverview;
    expect(checkData.items.some((m) => m.name === "Divya Krishnan" && m.company === "Atlassian")).toBe(true);
  });
});
