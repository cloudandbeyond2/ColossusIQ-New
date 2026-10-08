import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { dispatch } from "@/lib/api/mock/router";
import { resetEmployersMemory } from "@/lib/api/mock/employer-store";
import type { EmployerItem, EmployerOverview } from "@/lib/api/employer-schemas";
import type { SessionPayload } from "@/lib/auth/session";

const base: SessionPayload = {
  sub: "placement-user-1",
  role: "placement",
  name: "Placement Officer",
  tenant: "uni-tntu",
  college: "COL-1001",
  mfa: true,
  exp: 9e9,
};

const who = (
  college: string,
  role: SessionPayload["role"] = "placement",
  sub = "p1"
): SessionPayload => ({ ...base, college, role, sub });

const q = new URLSearchParams();
const call = (s: SessionPayload, method: string, path: string, body?: unknown) =>
  dispatch(method, path.split("/"), body, s, q);

const draft = (over: Record<string, unknown> = {}) => ({
  company: "Apex Technologies",
  sector: "IT & Software",
  tier: "Active",
  website: "https://apextech.example.com",
  location: "Chennai, Tamil Nadu",
  contactName: "Rajesh Kannan",
  contactDesignation: "University Hiring Lead",
  contactEmail: "rajesh.k@apextech.example.com",
  contactPhone: "+91 98401 11223",
  contactLinkedin: "https://linkedin.com/in/rajesh-apex",
  mouStatus: "Active MoU",
  mouValidUntil: "2027-12-31",
  totalHires: 15,
  averagePackage: 8.5,
  highestPackage: 12.0,
  lastDriveDate: "2025-11-10",
  nextDriveDate: "2026-11-20",
  notes: "Core hiring partner for web systems and QA engineering.",
  ...over,
});

beforeEach(() => {
  resetEmployersMemory();
});

describe("Employers & Recruiter Relationships API", () => {
  it("creates and lists corporate employers with summary metrics", async () => {
    const s = who("COL-1001");
    const res1 = await call(s, "POST", "employers", draft({ company: "Alpha Systems", totalHires: 10, averagePackage: 9 }));
    expect(res1.status).toBe(201);
    const created1 = res1.body as EmployerItem;
    expect(created1.company).toBe("Alpha Systems");
    expect(created1.tier).toBe("Active");

    const res2 = await call(s, "POST", "employers", draft({ company: "Beta Corp", tier: "Tier-1 Partner", totalHires: 25, averagePackage: 18, highestPackage: 24 }));
    expect(res2.status).toBe(201);

    const listRes = await call(s, "GET", "employers");
    expect(listRes.status).toBe(200);
    const overview = listRes.body as EmployerOverview;
    expect(overview.items).toHaveLength(2);
    expect(overview.summary.totalEmployers).toBe(2);
    expect(overview.summary.tier1Count).toBe(1);
    expect(overview.summary.totalHires3Yr).toBe(35);
    expect(overview.summary.averagePackage).toBe(13.5);
    expect(overview.canEdit).toBe(true);
  });

  it("validates employer input and rejects duplicates or invalid data", async () => {
    const s = who("COL-1001");
    // Invalid company name
    expect((await call(s, "POST", "employers", draft({ company: "A" }))).status).toBe(422);
    // Invalid email
    expect((await call(s, "POST", "employers", draft({ contactEmail: "not-an-email" }))).status).toBe(422);
    // Highest package less than average package
    expect((await call(s, "POST", "employers", draft({ averagePackage: 15, highestPackage: 10 }))).status).toBe(422);

    // Duplicate company
    const first = await call(s, "POST", "employers", draft({ company: "Unique Corp" }));
    expect(first.status).toBe(201);
    const dup = await call(s, "POST", "employers", draft({ company: "unique corp" }));
    expect(dup.status).toBe(409);
  });

  it("edits an existing employer record", async () => {
    const s = who("COL-1001");
    const created = (await call(s, "POST", "employers", draft({ company: "Delta Tech", totalHires: 5 }))).body as EmployerItem;

    const updateRes = await call(s, "PUT", `employers/${created.id}`, draft({
      company: "Delta Tech Solutions",
      totalHires: 20,
      tier: "Tier-1 Partner",
    }));
    expect(updateRes.status).toBe(200);
    const updated = updateRes.body as EmployerItem;
    expect(updated.company).toBe("Delta Tech Solutions");
    expect(updated.totalHires).toBe(20);
    expect(updated.tier).toBe("Tier-1 Partner");
  });

  it("deletes an employer record", async () => {
    const s = who("COL-1001");
    const created = (await call(s, "POST", "employers", draft({ company: "Gamma Labs" }))).body as EmployerItem;

    const delRes = await call(s, "DELETE", `employers/${created.id}`);
    expect(delRes.status).toBe(200);

    const getRes = await call(s, "GET", `employers/${created.id}`);
    expect(getRes.status).toBe(404);
  });

  it("enforces tenant isolation between different colleges", async () => {
    const colA = who("COL-1001");
    const colB = who("COL-1002");

    await call(colA, "POST", "employers", draft({ company: "College A Recruiter" }));
    const overviewB = (await call(colB, "GET", "employers")).body as EmployerOverview;
    expect(overviewB.items.some((e) => e.company === "College A Recruiter")).toBe(false);
  });

  it("permits leadership read-only and restricts modification to placement role", async () => {
    const placementUser = who("COL-1001", "placement");
    const hodUser = who("COL-1001", "hod");
    const studentUser = who("COL-1001", "student");

    await call(placementUser, "POST", "employers", draft({ company: "Global Tech" }));

    // HOD can read
    const hodRes = await call(hodUser, "GET", "employers");
    expect(hodRes.status).toBe(200);
    expect((hodRes.body as EmployerOverview).canEdit).toBe(false);

    // HOD cannot create
    const hodPost = await call(hodUser, "POST", "employers", draft({ company: "HOD Added" }));
    expect(hodPost.status).toBe(403);

    // Student cannot access
    const studentGet = await call(studentUser, "GET", "employers");
    expect(studentGet.status).toBe(403);
  });
});
