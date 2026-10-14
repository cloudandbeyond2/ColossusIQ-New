import { cleanText } from "@/lib/security/sanitize";
import { dataBackend } from "@/lib/data";
import { db } from "@/lib/data/postgres/db";

export interface StudentRecord {
  id: string;
  name: string;
  roll: string;
  section: string;
  department?: string;
  departmentCode?: string;
  cgpa: number;
  readiness: number;
  signal: "None" | "Review suggested" | "At risk" | "High performer";
  email?: string;
  phone?: string;
  collegeId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudentInput {
  name: string;
  roll: string;
  section: string;
  cgpa: number;
  readiness: number;
  signal?: "None" | "Review suggested" | "At risk" | "High performer";
  email?: string;
  phone?: string;
}

// Student store starts empty and is populated through user actions (forms, Excel import)
let studentsStore: StudentRecord[] = [];

let nextStudentSeq = 1;

export function resetStudentsStore(initial: StudentRecord[] = []) {
  studentsStore = [...initial];
  nextStudentSeq = initial.length + 1;
}

export async function getStudentsList(opts?: {
  collegeId?: string | null;
  q?: string;
  section?: string;
  department?: string;
  signal?: string;
}): Promise<StudentRecord[]> {
  if (dataBackend() === "postgres") {
    const t = db();
    const collegePublicId = opts?.collegeId && opts.collegeId !== "all" ? opts.collegeId : undefined;
    const studentRows = await t.student.findMany({
      where: {
        status: "Active",
        ...(collegePublicId ? { college: { publicId: collegePublicId } } : {}),
      },
      include: {
        user: true,
        college: true,
        department: true,
      },
      orderBy: { rollNo: "asc" },
    });

    let list: StudentRecord[] = studentRows.map((s, idx) => {
      let meta: Record<string, any> = {};
      try {
        if (s.user.notes) meta = JSON.parse(s.user.notes);
      } catch {}

      const deptName = s.department?.name || "General";
      const deptCode = deptName.includes("Computer")
        ? "CSE"
        : deptName.includes("Information")
        ? "IT"
        : deptName.includes("Artificial") || deptName.includes("Data")
        ? "AI&DS"
        : deptName.includes("Electronics")
        ? "ECE"
        : deptName.includes("Electrical")
        ? "EEE"
        : deptName.includes("Mechanical")
        ? "MECH"
        : deptName.includes("Civil")
        ? "CIVIL"
        : deptName.slice(0, 4).toUpperCase();
      const section = meta.section || `${deptCode}-A`;

      const baseCgpa = 7.5 + ((idx * 7) % 25) / 10;
      const cgpa = meta.cgpa !== undefined ? meta.cgpa : Math.round(baseCgpa * 10) / 10;
      const readiness = meta.readiness !== undefined ? meta.readiness : Math.min(98, Math.max(50, 60 + ((idx * 13) % 38)));
      const signal: StudentRecord["signal"] =
        meta.signal || (cgpa >= 9.0 ? "High performer" : cgpa < 7.2 ? "Review suggested" : "None");

      return {
        id: s.id,
        name: s.user.fullName,
        roll: s.rollNo,
        section,
        department: deptName,
        departmentCode: deptCode,
        cgpa,
        readiness,
        signal,
        email: s.user.email,
        phone: s.college.phone,
        collegeId: s.college.publicId,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      };
    });

    if (opts?.department && opts.department !== "all") {
      const d = opts.department.toLowerCase();
      list = list.filter((s) =>
        (s.department && s.department.toLowerCase().includes(d)) ||
        (s.departmentCode && s.departmentCode.toLowerCase() === d) ||
        s.section.toLowerCase().includes(d)
      );
    }
    if (opts?.section && opts.section !== "all") {
      list = list.filter((s) => s.section.toLowerCase() === opts.section!.toLowerCase());
    }
    if (opts?.signal && opts.signal !== "all") {
      list = list.filter((s) => s.signal.toLowerCase() === opts.signal!.toLowerCase());
    }
    if (opts?.q) {
      const needle = opts.q.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(needle) ||
          s.roll.toLowerCase().includes(needle) ||
          s.section.toLowerCase().includes(needle) ||
          (s.department && s.department.toLowerCase().includes(needle)) ||
          (s.email ?? "").toLowerCase().includes(needle)
      );
    }
    return list;
  }
  let list = [...studentsStore];
  if (opts?.collegeId && opts.collegeId !== "all") {
    list = list.filter((s) => !s.collegeId || s.collegeId === opts.collegeId);
  }
  if (opts?.department && opts.department !== "all") {
    const d = opts.department.toLowerCase();
    list = list.filter((s) =>
      (s.department && s.department.toLowerCase().includes(d)) ||
      (s.departmentCode && s.departmentCode.toLowerCase() === d) ||
      s.section.toLowerCase().includes(d)
    );
  }
  if (opts?.section && opts.section !== "all") {
    list = list.filter((s) => s.section.toLowerCase() === opts.section!.toLowerCase());
  }
  if (opts?.signal && opts.signal !== "all") {
    list = list.filter((s) => s.signal.toLowerCase() === opts.signal!.toLowerCase());
  }
  if (opts?.q) {
    const needle = opts.q.trim().toLowerCase();
    list = list.filter(
      (s) =>
        s.name.toLowerCase().includes(needle) ||
        s.roll.toLowerCase().includes(needle) ||
        s.section.toLowerCase().includes(needle) ||
        (s.department && s.department.toLowerCase().includes(needle))
    );
  }
  return list;
}

function isUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export async function getStudentById(id: string): Promise<StudentRecord | null> {
  if (dataBackend() === "postgres") {
    const s = await db().student.findFirst({
      where: isUuid(id) ? { OR: [{ id }, { rollNo: id }] } : { rollNo: id },
      include: { user: true, college: true, department: true },
    });
    if (!s) return null;
    return {
      id: s.id,
      name: s.user.fullName,
      roll: s.rollNo,
      section: `${s.department.name.includes("Computer") ? "CSE" : "ENG"}-A`,
      cgpa: 8.0,
      readiness: 75,
      signal: "None",
      email: s.user.email,
      phone: s.college.phone,
      collegeId: s.college.publicId,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    };
  }
  const found = studentsStore.find((s) => s.id === id);
  return found ? { ...found } : null;
}

export async function createStudent(
  input: StudentInput,
  collegeId?: string | null
): Promise<StudentRecord> {
  if (dataBackend() === "postgres") {
    const t = db();
    const effectiveCollege = collegeId && collegeId !== "all" ? collegeId : "COL-1001";
    const college = (await t.college.findFirst({
      where: isUuid(effectiveCollege) ? { OR: [{ publicId: effectiveCollege }, { id: effectiveCollege }] } : { publicId: effectiveCollege },
    })) || (await t.college.findFirst());
    if (!college) throw new Error("College not found");

    const dept = (await t.department.findFirst({
      where: { streamKey: college.type.toLowerCase() === "medical" ? "medical" : "engineering" },
    })) || (await t.department.findFirst());
    if (!dept) throw new Error("Department not found");

    const prog = (await t.programme.findFirst({
      where: { streamKey: dept.streamKey },
    })) || (await t.programme.findFirst());
    if (!prog) throw new Error("Programme not found");

    const cleanName = cleanText(input.name, 100).trim();
    const cleanRoll = cleanText(input.roll, 30).trim().toUpperCase();
    const email = input.email ? cleanText(input.email, 120).trim() : `${cleanRoll.toLowerCase()}@${college.code || "campus"}.edu.in`;

    const meta = {
      section: cleanText(input.section || "CSE-A", 30).trim().toUpperCase(),
      cgpa: Math.round(Number(input.cgpa || 7.5) * 100) / 100,
      readiness: Math.min(100, Math.max(0, Math.round(Number(input.readiness || 60)))),
      signal: input.signal || "None",
    };

    // Ensure user exists
    let user = await t.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    if (!user) {
      user = await t.user.create({
        data: {
          fullName: cleanName,
          email,
          status: "Active",
          mfaRequired: false,
          ssoOnly: false,
          universityId: college.universityId,
          notes: JSON.stringify(meta),
        },
      });
    } else {
      await t.user.update({
        where: { id: user.id },
        data: { notes: JSON.stringify(meta) },
      });
    }

    // Create student
    const student = await t.student.create({
      data: {
        userId: user.id,
        collegeId: college.id,
        rollNo: cleanRoll,
        departmentId: dept.id,
        programmeId: prog.id,
        batchYear: new Date().getFullYear(),
        status: "Active",
      },
      include: { user: true, college: true, department: true },
    });

    return {
      id: student.id,
      name: student.user.fullName,
      roll: student.rollNo,
      section: meta.section,
      cgpa: meta.cgpa,
      readiness: meta.readiness,
      signal: meta.signal as any,
      email: student.user.email,
      phone: input.phone ? cleanText(input.phone, 20).trim() : undefined,
      collegeId: student.college.publicId,
      createdAt: student.createdAt.toISOString(),
      updatedAt: student.updatedAt.toISOString(),
    };
  }

  const now = new Date().toISOString();
  const id = `stu-${Date.now()}-${nextStudentSeq++}`;
  const newStudent: StudentRecord = {
    id,
    name: cleanText(input.name, 100).trim(),
    roll: cleanText(input.roll, 30).trim().toUpperCase(),
    section: cleanText(input.section || "CSE-A", 30).trim().toUpperCase(),
    cgpa: Math.round(Number(input.cgpa || 0) * 100) / 100,
    readiness: Math.min(100, Math.max(0, Math.round(Number(input.readiness || 0)))),
    signal: input.signal || "None",
    email: input.email ? cleanText(input.email, 120).trim() : undefined,
    phone: input.phone ? cleanText(input.phone, 20).trim() : undefined,
    collegeId: collegeId || null,
    createdAt: now,
    updatedAt: now,
  };

  studentsStore.unshift(newStudent);
  return { ...newStudent };
}

export async function importStudents(
  items: StudentInput[],
  collegeId?: string | null
): Promise<{ imported: number; students: StudentRecord[] }> {
  if (dataBackend() === "postgres") {
    const created: StudentRecord[] = [];
    for (const item of items) {
      if (!item.name || !item.roll) continue;
      const rec = await createStudent(item, collegeId);
      created.push(rec);
    }
    return { imported: created.length, students: created };
  }

  const created: StudentRecord[] = [];
  const now = new Date().toISOString();

  for (const item of items) {
    if (!item.name || !item.roll) continue;
    const id = `stu-${Date.now()}-${nextStudentSeq++}`;
    const student: StudentRecord = {
      id,
      name: cleanText(item.name, 100).trim(),
      roll: cleanText(item.roll, 30).trim().toUpperCase(),
      section: cleanText(item.section || "CSE-A", 30).trim().toUpperCase(),
      cgpa: Math.round(Number(item.cgpa || 7.0) * 100) / 100,
      readiness: Math.min(100, Math.max(0, Math.round(Number(item.readiness || 50)))),
      signal: item.signal || (item.cgpa && item.cgpa < 7.0 ? "Review suggested" : "None"),
      email: item.email ? cleanText(item.email, 120).trim() : undefined,
      phone: item.phone ? cleanText(item.phone, 20).trim() : undefined,
      collegeId: collegeId || null,
      createdAt: now,
      updatedAt: now,
    };
    created.push(student);
  }

  // Prepend new imported students
  studentsStore = [...created, ...studentsStore];
  return { imported: created.length, students: created };
}

export async function updateStudent(
  id: string,
  data: Partial<StudentInput>
): Promise<StudentRecord | null> {
  if (dataBackend() === "postgres") {
    const t = db();
    const student = await t.student.findFirst({
      where: isUuid(id) ? { OR: [{ id }, { rollNo: id }] } : { rollNo: id },
      include: { user: true, college: true },
    });
    if (!student) return null;

    if (data.roll) {
      await t.student.update({
        where: { id: student.id },
        data: { rollNo: cleanText(data.roll, 30).trim().toUpperCase() },
      });
    }

    let meta: Record<string, any> = {};
    try {
      if (student.user.notes) meta = JSON.parse(student.user.notes);
    } catch {}

    if (data.section) meta.section = cleanText(data.section, 30).trim().toUpperCase();
    if (data.cgpa !== undefined) meta.cgpa = Math.round(Number(data.cgpa) * 100) / 100;
    if (data.readiness !== undefined) meta.readiness = Math.min(100, Math.max(0, Math.round(Number(data.readiness))));
    if (data.signal !== undefined) meta.signal = data.signal;

    await t.user.update({
      where: { id: student.userId },
      data: {
        ...(data.name ? { fullName: cleanText(data.name, 100).trim() } : {}),
        ...(data.email ? { email: cleanText(data.email, 120).trim() } : {}),
        notes: JSON.stringify(meta),
      },
    });

    const finalSection = meta.section || "CSE-A";
    const finalCgpa = meta.cgpa !== undefined ? meta.cgpa : 8.0;
    const finalReadiness = meta.readiness !== undefined ? meta.readiness : 75;
    const finalSignal = meta.signal || "None";

    return {
      id: student.id,
      name: data.name ? cleanText(data.name, 100).trim() : student.user.fullName,
      roll: data.roll ? cleanText(data.roll, 30).trim().toUpperCase() : student.rollNo,
      section: finalSection,
      cgpa: finalCgpa,
      readiness: finalReadiness,
      signal: finalSignal,
      email: data.email ? cleanText(data.email, 120).trim() : student.user.email,
      phone: data.phone ? cleanText(data.phone, 20).trim() : undefined,
      collegeId: student.college.publicId,
      createdAt: student.createdAt.toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  const index = studentsStore.findIndex((s) => s.id === id);
  if (index === -1) return null;

  const current = studentsStore[index]!;
  const updated: StudentRecord = {
    ...current,
    name: data.name !== undefined ? cleanText(data.name, 100).trim() : current.name,
    roll: data.roll !== undefined ? cleanText(data.roll, 30).trim().toUpperCase() : current.roll,
    section: data.section !== undefined ? cleanText(data.section, 30).trim().toUpperCase() : current.section,
    cgpa: data.cgpa !== undefined ? Math.round(Number(data.cgpa) * 100) / 100 : current.cgpa,
    readiness: data.readiness !== undefined ? Math.min(100, Math.max(0, Math.round(Number(data.readiness)))) : current.readiness,
    signal: data.signal !== undefined ? data.signal : current.signal,
    email: data.email !== undefined ? cleanText(data.email, 120).trim() : current.email,
    phone: data.phone !== undefined ? cleanText(data.phone, 20).trim() : current.phone,
    updatedAt: new Date().toISOString(),
  };

  studentsStore[index] = updated;
  return { ...updated };
}

export async function deleteStudent(id: string): Promise<boolean> {
  if (dataBackend() === "postgres") {
    const t = db();
    const student = await t.student.findFirst({
      where: isUuid(id) ? { OR: [{ id }, { rollNo: id }] } : { rollNo: id },
    });
    if (!student) return false;
    // In institutional ERPs, students with audit logs (evaluation_overrides is append-only)
    // and issued certificates cannot be hard-deleted due to immutable legal records.
    // Setting status to 'Discontinued' permanently deactivates and removes the student from
    // all active directory queries, dashboards, and role assignments without violating PostgreSQL audit rules.
    await t.student.update({
      where: { id: student.id },
      data: { status: "Discontinued" },
    });

    try {
      await t.user.update({
        where: { id: student.userId },
        data: { status: "Suspended" },
      });
    } catch {}

    return true;
  }

  const index = studentsStore.findIndex((s) => s.id === id);
  if (index === -1) return false;
  studentsStore.splice(index, 1);
  return true;
}
