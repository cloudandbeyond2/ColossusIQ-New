export interface AgentDef {
  id: string;
  name: string;
  summary: string;
  audience: "Student" | "Faculty" | "Institution" | "Platform";
}

/** The ColossusIQ Agent Mesh (requirements doc 2, §7). */
export const AGENTS: AgentDef[] = [
  { id: "mentor", name: "AI Mentor", summary: "Master student assistant: answers questions, coordinates other agents and recommends the next best action.", audience: "Student" },
  { id: "tutor", name: "Academic Tutor", summary: "Explains topics with examples, simplification, questions and practice.", audience: "Student" },
  { id: "study-planner", name: "Study Planner", summary: "Daily, weekly and semester plans with revision scheduling and exam countdowns.", audience: "Student" },
  { id: "revision", name: "Revision Agent", summary: "Decides what, when and how deeply to revise from your performance.", audience: "Student" },
  { id: "exam", name: "Exam Agent", summary: "Mock tests, question generation and adaptive difficulty.", audience: "Student" },
  { id: "evaluation", name: "Answer Evaluation", summary: "Evaluates short, long, case-study and descriptive answers against rubrics.", audience: "Faculty" },
  { id: "handwriting", name: "Handwritten Evaluation", summary: "Enhancement → OCR → segmentation → semantic and rubric scoring → feedback.", audience: "Faculty" },
  { id: "viva", name: "Viva Agent", summary: "Project, subject and technical viva with follow-up questions.", audience: "Student" },
  { id: "career", name: "Career Coach", summary: "Maps goal → target role → required vs current skills → gap → learning plan.", audience: "Student" },
  { id: "resume", name: "Resume Agent", summary: "Generation, rewriting, skill extraction and ATS-oriented checks.", audience: "Student" },
  { id: "interview", name: "Interview Agent", summary: "Dynamic conversational interviewer that adapts to your answers.", audience: "Student" },
  { id: "gd", name: "GD Agent", summary: "Simulated multi-person group discussions and debates.", audience: "Student" },
  { id: "communication", name: "Communication Coach", summary: "Grammar, fluency, structure, vocabulary, clarity and speaking habits.", audience: "Student" },
  { id: "language", name: "Language Coach", summary: "Beginner, conversation, workplace, travel and academic language modes.", audience: "Student" },
  { id: "competitive", name: "Competitive Exam Agent", summary: "Exam-specific preparation across national and state exams.", audience: "Student" },
  { id: "project", name: "Project Mentor", summary: "Ideas, architecture, technology choices, implementation, testing and docs.", audience: "Student" },
  { id: "research", name: "Research Agent", summary: "Research questions, literature discovery and comparison, academic writing.", audience: "Student" },
  { id: "startup", name: "Startup / Incubation", summary: "Problem discovery, business model, market analysis, pitch and MVP planning.", audience: "Student" },
  { id: "faculty-copilot", name: "Faculty Copilot", summary: "Lesson plans, notes, questions, assignments, rubrics and remedial plans.", audience: "Faculty" },
  { id: "faculty-skill", name: "Faculty Skill Coach", summary: "Personalised faculty development plans and certification.", audience: "Faculty" },
  { id: "placement", name: "Placement Agent", summary: "Job matching, eligibility, readiness and recruitment workflow.", audience: "Institution" },
  { id: "institution", name: "Institutional Intelligence", summary: "Answers management questions from institutional data, with evidence.", audience: "Institution" },
  { id: "success", name: "Student Success", summary: "Detects support signals and recommends human review — never auto-labels.", audience: "Institution" },
  { id: "event", name: "Event Agent", summary: "Events, competitions, workshops, hackathons and engagement activities.", audience: "Institution" },
  { id: "alumni", name: "Alumni Mentor", summary: "Matches students with relevant alumni and mentorship opportunities.", audience: "Student" },
  { id: "knowledge", name: "Knowledge Agent", summary: "Institution-specific RAG assistant with source citations.", audience: "Institution" },
  { id: "policy", name: "Policy Assistant", summary: "Answers strictly from approved institutional documents.", audience: "Institution" },
  { id: "notification", name: "Notification Agent", summary: "Decides which reminders to send under configured rules.", audience: "Platform" },
  { id: "analytics", name: "Analytics Agent", summary: "Turns dashboards into explainable institutional summaries.", audience: "Platform" },
  { id: "orchestrator", name: "AI Orchestrator", summary: "Intent detection, context building, agent routing, tool execution and validation.", audience: "Platform" },
];

export function findAgent(id: string | undefined): AgentDef | undefined {
  return AGENTS.find((a) => a.id === id);
}
