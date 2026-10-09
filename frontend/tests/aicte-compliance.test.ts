import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { dispatch } from "@/lib/api/mock/router";
import { academicYearOf, cadreOf, cadreScore } from "@/lib/api/mock/aicte-compliance";
import { resetAicteMemory } from "@/lib/api/mock/aicte-store";
import type { SessionPayload } from "@/lib/auth/session";
import { AicteComplianceData } from "@/lib/api/schemas";

const session = (role: SessionPayload["role"], college = "COL-1001"): SessionPayload => ({
  sub: `test-${role}`,
  role,
  name: "Dr. Lakshmi Sundaram",
  tenant: "t",
  college,
  mfa: true,
  exp: 9e9,
});

const q = new URLSearchParams();
const inst = session("institution");
const overview = async (s = inst) => (await dispatch("GET", ["aicte-compliance"], undefined, s, q)).body as AicteComplianceData;

const committee = {
  status: "Constituted & Active",
  chairperson: "Dr. Lakshmi Sundaram",
  membersCount: 7,
  lastMeetingDate: new Date().toISOString().slice(0, 10),
  momStatus: "Certified by Principal",
};

beforeEach(() => resetAicteMemory());

describe("aicte-compliance API", () => {
  it("fetches the overview computed from the college's records", async () => {
    const res = await dispatch("GET", ["aicte-compliance"], undefined, inst, q);
    expect(res.status).toBe(200);
    expect(AicteComplianceData.safeParse(res.body).success).toBe(true);

    const data = res.body as AicteComplianceData;
    expect(data.college.id).toBe("COL-1001");
    expect(data.college.pid).toBe("1-1101-AICTE-TN");
    expect(data.pidRecorded).toBe(false);
    expect(data.academicYear).toBe(academicYearOf());
    expect(data.kpis).toHaveLength(4);
    expect(data.norms.map((n) => n.id)).toEqual(["NORM-FSR", "NORM-CADRE", "NORM-STATUTORY", "NORM-CURRICULUM", "NORM-DISCLOSURE", "NORM-SAFETY"]);
    expect(data.committees.map((c) => c.name)).toEqual([
      "Anti-Ragging Committee & Squad",
      "Internal Complaints Committee (ICC) / POSH",
      "Student Grievance Redressal Committee (SGRC)",
      "SC / ST Committee & Equal Opportunity Cell",
      "Internal Quality Assurance Cell (IQAC)",
      "Industry-Institute Interaction Cell (IIIC) & Placement",
    ]);
    expect(data.canManage).toBe(true);
    expect(data.departments.length).toBeGreaterThan(0);
    expect(data.strengths.length).toBeGreaterThan(0);
    expect(data.deficiencies.length).toBeGreaterThan(0);
  });

  it("does not claim committees are constituted until the Principal records them", async () => {
    const before = await overview();
    expect(before.committees.every((c) => !c.recorded && c.status === "Not Recorded")).toBe(true);
    expect(before.committeeSummary).toEqual({ constituted: 0, total: 6, recorded: 0 });
    expect(before.norms.find((n) => n.id === "NORM-STATUTORY")?.score).toBe(0);
    expect(before.norms.find((n) => n.id === "NORM-SAFETY")?.score).toBe(0);
    expect(before.deficiencies.some((d) => d.includes("not been recorded"))).toBe(true);
  });

  it("saves a committee and moves the scorecard with it", async () => {
    const before = await overview();
    const res = await dispatch("PATCH", ["aicte-compliance", "committees", "COM-01"], committee, inst, q);
    expect(res.status).toBe(200);

    const after = await overview();
    const c = after.committees.find((x) => x.id === "COM-01")!;
    expect(c).toMatchObject({ recorded: true, status: "Constituted & Active", chairperson: "Dr. Lakshmi Sundaram", membersCount: 7, momStatus: "Certified by Principal", meetingOverdue: false });
    expect(after.committeeSummary).toEqual({ constituted: 1, total: 6, recorded: 1 });
    expect(after.norms.find((n) => n.id === "NORM-STATUTORY")!.score).toBeGreaterThan(before.norms.find((n) => n.id === "NORM-STATUTORY")!.score);
    expect(after.overallScore).toBeGreaterThan(before.overallScore);

    // a constituted committee that has not met for over a year is flagged
    await dispatch("PATCH", ["aicte-compliance", "committees", "COM-01"], { ...committee, lastMeetingDate: "2024-01-15" }, inst, q);
    const stale = (await overview()).committees.find((x) => x.id === "COM-01")!;
    expect(stale.meetingOverdue).toBe(true);
    expect((await overview()).deficiencies.some((d) => d.includes("has not met in the last 12 months"))).toBe(true);
  });

  it("rejects a bad committee id or payload", async () => {
    expect((await dispatch("PATCH", ["aicte-compliance", "committees", "COM-99"], committee, inst, q)).status).toBe(404);
    expect((await dispatch("PATCH", ["aicte-compliance", "committees", "COM-01"], { ...committee, status: "Great" }, inst, q)).status).toBe(400);
    expect((await dispatch("PATCH", ["aicte-compliance", "committees", "COM-01"], { ...committee, lastMeetingDate: "yesterday" }, inst, q)).status).toBe(400);
  });

  it("logs, updates and removes compliance actions, and keeps them", async () => {
    const created = await dispatch(
      "POST",
      ["aicte-compliance", "actions"],
      { title: "Verify bandwidth for Lab 3", category: "Infrastructure & Labs", priority: "High", assignedTo: "Network Administrator", dueDate: "2020-01-01", notes: "1 Gbps leased line" },
      inst,
      q
    );
    expect(created.status).toBe(200);
    const action = created.body as { id: string; status: string; createdBy: string };
    expect(action.status).toBe("Open");
    expect(action.createdBy).toBe("Dr. Lakshmi Sundaram");

    let data = await overview();
    expect(data.actions.find((a) => a.id === action.id)?.overdue).toBe(true);
    expect(data.actionSummary.overdue).toBe(1);
    expect(data.deficiencies.some((d) => d.includes("past due"))).toBe(true);

    const patched = await dispatch("PATCH", ["aicte-compliance", "actions", action.id], { actionId: action.id, status: "Resolved" }, inst, q);
    expect(patched.status).toBe(200);
    data = await overview();
    const resolved = data.actions.find((a) => a.id === action.id)!;
    expect(resolved.status).toBe("Resolved");
    expect(resolved.resolvedAt).toBe(new Date().toISOString().slice(0, 10));
    expect(resolved.overdue).toBe(false);
    expect(data.actionSummary).toMatchObject({ open: 0, resolved: 1, overdue: 0 });

    expect((await dispatch("DELETE", ["aicte-compliance", "actions", action.id], undefined, inst, q)).status).toBe(200);
    expect((await overview()).actions).toHaveLength(0);
    expect((await dispatch("DELETE", ["aicte-compliance", "actions", action.id], undefined, inst, q)).status).toBe(404);
    expect((await dispatch("PATCH", ["aicte-compliance", "actions", "ACT-NOPE"], { status: "Open" }, inst, q)).status).toBe(404);
  });

  it("validates a new action", async () => {
    const base = { title: "Check", category: "Faculty & Cadre", priority: "Low", assignedTo: "Principal Office", notes: "" };
    expect((await dispatch("POST", ["aicte-compliance", "actions"], { ...base, dueDate: "soon" }, inst, q)).status).toBe(400);
    expect((await dispatch("POST", ["aicte-compliance", "actions"], { ...base, title: "x", dueDate: "2026-12-01" }, inst, q)).status).toBe(400);
  });

  it("records the AICTE permanent id and can go back to the reference", async () => {
    expect((await dispatch("PUT", ["aicte-compliance", "profile"], { pid: "1-9321458921" }, inst, q)).status).toBe(200);
    let data = await overview();
    expect(data.college.pid).toBe("1-9321458921");
    expect(data.pidRecorded).toBe(true);
    expect(data.norms.find((n) => n.id === "NORM-DISCLOSURE")!.deficiencyNotes).not.toContain("AICTE permanent id");

    expect((await dispatch("PUT", ["aicte-compliance", "profile"], { pid: "<script>" }, inst, q)).status).toBe(400);
    await dispatch("PUT", ["aicte-compliance", "profile"], { pid: "" }, inst, q);
    data = await overview();
    expect(data.pidRecorded).toBe(false);
    expect(data.college.pid).toBe("1-1101-AICTE-TN");
  });

  it("keeps each college's records separate", async () => {
    await dispatch("PATCH", ["aicte-compliance", "committees", "COM-02"], committee, inst, q);
    const other = await overview(session("institution", "COL-1002"));
    expect(other.college.id).toBe("COL-1002");
    expect(other.committeeSummary.recorded).toBe(0);
    expect((await overview()).committeeSummary.recorded).toBe(1);
  });

  it("lets a HOD read but not change, and blocks other roles", async () => {
    const hod = session("hod");
    expect(((await dispatch("GET", ["aicte-compliance"], undefined, hod, q)).body as AicteComplianceData).canManage).toBe(false);
    expect((await dispatch("PATCH", ["aicte-compliance", "committees", "COM-01"], committee, hod, q)).status).toBe(403);
    expect((await dispatch("POST", ["aicte-compliance", "actions"], { title: "Test" }, hod, q)).status).toBe(403);

    const student = session("student");
    expect((await dispatch("GET", ["aicte-compliance"], undefined, student, q)).status).toBe(403);
    expect((await dispatch("POST", ["aicte-compliance", "actions"], { title: "Test" }, student, q)).status).toBe(403);
    expect((await dispatch("PUT", ["aicte-compliance", "profile"], { pid: "1-123" }, student, q)).status).toBe(403);
  });

  it("shows the Super Admin a college read-only at All colleges, and edits once one is chosen", async () => {
    const all = session("admin", "all");
    const res = await dispatch("GET", ["aicte-compliance"], undefined, all, q);
    expect(res.status).toBe(200);
    expect((res.body as AicteComplianceData).canManage).toBe(false);
    expect((await dispatch("PATCH", ["aicte-compliance", "committees", "COM-01"], committee, all, q)).status).toBe(409);
    expect((await dispatch("PATCH", ["aicte-compliance", "committees", "COM-01"], committee, session("admin", "COL-1001"), q)).status).toBe(200);
  });

  it("exports valid CSV structure from compliance data", async () => {
    const { toCsv } = await import("@/lib/csv");
    const data = await overview();
    const csv = toCsv([
      ["AICTE Compliance Evaluation Report", data.college.name, `PID: ${data.college.pid}`, `AY: ${data.academicYear}`],
      [],
      ["Norm ID", "Category", "Norm Name", "Requirement", "Actual Value", "Score (%)", "Status", "Notes"],
      ...data.norms.map((n) => [n.id, n.category, n.name, n.normRequirement, n.actualValue, `${n.score}%`, n.status, n.deficiencyNotes]),
    ]);
    expect(csv).toContain("AICTE Compliance Evaluation Report");
    expect(csv).toContain(data.college.pid);
    expect(csv).toContain("Faculty-Student Ratio (FSR)");
  });
});

describe("aicte-compliance rules", () => {
  it("scores the cadre against 1 : 2 : 6", () => {
    expect(cadreScore(1, 2, 6)).toBe(100);
    expect(cadreScore(0, 0, 0)).toBe(0);
    expect(cadreScore(0, 0, 9)).toBeLessThan(cadreScore(1, 2, 6));
    expect(cadreScore(2, 4, 12)).toBe(100);
    expect(cadreScore(9, 0, 0)).toBeLessThan(40);
  });

  it("classifies designations", () => {
    expect(cadreOf("Professor & HOD")).toBe("prof");
    expect(cadreOf("Principal & Professor")).toBe("prof");
    expect(cadreOf("Associate Professor")).toBe("assoc");
    expect(cadreOf("Assistant Professor")).toBe("asst");
    expect(cadreOf("Lecturer")).toBe("asst");
  });

  it("starts the academic year in July", () => {
    expect(academicYearOf(new Date("2026-10-09T00:00:00Z"))).toBe("2026–2027");
    expect(academicYearOf(new Date("2027-03-01T00:00:00Z"))).toBe("2026–2027");
    expect(academicYearOf(new Date("2026-06-30T00:00:00Z"))).toBe("2025–2026");
  });
});
