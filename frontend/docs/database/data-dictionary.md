# ColossusIQ — database data dictionary

PostgreSQL 15+ schema for the whole platform: one university (TNTU) with many affiliated colleges across five
streams. The API runs on it with `DATA_BACKEND=postgres`; without that setting it keeps using the in-memory demo
store (see [running the app on PostgreSQL](#running-the-app-on-postgresql)).

| File | What it is |
|---|---|
| [`db/migrations/0001_init.sql`](../../db/migrations/0001_init.sql) | **Source of truth.** Extensions, enums, lookups, 49 tables, triggers, row-level security, view |
| [`db/migrations/0002_college_departments.sql`](../../db/migrations/0002_college_departments.sql) | `college_departments`: the departments each college runs (head, contacts, status), filled in from each college's stream. Student, faculty, programme and readiness figures are computed, not stored |
| [`prisma/migrations/20260929000000_init/migration.sql`](../../prisma/migrations/20260929000000_init/migration.sql) | Identical copies of the SQL migrations (plus `20260930000000_college_departments`), applied by `prisma migrate deploy` |
| [`prisma/schema.prisma`](../../prisma/schema.prisma) | Typed models (PascalCase, camelCase fields, `@map` to snake_case). Verified to diff as empty against the SQL |
| [`db/seed/0001_seed.sql`](../../db/seed/0001_seed.sql) | Demo data matching the in-app demo (7 colleges COL-1001…1007, users for every role, a published DBMS course) |
| [`db/tests/constraints.sql`](../../db/tests/constraints.sql) | Rule tests: 16 must-reject writes, RLS isolation, view range. Runs in a rolled-back transaction |
| [`db/scripts/dev-accounts.ts`](../../db/scripts/dev-accounts.ts) | Local development: sets a password on every seeded account, re-signs seeded certificates, optionally enrols an authenticator |
| [`src/lib/data/`](../../src/lib/data) | The app's data layer: one store interface, a memory implementation and a PostgreSQL implementation |
| [`tests/postgres.integration.test.ts`](../../tests/postgres.integration.test.ts) | The API against a real database (runs when `TEST_DATABASE_URL` is set) |
| [`er-diagram.md`](er-diagram.md) | Mermaid ER diagrams by domain |

This page: [running it](#running-it) · [running the app on PostgreSQL](#running-the-app-on-postgresql) · [conventions](#conventions) · [access control](#access-control-row-level-security) ·
[rules enforced in the database](#rules-enforced-in-the-database) · [placement readiness](#placement-readiness-view) ·
[mock store → table map](#mock-store--table-map) · [gaps closed](#gaps-closed) · [enums](#enums) · [tables](#tables)

## Running it

1. Create an empty database and put its URL in `.env` as `DATABASE_URL` (Prisma reads `.env`, not `.env.local`;
   see `.env.example`).
2. Run the migration, seed and tests:

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

```bash
npm run db:test
```

`db:migrate` runs `prisma migrate deploy`. On a database that already had `0001_init.sql` applied by hand, mark the
baseline instead with `npx prisma migrate resolve --applied 20260929000000_init`. With plain `psql`, run the three SQL
files in the same order with `-v ON_ERROR_STOP=1`; `db/tests/constraints.sql` also prints an `ok …` line per check.

The migration creates the `ciq_app` role (NOLOGIN). Create a login role for the API and `GRANT ciq_app TO` it. Never
run the API as the table owner or a superuser: owners and superusers bypass row-level security.

## Running the app on PostgreSQL

The API's business rules (validation, access checks, grading, generators) live in `src/lib/api/mock/*` and read and
write through the store interface in `src/lib/data/store.ts`. `DATA_BACKEND` picks the implementation:

| `DATA_BACKEND` | Store | Sign-in | Data |
|---|---|---|---|
| `memory` (default) | `src/lib/data/memory` | any email and 8+ character password; MFA code 246810 | demo data, reset on restart |
| `postgres` | `src/lib/data/postgres` (Prisma) | the account's argon2id password, for a role it holds in that college; 5 failures lock it for 15 minutes; TOTP | this database |

Local set-up:

1. Prepare a database as in [running it](#running-it), then give the seeded accounts a password (set `DEV_PASSWORD` in
   `.env` first). This also re-signs the seeded certificates with your `SESSION_SECRET`:

```bash
npm run db:dev-accounts
```

2. In `.env.local` set `DATA_BACKEND=postgres`, `DATABASE_URL` and `MFA_ENCRYPTION_KEY` (32+ characters), then run
   `npm run dev`. Sign in as, for example, the HOD of COL-1001: role *HOD*, college *Anna Institute of Technology*,
   email `hod@ait.edu.in`. The script lists every seeded sign-in.
3. MFA: accounts with an authenticator must use it. Enrol one with `npm run db:dev-accounts -- --totp <email>` and add
   the printed `otpauth://` link to an authenticator app. Accounts without one accept the demo code 246810 **outside
   production only**; in production they are refused until enrolled.

How a request runs:

- Each API request is one transaction that starts with `SET LOCAL ROLE ciq_app` and `app_set_context(college, scope,
  user)`, so row-level security applies even when `DATABASE_URL` is the table owner
  (`src/lib/data/postgres/db.ts`). Server pages use the same context (`withRequestContext`).
- Sessions stay signed cookies. The session `sub` is `users.id`; a suspended account or college loses access on its
  next request.
- Database rule violations become 409/422 responses, never internals.
- What stays in memory in both modes: rate-limit buckets, and generated content (AI replies, module dashboards, role
  homes, mock tests, projects).

Differences from the demo, by design:

- The placement board lists real students, from `v_placement_readiness`, instead of a generated cohort.
- Quiz answers, mock interviews and resume analyses are stored.
- A re-issued certificate supersedes the old one instead of deleting it.
- Withdrawn class summaries are hidden from students, not deleted.

Integration tests: point `TEST_DATABASE_URL` at a **throwaway** database prepared as above (with `DEV_PASSWORD`
set), then:

```bash
npx vitest run tests/postgres.integration.test.ts
```

## Conventions

- **Keys.** Every entity has a `uuid` primary key (`gen_random_uuid()`) and, where the UI shows an ID, a `public_id`
  in today's format:

  | Prefix | Example | Generated by |
  |---|---|---|
  | `COL-` | `COL-1001` | sequence from 1001 |
  | `USR-`, `EMP-`, `CRS-`, `EVT-`, `ROT-`, `GAL-` | `EMP-1004` | sequence from 1001 |
  | `ADM-YY-` | `ADM-26-1001` | year + sequence |
  | `LC-`, `QZ-`, `LO-`, `CS-` | `LC-8F3A2C1D` | random hex (`hex_id()`) |
  | `MED-` | `MED-` + 24 hex | random, unguessable |
  | `CIQ-YYYY-` | `CIQ-2026-0941EF15` | year + random hex |

  Lookups use natural or serial keys: `streams.key`, `college_types.name`, and `serial` ids for departments,
  programmes, terms and designations.
- **Timestamps and versions.** Tables edited through forms have `created_at`, `updated_at` (`touch_row()` trigger) and
  `version` (`bump_version()` trigger, +1 on every update). The API uses `version` for optimistic locking:
  `UPDATE … WHERE id = $1 AND version = $2`.
- **Enums.** Values that never vary by college are PostgreSQL enums whose labels are exactly the UI labels
  (`'Documents verified'`, `'Theory + Lab'`). Stream-dependent lists (departments, programmes, terms, designations)
  are lookup tables.
- **Text.** Emails are `citext`, so uniqueness ignores case. Free text has length CHECKs copied from the Zod schemas.
- **JSONB.** It is used only for document-shaped content that is always read and written whole: lesson key points,
  terms and practice, outline blocks, class-summary points, the infographic snapshot, AI results and scorecards. Each
  JSONB column has a `jsonb_typeof` / length CHECK. Anything queried or joined stays relational: lesson videos and
  images, quiz questions and answers, progress, reads.
- **Images.** Image columns come in pairs: `*_media_id` (uploaded, FK to `media_assets`) or `*_builtin` (a bundled
  `/campus/*.svg`). A CHECK allows at most one.
- **Deletes.** College-owned content cascades from its parent (units → lessons → videos). Records that other rows
  depend on for history (students, quizzes with attempts, certificates) use `RESTRICT`/`NO ACTION`. Retire them by
  status instead.

## Access control (row-level security)

The API connects as a member of `ciq_app` and opens every request's transaction with:

```sql
SELECT app_set_context(:college_id, 'college', :user_id);   -- signed-in college user
SELECT app_set_context(NULL,        'all',     :user_id);   -- University Super Admin
```

The settings are transaction-local (`set_config(…, true)`), so pooled connections cannot leak context between
requests. Without a context, college-scoped tables return **no rows**.

| Policy | Tables | Rule |
|---|---|---|
| `college_isolation` (FORCE RLS) | admissions, certificates, class_summaries, clinical_rotations, college_modules, college_websites, courses, evaluation_items, events, gallery_items, interview_sessions, learning_courses, lesson_outlines, quiz_attempts, quizzes, resume_analyses, staff, students | read and write only rows where `college_id = app_college()`, unless scope is `all` |
| `media_read` / `media_write` / `media_delete` | media_assets | university-level media (`college_id IS NULL`) is readable by everyone; writes are college-scoped |
| `via_parent` | admission_documents, admission_status_history, class_summary_reads, course_outcomes, course_units, evaluation_overrides, event_registrations, lesson_images, lesson_progress, lesson_videos, lessons, quiz_attempt_answers, quiz_questions | visible only when the parent row is visible |
| — (no RLS) | universities, streams, college_types, departments, programmes, terms, designations | shared lookups; `ciq_app` has SELECT only |
| — (no RLS) | colleges, users, role_assignments, user_credentials, user_mfa, user_sessions | identity and tenancy. Sign-in must read these before a college is known, so the **API** limits them |
| — (no RLS) | notifications, booster_step_completions, faculty_activity_events, audit_log | per-user or append-only logs. The **API** filters by `user_id` / `college_id` |

`ciq_app` cannot UPDATE or DELETE `audit_log`, `faculty_activity_events` or `evaluation_overrides`. A trigger also
blocks it for the owner.

Roles map to `role_assignments`. `admin` and `recruiter` have `college_id NULL`; every other role must have a
college (CHECK). HOD and faculty rows can carry a `department_id`.

## Rules enforced in the database

| Rule | Where | Mirrors |
|---|---|---|
| Department, programme, term and designation must belong to the college's stream (common designations allowed everywhere) | `enforce_stream_match()` on admissions, students, staff, courses, clinical_rotations, learning_courses, quizzes, class_summaries, role_assignments | `streamRuleErrors` in `src/config/resources.ts` |
| Entrance score ≤ the stream's `entrance_max` (200 / 720 / 100) | same trigger | stream-aware admissions form |
| Clinical rotations only in medical-stream colleges | same trigger | medical-only module |
| Phone `^[6-9][0-9]{9}$`, course code `^[A-Z]{2,4}[0-9]{3,4}$`, college code 4 digits | CHECK | Zod field rules |
| `end_date >= start_date`, attendance 0–100, pass mark 30–90, duration, credits and capacity ranges | CHECK | Zod field rules |
| Exactly 4 options per question, `answer` 0–3 | CHECK on `quiz_questions` | quiz builder |
| At most 3 attempts per student per quiz, safe under concurrency (the trigger numbers attempts 1–3 and `UNIQUE (quiz_id, student_id, attempt_no)` stops two sessions taking the same slot); quiz and student in the same college | `limit_quiz_attempts()`, `same_college_student()` | `learning.ts` |
| One certificate per attempt; one **active** certificate per quiz and student (older ones are superseded, not deleted) | UNIQUE + partial unique index `certificates_one_active` | certificate re-issue |
| Certificate signature is a 43-character base64url HMAC-SHA256 | CHECK | `signCertificate` |
| Event registration only for Published, open events of the student's college, within capacity | `check_event_registration()` | events module |
| Every admission status change is logged with who made it (`app.user_id`) | `log_admission_status()` → `admission_status_history` | new: status history |
| `audit_log`, `faculty_activity_events`, `evaluation_overrides` are append-only | `forbid_mutation()` + revoked grants | audit trail |
| Unit, lesson and question positions unique per parent, checked at COMMIT (`DEFERRABLE`) so reordering can swap positions | deferrable UNIQUE | course editor drag-reorder |

## Placement readiness view

`v_placement_readiness` has one row per active student and replaces the hard-coded 64/48/82 values in the mock. It
is `security_invoker`, so RLS on the underlying tables applies.

| Column | Source |
|---|---|
| `quiz_average` | Mean of the student's best submitted % per quiz, excluding `placement_aptitude` quizzes |
| `certificates` | Active (not superseded) certificates |
| `aptitude` | Best % on any `placement_aptitude` quiz |
| `interview` | `overall_score` of the latest completed mock interview |
| `resume` | `ats_score` of the latest resume analysis |
| `total` | `quiz_average × 0.35 + min(certificates, 4) / 4 × 20 + aptitude × 0.15 + interview × 0.15 + resume × 0.15` |
| `status` | `Placement ready` when total ≥ 70, quiz_average ≥ 60, certificates ≥ 2 and interview ≥ 50; `Almost ready` when total ≥ 55; otherwise `Needs work` |

## Mock store → table map

Each demo store now lives in `src/lib/data/memory/index.ts`; its PostgreSQL counterpart is in `src/lib/data/postgres/`.

| Demo store (originally in `src/lib/api/mock/`) | Tables |
|---|---|
| `records.ts` `stores.colleges` | `colleges`, `college_modules` |
| `records.ts` `stores.users` | `users`, `role_assignments`, `user_credentials`, `user_mfa` |
| `records.ts` `stores.admissions` | `admissions`, `admission_documents`, `admission_status_history`, then `students` once Enrolled |
| `records.ts` `stores.staff` | `staff` |
| `records.ts` `stores.courses` | `courses` |
| `records.ts` `stores.events` | `events`, `event_registrations` |
| `records.ts` `stores.rotations` | `clinical_rotations` |
| `records.ts` `stores.gallery` | `gallery_items` |
| `records.ts` `counters` | per-table `public_id` sequences |
| `website.ts` `sites` | `college_websites` |
| `media.ts` `media` | `media_assets` (`storage_key` for object storage, or `data` bytea for small installs) |
| `course-state.ts` `learningCourses` | `learning_courses`, `course_outcomes`, `course_units`, `lessons`, `lesson_videos`, `lesson_images` |
| `course-state.ts` `lessonProgress` | `lesson_progress` |
| `learning.ts` `quizzes` / `attempts` / `certificates` | `quizzes`, `quiz_questions`, `quiz_attempts`, `quiz_attempt_answers`, `certificates` |
| `teaching.ts` `outlines` / `summaries` / `boosterSteps` | `lesson_outlines`, `class_summaries` + `class_summary_reads`, `booster_step_completions` |
| `faculty-activity.ts` `facultyEvents` | `faculty_activity_events` |
| `router.ts` `interviews` | `interview_sessions` |
| `router.ts` `evalQueues` | `evaluation_items`, `evaluation_overrides` |
| `audit.ts` `auditTrail` | `audit_log` |
| `rate-limit.ts` `buckets` | **not stored in PostgreSQL** (use Redis or the API gateway) |
| session cookie | stays a stateless signed cookie; `user_sessions` exists only for "sign out everywhere" and revocation |
| `src/config/streams.ts`, `tenancy.ts` | `streams`, `college_types`, `departments`, `programmes`, `terms`, `designations`, `universities` (seeded) |

## Gaps closed

What the mock could not represent, and where it now lives:

- **Students as entities.** A student used to exist only as a session subject. Now `students` links the user,
  college, admission, roll number, department, programme and term, and every learning record has a real
  `student_id` FK.
- **Names instead of references.** Course faculty, rotation student and supervisor, and quiz and course authors now
  have FKs (`faculty_staff_id`, `student_id`, `supervisor_staff_id`, `created_by`). The display-name column is kept
  for records created before accounts exist.
- **Per-question quiz answers.** `quiz_attempt_answers` stores them, which enables item analysis.
- **Interview and resume scores.** `interview_sessions` and `resume_analyses` store them and feed the readiness view.
- **Evaluation override reasons.** They were discarded; now `evaluation_overrides` records them, append-only.
- **Admission audit.** Status history is recorded automatically.
- **Certificate history.** Re-issue supersedes the old certificate instead of deleting it.
- **Event sign-ups.** New `event_registrations` table.

## Enums

| Enum | Values |
|---|---|
| `admission_document` | 10th mark sheet · 12th mark sheet · Transfer certificate · Community certificate · Passport photo · Counselling allotment order |
| `admission_quota` | Government · Management · NRI |
| `admission_status` | Enquiry · Applied · Documents verified · Shortlisted · Offer sent · Fee paid · Enrolled · Rejected · Withdrawn |
| `app_role` | student · faculty · hod · placement · incubation · institution · recruiter · admin |
| `bloom_level` | Remember · Understand · Apply · Analyse · Evaluate · Create |
| `certificate_grade` | O · A+ · A · B · C |
| `certificate_kind` | course · quiz |
| `clinical_department` | General Medicine · General Surgery · Obstetrics & Gynaecology · Paediatrics · Orthopaedics · Community Medicine · Emergency Medicine · Psychiatry · Dermatology · ENT · Ophthalmology |
| `college_plan` | Campus Starter · Campus Pro · University Enterprise |
| `college_status` | Active · Onboarding · Suspended |
| `course_level` | Foundation (UG Year 1) · Intermediate (UG Year 2–3) · Advanced (UG final / PG) · Certificate / value-added |
| `course_source` | title · syllabus |
| `course_status` | Draft · Active · Archived |
| `course_type` | Theory · Lab · Theory + Lab · Elective · Project · Clinical posting · Practical / skills lab |
| `employment_type` | Permanent · Contract · Guest · Visiting |
| `evaluation_status` | pending · approved · overridden |
| `event_status` | Draft · Published · Completed · Cancelled |
| `event_type` | Seminar · Workshop · Hackathon · Cultural · Sports · Alumni · Social service |
| `faculty_event_kind` | smartboard_session · outline_saved · summary_shared · infographic_shared · video_added · quiz_published · course_published |
| `gallery_category` | Campus · Academics · Labs & Library · Hospital & Clinical · Sports · Cultural · Events · Convocation |
| `gender` | Female · Male · Non-binary · Prefer not to say |
| `home_state` | Tamil Nadu · Kerala · Karnataka · Andhra Pradesh · Telangana · Puducherry · Maharashtra · Other |
| `interview_mode` | technical · hr · behavioral |
| `lesson_layout` | overview · concepts · example · practice · revision |
| `media_type` | image/png · image/jpeg · image/webp |
| `module_group` | Career · Communication & Skills · Project & Innovation · Campus Life · Placement · Incubation · Admissions · Recruiter |
| `publish_status` | Draft · Published |
| `quiz_purpose` | department · placement_aptitude · course_final |
| `quiz_status` | Draft · Published · Closed |
| `reservation_category` | OC · BC · MBC · SC · ST · EWS |
| `rotation_phase` | Phase II · Phase III Part 1 · Phase III Part 2 · Internship (CRMI) |
| `rotation_status` | Scheduled · Ongoing · Completed · Extended |
| `school_board` | State Board · CBSE · ICSE · Other |
| `staff_status` | Active · On leave · Resigned · Retired |
| `staff_type` | Teaching · Non-teaching · Administrative |
| `student_status` | Active · Graduated · Discontinued |
| `ui_tone` | brand · gold · teal · rose · amber · sky · neutral |
| `user_status` | Invited · Active · Suspended |
| `video_kind` | youtube · link |

## Tables

Generated from the database catalog after applying the migration. "Keys" lists single-column PK/unique and every FK; multi-column uniques and CHECKs are under **Constraints**.

### `admission_documents`

**RLS:** on

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `admission_id` | uuid | no | FK → `admissions`, PK |  |
| `document` | admission_document | no | PK |  |
| `verified_at` | timestamp with time zone | no |  | now() |

### `admission_status_history`

**RLS:** on

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `id` | bigint | no | PK | identity |
| `admission_id` | uuid | no | FK → `admissions` |  |
| `from_status` | admission_status | yes |  |  |
| `to_status` | admission_status | no |  |  |
| `changed_by` | uuid | yes | FK → `users` |  |
| `changed_at` | timestamp with time zone | no |  | now() |

**Indexes**

- `admission_status_history_admission_id_changed_at_idx (admission_id, changed_at)`

### `admissions`

**RLS:** on · **Triggers:** admissions_status_log, admissions_stream, admissions_touch, admissions_version

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `id` | uuid | no | PK | gen_random_uuid() |
| `public_id` | text | no | unique | ((('ADM-'\|\| to_char(now(), 'YY')) \|\| '-') \|\| nextval('seq_admission_public')) |
| `college_id` | uuid | no | FK → `colleges` |  |
| `full_name` | text | no |  |  |
| `dob` | date | no |  |  |
| `gender` | gender | no |  |  |
| `email` | citext | no |  |  |
| `phone` | text | no |  |  |
| `city` | text | yes |  |  |
| `state` | home_state | no |  | 'Tamil Nadu' |
| `board` | school_board | no |  |  |
| `hsc_percent` | numeric(5,2) | no |  |  |
| `entrance_score` | numeric(6,2) | yes |  |  |
| `programme_id` | integer | no | FK → `programmes` |  |
| `quota` | admission_quota | no |  |  |
| `category` | reservation_category | no |  |  |
| `scholarship` | boolean | no |  | false |
| `hostel` | boolean | no |  | false |
| `guardian_name` | text | no |  |  |
| `guardian_phone` | text | no |  |  |
| `guardian_occupation` | text | yes |  |  |
| `status` | admission_status | no |  | 'Enquiry' |
| `source` | text | no |  | 'office' |
| `notes` | text | yes |  |  |
| `version` | integer | no |  | 1 |
| `created_at` | timestamp with time zone | no |  | now() |
| `updated_at` | timestamp with time zone | no |  | now() |

**Constraints**

- `CHECK ((length(city) <= 60))`
- `CHECK (((dob >= '1990-01-01'::date) AND (dob <= '2011-12-31'::date)))`
- `CHECK (((length((email)::text) <= 120) AND (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::citext)))`
- `CHECK (((entrance_score >= (0)::numeric) AND (entrance_score <= (720)::numeric)))`
- `CHECK (((length(full_name) >= 2) AND (length(full_name) <= 80)))`
- `CHECK (((length(guardian_name) >= 2) AND (length(guardian_name) <= 80)))`
- `CHECK ((length(guardian_occupation) <= 60))`
- `CHECK ((guardian_phone ~ '^[6-9][0-9]{9}$'::text))`
- `CHECK (((hsc_percent >= (35)::numeric) AND (hsc_percent <= (100)::numeric)))`
- `CHECK ((length(notes) <= 1000))`
- `CHECK ((phone ~ '^[6-9][0-9]{9}$'::text))`
- `CHECK ((source = ANY (ARRAY['office'::text, 'online'::text])))`

**Indexes**

- `admissions_college_id_status_idx (college_id, status)`
- `admissions_college_id_created_at_idx (college_id, created_at DESC)`

### `audit_log`

**RLS:** off · **Triggers:** audit_log_append_only

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `id` | bigint | no | PK | identity |
| `at` | timestamp with time zone | no |  | now() |
| `college_id` | uuid | yes | FK → `colleges` |  |
| `actor_user_id` | uuid | yes | FK → `users` |  |
| `actor_name` | text | no |  |  |
| `action` | text | no |  |  |
| `target_type` | text | yes |  |  |
| `target_id` | text | yes |  |  |
| `ip` | inet | yes |  |  |

**Constraints**

- `CHECK (((length(action) >= 2) AND (length(action) <= 160)))`
- `CHECK ((length(target_id) <= 80))`
- `CHECK ((length(target_type) <= 40))`

**Indexes**

- `audit_log_college_id_at_idx (college_id, at DESC)`

### `booster_step_completions`

**RLS:** off

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `user_id` | uuid | no | PK, FK → `users` |  |
| `track` | text | no | PK |  |
| `step` | text | no | PK |  |
| `completed_at` | timestamp with time zone | no |  | now() |

**Constraints**

- `CHECK ((step ~ '^[a-z0-9]{1,10}$'::text))`
- `CHECK ((track ~ '^[a-z-]{2,40}$'::text))`

### `certificates`

**RLS:** on · **Triggers:** certificates_same_college

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `id` | uuid | no | PK | gen_random_uuid() |
| `public_id` | text | no | unique | ((('CIQ-'\|\| to_char(now(), 'YYYY')) \|\| '-') \|\| upper(encode(gen_random_bytes(4), 'hex'))) |
| `kind` | certificate_kind | no |  |  |
| `quiz_id` | uuid | no | FK → `quizzes` |  |
| `attempt_id` | uuid | no | FK → `quiz_attempts`, unique |  |
| `student_id` | uuid | no | FK → `students` |  |
| `college_id` | uuid | no | FK → `colleges` |  |
| `student_name` | text | no |  |  |
| `title` | text | no |  |  |
| `course` | text | no |  |  |
| `department_name` | text | no |  |  |
| `marks` | smallint | no |  |  |
| `total` | smallint | no |  |  |
| `percentage` | numeric(5,2) | no |  |  |
| `grade` | certificate_grade | no |  |  |
| `grade_label` | text | no |  |  |
| `issued_at` | timestamp with time zone | no |  | now() |
| `signature` | text | no |  |  |
| `superseded_at` | timestamp with time zone | yes |  |  |
| `superseded_by_id` | uuid | yes | FK → `certificates` |  |

**Constraints**

- `CHECK (((total > 0) AND (marks <= total)))`
- `CHECK (((superseded_at IS NULL) = (superseded_by_id IS NULL)))`
- `CHECK ((marks >= 0))`
- `CHECK (((percentage >= (0)::numeric) AND (percentage <= (100)::numeric)))`
- `CHECK ((public_id ~ '^CIQ-\d{4}-[A-F0-9]{8}$'::text))`
- `CHECK ((signature ~ '^[A-Za-z0-9_-]{43}$'::text))`

**Indexes**

- `UNIQUE certificates_one_active (quiz_id, student_id) WHERE (superseded_at IS NULL)`
- `certificates_college_id_issued_at_idx (college_id, issued_at DESC)`

### `class_summaries`

**RLS:** on · **Triggers:** class_summaries_stream

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `id` | uuid | no | PK | gen_random_uuid() |
| `public_id` | text | no | unique | hex_id('CS-') |
| `college_id` | uuid | no | FK → `colleges` |  |
| `author_id` | uuid | yes | FK → `users` |  |
| `author_name` | text | no |  |  |
| `department_id` | integer | no | FK → `departments` |  |
| `course_title` | text | yes |  |  |
| `topic` | text | no |  |  |
| `title` | text | no |  |  |
| `class_date` | date | no |  |  |
| `points` | jsonb | no |  |  |
| `homework` | text | no |  | '' |
| `next_class` | text | no |  | '' |
| `resources` | jsonb | no |  | '[]' |
| `infographic` | jsonb | yes |  |  |
| `shared_at` | timestamp with time zone | no |  | now() |
| `withdrawn_at` | timestamp with time zone | yes |  |  |

**Constraints**

- `CHECK ((length(course_title) <= 120))`
- `CHECK ((length(homework) <= 600))`
- `CHECK (((infographic IS NULL) OR (jsonb_typeof(infographic) = 'object'::text)))`
- `CHECK ((length(next_class) <= 200))`
- `CHECK (json_array_len_between(points, 1, 10))`
- `CHECK ((public_id ~ '^CS-[A-F0-9]{8}$'::text))`
- `CHECK (json_array_len_between(resources, 0, 8))`
- `CHECK (((length(title) >= 3) AND (length(title) <= 140)))`
- `CHECK (((length(topic) >= 2) AND (length(topic) <= 120)))`

**Indexes**

- `class_summaries_college_id_shared_at_idx (college_id, shared_at DESC) WHERE (withdrawn_at IS NULL)`

### `class_summary_reads`

**RLS:** on

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `summary_id` | uuid | no | PK, FK → `class_summaries` |  |
| `student_id` | uuid | no | PK, FK → `students` |  |
| `read_at` | timestamp with time zone | no |  | now() |

### `clinical_rotations`

**RLS:** on · **Triggers:** clinical_rotations_stream, clinical_rotations_touch, clinical_rotations_version

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `id` | uuid | no | PK | gen_random_uuid() |
| `public_id` | text | no | unique | ('ROT-'\|\| nextval('seq_rotation_public')) |
| `college_id` | uuid | no | FK → `colleges` |  |
| `student_id` | uuid | yes | FK → `students` |  |
| `student_name` | text | no |  |  |
| `reg_no` | text | no |  |  |
| `phase` | rotation_phase | no |  |  |
| `department` | clinical_department | no |  |  |
| `unit` | text | no |  |  |
| `start_date` | date | no |  |  |
| `end_date` | date | no |  |  |
| `supervisor_staff_id` | uuid | yes | FK → `staff` |  |
| `supervisor_name` | text | no |  |  |
| `attendance` | smallint | yes |  |  |
| `competencies_signed` | smallint | yes |  |  |
| `status` | rotation_status | no |  | 'Scheduled' |
| `remarks` | text | yes |  |  |
| `version` | integer | no |  | 1 |
| `created_at` | timestamp with time zone | no |  | now() |
| `updated_at` | timestamp with time zone | no |  | now() |

**Constraints**

- `CHECK (((attendance >= 0) AND (attendance <= 100)))`
- `CHECK ((end_date >= start_date))`
- `CHECK (((competencies_signed >= 0) AND (competencies_signed <= 200)))`
- `CHECK (((end_date >= '2024-01-01'::date) AND (end_date <= '2030-12-31'::date)))`
- `CHECK ((reg_no ~ '^[A-Z0-9]{6,12}$'::text))`
- `CHECK ((length(remarks) <= 800))`
- `CHECK (((start_date >= '2024-01-01'::date) AND (start_date <= '2030-12-31'::date)))`
- `CHECK (((length(student_name) >= 2) AND (length(student_name) <= 80)))`
- `CHECK (((length(supervisor_name) >= 2) AND (length(supervisor_name) <= 80)))`
- `CHECK (((length(unit) >= 1) AND (length(unit) <= 60)))`

**Indexes**

- `clinical_rotations_college_id_start_date_idx (college_id, start_date)`

### `college_modules`

**RLS:** on

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `college_id` | uuid | no | FK → `colleges`, PK |  |
| `module` | module_group | no | PK |  |

### `college_types`

**RLS:** off

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `name` | text | no | PK |  |
| `stream_key` | text | no | FK → `streams` |  |

### `college_websites`

**RLS:** on · **Triggers:** college_websites_touch, college_websites_version

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `college_id` | uuid | no | FK → `colleges`, PK |  |
| `tagline` | text | no |  |  |
| `hero_media_id` | uuid | yes | FK → `media_assets` |  |
| `hero_builtin` | text | yes |  |  |
| `announcement` | text | yes |  |  |
| `about` | text | no |  |  |
| `principal_message` | text | yes |  |  |
| `highlights` | text | yes |  |  |
| `address` | text | no |  |  |
| `phone` | text | no |  |  |
| `email` | citext | no |  |  |
| `office_hours` | text | yes |  |  |
| `show_events` | boolean | no |  | true |
| `show_gallery` | boolean | no |  | true |
| `version` | integer | no |  | 1 |
| `updated_at` | timestamp with time zone | no |  | now() |

**Constraints**

- `CHECK (((length(about) >= 10) AND (length(about) <= 1500)))`
- `CHECK (((length(address) >= 5) AND (length(address) <= 300)))`
- `CHECK ((length(announcement) <= 140))`
- `CHECK (((hero_media_id IS NULL) <> (hero_builtin IS NULL)))`
- `CHECK (((length((email)::text) <= 120) AND (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::citext)))`
- `CHECK (((hero_builtin IS NULL) OR valid_builtin_image(hero_builtin)))`
- `CHECK ((length(highlights) <= 600))`
- `CHECK ((length(office_hours) <= 80))`
- `CHECK ((phone ~ '^[6-9][0-9]{9}$'::text))`
- `CHECK ((length(principal_message) <= 1000))`
- `CHECK (((length(tagline) >= 2) AND (length(tagline) <= 120)))`

### `colleges`

**RLS:** off · **Triggers:** colleges_touch, colleges_version

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `id` | uuid | no | PK | gen_random_uuid() |
| `public_id` | text | no | unique | ('COL-'\|\| nextval('seq_college_public')) |
| `university_id` | uuid | no | FK → `universities` |  |
| `name` | text | no |  |  |
| `code` | character(4) | no |  |  |
| `type` | text | no | FK → `college_types` |  |
| `city` | text | no |  |  |
| `established` | smallint | yes |  |  |
| `student_capacity` | integer | no |  |  |
| `principal` | text | no |  |  |
| `email` | citext | no |  |  |
| `phone` | text | no |  |  |
| `plan` | college_plan | no |  | 'Campus Pro' |
| `status` | college_status | no |  | 'Onboarding' |
| `admissions_open` | boolean | no |  | true |
| `version` | integer | no |  | 1 |
| `created_at` | timestamp with time zone | no |  | now() |
| `updated_at` | timestamp with time zone | no |  | now() |

**Constraints**

- `CHECK (((length(city) >= 2) AND (length(city) <= 60)))`
- `CHECK ((code ~ '^[0-9]{4}$'::text))`
- `CHECK (((length((email)::text) <= 120) AND (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::citext)))`
- `CHECK (((established >= 1850) AND (established <= 2030)))`
- `CHECK (((length(name) >= 3) AND (length(name) <= 100)))`
- `CHECK ((phone ~ '^[6-9][0-9]{9}$'::text))`
- `CHECK (((length(principal) >= 2) AND (length(principal) <= 80)))`
- `CHECK ((public_id ~ '^COL-\d{4}$'::text))`
- `CHECK (((student_capacity >= 60) AND (student_capacity <= 50000)))`
- `UNIQUE (university_id, code)`
- `UNIQUE (university_id, name)`

### `course_outcomes`

**RLS:** on

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `course_id` | uuid | no | FK → `learning_courses`, PK |  |
| `code` | text | no | PK |  |
| `bloom` | bloom_level | no |  |  |
| `text` | text | no |  |  |

**Constraints**

- `CHECK ((code ~ '^CO[1-9]$'::text))`
- `CHECK (((length(text) >= 5) AND (length(text) <= 400)))`

### `course_units`

**RLS:** on

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `id` | uuid | no | PK | gen_random_uuid() |
| `course_id` | uuid | no | FK → `learning_courses` |  |
| `position` | smallint | no |  |  |
| `title` | text | no |  |  |
| `part` | text | yes |  |  |

**Constraints**

- `UNIQUE (course_id, "position") DEFERRABLE`
- `CHECK ((length(part) <= 100))`
- `CHECK ((("position" >= 0) AND ("position" <= 23)))`
- `CHECK (((length(title) >= 2) AND (length(title) <= 100)))`

### `courses`

**RLS:** on · **Triggers:** courses_stream, courses_touch, courses_version

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `id` | uuid | no | PK | gen_random_uuid() |
| `public_id` | text | no | unique | ('CRS-'\|\| nextval('seq_course_public')) |
| `college_id` | uuid | no | FK → `colleges` |  |
| `code` | text | no |  |  |
| `title` | text | no |  |  |
| `department_id` | integer | no | FK → `departments` |  |
| `term_id` | integer | no | FK → `terms` |  |
| `credits` | smallint | no |  |  |
| `course_type` | course_type | no |  |  |
| `faculty_staff_id` | uuid | yes | FK → `staff` |  |
| `faculty_name` | text | no |  |  |
| `status` | course_status | no |  | 'Draft' |
| `description` | text | yes |  |  |
| `version` | integer | no |  | 1 |
| `created_at` | timestamp with time zone | no |  | now() |
| `updated_at` | timestamp with time zone | no |  | now() |

**Constraints**

- `CHECK ((code ~ '^[A-Z]{2,4}[0-9]{3,4}$'::text))`
- `UNIQUE (college_id, code)`
- `CHECK (((credits >= 1) AND (credits <= 6)))`
- `CHECK ((length(description) <= 1500))`
- `CHECK (((length(faculty_name) >= 2) AND (length(faculty_name) <= 80)))`
- `CHECK (((length(title) >= 2) AND (length(title) <= 100)))`

### `departments`

**RLS:** off

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `id` | integer | no | PK | nextval('departments_id_seq') |
| `stream_key` | text | no | FK → `streams` |  |
| `name` | text | no |  |  |

**Constraints**

- `CHECK (((length(name) >= 2) AND (length(name) <= 80)))`
- `UNIQUE (stream_key, name)`

### `designations`

**RLS:** off

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `id` | integer | no | PK | nextval('designations_id_seq') |
| `stream_key` | text | yes | FK → `streams` |  |
| `name` | text | no |  |  |

**Constraints**

- `CHECK (((length(name) >= 2) AND (length(name) <= 60)))`
- `UNIQUE NULLS NOT DISTINCT (stream_key, name)`

### `evaluation_items`

**RLS:** on

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `id` | uuid | no | PK | gen_random_uuid() |
| `college_id` | uuid | no | FK → `colleges` |  |
| `student_id` | uuid | no | FK → `students` |  |
| `assigned_to` | uuid | yes | FK → `users` |  |
| `assessment` | text | no |  |  |
| `question` | text | no |  |  |
| `answer` | text | no |  |  |
| `ai_result` | jsonb | no |  |  |
| `ai_score` | numeric(5,2) | no |  |  |
| `max_score` | numeric(5,2) | no |  |  |
| `confidence` | numeric(3,2) | no |  |  |
| `status` | evaluation_status | no |  | 'pending' |
| `final_score` | numeric(5,2) | yes |  |  |
| `reviewed_by` | uuid | yes | FK → `users` |  |
| `reviewed_at` | timestamp with time zone | yes |  |  |
| `created_at` | timestamp with time zone | no |  | now() |

**Constraints**

- `CHECK ((jsonb_typeof(ai_result) = 'object'::text))`
- `CHECK ((ai_score >= (0)::numeric))`
- `CHECK ((length(answer) <= 8000))`
- `CHECK ((length(assessment) <= 140))`
- `CHECK (((max_score > (0)::numeric) AND (ai_score <= max_score)))`
- `CHECK (((status = 'pending'::evaluation_status) = (final_score IS NULL)))`
- `CHECK (((final_score IS NULL) OR (final_score <= max_score)))`
- `CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric)))`
- `CHECK (((final_score >= (0)::numeric) AND (final_score <= (100)::numeric)))`
- `CHECK ((length(question) <= 2000))`

**Indexes**

- `evaluation_items_assigned_to_status_idx (assigned_to, status)`

### `evaluation_overrides`

**RLS:** on · **Triggers:** evaluation_overrides_append_only

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `id` | bigint | no | PK | identity |
| `item_id` | uuid | no | FK → `evaluation_items` |  |
| `overridden_by` | uuid | yes | FK → `users` |  |
| `previous_score` | numeric(5,2) | yes |  |  |
| `final_score` | numeric(5,2) | no |  |  |
| `reason` | text | no |  |  |
| `at` | timestamp with time zone | no |  | now() |

**Constraints**

- `CHECK (((final_score >= (0)::numeric) AND (final_score <= (100)::numeric)))`
- `CHECK (((length(reason) >= 5) AND (length(reason) <= 500)))`

### `event_registrations`

**RLS:** on · **Triggers:** event_registrations_check

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `event_id` | uuid | no | FK → `events`, PK |  |
| `student_id` | uuid | no | PK, FK → `students` |  |
| `registered_at` | timestamp with time zone | no |  | now() |
| `attended` | boolean | yes |  |  |

### `events`

**RLS:** on · **Triggers:** events_touch, events_version

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `id` | uuid | no | PK | gen_random_uuid() |
| `public_id` | text | no | unique | ('EVT-'\|\| nextval('seq_event_public')) |
| `college_id` | uuid | no | FK → `colleges` |  |
| `title` | text | no |  |  |
| `type` | event_type | no |  |  |
| `event_date` | date | no |  |  |
| `start_time` | time without time zone | no |  |  |
| `venue` | text | no |  |  |
| `organiser` | text | no |  |  |
| `capacity` | integer | no |  |  |
| `registration_open` | boolean | no |  | true |
| `status` | event_status | no |  | 'Draft' |
| `description` | text | yes |  |  |
| `version` | integer | no |  | 1 |
| `created_at` | timestamp with time zone | no |  | now() |
| `updated_at` | timestamp with time zone | no |  | now() |

**Constraints**

- `CHECK (((capacity >= 1) AND (capacity <= 20000)))`
- `CHECK ((length(description) <= 1500))`
- `CHECK (((event_date >= '2024-01-01'::date) AND (event_date <= '2030-12-31'::date)))`
- `CHECK (((length(organiser) >= 2) AND (length(organiser) <= 80)))`
- `CHECK (((length(title) >= 2) AND (length(title) <= 100)))`
- `CHECK (((length(venue) >= 2) AND (length(venue) <= 80)))`

**Indexes**

- `events_college_id_event_date_idx (college_id, event_date)`

### `faculty_activity_events`

**RLS:** off · **Triggers:** faculty_events_append_only

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `id` | bigint | no | PK | identity |
| `user_id` | uuid | no | FK → `users` |  |
| `college_id` | uuid | yes | FK → `colleges` |  |
| `kind` | faculty_event_kind | no |  |  |
| `at` | timestamp with time zone | no |  | now() |

**Indexes**

- `faculty_activity_events_user_id_kind_idx (user_id, kind)`

### `gallery_items`

**RLS:** on · **Triggers:** gallery_items_touch, gallery_items_version

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `id` | uuid | no | PK | gen_random_uuid() |
| `public_id` | text | no | unique | ('GAL-'\|\| nextval('seq_gallery_public')) |
| `college_id` | uuid | no | FK → `colleges` |  |
| `image_media_id` | uuid | yes | FK → `media_assets` |  |
| `image_builtin` | text | yes |  |  |
| `title` | text | no |  |  |
| `category` | gallery_category | no |  |  |
| `caption` | text | yes |  |  |
| `featured` | boolean | no |  | false |
| `status` | publish_status | no |  | 'Draft' |
| `version` | integer | no |  | 1 |
| `created_at` | timestamp with time zone | no |  | now() |
| `updated_at` | timestamp with time zone | no |  | now() |

**Constraints**

- `CHECK ((length(caption) <= 300))`
- `CHECK (((image_media_id IS NULL) <> (image_builtin IS NULL)))`
- `CHECK (((image_builtin IS NULL) OR valid_builtin_image(image_builtin)))`
- `CHECK (((length(title) >= 2) AND (length(title) <= 80)))`

**Indexes**

- `gallery_items_college_id_status_idx (college_id, status)`

### `interview_sessions`

**RLS:** on · **Triggers:** interview_same_college

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `id` | uuid | no | PK | gen_random_uuid() |
| `student_id` | uuid | no | FK → `students` |  |
| `college_id` | uuid | no | FK → `colleges` |  |
| `mode` | interview_mode | no |  |  |
| `started_at` | timestamp with time zone | no |  | now() |
| `completed_at` | timestamp with time zone | yes |  |  |
| `overall_score` | smallint | yes |  |  |
| `scorecard` | jsonb | yes |  |  |
| `turns` | jsonb | no |  | '[]' |

**Constraints**

- `CHECK (((completed_at IS NULL) = (overall_score IS NULL)))`
- `CHECK (((overall_score >= 0) AND (overall_score <= 100)))`
- `CHECK (((scorecard IS NULL) OR (jsonb_typeof(scorecard) = 'object'::text)))`
- `CHECK ((jsonb_typeof(turns) = 'array'::text))`

**Indexes**

- `interview_sessions_student_id_completed_at_idx (student_id, completed_at DESC)`

### `learning_courses`

**RLS:** on · **Triggers:** learning_courses_stream, learning_courses_touch, learning_courses_version

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `id` | uuid | no | PK | gen_random_uuid() |
| `public_id` | text | no | unique | hex_id('LC-') |
| `college_id` | uuid | no | FK → `colleges` |  |
| `department_id` | integer | no | FK → `departments` |  |
| `term_id` | integer | no | FK → `terms` |  |
| `code` | text | no |  |  |
| `title` | text | no |  |  |
| `level` | course_level | no |  |  |
| `credits` | smallint | no |  |  |
| `faculty_name` | text | no |  |  |
| `source` | course_source | no |  |  |
| `syllabus` | text | no |  | '' |
| `summary` | text | no |  |  |
| `status` | publish_status | no |  | 'Draft' |
| `course_record_id` | uuid | yes | FK → `courses`, unique |  |
| `created_by` | uuid | yes | FK → `users` |  |
| `created_by_name` | text | no |  |  |
| `published_at` | timestamp with time zone | yes |  |  |
| `version` | integer | no |  | 1 |
| `created_at` | timestamp with time zone | no |  | now() |
| `updated_at` | timestamp with time zone | no |  | now() |

**Constraints**

- `CHECK (((status = 'Published'::publish_status) = (published_at IS NOT NULL)))`
- `CHECK ((code ~ '^[A-Z]{2,4}[0-9]{3,4}$'::text))`
- `UNIQUE (college_id, code)`
- `CHECK (((credits >= 1) AND (credits <= 6)))`
- `CHECK (((length(faculty_name) >= 2) AND (length(faculty_name) <= 80)))`
- `CHECK ((public_id ~ '^LC-[A-F0-9]{8}$'::text))`
- `CHECK (((length(summary) >= 10) AND (length(summary) <= 600)))`
- `CHECK ((length(syllabus) <= 6000))`
- `CHECK (((length(title) >= 3) AND (length(title) <= 100)))`

**Indexes**

- `learning_courses_college_id_status_idx (college_id, status)`

### `lesson_images`

**RLS:** on

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `lesson_id` | uuid | no | FK → `lessons`, PK |  |
| `position` | smallint | no | PK |  |
| `image_media_id` | uuid | yes | FK → `media_assets` |  |
| `image_builtin` | text | yes |  |  |
| `caption` | text | no |  | '' |

**Constraints**

- `CHECK ((length(caption) <= 160))`
- `CHECK (((image_media_id IS NULL) <> (image_builtin IS NULL)))`
- `CHECK (((image_builtin IS NULL) OR valid_builtin_image(image_builtin)))`
- `CHECK ((("position" >= 0) AND ("position" <= 5)))`

### `lesson_outlines`

**RLS:** on

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `id` | uuid | no | PK | gen_random_uuid() |
| `public_id` | text | no | unique | hex_id('LO-') |
| `college_id` | uuid | no | FK → `colleges` |  |
| `author_id` | uuid | no | FK → `users` |  |
| `topic` | text | no |  |  |
| `course_title` | text | yes |  |  |
| `minutes` | smallint | no |  |  |
| `blocks` | jsonb | no |  |  |
| `created_at` | timestamp with time zone | no |  | now() |

**Constraints**

- `CHECK (json_array_len_between(blocks, 1, 12))`
- `CHECK ((length(course_title) <= 120))`
- `CHECK (((minutes >= 30) AND (minutes <= 180)))`
- `CHECK ((public_id ~ '^LO-[A-F0-9]{8}$'::text))`
- `CHECK (((length(topic) >= 2) AND (length(topic) <= 120)))`

**Indexes**

- `lesson_outlines_author_id_created_at_idx (author_id, created_at DESC)`

### `lesson_progress`

**RLS:** on

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `student_id` | uuid | no | PK, FK → `students` |  |
| `lesson_id` | uuid | no | FK → `lessons`, PK |  |
| `completed_at` | timestamp with time zone | no |  | now() |

**Indexes**

- `lesson_progress_lesson_id_idx (lesson_id)`

### `lesson_videos`

**RLS:** on

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `lesson_id` | uuid | no | FK → `lessons`, PK |  |
| `position` | smallint | no | PK |  |
| `title` | text | no |  |  |
| `url` | text | no |  |  |
| `kind` | video_kind | no |  |  |
| `youtube_id` | text | yes |  |  |

**Constraints**

- `CHECK (((kind = 'youtube'::video_kind) = (youtube_id IS NOT NULL)))`
- `CHECK ((("position" >= 0) AND ("position" <= 5)))`
- `CHECK (((length(title) >= 1) AND (length(title) <= 120)))`
- `CHECK (((url ~ '^https://'::text) AND (length(url) <= 300)))`
- `CHECK ((youtube_id ~ '^[A-Za-z0-9_-]{11}$'::text))`

### `lessons`

**RLS:** on

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `id` | uuid | no | PK | gen_random_uuid() |
| `unit_id` | uuid | no | FK → `course_units` |  |
| `course_id` | uuid | no | FK → `learning_courses` |  |
| `code` | text | no |  |  |
| `position` | smallint | no |  |  |
| `title` | text | no |  |  |
| `minutes` | smallint | no |  |  |
| `layout` | lesson_layout | no |  | 'concepts' |
| `body` | text | no |  |  |
| `objectives` | jsonb | no |  | '[]' |
| `key_points` | jsonb | no |  |  |
| `terms` | jsonb | no |  | '[]' |
| `practice` | jsonb | no |  | '[]' |
| `links` | jsonb | no |  | '[]' |

**Constraints**

- `CHECK (((length(body) >= 20) AND (length(body) <= 8000)))`
- `CHECK ((code ~ '^L\d{1,3}$'::text))`
- `UNIQUE (course_id, code) DEFERRABLE`
- `CHECK (json_array_len_between(key_points, 1, 6))`
- `CHECK (json_array_len_between(links, 0, 6))`
- `CHECK (((minutes >= 5) AND (minutes <= 180)))`
- `CHECK (json_array_len_between(objectives, 0, 6))`
- `CHECK ((("position" >= 0) AND ("position" <= 14)))`
- `CHECK (json_array_len_between(practice, 0, 6))`
- `CHECK (json_array_len_between(terms, 0, 8))`
- `CHECK (((length(title) >= 2) AND (length(title) <= 120)))`
- `UNIQUE (unit_id, "position") DEFERRABLE`

**Indexes**

- `lessons_course_id_idx (course_id)`

### `media_assets`

**RLS:** on

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `id` | uuid | no | PK | gen_random_uuid() |
| `public_id` | text | no | unique | ('MED-'\|\| encode(gen_random_bytes(12), 'hex')) |
| `college_id` | uuid | yes | FK → `colleges` |  |
| `content_type` | media_type | no |  |  |
| `byte_size` | integer | no |  |  |
| `sha256` | bytea | no |  |  |
| `storage_key` | text | yes |  |  |
| `data` | bytea | yes |  |  |
| `uploaded_by` | uuid | yes | FK → `users` |  |
| `created_at` | timestamp with time zone | no |  | now() |

**Constraints**

- `CHECK (((byte_size >= 1) AND (byte_size <= 2097152)))`
- `CHECK (((storage_key IS NOT NULL) OR (data IS NOT NULL)))`
- `CHECK ((public_id ~ '^MED-[a-f0-9]{24}$'::text))`
- `CHECK ((length(sha256) = 32))`
- `CHECK ((length(storage_key) <= 300))`

**Indexes**

- `media_assets_college_id_created_at_idx (college_id, created_at DESC)`

### `notifications`

**RLS:** off

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `id` | uuid | no | PK | gen_random_uuid() |
| `user_id` | uuid | no | FK → `users` |  |
| `college_id` | uuid | yes | FK → `colleges` |  |
| `title` | text | no |  |  |
| `body` | text | no |  |  |
| `tone` | ui_tone | no |  | 'brand' |
| `link` | text | yes |  |  |
| `created_at` | timestamp with time zone | no |  | now() |
| `read_at` | timestamp with time zone | yes |  |  |

**Constraints**

- `CHECK ((length(body) <= 600))`
- `CHECK ((link ~ '^/[A-Za-z0-9/_?=&.-]*$'::text))`
- `CHECK (((length(title) >= 2) AND (length(title) <= 120)))`

**Indexes**

- `notifications_user_id_created_at_idx (user_id, created_at DESC) WHERE (read_at IS NULL)`

### `programmes`

**RLS:** off

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `id` | integer | no | PK | nextval('programmes_id_seq') |
| `stream_key` | text | no | FK → `streams` |  |
| `name` | text | no |  |  |

**Constraints**

- `CHECK (((length(name) >= 2) AND (length(name) <= 80)))`
- `UNIQUE (stream_key, name)`

### `quiz_attempt_answers`

**RLS:** on

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `attempt_id` | uuid | no | FK → `quiz_attempts`, PK |  |
| `question_id` | uuid | no | PK, FK → `quiz_questions` |  |
| `chosen` | smallint | yes |  |  |
| `correct` | boolean | no |  |  |

**Constraints**

- `CHECK (((chosen >= 0) AND (chosen <= 3)))`

### `quiz_attempts`

**RLS:** on · **Triggers:** quiz_attempts_limit, quiz_attempts_same_college

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `id` | uuid | no | PK | gen_random_uuid() |
| `quiz_id` | uuid | no | FK → `quizzes` |  |
| `student_id` | uuid | no | FK → `students` |  |
| `college_id` | uuid | no | FK → `colleges` |  |
| `attempt_no` | smallint | no |  | 1 |
| `started_at` | timestamp with time zone | no |  | now() |
| `submitted_at` | timestamp with time zone | yes |  |  |
| `score` | smallint | yes |  |  |
| `total` | smallint | yes |  |  |
| `percentage` | numeric(5,2) | yes |  |  |

**Constraints**

- `CHECK (((attempt_no >= 1) AND (attempt_no <= 3)))`
- `CHECK (((submitted_at IS NULL) OR ((score IS NOT NULL) AND (total IS NOT NULL) AND (percentage IS NOT NULL) AND (score <= total))))`
- `CHECK (((percentage >= (0)::numeric) AND (percentage <= (100)::numeric)))`
- `UNIQUE (quiz_id, student_id, attempt_no)`
- `CHECK ((score >= 0))`
- `CHECK ((total > 0))`

**Indexes**

- `quiz_attempts_student_id_quiz_id_idx (student_id, quiz_id)`
- `quiz_attempts_quiz_id_idx (quiz_id)`

### `quiz_questions`

**RLS:** on

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `id` | uuid | no | PK | gen_random_uuid() |
| `quiz_id` | uuid | no | FK → `quizzes` |  |
| `position` | smallint | no |  |  |
| `prompt` | text | no |  |  |
| `options` | text[] | no |  |  |
| `answer` | smallint | no |  |  |
| `explanation` | text | no |  | '' |
| `needs_review` | boolean | no |  | false |

**Constraints**

- `CHECK (((answer >= 0) AND (answer <= 3)))`
- `CHECK ((length(explanation) <= 400))`
- `CHECK (((cardinality(options) = 4) AND (array_position(options, ''::text) IS NULL) AND (array_position(options, NULL::text) IS NULL)))`
- `CHECK ((("position" >= 0) AND ("position" <= 49)))`
- `CHECK (((length(prompt) >= 5) AND (length(prompt) <= 400)))`
- `UNIQUE (quiz_id, "position") DEFERRABLE`

### `quizzes`

**RLS:** on · **Triggers:** quizzes_stream, quizzes_touch, quizzes_version

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `id` | uuid | no | PK | gen_random_uuid() |
| `public_id` | text | no | unique | hex_id('QZ-') |
| `college_id` | uuid | no | FK → `colleges` |  |
| `purpose` | quiz_purpose | no |  | 'department' |
| `learning_course_id` | uuid | yes | FK → `learning_courses`, unique |  |
| `department_id` | integer | yes | FK → `departments` |  |
| `title` | text | no |  |  |
| `subject` | text | no |  |  |
| `pass_mark` | smallint | no |  |  |
| `duration_min` | smallint | no |  |  |
| `certificate_enabled` | boolean | no |  | true |
| `status` | quiz_status | no |  | 'Draft' |
| `created_by` | uuid | yes | FK → `users` |  |
| `created_by_name` | text | no |  |  |
| `version` | integer | no |  | 1 |
| `created_at` | timestamp with time zone | no |  | now() |
| `updated_at` | timestamp with time zone | no |  | now() |

**Constraints**

- `CHECK (((purpose = 'course_final'::quiz_purpose) = (learning_course_id IS NOT NULL)))`
- `CHECK (((purpose <> 'department'::quiz_purpose) OR (department_id IS NOT NULL)))`
- `CHECK (((duration_min >= 5) AND (duration_min <= 180)))`
- `CHECK (((pass_mark >= 30) AND (pass_mark <= 90)))`
- `CHECK ((public_id ~ '^QZ-[A-F0-9]{8}$'::text))`
- `CHECK (((length(subject) >= 2) AND (length(subject) <= 120)))`
- `CHECK (((length(title) >= 3) AND (length(title) <= 140)))`

**Indexes**

- `quizzes_college_id_status_idx (college_id, status)`

### `resume_analyses`

**RLS:** on · **Triggers:** resume_same_college

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `id` | uuid | no | PK | gen_random_uuid() |
| `student_id` | uuid | no | FK → `students` |  |
| `college_id` | uuid | no | FK → `colleges` |  |
| `target_role` | text | no |  |  |
| `ats_score` | smallint | no |  |  |
| `result` | jsonb | no |  |  |
| `created_at` | timestamp with time zone | no |  | now() |

**Constraints**

- `CHECK (((ats_score >= 0) AND (ats_score <= 100)))`
- `CHECK ((jsonb_typeof(result) = 'object'::text))`
- `CHECK ((length(target_role) <= 60))`

**Indexes**

- `resume_analyses_student_id_created_at_idx (student_id, created_at DESC)`

### `role_assignments`

**RLS:** off · **Triggers:** role_assignments_stream

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `id` | uuid | no | PK | gen_random_uuid() |
| `user_id` | uuid | no | FK → `users` |  |
| `role` | app_role | no |  |  |
| `college_id` | uuid | yes | FK → `colleges` |  |
| `department_id` | integer | yes | FK → `departments` |  |
| `granted_by` | uuid | yes | FK → `users` |  |
| `created_at` | timestamp with time zone | no |  | now() |

**Constraints**

- `CHECK (((role = ANY (ARRAY['admin'::app_role, 'recruiter'::app_role])) = (college_id IS NULL)))`
- `UNIQUE NULLS NOT DISTINCT (user_id, role, college_id)`

**Indexes**

- `role_assignments_college_id_role_idx (college_id, role)`

### `staff`

**RLS:** on · **Triggers:** staff_stream, staff_touch, staff_version

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `id` | uuid | no | PK | gen_random_uuid() |
| `public_id` | text | no | unique | ('EMP-'\|\| nextval('seq_staff_public')) |
| `college_id` | uuid | no | FK → `colleges` |  |
| `user_id` | uuid | yes | FK → `users`, unique |  |
| `full_name` | text | no |  |  |
| `email` | citext | no | unique |  |
| `phone` | text | no |  |  |
| `qualification` | text | yes |  |  |
| `department_id` | integer | no | FK → `departments` |  |
| `designation_id` | integer | no | FK → `designations` |  |
| `staff_type` | staff_type | no |  |  |
| `employment` | employment_type | no |  |  |
| `joining_date` | date | no |  |  |
| `experience_years` | smallint | yes |  |  |
| `status` | staff_status | no |  | 'Active' |
| `platform_access` | boolean | no |  | true |
| `notes` | text | yes |  |  |
| `version` | integer | no |  | 1 |
| `created_at` | timestamp with time zone | no |  | now() |
| `updated_at` | timestamp with time zone | no |  | now() |

**Constraints**

- `CHECK (((length((email)::text) <= 120) AND (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::citext)))`
- `CHECK (((experience_years >= 0) AND (experience_years <= 50)))`
- `CHECK (((length(full_name) >= 2) AND (length(full_name) <= 80)))`
- `CHECK (((joining_date >= '1970-01-01'::date) AND (joining_date <= '2030-12-31'::date)))`
- `CHECK ((length(notes) <= 1000))`
- `CHECK ((phone ~ '^[6-9][0-9]{9}$'::text))`
- `CHECK ((length(qualification) <= 80))`

**Indexes**

- `staff_college_id_department_id_idx (college_id, department_id)`

### `streams`

**RLS:** off

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `key` | text | no | PK |  |
| `label` | text | no |  |  |
| `regulator` | text | no |  |  |
| `term_label` | text | no |  |  |
| `entrance_label` | text | no |  |  |
| `entrance_max` | integer | no |  |  |

**Constraints**

- `CHECK (((entrance_max >= 1) AND (entrance_max <= 1000)))`
- `CHECK ((key = ANY (ARRAY['engineering'::text, 'medical'::text, 'artsScience'::text, 'management'::text, 'polytechnic'::text])))`

### `students`

**RLS:** on · **Triggers:** students_stream, students_touch, students_version

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `id` | uuid | no | PK | gen_random_uuid() |
| `user_id` | uuid | no | FK → `users`, unique |  |
| `college_id` | uuid | no | FK → `colleges` |  |
| `admission_id` | uuid | yes | FK → `admissions`, unique |  |
| `roll_no` | text | no |  |  |
| `department_id` | integer | no | FK → `departments` |  |
| `programme_id` | integer | no | FK → `programmes` |  |
| `term_id` | integer | yes | FK → `terms` |  |
| `batch_year` | smallint | no |  |  |
| `status` | student_status | no |  | 'Active' |
| `version` | integer | no |  | 1 |
| `created_at` | timestamp with time zone | no |  | now() |
| `updated_at` | timestamp with time zone | no |  | now() |

**Constraints**

- `CHECK (((batch_year >= 2000) AND (batch_year <= 2100)))`
- `UNIQUE (college_id, roll_no)`
- `CHECK ((roll_no ~ '^[A-Z0-9]{4,16}$'::text))`

**Indexes**

- `students_college_id_department_id_idx (college_id, department_id)`

### `terms`

**RLS:** off

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `id` | integer | no | PK | nextval('terms_id_seq') |
| `stream_key` | text | no | FK → `streams` |  |
| `name` | text | no |  |  |
| `position` | smallint | no |  |  |

**Constraints**

- `CHECK (((length(name) >= 1) AND (length(name) <= 30)))`
- `UNIQUE (stream_key, name)`
- `UNIQUE (stream_key, "position")`

### `universities`

**RLS:** off

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `id` | uuid | no | PK | gen_random_uuid() |
| `slug` | text | no | unique |  |
| `name` | text | no |  |  |
| `short_name` | text | no |  |  |
| `created_at` | timestamp with time zone | no |  | now() |

**Constraints**

- `CHECK (((length(name) >= 3) AND (length(name) <= 160)))`
- `CHECK (((length(short_name) >= 2) AND (length(short_name) <= 20)))`
- `CHECK ((slug ~ '^[a-z0-9-]{2,40}$'::text))`

### `user_credentials`

**RLS:** off

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `user_id` | uuid | no | PK, FK → `users` |  |
| `password_hash` | text | no |  |  |
| `password_changed_at` | timestamp with time zone | no |  | now() |
| `failed_attempts` | smallint | no |  | 0 |
| `locked_until` | timestamp with time zone | yes |  |  |

**Constraints**

- `CHECK ((failed_attempts >= 0))`
- `CHECK ((password_hash ~~ '$argon2id$%'::text))`

### `user_mfa`

**RLS:** off

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `user_id` | uuid | no | PK, FK → `users` |  |
| `totp_secret_encrypted` | bytea | no |  |  |
| `recovery_code_hashes` | text[] | no |  | '{}'[] |
| `enabled_at` | timestamp with time zone | no |  | now() |

### `user_sessions`

**RLS:** off

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `id` | uuid | no | PK | gen_random_uuid() |
| `user_id` | uuid | no | FK → `users` |  |
| `role` | app_role | no |  |  |
| `college_id` | uuid | yes | FK → `colleges` |  |
| `mfa_passed` | boolean | no |  | false |
| `ip` | inet | yes |  |  |
| `user_agent` | text | yes |  |  |
| `created_at` | timestamp with time zone | no |  | now() |
| `expires_at` | timestamp with time zone | no |  |  |
| `revoked_at` | timestamp with time zone | yes |  |  |

**Constraints**

- `CHECK ((expires_at > created_at))`
- `CHECK ((length(user_agent) <= 400))`

**Indexes**

- `user_sessions_user_id_idx (user_id) WHERE (revoked_at IS NULL)`

### `users`

**RLS:** off · **Triggers:** users_touch, users_version

| Column | Type | Null | Keys | Default |
|---|---|---|---|---|
| `id` | uuid | no | PK | gen_random_uuid() |
| `public_id` | text | no | unique | ('USR-'\|\| nextval('seq_user_public')) |
| `university_id` | uuid | no | FK → `universities` |  |
| `email` | citext | no | unique |  |
| `full_name` | text | no |  |  |
| `status` | user_status | no |  | 'Invited' |
| `mfa_required` | boolean | no |  | true |
| `sso_only` | boolean | no |  | false |
| `notes` | text | yes |  |  |
| `last_login_at` | timestamp with time zone | yes |  |  |
| `version` | integer | no |  | 1 |
| `created_at` | timestamp with time zone | no |  | now() |
| `updated_at` | timestamp with time zone | no |  | now() |

**Constraints**

- `CHECK (((length((email)::text) <= 120) AND (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::citext)))`
- `CHECK (((length(full_name) >= 2) AND (length(full_name) <= 80)))`
- `CHECK ((length(notes) <= 500))`

