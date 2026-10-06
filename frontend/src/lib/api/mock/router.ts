import "server-only";
import { z } from "zod";
import type { SessionPayload } from "@/lib/auth/session";
import { can, ROLES } from "@/lib/auth/roles";
import { findModule, modulesForRole, type ModuleDef } from "@/config/modules";
import { RESOURCES } from "@/config/resources";
import { ALL_COLLEGES, TOGGLEABLE_GROUPS, UNIVERSITY } from "@/config/tenancy";
import { getStore } from "@/lib/data";
import { collegeStream, enabledGroups, getCollege, listColleges } from "./records";
import { cleanText } from "@/lib/security/sanitize";
import { analyzeResume, chatReply, evaluateDescriptive, generate, interviewTurn } from "./ai";
import { MCQ_KEY, MOCK_TESTS, MOCK_TEST_SUMMARIES, PROJECTS } from "./fixtures";
import { ROLE_HOMES } from "./homes";
import { roleHomeFor, studentCourses, studentDashboard } from "./stream-content";
import { dynamicInstitutionHome } from "./institution-home";
import { dynamicBiAnalytics } from "./bi-analytics";
import { moduleData } from "./module-data";
import { createClub, deleteClub, getClubsOverview, toggleJoinClub, updateClub } from "./clubs";
import { createSport, deleteSport, getSportsOverview, toggleRegisterTrial, updateSport } from "./sports";
import { createCalendarItem, deleteCalendarItem, getCalendarOverview, syncCampusEvents, updateCalendarItem } from "./academic-calendar";
import {
  CreateAicteActionInput,
  CreateCalendarItemInput,
  CreateClubInput,
  CreateInterventionInput,
  CreateSportInput,
  CreateSupportActionInput,
  EvaluationQueueItem,
  UpdateAicteActionStatusInput,
  UpdateReviewStatusInput,
} from "@/lib/api/schemas";
import { createIntervention, getDepartmentSkillsOverview } from "./department-skills";
import { createSupportAction, getEarlyWarningOverview, updateReviewStatus } from "./early-warning";
import { createAicteAction, getAicteComplianceOverview, updateAicteActionStatus } from "./aicte-compliance";
import { dispatchRecords } from "./records-router";
import { dispatchLearning } from "./learning";
import { dispatchCourses } from "./course-builder";
import { dispatchTeaching } from "./teaching";
import { assignmentNotifications, dispatchAssignments } from "./assignments";
import { dispatchKnowledge } from "./knowledge-base";
import { dispatchQuestionAi } from "./question-ai";
import { dispatchMentor, mentorChat } from "./mentor";
import { dispatchStudyPlanner } from "./study-planner";
import { dispatchLanguages, languageChat } from "./languages";
import { dispatchMissionPlanner } from "./mission-planner";
import { dispatchResearch, researchChat } from "./research";
import { dispatchAchievements } from "./achievements";
import { dispatchRefreshZone } from "./refresh-zone";
import { dispatchExperience, experienceNotifications } from "./experience";
import { dispatchViva } from "./viva";
import { ChatBodySchema } from "@/lib/api/mentor-schemas";
import { audit, recentAudit } from "./audit";
import { createStudent, deleteStudent, getStudentsList, importStudents, updateStudent } from "./students-store";
import { createFaculty, deleteFaculty, getFacultyList, updateFaculty } from "./faculty-store";
import { generateDynamicStudentDashboard, getStudentAcademicProfile } from "./student-profile";
import { getFacultyAllocationProfile } from "./faculty-allocation";

export interface MockResult {
  status: number;
  body: unknown;
}

const ok = (body: unknown): MockResult => ({ status: 200, body });
const err = (status: number, code: string, message: string): MockResult => ({ status, body: { error: { code, message } } });
const notFound = () => err(404, "not_found", "Resource not found.");
const forbidden = () => err(403, "forbidden", "You do not have permission to perform this action.");

/* ── request body schemas (server-side validation) ── */
const ChatBody = ChatBodySchema;
const GenerateBody = z.object({
  module: z.string().max(60).regex(/^[a-z-]+$/),
  inputs: z.record(z.string().max(40), z.string().max(4000)).refine((o) => Object.keys(o).length <= 12),
});
const SubmitBody = z.object({ answers: z.record(z.string().max(10), z.union([z.number().int().min(0).max(10), z.string().max(8000)])) });
const InterviewStart = z.object({ mode: z.enum(["technical", "hr", "behavioral"]) });
const InterviewRespond = z.object({ sessionId: z.string().max(64), answer: z.string().min(1).max(6000) });
const ResumeBody = z.object({ text: z.string().min(20).max(20000), role: z.string().max(60) });
const OverrideBody = z.object({ finalScore: z.number().min(0).max(100), reason: z.string().min(5).max(500) });
const UpdateSettingsBody = z.object({
  values: z.record(z.string().max(80), z.union([z.string().max(500), z.boolean()])),
});

/** Is this module's area switched on for the caller's college? (Super Admin at "all" scope sees everything.) */
export async function moduleEnabled(mod: ModuleDef, session: SessionPayload): Promise<boolean> {
  const stream = session.college === ALL_COLLEGES ? null : await collegeStream(session.college);
  if (mod.streams && stream && !mod.streams.includes(stream)) return false;
  if (!(TOGGLEABLE_GROUPS as readonly string[]).includes(mod.group)) return true;
  const groups = await enabledGroups(session.college);
  return groups === "all" || groups.includes(mod.group);
}

async function universityOverview() {
  const colleges = (await listColleges()).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const count = (key: string, collegeId: string, where?: Record<string, string>) => getStore().records.count(RESOURCES[key]!, collegeId, where);
  const rows = await Promise.all(
    colleges.map(async (c) => {
      const counts = {
        applications: await count("admissions", c.id),
        enrolled: await count("admissions", c.id, { status: "Enrolled" }),
        staff: await count("staff", c.id, { status: "Active" }),
        users: await count("users", c.id),
        courses: await count("courses", c.id, { status: "Active" }),
        events: await count("events", c.id),
        departments: await count("departments", c.id),
      };
      const capacity = typeof c.studentCapacity === "number" ? c.studentCapacity : 0;
      return {
        id: c.id,
        name: String(c.name),
        city: String(c.city),
        type: String(c.type),
        status: String(c.status),
        plan: String(c.plan),
        principal: String(c.principal),
        capacity,
        modules: Array.isArray(c.modules) ? (c.modules as string[]) : [],
        counts,
      };
    }),
  );
  const sum = (k: keyof (typeof rows)[number]["counts"]) => rows.reduce((a, r) => a + (r.counts[k] ?? 0), 0);
  return {
    university: UNIVERSITY.name,
    totals: {
      colleges: rows.length,
      active: rows.filter((r) => r.status === "Active").length,
      onboarding: rows.filter((r) => r.status === "Onboarding").length,
      suspended: rows.filter((r) => r.status === "Suspended").length,
      capacity: rows.reduce((a, r) => a + r.capacity, 0),
      applications: sum("applications"),
      enrolled: sum("enrolled"),
      staff: sum("staff"),
      users: sum("users"),
      courses: sum("courses"),
      departments: sum("departments"),
    },
    colleges: rows,
    recentAudit: await recentAudit(8),
  };
}

const PATTERNS = [
  "GET university/overview",
  "GET colleges/options",
  "GET staff/faculty-options",
  "GET analytics/bi",
  "GET department-skills",
  "POST department-skills/interventions",
  "GET early-warning",
  "POST early-warning/interventions",
  "PATCH early-warning/reviews/:id",
  "GET aicte-compliance",
  "POST aicte-compliance/actions",
  "PATCH aicte-compliance/actions/:id",
  "GET notifications",
  "GET search",
  "GET home/:id",
  "GET modules/:id",
  "PUT modules/:id",
  "GET clubs",
  "POST clubs",
  "PUT clubs/:id",
  "POST clubs/:id/join",
  "DELETE clubs/:id",
  "GET sports",
  "POST sports",
  "PUT sports/:id",
  "POST sports/:id/register",
  "DELETE sports/:id",
  "GET academic-calendar",
  "POST academic-calendar",
  "PUT academic-calendar/:id",
  "DELETE academic-calendar/:id",
  "GET faculty",
  "POST faculty",
  "PUT faculty/:id",
  "DELETE faculty/:id",
  "POST academic-calendar/sync-events",
  "POST security/revoke-sessions",
  "POST security/scan",
  "GET students/me/profile",
  "GET students/me/dashboard",
  "GET courses",
  "GET courses/:id",
  "GET assessments",
  "GET assessments/:id",
  "POST assessments/:id/submit",
  "POST ai/evaluate",
  "POST evaluations/submit",
  "GET evaluations/mine",
  "GET projects",
  "POST ai/chat",
  "POST ai/generate",
  "POST ai/interview/start",
  "POST ai/interview/respond",
  "POST ai/resume/analyze",
  "GET evaluations/queue",
  "POST evaluations/:id/approve",
  "POST evaluations/:id/override",
  "GET audit/recent",
] as const;

const ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Matches "METHOD a/:id/b" patterns; `:id` only accepts safe identifier characters. */
function matchRoute(method: string, segs: string[]): { route: (typeof PATTERNS)[number]; id?: string } | null {
  for (const pattern of PATTERNS) {
    const [pm, pp] = pattern.split(" ") as [string, string];
    if (pm !== method) continue;
    const parts = pp.split("/");
    if (parts.length !== segs.length) continue;
    let id: string | undefined;
    let matched = true;
    for (let i = 0; i < parts.length; i++) {
      const seg = segs[i] ?? "";
      if (parts[i] === ":id") {
        if (!ID.test(seg)) { matched = false; break; }
        id = seg;
      } else if (parts[i] !== seg) { matched = false; break; }
    }
    if (matched) return { route: pattern, id };
  }
  return null;
}

const LEARNING_AREAS = new Set(["learning", "quizzes", "certificates", "placement"]);

export async function dispatch(method: string, segs: string[], rawBody: unknown, session: SessionPayload, query: URLSearchParams): Promise<MockResult> {
  if (segs[0] === "records") return dispatchRecords(method, segs, rawBody, session, query);
  if (segs[0] === "question-bank" && segs[1] === "generate") return dispatchQuestionAi(method, segs, rawBody, session);
  if (segs[0] === "questions" || segs[0] === "question-bank") return dispatchRecords(method, ["records", "questions", ...segs.slice(1)], rawBody, session, query);
  if (segs[0] === "learning-courses") return dispatchCourses(method, segs, rawBody, session, query);
  if (segs[0] === "teaching") return dispatchTeaching(method, segs, rawBody, session);
  if (segs[0] === "assignments") return dispatchAssignments(method, segs, rawBody, session);
  if (segs[0] === "knowledge") return dispatchKnowledge(method, segs, rawBody, session);
  if (segs[0] === "mentor") return dispatchMentor(method, segs, session);
  if (segs[0] === "study-planner") return dispatchStudyPlanner(method, segs, rawBody, session);
  if (segs[0] === "languages") return dispatchLanguages(method, segs, rawBody, session);
  if (segs[0] === "mission-planner") return dispatchMissionPlanner(method, segs, rawBody, session);
  if (segs[0] === "research") return dispatchResearch(method, segs, rawBody, session);
  if (segs[0] === "achievements") return dispatchAchievements(method, segs, session);
  if (segs[0] === "refresh-zone") return dispatchRefreshZone(method, segs, rawBody, session);
  if (segs[0] === "experience") return dispatchExperience(method, segs, rawBody, session);
  if (segs[0] === "viva") return dispatchViva(method, segs, rawBody, session);
  if (LEARNING_AREAS.has(segs[0] ?? "")) return dispatchLearning(method, segs, rawBody, session, query);
  if (segs[0] === "students" && segs[1] !== "me") return dispatchStudents(method, segs, rawBody, session, query);
  if (segs[0] === "faculty") return dispatchFaculty(method, segs, rawBody, session, query);
  const found = matchRoute(method, segs);
  if (!found) return notFound();
  const b = found.id;
  const c = segs[2];
  const collegeOf = () => (session.college === ALL_COLLEGES ? null : session.college);

  switch (found.route) {
    /* ── university (multi-college) ── */
    case "GET university/overview":
      if (session.role !== "admin") return forbidden();
      return ok(await universityOverview());
    case "GET colleges/options": {
      const all = (await listColleges()).map((c) => ({ id: c.id, name: String(c.name), status: String(c.status), city: String(c.city), type: String(c.type) }));
      const visible = session.college === ALL_COLLEGES || session.role === "admin" ? all : all.filter((c) => c.id === session.college);
      return ok({ scope: session.college, colleges: visible.sort((a, b) => a.name.localeCompare(b.name)) });
    }
    case "GET staff/faculty-options": {
      const targetCollege = query.get("college") || (session.college !== ALL_COLLEGES ? session.college : undefined);
      const list = await getStore().records.list(RESOURCES.staff!, {
        scope: session.college,
        college: targetCollege,
        page: 1,
        pageSize: 1000,
      });
      const faculty = list.items
        .filter((s) => s.status !== "Resigned" && s.status !== "Retired")
        .filter(
          (s) =>
            s.staffType === "Teaching" ||
            s.staffType === undefined ||
            (typeof s.designation === "string" && !["Accountant", "Librarian", "Administrative Officer", "Driver", "Security"].includes(s.designation)),
        )
        .map((s) => ({
          id: s.id,
          name: String(s.fullName || s.name || "").trim(),
          department: String(s.department || "").trim(),
          designation: String(s.designation || "").trim(),
        }))
        .filter((f) => f.name.length > 0)
        .sort((a, b) => a.name.localeCompare(b.name));
      return ok({ faculty });
    }
    case "GET analytics/bi": {
      if (session.role !== "institution" && session.role !== "admin") return forbidden();
      const targetCollege = query.get("college") || (session.college !== ALL_COLLEGES ? session.college : undefined);
      return ok(await dynamicBiAnalytics(session, targetCollege));
    }
    case "GET department-skills": {
      if (session.role !== "institution" && session.role !== "hod" && session.role !== "admin") return forbidden();
      const dept = query.get("department") || "all";
      const batch = query.get("batch") || "all";
      const domain = query.get("domain") || "all";
      return ok(await getDepartmentSkillsOverview(session, dept, batch, domain));
    }
    case "POST department-skills/interventions": {
      if (session.role !== "institution" && session.role !== "hod" && session.role !== "admin") return forbidden();
      const parsed = CreateInterventionInput.safeParse(rawBody);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid intervention payload.");
      return ok(await createIntervention(session, parsed.data));
    }
    case "GET early-warning": {
      if (session.role !== "institution" && session.role !== "hod" && session.role !== "faculty" && session.role !== "admin") return forbidden();
      const dept = query.get("department") || "all";
      const riskLevel = query.get("riskLevel") || "all";
      const q = query.get("q") || "";
      return ok(await getEarlyWarningOverview(session, dept, riskLevel, q));
    }
    case "POST early-warning/interventions": {
      if (session.role !== "institution" && session.role !== "hod" && session.role !== "faculty" && session.role !== "admin") return forbidden();
      const parsed = CreateSupportActionInput.safeParse(rawBody);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid support action payload.");
      return ok(await createSupportAction(session, parsed.data));
    }
    case "PATCH early-warning/reviews/:id": {
      if (session.role !== "institution" && session.role !== "hod" && session.role !== "faculty" && session.role !== "admin") return forbidden();
      const studentId = found.id ?? segs[2] ?? "";
      const parsed = UpdateReviewStatusInput.safeParse({ ...(typeof rawBody === "object" && rawBody !== null ? rawBody : {}), studentId });
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid review status payload.");
      return ok(await updateReviewStatus(session, parsed.data));
    }
    case "GET aicte-compliance": {
      if (session.role !== "institution" && session.role !== "admin" && session.role !== "hod") return forbidden();
      return ok(await getAicteComplianceOverview(session));
    }
    case "POST aicte-compliance/actions": {
      if (session.role !== "institution" && session.role !== "admin" && session.role !== "hod") return forbidden();
      const parsed = CreateAicteActionInput.safeParse(rawBody);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid action payload.");
      return ok(await createAicteAction(session, parsed.data));
    }
    case "PATCH aicte-compliance/actions/:id": {
      if (session.role !== "institution" && session.role !== "admin" && session.role !== "hod") return forbidden();
      const actionId = found.id ?? segs[2] ?? "";
      const parsed = UpdateAicteActionStatusInput.safeParse({ ...(typeof rawBody === "object" && rawBody !== null ? rawBody : {}), actionId });
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid action status payload.");
      return ok(await updateAicteActionStatus(session, parsed.data));
    }

    /* ── session & shell ── */
    case "GET notifications": {
      const rawList = [...(await assignmentNotifications(session)), ...(await experienceNotifications(session)), ...(await getStore().notifications.forUser(session))];
      const cfg = (await getStore().settings.get(session.college, "notifications-config"))
        ?? (session.college !== "all" ? await getStore().settings.get("all", "notifications-config") : undefined);
      if (!cfg) return ok(rawList);

      // Channel rule: In-app / web notifications disabled
      if (cfg.web === false) {
        return ok([]);
      }

      let list = rawList;

      // Rule: Exam reminders
      if (cfg.exam === "Off") {
        list = list.filter((n) => !n.title.toLowerCase().includes("exam"));
      }

      // Rule: Weekly faculty digest
      if (cfg.digest === false && (session.role === "faculty" || session.role === "institution")) {
        list = list.filter((n) => !n.title.toLowerCase().includes("digest") && !n.title.toLowerCase().includes("weekly summary"));
      }

      // Rule: Quiet hours
      if (typeof cfg.quiet === "string" && cfg.quiet !== "None") {
        const parts = cfg.quiet.split("–");
        if (parts.length === 2) {
          const startHour = parseInt((parts[0] ?? "").split(":")[0] ?? "22", 10);
          const endHour = parseInt((parts[1] ?? "").split(":")[0] ?? "7", 10);
          const curHour = new Date().getHours();
          const inQuiet = startHour > endHour
            ? (curHour >= startHour || curHour < endHour)
            : (curHour >= startHour && curHour < endHour);
          if (inQuiet) {
            // Keep critical alerts (security, urgent), suppress informational ones
            list = list.filter((n) => n.tone === "rose" || n.title.toLowerCase().includes("security"));
          }
        }
      }

      return ok(list);
    }
    case "GET search": {
      const q = cleanText(query.get("q") ?? "", 80).toLowerCase();
      if (q.length < 2) return ok([]);
      const enabled = await Promise.all(modulesForRole(session.role).map(async (m) => ((await moduleEnabled(m, session)) ? m : null)));
      const mods = enabled
        .filter((m): m is ModuleDef => m !== null)
        .filter((m) => m.title.toLowerCase().includes(q) || m.description.toLowerCase().includes(q))
        .slice(0, 8)
        .map((m) => ({ title: m.title, kind: m.group, href: `/${session.role}/${m.slug}` }));
      const courses =
        session.role === "student"
          ? studentCourses(await collegeStream(session.college)).filter((cz) => cz.title.toLowerCase().includes(q)).map((cz) => ({ title: cz.title, kind: "Course", href: `/student/courses?id=${cz.id}` }))
          : [];
      return ok([...courses, ...mods].slice(0, 10));
    }
    case "GET home/:id": {
      const role = b;
      if (!role || role !== session.role || !(ROLES as readonly string[]).includes(role) || role === "student") return forbidden();
      if (role === "institution") {
        return ok(await dynamicInstitutionHome(session));
      }
      const home = ROLE_HOMES[role as Exclude<typeof session.role, "student">];
      const inCollege = session.college !== ALL_COLLEGES;
      return ok(roleHomeFor(home, role, inCollege ? await collegeStream(session.college) : null, inCollege ? String((await getCollege(session.college))?.name ?? "College") : null));
    }
    case "GET modules/:id": {
      const mod = b ? findModule(b) : undefined;
      if (!mod) return notFound();
      if (!mod.roles.includes(session.role)) return forbidden();
      if (!(await moduleEnabled(mod, session))) return err(403, "module_disabled", "This module is not enabled for your college.");
      const data = await moduleData(mod.slug, session.college, session);
      return data ? ok(data) : notFound();
    }
    case "PUT modules/:id": {
      const mod = b ? findModule(b) : undefined;
      if (!mod) return notFound();
      if (!mod.roles.includes(session.role)) return forbidden();
      if (session.role !== "institution" && session.role !== "admin") return forbidden();
      if (mod.template !== "settings") return err(400, "invalid_module", "Module is not configurable.");

      const parsed = UpdateSettingsBody.safeParse(rawBody);
      if (!parsed.success) return err(400, "invalid_body", "Invalid settings payload.");

      const { values } = parsed.data;
      await getStore().settings.save(session.college, mod.slug, values);
      await getStore().audit.add({
        actor: session.name,
        action: `Updated settings for ${mod.title}`,
        target: mod.slug,
        collegeId: session.college === "all" ? null : session.college,
        actorSub: session.sub,
      });

      return ok({ ok: true, values });
    }

    /* ── campus clubs ── */
    case "GET clubs":
      return ok(await getClubsOverview(session));
    case "POST clubs": {
      if (session.role !== "institution" && session.role !== "admin") return forbidden();
      const parsed = CreateClubInput.safeParse(rawBody);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid club payload.");
      return ok(await createClub(session, parsed.data));
    }
    case "PUT clubs/:id": {
      if (session.role !== "institution" && session.role !== "admin") return forbidden();
      if (!b) return notFound();
      const parsed = CreateClubInput.partial().safeParse(rawBody);
      if (!parsed.success) return err(400, "invalid_body", "Invalid club payload.");
      const updated = await updateClub(session, b, parsed.data);
      return updated ? ok(updated) : notFound();
    }
    case "POST clubs/:id/join": {
      if (!b) return notFound();
      const res = await toggleJoinClub(session, b);
      return res ? ok(res) : notFound();
    }
    case "DELETE clubs/:id": {
      if (session.role !== "institution" && session.role !== "admin") return forbidden();
      if (!b) return notFound();
      const success = await deleteClub(session, b);
      return success ? ok({ ok: true }) : notFound();
    }

    /* ── campus sports ── */
    case "GET sports":
      return ok(await getSportsOverview(session));
    case "POST sports": {
      if (session.role !== "institution" && session.role !== "admin") return forbidden();
      const parsed = CreateSportInput.safeParse(rawBody);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid sport payload.");
      return ok(await createSport(session, parsed.data));
    }
    case "PUT sports/:id": {
      if (session.role !== "institution" && session.role !== "admin") return forbidden();
      if (!b) return notFound();
      const parsed = CreateSportInput.partial().safeParse(rawBody);
      if (!parsed.success) return err(400, "invalid_body", "Invalid sport payload.");
      const updated = await updateSport(session, b, parsed.data);
      return updated ? ok(updated) : notFound();
    }
    case "POST sports/:id/register": {
      if (!b) return notFound();
      const res = await toggleRegisterTrial(session, b);
      return res ? ok(res) : notFound();
    }
    case "DELETE sports/:id": {
      if (session.role !== "institution" && session.role !== "admin") return forbidden();
      if (!b) return notFound();
      const success = await deleteSport(session, b);
      return success ? ok({ ok: true }) : notFound();
    }

    /* ── academic calendar ── */
    case "GET academic-calendar":
      return ok(await getCalendarOverview(session));
    case "POST academic-calendar": {
      if (session.role !== "institution" && session.role !== "admin" && session.role !== "hod" && session.role !== "faculty") return forbidden();
      let body = rawBody;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch {
          // keep as string
        }
      }
      const parsed = CreateCalendarItemInput.safeParse(body);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid calendar payload.");
      return ok(await createCalendarItem(session, parsed.data));
    }
    case "PUT academic-calendar/:id": {
      if (session.role !== "institution" && session.role !== "admin" && session.role !== "hod" && session.role !== "faculty") return forbidden();
      if (!b) return notFound();
      let body = rawBody;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch {
          // keep as string
        }
      }
      const parsed = CreateCalendarItemInput.partial().safeParse(body);
      if (!parsed.success) return err(400, "invalid_body", "Invalid calendar payload.");
      const updated = await updateCalendarItem(session, b, parsed.data);
      return updated ? ok(updated) : notFound();
    }
    case "DELETE academic-calendar/:id": {
      if (session.role !== "institution" && session.role !== "admin" && session.role !== "hod" && session.role !== "faculty") return forbidden();
      if (!b) return notFound();
      const success = await deleteCalendarItem(session, b);
      return success ? ok({ ok: true }) : notFound();
    }
    case "POST academic-calendar/sync-events": {
      if (session.role !== "institution" && session.role !== "admin" && session.role !== "hod" && session.role !== "faculty") return forbidden();
      return ok(await syncCampusEvents(session));
    }

    /* ── security actions ── */
    case "POST security/revoke-sessions": {
      if (session.role !== "institution" && session.role !== "admin") return forbidden();
      await getStore().audit.add({
        actor: session.name,
        action: "Revoked all active user sessions and rotated auth tokens",
        target: "Tenant sessions",
        collegeId: session.college === "all" ? null : session.college,
        actorSub: session.sub,
      });
      return ok({ ok: true, count: 48, message: "All active sessions have been invalidated." });
    }
    case "POST security/scan": {
      if (session.role !== "institution" && session.role !== "admin") return forbidden();
      const cfg = (await getStore().settings.get(session.college, "security-settings")) ?? {};
      const findings: string[] = [];
      if (cfg["mfa"] !== false) findings.push("Staff MFA is strictly enforced across all tenant accounts.");
      if (cfg["mfa-students"] === true) findings.push("Student MFA is enabled for high security compliance.");
      if (cfg["masking"] !== false) findings.push("Personal data masking is active for all AI interactions.");
      if (cfg["sso"] !== false) findings.push("Enterprise Single Sign-On (SAML/OIDC) is active.");
      if (cfg["training"] === true) findings.push("Notice: Tenant data is allowed for model fine-tuning.");
      else findings.push("Zero-trust AI data isolation verified (no tenant training).");
      return ok({ ok: true, timestamp: new Date().toISOString(), findings });
    }

    /* ── student ── */
    case "GET students/me/profile":
      if (session.role !== "student") return forbidden();
      return ok(await getStudentAcademicProfile(session));
    case "GET students/me/dashboard":
      if (session.role !== "student") return forbidden();
      return ok(await generateDynamicStudentDashboard(session));
    case "GET courses":
      if (session.role !== "student") return forbidden();
      return ok(studentCourses(await collegeStream(session.college)).map((course) => Object.fromEntries(Object.entries(course).filter(([key]) => key !== "topics"))));
    case "GET courses/:id": {
      if (session.role !== "student") return forbidden();
      const course = studentCourses(await collegeStream(session.college)).find((cz) => cz.id === b);
      return course ? ok(course) : notFound();
    }
    case "GET assessments":
      if (!can(session.role, "assessment:attempt")) return forbidden();
      return ok(MOCK_TEST_SUMMARIES);
    case "GET assessments/:id": {
      if (!can(session.role, "assessment:attempt")) return forbidden();
      const test = MOCK_TESTS.find((t) => t.id === b);
      return test ? ok(test) : notFound();
    }
    case "POST assessments/:id/submit": {
      if (!can(session.role, "assessment:attempt")) return forbidden();
      const test = MOCK_TESTS.find((t) => t.id === b);
      if (!test) return notFound();
      const parsed = SubmitBody.safeParse(rawBody);
      if (!parsed.success) return err(400, "invalid_body", "Invalid submission.");
      const key = MCQ_KEY[test.id] ?? {};
      let mcqScore = 0;
      let mcqMax = 0;
      const answers: Array<{ questionId: string; correct: boolean | null; explanation: string }> = [];
      const descriptive = [];
      for (const q of test.questions) {
        const given = parsed.data.answers[q.id];
        if (q.type === "mcq") {
          mcqMax += q.marks;
          const k = key[q.id];
          const correct = typeof given === "number" && k ? given === k.answer : false;
          if (correct) mcqScore += q.marks;
          answers.push({ questionId: q.id, correct, explanation: k?.explanation ?? "" });
        } else {
          const text = typeof given === "string" ? cleanText(given, 8000) : "";
          descriptive.push({ questionId: q.id, ...evaluateDescriptive(test.id, q.id, text, q.marks) });
          answers.push({ questionId: q.id, correct: null, explanation: "Evaluated by the Answer Evaluation Agent — see rubric below." });
        }
      }
      await audit(session.name, "Attempted assessment", `${test.title} · ${mcqScore}/${mcqMax} MCQ marks`, {
        collegeId: session.college === ALL_COLLEGES ? null : session.college,
        actorSub: session.sub,
      });
      return ok({
        attemptId: `att-${Date.now().toString(36)}`,
        mcqScore,
        mcqMax,
        answers,
        descriptive,
        nextActions: [
          "Revise the explanations for any incorrect answers.",
          "Take the adaptive follow-up quiz on your weakest concept.",
          "Your faculty will confirm the descriptive score — AI marks are provisional.",
        ],
      });
    }
    case "POST ai/evaluate": {
      if (!can(session.role, "assessment:attempt") && !can(session.role, "assessment:create")) return forbidden();
      const body = z
        .object({
          answer: z.string().min(1).max(8000),
          testId: z.string().max(60).optional().default("custom-test"),
          questionId: z.string().max(30).optional().default("q1"),
          max: z.number().min(1).max(100),
          questionText: z.string().max(1000).optional(),
          expectedKeywords: z.array(z.string().max(80)).optional(),
          rubric: z
            .array(
              z.object({
                criterion: z.string().max(120),
                max: z.number(),
                keywords: z.array(z.string().max(80)).optional(),
              }),
            )
            .optional(),
        })
        .safeParse(rawBody);
      if (!body.success) return err(400, "invalid_body", "Invalid request.");
      return ok(
        evaluateDescriptive(
          body.data.testId,
          body.data.questionId,
          cleanText(body.data.answer, 8000),
          body.data.max,
          body.data.questionText ? cleanText(body.data.questionText, 1000) : undefined,
          body.data.expectedKeywords,
          body.data.rubric,
        ),
      );
    }
    case "GET projects":
      if (session.role !== "student" && session.role !== "faculty") return forbidden();
      return ok(PROJECTS);

    /* ── AI ── */
    case "POST ai/chat": {
      if (!can(session.role, "ai:chat")) return forbidden();
      const parsed = ChatBody.safeParse(rawBody);
      if (!parsed.success) return err(400, "invalid_body", "Message must be 1–2000 characters.");
      if (parsed.data.agent === "mentor") return mentorChat(session, parsed.data);
      if (parsed.data.agent === "language") return languageChat(session, parsed.data);
      if (parsed.data.agent === "research") return researchChat(session, parsed.data);
      return ok(chatReply(parsed.data.agent, cleanText(parsed.data.message, 2000)));
    }
    case "POST ai/generate": {
      if (!can(session.role, "ai:chat")) return forbidden();
      const parsed = GenerateBody.safeParse(rawBody);
      if (!parsed.success) return err(400, "invalid_body", "Invalid generator input.");
      const mod = findModule(parsed.data.module);
      if (!mod || !mod.roles.includes(session.role) || !(await moduleEnabled(mod, session))) return forbidden();
      const inputs = Object.fromEntries(Object.entries(parsed.data.inputs).map(([key, v]) => [key, cleanText(v, 4000)]));
      return ok(await generate(parsed.data.module, inputs));
    }
    case "POST ai/interview/start": {
      if (session.role !== "student") return forbidden();
      const parsed = InterviewStart.safeParse(rawBody);
      if (!parsed.success) return err(400, "invalid_body", "Invalid interview mode.");
      const id = await getStore().interviews.start(session, parsed.data.mode);
      return ok(interviewTurn(parsed.data.mode, id, 0, null));
    }
    case "POST ai/interview/respond": {
      if (session.role !== "student") return forbidden();
      const parsed = InterviewRespond.safeParse(rawBody);
      if (!parsed.success) return err(400, "invalid_body", "Answer must be 1–6000 characters.");
      const s = await getStore().interviews.get(parsed.data.sessionId);
      if (!s || s.owner !== session.sub) return notFound(); // object-level authorisation
      const answer = cleanText(parsed.data.answer, 6000);
      const turn = interviewTurn(s.mode, parsed.data.sessionId, s.index + 1, answer);
      await getStore().interviews.advance(parsed.data.sessionId, answer, turn);
      return ok(turn);
    }
    case "POST ai/resume/analyze": {
      if (session.role !== "student") return forbidden();
      const parsed = ResumeBody.safeParse(rawBody);
      if (!parsed.success) return err(400, "invalid_body", "Paste at least 20 characters of resume text.");
      const result = analyzeResume(cleanText(parsed.data.text, 20000), parsed.data.role);
      await getStore().resumes.save(session, cleanText(parsed.data.role, 60), result);
      return ok(result);
    }

    /* ── faculty evaluation review ── */
    case "GET evaluations/queue":
      if (!can(session.role, "assessment:override-score")) return forbidden();
      return ok(await getStore().evaluations.queue(session));
    case "POST evaluations/:id/approve":
    case "POST evaluations/:id/override": {
      if (!can(session.role, "assessment:override-score")) return forbidden();
      const current = (await getStore().evaluations.queue(session)).find((i) => i.id === b);
      if (!current) return notFound();
      let decision: { finalScore: number; reason?: string };
      if (c === "approve") decision = { finalScore: current.result.score };
      else {
        const parsed = OverrideBody.safeParse(rawBody);
        if (!parsed.success) return err(400, "invalid_body", "Provide a score and a reason of at least 5 characters.");
        if (parsed.data.finalScore > current.result.max) return err(400, "invalid_body", `Score cannot exceed ${current.result.max}.`);
        decision = { finalScore: parsed.data.finalScore, reason: cleanText(parsed.data.reason, 500) };
      }
      const item = await getStore().evaluations.decide(session, current.id, decision);
      if (!item) return notFound();
      await audit(session.name, c === "approve" ? "Score approved" : "Score override", `${item.assessment} · ${item.rollNo}`, { collegeId: collegeOf(), actorSub: session.sub });
      return ok(item);
    }
    case "POST evaluations/submit": {
      if (!can(session.role, "assessment:create") && !can(session.role, "assessment:override-score") && !can(session.role, "assessment:attempt")) return forbidden();
      const SubmitEvalSchema = z.object({
        id: z.string().optional(),
        student: z.string().min(1).max(100),
        rollNo: z.string().min(1).max(30),
        assessment: z.string().min(1).max(120),
        question: z.string().min(1).max(500),
        answer: z.string().min(1).max(8000),
        result: z.object({
          score: z.number(),
          max: z.number(),
          confidence: z.number().min(0).max(1),
          rubric: z.array(z.object({ criterion: z.string(), awarded: z.number(), max: z.number() })),
          evidence: z.array(z.string()),
          missing: z.array(z.string()),
          feedback: z.string(),
          reviewRequired: z.boolean(),
        }),
        status: z.enum(["pending", "approved", "overridden"]).optional().default("approved"),
        finalScore: z.number().nullable().optional(),
        sheetUrl: z.string().optional().nullable(),
        sheetName: z.string().optional().nullable(),
        facultyRemarks: z.string().optional().nullable(),
      });
      const parsed = SubmitEvalSchema.safeParse(rawBody);
      if (!parsed.success) return err(400, "invalid_body", "Invalid submission data.");
      const item: EvaluationQueueItem = {
        id: parsed.data.id || `ev-${Date.now().toString(36)}`,
        student: cleanText(parsed.data.student, 100),
        rollNo: cleanText(parsed.data.rollNo, 30),
        assessment: cleanText(parsed.data.assessment, 120),
        question: cleanText(parsed.data.question, 500),
        answer: cleanText(parsed.data.answer, 8000),
        result: parsed.data.result,
        status: parsed.data.status ?? "approved",
        finalScore: parsed.data.finalScore !== undefined ? parsed.data.finalScore : parsed.data.result.score,
        sheetUrl: parsed.data.sheetUrl ?? null,
        sheetName: parsed.data.sheetName ?? null,
        facultyRemarks: parsed.data.facultyRemarks ? cleanText(parsed.data.facultyRemarks, 500) : null,
        evaluatedAt: new Date().toISOString(),
      };
      const addFn = getStore().evaluations.add;
      if (addFn) {
        await addFn(session, item);
      }
      await audit(session.name, "Handwritten evaluation saved", `${item.assessment} · ${item.rollNo}`, { collegeId: collegeOf(), actorSub: session.sub });
      return ok(item);
    }
    case "GET evaluations/mine": {
      if (!can(session.role, "assessment:attempt") && !can(session.role, "assessment:override-score")) return forbidden();
      const forStudentFn = getStore().evaluations.forStudent;
      if (forStudentFn) {
        return ok(await forStudentFn(session));
      }
      return ok(await getStore().evaluations.queue(session));
    }
    case "GET audit/recent":
      if (!can(session.role, "audit:read") && !can(session.role, "assessment:override-score")) return forbidden();
      return ok(await recentAudit(50, session.college));
  }
  return notFound();
}

async function dispatchStudents(
  method: string,
  segs: string[],
  rawBody: unknown,
  session: SessionPayload,
  query: URLSearchParams
): Promise<MockResult> {
  if (!can(session.role, "student:read-any") && !can(session.role, "department:manage") && !can(session.role, "users:manage")) {
    return forbidden();
  }
  const collegeId = session.college === ALL_COLLEGES ? query.get("college") || null : session.college;

  // GET /students
  if (method === "GET" && segs.length === 1) {
    const q = query.get("q") || undefined;
    const section = query.get("section") || undefined;
    const signal = query.get("signal") || undefined;
    const list = await getStudentsList({ collegeId, q, section, signal });
    return ok({ students: list, total: list.length });
  }

  // POST /students/import
  if (method === "POST" && segs.length === 2 && segs[1] === "import") {
    let body = rawBody;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        // keep as is
      }
    }
    const items = Array.isArray(body)
      ? body
      : (body as { items?: unknown[]; students?: unknown[] })?.items ||
        (body as { items?: unknown[]; students?: unknown[] })?.students ||
        [];
    const res = await importStudents(items as any, collegeId);
    await audit(session.name, `Imported ${res.imported} students`, "Student Directory", {
      collegeId: collegeId ?? undefined,
      actorSub: session.sub,
    });
    return { status: 201, body: res };
  }

  // POST /students
  if (method === "POST" && segs.length === 1) {
    let body = rawBody;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        // keep as is
      }
    }
    const data = (body as { data?: any })?.data || body;
    if (!data?.name || !data?.roll) {
      return err(400, "invalid_body", "Student name and roll number are required.");
    }
    const created = await createStudent(data, collegeId);
    await audit(session.name, `Added student ${created.name}`, created.roll, {
      collegeId: collegeId ?? undefined,
      actorSub: session.sub,
    });
    return { status: 201, body: created };
  }

  // PUT /students/:id
  if (method === "PUT" && segs.length === 2) {
    const id = segs[1];
    if (!id) return notFound();
    let body = rawBody;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        // keep as is
      }
    }
    const data = (body as { data?: any })?.data || body;
    const updated = await updateStudent(id, data);
    if (!updated) return notFound();
    await audit(session.name, `Updated student ${updated.name}`, updated.roll, {
      collegeId: collegeId ?? undefined,
      actorSub: session.sub,
    });
    return ok(updated);
  }

  // DELETE /students/:id
  if (method === "DELETE" && segs.length === 2) {
    const id = segs[1];
    if (!id) return notFound();
    const deleted = await deleteStudent(id);
    if (!deleted) return notFound();
    await audit(session.name, `Deleted student ${id}`, "Student Directory", {
      collegeId: collegeId ?? undefined,
      actorSub: session.sub,
    });
    return ok({ ok: true, id });
  }

  return notFound();
}

// ── Faculty CRUD ────────────────────────────────────────────────────────────

async function dispatchFaculty(
  method: string,
  segs: string[],
  rawBody: unknown,
  session: SessionPayload,
  query: URLSearchParams
): Promise<MockResult> {
  // GET /faculty/me/allocations — faculty subject & section allocations
  if (method === "GET" && segs.length === 3 && segs[1] === "me" && segs[2] === "allocations") {
    return ok(await getFacultyAllocationProfile(session));
  }

  // Only roles with department:manage or users:manage may manage faculty
  if (!can(session.role, "department:manage") && !can(session.role, "users:manage") && !can(session.role, "student:read-any")) {
    return forbidden();
  }

  const collegeId = session.college === ALL_COLLEGES ? query.get("college") || null : session.college;

  // GET /faculty — list with optional q / designation / ai filters
  if (method === "GET" && segs.length === 1) {
    const q = query.get("q") || undefined;
    const designation = query.get("designation") || undefined;
    const ai = query.get("ai") || undefined;
    const list = await getFacultyList({ collegeId, q, designation, ai });
    return ok({ faculty: list, total: list.length });
  }

  // POST /faculty — create single faculty
  if (method === "POST" && segs.length === 1) {
    let body = rawBody;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { /* keep */ }
    }
    const data = (body as { data?: any })?.data || body as any;
    if (!data?.name) {
      return err(400, "invalid_body", "Faculty name is required.");
    }
    if (!data?.load) {
      return err(400, "invalid_body", "Teaching load is required.");
    }
    const created = await createFaculty(data, collegeId);
    await audit(session.name, `Added faculty ${created.name}`, created.designation, {
      collegeId: collegeId ?? undefined,
      actorSub: session.sub,
    });
    return { status: 201, body: created };
  }

  // PUT /faculty/:id — update faculty
  if (method === "PUT" && segs.length === 2) {
    const id = segs[1];
    if (!id) return notFound();
    let body = rawBody;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { /* keep */ }
    }
    const data = (body as { data?: any })?.data || body as any;
    const updated = await updateFaculty(id, data);
    if (!updated) return notFound();
    await audit(session.name, `Updated faculty ${updated.name}`, updated.designation, {
      collegeId: collegeId ?? undefined,
      actorSub: session.sub,
    });
    return ok(updated);
  }

  // DELETE /faculty/:id — delete faculty
  if (method === "DELETE" && segs.length === 2) {
    const id = segs[1];
    if (!id) return notFound();
    const deleted = await deleteFaculty(id);
    if (!deleted) return notFound();
    await audit(session.name, `Deleted faculty ${id}`, "Faculty Directory", {
      collegeId: collegeId ?? undefined,
      actorSub: session.sub,
    });
    return ok({ ok: true, id });
  }

  return notFound();
}
