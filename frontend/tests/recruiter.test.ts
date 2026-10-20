import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { dispatch } from "@/lib/api/mock/router";
import type { SessionPayload } from "@/lib/auth/session";
import type {
  TalentSearchOverview,
  ShortlistsOverview,
  InterviewsOverview,
  ShortlistCandidate,
  InterviewScheduleItem,
} from "@/lib/api/recruiter-schemas";

const recruiterSession: SessionPayload = {
  sub: "recruiter-101",
  role: "recruiter",
  name: "Sarah Jenkins",
  tenant: "TNTU",
  college: "COL-1001",
  mfa: true,
  exp: 9999999999,
};

const adminSession: SessionPayload = {
  sub: "admin-1",
  role: "admin",
  name: "Super Admin",
  tenant: "TNTU",
  college: "all",
  mfa: true,
  exp: 9999999999,
};

const studentSession: SessionPayload = {
  sub: "student-1",
  role: "student",
  name: "Rohan Varma",
  tenant: "TNTU",
  college: "COL-1001",
  mfa: true,
  exp: 9999999999,
};

describe("Recruiter Portal Dynamic APIs", () => {
  describe("Talent Search API (recruiter/candidates)", () => {
    it("allows recruiter to fetch candidate talent pool with filters", async () => {
      const q = new URLSearchParams({ q: "Priya", minCgpa: "8.5" });
      const res = await dispatch("GET", ["recruiter", "candidates"], undefined, recruiterSession, q);
      expect(res.status).toBe(200);

      const data = res.body as TalentSearchOverview;
      expect(data.candidates.length).toBeGreaterThanOrEqual(1);
      const priya = data.candidates.find((c) => c.name.includes("Priya"));
      expect(priya).toBeDefined();
      expect(priya?.cgpa).toBeGreaterThanOrEqual(8.5);
      expect(data.totalCandidates).toBeGreaterThanOrEqual(10);
      expect(data.availableForHireCount).toBeGreaterThan(0);
    });

    it("filters candidates by skill and department", async () => {
      const q = new URLSearchParams({ skill: "Python", department: "Computer Science & Engineering" });
      const res = await dispatch("GET", ["recruiter", "candidates"], undefined, recruiterSession, q);
      expect(res.status).toBe(200);

      const data = res.body as TalentSearchOverview;
      expect(data.candidates.length).toBeGreaterThanOrEqual(1);
      data.candidates.forEach((c) => {
        expect(c.department).toBe("Computer Science & Engineering");
        expect(c.skills.some((s) => s.toLowerCase().includes("python"))).toBe(true);
      });
    });

    it("allows university admin to access candidate search", async () => {
      const res = await dispatch("GET", ["recruiter", "candidates"], undefined, adminSession, new URLSearchParams());
      expect(res.status).toBe(200);
      const data = res.body as TalentSearchOverview;
      expect(data.candidates.length).toBeGreaterThanOrEqual(10);
    });

    it("forbids student role from accessing recruiter candidate search", async () => {
      const res = await dispatch("GET", ["recruiter", "candidates"], undefined, studentSession, new URLSearchParams());
      expect(res.status).toBe(403);
    });
  });

  describe("Shortlists API (recruiter/shortlists)", () => {
    it("returns shortlists overview and stage metrics", async () => {
      const res = await dispatch("GET", ["recruiter", "shortlists"], undefined, recruiterSession, new URLSearchParams());
      expect(res.status).toBe(200);

      const data = res.body as ShortlistsOverview;
      expect(data.totalShortlisted).toBeGreaterThanOrEqual(4);
      expect(data.inAssessmentCount).toBeGreaterThanOrEqual(1);
      expect(data.inInterviewCount).toBeGreaterThanOrEqual(1);
      expect(data.shortlists.length).toBeGreaterThanOrEqual(4);
    });

    it("allows creating a new shortlist candidate", async () => {
      const payload = {
        candidateId: "cand-4", // Anand Kumar
        roleRequisition: "Backend & Cloud Engineer",
        notes: "Excellent IoT telemetry and Python systems engineering background",
      };

      const res = await dispatch("POST", ["recruiter", "shortlists"], payload, recruiterSession, new URLSearchParams());
      expect(res.status).toBe(200);
      const created = res.body as ShortlistCandidate;
      expect(created.candidateId).toBe("cand-4");
      expect(created.roleRequisition).toBe("Backend & Cloud Engineer");
      expect(created.stage).toBe("Shortlisted");

      // Verify that candidate is now shortlisted
      const getRes = await dispatch("GET", ["recruiter", "shortlists"], undefined, recruiterSession, new URLSearchParams());
      const data = getRes.body as ShortlistsOverview;
      expect(data.shortlists.some((c) => c.candidateId === "cand-4")).toBe(true);
    });

    it("allows updating shortlist stage and assessment score", async () => {
      const getRes = await dispatch("GET", ["recruiter", "shortlists"], undefined, recruiterSession, new URLSearchParams());
      const first = (getRes.body as ShortlistsOverview).shortlists[0]!;

      const updatePayload = {
        stage: "Technical Assessment",
        notes: "Passed preliminary screening with flying colors",
        assessmentScore: 92,
      };

      const res = await dispatch("PATCH", ["recruiter", "shortlists", first.id], updatePayload, recruiterSession, new URLSearchParams());
      expect(res.status).toBe(200);
      const updated = res.body as ShortlistCandidate;
      expect(updated.id).toBe(first.id);
      expect(updated.stage).toBe("Technical Assessment");
      expect(updated.assessmentScore).toBe(92);
    });

    it("allows removing a candidate from shortlist", async () => {
      const getRes = await dispatch("GET", ["recruiter", "shortlists"], undefined, recruiterSession, new URLSearchParams());
      const toDelete = (getRes.body as ShortlistsOverview).shortlists.find((c) => c.candidateId === "cand-4");
      expect(toDelete).toBeDefined();

      const delRes = await dispatch(
        "DELETE",
        ["recruiter", "shortlists", toDelete!.id],
        undefined,
        recruiterSession,
        new URLSearchParams()
      );
      expect(delRes.status).toBe(200);

      // Verify removal
      const afterRes = await dispatch("GET", ["recruiter", "shortlists"], undefined, recruiterSession, new URLSearchParams());
      const afterData = afterRes.body as ShortlistsOverview;
      expect(afterData.shortlists.some((c) => c.id === toDelete!.id)).toBe(false);
    });
  });

  describe("Interviews API (recruiter/interviews)", () => {
    it("returns interview schedules and metrics", async () => {
      const res = await dispatch("GET", ["recruiter", "interviews"], undefined, recruiterSession, new URLSearchParams());
      expect(res.status).toBe(200);

      const data = res.body as InterviewsOverview;
      expect(data.interviews.length).toBeGreaterThanOrEqual(3);
      expect(data.upcomingTodayCount).toBeGreaterThanOrEqual(0);
      expect(data.pendingFeedbackCount).toBeGreaterThanOrEqual(0);
      expect(data.thisWeekCount).toBeGreaterThanOrEqual(1);
    });

    it("schedules a new interview round", async () => {
      const slRes = await dispatch("GET", ["recruiter", "shortlists"], undefined, recruiterSession, new URLSearchParams());
      const candidateSl = (slRes.body as ShortlistsOverview).shortlists[0]!;

      const schedulePayload = {
        shortlistId: candidateSl.id,
        round: "System Design & Coding" as const,
        dateTime: "2026-10-25T14:30",
        durationMinutes: 60,
        panelists: "Sarah Jenkins (VP Eng), Arun Kumar (Principal Architect)",
        meetingLink: "https://meet.google.com/xyz-test-drive",
        location: "Virtual Room A",
      };

      const res = await dispatch("POST", ["recruiter", "interviews"], schedulePayload, recruiterSession, new URLSearchParams());
      expect(res.status).toBe(200);
      const created = res.body as InterviewScheduleItem;
      expect(created.candidateName).toBe(candidateSl.candidateName);
      expect(created.round).toBe("System Design & Coding");
      expect(created.meetingLink).toBe("https://meet.google.com/xyz-test-drive");
    });

    it("submits interview feedback and auto-advances pipeline", async () => {
      const getRes = await dispatch("GET", ["recruiter", "interviews"], undefined, recruiterSession, new URLSearchParams());
      const schedule = (getRes.body as InterviewsOverview).interviews.find((s) => s.status === "Scheduled");
      expect(schedule).toBeDefined();

      const feedbackPayload = {
        feedbackNotes: "Exceptional system design depth, very strong problem solver. Definite hire recommendation.",
        feedbackScore: 95,
        recommendation: "Strong Hire" as const,
        status: "Completed" as const,
      };

      const res = await dispatch("PATCH", ["recruiter", "interviews", schedule!.id], feedbackPayload, recruiterSession, new URLSearchParams());
      expect(res.status).toBe(200);
      const updated = res.body as InterviewScheduleItem;
      expect(updated.id).toBe(schedule!.id);
      expect(updated.status).toBe("Completed");
      expect(updated.feedbackScore).toBe(95);
      expect(updated.recommendation).toBe("Strong Hire");

      // Verify that candidate in shortlists has advanced stage to HR Round or Offer Extended
      const slRes = await dispatch("GET", ["recruiter", "shortlists"], undefined, recruiterSession, new URLSearchParams());
      const candidateSl = (slRes.body as ShortlistsOverview).shortlists.find((c) => c.id === schedule!.shortlistId);
      if (candidateSl) {
        expect(["HR Round", "Offer Extended"]).toContain(candidateSl.stage);
      }
    });

    it("cancels a scheduled interview", async () => {
      const getRes = await dispatch("GET", ["recruiter", "interviews"], undefined, recruiterSession, new URLSearchParams());
      const schedule = (getRes.body as InterviewsOverview).interviews.find((s) => s.status === "Scheduled");
      expect(schedule).toBeDefined();

      const cancelRes = await dispatch(
        "DELETE",
        ["recruiter", "interviews", schedule!.id],
        undefined,
        recruiterSession,
        new URLSearchParams()
      );
      expect(cancelRes.status).toBe(200);

      const afterRes = await dispatch("GET", ["recruiter", "interviews"], undefined, recruiterSession, new URLSearchParams());
      const afterSchedule = (afterRes.body as InterviewsOverview).interviews.find((s) => s.id === schedule!.id);
      expect(afterSchedule?.status).toBe("Cancelled");
    });
  });
});
