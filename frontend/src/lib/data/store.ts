import type { RecordValue, ResourceDef, ResourceRecord } from "@/config/resources";
import type { EvaluationQueueItem } from "@/lib/api/schemas";
import type { LearningCourse } from "@/lib/api/mock/course-state";
import type { FacultyEvent } from "@/lib/api/mock/faculty-activity";
import type { Certificate, Quiz, ReadinessBase } from "@/lib/api/mock/learning";
import type { ClassSummary, SavedOutline } from "@/lib/api/mock/teaching";
import type { InterviewTurn, Notification, ResumeAnalysis } from "@/lib/api/schemas";
import type { SessionPayload } from "@/lib/auth/session";

/*
 * Storage interface for the API. The business rules (validation, access checks, grading, generators)
 * live in src/lib/api/mock/* and call these methods; two implementations exist:
 *   memory   — process-local Maps with demo seed data (default; no setup needed)
 *   postgres — the schema in db/migrations, via Prisma, with row-level security per request
 *
 * Aggregates are loaded, changed by the caller and saved back (`save`). Identifiers are the public
 * ids the UI uses (COL-1001, ADM-26-1001, LC-…, QZ-…, CIQ-…); `sub` is the signed-in user's id.
 */

export type Scope = string; // a college id, or "all"

export interface RecordListQuery {
  scope: Scope;
  /** Only this college (Super Admin filter); ignored unless it is a college id. */
  college?: string;
  q?: string;
  status?: string;
  page: number;
  pageSize: number;
}
export interface RecordListResult {
  items: ResourceRecord[];
  total: number;
  counts: Record<string, number>;
}

export interface RecordStore {
  list(res: ResourceDef, query: RecordListQuery): Promise<RecordListResult>;
  /** Every record of a resource in scope (small lookups: colleges, a college's events and gallery). */
  all(res: ResourceDef, scope: Scope): Promise<ResourceRecord[]>;
  get(res: ResourceDef, id: string): Promise<ResourceRecord | undefined>;
  create(res: ResourceDef, data: Record<string, RecordValue>, collegeId: string | null): Promise<ResourceRecord>;
  /** Returns "stale" when `version` no longer matches. */
  update(res: ResourceDef, id: string, data: Record<string, RecordValue>, version: number): Promise<ResourceRecord | "stale" | undefined>;
  delete(res: ResourceDef, id: string): Promise<boolean>;
  /** Is `value` already used for `field` (case-insensitive)? `collegeId` null = anywhere. */
  taken(res: ResourceDef, field: string, value: string, collegeId: string | null, excludeId?: string): Promise<boolean>;
  count(res: ResourceDef, collegeId: string, where?: Record<string, RecordValue>): Promise<number>;
  /** Records of every scoped resource in a college (a college can only be deleted when empty). */
  countInCollege(collegeId: string): Promise<number>;
  /** The resource's computed figures (ResourceDef.stats) for these records, by record id. */
  stats(res: ResourceDef, records: ResourceRecord[]): Promise<Map<string, Record<string, number>>>;
}

export type Site = Record<string, RecordValue> & { version: number; updatedAt: string };
export interface SiteStore {
  get(collegeId: string): Promise<Site | undefined>;
  save(collegeId: string, site: Site): Promise<Site>;
}

export interface MediaItem {
  id: string;
  contentType: "image/png" | "image/jpeg" | "image/webp";
  bytes: Uint8Array;
  collegeId: string | null;
  uploadedBy: string;
  createdAt: string;
}
export interface MediaStore {
  save(item: Omit<MediaItem, "id" | "createdAt">): Promise<string>;
  get(id: string): Promise<MediaItem | undefined>;
}

export interface AuditEntry {
  at: string;
  actor: string;
  action: string;
  target: string;
  collegeId?: string | null;
}
export interface AuditStore {
  add(entry: { actor: string; action: string; target: string; collegeId?: string | null; actorSub?: string | null }): Promise<void>;
  recent(limit: number, scope?: Scope): Promise<AuditEntry[]>;
}

export interface CourseStore {
  list(scope: Scope): Promise<LearningCourse[]>;
  get(id: string): Promise<LearningCourse | undefined>;
  /** Insert or replace the whole course (units, lessons, videos, images, outcomes). */
  save(course: LearningCourse): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface ProgressStore {
  /** Completed lesson ids, in course order. */
  get(sub: string, courseId: string): Promise<string[]>;
  set(sub: string, courseId: string, lessonIds: string[]): Promise<void>;
  /** Students (subs) who have started the course. */
  learners(courseId: string): Promise<string[]>;
}

export interface QuizStore {
  /** Quizzes in scope. Course final assessments are included only when asked. */
  list(scope: Scope, opts?: { includeCourseFinals?: boolean }): Promise<Quiz[]>;
  get(id: string): Promise<Quiz | undefined>;
  save(quiz: Quiz): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface Attempt {
  quizId: string;
  studentSub: string;
  studentName: string;
  collegeId: string;
  score: number;
  total: number;
  percentage: number;
  at: string;
  /** Chosen option per question (null = unanswered), in question order. */
  answers?: Array<number | null>;
}
export interface AttemptStore {
  list(filter: { quizId?: string; studentSub?: string; collegeId?: string }): Promise<Attempt[]>;
  add(attempt: Attempt): Promise<void>;
}

export interface CertificateStore {
  list(filter: { quizId?: string; studentSub?: string; scope?: Scope }): Promise<Certificate[]>;
  get(id: string): Promise<Certificate | undefined>;
  /** Issue a certificate; `replaces` is superseded (kept for history in the database). */
  issue(cert: Certificate, replaces?: string): Promise<void>;
}

export interface ReadinessStore {
  forStudent(session: SessionPayload): Promise<ReadinessBase>;
  board(collegeId: string): Promise<ReadinessBase[]>;
}

export interface SummaryStore {
  list(scope: Scope): Promise<ClassSummary[]>;
  get(id: string): Promise<ClassSummary | undefined>;
  add(summary: ClassSummary): Promise<void>;
  markRead(id: string, sub: string): Promise<void>;
  withdraw(id: string): Promise<void>;
}

export interface OutlineStore {
  list(sub: string): Promise<SavedOutline[]>;
  get(id: string): Promise<SavedOutline | undefined>;
  add(outline: SavedOutline): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface BoosterStore {
  steps(sub: string): Promise<Set<string>>;
  setStep(sub: string, key: string, done: boolean): Promise<void>;
}

export interface FacultyEventStore {
  record(sub: string, kind: FacultyEvent, count?: number, collegeId?: string | null): Promise<void>;
  counts(sub: string): Promise<Partial<Record<FacultyEvent, number>>>;
}

export interface EvaluationStore {
  queue(session: SessionPayload): Promise<EvaluationQueueItem[]>;
  /** Approve (no override) or override with a reason. Returns the updated item. */
  decide(session: SessionPayload, id: string, decision: { finalScore: number; reason?: string }): Promise<EvaluationQueueItem | undefined>;
  /** Add an evaluated item to the queue / history */
  add?(session: SessionPayload, item: EvaluationQueueItem): Promise<EvaluationQueueItem>;
  /** Get evaluations for student */
  forStudent?(session: SessionPayload): Promise<EvaluationQueueItem[]>;
}

export interface InterviewSession {
  id: string;
  owner: string;
  mode: "technical" | "hr" | "behavioral";
  index: number;
}
export interface InterviewStore {
  start(session: SessionPayload, mode: InterviewSession["mode"]): Promise<string>;
  get(id: string): Promise<InterviewSession | undefined>;
  /** Records the answer and turn; closes the session when `turn.done`. */
  advance(id: string, answer: string, turn: InterviewTurn): Promise<void>;
}

export interface ResumeStore {
  save(session: SessionPayload, role: string, result: ResumeAnalysis): Promise<void>;
}

export interface NotificationStore {
  forUser(session: SessionPayload): Promise<Notification[]>;
}

export type SettingsValues = Record<string, string | boolean>;

export interface SettingsStore {
  get(collegeScope: string, slug: string): Promise<SettingsValues | undefined>;
  save(collegeScope: string, slug: string, values: SettingsValues): Promise<void>;
}

export interface DataStore {
  readonly kind: "memory" | "postgres";
  records: RecordStore;
  sites: SiteStore;
  media: MediaStore;
  audit: AuditStore;
  courses: CourseStore;
  progress: ProgressStore;
  quizzes: QuizStore;
  attempts: AttemptStore;
  certificates: CertificateStore;
  readiness: ReadinessStore;
  summaries: SummaryStore;
  outlines: OutlineStore;
  booster: BoosterStore;
  facultyEvents: FacultyEventStore;
  evaluations: EvaluationStore;
  interviews: InterviewStore;
  resumes: ResumeStore;
  notifications: NotificationStore;
  settings: SettingsStore;
}
