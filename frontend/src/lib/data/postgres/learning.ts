import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { CourseUnit, LearningCourse, Lesson } from "@/lib/api/mock/course-state";
import type { Certificate, Quiz, ReadinessBase } from "@/lib/api/mock/learning";
import { Figure, MAX_FIGURES } from "@/lib/api/figure-schemas";
import { parseVideoUrl } from "@/lib/video";
import type { Attempt, AttemptStore, CertificateStore, CourseStore, ProgressStore, QuizStore, ReadinessStore } from "../store";
import { db, isUuid, recall, remember } from "./db";
import { enumValue, label } from "./enums";
import { collegeByPublic, collegeByUuid, collegePublic, imageRef, lookupId, refOf, studentOf, userOrNull } from "./lookups";

/* AI Course Studio courses, lesson progress, quizzes, attempts, certificates and placement readiness. */

/** Placement aptitude quizzes are not tied to an academic department (mirrors APTITUDE_DEPARTMENT). */
const APTITUDE = "Training & Placement";
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);

/* â”€â”€ courses â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const COURSE_INCLUDE = {
  courseUnits: {
    orderBy: { position: "asc" },
    include: {
      lessons: {
        orderBy: { position: "asc" },
        include: { lessonVideos: { orderBy: { position: "asc" } }, lessonImages: { orderBy: { position: "asc" }, include: { imageMedia: { select: { publicId: true } } } } },
      },
    },
  },
  courseOutcomes: { orderBy: { code: "asc" } },
  department: { select: { name: true } },
  term: { select: { name: true } },
  quiz: { select: { publicId: true } },
  courseRecord: { select: { publicId: true } },
} satisfies Prisma.LearningCourseInclude;
type CourseRow = Prisma.LearningCourseGetPayload<{ include: typeof COURSE_INCLUDE }>;

const arr = <T,>(v: Prisma.JsonValue): T[] => (Array.isArray(v) ? (v as T[]) : []);
/** Stored diagrams, re-checked on the way out so one damaged entry cannot break a lesson. */
const figuresOf = (v: Prisma.JsonValue): Figure[] => arr<unknown>(v).flatMap((x) => (Figure.safeParse(x).success ? [Figure.parse(x)] : []));

async function toCourse(r: CourseRow): Promise<LearningCourse> {
  return {
    id: r.publicId,
    collegeId: await collegePublic(r.collegeId),
    department: r.department.name,
    title: r.title,
    code: r.code,
    level: label("CourseLevel", r.level),
    semester: r.term.name,
    credits: r.credits,
    faculty: r.facultyName,
    source: label("CourseSource", r.source) as LearningCourse["source"],
    syllabus: r.syllabus,
    summary: r.summary,
    units: r.courseUnits.map(
      (u): CourseUnit => ({
        title: u.title,
        ...(u.part ? { part: u.part } : {}),
        lessons: u.lessons.map((l): Lesson => {
          // Optional parts are left out when empty, as the course generator does.
          const opt = <K extends string, T>(key: K, xs: T[]) => (xs.length ? ({ [key]: xs } as Record<K, T[]>) : {});
          return {
            id: l.code,
            title: l.title,
            minutes: l.minutes,
            objectives: arr<string>(l.objectives),
            body: l.body,
            keyPoints: arr<string>(l.keyPoints),
            layout: label("LessonLayout", l.layout) as Lesson["layout"],
            ...opt("terms", arr<{ term: string; meaning: string }>(l.terms)),
            ...opt("practice", arr<{ q: string; a: string }>(l.practice)),
            ...opt("videos", l.lessonVideos.map((v) => ({ title: v.title, url: v.url }))),
            ...opt("links", arr<{ label: string; url: string }>(l.links)),
            ...opt("figures", figuresOf(l.figures)),
            ...opt("images", l.lessonImages.map((i) => ({ ref: refOf(i.imageMedia, i.imageBuiltin), caption: i.caption }))),
          };
        }),
      }),
    ),
    outcomes: r.courseOutcomes.map((o) => ({ code: o.code, text: o.text, bloom: label("BloomLevel", o.bloom) })),
    finalQuizId: r.quiz?.publicId ?? "",
    status: label("PublishStatus", r.status) as LearningCourse["status"],
    createdBy: r.createdByName,
    createdBySub: r.createdBy,
    createdAt: r.createdAt.toISOString(),
    publishedAt: r.publishedAt?.toISOString() ?? null,
    courseRecordId: r.courseRecord?.publicId ?? null,
    version: r.version,
  };
}

async function scopeWhere(scope: string) {
  if (scope === "all") return {};
  return { collegeId: (await collegeByPublic(scope))?.id ?? "00000000-0000-0000-0000-000000000000" };
}

async function saveLessons(t: Prisma.TransactionClient, courseUuid: string, course: LearningCourse) {
  // Positions are unique per parent; deferring the checks lets chapters and lessons be reordered freely.
  await t.$executeRawUnsafe("SET CONSTRAINTS ALL DEFERRED");
  // (Deferrable uniques cannot back ON CONFLICT, so rows are matched by position by hand.)
  const unitByPosition = new Map((await t.courseUnit.findMany({ where: { courseId: courseUuid }, select: { id: true, position: true } })).map((u) => [u.position, u.id]));
  const unitIds: string[] = [];
  for (const [position, u] of course.units.entries()) {
    const cols = { title: clip(u.title, 100), part: u.part ?? null };
    const id = unitByPosition.get(position);
    unitIds.push(id ? (await t.courseUnit.update({ where: { id }, data: cols, select: { id: true } })).id : (await t.courseUnit.create({ data: { ...cols, courseId: courseUuid, position }, select: { id: true } })).id);
  }
  const existing = new Map((await t.lesson.findMany({ where: { courseId: courseUuid }, select: { id: true, code: true } })).map((l) => [l.code, l.id]));
  const keep = new Set<string>();
  for (const [ui, u] of course.units.entries()) {
    for (const [position, l] of u.lessons.entries()) {
      const cols = {
        unitId: unitIds[ui]!,
        position,
        title: clip(l.title, 120),
        minutes: l.minutes,
        layout: enumValue("LessonLayout", l.layout ?? "concepts") as never,
        body: clip(l.body, 8000),
        objectives: (l.objectives ?? []).slice(0, 6),
        keyPoints: l.keyPoints.slice(0, 6),
        terms: (l.terms ?? []).slice(0, 8),
        practice: (l.practice ?? []).slice(0, 6),
        links: (l.links ?? []).slice(0, 6),
        figures: (l.figures ?? []).slice(0, MAX_FIGURES) as unknown as Prisma.InputJsonValue,
      };
      const id = existing.get(l.id);
      const lessonId = id
        ? (await t.lesson.update({ where: { id }, data: cols, select: { id: true } })).id
        : (await t.lesson.create({ data: { ...cols, courseId: courseUuid, code: l.id }, select: { id: true } })).id;
      keep.add(l.id);
      await t.lessonVideo.deleteMany({ where: { lessonId } });
      const videos = (l.videos ?? []).slice(0, 6).flatMap((v, i) => {
        const p = parseVideoUrl(v.url);
        return p ? [{ lessonId, position: i, title: clip(v.title, 120), url: p.url, kind: p.kind as never, youtubeId: p.kind === "youtube" ? p.id : null }] : [];
      });
      if (videos.length) await t.lessonVideo.createMany({ data: videos });
      await t.lessonImage.deleteMany({ where: { lessonId } });
      const images = [];
      for (const [i, img] of (l.images ?? []).slice(0, 6).entries()) {
        const ref = await imageRef(img.ref);
        images.push({ lessonId, position: i, imageMediaId: ref.mediaId, imageBuiltin: ref.builtin, caption: clip(img.caption, 160) });
      }
      if (images.length) await t.lessonImage.createMany({ data: images });
    }
  }
  const removed = [...existing.entries()].filter(([code]) => !keep.has(code)).map(([, id]) => id);
  if (removed.length) await t.lesson.deleteMany({ where: { id: { in: removed } } });
  await t.courseUnit.deleteMany({ where: { courseId: courseUuid, position: { gte: course.units.length } } });
  await t.courseOutcome.deleteMany({ where: { courseId: courseUuid } });
  if (course.outcomes.length) {
    await t.courseOutcome.createMany({
      data: course.outcomes.slice(0, 9).map((o, i) => ({ courseId: courseUuid, code: `CO${i + 1}`, bloom: enumValue("BloomLevel", o.bloom) as never, text: clip(o.text, 400) })),
    });
  }
}

export const pgCourses: CourseStore = {
  async list(scope) {
    const rows = await db().learningCourse.findMany({ where: await scopeWhere(scope), include: COURSE_INCLUDE });
    return Promise.all(rows.map(toCourse));
  },
  async get(id) {
    const r = await db().learningCourse.findUnique({ where: { publicId: id }, include: COURSE_INCLUDE });
    return r ? toCourse(r) : undefined;
  },
  async save(course) {
    const t = db();
    const college = await collegeByPublic(course.collegeId);
    if (!college) throw new Error(`Unknown college ${course.collegeId}`);
    let courseRecord = course.courseRecordId
      ? await t.course.findUnique({ where: { publicId: course.courseRecordId }, select: { id: true } })
      : null;
    if (!courseRecord) {
      courseRecord = await t.course.findFirst({
        where: { collegeId: college.id, code: course.code },
        select: { id: true },
      });
    }
    const deptId = await lookupId("departments", college.stream, course.department);
    const tId = await lookupId("terms", college.stream, course.semester);

    const published = course.status === "Published";
    if (!courseRecord) {
      courseRecord = await t.course.create({
        data: {
          collegeId: college.id,
          code: course.code,
          title: clip(course.title, 100),
          departmentId: deptId,
          termId: tId,
          credits: course.credits,
          courseType: "Theory",
          facultyName: clip(course.faculty, 80),
          status: published ? "Active" : "Draft",
          description: clip(course.summary, 600),
        },
        select: { id: true },
      });
    } else {
      await t.course.update({
        where: { id: courseRecord.id },
        data: {
          title: clip(course.title, 100),
          departmentId: deptId,
          termId: tId,
          credits: course.credits,
          facultyName: clip(course.faculty, 80),
          status: published ? "Active" : "Draft",
          description: clip(course.summary, 600),
        },
      });
    }

    const cols = {
      departmentId: deptId,
      termId: tId,
      code: course.code,
      title: clip(course.title, 100),
      level: enumValue("CourseLevel", course.level) as never,
      credits: course.credits,
      facultyName: clip(course.faculty, 80),
      source: enumValue("CourseSource", course.source) as never,
      syllabus: course.syllabus.slice(0, 6000),
      summary: clip(course.summary, 600),
      status: enumValue("PublishStatus", course.status) as never,
      publishedAt: published ? new Date(course.publishedAt ?? Date.now()) : null,
      courseRecordId: courseRecord.id,
      createdByName: course.createdBy,
      version: course.version,
    };
    const row = await t.learningCourse.upsert({
      where: { publicId: course.id },
      create: { ...cols, publicId: course.id, collegeId: college.id, createdBy: userOrNull(course.createdBySub), createdAt: new Date(course.createdAt) },
      update: cols,
      select: { id: true },
    });
    await saveLessons(t, row.id, course);
  },
  async delete(id) {
    const t = db();
    const c = await t.learningCourse.findUnique({ where: { publicId: id }, select: { id: true } });
    if (c) {
      const linkedQuizzes = await t.quiz.findMany({ where: { learningCourseId: c.id }, select: { id: true } });
      for (const q of linkedQuizzes) {
        await t.quizAttemptAnswer.deleteMany({ where: { attempt: { quizId: q.id } } });
        await t.quizAttempt.deleteMany({ where: { quizId: q.id } });
      }
      await t.lessonProgress.deleteMany({ where: { lesson: { courseId: c.id } } });
      await t.learningCourse.delete({ where: { id: c.id } });
    }
  },
};

/* â”€â”€ lesson progress â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
export const pgProgress: ProgressStore = {
  async get(sub, courseId) {
    const st = await studentOf(sub);
    if (!st) return [];
    const rows = await db().lessonProgress.findMany({
      where: { studentId: st.id, lesson: { course: { publicId: courseId } } },
      select: { lesson: { select: { code: true, position: true, unit: { select: { position: true } } } } },
    });
    return rows
      .map((r) => r.lesson)
      .sort((a, b) => a.unit.position - b.unit.position || a.position - b.position)
      .map((l) => l.code);
  },
  async set(sub, courseId, lessonIds) {
    const st = await studentOf(sub);
    if (!st) throw new Error("Lesson progress is kept for student accounts only.");
    const lessons = await db().lesson.findMany({ where: { course: { publicId: courseId }, code: { in: lessonIds } }, select: { id: true } });
    await db().lessonProgress.createMany({ data: lessons.map((l) => ({ studentId: st.id, lessonId: l.id })), skipDuplicates: true });
  },
  async learners(courseId) {
    const rows = await db().lessonProgress.findMany({
      where: { lesson: { course: { publicId: courseId } } },
      distinct: ["studentId"],
      select: { student: { select: { userId: true } } },
    });
    return rows.map((r) => r.student.userId);
  },
};

/* â”€â”€ quizzes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const QUIZ_INCLUDE = {
  quizQuestions: { orderBy: { position: "asc" } },
  department: { select: { name: true } },
  learningCourse: { select: { publicId: true } },
} satisfies Prisma.QuizInclude;
type QuizRow = Prisma.QuizGetPayload<{ include: typeof QUIZ_INCLUDE }>;

async function toQuiz(r: QuizRow): Promise<Quiz> {
  return {
    id: r.publicId,
    collegeId: await collegePublic(r.collegeId),
    title: r.title,
    department: r.purpose === "placement_aptitude" ? APTITUDE : (r.department?.name ?? ""),
    course: r.subject,
    passMark: r.passMark,
    durationMin: r.durationMin,
    certificateEnabled: r.certificateEnabled,
    status: label("QuizStatus", r.status) as Quiz["status"],
    questions: r.quizQuestions.map((q) => ({ prompt: q.prompt, options: q.options as [string, string, string, string], answer: q.answer, explanation: q.explanation, review: q.needsReview })),
    ...(r.learningCourse ? { courseId: r.learningCourse.publicId } : {}),
    createdBy: r.createdByName,
    createdAt: r.createdAt.toISOString(),
  };
}

export const pgQuizzes: QuizStore = {
  async list(scope, opts) {
    const rows = await db().quiz.findMany({
      where: { ...(await scopeWhere(scope)), ...(opts?.includeCourseFinals ? {} : { NOT: { purpose: "course_final" } }) },
      include: QUIZ_INCLUDE,
    });
    return Promise.all(rows.map(toQuiz));
  },
  async get(id) {
    const r = await db().quiz.findUnique({ where: { publicId: id }, include: QUIZ_INCLUDE });
    return r ? toQuiz(r) : undefined;
  },
  async save(quiz) {
    const t = db();
    const college = await collegeByPublic(quiz.collegeId);
    if (!college) throw new Error(`Unknown college ${quiz.collegeId}`);
    const purpose = quiz.courseId ? "course_final" : quiz.department === APTITUDE ? "placement_aptitude" : "department";
    const course = quiz.courseId ? await t.learningCourse.findUnique({ where: { publicId: quiz.courseId }, select: { id: true } }) : null;
    const cols = {
      purpose: purpose as never,
      learningCourseId: course?.id ?? null,
      departmentId: purpose === "placement_aptitude" ? null : await lookupId("departments", college.stream, quiz.department),
      title: clip(quiz.title, 140),
      subject: clip(quiz.course, 120),
      passMark: quiz.passMark,
      durationMin: quiz.durationMin,
      certificateEnabled: quiz.certificateEnabled,
      status: enumValue("QuizStatus", quiz.status) as never,
      createdByName: quiz.createdBy,
    };
    const row = await t.quiz.upsert({
      where: { publicId: quiz.id },
      create: { ...cols, publicId: quiz.id, collegeId: college.id, createdBy: null, createdAt: new Date(quiz.createdAt) },
      update: cols,
      select: { id: true },
    });
    // Questions are updated in place by position: answered questions keep their id (attempt history).
    await t.$executeRawUnsafe("SET CONSTRAINTS ALL DEFERRED");
    const byPosition = new Map((await t.quizQuestion.findMany({ where: { quizId: row.id }, select: { id: true, position: true } })).map((q) => [q.position, q.id]));
    for (const [position, q] of quiz.questions.entries()) {
      const cols = { prompt: clip(q.prompt, 400), options: [...q.options], answer: q.answer, explanation: clip(q.explanation ?? "", 400), needsReview: Boolean(q.review) };
      const id = byPosition.get(position);
      if (id) await t.quizQuestion.update({ where: { id }, data: cols });
      else await t.quizQuestion.create({ data: { ...cols, quizId: row.id, position } });
    }
    await t.quizQuestion.deleteMany({ where: { quizId: row.id, position: { gte: quiz.questions.length } } });
  },
  async delete(id) {
    const t = db();
    const q = await t.quiz.findUnique({ where: { publicId: id }, select: { id: true } });
    if (q) {
      await t.quizAttemptAnswer.deleteMany({ where: { attempt: { quizId: q.id } } });
      await t.quizAttempt.deleteMany({ where: { quizId: q.id } });
      await t.quiz.delete({ where: { id: q.id } });
    }
  },
};

/* â”€â”€ attempts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
export const pgAttempts: AttemptStore = {
  async list({ quizId, studentSub, collegeId }) {
    if (studentSub !== undefined && !isUuid(studentSub)) return [];
    const college = collegeId ? await collegeByPublic(collegeId) : undefined;
    const rows = await db().quizAttempt.findMany({
      where: {
        submittedAt: { not: null },
        ...(quizId ? { quiz: { publicId: quizId } } : {}),
        ...(studentSub ? { student: { userId: studentSub } } : {}),
        ...(collegeId ? { collegeId: college?.id ?? "00000000-0000-0000-0000-000000000000" } : {}),
      },
      include: { quiz: { select: { publicId: true } }, student: { select: { userId: true, user: { select: { fullName: true } } } } },
      orderBy: { startedAt: "asc" },
    });
    return Promise.all(
      rows.map(
        async (r): Promise<Attempt> => ({
          quizId: r.quiz.publicId,
          studentSub: r.student.userId,
          studentName: r.student.user.fullName,
          collegeId: (await collegeByUuid(r.collegeId))?.publicId ?? "",
          score: r.score ?? 0,
          total: r.total ?? 0,
          percentage: Number(r.percentage ?? 0),
          at: (r.submittedAt ?? r.startedAt).toISOString(),
        }),
      ),
    );
  },
  async add(a) {
    const t = db();
    const st = await studentOf(a.studentSub);
    if (!st) throw new Error("Quiz attempts are kept for student accounts only.");
    const quiz = await t.quiz.findUniqueOrThrow({ where: { publicId: a.quizId }, select: { id: true, quizQuestions: { select: { id: true }, orderBy: { position: "asc" } } } });
    const at = new Date(a.at);
    const row = await t.quizAttempt.create({
      data: { quizId: quiz.id, studentId: st.id, collegeId: st.collegeId, startedAt: at, submittedAt: at, score: a.score, total: a.total, percentage: a.percentage },
      select: { id: true },
    });
    if (a.answers?.length) {
      const answers = await t.quizQuestion.findMany({ where: { quizId: quiz.id }, select: { id: true, answer: true }, orderBy: { position: "asc" } });
      await t.quizAttemptAnswer.createMany({
        data: answers.map((q, i) => ({ attemptId: row.id, questionId: q.id, chosen: a.answers?.[i] ?? null, correct: a.answers?.[i] === q.answer })),
      });
    }
    remember(`attempt:${a.quizId}:${a.studentSub}`, row.id);
  },
};

/* â”€â”€ certificates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const CERT_INCLUDE = { quiz: { select: { publicId: true } }, student: { select: { userId: true } } } satisfies Prisma.CertificateInclude;
type CertRow = Prisma.CertificateGetPayload<{ include: typeof CERT_INCLUDE }>;

async function toCert(r: CertRow): Promise<Certificate> {
  return {
    id: r.publicId,
    kind: label("CertificateKind", r.kind) as Certificate["kind"],
    studentSub: r.student.userId,
    studentName: r.studentName,
    collegeId: await collegePublic(r.collegeId),
    quizId: r.quiz.publicId,
    title: r.title,
    course: r.course,
    department: r.departmentName,
    marks: r.marks,
    total: r.total,
    percentage: Number(r.percentage),
    grade: label("CertificateGrade", r.grade),
    gradeLabel: r.gradeLabel,
    issuedAt: r.issuedAt.toISOString(),
    signature: r.signature,
  };
}

export const pgCertificates: CertificateStore = {
  async list({ quizId, studentSub, scope }) {
    if (studentSub !== undefined && !isUuid(studentSub)) return [];
    const rows = await db().certificate.findMany({
      where: {
        supersededAt: null,
        ...(quizId ? { quiz: { publicId: quizId } } : {}),
        ...(studentSub ? { student: { userId: studentSub } } : {}),
        ...(scope ? await scopeWhere(scope) : {}),
      },
      include: CERT_INCLUDE,
    });
    return Promise.all(rows.map(toCert));
  },
  async get(id) {
    const r = await db().certificate.findFirst({ where: { publicId: id, supersededAt: null }, include: CERT_INCLUDE });
    return r ? toCert(r) : undefined;
  },
  async issue(cert, replaces) {
    const t = db();
    const st = await studentOf(cert.studentSub);
    if (!st) throw new Error("Certificates are issued to student accounts only.");
    const quiz = await t.quiz.findUniqueOrThrow({ where: { publicId: cert.quizId }, select: { id: true } });
    const attemptId =
      recall<string>(`attempt:${cert.quizId}:${cert.studentSub}`) ??
      (await t.quizAttempt.findFirstOrThrow({ where: { quizId: quiz.id, studentId: st.id }, orderBy: { startedAt: "desc" }, select: { id: true } })).id;
    const id = randomUUID();
    // The old certificate stops being "active" first (its pointer to the new row is checked at commit).
    if (replaces) await t.certificate.updateMany({ where: { publicId: replaces, supersededAt: null }, data: { supersededAt: new Date(), supersededById: id } });
    await t.certificate.create({
      data: {
        id,
        publicId: cert.id,
        kind: enumValue("CertificateKind", cert.kind) as never,
        quizId: quiz.id,
        attemptId,
        studentId: st.id,
        collegeId: st.collegeId,
        studentName: cert.studentName,
        title: cert.title,
        course: cert.course,
        departmentName: cert.department,
        marks: cert.marks,
        total: cert.total,
        percentage: cert.percentage,
        grade: enumValue("CertificateGrade", cert.grade) as never,
        gradeLabel: cert.gradeLabel,
        issuedAt: new Date(cert.issuedAt),
        signature: cert.signature,
      },
    });
  },
};

/* â”€â”€ placement readiness (view v_placement_readiness) â”€â”€ */
interface ReadinessRow {
  student_id: string;
  user_id: string;
  college_id: string;
  roll_no: string;
  name: string;
  department: string;
  quiz_average: Prisma.Decimal | number;
  certificates: bigint | number;
  aptitude: Prisma.Decimal | number;
  interview: number;
  resume: number;
}
async function toReadiness(r: ReadinessRow): Promise<ReadinessBase> {
  return {
    studentSub: r.user_id,
    name: r.name,
    rollNo: r.roll_no,
    department: r.department,
    collegeId: await collegePublic(r.college_id),
    quizAverage: Number(r.quiz_average),
    certificates: Number(r.certificates),
    aptitude: Number(r.aptitude),
    interview: Number(r.interview),
    resume: Number(r.resume),
  };
}

export const pgReadiness: ReadinessStore = {
  async forStudent(session) {
    const st = await studentOf(session.sub);
    if (st) {
      const rows = await db().$queryRaw<ReadinessRow[]>`
        SELECT v.*, s.user_id FROM v_placement_readiness v JOIN students s ON s.id = v.student_id WHERE v.student_id = ${st.id}::uuid AND s.status = 'Active'`;
      if (rows[0]) return toReadiness(rows[0]);
    }
    return { studentSub: session.sub, name: session.name, rollNo: "", department: "", collegeId: session.college, quizAverage: 0, certificates: 0, aptitude: 0, interview: 0, resume: 0 };
  },
  async board(collegeId) {
    const c = await collegeByPublic(collegeId);
    if (!c) return [];
    const rows = await db().$queryRaw<ReadinessRow[]>`
      SELECT v.*, s.user_id FROM v_placement_readiness v JOIN students s ON s.id = v.student_id WHERE v.college_id = ${c.id}::uuid AND s.status = 'Active'`;
    return Promise.all(rows.map(toReadiness));
  },
};
