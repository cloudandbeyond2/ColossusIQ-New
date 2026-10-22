import "server-only";
import type { DataStore, SettingsStore, SettingsValues } from "../store";
import { ALL_COLLEGES } from "@/config/tenancy";
import { db } from "./db";
import { collegeUuid } from "./lookups";
import { pgAudit, pgMedia, pgSites } from "./basics";
import { pgAttempts, pgCertificates, pgCourses, pgProgress, pgQuizzes, pgReadiness } from "./learning";
import { pgRecords } from "./records";
import { pgBooster, pgEvaluations, pgFacultyEvents, pgInterviews, pgNotifications, pgOutlines, pgResumes, pgSummaries } from "./teaching";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const moduleSettings = () => (db() as any).moduleSetting;

/** Saved settings pages (Branding, Security, Notification rules), one row per college and page; "all" is the platform default. */
export const pgSettings: SettingsStore = {
  async get(collegeScope, slug) {
    try {
      const collegeId = collegeScope === ALL_COLLEGES ? null : await collegeUuid(collegeScope);
      const row = (await moduleSettings().findFirst({ where: { collegeId, slug } })) as { settings: SettingsValues } | null;
      return row ? row.settings : undefined;
    } catch {
      return undefined; // an unknown college has no saved settings
    }
  },
  async save(collegeScope, slug, values) {
    const collegeId = collegeScope === ALL_COLLEGES ? null : await collegeUuid(collegeScope);
    const existing = (await moduleSettings().findFirst({ where: { collegeId, slug }, select: { id: true } })) as { id: string } | null;
    // Saving nothing resets the page: the college goes back to inheriting the default.
    if (Object.keys(values).length === 0) {
      if (existing) await moduleSettings().deleteMany({ where: { id: existing.id } });
      return;
    }
    if (existing) await moduleSettings().updateMany({ where: { id: existing.id }, data: { settings: values, updatedAt: new Date() } });
    else await moduleSettings().create({ data: { collegeId, slug, settings: values } });
  },
};
/** The PostgreSQL store (DATA_BACKEND=postgres). Calls must run inside withRequestContext(). */
export const postgresStore: DataStore = {
  kind: "postgres",
  records: pgRecords,
  sites: pgSites,
  media: pgMedia,
  audit: pgAudit,
  courses: pgCourses,
  progress: pgProgress,
  quizzes: pgQuizzes,
  attempts: pgAttempts,
  certificates: pgCertificates,
  readiness: pgReadiness,
  summaries: pgSummaries,
  outlines: pgOutlines,
  booster: pgBooster,
  facultyEvents: pgFacultyEvents,
  evaluations: pgEvaluations,
  interviews: pgInterviews,
  resumes: pgResumes,
  notifications: pgNotifications,
  settings: pgSettings,
};
