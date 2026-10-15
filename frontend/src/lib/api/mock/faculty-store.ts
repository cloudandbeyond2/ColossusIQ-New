import { cleanText } from "@/lib/security/sanitize";

export interface FacultyRecord {
  id: string;
  name: string;
  designation: "Professor" | "Associate Professor" | "Assistant Professor";
  department: string;
  email?: string;
  phone?: string;
  load: number;
  development: number;
  ai: "High" | "Medium" | "Starting";
  collegeId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FacultyInput {
  name: string;
  designation: "Professor" | "Associate Professor" | "Assistant Professor";
  department?: string;
  email?: string;
  phone?: string;
  load: number;
  development: number;
  ai?: "High" | "Medium" | "Starting";
}

const INITIAL_FACULTY: FacultyRecord[] = [
  { id: "fac-1", name: "Dr. Joseph Kumar", designation: "Professor", department: "CSE", load: 18, development: 95, ai: "Medium", email: "joseph.k@campus.edu", createdAt: "2026-08-01T09:00:00Z", updatedAt: "2026-08-01T09:00:00Z" },
];

let facultyStore: FacultyRecord[] = [...INITIAL_FACULTY];
let nextFacultySeq = 2;

import { dataBackend } from "@/lib/data";
import { db } from "@/lib/data/postgres/db";

export async function getFacultyList(opts?: {
  collegeId?: string | null;
  q?: string;
  designation?: string;
  ai?: string;
}): Promise<FacultyRecord[]> {
  if (dataBackend() === "postgres") {
    const t = db();
    const collegePublicId = opts?.collegeId && opts.collegeId !== "all" ? opts.collegeId : undefined;
    const staffRows = await t.staff.findMany({
      where: {
        ...(collegePublicId ? { college: { publicId: collegePublicId } } : {}),
        status: "Active",
      },
      include: {
        department: { select: { name: true } },
        designation: { select: { name: true } },
        college: { select: { publicId: true } },
      },
      orderBy: { fullName: "asc" },
    });

    let list: FacultyRecord[] = staffRows.map((s) => {
      const desName = s.designation.name;
      const validDes: FacultyRecord["designation"] =
        desName.includes("Associate")
          ? "Associate Professor"
          : desName.includes("Assistant")
          ? "Assistant Professor"
          : "Professor";
      const exp = s.experienceYears ?? 5;
      const load = 12 + (exp % 8);
      const development = Math.min(100, 50 + exp * 4);
      const ai: FacultyRecord["ai"] = exp > 10 ? "High" : exp > 4 ? "Medium" : "Starting";

      return {
        id: s.publicId,
        name: s.fullName,
        designation: validDes,
        department: s.department.name,
        email: s.email,
        phone: s.phone,
        load,
        development,
        ai,
        collegeId: s.college.publicId,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      };
    });

    if (opts?.designation && opts.designation !== "all") {
      list = list.filter((f) => f.designation.toLowerCase() === opts.designation!.toLowerCase());
    }
    if (opts?.ai && opts.ai !== "all") {
      list = list.filter((f) => f.ai.toLowerCase() === opts.ai!.toLowerCase());
    }
    if (opts?.q) {
      const needle = opts.q.trim().toLowerCase();
      list = list.filter(
        (f) =>
          f.name.toLowerCase().includes(needle) ||
          f.designation.toLowerCase().includes(needle) ||
          f.department.toLowerCase().includes(needle) ||
          (f.email ?? "").toLowerCase().includes(needle)
      );
    }
    return list;
  }

  let list = [...facultyStore];
  if (opts?.collegeId && opts.collegeId !== "all") {
    list = list.filter((f) => !f.collegeId || f.collegeId === opts.collegeId);
  }
  if (opts?.designation && opts.designation !== "all") {
    list = list.filter((f) => f.designation.toLowerCase() === opts.designation!.toLowerCase());
  }
  if (opts?.ai && opts.ai !== "all") {
    list = list.filter((f) => f.ai.toLowerCase() === opts.ai!.toLowerCase());
  }
  if (opts?.q) {
    const needle = opts.q.trim().toLowerCase();
    list = list.filter(
      (f) =>
        f.name.toLowerCase().includes(needle) ||
        f.designation.toLowerCase().includes(needle) ||
        (f.department ?? "").toLowerCase().includes(needle) ||
        (f.email ?? "").toLowerCase().includes(needle)
    );
  }
  return list;
}

export async function getFacultyById(id: string): Promise<FacultyRecord | null> {
  if (dataBackend() === "postgres") {
    const s = await db().staff.findFirst({
      where: { OR: [{ publicId: id }, { id: id }] },
      include: {
        department: { select: { name: true } },
        designation: { select: { name: true } },
        college: { select: { publicId: true } },
      },
    });
    if (!s) return null;
    const desName = s.designation.name;
    const validDes: FacultyRecord["designation"] =
      desName.includes("Associate")
        ? "Associate Professor"
        : desName.includes("Assistant")
        ? "Assistant Professor"
        : "Professor";
    return {
      id: s.publicId,
      name: s.fullName,
      designation: validDes,
      department: s.department.name,
      email: s.email,
      phone: s.phone,
      load: 16,
      development: 75,
      ai: "Medium",
      collegeId: s.college.publicId,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    };
  }
  const found = facultyStore.find((f) => f.id === id);
  return found ? { ...found } : null;
}

const DEPT_ALIASES: Record<string, string> = {
  cse: "Computer Science & Engineering",
  cs: "Computer Science & Engineering",
  "computer science": "Computer Science & Engineering",
  it: "Information Technology",
  "information tech": "Information Technology",
  aids: "Artificial Intelligence & Data Science",
  "ai&ds": "Artificial Intelligence & Data Science",
  "ai & ds": "Artificial Intelligence & Data Science",
  "ai and ds": "Artificial Intelligence & Data Science",
  ece: "Electronics & Communication",
  eee: "Electrical & Electronics",
  mech: "Mechanical Engineering",
  me: "Mechanical Engineering",
  civil: "Civil Engineering",
  ce: "Civil Engineering",
  sh: "Science & Humanities",
  "s&h": "Science & Humanities",
  mba: "Business Administration",
  bba: "Business Administration",
};

export async function createFaculty(
  input: FacultyInput,
  collegeId?: string | null
): Promise<FacultyRecord> {
  const cleanName = cleanText(input.name, 120).trim();
  const rawDept = (input.department || "").trim();
  const deptMapped = DEPT_ALIASES[rawDept.toLowerCase()] || cleanText(rawDept || "Computer Science & Engineering", 80).trim();

  const emailPrefix = cleanName.toLowerCase().replace(/[^a-z0-9]/g, "") || "faculty";
  const defaultEmail = `${emailPrefix}.${Date.now().toString(36)}@ait.edu.in`;
  const cleanEmail = input.email && input.email.trim() ? cleanText(input.email, 120).trim() : defaultEmail;

  const digitsOnly = (input.phone || "").replace(/\D/g, "");
  const cleanPhone = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : "9840012345";

  if (dataBackend() === "postgres") {
    const { getStore } = await import("@/lib/data");
    const { RESOURCES } = await import("@/config/resources");
    const effectiveCollege = collegeId && collegeId !== "all" ? collegeId : "COL-1001";
    const rec = await getStore().records.create(
      RESOURCES.staff!,
      {
        fullName: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        qualification: "Ph.D",
        department: deptMapped,
        designation: input.designation || "Assistant Professor",
        staffType: "Teaching",
        employment: "Permanent",
        joiningDate: new Date().toISOString().slice(0, 10),
        experienceYears: 6,
        status: "Active",
        platformAccess: true,
        notes: `Load: ${input.load || 16}, AI: ${input.ai || "Medium"}`,
      },
      effectiveCollege
    );

    return {
      id: rec.id,
      name: String(rec.fullName),
      designation: (rec.designation as any) || "Assistant Professor",
      department: String(rec.department),
      email: rec.email ? String(rec.email) : undefined,
      phone: rec.phone ? String(rec.phone) : undefined,
      load: input.load || 16,
      development: input.development || 75,
      ai: input.ai || "Medium",
      collegeId: rec.collegeId,
      createdAt: rec.createdAt,
      updatedAt: rec.updatedAt,
    };
  }

  const now = new Date().toISOString();
  const id = `fac-${Date.now()}-${nextFacultySeq++}`;
  const validDesignations = ["Professor", "Associate Professor", "Assistant Professor"] as const;
  const designation = validDesignations.includes(input.designation as any)
    ? (input.designation as FacultyRecord["designation"])
    : "Assistant Professor";
  const validAi = ["High", "Medium", "Starting"] as const;
  const ai = validAi.includes((input.ai ?? "") as any)
    ? (input.ai as FacultyRecord["ai"])
    : "Starting";

  const record: FacultyRecord = {
    id,
    name: cleanName,
    designation,
    department: deptMapped,
    email: cleanEmail,
    phone: cleanPhone,
    load: Math.min(40, Math.max(0, Math.round(Number(input.load || 12)))),
    development: Math.min(100, Math.max(0, Math.round(Number(input.development || 50)))),
    ai,
    collegeId: collegeId || null,
    createdAt: now,
    updatedAt: now,
  };

  facultyStore.unshift(record);
  return { ...record };
}

export async function updateFaculty(
  id: string,
  data: Partial<FacultyInput>
): Promise<FacultyRecord | null> {
  if (dataBackend() === "postgres") {
    const { getStore } = await import("@/lib/data");
    const { RESOURCES } = await import("@/config/resources");
    const existing = await getStore().records.get(RESOURCES.staff!, id);
    if (!existing) return null;

    const patch: Record<string, any> = { ...existing };
    if (data.name !== undefined) patch.fullName = cleanText(data.name, 120).trim();
    if (data.email !== undefined) patch.email = cleanText(data.email, 120).trim();
    if (data.phone !== undefined) {
      const digits = data.phone.replace(/\D/g, "");
      patch.phone = digits.length >= 10 ? digits.slice(-10) : cleanText(data.phone, 20).trim();
    }
    if (data.designation !== undefined) patch.designation = data.designation;
    if (data.department !== undefined) {
      const rawDept = data.department.trim();
      patch.department = DEPT_ALIASES[rawDept.toLowerCase()] || cleanText(rawDept, 80).trim();
    }

    const updated = await getStore().records.update(RESOURCES.staff!, id, patch, existing.version);
    if (!updated || updated === "stale") return null;

    return {
      id: updated.id,
      name: String(updated.fullName),
      designation: (updated.designation as any) || "Assistant Professor",
      department: String(updated.department),
      email: updated.email ? String(updated.email) : undefined,
      phone: updated.phone ? String(updated.phone) : undefined,
      load: data.load ?? 16,
      development: data.development ?? 75,
      ai: data.ai ?? "Medium",
      collegeId: updated.collegeId,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  const index = facultyStore.findIndex((f) => f.id === id);
  if (index === -1) return null;

  const current = facultyStore[index]!;
  const validDesignations = ["Professor", "Associate Professor", "Assistant Professor"] as const;
  const validAi = ["High", "Medium", "Starting"] as const;

  const updated: FacultyRecord = {
    ...current,
    name: data.name !== undefined ? cleanText(data.name, 120).trim() : current.name,
    designation:
      data.designation !== undefined && validDesignations.includes(data.designation as any)
        ? (data.designation as FacultyRecord["designation"])
        : current.designation,
    department:
      data.department !== undefined ? cleanText(data.department, 80).trim() : current.department,
    email: data.email !== undefined ? cleanText(data.email, 120).trim() : current.email,
    phone: data.phone !== undefined ? cleanText(data.phone, 20).trim() : current.phone,
    load:
      data.load !== undefined
        ? Math.min(40, Math.max(0, Math.round(Number(data.load))))
        : current.load,
    development:
      data.development !== undefined
        ? Math.min(100, Math.max(0, Math.round(Number(data.development))))
        : current.development,
    ai:
      data.ai !== undefined && validAi.includes(data.ai as any)
        ? (data.ai as FacultyRecord["ai"])
        : current.ai,
    updatedAt: new Date().toISOString(),
  };

  facultyStore[index] = updated;
  return { ...updated };
}

export async function deleteFaculty(id: string): Promise<boolean> {
  if (dataBackend() === "postgres") {
    const { getStore } = await import("@/lib/data");
    const { RESOURCES } = await import("@/config/resources");
    return getStore().records.delete(RESOURCES.staff!, id);
  }

  const index = facultyStore.findIndex((f) => f.id === id);
  if (index === -1) return false;
  facultyStore.splice(index, 1);
  return true;
}
