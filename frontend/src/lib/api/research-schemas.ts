import { z } from "zod";

/** Shared by the browser and the server: the Research Assistant (research projects with AI help). */

export const RESEARCH_LEVELS = ["UG", "PG", "PhD", "Faculty"] as const;
export const RESEARCH_STAGES = ["Idea", "Literature review", "Method", "Data and experiments", "Writing", "Submission"] as const;
export const RESEARCH_TOOLS = ["questions", "literature", "outline", "plan"] as const;
export const MAX_PROJECTS = 12;
export const FIELD_SUGGESTIONS = [
  "Computer Science",
  "Electronics and Communication",
  "Electrical Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
  "Biotechnology",
  "Management",
  "Medicine and Health",
  "Mathematics",
  "Physics",
  "Chemistry",
  "Education",
  "Humanities and Social Sciences",
] as const;

export const MEDICAL_FIELD_SUGGESTIONS = [
  "Anatomy",
  "Physiology",
  "Biochemistry",
  "Pathology",
  "Pharmacology",
  "Microbiology",
  "Forensic Medicine & Toxicology",
  "Community Medicine & Public Health",
  "General Medicine",
  "General Surgery",
  "Obstetrics & Gynaecology",
  "Paediatrics",
  "Orthopaedics",
  "Ophthalmology",
  "Otorhinolaryngology (ENT)",
  "Dermatology, Venereology & Leprosy",
  "Radiodiagnosis & Imaging",
  "Anaesthesiology & Critical Care",
  "Emergency Medicine",
  "Psychiatry",
  "Clinical Research & Epidemiology",
] as const;

export const ResearchLevel = z.enum(RESEARCH_LEVELS);
export const ResearchStage = z.enum(RESEARCH_STAGES);
export const ResearchTool = z.enum(RESEARCH_TOOLS);
export type ResearchTool = z.infer<typeof ResearchTool>;

const fields = {
  title: z.string().trim().min(3, "Give the project a title (at least 3 characters)").max(120),
  field: z.string().trim().min(2, "Name the field of study").max(60),
  level: ResearchLevel,
  stage: ResearchStage,
  goal: z.string().trim().max(500),
  notes: z.string().trim().max(4000),
};

export const ProjectInput = z.object({ title: fields.title, field: fields.field, level: fields.level, stage: fields.stage.default("Idea"), goal: fields.goal.default("") }).strict();
export type ProjectInput = z.infer<typeof ProjectInput>;
export const ProjectPatch = z.object(fields).partial().strict();
export type ProjectPatch = z.infer<typeof ProjectPatch>;
export const ToolBody = z.object({ focus: z.string().trim().max(300).default("") }).strict();
export const ActiveBody = z.object({ id: z.string().max(40) }).strict();
export const StepToggle = z.object({ stepId: z.string().max(20), done: z.boolean() }).strict();

const Source = z.enum(["ai", "built-in"]);
const Meta = { source: Source, createdAt: z.string() };
const Line = z.string().trim().min(1).max(300);

export const QuestionsResult = z.object({
  items: z.array(z.object({ question: z.string().trim().min(3).max(500), why: z.string().trim().min(2).max(500), test: z.string().trim().min(2).max(500) })).min(1).max(8),
  ...Meta,
});
export const LiteratureResult = z.object({
  queries: z.array(z.object({ label: z.string().trim().min(1).max(60), query: z.string().trim().min(3).max(160) })).min(3).max(8),
  venues: z.array(Line).max(8),
  criteria: z.array(Line).max(8),
  tips: z.array(Line).max(6),
  ...Meta,
});
export const OutlineResult = z.object({
  sections: z.array(z.object({ heading: z.string().trim().min(2).max(100), points: z.array(Line).min(1).max(6) })).min(4).max(10),
  ...Meta,
});
export type QuestionsResult = z.infer<typeof QuestionsResult>;
export type LiteratureResult = z.infer<typeof LiteratureResult>;
export type OutlineResult = z.infer<typeof OutlineResult>;
export const PlanStep = z.object({ id: z.string().max(20), title: z.string().trim().min(1).max(150), weeks: z.number().int().min(1).max(26), tasks: z.array(Line).min(1).max(10), done: z.boolean() });
export const PlanResult = z.object({ steps: z.array(PlanStep).min(1).max(12), ...Meta });
export type PlanResult = z.infer<typeof PlanResult>;

export const ResearchProject = z.object({
  id: z.string().max(40),
  title: fields.title,
  field: fields.field,
  level: ResearchLevel,
  stage: ResearchStage,
  goal: fields.goal,
  notes: fields.notes,
  createdAt: z.string(),
  updatedAt: z.string(),
  questions: QuestionsResult.nullable(),
  literature: LiteratureResult.nullable(),
  outline: OutlineResult.nullable(),
  plan: PlanResult.nullable(),
});
export type ResearchProject = z.infer<typeof ResearchProject>;

/** The saved document: one per person. */
export const StoredResearch = z.object({
  projects: z.array(ResearchProject).max(MAX_PROJECTS),
  activeId: z.string().nullable(),
  chatCount: z.number().int().min(0),
  updatedAt: z.string(),
});
export type StoredResearch = z.infer<typeof StoredResearch>;

export const ResearchOverview = z.object({
  projects: z.array(ResearchProject),
  activeId: z.string().nullable(),
  defaults: z.object({ field: z.string(), level: ResearchLevel }),
  fieldSuggestions: z.array(z.string()),
  isMedical: z.boolean().optional().default(false),
  /** True when the AI model writes the answers; false when the built-in templates are used. */
  aiLive: z.boolean(),
});
export type ResearchOverview = z.infer<typeof ResearchOverview>;
