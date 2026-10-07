import "server-only";
import { Prisma } from "@prisma/client";
import type {
  AlumniMemberItem,
  CreateAlumniBody,
  MentorshipRequestItem,
  UpdateMentorshipRequestBody,
} from "@/lib/api/alumni-schemas";
import type { AlumniStore } from "@/lib/api/mock/alumni-store";
import { db, isUuid } from "./db";
import { collegeUuid } from "./lookups";

interface AlumniMemberDbRow {
  id: string;
  college_id: string;
  name: string;
  batch: string;
  current_position: string;
  company: string;
  location: string;
  degree: string;
  department: string;
  mentorship_topics: string[];
  skills: string[];
  linkedin_url: string;
  email: string;
  bio: string;
  is_available: boolean;
  active_mentees: number;
  max_mentees: number;
  created_at: Date;
  updated_at: Date;
}

interface MentorshipRequestDbRow {
  id: string;
  college_id: string;
  alumni_id: string;
  alumni_name?: string;
  alumni_company?: string;
  alumni_position?: string;
  student_id: string;
  student_name: string;
  student_roll_no: string;
  student_dept: string;
  topic: string;
  preferred_mode: string;
  message: string;
  status: string;
  response_note: string;
  meeting_link: string;
  scheduled_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const toMemberItem = (r: AlumniMemberDbRow): AlumniMemberItem => ({
  id: r.id,
  collegeId: r.college_id,
  name: r.name,
  batch: r.batch,
  currentPosition: r.current_position,
  company: r.company,
  location: r.location || "",
  degree: r.degree || "",
  department: r.department || "",
  mentorshipTopics: r.mentorship_topics || [],
  skills: r.skills || [],
  linkedinUrl: r.linkedin_url || "",
  email: r.email || "",
  bio: r.bio || "",
  isAvailable: r.is_available,
  activeMentees: r.active_mentees,
  maxMentees: r.max_mentees,
  matchScore: 85,
  createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
});

const toRequestItem = (r: MentorshipRequestDbRow): MentorshipRequestItem => ({
  id: r.id,
  collegeId: r.college_id,
  alumniId: r.alumni_id,
  alumniName: r.alumni_name,
  alumniCompany: r.alumni_company,
  alumniPosition: r.alumni_position,
  studentId: r.student_id,
  studentName: r.student_name,
  studentRollNo: r.student_roll_no,
  studentDept: r.student_dept,
  topic: r.topic,
  preferredMode: r.preferred_mode as any,
  message: r.message,
  status: r.status as any,
  responseNote: r.response_note || "",
  meetingLink: r.meeting_link || "",
  scheduledAt: r.scheduled_at instanceof Date ? r.scheduled_at.toISOString() : r.scheduled_at,
  createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
});

async function resolveCollegeId(scope: string): Promise<string | null> {
  if (scope === "all") return null;
  if (isUuid(scope)) return scope;
  try {
    return await collegeUuid(scope);
  } catch {
    return null;
  }
}

export const postgresAlumni: AlumniStore = {
  async listMembers(scope) {
    const t = db();
    const cId = await resolveCollegeId(scope);

    const rows = cId
      ? await t.$queryRaw<AlumniMemberDbRow[]>`
          SELECT * FROM alumni_members 
          WHERE college_id = ${cId}::uuid
          ORDER BY name ASC`
      : await t.$queryRaw<AlumniMemberDbRow[]>`
          SELECT * FROM alumni_members 
          ORDER BY name ASC`;

    return rows.map(toMemberItem);
  },

  async getMember(id) {
    if (!isUuid(id)) return undefined;
    const t = db();
    const rows = await t.$queryRaw<AlumniMemberDbRow[]>`
      SELECT * FROM alumni_members WHERE id = ${id}::uuid LIMIT 1`;
    return rows[0] ? toMemberItem(rows[0]) : undefined;
  },

  async createMember(scope, data) {
    const t = db();
    const cId = await resolveCollegeId(scope);
    if (!cId) throw new Error("A valid college scope is required to create alumni.");

    const rows = await t.$queryRaw<AlumniMemberDbRow[]>`
      INSERT INTO alumni_members (
        college_id, name, batch, current_position, company, location,
        degree, department, mentorship_topics, skills, linkedin_url,
        email, bio, is_available, active_mentees, max_mentees
      ) VALUES (
        ${cId}::uuid, ${data.name}, ${data.batch}, ${data.currentPosition},
        ${data.company}, ${data.location || ""}, ${data.degree || "B.E. Computer Science & Engineering"},
        ${data.department || "Computer Science & Engineering"},
        ${data.mentorshipTopics || []}, ${data.skills || []},
        ${data.linkedinUrl || ""}, ${data.email || ""}, ${data.bio || ""},
        ${data.isAvailable ?? true}, 0, ${data.maxMentees || 5}
      )
      RETURNING *`;

    return toMemberItem(rows[0]!);
  },

  async listRequests(scope, studentId) {
    const t = db();
    const cId = await resolveCollegeId(scope);

    let rows: MentorshipRequestDbRow[];
    if (studentId) {
      rows = await t.$queryRaw<MentorshipRequestDbRow[]>`
        SELECT 
          r.*,
          m.name as alumni_name,
          m.company as alumni_company,
          m.current_position as alumni_position
        FROM alumni_mentorship_requests r
        LEFT JOIN alumni_members m ON r.alumni_id = m.id
        WHERE r.student_id = ${studentId}
        ORDER BY r.created_at DESC`;
    } else if (cId) {
      rows = await t.$queryRaw<MentorshipRequestDbRow[]>`
        SELECT 
          r.*,
          m.name as alumni_name,
          m.company as alumni_company,
          m.current_position as alumni_position
        FROM alumni_mentorship_requests r
        LEFT JOIN alumni_members m ON r.alumni_id = m.id
        WHERE r.college_id = ${cId}::uuid
        ORDER BY r.created_at DESC`;
    } else {
      rows = await t.$queryRaw<MentorshipRequestDbRow[]>`
        SELECT 
          r.*,
          m.name as alumni_name,
          m.company as alumni_company,
          m.current_position as alumni_position
        FROM alumni_mentorship_requests r
        LEFT JOIN alumni_members m ON r.alumni_id = m.id
        ORDER BY r.created_at DESC`;
    }

    return rows.map(toRequestItem);
  },

  async createRequest(data) {
    const t = db();
    const cId = await resolveCollegeId(data.collegeId);
    if (!cId) throw new Error("Valid college ID required");

    const rows = await t.$queryRaw<MentorshipRequestDbRow[]>`
      INSERT INTO alumni_mentorship_requests (
        college_id, alumni_id, student_id, student_name,
        student_roll_no, student_dept, topic, preferred_mode,
        message, status
      ) VALUES (
        ${cId}::uuid, ${data.alumniId}::uuid, ${data.studentId},
        ${data.studentName}, ${data.studentRollNo || ""}, ${data.studentDept || ""},
        ${data.topic}, ${data.preferredMode}, ${data.message || ""}, 'Pending'
      )
      RETURNING *`;

    // Increment active mentees on alumni member
    await t.$executeRaw`
      UPDATE alumni_members 
      SET active_mentees = active_mentees + 1 
      WHERE id = ${data.alumniId}::uuid`;

    return toRequestItem(rows[0]!);
  },

  async updateRequest(id, data) {
    if (!isUuid(id)) return undefined;
    const t = db();

    const scheduled = data.scheduledAt ? new Date(data.scheduledAt) : null;

    const rows = await t.$queryRaw<MentorshipRequestDbRow[]>`
      UPDATE alumni_mentorship_requests
      SET 
        status = COALESCE(${data.status}, status),
        response_note = COALESCE(${data.responseNote}, response_note),
        meeting_link = COALESCE(${data.meetingLink}, meeting_link),
        scheduled_at = COALESCE(${scheduled}, scheduled_at),
        updated_at = now()
      WHERE id = ${id}::uuid
      RETURNING *`;

    return rows[0] ? toRequestItem(rows[0]) : undefined;
  },

  async deleteRequest(id) {
    if (!isUuid(id)) return false;
    const t = db();
    const count = await t.$executeRaw`
      DELETE FROM alumni_mentorship_requests WHERE id = ${id}::uuid`;
    return count > 0;
  },
};
