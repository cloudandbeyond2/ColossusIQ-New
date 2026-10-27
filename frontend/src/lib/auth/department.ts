import "server-only";
import { dataBackend, getStore } from "@/lib/data";
import { ALL_COLLEGES } from "@/config/tenancy";
import { RESOURCES } from "@/config/resources";
import { ROLE_META } from "./roles";
import type { SessionPayload } from "./session";

/**
 * Resolves the department name for a logged-in user across PostgreSQL, memory store, or fallback personas.
 * E.g., returns "Commerce", "Computer Science & Engineering", etc.
 */
export async function resolveUserDepartment(session: SessionPayload): Promise<string | null> {
  if (session.department && typeof session.department === "string") {
    return session.department;
  }

  if (dataBackend() === "postgres") {
    try {
      const { db, isUuid } = await import("@/lib/data/postgres/db");
      const { collegeByPublic } = await import("@/lib/data/postgres/lookups");

      if (isUuid(session.sub)) {
        const collegeUuid =
          session.college && session.college !== ALL_COLLEGES
            ? (await collegeByPublic(session.college))?.id
            : null;

        // 1. Role assignment matching user and current role (and college if scoped)
        const ra = await db().roleAssignment.findFirst({
          where: {
            userId: session.sub,
            role: session.role,
            ...(collegeUuid ? { collegeId: collegeUuid } : {}),
          },
          include: { department: true },
        });
        if (ra?.department?.name) return ra.department.name;

        // 2. Any role assignment for this user with an assigned department
        const anyRa = await db().roleAssignment.findFirst({
          where: {
            userId: session.sub,
            departmentId: { not: null },
          },
          include: { department: true },
        });
        if (anyRa?.department?.name) return anyRa.department.name;

        // 3. Staff table
        const staff = await db().staff.findFirst({
          where: { userId: session.sub },
          include: { department: true },
        });
        if (staff?.department?.name) return staff.department.name;

        // 4. Student table
        const student = await db().student.findFirst({
          where: { userId: session.sub },
          include: { department: true },
        });
        if (student?.department?.name) return student.department.name;
      }
    } catch {
      // Fall through on error or RLS context
    }
  } else {
    try {
      const store = getStore();
      const userRec = await store.records.get(RESOURCES.users!, session.sub);
      if (userRec?.department && typeof userRec.department === "string") {
        return userRec.department;
      }
      if (session.college && session.college !== ALL_COLLEGES) {
        const staffRecs = await store.records.all(RESOURCES.staff!, session.college);
        const match = staffRecs.find(
          (s) => s.fullName === session.name || s.email === session.sub
        );
        if (match?.department && typeof match.department === "string") {
          return match.department;
        }
      }
    } catch {
      // Fall through
    }
  }

  // Persona fallbacks for demo accounts
  if (session.role === "hod") {
    const persona = ROLE_META.hod.persona;
    const parts = persona.split("·");
    if (parts[1]?.includes("HOD,")) {
      return parts[1].replace(/.*HOD,\s*/i, "").trim();
    }
  }
  if (session.role === "faculty") {
    const persona = ROLE_META.faculty.persona;
    const parts = persona.split("·");
    if (parts[1]) {
      const commaParts = parts[1].split(",");
      if (commaParts[1]) return commaParts[1].trim();
    }
  }

  return null;
}
