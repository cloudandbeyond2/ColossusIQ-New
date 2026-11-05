import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MODULES } from "@/config/modules";
import { RESOURCES, emptyValues, recordSchema } from "@/config/resources";
import { dispatch } from "@/lib/api/mock/router";
import type { SessionPayload } from "@/lib/auth/session";

const session = (role: SessionPayload["role"]): SessionPayload => ({ sub: `t-${role}`, role, name: "Tester", tenant: "t", college: role === "admin" ? "all" : "COL-1001", mfa: true, exp: 9e9 });
const q = new URLSearchParams();

const validAdmission = {
  ...emptyValues(RESOURCES.admissions!),
  fullName: "Test Applicant",
  dob: "2008-05-14",
  gender: "Female",
  email: "test.applicant@example.com",
  phone: "9876543210",
  state: "Tamil Nadu",
  board: "State Board",
  hscPercent: 91.5,
  program: "B.E. Computer Science & Engineering",
  quota: "Government",
  category: "BC",
  guardianName: "Parent Name",
  guardianPhone: "9123456780",
  status: "Applied",
};

describe("CRUD resource definitions", () => {
  it("every crud module points at a defined resource", async () => {
    for (const m of MODULES.filter((x) => x.template === "crud")) expect(RESOURCES[m.resource ?? ""], m.slug).toBeDefined();
  });
  it("schemas reject unknown keys (mass assignment)", async () => {
    expect(recordSchema(RESOURCES.admissions!).safeParse({ ...validAdmission, id: "ADM-1", version: 99 }).success).toBe(false);
    expect(recordSchema(RESOURCES.admissions!).safeParse(validAdmission).success).toBe(true);
  });
  it("validates formats", async () => {
    const s = recordSchema(RESOURCES.admissions!);
    expect(s.safeParse({ ...validAdmission, phone: "12345" }).success).toBe(false);
    expect(s.safeParse({ ...validAdmission, hscPercent: 140 }).success).toBe(false);
    expect(s.safeParse({ ...validAdmission, dob: "1960-01-01" }).success).toBe(false);
    expect(s.safeParse({ ...validAdmission, status: "Hacked" }).success).toBe(false);
  });
});

describe("records API", () => {
  const inst = session("institution");

  it("lists, creates, reads, updates and deletes an application", async () => {
    const list = (await dispatch("GET", ["records", "admissions"], undefined, inst, q));
    expect(list.status).toBe(200);

    const created = (await dispatch("POST", ["records", "admissions"], { data: validAdmission }, inst, q));
    expect(created.status).toBe(201);
    const rec = created.body as { id: string; version: number };
    expect(rec.id).toMatch(/^ADM-26-/);

    expect((await dispatch("GET", ["records", "admissions", rec.id], undefined, inst, q)).status).toBe(200);

    const updated = (await dispatch("PUT", ["records", "admissions", rec.id], { data: { ...validAdmission, status: "Shortlisted" }, version: rec.version }, inst, q));
    expect(updated.status).toBe(200);
    expect((updated.body as { version: number }).version).toBe(2);

    // Stale version → conflict (optimistic concurrency)
    expect((await dispatch("PUT", ["records", "admissions", rec.id], { data: validAdmission, version: 1 }, inst, q)).status).toBe(409);

    expect((await dispatch("DELETE", ["records", "admissions", rec.id], undefined, inst, q)).status).toBe(200);
    expect((await dispatch("GET", ["records", "admissions", rec.id], undefined, inst, q)).status).toBe(404);

    // Duplicate submission protection (e.g. rapid double-clicks)
    const first = await dispatch("POST", ["records", "admissions"], { data: { ...validAdmission, email: "double.click@example.com" } }, inst, q);
    expect(first.status).toBe(201);
    const second = await dispatch("POST", ["records", "admissions"], { data: { ...validAdmission, email: "double.click@example.com" } }, inst, q);
    expect(second.status).toBe(200);
    expect((second.body as { id: string }).id).toBe((first.body as { id: string }).id);
  });

  it("returns field errors for invalid input", async () => {
    const r = (await dispatch("POST", ["records", "admissions"], { data: { ...validAdmission, email: "not-an-email" } }, inst, q));
    expect(r.status).toBe(422);
    expect((r.body as { error: { fields: Record<string, string> } }).error.fields.email).toBeTruthy();
  });

  it("blocks roles without access", async () => {
    expect((await dispatch("GET", ["records", "admissions"], undefined, session("student"), q)).status).toBe(403);
    expect((await dispatch("GET", ["records", "users"], undefined, session("faculty"), q)).status).toBe(403);
  });

  it("lets view-only roles read but not write, with contact details masked", async () => {
    const hod = session("hod");
    const list = (await dispatch("GET", ["records", "staff"], undefined, hod, q));
    expect(list.status).toBe(200);
    const body = list.body as { items: Array<Record<string, string>>; canManage: boolean };
    expect(body.canManage).toBe(false);
    expect(body.items[0]?.phone).toMatch(/•/);
    expect((await dispatch("POST", ["records", "staff"], { data: {} }, hod, q)).status).toBe(403);
    const id = body.items[0]!.id!;
    expect((await dispatch("DELETE", ["records", "staff", id], undefined, hod, q)).status).toBe(403);
  });

  it("students can view events but not create them", async () => {
    expect((await dispatch("GET", ["records", "events"], undefined, session("student"), q)).status).toBe(200);
    expect((await dispatch("POST", ["records", "events"], { data: {} }, session("student"), q)).status).toBe(403);
  });

  it("prevents privilege escalation to Platform Admin", async () => {
    const user = { ...emptyValues(RESOURCES.users!), fullName: "Eve", email: "eve@example.com", role: "University Super Admin", status: "Active" };
    const byInstitution = (await dispatch("POST", ["records", "users"], { data: user }, inst, q));
    expect(byInstitution.status).toBe(409);
    expect((byInstitution.body as { error: { fields: Record<string, string> } }).error.fields.role).toMatch(/Super Admin/);
    expect((await dispatch("POST", ["records", "users"], { data: user, collegeId: "COL-1001" }, session("admin"), q)).status).toBe(201);
  });

  it("enforces unique emails for users", async () => {
    const u = { ...emptyValues(RESOURCES.users!), fullName: "Dup", email: "dup@example.com", role: "Faculty", status: "Active" };
    expect((await dispatch("POST", ["records", "users"], { data: u }, inst, q)).status).toBe(201);
    expect((await dispatch("POST", ["records", "users"], { data: { ...u, email: "DUP@example.com" } }, inst, q)).status).toBe(409);
  });

  it("rejects unknown resources and unsafe ids", async () => {
    expect((await dispatch("GET", ["records", "secrets"], undefined, inst, q)).status).toBe(404);
    expect((await dispatch("GET", ["records", "admissions", "../../x"], undefined, inst, q)).status).toBe(404);
    expect((await dispatch("GET", ["records", "__proto__"], undefined, inst, q)).status).toBe(404);
  });
});

describe("departments", () => {
  const inst = session("institution");
  type Row = { id: string; department: string; faculty: number; students: number; programmes: number; readiness: number };
  const list = async () => (await dispatch("GET", ["records", "departments"], undefined, inst, new URLSearchParams({ pageSize: "50" }))).body as { items: Row[]; total: number };

  it("lists the college's departments with computed figures", async () => {
    const d = await list();
    expect(d.items.map((r) => r.department)).toContain("Computer Science & Engineering");
    for (const r of d.items) {
      expect(r.faculty).toBeGreaterThanOrEqual(0);
      expect(r.readiness).toBeGreaterThanOrEqual(0);
      expect(r.readiness).toBeLessThanOrEqual(100);
    }
  });

  it("adds, edits and removes a department; one row per department, from the college's stream", async () => {
    const before = await list();
    const cse = before.items.find((r) => r.department === "Computer Science & Engineering")!;
    // Already listed
    const dup = await dispatch("POST", ["records", "departments"], { data: { department: "Computer Science & Engineering", head: "", established: null, status: "Active", email: "", phone: "", notes: "" } }, inst, q);
    expect(dup.status).toBe(409);
    // Not an engineering department
    const wrong = await dispatch("POST", ["records", "departments"], { data: { department: "Anatomy", head: "", established: null, status: "Active", email: "", phone: "", notes: "" } }, inst, q);
    expect(wrong.status).toBe(409);

    expect((await dispatch("DELETE", ["records", "departments", cse.id], undefined, inst, q)).status).toBe(200);
    const added = await dispatch("POST", ["records", "departments"], { data: { department: "Computer Science & Engineering", head: "Dr. New Head", established: 2001, status: "Active", email: "cse@ait.edu.in", phone: "9876543210", notes: "" } }, inst, q);
    expect(added.status).toBe(201);
    const rec = added.body as { id: string; version: number };
    const edited = await dispatch("PUT", ["records", "departments", rec.id], { data: { department: "Computer Science & Engineering", head: "Dr. Changed", established: 2001, status: "Inactive", email: "", phone: "", notes: "" }, version: rec.version }, inst, q);
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({ head: "Dr. Changed", status: "Inactive" });
    // Students are read-only for departments
    expect((await dispatch("POST", ["records", "departments"], { data: { department: "Civil Engineering" } }, session("student"), q)).status).toBe(403);
  });
});

describe("courses", () => {
  const inst = session("institution");
  it("lists courses for the college including creator information and department", async () => {
    const res = await dispatch("GET", ["records", "courses"], undefined, inst, new URLSearchParams({ pageSize: "50" }));
    expect(res.status).toBe(200);
    const body = res.body as { items: Array<Record<string, unknown>>; total: number };
    expect(body.total).toBeGreaterThan(0);
    const first = body.items[0];
    expect(first).toBeDefined();
    expect(first?.department).toBeDefined();
    expect(first?.createdBy).toBeDefined();
  });
});

