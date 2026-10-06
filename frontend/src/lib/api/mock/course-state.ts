import "server-only";
import { getStore } from "@/lib/data";
import { memoryState } from "@/lib/data/memory";
import type { Figure } from "@/lib/api/figure-schemas";

/* Stores for department courses (AI Course Studio → students) and each student's lesson progress. */

/** How a lesson is presented: which infographic and learning blocks accompany its text. */
export type LessonLayout = "overview" | "concepts" | "example" | "practice" | "revision";

export interface Lesson {
  id: string;
  title: string;
  minutes: number;
  objectives: string[];
  body: string;
  keyPoints: string[];
  layout?: LessonLayout;
  terms?: Array<{ term: string; meaning: string }>;
  practice?: Array<{ q: string; a: string }>;
  /** Faculty-chosen videos (YouTube embeds; NPTEL / SWAYAM links). */
  videos?: Array<{ title: string; url: string }>;
  /** Suggested reference searches and readings. */
  links?: Array<{ label: string; url: string }>;
  /** Uploaded or bundled images with captions. */
  images?: Array<{ ref: string; caption: string }>;
  /** Labelled diagrams (process, hierarchy, comparison …) drawn by the AI or the author. */
  figures?: Figure[];
}

export interface CourseUnit {
  title: string;
  /** Optional grouping shown above the chapter title, e.g. "Part II · Relational model & SQL". */
  part?: string;
  lessons: Lesson[];
}

export interface LearningCourse {
  id: string;
  collegeId: string;
  department: string;
  title: string;
  code: string;
  level: string;
  semester: string;
  credits: number;
  faculty: string;
  source: "title" | "syllabus";
  syllabus: string;
  summary: string;
  units: CourseUnit[];
  outcomes: Array<{ code: string; text: string; bloom: string }>;
  finalQuizId: string;
  status: "Draft" | "Published";
  createdBy: string;
  /** Author account (postgres: users.id); null for seeded samples. */
  createdBySub?: string | null;
  createdAt: string;
  publishedAt: string | null;
  courseRecordId: string | null;
  version: number;
}

/** Raw demo state (memory backend only) — tests inspect it directly. */
export const learningCourses = memoryState.learningCourses;
export const lessonProgress = memoryState.lessonProgress;

export function allLessons(course: LearningCourse): Lesson[] {
  return course.units.flatMap((u) => u.lessons);
}

export async function completedLessons(sub: string, courseId: string): Promise<string[]> {
  return getStore().progress.get(sub, courseId);
}

/** True when the student has read every lesson of the course (unlocks the final assessment). */
export async function courseCompleted(courseId: string, sub: string): Promise<boolean> {
  const course = await getStore().courses.get(courseId);
  if (!course) return false;
  const done = new Set(await completedLessons(sub, courseId));
  return allLessons(course).every((l) => done.has(l.id));
}
