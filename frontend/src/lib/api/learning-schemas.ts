import { z } from "zod";
import { Figure } from "./figure-schemas";

/* Response schemas for AI Course Studio, quizzes, certificates and placement readiness. */

export const LearningContext = z.object({
  collegeId: z.string().nullable(),
  stream: z.string().nullable(),
  streamLabel: z.string(),
  departments: z.array(z.string()),
  terms: z.array(z.string()),
});
export type LearningContext = z.infer<typeof LearningContext>;

export const BankQuestion = z.object({
  prompt: z.string(),
  options: z.tuple([z.string(), z.string(), z.string(), z.string()]),
  answer: z.number().int().min(0).max(3),
  explanation: z.string(),
});
export type BankQuestion = z.infer<typeof BankQuestion>;

export const QUIZ_DIFFICULTY = ["Easy", "Medium", "Hard", "Mixed"] as const;
/** What the Quiz Builder sends to draft questions. Shared so the browser and the server agree. */
export const GenerateQuizBody = z
  .object({
    department: z.string().min(2).max(80),
    topic: z.string().trim().max(100).optional(),
    count: z.number().int().min(3).max(20),
    difficulty: z.enum(QUIZ_DIFFICULTY).default("Mixed"),
    /** Optional notes the questions must stay within (pasted syllabus, lecture notes). */
    notes: z.string().trim().max(4000).optional(),
  })
  .strict();
export type GenerateQuizBody = z.infer<typeof GenerateQuizBody>;

export const GeneratedQuiz = z.object({
  questions: z.array(BankQuestion),
  /** Leading questions taken from the curated bank (already vetted). Everything after them needs a review. */
  fromBank: z.number(),
  templated: z.number(),
  /** Questions written by the AI model (0 when the model is off or failed). */
  aiCount: z.number().default(0),
  aiGenerated: z.boolean(),
  /** True when the model was asked but its reply could not be used. */
  aiFailed: z.boolean().default(false),
  reviewRequired: z.boolean(),
});
export type GeneratedQuiz = z.infer<typeof GeneratedQuiz>;

export const QuizResults = z.object({
  quiz: z.object({ id: z.string(), title: z.string(), status: z.enum(["Draft", "Published", "Closed"]), passMark: z.number(), questions: z.number() }),
  summary: z.object({ students: z.number(), attempts: z.number(), passed: z.number(), passRate: z.number(), average: z.number(), highest: z.number(), lowest: z.number() }),
  distribution: z.array(z.object({ label: z.string(), count: z.number() })),
  students: z.array(z.object({ name: z.string(), attempts: z.number(), best: z.number(), latest: z.number(), passed: z.boolean(), certificate: z.boolean(), lastAt: z.string() })),
  questions: z.array(z.object({ number: z.number(), prompt: z.string(), answer: z.number(), answered: z.number(), correctPct: z.number().nullable(), optionCounts: z.array(z.number()), options: z.array(z.string()) })),
});
export type QuizResults = z.infer<typeof QuizResults>;

export const StaffQuizRow = z.object({
  id: z.string(),
  title: z.string(),
  department: z.string(),
  course: z.string(),
  status: z.enum(["Draft", "Published", "Closed"]),
  questions: z.number(),
  passMark: z.number(),
  durationMin: z.number(),
  certificateEnabled: z.boolean(),
  attempts: z.number(),
  students: z.number(),
  passRate: z.number(),
  average: z.number(),
  collegeName: z.string(),
  createdAt: z.string(),
});
export type StaffQuizRow = z.infer<typeof StaffQuizRow>;

export const StaffQuizDetail = z.object({
  id: z.string(),
  collegeId: z.string(),
  title: z.string(),
  department: z.string(),
  course: z.string(),
  passMark: z.number(),
  durationMin: z.number(),
  certificateEnabled: z.boolean(),
  status: z.enum(["Draft", "Published", "Closed"]),
  questions: z.array(BankQuestion.extend({ review: z.boolean().optional() })),
  courseId: z.string().optional(),
  createdBy: z.string(),
  createdAt: z.string(),
  collegeName: z.string().optional(),
});
export type StaffQuizDetail = z.infer<typeof StaffQuizDetail>;

export const StudentQuizRow = z.object({
  id: z.string(),
  title: z.string(),
  department: z.string(),
  course: z.string(),
  questions: z.number(),
  passMark: z.number(),
  durationMin: z.number(),
  certificateEnabled: z.boolean(),
  attempts: z.number(),
  bestPercentage: z.number().nullable(),
  certificateId: z.string().nullable(),
});
export type StudentQuizRow = z.infer<typeof StudentQuizRow>;

export const StudentQuiz = z.object({
  id: z.string(),
  title: z.string(),
  department: z.string(),
  course: z.string(),
  passMark: z.number(),
  durationMin: z.number(),
  certificateEnabled: z.boolean(),
  questions: z.array(z.object({ id: z.string(), prompt: z.string(), options: z.array(z.string()) })),
});
export type StudentQuiz = z.infer<typeof StudentQuiz>;

export const QuizResult = z.object({
  score: z.number(),
  total: z.number(),
  percentage: z.number(),
  grade: z.string(),
  gradeLabel: z.string(),
  passed: z.boolean(),
  passMark: z.number(),
  attemptsLeft: z.number(),
  certificateId: z.string().nullable(),
  review: z.array(
    z.object({
      id: z.string(),
      prompt: z.string(),
      options: z.array(z.string()),
      given: z.number().nullable(),
      answer: z.number(),
      correct: z.boolean(),
      explanation: z.string(),
    }),
  ),
});
export type QuizResult = z.infer<typeof QuizResult>;

export const CertificateRow = z.object({
  id: z.string(),
  studentName: z.string(),
  collegeId: z.string(),
  collegeName: z.string(),
  quizId: z.string(),
  title: z.string(),
  course: z.string(),
  department: z.string(),
  marks: z.number(),
  total: z.number(),
  percentage: z.number(),
  grade: z.string(),
  gradeLabel: z.string(),
  issuedAt: z.string(),
});
export type CertificateRow = z.infer<typeof CertificateRow>;

export const Readiness = z.object({
  studentSub: z.string(),
  name: z.string(),
  rollNo: z.string(),
  department: z.string(),
  collegeId: z.string(),
  collegeName: z.string().optional(),
  quizAverage: z.number(),
  certificates: z.number(),
  aptitude: z.number(),
  interview: z.number(),
  resume: z.number(),
  total: z.number(),
  status: z.enum(["Placement ready", "Almost ready", "Needs work"]),
  gaps: z.array(z.string()),
});
export type Readiness = z.infer<typeof Readiness>;

export const ReadinessRules = z.object({ minTotal: z.number(), minQuizAverage: z.number(), minCertificates: z.number(), minInterview: z.number() });

export const MyReadiness = z.object({ readiness: Readiness, rules: ReadinessRules });
export const ReadinessBoard = z.object({ rows: z.array(Readiness), rules: ReadinessRules });

export const PublicCertificate = z.union([
  z.object({ valid: z.literal(false), tampered: z.boolean() }),
  z.object({
    valid: z.literal(true),
    id: z.string(),
    studentName: z.string(),
    collegeName: z.string(),
    title: z.string(),
    course: z.string(),
    department: z.string(),
    marks: z.number(),
    total: z.number(),
    percentage: z.number(),
    grade: z.string(),
    gradeLabel: z.string(),
    issuedAt: z.string(),
  }),
]);

/** Readiness weights, shown to students so the total is explainable. */
export const READINESS_WEIGHTS = [
  { key: "quizAverage", label: "Quiz average", weight: 35, icon: "exam" },
  { key: "certificates", label: "Certificates (4 = full marks)", weight: 20, icon: "diploma" },
  { key: "aptitude", label: "Aptitude", weight: 15, icon: "calculator" },
  { key: "interview", label: "Mock interview", weight: 15, icon: "microphone" },
  { key: "resume", label: "Resume / profile", weight: 15, icon: "document" },
] as const;

export const GRADE_SCALE = [
  { grade: "O", range: "90 – 100%", label: "Outstanding" },
  { grade: "A+", range: "80 – 89%", label: "Distinction" },
  { grade: "A", range: "70 – 79%", label: "First Class" },
  { grade: "B", range: "60 – 69%", label: "Second Class" },
  { grade: "C", range: "Pass mark – 59%", label: "Pass" },
  { grade: "RA", range: "Below pass mark", label: "Re-appear (no certificate)" },
] as const;

/* ── Department courses (AI Course Studio → My Courses) ── */
export const LESSON_LAYOUTS = ["overview", "concepts", "example", "practice", "revision"] as const;
export type LessonLayout = (typeof LESSON_LAYOUTS)[number];
export const Lesson = z.object({
  id: z.string(),
  title: z.string(),
  minutes: z.number(),
  objectives: z.array(z.string()),
  body: z.string(),
  keyPoints: z.array(z.string()),
  layout: z.enum(LESSON_LAYOUTS).optional(),
  terms: z.array(z.object({ term: z.string(), meaning: z.string() })).optional(),
  practice: z.array(z.object({ q: z.string(), a: z.string() })).optional(),
  videos: z.array(z.object({ title: z.string(), url: z.string() })).optional(),
  links: z.array(z.object({ label: z.string(), url: z.string() })).optional(),
  images: z.array(z.object({ ref: z.string(), caption: z.string() })).optional(),
  figures: z.array(Figure).optional(),
});
export type Lesson = z.infer<typeof Lesson>;
export const CourseUnit = z.object({ title: z.string(), part: z.string().optional(), lessons: z.array(Lesson) });
export type CourseUnit = z.infer<typeof CourseUnit>;
const Outcome = z.object({ code: z.string(), text: z.string(), bloom: z.string() });

export const StaffCourseSummary = z.object({
  id: z.string(),
  title: z.string(),
  code: z.string(),
  department: z.string(),
  semester: z.string(),
  status: z.enum(["Draft", "Published"]),
  source: z.enum(["title", "syllabus"]),
  units: z.number(),
  lessons: z.number(),
  questions: z.number(),
  flagged: z.number(),
  learners: z.number(),
  completed: z.number(),
  certificates: z.number(),
  createdBy: z.string(),
  createdAt: z.string(),
  publishedAt: z.string().nullable(),
  collegeName: z.string(),
});
export type StaffCourseSummary = z.infer<typeof StaffCourseSummary>;
export const StaffCourseList = z.object({ canPublish: z.boolean(), stream: z.string().nullable(), items: z.array(StaffCourseSummary) });

export const EditableQuestion = BankQuestion.extend({ review: z.boolean() });
export type EditableQuestion = z.infer<typeof EditableQuestion>;

export const StaffCourseDetail = StaffCourseSummary.omit({ units: true }).extend({
  level: z.string(),
  credits: z.number(),
  faculty: z.string(),
  summary: z.string(),
  syllabus: z.string(),
  units: z.array(CourseUnit),
  outcomes: z.array(Outcome),
  version: z.number(),
  courseRecordId: z.string().nullable(),
  quiz: z.object({ id: z.string(), passMark: z.number(), durationMin: z.number(), questions: z.array(EditableQuestion) }),
});
export type StaffCourseDetail = z.infer<typeof StaffCourseDetail>;

const FinalState = z.object({
  quizId: z.string(),
  questions: z.number(),
  passMark: z.number(),
  durationMin: z.number(),
  unlocked: z.boolean(),
  attempts: z.number(),
  attemptsLeft: z.number(),
  bestPercentage: z.number().nullable(),
  certificateId: z.string().nullable(),
});
export const StudentCourseSummary = z.object({
  id: z.string(),
  title: z.string(),
  code: z.string(),
  department: z.string(),
  semester: z.string(),
  credits: z.number(),
  faculty: z.string(),
  summary: z.string(),
  units: z.number(),
  lessons: z.number(),
  minutes: z.number(),
  completedLessons: z.number(),
  final: FinalState,
});
export type StudentCourseSummary = z.infer<typeof StudentCourseSummary>;
export const StudentCourseDetail = StudentCourseSummary.omit({ units: true }).extend({
  units: z.array(CourseUnit),
  outcomes: z.array(Outcome),
  completed: z.array(z.string()),
});
export type StudentCourseDetail = z.infer<typeof StudentCourseDetail>;
export const LessonProgress = z.object({ completed: z.number(), total: z.number(), finalUnlocked: z.boolean() });
