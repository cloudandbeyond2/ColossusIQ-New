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
import { dataBackend, withRequestContext } from "@/lib/data";
import {
  INITIAL_STAGES,
  type ProjectSession,
  postgresCreateProject,
  postgresDeleteProject,
  postgresListProjects,
  postgresReviewProject,
  postgresUpdateProjectStage,
} from "@/lib/data/postgres/projects";
import { sharedState } from "./global-state";

const MEMORY_SEED_PROJECTS: ProjectItem[] = [
  {
    id: "smart-campus-ai",
    title: "Smart Campus AI",
    domain: "AI/ML · IoT",
    team: ["Anand Kumar", "Divya Raman", "Karthik Iyer"],
    mentor: "Dr. Meena Raghavan",
    stage: "AI Review",
    progress: 80,
    stages: [
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
    ],
    review: {
      architecture: 82,
      documentation: 64,
      codeQuality: 76,
      testing: 58,
      innovation: 88,
      facultyApproved: false,
    },
    status: "Active",
  },
  {
    id: "agri-soil-sense",
    title: "AgriSoil Sense — low-cost soil health kit",
    domain: "AgriTech · Embedded",
    team: ["Anand Kumar", "Sanjay Rao"],
    mentor: "Prof. R. Balaji",
    stage: "Architecture",
    progress: 30,
    stages: [
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
    ],
    review: {
      architecture: 60,
      documentation: 40,
      codeQuality: 0,
      testing: 0,
      innovation: 79,
      facultyApproved: false,
    },
    status: "Active",
  },
];

const memoryProjects = sharedState("campus.projects.v1", () => new Map<string, ProjectItem[]>());

function getCollegeMemoryProjects(college: string): ProjectItem[] {
  let list = memoryProjects.get(college);
  if (!list) {
    list = [...MEMORY_SEED_PROJECTS];
    memoryProjects.set(college, list);
  }
  return list;
}

export async function listProjects(session: ProjectSession): Promise<ProjectItem[]> {
  if (dataBackend() === "postgres") {
    try {
      return await withRequestContext(
        { scope: session.college, sub: session.sub, readOnly: true },
        () => postgresListProjects(session)
      );
    } catch (e) {
      console.warn("[projects] postgres list fallback to memory:", e);
    }
  }
  return getCollegeMemoryProjects(session.college);
}

export async function createProject(
  session: ProjectSession,
  input: CreateProjectInput,
): Promise<ProjectItem> {
  if (dataBackend() === "postgres") {
    try {
      return await withRequestContext(
        { scope: session.college, sub: session.sub },
        () => postgresCreateProject(session, input)
      );
    } catch (e) {
      console.warn("[projects] postgres create fallback to memory:", e);
    }
  }

  const list = getCollegeMemoryProjects(session.college);
  const newId = `PRJ-${1000 + list.length + 1}`;
  const newItem: ProjectItem = {
    id: newId,
    title: input.title.trim(),
    domain: input.domain.trim(),
    mentor: input.mentor || "Dr. Meena Raghavan",
    team: input.team,
    stage: "Architecture",
    progress: 20,
    stages: INITIAL_STAGES,
    review: {
      architecture: 0,
      documentation: 0,
      codeQuality: 0,
      testing: 0,
      innovation: 0,
      facultyApproved: false,
    },
    repoUrl: input.repoUrl || undefined,
    docUrl: input.docUrl || undefined,
    demoUrl: input.demoUrl || undefined,
    status: "Active",
    createdAt: new Date().toISOString(),
  };

  list.unshift(newItem);
  return newItem;
}

export async function updateProjectStage(
  session: ProjectSession,
  projectId: string,
  input: UpdateProjectStageInput,
): Promise<ProjectItem | null> {
  if (dataBackend() === "postgres") {
    try {
      const res = await withRequestContext(
        { scope: session.college, sub: session.sub },
        () => postgresUpdateProjectStage(session, projectId, input)
      );
      if (res) return res;
    } catch (e) {
      console.warn("[projects] postgres update stage fallback to memory:", e);
    }
  }

  const list = getCollegeMemoryProjects(session.college);
  const found = list.find((p) => p.id === projectId || p.title.toLowerCase().includes(projectId.toLowerCase()));
  if (!found) return null;

  const targetStageIndex = STAGE_TITLES.indexOf(input.stage as StageTitle);
  const updatedStages: ProjectStage[] = STAGE_TITLES.map((st, idx) => {
    if (idx < targetStageIndex) return { title: st, status: "done" };
    if (idx === targetStageIndex) return { title: st, status: input.status || "active" };
    return { title: st, status: "todo" };
  });

  found.stage = input.stage;
  found.progress = Math.min(100, Math.round(((targetStageIndex + 1) / STAGE_TITLES.length) * 100));
  found.stages = updatedStages;
  if (input.repoUrl) found.repoUrl = input.repoUrl;
  if (input.docUrl) found.docUrl = input.docUrl;
  if (input.demoUrl) found.demoUrl = input.demoUrl;

  return found;
}

export async function reviewProject(
  session: ProjectSession,
  projectId: string,
  input: FacultyReviewInput,
): Promise<ProjectItem | null> {
  if (dataBackend() === "postgres") {
    try {
      const res = await withRequestContext(
        { scope: session.college, sub: session.sub },
        () => postgresReviewProject(session, projectId, input)
      );
      if (res) return res;
    } catch (e) {
      console.warn("[projects] postgres review fallback to memory:", e);
    }
  }

  const list = getCollegeMemoryProjects(session.college);
  const found = list.find((p) => p.id === projectId);
  if (!found) return null;

  found.review = {
    architecture: input.architecture ?? found.review.architecture,
    documentation: input.documentation ?? found.review.documentation,
    codeQuality: input.codeQuality ?? found.review.codeQuality,
    testing: input.testing ?? found.review.testing,
    innovation: input.innovation ?? found.review.innovation,
    facultyFeedback: input.facultyFeedback ?? found.review.facultyFeedback,
    facultyApproved: input.approve,
  };

  if (input.approve) {
    found.stage = "Demo";
    found.progress = Math.max(found.progress, 85);
    const demoIdx = STAGE_TITLES.indexOf("Demo");
    found.stages = STAGE_TITLES.map((st, idx) => {
      if (idx < demoIdx) return { title: st, status: "done" };
      if (idx === demoIdx) return { title: st, status: "active" };
      return { title: st, status: "todo" };
    });
  }

  return found;
}

export async function deleteProject(
  session: ProjectSession,
  projectId: string,
): Promise<boolean> {
  if (dataBackend() === "postgres") {
    try {
      const res = await withRequestContext(
        { scope: session.college, sub: session.sub },
        () => postgresDeleteProject(session, projectId)
      );
      if (res) return true;
    } catch (e) {
      console.warn("[projects] postgres delete fallback to memory:", e);
    }
  }

  const list = getCollegeMemoryProjects(session.college);
  const idx = list.findIndex(
    (p) => p.id === projectId || p.title.toLowerCase().includes(projectId.toLowerCase())
  );
  if (idx === -1) return false;
  list.splice(idx, 1);
  return true;
}

