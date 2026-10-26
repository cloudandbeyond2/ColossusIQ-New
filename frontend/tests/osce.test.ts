import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { dispatch } from "@/lib/api/mock/router";
import type { SessionPayload } from "@/lib/auth/session";
import type { OsceOverview } from "@/lib/api/osce-schemas";

const hodSession: SessionPayload = {
  sub: "hod-med-1",
  role: "hod",
  name: "Dr. S. Venkatesh (HOD)",
  tenant: "TNTU",
  college: "COL-1001",
  mfa: true,
  exp: 9999999999,
};

const facultySession: SessionPayload = {
  sub: "faculty-med-1",
  role: "faculty",
  name: "Dr. A. Meenakshi (Associate Prof)",
  tenant: "TNTU",
  college: "COL-1001",
  mfa: true,
  exp: 9999999999,
};

const studentSession: SessionPayload = {
  sub: "student-med-1",
  role: "student",
  name: "Sneha Varma",
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

const q = new URLSearchParams();

const overview = async (session: SessionPayload) => (await dispatch("GET", ["osce"], undefined, session, q)).body as OsceOverview;

describe("OSCE & Skills Simulation Lab API", () => {
  it("allows HOD to fetch OSCE overview", async () => {
    const res = await dispatch("GET", ["osce"], undefined, hodSession, q);
    expect(res.status).toBe(200);
    const body = res.body as OsceOverview;
    expect(body).toBeDefined();
    expect(body.kpis.activeStations).toBeGreaterThan(0);
    expect(body.stations.length).toBeGreaterThan(0);
    expect(body.sessions.length).toBeGreaterThan(0);
    expect(body.bookings.length).toBeGreaterThan(0);
    expect(body.results.length).toBeGreaterThan(0);
    expect(body.equipment.length).toBeGreaterThan(0);
  });

  it("allows Student to fetch OSCE overview and book a practice slot", async () => {
    const res = await dispatch("GET", ["osce"], undefined, studentSession, q);
    expect(res.status).toBe(200);

    const bookingRes = await dispatch(
      "POST",
      ["osce", "bookings"],
      {
        applicantName: "Sneha Varma (MBBS Intern)",
        applicantRole: "Student",
        stationOrRoom: "Surgical Skills Cubicle 1",
        equipment: "Suture Pad & Kit",
        date: "2026-10-30",
        timeSlot: "16:00 - 17:30",
        purpose: "Independent Practice",
        notes: "Preparing for surgical rotation OSCE station.",
      },
      studentSession,
      q
    );
    expect(bookingRes.status).toBe(200);
    const booking = bookingRes.body as any;
    // a student books as themselves, whatever name the form sent
    expect(booking.applicantName).toBe("Sneha Varma");
    expect(booking.applicantRole).toBe("Student");
    expect(booking.status).toBe("Pending Review");
  });

  it("allows HOD to create a new OSCE station with checklist", async () => {
    const createRes = await dispatch(
      "POST",
      ["osce", "stations"],
      {
        title: "Pediatric Lumbar Puncture on Simulator",
        department: "Pediatrics & Neonatology",
        domain: "Procedure",
        durationMinutes: 10,
        totalMarks: 20,
        passMarks: 15,
        nmcCompetencyCode: "PE-20.1",
        room: "Skills Cubicle 5",
        manikinEquipment: "Pediatric Lumbar Puncture Simulator",
        criticalStepRequired: true,
        criticalStepDescription: "Strict aseptic drape and needle entry at L3-L4 or L4-L5 interspace without lateral deviation.",
        checklist: [
          { step: "Patient positioning in curled lateral decubitus position", maxMarks: 4, isCritical: true, category: "Preparation" },
          { step: "Identification of intercrestal Tuffier line", maxMarks: 4, isCritical: true, category: "Execution" },
          { step: "Spinal needle advancement with stylet in place; feel pop", maxMarks: 8, isCritical: true, category: "Execution" },
          { step: "Collect CSF drops passively; reinsert stylet before needle withdrawal", maxMarks: 4, isCritical: false, category: "Patient Safety" },
        ],
      },
      hodSession,
      q
    );
    expect(createRes.status).toBe(200);
    const station = createRes.body as any;
    expect(station.title).toBe("Pediatric Lumbar Puncture on Simulator");
    expect(station.checklist.length).toBe(4);
  });

  it("allows HOD to schedule an OSCE examination session", async () => {
    const sessRes = await dispatch(
      "POST",
      ["osce", "sessions"],
      {
        title: "Phase 3 Part 2 Comprehensive Clinical OSCE Circuit",
        batch: "MBBS 2022 (Final Year)",
        department: "Multidisciplinary Clinical Board",
        date: "2026-12-05",
        timeSlot: "08:30 AM - 01:30 PM",
        venue: "Central Skills Simulation Pavilion",
        totalCandidates: 75,
        leadExaminer: "Prof. Dr. S. Venkatesh, MD",
      },
      hodSession,
      q
    );
    expect(sessRes.status).toBe(200);
    const session = sessRes.body as any;
    expect(session.title).toBe("Phase 3 Part 2 Comprehensive Clinical OSCE Circuit");
    expect(session.status).toBe("Scheduled");
  });

  it("allows Faculty/HOD to grade candidate and certify competency", async () => {
    const gradeRes = await dispatch(
      "POST",
      ["osce", "grade"],
      {
        studentName: "Mohamed Tariq",
        rollNo: "MED22-078",
        batch: "MBBS 2022",
        stationId: (await overview(hodSession)).stations[0]!.id,
        score: 18,
        criticalStepMet: true,
        evaluatorRemarks: "Excellent rhythm and chest compression technique. Prompt AED pad attachment.",
        cbmeCertified: true,
      },
      facultySession,
      q
    );
    expect(gradeRes.status).toBe(200);
    const res = gradeRes.body as any;
    expect(res.studentName).toBe("Mohamed Tariq");
    expect(res.grade).toBe("Distinction");
    expect(res.cbmeCertified).toBe(true);
  });

  it("allows HOD to approve skills lab booking", async () => {
    const approveRes = await dispatch(
      "PATCH",
      ["osce", "bookings", (await overview(hodSession)).bookings.find((b) => b.status === "Pending Review")!.id, "status"],
      {
        status: "Approved",
      },
      hodSession,
      q
    );
    expect(approveRes.status).toBe(200);
    const booking = approveRes.body as any;
    expect(booking.status).toBe("Approved");
  });

  it("blocks non-staff (Student) from creating stations or sessions", async () => {
    const unauthorizedRes = await dispatch(
      "POST",
      ["osce", "stations"],
      {
        title: "Unauthorized Station",
        department: "General Surgery",
        domain: "Procedure",
        durationMinutes: 5,
        totalMarks: 20,
        passMarks: 10,
        nmcCompetencyCode: "SU-1.1",
        room: "Room 1",
        manikinEquipment: "Pad",
        criticalStepRequired: false,
        criticalStepDescription: "None",
        checklist: [{ step: "Test", maxMarks: 10, isCritical: false, category: "Execution" }],
      },
      studentSession,
      q
    );
    expect(unauthorizedRes.status).toBe(403);
  });

  it("derives a station's pass rate and a session's evaluated count from graded results", async () => {
    const before = await overview(hodSession);
    const station = before.stations[0]!;
    const exam = before.sessions[0]!;
    const res = await dispatch(
      "POST",
      ["osce", "grade"],
      { studentName: "Derived Check", rollNo: "DER-001", batch: "MBBS 2022", stationId: station.id, sessionId: exam.id, score: 0, criticalStepMet: true, evaluatorRemarks: "", cbmeCertified: true },
      facultySession,
      q,
    );
    expect(res.status).toBe(200);
    const graded = res.body as any;
    expect(graded.grade).toBe("Remediation Needed");
    expect(graded.cbmeCertified).toBe(false); // can't certify a failed station
    const after = await overview(hodSession);
    expect(after.stations.find((s) => s.id === station.id)!.passRate).toBeLessThan(station.passRate);
    expect(after.sessions.find((s) => s.id === exam.id)!.evaluatedCount).toBe(exam.evaluatedCount + 1);
  });

  it("rejects a score above the station's total marks", async () => {
    const station = (await overview(hodSession)).stations[0]!;
    const res = await dispatch(
      "POST",
      ["osce", "grade"],
      { studentName: "Too High", rollNo: "TH-1", batch: "B", stationId: station.id, score: station.totalMarks + 1, criticalStepMet: true, evaluatorRemarks: "", cbmeCertified: false },
      hodSession,
      q,
    );
    expect(res.status).toBe(400);
  });

  it("shows students only their own bookings, and reports manage permission by role", async () => {
    const asStudent = await overview(studentSession);
    expect(asStudent.permissions.manage).toBe(false);
    expect(asStudent.bookings.every((b) => b.applicantName === "Sneha Varma")).toBe(true);
    expect(asStudent.results.every((r) => r.rollNo === asStudent.viewer.rollNo)).toBe(true);
    expect((await overview(facultySession)).permissions.manage).toBe(true);
  });

  it("lets staff add equipment, rejects a duplicate serial, and derives NMC status", async () => {
    const body = { name: "Test Trainer", serialNo: "TT-0001", category: "Task Trainer", room: "Lab 9", status: "Operational", lastInspection: "2026-10-01", nextMaintenance: "2027-04-01", utilizationHoursWeek: 4 };
    const created = await dispatch("POST", ["osce", "equipment"], body, hodSession, q);
    expect(created.status).toBe(200);
    expect((created.body as any).nmcComplianceStatus).toBe("Fully Compliant");
    expect((await dispatch("POST", ["osce", "equipment"], body, hodSession, q)).status).toBe(409);
    expect((await dispatch("POST", ["osce", "equipment"], body, studentSession, q)).status).toBe(403);

    const id = (created.body as any).id as string;
    const patched = await dispatch("PATCH", ["osce", "equipment", id], { status: "Maintenance" }, hodSession, q);
    expect(patched.status).toBe(200);
    expect((patched.body as any).nmcComplianceStatus).toBe("Action Needed");
  });

  it("lets staff move a circuit through its statuses but not students", async () => {
    const exam = (await overview(hodSession)).sessions[0]!;
    const ok = await dispatch("PATCH", ["osce", "sessions", exam.id, "status"], { status: "In Progress" }, hodSession, q);
    expect(ok.status).toBe(200);
    expect((ok.body as any).status).toBe("In Progress");
    expect((await dispatch("PATCH", ["osce", "sessions", exam.id, "status"], { status: "Completed" }, studentSession, q)).status).toBe(403);
  });
});
