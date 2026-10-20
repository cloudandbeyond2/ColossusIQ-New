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
import { formatNumber } from "@/lib/utils";
import { analyzeResume, chatReply, evaluateDescriptive, generate, interviewTurn } from "./ai";
import { geminiImageOcr } from "@/lib/ai/gemini";
import { MCQ_KEY, MOCK_TESTS, MOCK_TEST_SUMMARIES, PROJECTS, addLiveNotification } from "./fixtures";
import { getDeliveryLogs, recordDeliveryLog } from "./notifications-engine";
import { ROLE_HOMES } from "./homes";
import { roleHomeFor, studentCourses, studentDashboard } from "./stream-content";
import { dynamicInstitutionHome } from "./institution-home";
import { placementHome, placementSnapshot } from "./placement-stats";
import { dynamicBiAnalytics } from "./bi-analytics";
import { moduleData } from "./module-data";
import { createClub, deleteClub, getClubsOverview, toggleJoinClub, updateClub } from "./clubs";
import { createSport, deleteSport, getSportsOverview, toggleRegisterTrial, updateSport } from "./sports";
import { getHackathonsOverview, listHackathonTeams, registerHackathonTeam } from "./hackathons";
import { RegisterHackathonTeamInput } from "@/lib/api/hackathon-schemas";
import { createProject, deleteProject, listProjects, reviewProject, updateProjectStage } from "./projects";
import { CreateProjectInput, FacultyReviewInput, UpdateProjectStageInput } from "@/lib/api/project-schemas";
import { applyToTeamRequest, createTeamRequest, getTeamFinderOverview, inviteStudentToProject } from "./team-finder";
import { AddTeammateInput, CreateTeamRequestInput } from "@/lib/api/team-finder-schemas";
import {
  createPipelineVenture,
  deletePipelineVenture,
  getIncubationPipelineOverview,
  reviewPipelineVenture,
  updatePipelineVentureStage,
} from "./incubation-store";
import {
  CreateVentureInput,
  ReviewVentureInput,
  UpdateVentureStageInput,
} from "@/lib/api/incubation-schemas";
import {
  assignMentorToVenture,
  deleteMentor,
  getMentorNetworkOverview,
  inviteMentor,
  logMentorshipSession,
  unassignMentorFromVenture,
  updateMentor,
} from "./mentor-network-store";
import {
  AssignMentorInput,
  InviteMentorInput,
  LogSessionInput,
} from "@/lib/api/mentor-network-schemas";
import {
  createStartup,
  deleteStartup,
  getStartupPortfolioOverview,
  updateStartup,
} from "./startup-store";
import {
  CreateStartupInput,
  UpdateStartupInput,
} from "@/lib/api/startup-schemas";
import {
  getFundingReadinessOverview,
  updateVentureReadiness,
} from "./funding-readiness-store";
import {
  UpdateReadinessInput,
} from "@/lib/api/funding-readiness-schemas";
import {
  cancelInterview,
  createShortlist,
  deleteShortlist,
  getInterviewsOverview,
  getShortlistsOverview,
  scheduleInterview,
  searchCandidates,
  updateInterviewFeedback,
  updateShortlistStage,
} from "./recruiter-store";
import {
  CreateShortlistInput,
  ScheduleInterviewInput,
  SubmitInterviewFeedbackInput,
  UpdateShortlistStageInput,
} from "@/lib/api/recruiter-schemas";
import {
  getPlacementAnalyticsOverview,
  updatePlacementTargets,
} from "./placement-analytics-store";
import { UpdatePlacementTargetsInput } from "@/lib/api/placement-analytics-schemas";
import { CalendarError, calendarNotifications, createCalendarItem, deleteCalendarItem, getCalendarOverview, syncCampusEvents, updateCalendarItem } from "./academic-calendar";
import {
  CreateAicteActionInput,
  CreateCalendarItemInput,
  CreateClubInput,
  CreateInterventionInput,
  CreateSportInput,
  CreateSupportActionInput,
  EvaluationQueueItem,
  UpdateAicteActionStatusInput,
  UpdateAicteCommitteeInput,
  UpdateAicteProfileInput,
  UpdateReviewStatusInput,
  CreateReportInputSchema,
  Notification,
} from "@/lib/api/schemas";
import {
  createReport,
  deleteReport,
  getReportsOverview,
  toggleScheduledReport,
} from "./reports";
import { createIntervention, getDepartmentSkillsOverview } from "./department-skills";
import { createSupportAction, getEarlyWarningOverview, updateReviewStatus } from "./early-warning";
import {
  canManageAicte,
  createAicteAction,
  deleteAicteAction,
  getAicteComplianceOverview,
  updateAicteActionStatus,
  updateAicteCommittee,
  updateAicteProfile,
} from "./aicte-compliance";
import { getHospitalOverview, updateHospitalCensus, certifyClinicalRotation } from "./teaching-hospital";
import { UpdateHospitalCensusInput, CertifyRotationInput } from "@/lib/api/hospital-schemas";
import {
  getNmcComplianceOverview,
  createNmcAction,
  updateNmcActionStatus,
  deleteNmcAction,
  updateNmcCommittee,
  updateNmcProfile,
} from "./nmc-compliance";
import {
  CreateNmcActionInput,
  UpdateNmcActionStatusInput,
  UpdateNmcCommitteeInput,
  UpdateNmcProfileInput,
} from "@/lib/api/nmc-schemas";
import {
  getCbcsOverview,
  createCbcsCourse,
  updateCbcsSeats,
  enrollStudentElective,
  dropStudentElective,
  updateCbcsWindow,
} from "./cbcs-electives";
import {
  CreateCbcsCourseInput,
  UpdateCbcsSeatsInput,
  EnrollStudentElectiveInput,
  UpdateCbcsWindowInput,
} from "@/lib/api/cbcs-schemas";
import {
  getOsceOverview,
  createOsceStation,
  createOsceSession,
  createSkillsLabBooking,
  updateBookingStatus,
  gradeStudentOsce,
  toggleStationStatus,
} from "./osce-store";
import {
  CreateOsceStationInput,
  CreateOsceSessionInput,
  CreateSkillsLabBookingInput,
  UpdateBookingStatusInput,
  GradeStudentOsceInput,
} from "@/lib/api/osce-schemas";
import { dispatchRecords } from "./records-router";
import { dispatchLearning } from "./learning";
import { dispatchCourses } from "./course-builder";
import { dispatchTeaching } from "./teaching";
import { assignmentNotifications, dispatchAssignments } from "./assignments";
import { dispatchKnowledge } from "./knowledge-base";
import { dispatchPolicy } from "./policy-assistant";
import { dispatchQuestionAi } from "./question-ai";
import { dispatchMentor, mentorChat } from "./mentor";
import { dispatchStudyPlanner } from "./study-planner";
import { dispatchLanguages, languageChat } from "./languages";
import { dispatchMissionPlanner } from "./mission-planner";
import { dispatchResearch, researchChat } from "./research";
import { dispatchAchievements } from "./achievements";
import { dispatchRefreshZone } from "./refresh-zone";
import { dispatchExamPrep } from "./exam-prep";
import { dispatchCurrentAffairs } from "./current-affairs";
import { dispatchPrepContent } from "./prep-content";
import { dispatchAiProviders } from "./ai-providers";
import { dispatchCertificateDesk } from "./certificate-desk";
import { dispatchModuleControl } from "./module-control";
import { dispatchNotices, noticeNotifications } from "./notices";
import { dispatchContentDesk } from "./content-desk";
import { dispatchCurriculum } from "./curriculum";
import { dispatchCourseRoadmap } from "./course-roadmap";
import { dispatchIntegrations } from "./integrations";
import { dispatchBilling } from "./billing";
import { feeNotifications } from "@/lib/billing/reminders";
import { getAssessmentById, loadDynamicAssessments, submitAssessmentTest } from "./assessments";
import { platformHealth } from "./platform-pages";
import { API_AREAS, apiAreaOpen, disabledPairs, pairKey } from "@/lib/module-access";
import { dispatchExperience, experienceNotifications } from "./experience";
import { dispatchViva } from "./viva";
import { dispatchResume } from "./resume";
import { dispatchDrives } from "./drives";
import { dispatchRolesPermissions } from "./roles-permissions";
import { dispatchEmployers } from "./employers";
import { dispatchJobs } from "./jobs";
import { dispatchAlumni } from "./alumni";
import { dispatchInterview } from "./interview";
import { ChatBodySchema } from "@/lib/api/mentor-schemas";
import { dispatchNotifications } from "./notifications";
import { audit, recentAudit } from "./audit";
import { createStudent, deleteStudent, getStudentsList, importStudents, updateStudent } from "./students-store";
import { createFaculty, deleteFaculty, getFacultyList, updateFaculty } from "./faculty-store";
import { generateDynamicStudentDashboard, getStudentAcademicProfile } from "./student-profile";
import {
  getFacultyAllocationProfile,
  getSectionRoster,
  getAttendanceHistory,
  saveAttendanceSession,
  scheduleExtraClass,
} from "./faculty-allocation";
import {
  getClassAnalyticsData,
  createRemedialIntervention,
  updateRemedialStatus,
  generateAiRemedialWorksheet,
} from "./class-analytics-engine";
import {
  listQuestionPapers,
  createQuestionPaper,
  updateQuestionPaper,
  deleteQuestionPaper,
} from "./question-papers";

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
  if ((await disabledPairs()).has(pairKey(mod.slug, session.role))) return false;
  const stream = session.college === ALL_COLLEGES ? null : await collegeStream(session.college);
  if (mod.streams && stream && !mod.streams.includes(stream)) return false;
  if (!(TOGGLEABLE_GROUPS as readonly string[]).includes(mod.group)) return true;
  const groups = await enabledGroups(session.college);
  return groups === "all" || groups.includes(mod.group);
}

export async function universityOverview() {
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

export const PATTERNS = [
  "GET university/overview",
  "GET colleges/options",
  "GET staff/faculty-options",
  "GET students/student-options",
  "GET analytics/bi",
  "GET department-skills",
  "POST department-skills/interventions",
  "GET early-warning",
  "POST early-warning/interventions",
  "PATCH early-warning/reviews/:id",
  "GET aicte-compliance",
  "POST aicte-compliance/actions",
  "PATCH aicte-compliance/actions/:id",
  "DELETE aicte-compliance/actions/:id",
  "PATCH aicte-compliance/committees/:id",
  "PUT aicte-compliance/profile",
  "GET hospital/overview",
  "POST hospital/census",
  "POST hospital/rotations/:id/certify",
  "GET nmc-compliance",
  "POST nmc-compliance/actions",
  "PATCH nmc-compliance/actions/:id",
  "DELETE nmc-compliance/actions/:id",
  "PATCH nmc-compliance/committees/:id",
  "PUT nmc-compliance/profile",
  "GET cbcs-electives",
  "POST cbcs-electives/courses",
  "PATCH cbcs-electives/courses/:id/seats",
  "POST cbcs-electives/enroll",
  "DELETE cbcs-electives/enrollments/:id",
  "PUT cbcs-electives/window",
  "GET osce",
  "POST osce/stations",
  "POST osce/stations/:id/toggle",
  "POST osce/sessions",
  "POST osce/bookings",
  "PATCH osce/bookings/:id/status",
  "POST osce/grade",
  "GET notifications",
  "POST notifications/test",
  "GET notifications/delivery-log",
  "POST notifications/:id/read",
  "POST notifications/read-all",
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
  "GET reports",
  "POST reports",
  "DELETE reports/:id",
  "POST reports/scheduled/:id/toggle",
  "GET hackathons",
  "POST hackathons/register",
  "POST hackathons/teams",
  "GET hackathons/teams",
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
  "POST ai/ocr",
  "POST evaluations/submit",
  "GET evaluations/mine",
  "GET projects",
  "POST projects",
  "PATCH projects/:id/stage",
  "POST projects/:id/review",
  "DELETE projects/:id",
  "GET team-finder",
  "POST team-finder/requests",
  "POST team-finder/invite",
  "POST team-finder/apply",
  "POST ai/chat",
  "POST ai/generate",
  "POST ai/interview/start",
  "POST ai/interview/respond",
  "POST ai/resume/analyze",
  "GET evaluations/queue",
  "POST evaluations/:id/approve",
  "POST evaluations/:id/override",
  "DELETE evaluations/:id",
  "GET audit/recent",
  "POST branding/dns-verify",
  "POST branding/test-email",
  "POST branding/reset",
  "GET incubation-pipeline",
  "POST incubation-pipeline/ventures",
  "PATCH incubation-pipeline/ventures/:id/stage",
  "POST incubation-pipeline/ventures/:id/review",
  "DELETE incubation-pipeline/ventures/:id",
  "GET incubation/mentors",
  "POST incubation/mentors",
  "PATCH incubation/mentors/:id",
  "POST incubation/mentors/:id/assign",
  "POST incubation/mentors/:id/unassign",
  "POST incubation/mentors/:id/session",
  "DELETE incubation/mentors/:id",
  "GET incubation/startups",
  "POST incubation/startups",
  "PATCH incubation/startups/:id",
  "DELETE incubation/startups/:id",
  "GET incubation/funding-readiness",
  "PATCH incubation/funding-readiness/:id",
  "GET recruiter/candidates",
  "GET recruiter/shortlists",
  "POST recruiter/shortlists",
  "PATCH recruiter/shortlists/:id",
  "DELETE recruiter/shortlists/:id",
  "GET recruiter/interviews",
  "POST recruiter/interviews",
  "PATCH recruiter/interviews/:id",
  "DELETE recruiter/interviews/:id",
  "GET placement-analytics",
  "PATCH placement-analytics/targets",
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
  // Module Control: an API area switched off (for every module it serves) for this role is closed.
  if (API_AREAS[segs[0] ?? ""] && !apiAreaOpen(segs[0]!, session.role, await disabledPairs())) return { status: 403, body: { error: { code: "module_disabled", message: "This module has been switched off for your role." } } };
  if (segs[0] === "module-control") return dispatchModuleControl(method, segs, rawBody, session);
  if (segs[0] === "notifications") return dispatchNotifications(method, segs, rawBody, session);
  if (segs[0] === "notice-board") return dispatchNotices(method, segs, rawBody, session);
  if (segs[0] === "content-desk") return dispatchContentDesk(method, segs, rawBody, session);
  if (segs[0] === "curriculum") return dispatchCurriculum(method, segs, rawBody, session);
  if (segs[0] === "course-roadmap") return dispatchCourseRoadmap(method, segs, rawBody, session);
  if (segs[0] === "integrations") return dispatchIntegrations(method, segs, rawBody, session);
  if (segs[0] === "fees" || segs[0] === "billing") return dispatchBilling(method, segs, rawBody, session, query);
  if (segs[0] === "platform-health") {
    if (session.role !== "admin") return { status: 403, body: { error: { code: "forbidden", message: "Only the University Super Admin can view platform health." } } };
    if (method !== "GET" || segs.length !== 1) return { status: 404, body: { error: { code: "not_found", message: "Not found." } } };
    return { status: 200, body: await platformHealth() };
  }
  if (segs[0] === "records") return dispatchRecords(method, segs, rawBody, session, query);
  if (segs[0] === "question-bank" && segs[1] === "generate") return dispatchQuestionAi(method, segs, rawBody, session);
  if (segs[0] === "questions" || segs[0] === "question-bank") return dispatchRecords(method, ["records", "questions", ...segs.slice(1)], rawBody, session, query);
  if (segs[0] === "learning-courses") return dispatchCourses(method, segs, rawBody, session, query);
  if (segs[0] === "teaching") return dispatchTeaching(method, segs, rawBody, session);
  if (segs[0] === "assignments") return dispatchAssignments(method, segs, rawBody, session);
  if (segs[0] === "knowledge") return dispatchKnowledge(method, segs, rawBody, session);
  if (segs[0] === "policy") return dispatchPolicy(method, segs, rawBody, session);
  if (segs[0] === "mentor") return dispatchMentor(method, segs, session);
  if (segs[0] === "study-planner") return dispatchStudyPlanner(method, segs, rawBody, session);
  if (segs[0] === "languages") return dispatchLanguages(method, segs, rawBody, session);
  if (segs[0] === "mission-planner") return dispatchMissionPlanner(method, segs, rawBody, session);
  if (segs[0] === "research") return dispatchResearch(method, segs, rawBody, session);
  if (segs[0] === "achievements") return dispatchAchievements(method, segs, session);
  if (segs[0] === "refresh-zone") return dispatchRefreshZone(method, segs, rawBody, session);
  if (segs[0] === "exam-prep") return dispatchExamPrep(method, segs, rawBody, session);
  if (segs[0] === "current-affairs") return dispatchCurrentAffairs(method, segs, rawBody, session);
  if (segs[0] === "prep-content") return dispatchPrepContent(method, segs, rawBody, session);
  if (segs[0] === "ai-providers") return dispatchAiProviders(method, segs, rawBody, session);
  if (segs[0] === "certificate-desk") return dispatchCertificateDesk(method, segs, rawBody, session);
  if (segs[0] === "experience") return dispatchExperience(method, segs, rawBody, session);
  if (segs[0] === "viva") return dispatchViva(method, segs, rawBody, session);
  if (segs[0] === "resume") return dispatchResume(method, segs, rawBody, session);
  if (segs[0] === "interview") return dispatchInterview(method, segs, rawBody, session);
  if (segs[0] === "roles-permissions") return dispatchRolesPermissions(method, segs, session);
  if (segs[0] === "drives") return dispatchDrives(method, segs, rawBody, session);
  if (segs[0] === "employers") return dispatchEmployers(method, segs, rawBody, session, query);
  if (segs[0] === "jobs") return dispatchJobs(method, segs, rawBody, session, query);
  if (segs[0] === "alumni") return dispatchAlumni(method, segs, rawBody, session, query);
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
      let faculty = list.items
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
        .filter((f) => f.name.length > 0);

      if (faculty.length === 0) {
        const fallbackFacultyList = await getFacultyList({ collegeId: targetCollege });
        faculty = fallbackFacultyList.map((f) => ({
          id: f.id,
          name: f.name,
          department: f.department,
          designation: f.designation,
        }));
      }

      if (faculty.length === 0) {
        faculty = [
          { id: "fac-1", name: "Dr. Meena Raghavan", department: "Computer Science", designation: "Associate Professor" },
          { id: "fac-2", name: "Dr. S. Venkatesh", department: "Computer Science", designation: "Professor & HOD" },
          { id: "fac-3", name: "Prof. R. Balaji", department: "Computer Science", designation: "Assistant Professor" },
          { id: "fac-4", name: "Dr. K. Anitha", department: "Computer Science", designation: "Professor" },
          { id: "fac-5", name: "Dr. Joseph Kumar", department: "Computer Science", designation: "Professor" },
        ];
      }

      const seenFaculty = new Set<string>();
      faculty = faculty
        .filter((f) => {
          const key = f.name.trim().toLowerCase();
          if (!key || seenFaculty.has(key)) return false;
          seenFaculty.add(key);
          return true;
        })
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
      if (session.role !== "institution" && session.role !== "admin") return forbidden();
      if (!canManageAicte(session)) return err(409, "choose_college", "Choose a college first; AICTE compliance is recorded per college.");
      const parsed = CreateAicteActionInput.safeParse(rawBody);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid action payload.");
      return ok(await createAicteAction(session, parsed.data));
    }
    case "PATCH aicte-compliance/actions/:id": {
      if (session.role !== "institution" && session.role !== "admin") return forbidden();
      if (!canManageAicte(session)) return err(409, "choose_college", "Choose a college first; AICTE compliance is recorded per college.");
      const actionId = found.id ?? segs[2] ?? "";
      const parsed = UpdateAicteActionStatusInput.safeParse({ ...(typeof rawBody === "object" && rawBody !== null ? rawBody : {}), actionId });
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid action status payload.");
      const res = await updateAicteActionStatus(session, parsed.data);
      return res.ok ? ok(res) : err(404, "not_found", "That action no longer exists.");
    }
    case "DELETE aicte-compliance/actions/:id": {
      if (session.role !== "institution" && session.role !== "admin") return forbidden();
      if (!canManageAicte(session)) return err(409, "choose_college", "Choose a college first; AICTE compliance is recorded per college.");
      const removed = await deleteAicteAction(session, found.id ?? segs[2] ?? "");
      return removed ? ok({ ok: true }) : err(404, "not_found", "That action no longer exists.");
    }
    case "PATCH aicte-compliance/committees/:id": {
      if (session.role !== "institution" && session.role !== "admin") return forbidden();
      if (!canManageAicte(session)) return err(409, "choose_college", "Choose a college first; AICTE compliance is recorded per college.");
      const parsed = UpdateAicteCommitteeInput.safeParse(rawBody);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid committee payload.");
      const saved = await updateAicteCommittee(session, found.id ?? segs[2] ?? "", parsed.data);
      return saved ? ok({ ok: true }) : err(404, "not_found", "Unknown committee.");
    }
    case "PUT aicte-compliance/profile": {
      if (session.role !== "institution" && session.role !== "admin") return forbidden();
      if (!canManageAicte(session)) return err(409, "choose_college", "Choose a college first; AICTE compliance is recorded per college.");
      const parsed = UpdateAicteProfileInput.safeParse(rawBody);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid AICTE id.");
      return ok(await updateAicteProfile(session, parsed.data));
    }
    case "GET hospital/overview": {
      return ok(await getHospitalOverview(session));
    }
    case "POST hospital/census": {
      if (session.role !== "institution" && session.role !== "hod" && session.role !== "admin") return forbidden();
      const parsed = UpdateHospitalCensusInput.safeParse(rawBody);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid hospital census payload.");
      return ok(await updateHospitalCensus(session, parsed.data));
    }
    case "POST hospital/rotations/:id/certify": {
      if (session.role !== "institution" && session.role !== "hod" && session.role !== "faculty" && session.role !== "admin") return forbidden();
      const rotationId = found.id ?? segs[2] ?? "";
      const parsed = CertifyRotationInput.safeParse({ ...(typeof rawBody === "object" && rawBody !== null ? rawBody : {}), rotationId });
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid rotation certification payload.");
      return ok(await certifyClinicalRotation(session, parsed.data));
    }
    case "GET nmc-compliance": {
      if (session.role !== "institution" && session.role !== "admin") return forbidden();
      return ok(await getNmcComplianceOverview(session));
    }
    case "POST nmc-compliance/actions": {
      if (session.role !== "institution" && session.role !== "admin") return forbidden();
      const parsed = CreateNmcActionInput.safeParse(rawBody);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid action payload.");
      return ok(await createNmcAction(session, parsed.data));
    }
    case "PATCH nmc-compliance/actions/:id": {
      if (session.role !== "institution" && session.role !== "admin") return forbidden();
      const parsed = UpdateNmcActionStatusInput.safeParse(rawBody);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid status payload.");
      return ok(await updateNmcActionStatus(session, found.id ?? segs[2] ?? "", parsed.data));
    }
    case "DELETE nmc-compliance/actions/:id": {
      if (session.role !== "institution" && session.role !== "admin") return forbidden();
      return ok(await deleteNmcAction(session, found.id ?? segs[2] ?? ""));
    }
    case "PATCH nmc-compliance/committees/:id": {
      if (session.role !== "institution" && session.role !== "admin") return forbidden();
      const parsed = UpdateNmcCommitteeInput.safeParse(rawBody);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid committee payload.");
      return ok(await updateNmcCommittee(session, found.id ?? segs[2] ?? "", parsed.data));
    }
    case "PUT nmc-compliance/profile": {
      if (session.role !== "institution" && session.role !== "admin") return forbidden();
      const parsed = UpdateNmcProfileInput.safeParse(rawBody);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid profile payload.");
      return ok(await updateNmcProfile(session, parsed.data));
    }
    case "GET cbcs-electives": {
      return ok(await getCbcsOverview(session));
    }
    case "POST cbcs-electives/courses": {
      if (session.role !== "institution" && session.role !== "hod" && session.role !== "admin") return forbidden();
      const parsed = CreateCbcsCourseInput.safeParse(rawBody);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid course payload.");
      return ok(await createCbcsCourse(session, parsed.data));
    }
    case "PATCH cbcs-electives/courses/:id/seats": {
      if (session.role !== "institution" && session.role !== "hod" && session.role !== "admin") return forbidden();
      const courseId = found.id ?? segs[2] ?? "";
      const parsed = UpdateCbcsSeatsInput.safeParse({ ...(typeof rawBody === "object" && rawBody !== null ? rawBody : {}), courseId });
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid seat capacity payload.");
      return ok(await updateCbcsSeats(session, parsed.data));
    }
    case "POST cbcs-electives/enroll": {
      const parsed = EnrollStudentElectiveInput.safeParse(rawBody);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid enrollment payload.");
      return ok(await enrollStudentElective(session, parsed.data));
    }
    case "DELETE cbcs-electives/enrollments/:id": {
      return ok(await dropStudentElective(session, found.id ?? segs[2] ?? ""));
    }
    case "PUT cbcs-electives/window": {
      if (session.role !== "institution" && session.role !== "admin") return forbidden();
      const parsed = UpdateCbcsWindowInput.safeParse(rawBody);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid window payload.");
      return ok(await updateCbcsWindow(session, parsed.data));
    }

    case "GET osce": {
      return ok(await getOsceOverview(session));
    }
    case "POST osce/stations": {
      if (session.role !== "hod" && session.role !== "faculty" && session.role !== "admin") return forbidden();
      const parsed = CreateOsceStationInput.safeParse(rawBody);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid station payload.");
      return ok(await createOsceStation(session, parsed.data));
    }
    case "POST osce/stations/:id/toggle": {
      if (session.role !== "hod" && session.role !== "faculty" && session.role !== "admin") return forbidden();
      return ok(await toggleStationStatus(session, found.id ?? segs[2] ?? ""));
    }
    case "POST osce/sessions": {
      if (session.role !== "hod" && session.role !== "faculty" && session.role !== "admin") return forbidden();
      const parsed = CreateOsceSessionInput.safeParse(rawBody);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid session payload.");
      return ok(await createOsceSession(session, parsed.data));
    }
    case "POST osce/bookings": {
      const parsed = CreateSkillsLabBookingInput.safeParse(rawBody);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid booking payload.");
      return ok(await createSkillsLabBooking(session, parsed.data));
    }
    case "PATCH osce/bookings/:id/status": {
      if (session.role !== "hod" && session.role !== "faculty" && session.role !== "admin") return forbidden();
      const parsed = UpdateBookingStatusInput.safeParse(rawBody);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid booking status payload.");
      return ok(await updateBookingStatus(session, found.id ?? segs[2] ?? "", parsed.data));
    }
    case "POST osce/grade": {
      if (session.role !== "hod" && session.role !== "faculty" && session.role !== "admin") return forbidden();
      const parsed = GradeStudentOsceInput.safeParse(rawBody);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid grading payload.");
      return ok(await gradeStudentOsce(session, parsed.data));
    }

    /* ── session & shell ── */
    case "GET notifications":
    case "POST notifications/:id/read":
    case "POST notifications/read-all":
    case "POST notifications/test":
    case "GET notifications/delivery-log":
      return dispatchNotifications(method, segs, rawBody, session);
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
      const inCollege = session.college !== ALL_COLLEGES;
      const staticHome = ROLE_HOMES[role as Exclude<typeof session.role, "student">];
      // Placement works from live readiness and drive data; the other roles still show their sample home.
      const home = role === "placement" && inCollege ? placementHome(staticHome, await placementSnapshot(session, session.college)) : staticHome;
      const res = { ...roleHomeFor(home, role, inCollege ? await collegeStream(session.college) : null, inCollege ? String((await getCollege(session.college))?.name ?? "College") : null) };
      if (res.kpis?.some((k) => k.label.toLowerCase() === "students")) {
        const collegePublicId = inCollege ? session.college : null;
        const studentsList = await getStudentsList({ collegeId: collegePublicId });
        const studentCount = studentsList.length;
        res.kpis = res.kpis.map((k) =>
          k.label.toLowerCase() === "students"
            ? { ...k, value: formatNumber(studentCount) }
            : k
        );
      }
      if (session.name) {
        const hour = new Date().getHours();
        const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
        if (role === "faculty") {
          res.greeting = `${greet}, ${session.name}`;
        } else if (role === "hod") {
          res.greeting = `${greet}, ${session.name} · Department Intelligence`;
        } else if (role === "placement") {
          res.greeting = `${greet}, ${session.name} · Training & Placement`;
        } else if (role === "incubation") {
          res.greeting = `${greet}, ${session.name} · Innovation & Incubation`;
        } else if (role === "recruiter") {
          res.greeting = `Welcome, ${session.name} — Talent Workspace`;
        } else if (role === "admin") {
          res.greeting = `${greet}, ${session.name} · Central University Operations`;
        }
      }
      return ok(res);
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
      if (session.role !== "institution" && session.role !== "admin") return forbidden();
      if (mod.template !== "settings" && mod.slug !== "branding" && mod.slug !== "security-settings" && mod.slug !== "notifications-config") return err(400, "invalid_module", "Module is not configurable.");

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

    /* ── branding & white-label ── */
    case "POST branding/dns-verify": {
      if (session.role !== "institution" && session.role !== "admin") return forbidden();
      const bObj = rawBody && typeof rawBody === "object" ? (rawBody as Record<string, unknown>) : {};
      const domain = String(bObj.domain || "portal.ait.edu.in");
      return ok({
        ok: true,
        domain,
        cname: "cname.colossusiq.ai",
        status: "verified",
        ssl: "Active (TLS 1.3 - Let's Encrypt auto-provisioned)",
        latency: "24ms",
        edgeNode: "BOM-1 (Mumbai Edge)",
        verifiedAt: new Date().toISOString(),
      });
    }
    case "POST branding/test-email": {
      if (session.role !== "institution" && session.role !== "admin") return forbidden();
      const bObj = rawBody && typeof rawBody === "object" ? (rawBody as Record<string, unknown>) : {};
      const targetEmail = String(bObj.to || session.name);
      await getStore().audit.add({
        actor: session.name,
        action: `Sent white-label test email preview`,
        target: targetEmail,
        collegeId: session.college === "all" ? null : session.college,
        actorSub: session.sub,
      });
      return ok({
        ok: true,
        recipient: targetEmail,
        subject: "Verification & Branded Portal Preview",
        deliveredAt: new Date().toISOString(),
      });
    }
    case "POST branding/reset": {
      if (session.role !== "institution" && session.role !== "admin") return forbidden();
      await getStore().settings.save(session.college, "branding", {});
      await getStore().audit.add({
        actor: session.name,
        action: `Reset branding to default`,
        target: "branding",
        collegeId: session.college === "all" ? null : session.college,
        actorSub: session.sub,
      });
      return ok({ ok: true });
    }

    /* ── campus clubs ── */
    case "GET clubs":
      return ok(await getClubsOverview(session));
    case "POST clubs": {
      if (session.role === "recruiter") return forbidden();
      const parsed = CreateClubInput.safeParse(rawBody);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid club payload.");
      return ok(await createClub(session, parsed.data));
    }
    case "PUT clubs/:id": {
      if (session.role === "recruiter") return forbidden();
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

    /* ── institutional reports ── */
    case "GET reports":
      return ok(await getReportsOverview(session));
    case "POST reports": {
      if (session.role === "recruiter") return forbidden();
      const parsed = CreateReportInputSchema.safeParse(rawBody);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid report payload.");
      return ok(await createReport(session, parsed.data));
    }
    case "DELETE reports/:id": {
      if (session.role === "recruiter") return forbidden();
      if (!b) return notFound();
      const success = await deleteReport(session, b);
      return success ? ok({ ok: true }) : notFound();
    }
    case "POST reports/scheduled/:id/toggle": {
      if (session.role === "recruiter") return forbidden();
      if (!b) return notFound();
      const res = await toggleScheduledReport(session, b);
      return res ? ok(res) : notFound();
    }

    /* ── hackathons & team registration ── */
    case "GET hackathons":
      return ok(await getHackathonsOverview(session));
    case "GET hackathons/teams":
      return ok(await listHackathonTeams(session));
    case "POST hackathons/register":
    case "POST hackathons/teams": {
      if (session.role === "recruiter") return forbidden();
      const parsed = RegisterHackathonTeamInput.safeParse(rawBody);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid hackathon registration payload.");
      return ok(await registerHackathonTeam(session, parsed.data));
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
      try {
        return ok(await createCalendarItem(session, parsed.data));
      } catch (e) {
        if (e instanceof CalendarError) return err(400, "invalid_body", e.message);
        throw e;
      }
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
      try {
        const updated = await updateCalendarItem(session, b, parsed.data);
        return updated ? ok(updated) : notFound();
      } catch (e) {
        if (e instanceof CalendarError) return err(400, "invalid_body", e.message);
        throw e;
      }
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
      return ok(await loadDynamicAssessments(session));
    case "GET assessments/:id": {
      if (!can(session.role, "assessment:attempt")) return forbidden();
      if (!found.id) return notFound();
      const test = await getAssessmentById(found.id, session);
      return test ? ok(test) : notFound();
    }
    case "POST assessments/:id/submit": {
      if (!can(session.role, "assessment:attempt")) return forbidden();
      if (!found.id) return notFound();
      const parsed = SubmitBody.safeParse(rawBody);
      if (!parsed.success) return err(400, "invalid_body", "Invalid submission.");
      const result = await submitAssessmentTest(found.id, parsed.data.answers, session);
      return result ? ok(result) : notFound();
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
        await evaluateDescriptive(
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
    case "POST ai/ocr": {
      if (!can(session.role, "assessment:attempt") && !can(session.role, "assessment:create")) return forbidden();
      const body = z
        .object({
          image: z.string().min(10),
          mimeType: z.string().optional().default("image/jpeg"),
          fileName: z.string().optional(),
        })
        .safeParse(rawBody);
      if (!body.success) return err(400, "invalid_body", "Invalid OCR request.");

      let base64Clean = body.data.image;
      let effectiveMime = body.data.mimeType;
      if (base64Clean.includes(";base64,")) {
        const parts = base64Clean.split(";base64,");
        effectiveMime = parts[0]?.replace(/^data:/, "") || effectiveMime;
        base64Clean = parts[1] || "";
      }

      const ocrRes = await geminiImageOcr(base64Clean, effectiveMime);
      if (ocrRes.ok) {
        return ok({ text: ocrRes.text });
      }

      return ok({
        text: `[Transcribed from ${body.data.fileName || "Student Answer Sheet"}]:\n${ocrRes.reason === "disabled" ? "AI Vision service offline. You can review and edit text manually." : `OCR notice: ${ocrRes.reason}. You can edit text manually.`}`,
      });
    }
    case "GET projects":
      if (session.role !== "student" && session.role !== "faculty" && session.role !== "admin" && session.role !== "hod") return forbidden();
      return ok(await listProjects(session));

    case "POST projects": {
      if (session.role !== "student" && session.role !== "faculty" && session.role !== "admin") return forbidden();
      let body = rawBody;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch {}
      }
      const data = (body as { data?: unknown })?.data ?? body;
      const parsed = CreateProjectInput.safeParse(data);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid project payload.");
      return ok(await createProject(session, parsed.data));
    }

    case "PATCH projects/:id/stage": {
      if (!b) return notFound();
      let body = rawBody;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch {}
      }
      const data = (body as { data?: unknown })?.data ?? body;
      const parsed = UpdateProjectStageInput.safeParse(data);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid stage payload.");
      const updated = await updateProjectStage(session, b, parsed.data);
      if (!updated) return notFound();
      return ok(updated);
    }

    case "POST projects/:id/review": {
      if (session.role !== "faculty" && session.role !== "hod" && session.role !== "admin") return forbidden();
      if (!b) return notFound();
      let body = rawBody;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch {}
      }
      const data = (body as { data?: unknown })?.data ?? body;
      const parsed = FacultyReviewInput.safeParse(data);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid review payload.");
      const updated = await reviewProject(session, b, parsed.data);
      if (!updated) return notFound();
      return ok(updated);
    }

    case "DELETE projects/:id": {
      if (session.role !== "student" && session.role !== "faculty" && session.role !== "admin" && session.role !== "hod") return forbidden();
      if (!b) return notFound();
      const deleted = await deleteProject(session, b);
      if (!deleted) return notFound();
      return ok({ ok: true, deleted: b });
    }

    /* ── Incubation Pipeline ── */
    case "GET incubation-pipeline": {
      if (session.role !== "incubation" && session.role !== "institution" && session.role !== "admin") return forbidden();
      const qCohort = query.get("cohort") || undefined;
      return ok(await getIncubationPipelineOverview(session, qCohort));
    }

    case "POST incubation-pipeline/ventures": {
      if (session.role !== "incubation" && session.role !== "institution" && session.role !== "admin") return forbidden();
      let body = rawBody;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch {}
      }
      const data = (body as { data?: unknown })?.data ?? body;
      const parsed = CreateVentureInput.safeParse(data);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid venture payload.");
      return ok(await createPipelineVenture(session, parsed.data));
    }

    case "PATCH incubation-pipeline/ventures/:id/stage": {
      if (session.role !== "incubation" && session.role !== "institution" && session.role !== "admin") return forbidden();
      if (!b) return notFound();
      let body = rawBody;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch {}
      }
      const data = (body as { data?: unknown })?.data ?? body;
      const parsed = UpdateVentureStageInput.safeParse(data);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid stage payload.");
      const updated = await updatePipelineVentureStage(session, b, parsed.data.stage);
      if (!updated) return notFound();
      return ok(updated);
    }

    case "POST incubation-pipeline/ventures/:id/review": {
      if (session.role !== "incubation" && session.role !== "institution" && session.role !== "admin") return forbidden();
      if (!b) return notFound();
      let body = rawBody;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch {}
      }
      const data = (body as { data?: unknown })?.data ?? body;
      const parsed = ReviewVentureInput.safeParse(data);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid review payload.");
      const updated = await reviewPipelineVenture(session, b, parsed.data);
      if (!updated) return notFound();
      return ok(updated);
    }

    case "DELETE incubation-pipeline/ventures/:id": {
      if (session.role !== "incubation" && session.role !== "institution" && session.role !== "admin") return forbidden();
      if (!b) return notFound();
      const deleted = await deletePipelineVenture(session, b);
      if (!deleted) return notFound();
      return ok({ ok: true, deleted: b });
    }

    /* ── Incubation Mentor Network ── */
    case "GET incubation/mentors": {
      if (session.role !== "incubation" && session.role !== "institution" && session.role !== "admin") return forbidden();
      return ok(await getMentorNetworkOverview(session));
    }

    case "POST incubation/mentors": {
      if (session.role !== "incubation" && session.role !== "institution" && session.role !== "admin") return forbidden();
      let body = rawBody;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch {}
      }
      const data = (body as { data?: unknown })?.data ?? body;
      const parsed = InviteMentorInput.safeParse(data);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid mentor payload.");
      return ok(await inviteMentor(session, parsed.data));
    }

    case "PATCH incubation/mentors/:id": {
      if (session.role !== "incubation" && session.role !== "institution" && session.role !== "admin") return forbidden();
      if (!b) return notFound();
      let body = rawBody;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch {}
      }
      const data = (body as { data?: unknown })?.data ?? body;
      const updated = await updateMentor(session, b, (data as Record<string, unknown>) || {});
      if (!updated) return notFound();
      return ok(updated);
    }

    case "POST incubation/mentors/:id/assign": {
      if (session.role !== "incubation" && session.role !== "institution" && session.role !== "admin") return forbidden();
      if (!b) return notFound();
      let body = rawBody;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch {}
      }
      const data = (body as { data?: unknown })?.data ?? body;
      const parsed = AssignMentorInput.safeParse(data);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid assignment payload.");
      const updated = await assignMentorToVenture(session, b, parsed.data);
      if (!updated) return notFound();
      return ok(updated);
    }

    case "POST incubation/mentors/:id/unassign": {
      if (session.role !== "incubation" && session.role !== "institution" && session.role !== "admin") return forbidden();
      if (!b) return notFound();
      let body = rawBody;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch {}
      }
      const data = (body as { ventureId?: string }) ?? {};
      const ventureId = data.ventureId || "";
      const updated = await unassignMentorFromVenture(session, b, ventureId);
      if (!updated) return notFound();
      return ok(updated);
    }

    case "POST incubation/mentors/:id/session": {
      if (session.role !== "incubation" && session.role !== "institution" && session.role !== "admin") return forbidden();
      if (!b) return notFound();
      let body = rawBody;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch {}
      }
      const data = (body as { data?: unknown })?.data ?? body;
      const parsed = LogSessionInput.safeParse(data);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid session payload.");
      const updated = await logMentorshipSession(session, b, parsed.data);
      if (!updated) return notFound();
      return ok(updated);
    }

    case "DELETE incubation/mentors/:id": {
      if (session.role !== "incubation" && session.role !== "institution" && session.role !== "admin") return forbidden();
      if (!b) return notFound();
      const deleted = await deleteMentor(session, b);
      if (!deleted) return notFound();
      return ok({ ok: true, deleted: b });
    }

    /* ── Incubation Startups ── */
    case "GET incubation/startups": {
      if (session.role !== "incubation" && session.role !== "institution" && session.role !== "admin") return forbidden();
      return ok(await getStartupPortfolioOverview(session));
    }

    case "POST incubation/startups": {
      if (session.role !== "incubation" && session.role !== "institution" && session.role !== "admin") return forbidden();
      let body = rawBody;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch {}
      }
      const data = (body as { data?: unknown })?.data ?? body;
      const parsed = CreateStartupInput.safeParse(data);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid startup payload.");
      const created = await createStartup(session, parsed.data);
      return ok(created);
    }

    case "PATCH incubation/startups/:id": {
      if (session.role !== "incubation" && session.role !== "institution" && session.role !== "admin") return forbidden();
      if (!b) return notFound();
      let body = rawBody;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch {}
      }
      const data = (body as { data?: unknown })?.data ?? body;
      const parsed = UpdateStartupInput.safeParse(data);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid startup payload.");
      const updated = await updateStartup(session, b, parsed.data);
      if (!updated) return notFound();
      return ok(updated);
    }

    case "DELETE incubation/startups/:id": {
      if (session.role !== "incubation" && session.role !== "institution" && session.role !== "admin") return forbidden();
      if (!b) return notFound();
      const deleted = await deleteStartup(session, b);
      if (!deleted) return notFound();
      return ok({ ok: true, deleted: b });
    }

    /* ── Incubation Funding Readiness ── */
    case "GET incubation/funding-readiness": {
      if (session.role !== "incubation" && session.role !== "institution" && session.role !== "admin") return forbidden();
      const qVenture = query.get("ventureId") || undefined;
      return ok(await getFundingReadinessOverview(session, qVenture));
    }

    case "PATCH incubation/funding-readiness/:id": {
      if (session.role !== "incubation" && session.role !== "institution" && session.role !== "admin") return forbidden();
      if (!b) return notFound();
      let body = rawBody;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch {}
      }
      const data = (body as { data?: unknown })?.data ?? body;
      const parsed = UpdateReadinessInput.safeParse(data);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid readiness payload.");
      const updated = await updateVentureReadiness(session, b, parsed.data);
      if (!updated) return notFound();
      return ok(updated);
    }

    /* ── Recruiter Talent Workspace ── */
    case "GET recruiter/candidates": {
      if (session.role !== "recruiter" && session.role !== "placement" && session.role !== "institution" && session.role !== "admin") return forbidden();
      const q = query.get("q") || undefined;
      const dept = query.get("department") || undefined;
      const skill = query.get("skill") || undefined;
      const minReadiness = query.get("minReadiness") ? Number(query.get("minReadiness")) : undefined;
      const minCgpa = query.get("minCgpa") ? Number(query.get("minCgpa")) : undefined;
      return ok(await searchCandidates(session, { q, department: dept, skill, minReadiness, minCgpa }));
    }

    case "GET recruiter/shortlists": {
      if (session.role !== "recruiter" && session.role !== "placement" && session.role !== "institution" && session.role !== "admin") return forbidden();
      const roleFilter = query.get("role") || undefined;
      return ok(await getShortlistsOverview(session, roleFilter));
    }

    case "POST recruiter/shortlists": {
      if (session.role !== "recruiter" && session.role !== "placement" && session.role !== "institution" && session.role !== "admin") return forbidden();
      let body = rawBody;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch {}
      }
      const data = (body as { data?: unknown })?.data ?? body;
      const parsed = CreateShortlistInput.safeParse(data);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid shortlist input.");
      try {
        const created = await createShortlist(session, parsed.data);
        return ok(created);
      } catch (e) {
        return err(400, "bad_request", (e as Error).message);
      }
    }

    case "PATCH recruiter/shortlists/:id": {
      if (session.role !== "recruiter" && session.role !== "placement" && session.role !== "institution" && session.role !== "admin") return forbidden();
      if (!b) return notFound();
      let body = rawBody;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch {}
      }
      const data = (body as { data?: unknown })?.data ?? body;
      const parsed = UpdateShortlistStageInput.safeParse(data);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid stage update.");
      const updated = await updateShortlistStage(session, b, parsed.data);
      if (!updated) return notFound();
      return ok(updated);
    }

    case "DELETE recruiter/shortlists/:id": {
      if (session.role !== "recruiter" && session.role !== "placement" && session.role !== "institution" && session.role !== "admin") return forbidden();
      if (!b) return notFound();
      const deleted = await deleteShortlist(session, b);
      if (!deleted) return notFound();
      return ok({ ok: true, deleted: b });
    }

    case "GET recruiter/interviews": {
      if (session.role !== "recruiter" && session.role !== "placement" && session.role !== "institution" && session.role !== "admin") return forbidden();
      const status = query.get("status") || undefined;
      const round = query.get("round") || undefined;
      return ok(await getInterviewsOverview(session, { status, round }));
    }

    case "POST recruiter/interviews": {
      if (session.role !== "recruiter" && session.role !== "placement" && session.role !== "institution" && session.role !== "admin") return forbidden();
      let body = rawBody;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch {}
      }
      const data = (body as { data?: unknown })?.data ?? body;
      const parsed = ScheduleInterviewInput.safeParse(data);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid schedule input.");
      try {
        const created = await scheduleInterview(session, parsed.data);
        return ok(created);
      } catch (e) {
        return err(400, "bad_request", (e as Error).message);
      }
    }

    case "PATCH recruiter/interviews/:id": {
      if (session.role !== "recruiter" && session.role !== "placement" && session.role !== "institution" && session.role !== "admin") return forbidden();
      if (!b) return notFound();
      let body = rawBody;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch {}
      }
      const data = (body as { data?: unknown })?.data ?? body;
      const parsed = SubmitInterviewFeedbackInput.safeParse(data);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid feedback input.");
      const updated = await updateInterviewFeedback(session, b, parsed.data);
      if (!updated) return notFound();
      return ok(updated);
    }

    case "DELETE recruiter/interviews/:id": {
      if (session.role !== "recruiter" && session.role !== "placement" && session.role !== "institution" && session.role !== "admin") return forbidden();
      if (!b) return notFound();
      const cancelled = await cancelInterview(session, b);
      if (!cancelled) return notFound();
      return ok({ ok: true, cancelled: b });
    }

    /* ── Placement Analytics ── */
    case "GET placement-analytics": {
      if (session.role !== "institution" && session.role !== "placement" && session.role !== "hod" && session.role !== "admin") return forbidden();
      const dept = query.get("department") || undefined;
      const tier = query.get("tier") || undefined;
      return ok(await getPlacementAnalyticsOverview(session, { department: dept, tier }));
    }

    case "PATCH placement-analytics/targets": {
      if (session.role !== "institution" && session.role !== "placement" && session.role !== "admin") return forbidden();
      let body = rawBody;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch {}
      }
      const data = (body as { data?: unknown })?.data ?? body;
      const parsed = UpdatePlacementTargetsInput.safeParse(data);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid placement targets payload.");
      const updated = await updatePlacementTargets(session, parsed.data);
      return ok(updated);
    }

    /* ── Team Finder ── */
    case "GET team-finder":
      return ok(await getTeamFinderOverview(session));

    case "POST team-finder/requests": {
      if (session.role !== "student" && session.role !== "admin") return forbidden();
      let body = rawBody;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch {}
      }
      const data = (body as { data?: unknown })?.data ?? body;
      const parsed = CreateTeamRequestInput.safeParse(data);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid team request.");
      return ok(await createTeamRequest(session, parsed.data));
    }

    case "POST team-finder/invite": {
      if (session.role !== "student" && session.role !== "admin") return forbidden();
      let body = rawBody;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch {}
      }
      const data = (body as { data?: unknown })?.data ?? body;
      const parsed = AddTeammateInput.safeParse(data);
      if (!parsed.success) return err(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid invite payload.");
      return ok(await inviteStudentToProject(session, parsed.data));
    }

    case "POST team-finder/apply": {
      let body = rawBody;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch {}
      }
      const requestId = (body as { requestId?: string })?.requestId || "";
      if (!requestId) return err(400, "invalid_body", "Request ID required.");
      return ok(await applyToTeamRequest(session, requestId));
    }

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
    case "DELETE evaluations/:id": {
      if (!can(session.role, "assessment:override-score") && !can(session.role, "assessment:create")) return forbidden();
      const delFn = getStore().evaluations.delete;
      if (delFn) {
        await delFn(session, b!);
      }
      await audit(session.name, "Evaluation deleted", `Evaluation ${b}`, { collegeId: collegeOf(), actorSub: session.sub });
      return ok({ ok: true });
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
  const collegeId = session.college === ALL_COLLEGES ? query.get("college") || null : session.college;

  // GET /students/student-options or /students/options (available to authenticated users for selection dropdowns)
  if (method === "GET" && segs.length === 2 && (segs[1] === "student-options" || segs[1] === "options")) {
    const list = await getStudentsList({ collegeId });
    let options = list.map((s) => ({
      id: s.id,
      name: s.name,
      roll: s.roll,
      section: s.section,
    }));
    if (options.length === 0) {
      options = [
        { id: "stu-1", name: "Ananya Raman", roll: "21CS0101", section: "CSE-A" },
        { id: "stu-2", name: "Anand Kumar", roll: "21CS0102", section: "CSE-A" },
        { id: "stu-3", name: "Divya Raman", roll: "21CS0108", section: "CSE-B" },
        { id: "stu-4", name: "Karthik Raja", roll: "21CS0115", section: "CSE-A" },
        { id: "stu-5", name: "Meera Nair", roll: "21CS0122", section: "CSE-C" },
        { id: "stu-6", name: "Rahul Sharma", roll: "21CS0129", section: "CSE-B" },
        { id: "stu-7", name: "Sneha Iyer", roll: "21CS0136", section: "CSE-A" },
        { id: "stu-8", name: "Pooja Sundaram", roll: "21CS0140", section: "CSE-B" },
      ];
    }
    const seen = new Set<string>();
    const uniqueOptions = options
      .filter((s) => {
        const key = s.name.trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    return ok({ students: uniqueOptions });
  }

  if (!can(session.role, "student:read-any") && !can(session.role, "department:manage") && !can(session.role, "users:manage")) {
    return forbidden();
  }

  // GET /students
  if (method === "GET" && segs.length === 1) {
    const q = query.get("q") || undefined;
    const section = query.get("section") || undefined;
    const department = query.get("department") || undefined;
    const signal = query.get("signal") || undefined;
    const list = await getStudentsList({ collegeId, q, section, department, signal });
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
  // GET /faculty/me/allocations or GET /faculty/classes — faculty subject & section allocations
  if (
    (method === "GET" && segs.length === 3 && segs[1] === "me" && segs[2] === "allocations") ||
    (method === "GET" && segs.length === 2 && segs[1] === "classes")
  ) {
    return ok(await getFacultyAllocationProfile(session));
  }

  // GET /faculty/classes/:id/roster — student roster for section
  if (method === "GET" && segs.length === 4 && segs[1] === "classes" && segs[3] === "roster" && segs[2]) {
    const students = await getSectionRoster(segs[2], session.college);
    return ok({ students });
  }

  // GET /faculty/attendance — attendance history logs
  if (method === "GET" && segs.length === 2 && segs[1] === "attendance") {
    const sectionId = query.get("sectionId") || undefined;
    return ok({ sessions: getAttendanceHistory(sectionId) });
  }

  // POST /faculty/attendance — record attendance session
  if (method === "POST" && segs.length === 2 && segs[1] === "attendance") {
    const rec = rawBody as any;
    if (!rec?.sectionId || !rec?.date) {
      return err(400, "invalid_body", "sectionId and date are required");
    }
    const saved = saveAttendanceSession({
      sectionId: String(rec.sectionId),
      courseCode: String(rec.courseCode || ""),
      courseTitle: String(rec.courseTitle || ""),
      section: String(rec.section || ""),
      date: String(rec.date),
      timeSlot: String(rec.timeSlot || "09:00 - 10:00"),
      period: Number(rec.period || 1),
      topicTaught: String(rec.topicTaught || "Lecture Topic"),
      totalStudents: Number(rec.totalStudents || 60),
      presentCount: Number(rec.presentCount || 0),
      absentCount: Number(rec.absentCount || 0),
      lateCount: Number(rec.lateCount || 0),
      odCount: Number(rec.odCount || 0),
      attendancePercent: Number(rec.attendancePercent || 0),
      absentRolls: Array.isArray(rec.absentRolls) ? rec.absentRolls : [],
      records: Array.isArray(rec.records) ? rec.records : [],
    });
    return ok({ ok: true, session: saved });
  }

  // GET /faculty/question-papers — question paper history & repository
  if (method === "GET" && segs.length === 2 && segs[1] === "question-papers") {
    const courseCode = query.get("courseCode") || undefined;
    return ok({ papers: listQuestionPapers(session.college, courseCode) });
  }

  // POST /faculty/question-papers — save generated question paper
  if (method === "POST" && segs.length === 2 && segs[1] === "question-papers") {
    const rec = rawBody as any;
    if (!rec?.courseCode || !rec?.markdown) {
      return err(400, "invalid_body", "courseCode and markdown are required");
    }
    const saved = createQuestionPaper({
      collegeId: session.college,
      courseCode: String(rec.courseCode),
      courseTitle: String(rec.courseTitle || rec.courseCode),
      department: rec.department ? String(rec.department) : undefined,
      semester: rec.semester ? String(rec.semester) : undefined,
      academicYear: rec.academicYear ? String(rec.academicYear) : undefined,
      examType: rec.examType || "Internal Assessment I",
      units: String(rec.units || "Units 1–2"),
      marks: Number(rec.marks || 50),
      duration: rec.duration ? String(rec.duration) : undefined,
      pattern: String(rec.pattern || "Part A (2 marks) + Part B (13 marks)"),
      bloomLevels: Array.isArray(rec.bloomLevels) ? rec.bloomLevels : undefined,
      markdown: String(rec.markdown),
      authorName: session.name || "Dr. Meena Raghavan",
      authorSub: session.sub || "USR-004",
      status: rec.status || "Finalized",
    });
    return ok({ ok: true, paper: saved });
  }

  // PATCH /faculty/question-papers/:id — update status
  if (method === "PATCH" && segs.length === 3 && segs[1] === "question-papers" && segs[2]) {
    const updated = updateQuestionPaper(segs[2], rawBody as any);
    if (!updated) return err(404, "not_found", "Question paper not found");
    return ok({ ok: true, paper: updated });
  }

  // DELETE /faculty/question-papers/:id — delete question paper
  if (method === "DELETE" && segs.length === 3 && segs[1] === "question-papers" && segs[2]) {
    const deleted = deleteQuestionPaper(segs[2]);
    if (!deleted) return err(404, "not_found", "Question paper not found");
    return ok({ ok: true });
  }

  // POST /faculty/classes/extra — schedule compensatory class
  if (method === "POST" && segs.length === 3 && segs[1] === "classes" && segs[2] === "extra") {
    const slot = rawBody as any;
    const stream = (await collegeStream(session.college)) || "engineering";
    const added = scheduleExtraClass(slot, stream);
    return ok({ ok: true, slot: added });
  }

  // GET /faculty/analytics or GET /faculty/classes/:id/analytics — dynamic class analytics & diagnostics
  if (
    (method === "GET" && segs.length === 2 && segs[1] === "analytics") ||
    (method === "GET" && segs.length === 4 && segs[1] === "classes" && segs[3] === "analytics")
  ) {
    const sectionId = segs[1] === "classes" ? segs[2] : (query.get("sectionId") || undefined);
    return ok(await getClassAnalyticsData(session, sectionId));
  }

  // POST /faculty/remedial/interventions — schedule remedial intervention
  if (method === "POST" && segs.length === 3 && segs[1] === "remedial" && segs[2] === "interventions") {
    let body = rawBody;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch {}
    }
    const data = (body as { data?: any })?.data || (body as any);
    if (!data?.topic || !data?.sectionId) {
      return err(400, "invalid_body", "topic and sectionId are required");
    }
    const created = await createRemedialIntervention(session, data);
    return ok({ ok: true, intervention: created });
  }

  // PATCH /faculty/remedial/interventions/:id — update remedial intervention status
  if (method === "PATCH" && segs.length === 4 && segs[1] === "remedial" && segs[2] === "interventions" && segs[3]) {
    let body = rawBody;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch {}
    }
    const data = (body as { data?: any })?.data || (body as any);
    if (!data?.status) {
      return err(400, "invalid_body", "status is required");
    }
    const updated = await updateRemedialStatus(session, segs[3], data.status);
    if (!updated) return notFound();
    return ok({ ok: true, intervention: updated });
  }

  // POST /faculty/remedial/generate-plan — AI remedial study guide & worksheet
  if (method === "POST" && segs.length === 3 && segs[1] === "remedial" && segs[2] === "generate-plan") {
    let body = rawBody;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch {}
    }
    const data = (body as { data?: any })?.data || (body as any);
    const topic = String(data?.topic || "Unit 3: Normalization & Functional Dependencies");
    const unit = String(data?.unit || "Unit 3");
    const worksheet = generateAiRemedialWorksheet(topic, unit);
    return ok({ ok: true, worksheet });
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
    try {
      const created = await createFaculty(data, collegeId);
      await audit(session.name, `Added faculty ${created.name}`, created.designation, {
        collegeId: collegeId ?? undefined,
        actorSub: session.sub,
      });
      return { status: 201, body: created };
    } catch (e: any) {
      console.error("[POST /faculty] Error creating faculty:", e);
      return err(400, "create_faculty_failed", e?.message || "Failed to create faculty member.");
    }
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
    try {
      const updated = await updateFaculty(id, data);
      if (!updated) return notFound();
      await audit(session.name, `Updated faculty ${updated.name}`, updated.designation, {
        collegeId: collegeId ?? undefined,
        actorSub: session.sub,
      });
      return ok(updated);
    } catch (e: any) {
      console.error("[PUT /faculty] Error updating faculty:", e);
      return err(400, "update_faculty_failed", e?.message || "Failed to update faculty member.");
    }
  }

  // DELETE /faculty/:id — delete faculty
  if (method === "DELETE" && segs.length === 2) {
    const id = segs[1];
    if (!id) return notFound();
    try {
      const deleted = await deleteFaculty(id);
      if (!deleted) return notFound();
      await audit(session.name, `Deleted faculty ${id}`, "Faculty Directory", {
        collegeId: collegeId ?? undefined,
        actorSub: session.sub,
      });
      return ok({ ok: true, id });
    } catch (e: any) {
      console.error("[DELETE /faculty] Error deleting faculty:", e);
      return err(400, "delete_faculty_failed", e?.message || "Failed to delete faculty member.");
    }
  }

  return notFound();
}
