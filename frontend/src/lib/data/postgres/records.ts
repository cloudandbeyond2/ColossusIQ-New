import "server-only";
/* eslint-disable @typescript-eslint/no-explicit-any -- one generic adapter drives eight Prisma delegates with different types */
import { hash } from "@node-rs/argon2";
import { RESOURCES, type RecordValue, type ResourceDef, type ResourceRecord } from "@/config/resources";
import type { Stream } from "@/config/streams";
import type { RecordListQuery, RecordStore, Scope } from "../store";
import { ARGON2 } from "./auth";
import { db, requestScope, type Tx } from "./db";
import { enumValue, label, maybeEnum } from "./enums";
import {
  collegeByPublic,
  collegeByUuid,
  collegePublic,
  collegesChanged,
  collegeUuid,
  day,
  hhmm,
  imageRef,
  lookupId,
  num,
  refOf,
  text,
  toDay,
  toTime,
  universityId,
} from "./lookups";

/*
 * The CRUD resources of src/config/resources.ts on their tables. Each adapter translates a record's
 * fields (labels and names, as the forms use them) to columns (enums and lookup ids) and back.
 */

type Data = Record<string, RecordValue>;
type Row = any;

interface Adapter {
  delegate: (t: Tx) => any;
  include?: object;
  /** Text columns searched by the list filter (besides the public id). */
  search: string[];
  statusEnum?: string;
  toRecord(row: Row): Promise<Data>;
  /** Column values; `stream` is the owning college's stream (null for colleges). */
  toColumns(d: Data, stream: Stream | null): Promise<Record<string, unknown>>;
  /** Child rows kept alongside (modules, documents). */
  afterWrite?(t: Tx, rowId: string, d: Data): Promise<void>;
}

const s = (v: unknown) => String(v ?? "");

const ADAPTERS: Record<string, Adapter> = {
  colleges: {
    delegate: (t) => t.college,
    include: { collegeModules: true },
    search: ["name", "code", "city", "principal"],
    statusEnum: "CollegeStatus",
    async toRecord(r) {
      return {
        name: r.name,
        code: r.code,
        type: r.type,
        city: r.city,
        established: r.established ?? null,
        studentCapacity: r.studentCapacity,
        principal: r.principal,
        email: r.email,
        phone: r.phone,
        plan: label("CollegePlan", r.plan),
        status: label("CollegeStatus", r.status),
        modules: (r.collegeModules as Array<{ module: string }>).map((m) => label("ModuleGroup", m.module)),
        admissionsOpen: r.admissionsOpen,
      };
    },
    async toColumns(d) {
      return {
        name: s(d.name),
        code: s(d.code),
        type: s(d.type),
        city: s(d.city),
        established: num(d.established),
        studentCapacity: Number(d.studentCapacity),
        principal: s(d.principal),
        email: s(d.email),
        phone: s(d.phone),
        plan: enumValue("CollegePlan", s(d.plan)),
        status: enumValue("CollegeStatus", s(d.status)),
        admissionsOpen: d.admissionsOpen === true,
      };
    },
    async afterWrite(t, rowId, d) {
      await t.collegeModule.deleteMany({ where: { collegeId: rowId } });
      const mods = Array.isArray(d.modules) ? d.modules : [];
      if (mods.length) await t.collegeModule.createMany({ data: mods.map((m) => ({ collegeId: rowId, module: enumValue("ModuleGroup", m) as any })) });
      collegesChanged();
    },
  },

  admissions: {
    delegate: (t) => t.admission,
    include: { programme: { select: { name: true } }, admissionDocuments: true },
    search: ["fullName", "city"],
    statusEnum: "AdmissionStatus",
    async toRecord(r) {
      return {
        fullName: r.fullName,
        dob: day(r.dob),
        gender: label("Gender", r.gender),
        email: r.email,
        phone: r.phone,
        city: r.city ?? "",
        state: label("HomeState", r.state),
        board: label("SchoolBoard", r.board),
        hscPercent: Number(r.hscPercent),
        entranceScore: r.entranceScore === null ? null : Number(r.entranceScore),
        program: r.programme.name,
        quota: label("AdmissionQuota", r.quota),
        category: label("ReservationCategory", r.category),
        scholarship: r.scholarship,
        hostel: r.hostel,
        guardianName: r.guardianName,
        guardianPhone: r.guardianPhone,
        guardianOccupation: r.guardianOccupation ?? "",
        status: label("AdmissionStatus", r.status),
        documents: (r.admissionDocuments as Array<{ document: string }>).map((x) => label("AdmissionDocumentType", x.document)),
        notes: r.notes ?? "",
      };
    },
    async toColumns(d, stream) {
      return {
        fullName: s(d.fullName),
        dob: toDay(d.dob),
        gender: enumValue("Gender", s(d.gender)),
        email: s(d.email),
        phone: s(d.phone),
        city: text(d.city),
        state: enumValue("HomeState", s(d.state || "Tamil Nadu")),
        board: enumValue("SchoolBoard", s(d.board)),
        hscPercent: Number(d.hscPercent),
        entranceScore: num(d.entranceScore),
        programmeId: await lookupId("programmes", stream!, s(d.program)),
        quota: enumValue("AdmissionQuota", s(d.quota)),
        category: enumValue("ReservationCategory", s(d.category)),
        scholarship: d.scholarship === true,
        hostel: d.hostel === true,
        guardianName: s(d.guardianName),
        guardianPhone: s(d.guardianPhone),
        guardianOccupation: text(d.guardianOccupation),
        status: enumValue("AdmissionStatus", s(d.status || "Enquiry")),
        notes: text(d.notes),
        ...(typeof d.notes === "string" && d.notes.startsWith("Submitted via online application") ? { source: "online" } : {}),
      };
    },
    async afterWrite(t, rowId, d) {
      await t.admissionDocument.deleteMany({ where: { admissionId: rowId } });
      const docs = Array.isArray(d.documents) ? d.documents : [];
      if (docs.length) await t.admissionDocument.createMany({ data: docs.map((x) => ({ admissionId: rowId, document: enumValue("AdmissionDocumentType", x) as any })) });
    },
  },

  staff: {
    delegate: (t) => t.staff,
    include: { department: { select: { name: true } }, designation: { select: { name: true } } },
    search: ["fullName", "qualification"],
    statusEnum: "StaffStatus",
    async toRecord(r) {
      return {
        fullName: r.fullName,
        email: r.email,
        phone: r.phone,
        qualification: r.qualification ?? "",
        department: r.department.name,
        designation: r.designation.name,
        staffType: label("StaffType", r.staffType),
        employment: label("EmploymentType", r.employment),
        joiningDate: day(r.joiningDate),
        experienceYears: r.experienceYears ?? null,
        status: label("StaffStatus", r.status),
        platformAccess: r.platformAccess,
        notes: r.notes ?? "",
      };
    },
    async toColumns(d, stream) {
      return {
        fullName: s(d.fullName),
        email: s(d.email),
        phone: s(d.phone),
        qualification: text(d.qualification),
        departmentId: await lookupId("departments", stream!, s(d.department)),
        designationId: await lookupId("designations", stream!, s(d.designation)),
        staffType: enumValue("StaffType", s(d.staffType)),
        employment: enumValue("EmploymentType", s(d.employment)),
        joiningDate: toDay(d.joiningDate),
        experienceYears: num(d.experienceYears),
        status: enumValue("StaffStatus", s(d.status || "Active")),
        platformAccess: d.platformAccess !== false,
        notes: text(d.notes),
      };
    },
    async afterWrite(t, rowId, d) {
      if (d.platformAccess !== false) {
        const staff = await t.staff.findUnique({
          where: { id: rowId },
          include: { college: true, designation: true },
        });
        if (!staff) return;

        const role = staff.designation.name.toLowerCase().includes("head") ? "hod" : "faculty";

        let user = await t.user.findFirst({
          where: { email: { equals: staff.email, mode: "insensitive" } },
        });

        if (!user) {
          user = await t.user.create({
            data: {
              fullName: staff.fullName,
              email: staff.email,
              status: "Active",
              mfaRequired: true,
              ssoOnly: false,
              universityId: staff.college.universityId,
            },
          });
        } else if (user.status !== "Active") {
          await t.user.update({
            where: { id: user.id },
            data: { status: "Active" },
          });
        }

        const ra = await t.roleAssignment.findFirst({
          where: { userId: user.id, role: role as any, collegeId: staff.collegeId },
        });

        if (!ra) {
          await t.roleAssignment.create({
            data: {
              userId: user.id,
              role: role as any,
              collegeId: staff.collegeId,
              departmentId: staff.departmentId,
            },
          });
        }

        if (process.env.DEV_PASSWORD && process.env.NODE_ENV !== "production") {
          const passwordHash = await hash(process.env.DEV_PASSWORD, ARGON2);
          await t.userCredential.upsert({
            where: { userId: user.id },
            create: { userId: user.id, passwordHash },
            update: { passwordHash, failedAttempts: 0, lockedUntil: null },
          });
        }

        if (staff.userId !== user.id) {
          await t.staff.update({
            where: { id: rowId },
            data: { userId: user.id },
          });
        }
      }
    },
  },

  courses: {
    delegate: (t) => t.course,
    include: {
      department: { select: { name: true } },
      term: { select: { name: true } },
      learningCourse: { select: { createdByName: true, source: true } },
    },
    search: ["code", "title", "facultyName"],
    statusEnum: "CourseStatus",
    async toRecord(r) {
      return {
        code: r.code,
        title: r.title,
        department: r.department.name,
        semester: r.term.name,
        credits: r.credits,
        courseType: label("CourseType", r.courseType),
        faculty: r.facultyName,
        createdBy: r.learningCourse?.createdByName || r.facultyName || "Staff",
        status: label("CourseStatus", r.status),
        description: r.description ?? "",
      };
    },
    async toColumns(d, stream) {
      return {
        code: s(d.code),
        title: s(d.title),
        departmentId: await lookupId("departments", stream!, s(d.department)),
        termId: await lookupId("terms", stream!, s(d.semester)),
        credits: Number(d.credits),
        courseType: enumValue("CourseType", s(d.courseType)),
        facultyName: s(d.faculty),
        status: enumValue("CourseStatus", s(d.status || "Draft")),
        description: text(d.description),
      };
    },
  },

  events: {
    delegate: (t) => t.event,
    search: ["title", "venue", "organiser"],
    statusEnum: "EventStatus",
    async toRecord(r) {
      return {
        title: r.title,
        type: label("EventType", r.type),
        date: day(r.eventDate),
        startTime: hhmm(r.startTime),
        venue: r.venue,
        organiser: r.organiser,
        capacity: r.capacity,
        registrationOpen: r.registrationOpen,
        status: label("EventStatus", r.status),
        description: r.description ?? "",
      };
    },
    async toColumns(d) {
      return {
        title: s(d.title),
        type: enumValue("EventType", s(d.type)),
        eventDate: toDay(d.date),
        startTime: toTime(d.startTime),
        venue: s(d.venue),
        organiser: s(d.organiser),
        capacity: Number(d.capacity),
        registrationOpen: d.registrationOpen !== false,
        status: enumValue("EventStatus", s(d.status || "Draft")),
        description: text(d.description),
      };
    },
  },

  rotations: {
    delegate: (t) => t.clinicalRotation,
    search: ["studentName", "regNo", "unit", "supervisorName"],
    statusEnum: "RotationStatus",
    async toRecord(r) {
      return {
        student: r.studentName,
        regNo: r.regNo,
        phase: label("RotationPhase", r.phase),
        department: label("ClinicalDepartment", r.department),
        unit: r.unit,
        startDate: day(r.startDate),
        endDate: day(r.endDate),
        supervisor: r.supervisorName,
        attendance: r.attendance ?? null,
        competenciesSigned: r.competenciesSigned ?? null,
        status: label("RotationStatus", r.status),
        remarks: r.remarks ?? "",
      };
    },
    async toColumns(d) {
      return {
        studentName: s(d.student),
        regNo: s(d.regNo),
        phase: enumValue("RotationPhase", s(d.phase)),
        department: enumValue("ClinicalDepartment", s(d.department)),
        unit: s(d.unit),
        startDate: toDay(d.startDate),
        endDate: toDay(d.endDate),
        supervisorName: s(d.supervisor),
        attendance: num(d.attendance),
        competenciesSigned: num(d.competenciesSigned),
        status: enumValue("RotationStatus", s(d.status || "Scheduled")),
        remarks: text(d.remarks),
      };
    },
  },

  departments: {
    delegate: (t) => t.collegeDepartment,
    include: { department: { select: { name: true } } },
    search: ["headName", "email"],
    statusEnum: "DepartmentStatus",
    async toRecord(r) {
      return {
        department: r.department.name,
        head: r.headName ?? "",
        established: r.established ?? null,
        status: label("DepartmentStatus", r.status),
        email: r.email ?? "",
        phone: r.phone ?? "",
        notes: r.notes ?? "",
      };
    },
    async toColumns(d, stream) {
      return {
        departmentId: await lookupId("departments", stream!, s(d.department)),
        headName: text(d.head),
        established: num(d.established),
        status: enumValue("DepartmentStatus", s(d.status || "Active")),
        email: text(d.email),
        phone: text(d.phone),
        notes: text(d.notes),
      };
    },
  },

  gallery: {
    delegate: (t) => t.galleryItem,
    include: { imageMedia: { select: { publicId: true } } },
    search: ["title", "caption"],
    statusEnum: "PublishStatus",
    async toRecord(r) {
      return {
        image: refOf(r.imageMedia, r.imageBuiltin),
        title: r.title,
        category: label("GalleryCategory", r.category),
        caption: r.caption ?? "",
        featured: r.featured,
        status: label("PublishStatus", r.status),
      };
    },
    async toColumns(d) {
      const img = await imageRef(d.image);
      return {
        imageMediaId: img.mediaId,
        imageBuiltin: img.builtin,
        title: s(d.title),
        category: enumValue("GalleryCategory", s(d.category)),
        caption: text(d.caption),
        featured: d.featured === true,
        status: enumValue("PublishStatus", s(d.status || "Draft")),
      };
    },
  },
};

/* ── shared record plumbing ── */
async function present(res: ResourceDef, a: Adapter, row: Row): Promise<ResourceRecord> {
  return {
    ...(await a.toRecord(row)),
    id: row.publicId,
    collegeId: res.scoped ? await collegePublic(row.collegeId) : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  } as ResourceRecord;
}

async function scopeFilter(res: ResourceDef, scope: Scope, college?: string): Promise<Record<string, unknown>> {
  if (!res.scoped) return {};
  const target = scope !== "all" ? scope : college;
  if (!target) return {};
  const c = await collegeByPublic(target);
  return { collegeId: c?.id ?? "00000000-0000-0000-0000-000000000000" };
}

function searchFilter(a: Adapter, q?: string) {
  if (!q) return {};
  const like = { contains: q, mode: "insensitive" };
  return { OR: [{ publicId: like }, ...a.search.map((c) => ({ [c]: like }))] };
}

async function streamOf(collegeId: string | null | undefined): Promise<Stream | null> {
  return (await collegeByPublic(collegeId))?.stream ?? null;
}

/* ── users: an account plus its role in a college (users + role_assignments) ── */
const ROLE_OF: Record<string, string> = {
  Student: "student",
  Faculty: "faculty",
  HOD: "hod",
  "Placement Officer": "placement",
  "Incubation Head": "incubation",
  "Principal / Institution Admin": "institution",
  Recruiter: "recruiter",
  "University Super Admin": "admin",
};
const ROLE_LABEL = Object.fromEntries(Object.entries(ROLE_OF).map(([k, v]) => [v, k]));
const UNIVERSITY_ROLES = new Set(["admin", "recruiter"]);

const USER_INCLUDE = { user: true, department: { select: { name: true } } } as const;

async function presentUser(ra: Row): Promise<ResourceRecord> {
  const u = ra.user;
  return {
    id: u.publicId,
    collegeId: await collegePublic(ra.collegeId),
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
    version: u.version,
    fullName: u.fullName,
    email: u.email,
    role: ROLE_LABEL[ra.role] ?? ra.role,
    department: ra.department?.name ?? "",
    status: label("UserStatus", u.status),
    mfaRequired: u.mfaRequired,
    ssoOnly: u.ssoOnly,
    notes: u.notes ?? "",
  } as ResourceRecord;
}

async function userScopeWhere(scope: Scope, college?: string) {
  const target = scope !== "all" ? scope : college;
  if (!target) return {};
  return { collegeId: (await collegeByPublic(target))?.id ?? "00000000-0000-0000-0000-000000000000" };
}

async function assignmentFor(publicId: string) {
  const scope = requestScope();
  const where = scope === "all" ? {} : await userScopeWhere(scope);
  return db().roleAssignment.findFirst({ where: { ...where, user: { publicId } }, include: USER_INCLUDE, orderBy: { createdAt: "asc" } });
}

async function userColumns(d: Data) {
  return {
    fullName: s(d.fullName),
    email: s(d.email),
    status: enumValue("UserStatus", s(d.status || "Invited")),
    mfaRequired: d.mfaRequired !== false,
    ssoOnly: d.ssoOnly === true,
    notes: text(d.notes),
  };
}
async function assignmentColumns(d: Data, collegeId: string | null) {
  const role = ROLE_OF[s(d.role)] ?? "student";
  const college = UNIVERSITY_ROLES.has(role) ? null : collegeId;
  const stream = await streamOf(college);
  const dept = stream && s(d.department) ? await lookupId("departments", stream, s(d.department)) : null;
  return { role: role as any, collegeId: college ? await collegeUuid(college) : null, departmentId: dept };
}

const usersStore = {
  async list(query: RecordListQuery) {
    const base = await userScopeWhere(query.scope, query.college);
    const statusValue = query.status ? maybeEnum("UserStatus", query.status) : undefined;
    if (query.status && !statusValue) return { items: [], total: 0, counts: {} };
    // Role dropdown: narrows the list and the status chip counts. An unknown role matches nobody.
    const roleLabel = query.filters?.role;
    const roleValue = roleLabel ? ROLE_OF[roleLabel] : undefined;
    if (roleLabel && !roleValue) return { items: [], total: 0, counts: {} };
    const roleWhere = roleValue ? { AND: [{ role: roleValue }] } : {};
    const where = {
      ...base,
      ...roleWhere,
      user: {
        ...(statusValue ? { status: statusValue } : {}),
        ...(query.q ? { OR: [{ publicId: { contains: query.q, mode: "insensitive" } }, { fullName: { contains: query.q, mode: "insensitive" } }] } : {}),
      },
    } as any;
    const t = db();
    const [rows, total, grouped] = await Promise.all([
      t.roleAssignment.findMany({ where, include: USER_INCLUDE, orderBy: { user: { updatedAt: "desc" } }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      t.roleAssignment.count({ where }),
      t.roleAssignment.findMany({ where: { ...base, ...roleWhere } as any, select: { user: { select: { status: true } } } }),
    ]);
    const counts: Record<string, number> = {};
    for (const g of grouped) counts[label("UserStatus", g.user.status)] = (counts[label("UserStatus", g.user.status)] ?? 0) + 1;
    return { items: await Promise.all(rows.map(presentUser)), total, counts };
  },
  async get(id: string) {
    const ra = await assignmentFor(id);
    return ra ? presentUser(ra) : undefined;
  },
  async create(d: Data, collegeId: string | null) {
    const t = db();
    const user = await t.user.create({ data: { ...(await userColumns(d)), universityId: await universityId() } as any });
    await t.roleAssignment.create({ data: { ...(await assignmentColumns(d, collegeId)), userId: user.id } as any });
    if (process.env.DEV_PASSWORD && process.env.NODE_ENV !== "production") {
      const passwordHash = await hash(process.env.DEV_PASSWORD, ARGON2);
      await t.userCredential.upsert({
        where: { userId: user.id },
        create: { userId: user.id, passwordHash },
        update: { passwordHash, failedAttempts: 0, lockedUntil: null },
      });
    }
    return (await this.get(user.publicId))!;
  },
  async update(id: string, d: Data, version: number) {
    const t = db();
    const ra = await assignmentFor(id);
    if (!ra) return undefined;
    const r = await t.user.updateMany({ where: { publicId: id, version }, data: (await userColumns(d)) as any });
    if (r.count === 0) return "stale" as const;
    const collegeId = await collegePublic(ra.collegeId);
    await t.roleAssignment.update({ where: { id: ra.id }, data: (await assignmentColumns(d, collegeId || null)) as any });
    return this.get(id);
  },
  async delete(id: string) {
    const t = db();
    const ra = await assignmentFor(id);
    if (!ra) return false;
    await t.roleAssignment.delete({ where: { id: ra.id } });
    // The account itself goes when it has no role left (and nothing else refers to it).
    if ((await t.roleAssignment.count({ where: { userId: ra.userId } })) === 0) {
      const linked = (await t.student.count({ where: { userId: ra.userId } })) + (await t.staff.count({ where: { userId: ra.userId } }));
      if (linked === 0) await t.user.delete({ where: { id: ra.userId } });
    }
    return true;
  },
};

/* ── questions (Question Bank) ── */
interface QuestionDbRow {
  id: string;
  public_id: string;
  college_id: string;
  question: string;
  topic: string;
  difficulty: string;
  bloom: string;
  co: string;
  marks: number;
  explanation: string;
  status: string;
  version: number;
  created_at: Date | string;
  updated_at: Date | string;
  college_public_id?: string;
  college_name?: string;
}

function questionRowToRecord(r: QuestionDbRow): ResourceRecord {
  return {
    id: r.public_id,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
    version: r.version,
    collegeId: r.college_public_id ?? null,
    collegeName: r.college_name ?? null,
    question: r.question,
    topic: r.topic,
    difficulty: r.difficulty,
    bloom: r.bloom,
    co: r.co,
    marks: r.marks,
    explanation: r.explanation ?? "",
    status: r.status,
  };
}

const questionsStore = {
  async list(query: RecordListQuery): Promise<{ items: ResourceRecord[]; total: number; counts: Record<string, number> }> {
    const t = db();
    const whereClauses: string[] = ["1=1"];
    const params: unknown[] = [];

    if (query.scope !== "all") {
      params.push(query.scope);
      whereClauses.push(`c.public_id = $${params.length}`);
    } else if (query.college) {
      params.push(query.college);
      whereClauses.push(`c.public_id = $${params.length}`);
    }

    const baseWhere = whereClauses.join(" AND ");

    if (query.status) {
      params.push(query.status);
      whereClauses.push(`q.status::text = $${params.length}`);
    }

    if (query.q) {
      params.push(`%${query.q}%`);
      const p = `$${params.length}`;
      whereClauses.push(`(q.public_id ILIKE ${p} OR q.question ILIKE ${p} OR q.topic ILIKE ${p} OR q.co ILIKE ${p} OR q.explanation ILIKE ${p})`);
    }

    const fullWhere = whereClauses.join(" AND ");

    const countSql = `SELECT count(*)::int AS count FROM question_bank q JOIN colleges c ON c.id = q.college_id WHERE ${fullWhere}`;
    const totalResult = await t.$queryRawUnsafe<Array<{ count: number }>>(countSql, ...params);
    const total = totalResult[0]?.count ?? 0;

    const limitParam = `$${params.length + 1}`;
    const offsetParam = `$${params.length + 2}`;
    const listSql = `
      SELECT q.*, c.public_id AS college_public_id, c.name AS college_name
      FROM question_bank q
      JOIN colleges c ON c.id = q.college_id
      WHERE ${fullWhere}
      ORDER BY q.updated_at DESC, q.created_at DESC
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `;
    const rows = await t.$queryRawUnsafe<QuestionDbRow[]>(listSql, ...params, query.pageSize, (query.page - 1) * query.pageSize);

    // Group counts
    const groupSql = `
      SELECT q.status::text AS status, count(*)::int AS count
      FROM question_bank q
      JOIN colleges c ON c.id = q.college_id
      WHERE ${baseWhere}
      GROUP BY q.status
    `;
    const baseParams = query.scope !== "all" ? [query.scope] : query.college ? [query.college] : [];
    const grouped = await t.$queryRawUnsafe<Array<{ status: string; count: number }>>(groupSql, ...baseParams);
    const counts: Record<string, number> = {};
    for (const g of grouped) counts[g.status] = g.count;

    return {
      items: rows.map(questionRowToRecord),
      total,
      counts,
    };
  },

  async all(scope: Scope): Promise<ResourceRecord[]> {
    const res = await this.list({ scope, page: 1, pageSize: 10_000 });
    return res.items;
  },

  async get(id: string): Promise<ResourceRecord | undefined> {
    const t = db();
    const rows = await t.$queryRaw<QuestionDbRow[]>`
      SELECT q.*, c.public_id AS college_public_id, c.name AS college_name
      FROM question_bank q
      JOIN colleges c ON c.id = q.college_id
      WHERE q.public_id = ${id}
      LIMIT 1
    `;
    return rows[0] ? questionRowToRecord(rows[0]) : undefined;
  },

  async create(d: Data, collegeId: string | null): Promise<ResourceRecord> {
    const t = db();
    const cUuid = await collegeUuid(collegeId!);
    const question = s(d.question);
    const topic = s(d.topic);
    const difficulty = s(d.difficulty || "Medium");
    const bloom = s(d.bloom || "Understand");
    const co = s(d.co || "CO1");
    const marks = Number(d.marks || 2);
    const explanation = s(d.explanation || "");
    const status = s(d.status || "Active");

    const rows = await t.$queryRaw<Array<{ public_id: string }>>`
      INSERT INTO question_bank (college_id, question, topic, difficulty, bloom, co, marks, explanation, status)
      VALUES (${cUuid}::uuid, ${question}, ${topic}, ${difficulty}::question_difficulty, ${bloom}::bloom_level, ${co}, ${marks}, ${explanation}, ${status}::question_status)
      RETURNING public_id
    `;
    const created = await this.get(rows[0]!.public_id);
    return created!;
  },

  async update(id: string, d: Data, version: number): Promise<ResourceRecord | "stale" | undefined> {
    const t = db();
    const check = await t.$queryRaw<Array<{ version: number }>>`SELECT version FROM question_bank WHERE public_id = ${id}`;
    if (!check[0]) return undefined;
    if (check[0].version !== version) return "stale";

    const question = s(d.question);
    const topic = s(d.topic);
    const difficulty = s(d.difficulty || "Medium");
    const bloom = s(d.bloom || "Understand");
    const co = s(d.co || "CO1");
    const marks = Number(d.marks || 2);
    const explanation = s(d.explanation || "");
    const status = s(d.status || "Active");

    const updated = await t.$queryRaw<Array<{ public_id: string }>>`
      UPDATE question_bank
      SET question = ${question},
          topic = ${topic},
          difficulty = ${difficulty}::question_difficulty,
          bloom = ${bloom}::bloom_level,
          co = ${co},
          marks = ${marks},
          explanation = ${explanation},
          status = ${status}::question_status,
          version = version + 1,
          updated_at = now()
      WHERE public_id = ${id} AND version = ${version}
      RETURNING public_id
    `;
    if (!updated[0]) return "stale";
    return this.get(id);
  },

  async delete(id: string): Promise<boolean> {
    const t = db();
    const rows = await t.$queryRaw<Array<{ id: string }>>`
      DELETE FROM question_bank WHERE public_id = ${id} RETURNING id
    `;
    return rows.length > 0;
  },

  async count(collegeId: string, where: Record<string, RecordValue> = {}): Promise<number> {
    const t = db();
    const status = where.status ? s(where.status) : null;
    const rows = status
      ? await t.$queryRaw<Array<{ count: number }>>`
          SELECT count(*)::int AS count
          FROM question_bank q
          JOIN colleges c ON c.id = q.college_id
          WHERE c.public_id = ${collegeId} AND q.status = ${status}::question_status
        `
      : await t.$queryRaw<Array<{ count: number }>>`
          SELECT count(*)::int AS count
          FROM question_bank q
          JOIN colleges c ON c.id = q.college_id
          WHERE c.public_id = ${collegeId}
        `;
    return rows[0]?.count ?? 0;
  },
};

/* ── the store ── */
function adapterFor(res: ResourceDef): Adapter {
  const a = ADAPTERS[res.key];
  if (!a) throw new Error(`No table for resource ${res.key}`);
  return a;
}

async function syncUnlinkedLearningCourses(t: Tx) {
  try {
    const unlinked = await t.learningCourse.findMany({
      where: { courseRecordId: null },
      select: {
        id: true,
        collegeId: true,
        code: true,
        title: true,
        departmentId: true,
        termId: true,
        credits: true,
        facultyName: true,
        summary: true,
        status: true,
      },
      take: 50,
    });
    for (const lc of unlinked) {
      let c = await t.course.findFirst({
        where: { collegeId: lc.collegeId, code: lc.code },
        select: { id: true },
      });
      if (!c) {
        c = await t.course.create({
          data: {
            collegeId: lc.collegeId,
            code: lc.code,
            title: lc.title,
            departmentId: lc.departmentId,
            termId: lc.termId,
            credits: lc.credits,
            courseType: "Theory",
            facultyName: lc.facultyName,
            status: lc.status === "Published" ? "Active" : "Draft",
            description: lc.summary,
          },
          select: { id: true },
        });
      }
      await t.learningCourse.update({
        where: { id: lc.id },
        data: { courseRecordId: c.id },
      });
    }
  } catch {
    // continue
  }
}

export const pgRecords: RecordStore = {
  async list(res, query) {
    if (res.key === "users") return usersStore.list(query);
    if (res.key === "questions") return questionsStore.list(query);
    const a = adapterFor(res);
    const t = db();
    if (res.key === "courses") await syncUnlinkedLearningCourses(t);
    const base = await scopeFilter(res, query.scope, query.college);
    const statusValue = query.status && a.statusEnum ? maybeEnum(a.statusEnum, query.status) : undefined;
    if (query.status && a.statusEnum && !statusValue) return { items: [], total: 0, counts: {} };
    const where = { ...base, ...(statusValue ? { status: statusValue } : {}), ...searchFilter(a, query.q) };
    const [rows, total, grouped] = await Promise.all([
      a.delegate(t).findMany({ where, include: a.include, orderBy: { updatedAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      a.delegate(t).count({ where }),
      a.statusEnum ? a.delegate(t).groupBy({ by: ["status"], where: base, _count: { _all: true } }) : Promise.resolve([]),
    ]);
    const counts: Record<string, number> = {};
    for (const g of grouped as Array<{ status: string; _count: { _all: number } }>) counts[label(a.statusEnum!, g.status)] = g._count._all;
    return { items: await Promise.all((rows as Row[]).map((r) => present(res, a, r))), total, counts };
  },

  async all(res, scope) {
    if (res.key === "users") return (await usersStore.list({ scope, page: 1, pageSize: 10_000 })).items;
    if (res.key === "questions") return questionsStore.all(scope);
    const a = adapterFor(res);
    if (res.key === "courses") await syncUnlinkedLearningCourses(db());
    const rows: Row[] = await a.delegate(db()).findMany({ where: await scopeFilter(res, scope), include: a.include, orderBy: { updatedAt: "desc" } });
    return Promise.all(rows.map((r) => present(res, a, r)));
  },

  async get(res, id) {
    if (res.key === "users") return usersStore.get(id);
    if (res.key === "questions") return questionsStore.get(id);
    const a = adapterFor(res);
    const row = await a.delegate(db()).findUnique({ where: { publicId: id }, include: a.include });
    return row ? present(res, a, row) : undefined;
  },

  async create(res, data, collegeId) {
    if (res.key === "users") return usersStore.create(data, collegeId);
    if (res.key === "questions") return questionsStore.create(data, collegeId);
    const a = adapterFor(res);
    const t = db();
    const cols = await a.toColumns(data, await streamOf(collegeId));
    const extra = res.key === "colleges" ? { universityId: await universityId() } : { collegeId: await collegeUuid(collegeId!) };
    const row = await a.delegate(t).create({ data: { ...cols, ...extra } });
    await a.afterWrite?.(t, row.id, data);
    return (await this.get(res, row.publicId))!;
  },

  async update(res, id, data, version) {
    if (res.key === "users") return usersStore.update(id, data, version);
    if (res.key === "questions") return questionsStore.update(id, data, version);
    const a = adapterFor(res);
    const t = db();
    const existing = await a.delegate(t).findUnique({ where: { publicId: id }, select: { id: true, ...(res.scoped ? { collegeId: true } : {}) } });
    if (!existing) return undefined;
    const stream = res.scoped ? (await collegeByUuid(existing.collegeId))?.stream ?? null : null;
    const r = await a.delegate(t).updateMany({ where: { publicId: id, version }, data: await a.toColumns(data, stream) });
    if (r.count === 0) return "stale";
    await a.afterWrite?.(t, existing.id, data);
    return this.get(res, id);
  },

  async delete(res, id) {
    if (res.key === "users") return usersStore.delete(id);
    if (res.key === "questions") return questionsStore.delete(id);
    if (res.key === "staff") {
      const t = db();
      const staff = await t.staff.findFirst({ where: { publicId: id } });
      if (staff?.userId) {
        await t.roleAssignment.deleteMany({ where: { userId: staff.userId, collegeId: staff.collegeId } });
        const remainingRoles = await t.roleAssignment.count({ where: { userId: staff.userId } });
        const isStudent = await t.student.count({ where: { userId: staff.userId } });
        if (remainingRoles === 0 && isStudent === 0) {
          await t.userCredential.deleteMany({ where: { userId: staff.userId } });
          await t.userSession.deleteMany({ where: { userId: staff.userId } });
          await t.staff.deleteMany({ where: { publicId: id } });
          await t.user.deleteMany({ where: { id: staff.userId } });
          return true;
        }
      }
    }
    const a = adapterFor(res);
    const r = await a.delegate(db()).deleteMany({ where: { publicId: id } });
    if (res.key === "colleges") collegesChanged();
    return r.count > 0;
  },

  async taken(res, field, value, collegeId, excludeId) {
    if (!value) return false;
    if (res.key === "questions") return false;
    const t = db();
    if (res.key === "users" && field === "email") {
      const u = await t.user.findFirst({ where: { email: { equals: value, mode: "insensitive" } }, select: { publicId: true } });
      return !!u && u.publicId !== excludeId;
    }
    const a = adapterFor(res);
    if (res.key === "departments" && field === "department") {
      // One row per department per college (the column holds the lookup id, not the name).
      const c = await collegeByPublic(collegeId);
      if (!c) return false;
      const departmentId = await lookupId("departments", c.stream, value).catch(() => null);
      if (departmentId === null) return false;
      return (await t.collegeDepartment.count({ where: { collegeId: c.id, departmentId, ...(excludeId ? { NOT: { publicId: excludeId } } : {}) } })) > 0;
    }
    const where: Record<string, unknown> = { [field]: { equals: value, mode: "insensitive" }, ...(excludeId ? { NOT: { publicId: excludeId } } : {}) };
    if (collegeId && res.scoped) where.collegeId = await collegeUuid(collegeId);
    return (await a.delegate(t).count({ where })) > 0;
  },

  async count(res, collegeId, where = {}) {
    if (res.key === "questions") return questionsStore.count(collegeId, where);
    const uuid = (await collegeByPublic(collegeId))?.id;
    if (!uuid) return 0;
    const t = db();
    if (res.key === "users") {
      const status = maybeEnum("UserStatus", where.status);
      return t.roleAssignment.count({ where: { collegeId: uuid, ...(status ? { user: { status } } : {}) } as any });
    }
    const a = adapterFor(res);
    const filter: Record<string, unknown> = { collegeId: uuid };
    if (where.status !== undefined && a.statusEnum) {
      const v = maybeEnum(a.statusEnum, where.status);
      if (!v) return 0;
      filter.status = v;
    }
    return a.delegate(t).count({ where: filter });
  },

  async countInCollege(collegeId) {
    let n = 0;
    for (const res of Object.values(RESOURCES)) if (res.scoped) n += await this.count(res, collegeId);
    return n;
  },

  async stats(res, records) {
    const out = new Map<string, Record<string, number>>();
    if (res.key !== "departments" || records.length === 0) return out;
    // Live figures per department row: active teaching staff, active students, the programmes those
    // students are on, and their average placement readiness (v_placement_readiness).
    const rows = await db().$queryRaw<Array<{ public_id: string; faculty: bigint; students: bigint; programmes: bigint; readiness: number | null }>>`
      SELECT cd.public_id,
             (SELECT count(*) FROM staff s WHERE s.college_id = cd.college_id AND s.department_id = cd.department_id AND s.staff_type = 'Teaching' AND s.status = 'Active') AS faculty,
             (SELECT count(*) FROM students st WHERE st.college_id = cd.college_id AND st.department_id = cd.department_id AND st.status = 'Active') AS students,
             (SELECT count(DISTINCT st.programme_id) FROM students st WHERE st.college_id = cd.college_id AND st.department_id = cd.department_id AND st.status = 'Active') AS programmes,
             (SELECT round(avg(v.total))::int FROM v_placement_readiness v JOIN students st ON st.id = v.student_id
               WHERE st.college_id = cd.college_id AND st.department_id = cd.department_id) AS readiness
      FROM college_departments cd
      WHERE cd.public_id = ANY(${records.map((r) => r.id)}::text[])`;
    for (const r of rows) out.set(r.public_id, { faculty: Number(r.faculty), students: Number(r.students), programmes: Number(r.programmes), readiness: Number(r.readiness ?? 0) });
    return out;
  },
};
