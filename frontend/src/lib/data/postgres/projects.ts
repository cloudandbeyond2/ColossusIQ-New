import "server-only";
import type { SessionPayload } from "@/lib/auth/session";
import type {
  CreateProjectInput,
  FacultyReviewInput,
  ProjectItem,
  ProjectStage,
  StageTitle,
  UpdateProjectStageInput,
} from "@/lib/api/project-schemas";
import { STAGE_TITLES } from "@/lib/api/project-schemas";
import { db, isUuid, requestUser } from "./db";
import { collegeUuid } from "./lookups";

export interface ProjectDbRow {
  id: string;
  public_id: string;
  college_id: string;
  user_id: string;
  title: string;
  domain: string;
  mentor: string;
  mentor_id: string | null;
  team: unknown;
  stage: string;
  progress: number;
  stages: unknown;
  review: unknown;
  repo_url: string;
  doc_url: string;
  demo_url: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export const INITIAL_STAGES: ProjectStage[] = [
  { title: "Idea", status: "done" },
  { title: "Team Formation", status: "done" },
  { title: "Architecture", status: "active" },
  { title: "Milestones", status: "todo" },
  { title: "Implementation", status: "todo" },
  { title: "Testing", status: "todo" },
  { title: "AI Review", status: "todo" },
  { title: "Faculty Review", status: "todo" },
  { title: "Demo", status: "todo" },
  { title: "Portfolio", status: "todo" },
];

function parseJsonArray<T>(val: unknown, fallback: T[]): T[] {
  if (Array.isArray(val)) return val as T[];
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed as T[];
    } catch {}
  }
  return fallback;
}

export type ProjectSession =
  | SessionPayload
  | {
      college: string;
      sub: string;
      role?: string;
      name?: string;
      tenant?: string;
      mfa?: boolean;
      exp?: number;
    };

function parseJsonObject<T extends object>(val: unknown, fallback: T): T {
  if (val && typeof val === "object" && !Array.isArray(val)) return val as T;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as T;
    } catch {}
  }
  return fallback;
}

function toProjectItem(r: ProjectDbRow): ProjectItem {
  const team = parseJsonArray<string>(r.team, []);
  const stages = parseJsonArray<ProjectStage>(r.stages, INITIAL_STAGES);
  const review = parseJsonObject(r.review, {
    architecture: 0,
    documentation: 0,
    codeQuality: 0,
    testing: 0,
    innovation: 0,
    facultyFeedback: "",
    facultyApproved: false,
  });

  return {
    id: r.public_id || r.id,
    title: r.title,
    domain: r.domain,
    team,
    mentor: r.mentor,
    stage: r.stage,
    progress: r.progress,
    stages,
    review,
    repoUrl: r.repo_url || undefined,
    docUrl: r.doc_url || undefined,
    demoUrl: r.demo_url || undefined,
    status: r.status,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : undefined,
  };
}

async function resolveCollegeId(scope: string): Promise<string | null> {
  if (scope === "all") return null;
  if (isUuid(scope)) return scope;
  try {
    return await collegeUuid(scope);
  } catch {
    return null;
  }
}

export async function postgresListProjects(session: ProjectSession): Promise<ProjectItem[]> {
  const t = db();
  const cId = await resolveCollegeId(session.college);
  let rows: ProjectDbRow[];

  if (cId) {
    rows = await t.$queryRaw<ProjectDbRow[]>`
      SELECT *
      FROM projects
      WHERE college_id = ${cId}::uuid
      ORDER BY created_at DESC
    `;
  } else {
    rows = await t.$queryRaw<ProjectDbRow[]>`
      SELECT *
      FROM projects
      ORDER BY created_at DESC
    `;
  }

  // If table is empty for this college, seed default projects once so user experiences seamless demo data
  if (rows.length === 0 && cId) {
    await seedDefaultProjects(session, cId);
    rows = await t.$queryRaw<ProjectDbRow[]>`
      SELECT *
      FROM projects
      WHERE college_id = ${cId}::uuid
      ORDER BY created_at DESC
    `;
  }

  return rows.map(toProjectItem);
}

async function seedDefaultProjects(session: ProjectSession, cId: string): Promise<void> {
  const t = db();
  const userSub = requestUser() || (isUuid(session.sub) ? session.sub : "00000000-0000-0000-0000-000000000001");

  const sampleStages1 = [
    { title: "Idea", status: "done" },
    { title: "Team Formation", status: "done" },
    { title: "Architecture", status: "done" },
    { title: "Milestones", status: "done" },
    { title: "Implementation", status: "done" },
    { title: "Testing", status: "done" },
    { title: "AI Review", status: "active" },
    { title: "Faculty Review", status: "todo" },
    { title: "Demo", status: "todo" },
    { title: "Portfolio", status: "todo" },
  ];

  const sampleReview1 = {
    architecture: 82,
    documentation: 64,
    codeQuality: 76,
    testing: 58,
    innovation: 88,
  };

  const sampleStages2 = [
    { title: "Idea", status: "done" },
    { title: "Team Formation", status: "done" },
    { title: "Architecture", status: "active" },
    { title: "Milestones", status: "todo" },
    { title: "Implementation", status: "todo" },
    { title: "Testing", status: "todo" },
    { title: "AI Review", status: "todo" },
    { title: "Faculty Review", status: "todo" },
    { title: "Demo", status: "todo" },
    { title: "Portfolio", status: "todo" },
  ];

  const sampleReview2 = {
    architecture: 60,
    documentation: 40,
    codeQuality: 0,
    testing: 0,
    innovation: 79,
  };

  await t.$executeRaw`
    INSERT INTO projects (
      college_id, user_id, title, domain, mentor, team, stage, progress, stages, review
    ) VALUES 
    (
      ${cId}::uuid,
      ${userSub}::uuid,
      'Smart Campus AI',
      'AI/ML · IoT',
      'Dr. Meena Raghavan',
      ${JSON.stringify(["Anand Kumar", "Divya Raman", "Karthik Iyer"])}::jsonb,
      'AI Review',
      80,
      ${JSON.stringify(sampleStages1)}::jsonb,
      ${JSON.stringify(sampleReview1)}::jsonb
    ),
    (
      ${cId}::uuid,
      ${userSub}::uuid,
      'AgriSoil Sense — low-cost soil health kit',
      'AgriTech · Embedded',
      'Prof. R. Balaji',
      ${JSON.stringify(["Anand Kumar", "Sanjay Rao"])}::jsonb,
      'Architecture',
      30,
      ${JSON.stringify(sampleStages2)}::jsonb,
      ${JSON.stringify(sampleReview2)}::jsonb
    )
  `;
}

export async function postgresCreateProject(
  session: ProjectSession,
  input: CreateProjectInput,
): Promise<ProjectItem> {
  const t = db();
  const cId = await resolveCollegeId(session.college);
  if (!cId) throw new Error("A valid college scope is required to create a project.");

  const userSub = requestUser() || (isUuid(session.sub) ? session.sub : "00000000-0000-0000-0000-000000000001");

  const stages = INITIAL_STAGES;
  const initialReview = {
    architecture: 0,
    documentation: 0,
    codeQuality: 0,
    testing: 0,
    innovation: 0,
    facultyApproved: false,
  };

  const rows = await t.$queryRaw<ProjectDbRow[]>`
    INSERT INTO projects (
      college_id,
      user_id,
      title,
      domain,
      mentor,
      team,
      stage,
      progress,
      stages,
      review,
      repo_url,
      doc_url,
      demo_url,
      status
    ) VALUES (
      ${cId}::uuid,
      ${userSub}::uuid,
      ${input.title.trim()},
      ${input.domain.trim()},
      ${input.mentor || "Dr. Meena Raghavan"},
      ${JSON.stringify(input.team)}::jsonb,
      'Architecture',
      20,
      ${JSON.stringify(stages)}::jsonb,
      ${JSON.stringify(initialReview)}::jsonb,
      ${input.repoUrl || ""},
      ${input.docUrl || ""},
      ${input.demoUrl || ""},
      'Active'
    )
    RETURNING *
  `;

  return toProjectItem(rows[0]!);
}

export async function postgresUpdateProjectStage(
  session: ProjectSession,
  projectId: string,
  input: UpdateProjectStageInput,
): Promise<ProjectItem | null> {
  const t = db();

  const existing = await t.$queryRaw<ProjectDbRow[]>`
    SELECT * FROM projects
    WHERE public_id = ${projectId} OR id::text = ${projectId} OR lower(title) = lower(${projectId})
    LIMIT 1
  `;
  if (!existing || existing.length === 0) return null;
  const curr = existing[0]!;

  const targetStageIndex = STAGE_TITLES.indexOf(input.stage as StageTitle);
  const updatedStages: ProjectStage[] = STAGE_TITLES.map((st, idx) => {
    if (idx < targetStageIndex) return { title: st, status: "done" };
    if (idx === targetStageIndex) return { title: st, status: input.status || "active" };
    return { title: st, status: "todo" };
  });

  const progress = Math.min(100, Math.round(((targetStageIndex + 1) / STAGE_TITLES.length) * 100));

  const rows = await t.$queryRaw<ProjectDbRow[]>`
    UPDATE projects
    SET
      stage = ${input.stage},
      progress = ${progress},
      stages = ${JSON.stringify(updatedStages)}::jsonb,
      repo_url = COALESCE(NULLIF(${input.repoUrl || ""}, ''), repo_url),
      doc_url = COALESCE(NULLIF(${input.docUrl || ""}, ''), doc_url),
      demo_url = COALESCE(NULLIF(${input.demoUrl || ""}, ''), demo_url),
      updated_at = now()
    WHERE id = ${curr.id}::uuid
    RETURNING *
  `;

  return toProjectItem(rows[0]!);
}

export async function postgresReviewProject(
  session: ProjectSession,
  projectId: string,
  input: FacultyReviewInput,
): Promise<ProjectItem | null> {
  const t = db();

  const existing = await t.$queryRaw<ProjectDbRow[]>`
    SELECT * FROM projects
    WHERE public_id = ${projectId} OR id::text = ${projectId} OR lower(title) = lower(${projectId})
    LIMIT 1
  `;
  if (!existing || existing.length === 0) return null;
  const curr = existing[0]!;

  const prevReview = parseJsonObject(curr.review, {
    architecture: 0,
    documentation: 0,
    codeQuality: 0,
    testing: 0,
    innovation: 0,
    facultyFeedback: "",
    facultyApproved: false,
  });

  const newReview = {
    architecture: input.architecture ?? prevReview.architecture,
    documentation: input.documentation ?? prevReview.documentation,
    codeQuality: input.codeQuality ?? prevReview.codeQuality,
    testing: input.testing ?? prevReview.testing,
    innovation: input.innovation ?? prevReview.innovation,
    facultyFeedback: input.facultyFeedback ?? prevReview.facultyFeedback,
    facultyApproved: input.approve,
  };

  // If faculty approved, advance stage to "Demo" if currently on "Faculty Review" or "AI Review"
  let newStage = curr.stage;
  let newProgress = curr.progress;
  let updatedStages = parseJsonArray<ProjectStage>(curr.stages, INITIAL_STAGES);

  if (input.approve) {
    newStage = "Demo";
    const demoIdx = STAGE_TITLES.indexOf("Demo");
    newProgress = Math.max(newProgress, 85);
    updatedStages = STAGE_TITLES.map((st, idx) => {
      if (idx < demoIdx) return { title: st, status: "done" };
      if (idx === demoIdx) return { title: st, status: "active" };
      return { title: st, status: "todo" };
    });
  }

  const rows = await t.$queryRaw<ProjectDbRow[]>`
    UPDATE projects
    SET
      review = ${JSON.stringify(newReview)}::jsonb,
      stage = ${newStage},
      progress = ${newProgress},
      stages = ${JSON.stringify(updatedStages)}::jsonb,
      updated_at = now()
    WHERE id = ${curr.id}::uuid
    RETURNING *
  `;

  return toProjectItem(rows[0]!);
}

export async function postgresDeleteProject(
  session: ProjectSession,
  projectId: string,
): Promise<boolean> {
  const t = db();
  const existing = await t.$queryRaw<ProjectDbRow[]>`
    SELECT * FROM projects
    WHERE public_id = ${projectId} OR id::text = ${projectId} OR lower(title) = lower(${projectId})
    LIMIT 1
  `;
  if (!existing || existing.length === 0) return false;
  const curr = existing[0]!;

  await t.$executeRaw`
    DELETE FROM projects
    WHERE id = ${curr.id}::uuid
  `;
  return true;
}

