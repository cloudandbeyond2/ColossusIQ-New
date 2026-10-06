import { Suspense } from "react";
import type { ModuleDef } from "@/config/modules";
import type { Role } from "@/lib/auth/roles";
import { ModuleHeader } from "@/components/modules/module-header";
import { TemplateSkeleton } from "@/components/modules/shared";
import { MentorModule } from "./bespoke/mentor";
import { StudyPlannerModule } from "./bespoke/study-planner";
import { CoursesModule } from "./bespoke/courses";
import { MockTestsModule } from "./bespoke/mock-tests";
import { HandwrittenModule } from "./bespoke/handwritten";
import { EvaluationReviewModule } from "./bespoke/evaluation-review";
import { ResumeModule } from "./bespoke/resume";
import { InterviewModule } from "./bespoke/interview";
import { ProjectsModule } from "./bespoke/projects";
import { RolesPermissionsModule } from "./bespoke/roles-permissions";
import { CollegeWebsiteModule } from "./bespoke/college-website";
import { AiCourseStudioModule } from "./bespoke/ai-course-studio";
import { QuizBuilderModule } from "./bespoke/quiz-builder";
import { MyQuizzesModule } from "./bespoke/my-quizzes";
import { IssuedCertificatesModule, MyCertificatesModule } from "./bespoke/certificates";
import { PlacementBoardModule, PlacementReadinessModule } from "./bespoke/placement-readiness";
import { TeachingStudioModule } from "@/components/teaching/teaching-studio";
import { SkillBoosterModule } from "@/components/teaching/skill-booster";
import { ClassNotesModule } from "@/components/teaching/class-notes";
import { BiAnalyticsModule } from "./bespoke/bi-analytics";
import { ClubsModule } from "./bespoke/clubs";
import { SportsModule } from "./bespoke/sports";
import { SecuritySettingsModule } from "./bespoke/security-settings";
import { AcademicCalendarModule } from "./bespoke/academic-calendar";
import { EventGeneratorModule } from "./bespoke/event-generator";
import { ReportsModule } from "./bespoke/reports";
import { KnowledgeBaseModule } from "./bespoke/knowledge-base";
import { StudentsModule } from "./bespoke/students";
import { DepartmentFacultyModule } from "./bespoke/department-faculty";
import { DepartmentSkillsModule } from "./bespoke/department-skills";
import { EarlyWarningModule } from "./bespoke/early-warning";
import { AssignmentsModule } from "./bespoke/assignments";
import { AicteComplianceModule } from "./bespoke/aicte-compliance";
import { LanguagesModule } from "./bespoke/languages";
import { MissionPlannerModule } from "./bespoke/mission-planner";
import { ResearchModule } from "./bespoke/research";
import { AchievementsModule } from "./bespoke/achievements";
import { RefreshZoneModule } from "./bespoke/refresh-zone";
import { ExperienceModule } from "./bespoke/experience";
import { VivaModule } from "./bespoke/viva";

const BESPOKE: Record<string, (props: { role: Role }) => React.ReactNode> = {
  "aicte-compliance": ({ role }) => <AicteComplianceModule role={role} />,
  "early-warning": ({ role }) => <EarlyWarningModule role={role} />,
  "department-skills": ({ role }) => <DepartmentSkillsModule role={role} />,
  "department-faculty": ({ role }) => <DepartmentFacultyModule role={role} />,
  students: ({ role }) => <StudentsModule role={role} />,
  "knowledge-base": ({ role }) => <KnowledgeBaseModule role={role} />,
  reports: ({ role }) => <ReportsModule role={role} />,
  "event-generator": ({ role }) => <EventGeneratorModule role={role} />,
  "academic-calendar": ({ role }) => <AcademicCalendarModule role={role} />,
  "bi-analytics": () => <BiAnalyticsModule />,
  clubs: ({ role }) => <ClubsModule role={role} />,
  sports: ({ role }) => <SportsModule role={role} />,
  "security-settings": () => <SecuritySettingsModule />,
  mentor: () => <MentorModule />,
  "study-planner": () => <StudyPlannerModule />,
  courses: () => <CoursesModule />,
  "mock-tests": () => <MockTestsModule />,
  handwritten: ({ role }) => <HandwrittenModule role={role} />,
  evaluation: () => <EvaluationReviewModule />,
  resume: () => <ResumeModule />,
  interview: () => <InterviewModule />,
  projects: ({ role }) => <ProjectsModule role={role} />,
  "roles-permissions": () => <RolesPermissionsModule />,
  "college-website": () => <CollegeWebsiteModule />,
  "ai-course-studio": ({ role }) => <AiCourseStudioModule role={role} />,
  "quiz-builder": () => <QuizBuilderModule />,
  "my-quizzes": () => <MyQuizzesModule />,
  "my-certificates": () => <MyCertificatesModule />,
  "issued-certificates": () => <IssuedCertificatesModule />,
  "placement-readiness": () => <PlacementReadinessModule />,
  "placement-board": () => <PlacementBoardModule />,
  "teaching-studio": () => <TeachingStudioModule />,
  "skill-booster": ({ role }) => <SkillBoosterModule role={role} />,
  "class-notes": () => <ClassNotesModule />,
  assignments: ({ role }) => <AssignmentsModule role={role} />,
  languages: () => <LanguagesModule />,
  "mission-planner": () => <MissionPlannerModule />,
  research: () => <ResearchModule />,
  achievements: () => <AchievementsModule />,
  "refresh-zone": () => <RefreshZoneModule />,
  experience: () => <ExperienceModule />,
  viva: () => <VivaModule />,
};


export function hasBespoke(slug: string): boolean {
  return slug in BESPOKE;
}

export function BespokeModule({ mod, role }: { mod: ModuleDef; role: Role }) {
  const Render = BESPOKE[mod.slug];
  return (
    <div>
      <ModuleHeader mod={mod} role={role} />
      <Suspense fallback={<TemplateSkeleton />}>{Render ? <Render role={role} /> : null}</Suspense>
    </div>
  );
}
