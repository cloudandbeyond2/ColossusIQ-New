import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { dispatch } from "@/lib/api/mock/router";
import type { SessionPayload } from "@/lib/auth/session";
import type { StudentJobsOverview } from "@/lib/api/jobs-schemas";

const studentSession: SessionPayload = {
  sub: "student-test-1",
  role: "student",
  name: "Arun Kumar",
  tenant: "uni-tntu",
  college: "COL-1001",
  mfa: true,
  exp: 9e9,
};

const q = new URLSearchParams();
const call = (s: SessionPayload, method: string, path: string, body?: unknown) =>
  dispatch(method, path.split("/"), body, s, q);

describe("Student Jobs and Matching API", () => {
  it("fetches dynamic student jobs overview with readiness and match calculations", async () => {
    const res = await call(studentSession, "GET", "jobs");
    expect(res.status).toBe(200);

    const data = res.body as StudentJobsOverview;
    expect(data.student).toBeDefined();
    expect(data.student.sub).toBe("student-test-1");
    expect(data.readiness).toBeDefined();
    expect(data.readiness.total).toBeGreaterThanOrEqual(0);

    expect(data.jobs.length).toBeGreaterThan(0);
    expect(data.summary.totalOpportunities).toBe(data.jobs.length);
    expect(data.summary.averagePackageLpa).toBeGreaterThan(0);

    // Verify dynamic matching fields on every job
    const firstJob = data.jobs[0]!;
    expect(firstJob.matchScore).toBeGreaterThanOrEqual(50);
    expect(firstJob.matchScore).toBeLessThanOrEqual(100);
    expect(Array.isArray(firstJob.matchedSkills)).toBe(true);
    expect(Array.isArray(firstJob.rounds)).toBe(true);
    expect(typeof firstJob.isEligible).toBe("boolean");
  });

  it("allows student to bookmark and un-bookmark a job", async () => {
    const initialRes = await call(studentSession, "GET", "jobs");
    const initialData = initialRes.body as StudentJobsOverview;
    const targetJobId = initialData.jobs[0]!.id;

    // Toggle save
    const saveRes = await call(studentSession, "POST", "jobs/save", { jobId: targetJobId });
    expect(saveRes.status).toBe(200);
    const saveBody = saveRes.body as { ok: boolean; saved: boolean; savedIds: string[] };
    expect(saveBody.ok).toBe(true);
    expect(saveBody.savedIds.includes(targetJobId)).toBe(saveBody.saved);

    // Toggle save again to revert
    const revertRes = await call(studentSession, "POST", "jobs/save", { jobId: targetJobId });
    expect(revertRes.status).toBe(200);
    const revertBody = revertRes.body as { ok: boolean; saved: boolean; savedIds: string[] };
    expect(revertBody.saved).toBe(!saveBody.saved);
  });

  it("submits application, validates duplicate, and allows withdrawal", async () => {
    const initialRes = await call(studentSession, "GET", "jobs");
    const initialData = initialRes.body as StudentJobsOverview;

    // Pick a job not yet applied to
    const targetJob = initialData.jobs.find(
      (j) => !initialData.applications.some((a) => a.jobId === j.id)
    )!;
    expect(targetJob).toBeDefined();

    // Apply
    const applyRes = await call(studentSession, "POST", "jobs/apply", {
      jobId: targetJob.id,
      resumeName: "Custom ATS Resume",
      notes: "Excited to contribute to distributed backend engineering.",
    });
    expect(applyRes.status).toBe(201);

    // Duplicate apply returns 409
    const dupRes = await call(studentSession, "POST", "jobs/apply", {
      jobId: targetJob.id,
    });
    expect(dupRes.status).toBe(409);

    // Check application exists in overview
    const afterApplyRes = await call(studentSession, "GET", "jobs");
    const afterData = afterApplyRes.body as StudentJobsOverview;
    const foundApp = afterData.applications.find((a) => a.jobId === targetJob.id);
    expect(foundApp).toBeDefined();
    expect(foundApp?.company).toBe(targetJob.company);
    expect(foundApp?.status).toBe("Applied");
    expect(foundApp?.stage).toBe(1);

    // Withdraw application
    const withdrawRes = await call(studentSession, "POST", "jobs/withdraw", {
      jobId: targetJob.id,
    });
    expect(withdrawRes.status).toBe(200);

    // Check application is removed
    const afterWithdrawRes = await call(studentSession, "GET", "jobs");
    const afterWithdrawData = afterWithdrawRes.body as StudentJobsOverview;
    expect(afterWithdrawData.applications.some((a) => a.jobId === targetJob.id)).toBe(false);
  });
});

describe("Placement Officer Jobs and Matching Management API", () => {
  const placementSession: SessionPayload = {
    sub: "placement-officer-1",
    role: "placement",
    name: "Ms. Priya Nair",
    tenant: "uni-tntu",
    college: "all",
    mfa: true,
    exp: 9e9,
  };

  it("serves live dynamic job matching overview with matching candidate pools for placement officer", async () => {
    const res = await call(placementSession, "GET", "jobs");
    expect(res.status).toBe(200);

    const data = res.body as import("@/lib/api/jobs-schemas").PlacementJobsOverview;
    expect(data.summary).toBeDefined();
    expect(data.summary.totalJobs).toBeGreaterThan(0);
    expect(data.summary.totalMatches).toBeGreaterThan(0);
    expect(data.summary.partnerCompanies).toBeGreaterThan(0);
    expect(data.summary.highestPackageLpa).toBeGreaterThan(0);

    expect(Array.isArray(data.jobs)).toBe(true);
    expect(data.jobs.length).toBeGreaterThan(0);

    const first = data.jobs[0]!;
    expect(first.company).toBeDefined();
    expect(first.role).toBeDefined();
    expect(first.packageText).toBeDefined();
    expect(typeof first.eligibleCount).toBe("number");
    expect(Array.isArray(first.candidates)).toBe(true);

    if (first.candidates.length > 0) {
      const c = first.candidates[0]!;
      expect(c.name).toBeDefined();
      expect(c.rollNo).toBeDefined();
      expect(c.readinessTotal).toBeGreaterThanOrEqual(first.minReadiness);
    }
  });

  it("allows placement officer to post a new corporate job opening and calculates live candidate matches", async () => {
    const newJobPayload = {
      company: "Google Cloud India",
      role: "Cloud Platform Engineer",
      category: "industry-job",
      type: "Full Time",
      location: "Bengaluru / Hyderabad",
      packageMin: 16.0,
      packageMax: 24.0,
      openings: 15,
      departments: ["Computer Science & Engineering", "Information Technology"],
      minReadiness: 70,
      minCgpa: 7.0,
      deadline: "2026-11-20",
      description: "Build next-generation distributed storage and edge computing services for Google Cloud customers worldwide.",
      skills: ["Go", "Kubernetes", "Distributed Systems", "SQL"],
    };

    const postRes = await call(placementSession, "POST", "jobs", newJobPayload);
    expect(postRes.status).toBe(201);
    const postBody = postRes.body as { ok: boolean; job: { id: string } };
    expect(postBody.ok).toBe(true);
    expect(postBody.job.id).toBeDefined();

    // Verify it appears in overview
    const getRes = await call(placementSession, "GET", "jobs");
    const overview = getRes.body as import("@/lib/api/jobs-schemas").PlacementJobsOverview;
    const found = overview.jobs.find((j) => j.id === postBody.job.id);
    expect(found).toBeDefined();
    expect(found?.company).toBe("Google Cloud India");
    expect(found?.eligibleCount).toBeGreaterThanOrEqual(0);

    // Clean up with DELETE
    const delRes = await call(placementSession, "DELETE", `jobs/${postBody.job.id}`);
    expect(delRes.status).toBe(200);

    // Verify removed
    const afterDelRes = await call(placementSession, "GET", "jobs");
    const afterOverview = afterDelRes.body as import("@/lib/api/jobs-schemas").PlacementJobsOverview;
    expect(afterOverview.jobs.some((j) => j.id === postBody.job.id)).toBe(false);
  });
});

