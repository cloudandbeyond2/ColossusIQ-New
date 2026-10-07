import "server-only";
import { z } from "zod";
import type { SessionPayload } from "@/lib/auth/session";
import { cleanText } from "@/lib/security/sanitize";
import {
  AlumniNetworkOverview,
  CreateAlumniBody,
  RequestMentorshipBody,
  UpdateMentorshipRequestBody,
} from "@/lib/api/alumni-schemas";
import { alumniStore } from "./alumni-store";
import { getStudentAcademicProfile } from "./student-profile";
import type { MockResult } from "./router";

const ok = (body: unknown, status = 200): MockResult => ({ status, body });
const err = (status: number, code: string, message: string, fields?: Record<string, string>): MockResult => ({
  status,
  body: { error: { code, message, ...(fields ? { fields } : {}) } },
});

export async function dispatchAlumni(
  method: string,
  segs: string[],
  rawBody: unknown,
  s: SessionPayload,
  query: URLSearchParams
): Promise<MockResult> {
  const store = alumniStore();
  const isStaff = ["placement", "incubation", "hod", "faculty", "institution", "admin"].includes(s.role);

  // 1. GET /api/v1/alumni - Returns overview with dynamic match scores and requests
  if (method === "GET" && segs.length === 1) {
    let members = await store.listMembers(s.college);
    const requests = await store.listRequests(s.college, s.role === "student" ? s.sub : undefined);

    // Compute dynamic match score if student is viewing
    if (s.role === "student") {
      try {
        const profile = await getStudentAcademicProfile(s);
        const studentDept = profile.department.toLowerCase();
        const studentSubjs = profile.enrolledSubjects.map((sub) => sub.shortName.toLowerCase());

        members = members.map((m) => {
          let score = 70;
          // Department relevance
          if (m.department && (m.department.toLowerCase() === studentDept || studentDept.includes(m.department.toLowerCase()))) {
            score += 12;
          }
          // Mentorship topic bonus
          if (m.mentorshipTopics.some((t) => t.includes("Placement") || t.includes("Interview"))) {
            score += 6;
          }
          // Skills overlap
          const overlap = m.skills.filter((sk) => studentSubjs.some((sub) => sk.toLowerCase().includes(sub) || sub.includes(sk.toLowerCase()))).length;
          score += Math.min(10, overlap * 4);

          // Availability bonus
          if (m.isAvailable && m.activeMentees < m.maxMentees) {
            score += 2;
          }

          return {
            ...m,
            matchScore: Math.min(96, Math.max(72, score)),
          };
        });
      } catch {
        // Fallback score
      }
    }

    // Sort by match score descending
    members.sort((a, b) => b.matchScore - a.matchScore);

    const companies = [...new Set(members.map((m) => m.company).filter(Boolean))];
    const topics = [...new Set(members.flatMap((m) => m.mentorshipTopics).filter(Boolean))];
    const acceptedCount = requests.filter((r) => r.status === "Accepted" || r.status === "Completed").length;

    const overview: AlumniNetworkOverview = {
      items: members,
      requests,
      summary: {
        totalAlumni: members.length,
        availableMentors: members.filter((m) => m.isAvailable && m.activeMentees < m.maxMentees).length,
        activeRequests: requests.filter((r) => r.status === "Pending").length,
        acceptedRequests: acceptedCount,
        topCompanies: companies.slice(0, 8),
        topics: topics.slice(0, 10),
      },
      canManage: isStaff,
    };

    return ok(overview);
  }

  // 2. POST /api/v1/alumni/request - Student submits mentorship request
  if (method === "POST" && segs[1] === "request") {
    const parse = RequestMentorshipBody.safeParse(rawBody);
    if (!parse.success) {
      return err(422, "validation", "Please check your mentorship request inputs.");
    }

    const { alumniId, topic, preferredMode, message } = parse.data;

    // Verify alumnus exists
    const mentor = await store.getMember(alumniId);
    if (!mentor) {
      return err(404, "not_found", "Selected alumni mentor not found.");
    }

    // Check if student already has a pending request for this mentor
    const existing = await store.listRequests(s.college, s.sub);
    const duplicate = existing.find((r) => r.alumniId === alumniId && r.status === "Pending");
    if (duplicate) {
      return err(409, "duplicate_request", "You already have a pending mentorship request with this alumnus.");
    }

    let studentName = s.name || "Student";
    let rollNo = "";
    let department = "";

    try {
      const profile = await getStudentAcademicProfile(s);
      studentName = profile.name || studentName;
      rollNo = profile.rollNo || "";
      department = profile.department || "";
    } catch {
      // ignore
    }

    const newRequest = await store.createRequest({
      collegeId: s.college,
      alumniId,
      alumniName: mentor.name,
      alumniCompany: mentor.company,
      alumniPosition: mentor.currentPosition,
      studentId: s.sub,
      studentName,
      studentRollNo: rollNo,
      studentDept: department,
      topic: cleanText(topic, 150),
      preferredMode,
      message: message ? cleanText(message, 1000) : "",
      status: "Pending",
      responseNote: "",
      meetingLink: "",
      scheduledAt: null,
    });

    return ok({ ok: true, request: newRequest, message: "Mentorship request sent successfully!" }, 201);
  }

  // 3. POST /api/v1/alumni - Placement/Staff adds a new verified alumnus
  if (method === "POST" && segs.length === 1) {
    if (!isStaff) return err(403, "forbidden", "Only placement coordinators and staff can register alumni mentors.");

    const parse = CreateAlumniBody.safeParse(rawBody);
    if (!parse.success) {
      return err(422, "validation", "Please correct the highlighted fields.");
    }

    const created = await store.createMember(s.college, parse.data);
    return ok({ ok: true, member: created }, 201);
  }

  // 4. PATCH /api/v1/alumni/requests/:id - Update mentorship request
  if (method === "PATCH" && segs[1] === "requests" && segs[2]) {
    const parse = UpdateMentorshipRequestBody.safeParse(rawBody);
    if (!parse.success) return err(422, "validation", "Invalid update payload.");

    const updated = await store.updateRequest(segs[2], parse.data);
    if (!updated) return err(404, "not_found", "Request not found.");

    return ok({ ok: true, request: updated });
  }

  // 5. DELETE /api/v1/alumni/requests/:id - Cancel/withdraw request
  if (method === "DELETE" && segs[1] === "requests" && segs[2]) {
    const deleted = await store.deleteRequest(segs[2]);
    if (!deleted) return err(404, "not_found", "Request not found.");

    return ok({ ok: true, message: "Request cancelled." });
  }

  return err(404, "not_found", "Endpoint not found.");
}
