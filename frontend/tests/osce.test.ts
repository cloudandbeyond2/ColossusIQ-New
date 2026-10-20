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
    expect(booking.applicantName).toBe("Sneha Varma (MBBS Intern)");
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
        stationId: "st-1",
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
      ["osce", "bookings", "book-103", "status"],
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
});
